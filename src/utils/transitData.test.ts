import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { isDriver, isSeatRequest, isTripLog, isArchivedTrip, isGPSLocation, readStoredCollection, restoreDrivers, readSyncMessage } from './transitData';

const request = { id: 'req-real', driverId: 'driver-1', passengerName: 'أحمد', seatCount: 2, timestamp: 1234, status: 'pending' };
const log = { id: 'log-real', driverId: 'driver-1', passengerName: 'أحمد', seatCount: 2, confirmedAt: 1234, status: 'confirmed' };
const archive = { id: 'arch-real', driverId: 'driver-1', timestamp: 1234, formattedDate: 'Nov 4', passengersCount: 2, locationStatus: 'in_kufr_malik', entries: [log] };
const storage = (value: unknown) => ({ getItem: () => JSON.stringify(value) });

test('seeded drivers and valid booking, log, and archive snapshots are compatible', () => {
  assert.ok(INITIAL_DRIVERS.every(isDriver));
  for (const [type, payload] of [
    ['UPDATE_DRIVERS', INITIAL_DRIVERS], ['UPDATE_REQUESTS', [request]],
    ['UPDATE_TRIP_LOGS', [log]], ['UPDATE_TRIP_HISTORY', [archive]]
  ] as const) {
    assert.deepEqual(readSyncMessage({ type, payload }), { type, payload });
  }
});

test('valid JSON with the wrong shape cannot become application collections', () => {
  for (const value of [null, {}, 42, 'text', true, [null], [{ id: 1 }]]) {
    assert.deepEqual(readStoredCollection('key', isSeatRequest, storage(value)), []);
  }
});

test('broken JSON and blocked storage recover without throwing', () => {
  for (const store of [{ getItem: () => '{broken' }, { getItem: () => { throw Error('Blocked'); } }]) {
    assert.deepEqual(readStoredCollection('key', isSeatRequest, store), []);
    assert.deepEqual(restoreDrivers(store), []);
  }
});

test('storage recovery retains valid neighbours and removes duplicate IDs without rewriting storage', () => {
  const raw = JSON.stringify([null, request, { ...request, id: 'bad', passengerName: {} }, request, { ...request, id: 'other', seatCount: 3 }]);
  const store = { getItem: () => raw, setItem: () => { throw Error('Must not rewrite'); } };
  assert.deepEqual(readStoredCollection('key', isSeatRequest, store).map(r => r.id), ['req-real', 'other']);
  assert.equal(store.getItem(), raw);
});

test('partial valid rosters keep custom identity, PIN and capacity instead of resetting everyone', () => {
  const custom = { ...INITIAL_DRIVERS[0], nameAr: 'اسم محفوظ', pinCode: '005826', maxCapacity: 9 };
  const recovered = restoreDrivers(storage([custom, null, { ...INITIAL_DRIVERS[1], currentLocation: null }]));
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].nameAr, custom.nameAr);
  assert.equal(recovered[0].pinCode, custom.pinCode);
  assert.equal(recovered[0].maxCapacity, 9);
});

test('legacy roster fallback and optional shift migration remain supported', () => {
  const old = { ...INITIAL_DRIVERS[0], prayerShift: undefined, lastActiveTime: undefined, autoPausedForInactivity: undefined };
  const store = { getItem: (key: string) => key.endsWith('v7') ? JSON.stringify([old]) : 'null' };
  const [driver] = restoreDrivers(store);
  assert.equal(driver.prayerShift, 'after_maghrib');
  assert.equal(driver.lastActiveTime, Date.parse(old.lastUpdated));
  assert.equal(driver.autoPausedForInactivity, false);
});

test('driver validation rejects unsafe fields and invalid shift or location states', () => {
  for (const patch of [
    { nameAr: {} }, { passengers: -1 }, { passengers: 8 }, { maxCapacity: 0 },
    { currentLocation: null }, { prayerShift: 'unknown' }, { departureCountdown: {} },
    { lastUpdated: 'invalid' }, { lastTripLabelAr: {} }, { status: 'unknown' }, { seatCountUpdatedAt: Infinity }
  ]) assert.equal(isDriver({ ...INITIAL_DRIVERS[0], ...patch }), false);
});

test('GPS values must be finite and geographically valid', () => {
  const location = INITIAL_DRIVERS[0].currentLocation;
  assert.equal(isGPSLocation({ ...location, heading: null, speed: null }), true);
  for (const patch of [{ lat: NaN }, { lat: 91 }, { lng: -181 }, { accuracy: -1 }, { timestamp: NaN }, { speed: {} }]) {
    assert.equal(isGPSLocation({ ...location, ...patch }), false);
  }
});

test('booking and nested archive records reject invalid counts, statuses and renderable fields', () => {
  for (const patch of [{ seatCount: 0 }, { seatCount: 1.5 }, { passengerName: {} }, { id: 4 }, { status: 'unknown' }, { phone: {} }]) {
    assert.equal(isSeatRequest({ ...request, ...patch }), false);
  }
  assert.equal(isTripLog(log), true);
  for (const entries of [null, {}, [null], [{ ...log, seatCount: -2 }], [log, log]]) {
    assert.equal(isArchivedTrip({ ...archive, entries }), false);
  }
});

test('live sync rejects malformed or duplicate snapshots atomically, including an empty roster', () => {
  for (const message of [null, 5, {}, { type: 'unknown' },
    { type: 'UPDATE_DRIVERS', payload: [] },
    { type: 'UPDATE_DRIVERS', payload: [INITIAL_DRIVERS[0], null] },
    { type: 'UPDATE_REQUESTS', payload: [request, null] },
    { type: 'UPDATE_REQUESTS', payload: [request, request] },
    { type: 'UPDATE_TRIP_LOGS', payload: {} },
    { type: 'UPDATE_TRIP_HISTORY', payload: [{ ...archive, entries: [null] }] }
  ]) assert.equal(readSyncMessage(message), null);
});

test('empty booking, log and archive snapshots still propagate deliberate clears', () => {
  for (const type of ['UPDATE_REQUESTS', 'UPDATE_TRIP_LOGS', 'UPDATE_TRIP_HISTORY']) {
    assert.deepEqual(readSyncMessage({ type, payload: [] }), { type, payload: [] });
  }
});

test('simulation sync rejects NaN, infinite and out-of-range progress without changing state', () => {
  for (const progress of [NaN, Infinity, -1, 101, '30']) {
    assert.equal(readSyncMessage({ type: 'GPS_SIM_PROGRESS', payload: { progress, isDetour: false } }), null);
  }
  for (const progress of [0, 30, 100]) {
    const message = { type: 'GPS_SIM_PROGRESS', payload: { progress, isDetour: true } };
    assert.deepEqual(readSyncMessage(message), message);
  }
});
