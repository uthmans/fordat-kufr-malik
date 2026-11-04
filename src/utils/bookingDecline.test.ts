import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { acceptBooking, BookingState } from './bookingAcceptance';
import { declineBooking } from './bookingDecline';

function fixture(): BookingState {
  return { drivers: [{ ...INITIAL_DRIVERS[0], passengers: 0, isOnDuty: true }], requests: [
    { id: 'req-a', driverId: 'driver-1', passengerName: 'Family', seatCount: 2, timestamp: 100, status: 'pending' }
  ], logs: [] };
}

test('declining a pending request changes only that request and does not mutate input', () => {
  const state = fixture();
  const before = structuredClone(state);
  const requests = declineBooking(state, 'req-a', 'driver-1')!;
  assert.equal(requests[0].status, 'declined');
  assert.deepEqual(state, before);
  assert.equal(state.drivers[0].passengers, 0);
  assert.equal(state.logs.length, 0);
});

test('an accepted booking cannot be overwritten by a late decline', () => {
  const accepted = acceptBooking(fixture(), 'req-a', 'driver-1', 200)!;
  const before = structuredClone(accepted);
  assert.equal(declineBooking(accepted, 'req-a', 'driver-1'), null);
  assert.deepEqual(accepted, before);
  assert.equal(accepted.drivers[0].passengers, 2);
  assert.equal(accepted.logs.length, 1);
  assert.equal(accepted.requests[0].status, 'accepted');
});

test('decline followed by accept cannot confirm a declined request', () => {
  const state = fixture();
  const requests = declineBooking(state, 'req-a', 'driver-1')!;
  assert.equal(acceptBooking({ ...state, requests }, 'req-a', 'driver-1', 200), null);
});

test('repeated declines are no-ops and cannot rewrite a handled request', () => {
  const state = fixture();
  const requests = declineBooking(state, 'req-a', 'driver-1')!;
  assert.equal(declineBooking({ ...state, requests }, 'req-a', 'driver-1'), null);
});

test('signed-out, switched and unknown drivers cannot decline another drivers request', () => {
  const state = fixture();
  state.drivers.push(INITIAL_DRIVERS[1]);
  for (const driverId of [null, 'driver-2', 'missing']) {
    assert.equal(declineBooking(state, 'req-a', driverId), null);
  }
  assert.equal(declineBooking(state, 'missing', 'driver-1'), null);
  assert.equal(declineBooking({ ...state, drivers: [] }, 'req-a', 'driver-1'), null);
});

test('declining from the latest snapshot preserves newly arrived and other-driver requests', () => {
  const state = fixture();
  state.requests.unshift({ ...state.requests[0], id: 'just-arrived' });
  state.requests.push({ ...state.requests[0], id: 'other-driver', driverId: 'driver-2' });
  const requests = declineBooking(state, 'req-a', 'driver-1')!;
  assert.deepEqual(requests.map(r => [r.id, r.status]), [
    ['just-arrived', 'pending'], ['req-a', 'declined'], ['other-driver', 'pending']
  ]);
});

test('off-duty drivers may still decline a pending request without resuming duty', () => {
  const state = fixture();
  state.drivers[0].isOnDuty = false;
  state.drivers[0].autoPausedForInactivity = true;
  assert.equal(declineBooking(state, 'req-a', 'driver-1')![0].status, 'declined');
  assert.equal(state.drivers[0].isOnDuty, false);
  assert.equal(state.drivers[0].autoPausedForInactivity, true);
});

test('a confirmed log prevents decline even if a stale request still says pending', () => {
  const state = fixture();
  const accepted = acceptBooking(state, 'req-a', 'driver-1', 200)!;
  assert.equal(declineBooking({ ...accepted, requests: state.requests }, 'req-a', 'driver-1'), null);
});
