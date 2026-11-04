import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { isPublicDriver, mergeSharedDriverRows, readSharedDriverRow, toPublicDriver } from './sharedDriver';

const driver = INITIAL_DRIVERS[0];
const row = (revision = 1, passengers = 2) => ({ driver_id: driver.id, revision,
  received_at: '2026-11-04T16:00:00Z', snapshot: toPublicDriver({ ...driver, passengers }) });

test('public projection excludes PINs, private anchors and future top-level fields', () => {
  const source = { ...driver, directionAnchor: driver.currentLocation,
    dutyMovementAnchor: driver.currentLocation, privatePassengerNames: ['Private'], secret: 'credential' };
  const snapshot = toPublicDriver(source);
  assert.equal(isPublicDriver(snapshot), true);
  for (const field of ['pinCode', 'directionAnchor', 'dutyMovementAnchor', 'privatePassengerNames', 'secret']) {
    assert.equal(Object.hasOwn(snapshot, field), false);
  }
  assert.equal(snapshot.nameAr, driver.nameAr);
  assert.equal(snapshot.maxCapacity, driver.maxCapacity);
});

test('nested GPS extensions cannot leak into a public projection', () => {
  const source = { ...driver, currentLocation: { ...driver.currentLocation, homeAddress: 'Private', token: 'secret' } };
  const snapshot = toPublicDriver(source);
  assert.deepEqual(snapshot.currentLocation, driver.currentLocation);
  assert.notEqual(snapshot.currentLocation, source.currentLocation);
  assert.equal(source.currentLocation.homeAddress, 'Private');
});

test('every existing roster profile projects to a valid feed record', () => {
  for (const entry of INITIAL_DRIVERS) assert.equal(isPublicDriver(toPublicDriver(entry)), true);
});

test('public input rejects credentials or extra fields rather than retaining them', () => {
  for (const extra of [{ pinCode: '1234' }, { passengerName: 'Private' }, { directionAnchor: driver.currentLocation }]) {
    assert.equal(isPublicDriver({ ...row().snapshot, ...extra }), false);
  }
  assert.equal(isPublicDriver({ ...row().snapshot,
    currentLocation: { ...driver.currentLocation, secret: 'Private' } }), false);
});

test('public feed rejects invalid occupancy, coordinates and statuses', () => {
  for (const patch of [{ passengers: 8 }, { passengers: -1 }, { maxCapacity: 0 }, { status: 'unknown' },
    { currentLocation: { ...driver.currentLocation, lat: 100 } }]) {
    assert.equal(isPublicDriver({ ...row().snapshot, ...patch }), false);
  }
});

test('feed row validates driver identity, server revision and receipt time', () => {
  assert.deepEqual(readSharedDriverRow(row()), row());
  for (const patch of [{ driver_id: 'other' }, { revision: 0 }, { revision: 1.5 },
    { revision: Number.MAX_SAFE_INTEGER + 1 }, { received_at: 'invalid' }, { snapshot: null }]) {
    assert.equal(readSharedDriverRow({ ...row(), ...patch }), null);
  }
});

test('late responses and replayed revisions cannot roll back a newer driver snapshot', () => {
  const current = [row(5, 4)];
  assert.deepEqual(mergeSharedDriverRows(current, [row(3, 1)]), current);
  assert.deepEqual(mergeSharedDriverRows(current, [row(5, 2)]), current);
  assert.equal(mergeSharedDriverRows(current, [row(6, 3)])![0].snapshot.passengers, 3);
  assert.equal(current[0].snapshot.passengers, 4);
});

test('one malformed record rejects the incoming batch without losing existing drivers', () => {
  const current = [row(2)];
  assert.equal(mergeSharedDriverRows(current, [row(3), { ...row(4), driver_id: 'wrong' }]), null);
  assert.equal(mergeSharedDriverRows(current, [row(3), row(4)]), null);
  assert.equal(mergeSharedDriverRows(current, null), null);
  assert.deepEqual(mergeSharedDriverRows(current, []), current);
});

test('a newer snapshot of one driver retains other drivers', () => {
  const other = { ...row(), driver_id: INITIAL_DRIVERS[1].id, snapshot: toPublicDriver(INITIAL_DRIVERS[1]) };
  const merged = mergeSharedDriverRows([row(1), other], [row(2, 4)])!;
  assert.equal(merged.length, 2);
  assert.equal(merged[0].snapshot.passengers, 4);
  assert.equal(merged[1], other);
});
