import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import type { Driver, GPSLocation } from '../types';
import { DUTY_INACTIVITY_MS, pauseInactiveDrivers, recordDutyMovement } from './dutyActivity';

const start = 10_000_000;
const fix = (timestamp: number, lat = 31.984, accuracy = 5): GPSLocation => ({ lat, lng: 35.3115, accuracy, timestamp });
const driver = (overrides: Partial<Driver> = {}): Driver => ({ ...INITIAL_DRIVERS[0], gpsMode: 'live',
  status: 'in_kufr_malik', isOnDuty: true, autoPausedForInactivity: false,
  lastActiveTime: start, lastUpdated: new Date(start).toISOString(), dutyMovementAnchor: fix(start), ...overrides });

test('real movement within the village refreshes activity even across the route', () => {
  const d = driver();
  const position = fix(start + 60000, 31.985);
  const updated = { ...d, ...recordDutyMovement(d, position, 'live', position.timestamp) };
  assert.equal(updated.lastActiveTime, position.timestamp);
  assert.equal(updated.dutyMovementAnchor, position);
  assert.equal(updated.isOnDuty, true);
});

test('small movements accumulate against the previous movement anchor', () => {
  let d = driver();
  for (const [seconds, lat] of [[10, 31.9841], [20, 31.9842], [30, 31.9843]]) {
    d = { ...d, ...recordDutyMovement(d, fix(start + seconds * 1000, lat), 'live', start + seconds * 1000) };
    assert.equal(d.lastActiveTime, start);
  }
  d = { ...d, ...recordDutyMovement(d, fix(start + 40000, 31.9846), 'live', start + 40000) };
  assert.equal(d.lastActiveTime, start + 40000);
});

test('stationary GPS jitter cannot keep a driver active indefinitely', () => {
  let d = driver();
  for (let elapsed = 30000; elapsed <= DUTY_INACTIVITY_MS; elapsed += 30000) {
    d = { ...d, ...recordDutyMovement(d, fix(start + elapsed, 31.98401), 'live', start + elapsed) };
  }
  assert.equal(d.lastActiveTime, start);
  assert.equal(pauseInactiveDrivers([d], start + DUTY_INACTIVITY_MS)[0].isOnDuty, false);
});

test('a recently moving driver is not paused at the old deadline', () => {
  const now = start + DUTY_INACTIVITY_MS;
  const d = driver({ dutyMovementAnchor: fix(now - 30000) });
  const active = { ...d, ...recordDutyMovement(d, fix(now, 31.985), 'live', now) };
  assert.equal(pauseInactiveDrivers([active], now)[0].isOnDuty, true);
});

test('inactivity pauses at exactly 45 minutes and marks the resume prompt', () => {
  const d = driver();
  const original = [d];
  assert.equal(pauseInactiveDrivers(original, start + DUTY_INACTIVITY_MS - 1), original);
  const paused = pauseInactiveDrivers(original, start + DUTY_INACTIVITY_MS);
  assert.equal(paused[0].isOnDuty, false);
  assert.equal(paused[0].autoPausedForInactivity, true);
  assert.equal(d.isOnDuty, true);
});

test('reopening after an overdue timeout pauses immediately', () => {
  const result = pauseInactiveDrivers([driver()], start + 2 * DUTY_INACTIVITY_MS);
  assert.equal(result[0].autoPausedForInactivity, true);
});

test('movement never automatically resumes manually or automatically paused drivers', () => {
  for (const autoPausedForInactivity of [false, true]) {
    const d = driver({ isOnDuty: false, autoPausedForInactivity });
    assert.deepEqual(recordDutyMovement(d, fix(start + 10000, 31.99), 'live', start + 10000), {});
  }
});

test('only active drivers in Kufr Malik are subject to this timeout', () => {
  const drivers = [driver({ status: 'in_ramallah' }), driver({ status: 'to_ramallah' }), driver({ isOnDuty: false })];
  assert.equal(pauseInactiveDrivers(drivers, start + 2 * DUTY_INACTIVITY_MS), drivers);
});

test('unreliable, stale, future, or repeated fixes cannot extend duty', () => {
  const now = start + 10000;
  for (const position of [fix(now, 31.99, 200), fix(now - 120001, 31.99), fix(now + 1, 31.99), fix(start, 31.99), { ...fix(now), lat: NaN }]) {
    assert.deepEqual(recordDutyMovement(driver(), position, 'live', now), {});
  }
});

test('a stale or different-mode anchor establishes a baseline without claiming movement', () => {
  const position = fix(start + 130000, 31.99);
  assert.deepEqual(recordDutyMovement(driver(), position, 'live', position.timestamp), { dutyMovementAnchor: position });
  const recent = fix(start + 10000, 31.99);
  assert.deepEqual(recordDutyMovement(driver(), recent, 'simulation', recent.timestamp), { dutyMovementAnchor: recent });
});

test('legacy missing activity uses the stored update time without granting a fresh shift', () => {
  const d = driver({ lastActiveTime: undefined });
  assert.equal(pauseInactiveDrivers([d], start + DUTY_INACTIVITY_MS)[0].isOnDuty, false);
  assert.equal(pauseInactiveDrivers([driver({ lastActiveTime: NaN, lastUpdated: 'invalid' })], start)[0].isOnDuty, false);
});
