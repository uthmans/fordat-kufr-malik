import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { GPS_FRESH_MS, SEATS_FRESH_MS, isDemoDriver, hasRecentGPS, hasRecentSeatCount, hasConfirmedSeats, isDemoRequest, isDemoLog, isDemoArchive } from './dataFreshness';
import type { Driver, SeatRequest, TripLogEntry, ArchivedTrip } from '../types';
import { acceptBooking } from './bookingAcceptance';

const now = 10_000_000;
const real = (changes: Partial<Driver> = {}): Driver => ({ ...INITIAL_DRIVERS[0], gpsMode: 'live', isOnDuty: true,
  currentLocation: { lat: 31.98, lng: 35.3, timestamp: now - 1000 }, seatCountUpdatedAt: now - 1000, ...changes });

test('all initial roster locations remain demo even when their timestamps look recent', () => {
  for (const driver of INITIAL_DRIVERS) {
    assert.equal(isDemoDriver(driver), true);
    assert.equal(hasRecentGPS(driver, Date.now()), false);
    assert.equal(hasConfirmedSeats(driver, Date.now()), false);
  }
});

test('real recent GPS plus a confirmed seat count can establish availability', () => {
  assert.equal(hasConfirmedSeats(real(), now), true);
});

test('GPS expires independently at two minutes', () => {
  assert.equal(hasRecentGPS(real({ currentLocation: { ...real().currentLocation, timestamp: now - GPS_FRESH_MS + 1 } }), now), true);
  const stale = real({ currentLocation: { ...real().currentLocation, timestamp: now - GPS_FRESH_MS } });
  assert.equal(hasRecentGPS(stale, now), false);
  assert.equal(hasConfirmedSeats(stale, now), false);
});

test('seat counts expire independently at ten minutes', () => {
  assert.equal(hasConfirmedSeats(real({ seatCountUpdatedAt: now - SEATS_FRESH_MS + 1 }), now), true);
  assert.equal(hasConfirmedSeats(real({ seatCountUpdatedAt: now - SEATS_FRESH_MS }), now), false);
});

test('GPS alone never verifies a seeded or old passenger count', () => {
  assert.equal(hasConfirmedSeats(real({ seatCountUpdatedAt: undefined }), now), false);
});

test('future, invalid, and missing timestamps are unconfirmed', () => {
  for (const timestamp of [0, now + 1, NaN, Infinity]) {
    assert.equal(hasConfirmedSeats(real({ seatCountUpdatedAt: timestamp }), now), false);
    assert.equal(hasRecentGPS(real({ currentLocation: { ...real().currentLocation, timestamp } }), now), false);
  }
});

test('off-duty and malformed vehicle counts are excluded', () => {
  for (const changes of [{ isOnDuty: false }, { passengers: -1 }, { passengers: 8 }, { passengers: 1.5 }, { maxCapacity: 0 }]) {
    assert.equal(hasConfirmedSeats(real(changes), now), false);
  }
  assert.equal(hasRecentSeatCount(real({ passengers: 7 }), now), true);
});

test('legacy sample records are identified without classifying actual saved records as samples', () => {
  assert.equal(isDemoRequest({ id: 'req-sample-1' } as SeatRequest), true);
  assert.equal(isDemoRequest({ id: 'req-123456-abc' } as SeatRequest), false);
  assert.equal(isDemoLog({ id: 'log-1' } as TripLogEntry), true);
  assert.equal(isDemoLog({ id: 'booking-req-sample-1' } as TripLogEntry), true);
  assert.equal(isDemoLog({ id: 'log-123456-abc' } as TripLogEntry), false);
  assert.equal(isDemoArchive({ id: 'arch-1' } as ArchivedTrip), true);
  assert.equal(isDemoArchive({ id: 'arch-123456-abc' } as ArchivedTrip), false);
});

test('accepting an example request cannot confirm a real seat count', () => {
  const request: SeatRequest = { id: 'req-sample-1', driverId: 'driver-1', passengerName: 'Example', seatCount: 1, timestamp: now, status: 'pending' };
  const result = acceptBooking({ drivers: [real()], requests: [request], logs: [] }, request.id, 'driver-1', now)!;
  assert.equal(result.logs[0].isDemo, true);
  assert.equal(hasConfirmedSeats(result.drivers[0], now), false);
});

test('an actual accepted booking confirms its updated count', () => {
  const request: SeatRequest = { id: 'req-123', driverId: 'driver-1', passengerName: 'Family', seatCount: 1, timestamp: now, status: 'pending' };
  const result = acceptBooking({ drivers: [real()], requests: [request], logs: [] }, request.id, 'driver-1', now)!;
  assert.equal(result.logs[0].isDemo, false);
  assert.equal(hasConfirmedSeats(result.drivers[0], now), true);
});

test('accepting a booking cannot verify an unknown starting passenger count', () => {
  const request: SeatRequest = { id: 'req-123', driverId: 'driver-1', passengerName: 'Family', seatCount: 1, timestamp: now, status: 'pending' };
  const result = acceptBooking({ drivers: [real({ seatCountUpdatedAt: undefined })], requests: [request], logs: [] }, request.id, 'driver-1', now)!;
  assert.equal(result.requests[0].status, 'accepted');
  assert.equal(hasConfirmedSeats(result.drivers[0], now), false);
});
