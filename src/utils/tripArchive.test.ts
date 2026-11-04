import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import type { TripLogEntry } from '../types';
import { archiveTrip, TripArchiveState } from './tripArchive';

const now = 1_800_000_000_000;
function entry(id: string, seatCount: number, driverId = 'driver-1'): TripLogEntry {
  return { id, driverId, passengerName: 'Family', seatCount, confirmedAt: now - 1000, status: 'confirmed' };
}
function fixture(passengers = 9, logs: TripLogEntry[] = [entry('real-a', 5), entry('real-b', 4)]): TripArchiveState {
  return { drivers: [{ ...INITIAL_DRIVERS[0], passengers, maxCapacity: 9,
    departureCountdown: 'in_5_mins', departureCountdownSetAt: now - 1000 }, INITIAL_DRIVERS[1]], logs, history: [] };
}
const archive = (state: TripArchiveState, id = 'archive-a', includeDemo = false) => archiveTrip(state, 'driver-1', now, id, 'Nov 4', includeDemo);

test('archives all nine recorded seats instead of silently truncating to seven', () => {
  const state = fixture();
  const next = archive(state)!;
  assert.equal(next.history[0].passengersCount, 9);
  assert.deepEqual(next.history[0].entries, state.logs);
});

test('station trips without named bookings retain the actual passenger count', () => {
  const state = fixture(9, []);
  state.drivers[0].status = 'in_ramallah';
  const trip = archive(state)!.history[0];
  assert.equal(trip.passengersCount, 9);
  assert.equal(trip.locationStatus, 'in_ramallah');
  assert.deepEqual(trip.entries, []);
});

test('recorded trip totals are retained even when passenger turnover exceeds capacity', () => {
  const trip = archive(fixture(2, [entry('a', 7), entry('b', 5)]))!.history[0];
  assert.equal(trip.passengersCount, 12);
  assert.equal(trip.entries.reduce((sum, e) => sum + e.seatCount, 0), 12);
});

test('a second tap cannot archive the reset trip again, even with a new ID', () => {
  const next = archive(fixture())!;
  assert.equal(archive(next, 'archive-b'), null);
  assert.equal(next.history.length, 1);
  assert.equal(archive(fixture(0, [])), null);
});

test('reset clears only this drivers logs, passenger count and previous departure notice', () => {
  const otherLog = entry('other', 2, 'driver-2');
  const state = fixture(9, [...fixture().logs, otherLog]);
  const original = structuredClone(state);
  const next = archive(state)!;
  assert.deepEqual(state, original);
  assert.deepEqual(next.logs, [otherLog]);
  assert.deepEqual(next.drivers[1], state.drivers[1]);
  const driver = next.drivers[0];
  assert.equal(driver.passengers, 0);
  assert.equal(driver.departureCountdown, null);
  assert.equal(driver.departureCountdownSetAt, undefined);
  assert.equal(driver.seatCountUpdatedAt, now);
  assert.equal(driver.lastActiveTime, now);
  assert.equal(driver.lastUpdated, new Date(now).toISOString());
  for (const key of ['currentLocation', 'gpsMode', 'isOnDuty', 'pinCode', 'maxCapacity'] as const) {
    assert.deepEqual(driver[key], state.drivers[0][key]);
  }
});

test('existing history is preserved and a later populated trip can be archived normally', () => {
  const first = archive(fixture())!;
  const second = archive({ ...first, logs: [entry('later', 3)], drivers: first.drivers.map(d => d.id === 'driver-1' ? { ...d, passengers: 3 } : d) }, 'archive-b')!;
  assert.deepEqual(second.history.map(t => t.id), ['archive-b', 'archive-a']);
  assert.equal(second.history[0].passengersCount, 3);
});

test('current booking snapshot includes an acceptance made immediately before archiving', () => {
  const state = fixture(0, []);
  state.logs.push(entry('just-accepted', 3));
  state.drivers[0].passengers = 3;
  assert.equal(archive(state)!.history[0].entries[0].id, 'just-accepted');
});

test('demo inclusion follows preview setting without modifying real booking entries', () => {
  const state = fixture(4, [entry('req-real', 2), { ...entry('demo', 2), isDemo: true }]);
  assert.equal(archive(state)!.history[0].passengersCount, 2);
  assert.equal(archive(state)!.history[0].isDemo, false);
  assert.equal(archive(state, 'demo-trip', true)!.history[0].passengersCount, 4);
  assert.equal(archive(state, 'demo-trip', true)!.history[0].isDemo, true);
});

test('unknown driver, invalid counts or duplicate archive ID leave state unchanged', () => {
  const state = fixture();
  assert.equal(archiveTrip(state, 'missing', now, 'a', 'date', false), null);
  assert.equal(archiveTrip(state, 'driver-1', NaN, 'a', 'date', false), null);
  assert.equal(archive(fixture(-1)), null);
  assert.equal(archive(fixture(0, [entry('bad', -1)])), null);
  const existing = archive(state)!.history;
  assert.equal(archive({ ...state, history: existing }), null);
});
