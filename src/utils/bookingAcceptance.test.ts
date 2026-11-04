import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { acceptBooking, bookingAcceptanceError, BookingState } from './bookingAcceptance';

function fixture(passengers = 5, seats = 3, capacity = 7): BookingState {
  return { drivers: [{ ...INITIAL_DRIVERS[0], passengers, maxCapacity: capacity }],
    requests: [{ id: 'request-1', driverId: 'driver-1', passengerName: 'Family', seatCount: seats, timestamp: 1, status: 'pending' }], logs: [] };
}

test('insufficient seats never confirms, logs, or changes occupancy', () => {
  const state = fixture();
  const original = structuredClone(state);
  assert.equal(acceptBooking(state, 'request-1', 'driver-1', 100), null);
  assert.deepEqual(state, original);
  assert.equal(bookingAcceptanceError(state.requests[0], state.drivers[0]), 'insufficient_seats');
});

test('an exact fit updates occupancy, request, and one trip entry together', () => {
  const state = fixture(5, 2);
  const next = acceptBooking(state, 'request-1', 'driver-1', 100)!;
  assert.equal(next.drivers[0].passengers, 7);
  assert.equal(next.requests[0].status, 'accepted');
  assert.equal(next.logs.length, 1);
  assert.equal(next.logs[0].passengerName, 'Family');
  assert.equal(next.logs[0].seatCount, 2);
  assert.equal(state.requests[0].status, 'pending');
  assert.equal(state.drivers[0].passengers, 5);
});

test('replaying an acceptance cannot add seats or duplicate its trip entry', () => {
  const next = acceptBooking(fixture(0, 2), 'request-1', 'driver-1', 100)!;
  assert.equal(acceptBooking(next, 'request-1', 'driver-1', 101), null);
  assert.equal(next.drivers[0].passengers, 2);
  assert.equal(next.logs.length, 1);
  const stale = { ...next, requests: fixture(0, 2).requests };
  assert.equal(acceptBooking(stale, 'request-1', 'driver-1', 102), null);
});

test('two different requests compete for the remaining seats', () => {
  const state = fixture(4, 2);
  state.requests.push({ ...state.requests[0], id: 'request-2' });
  const next = acceptBooking(state, 'request-1', 'driver-1', 100)!;
  assert.equal(acceptBooking(next, 'request-2', 'driver-1', 101), null);
  assert.equal(next.requests[1].status, 'pending');
  assert.equal(next.drivers[0].passengers, 6);
});

test('declined, missing, and other-driver requests cannot be accepted', () => {
  const state = fixture(0, 1);
  assert.equal(acceptBooking(state, 'missing', 'driver-1', 100), null);
  assert.equal(acceptBooking(state, 'request-1', null, 100), null);
  assert.equal(acceptBooking(state, 'request-1', 'driver-2', 100), null);
  state.requests[0].status = 'declined';
  assert.equal(acceptBooking(state, 'request-1', 'driver-1', 100), null);
});

test('invalid requested seat counts cannot change state', () => {
  for (const seats of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal(acceptBooking(fixture(0, seats), 'request-1', 'driver-1', 100), null);
  }
});

test('uses the actual vehicle capacity, including capacities other than seven', () => {
  assert.equal(acceptBooking(fixture(3, 2, 4), 'request-1', 'driver-1', 100), null);
  assert.equal(acceptBooking(fixture(3, 1, 4), 'request-1', 'driver-1', 100)!.drivers[0].passengers, 4);
  assert.equal(acceptBooking(fixture(7, 1, 8), 'request-1', 'driver-1', 100)!.drivers[0].passengers, 8);
});

test('full and malformed vehicles cannot accept bookings', () => {
  for (const [passengers, capacity] of [[7, 7], [8, 7], [-1, 7], [1.5, 7], [0, 0], [0, NaN]]) {
    assert.equal(acceptBooking(fixture(passengers, 1, capacity), 'request-1', 'driver-1', 100), null);
  }
});

test('off-duty drivers cannot change booking, count or logs even when seats are available', () => {
  const state = fixture(0, 2);
  state.drivers[0].isOnDuty = false;
  const original = structuredClone(state);
  assert.equal(bookingAcceptanceError(state.requests[0], state.drivers[0]), 'off_duty');
  assert.equal(acceptBooking(state, 'request-1', 'driver-1', 100), null);
  assert.deepEqual(state, original);
});

test('an inactivity pause blocks a stale accept action without resuming duty', () => {
  const state = fixture(0, 2);
  state.drivers[0].autoPausedForInactivity = true;
  const original = structuredClone(state);
  assert.equal(acceptBooking(state, 'request-1', 'driver-1', 100), null);
  assert.deepEqual(state, original);
});

test('resuming duty allows the same pending request with normal capacity checks', () => {
  const state = fixture(0, 2);
  state.drivers[0].isOnDuty = false;
  assert.equal(acceptBooking(state, 'request-1', 'driver-1', 100), null);
  state.drivers[0].isOnDuty = true;
  state.drivers[0].autoPausedForInactivity = false;
  const next = acceptBooking(state, 'request-1', 'driver-1', 101)!;
  assert.equal(next.drivers[0].passengers, 2);
  assert.equal(next.requests[0].status, 'accepted');
  assert.equal(next.logs.length, 1);
  assert.equal(acceptBooking(next, 'request-1', 'driver-1', 102), null);
});
