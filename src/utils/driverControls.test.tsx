import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import type { Driver } from '../types';

type Api = ReturnType<typeof useTransit>;
function withControls(run: (api: Api, drivers: () => Driver[], data: Map<string, string>) => void, paused = false) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>([
    ['kufr_malik_transit_drivers_v8', JSON.stringify([{ ...INITIAL_DRIVERS[0], passengers: 0, isOnDuty: !paused,
      autoPausedForInactivity: paused }, INITIAL_DRIVERS[1]])],
    ['kufr_malik_auth_driver_id_v6', 'driver-1'],
    ['kufr_malik_transit_requests_v6', JSON.stringify([{ id: 'req-controls', driverId: 'driver-1', passengerName: 'Family', seatCount: 2, timestamp: Date.now(), status: 'pending' }])]
  ]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); }
  } });
  let api: Api | undefined;
  function Capture() { api = useTransit(); return null; }
  try {
    renderToStaticMarkup(<TransitProvider><Capture /></TransitProvider>);
    assert.ok(api);
    // Retain the same handlers throughout; React never refreshes their closures.
    run(api, () => JSON.parse(data.get('kufr_malik_transit_drivers_v8')!), data);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

const actions: [string, (api: Api) => void][] = [
  ['duty toggle', api => api.toggleDriverDuty('driver-1')],
  ['prayer shift', api => api.setDriverPrayerShift('driver-1', 'after_isha')],
  ['departure notice', api => api.setDepartureCountdown('driver-1', 'in_5_mins')],
  ['explicit duty resume', api => api.resumeDutyFromInactivity('driver-1')],
  ['late-shift toggle', api => api.toggleDriverLateShift('driver-1')],
  ['driver note', api => api.updateDriverNote('driver-1', 'Updated note', 'ملاحظة محدثة')]
];
for (const [name, action] of actions) {
  test(`${name} retains a just-accepted booking and newer profiles before rerender`, () => withControls((api, drivers, data) => {
    assert.equal(api.acceptSeatRequest('req-controls'), true);
    assert.equal(api.updateDriverProfile('driver-1', { nameEn: 'Updated driver' }), true);
    assert.equal(api.adminUpdateDriver('driver-2', { nameEn: 'Updated other driver' }), true);
    const location = drivers()[0].currentLocation;
    action(api);
    assert.equal(drivers()[0].passengers, 2);
    assert.equal(drivers()[0].nameEn, 'Updated driver');
    assert.equal(drivers()[1].nameEn, 'Updated other driver');
    assert.deepEqual(drivers()[0].currentLocation, location);
    assert.equal(JSON.parse(data.get('kufr_malik_transit_requests_v6')!)[0].status, 'accepted');
    assert.equal(JSON.parse(data.get('kufr_malik_transit_triplogs_v6')!).length, 1);
  }));
}

test('two rapid duty toggles return to the original state without losing count changes', () => withControls((api, drivers) => {
  api.incrementPassengers('driver-1');
  api.toggleDriverDuty('driver-1');
  assert.equal(drivers()[0].isOnDuty, false);
  api.toggleDriverDuty('driver-1');
  assert.equal(drivers()[0].isOnDuty, true);
  assert.equal(drivers()[0].passengers, 1);
}));

test('sequential shift, notice and note actions preserve each others changes', () => withControls((api, drivers) => {
  api.setDriverPrayerShift('driver-1', 'after_isha');
  api.setDepartureCountdown('driver-1', 'in_10_mins');
  api.updateDriverNote('driver-1', 'Updated note', 'ملاحظة');
  assert.equal(drivers()[0].prayerShift, 'after_isha');
  assert.equal(drivers()[0].departureCountdown, 'in_10_mins');
  assert.equal(drivers()[0].departureNoteEn, 'Updated note');
  api.toggleDriverDuty('driver-1');
  assert.equal(drivers()[0].departureCountdown, null);
  assert.equal(drivers()[0].departureCountdownSetAt, undefined);
  assert.equal(drivers()[0].departureNoteEn, 'Updated note');
}));

test('notes and shift edits retain an inactivity pause until explicit resume', () => withControls((api, drivers) => {
  api.updateDriverNote('driver-1', 'Back later', 'سأعود لاحقاً');
  api.setDriverPrayerShift('driver-1', 'after_isha');
  assert.equal(drivers()[0].isOnDuty, false);
  assert.equal(drivers()[0].autoPausedForInactivity, true);
  api.setDepartureCountdown('driver-1', 'in_5_mins');
  assert.equal(drivers()[0].departureCountdown ?? null, null);
  api.resumeDutyFromInactivity('driver-1');
  assert.equal(drivers()[0].isOnDuty, true);
  assert.equal(drivers()[0].autoPausedForInactivity, false);
  assert.equal(drivers()[0].prayerShift, 'after_isha');
  assert.equal(drivers()[0].departureNoteEn, 'Back later');
}, true));

test('GPS callback and subsequent controls preserve each others updates before rerender', () => withControls((api, drivers) => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let positionCallback: PositionCallback | undefined;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(callback: PositionCallback) { positionCallback = callback; return 1; },
    clearWatch() {}
  } } });
  try {
    assert.equal(api.acceptSeatRequest('req-controls'), true);
    api.startRealGPSTracking();
    assert.ok(positionCallback);
    positionCallback({ coords: { latitude: 31.94, longitude: 35.22, accuracy: 5 }, timestamp: Date.now() } as GeolocationPosition);
    api.setDriverPrayerShift('driver-1', 'after_isha');
    api.updateDriverNote('driver-1', 'Updated note', 'ملاحظة');
    assert.equal(drivers()[0].currentLocation.lat, 31.94);
    assert.equal(drivers()[0].gpsMode, 'live');
    assert.equal(drivers()[0].passengers, 2);
    assert.equal(drivers()[0].prayerShift, 'after_isha');
    positionCallback({ coords: { latitude: 31.95, longitude: 35.23, accuracy: 5 }, timestamp: Date.now() + 1 } as GeolocationPosition);
    assert.equal(drivers()[0].departureNoteEn, 'Updated note');
    assert.equal(drivers()[0].prayerShift, 'after_isha');
    assert.equal(drivers()[0].currentLocation.lat, 31.95);
    api.stopRealGPSTracking();
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
}));
