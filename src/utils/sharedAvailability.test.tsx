import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { toPublicDriver, type SharedDriverRow } from './sharedDriver';
import { GPS_FRESH_MS } from './dataFreshness';
import { hasRecentSharedReport, isSharedDriverActive, publicationState, type PublicationState } from './sharedAvailability';
import { PublicationStatus } from '../components/PublicationStatus';

const now = 1_800_000_000_000;
const driver = { ...INITIAL_DRIVERS[0], isOnDuty: true, gpsMode: 'live' as const,
  currentLocation: { lat: 31.98, lng: 35.3, timestamp: now - 1000 }, seatCountUpdatedAt: now - 2000 };
const row: SharedDriverRow = { driver_id: driver.id, revision: 1, received_at: new Date(now - 500).toISOString(), snapshot: toPublicDriver(driver) };
const input = { driver, row, now, sharing: true, online: true, gpsError: false, lastPublished: row.received_at };

test('public availability needs both a recent server report and real recent GPS', () => {
  assert.equal(isSharedDriverActive(row, now), true);
  assert.equal(isSharedDriverActive(undefined, now), false);
  for (const received_at of ['invalid', new Date(now + 1).toISOString(), new Date(now - GPS_FRESH_MS).toISOString()]) {
    assert.equal(hasRecentSharedReport({ ...row, received_at }, now), false);
    assert.equal(isSharedDriverActive({ ...row, received_at }, now), false);
  }
  for (const snapshot of [{ ...row.snapshot, isOnDuty: false }, { ...row.snapshot, gpsMode: 'simulation' as const },
    { ...row.snapshot, currentLocation: { ...driver.currentLocation, timestamp: now - GPS_FRESH_MS } }]) {
    assert.equal(isSharedDriverActive({ ...row, snapshot }, now), false);
  }
});

test('sharing being enabled is not confirmation that a new update was published', () => {
  assert.equal(publicationState({ ...input, lastPublished: null }), 'waiting');
  assert.equal(publicationState({ ...input, row: undefined }), 'waiting');
  assert.equal(publicationState({ ...input, row: { ...row, driver_id: 'driver-2' } }), 'waiting');
  assert.equal(publicationState({ ...input, lastPublished: new Date(now - 1500).toISOString() }), 'waiting');
  assert.equal(publicationState(input), 'live');
});

test('unsent changes are pending while normal GPS-only throttling remains published', () => {
  for (const change of [{ passengers: 1 }, { isOnDuty: false }, { prayerShift: 'after_isha' as const },
    { departureCountdown: 'in_5_mins' as const, departureCountdownSetAt: now }, { seatCountUpdatedAt: now }]) {
    assert.equal(publicationState({ ...input, driver: { ...driver, ...change } }), 'pending');
  }
  assert.equal(publicationState({ ...input, driver: { ...driver, currentLocation: { ...driver.currentLocation, timestamp: now } } }), 'live');
});

test('offline, GPS failure, stale and stopped publishers cannot display live success', () => {
  assert.equal(publicationState({ ...input, sharing: false }), 'stopped');
  assert.equal(publicationState({ ...input, online: false }), 'offline');
  assert.equal(publicationState({ ...input, gpsError: true }), 'gps_error');
  assert.equal(publicationState({ ...input, now: now + GPS_FRESH_MS }), 'stale');
  assert.equal(publicationState({ ...input, driver: { ...driver, currentLocation: { ...driver.currentLocation, timestamp: now - GPS_FRESH_MS } } }), 'stale');
});

test('confirmed off-duty publishing never claims live location sharing', () => {
  const offDuty = { ...driver, isOnDuty: false, gpsMode: 'idle' as const, currentLocation: { lat: 0, lng: 0, timestamp: 0 } };
  assert.equal(publicationState({ ...input, driver: offDuty, row: { ...row, snapshot: toPublicDriver(offDuty) } }), 'off_duty');
});

test('every publication state has an Arabic and English status message', () => {
  for (const state of ['stopped', 'offline', 'gps_error', 'waiting', 'stale', 'pending', 'live', 'off_duty'] as PublicationState[]) {
    for (const isAr of [true, false]) {
      const html = renderToStaticMarkup(<PublicationStatus state={state} isAr={isAr} />);
      assert.ok(html.includes('role="status"'));
      assert.ok(isAr ? /[\u0600-\u06ff]/.test(html) : /[A-Za-z]{5}/.test(html));
    }
  }
});
