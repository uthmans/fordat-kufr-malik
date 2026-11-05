import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

async function withGPS(run: (s: {
  api: ReturnType<typeof useTransit>;
  callbacks: { success: PositionCallback; error: PositionErrorCallback | null | undefined }[];
  cleared: number[];
  data: Map<string, string>;
}) => Promise<void>, online = true) {
  const keys = ['navigator', 'localStorage'] as const;
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const data = new Map([
    ['kufr_malik_auth_driver_id_v6', 'driver-1'],
    ['kufr_malik_transit_drivers_v8', JSON.stringify([{ ...INITIAL_DRIVERS[0], gpsMode: 'simulation' }])]
  ]);
  const callbacks: { success: PositionCallback; error: PositionErrorCallback | null | undefined }[] = [];
  const cleared: number[] = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: online, geolocation: {
    watchPosition(success: PositionCallback, error?: PositionErrorCallback | null) { callbacks.push({ success, error }); return callbacks.length - 1; },
    clearWatch(id: number) { cleared.push(id); }
  } } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key)
  } });
  let api!: ReturnType<typeof useTransit>;
  function Capture() { api = useTransit(); return null; }
  renderToStaticMarkup(<TransitProvider><Capture /></TransitProvider>);
  try { await run({ api, callbacks, cleared, data }); }
  finally {
    api.stopDriverSharing();
    keys.forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : Reflect.deleteProperty(globalThis, key));
  }
}

function fix(timestamp = Date.now(), latitude = 31.98) {
  return { timestamp, coords: { latitude, longitude: 35.3, accuracy: 10 } } as GeolocationPosition;
}

test('one tap starts phone GPS and disables demo without publishing a simulated location', () => withGPS(async s => {
  const pending = s.api.startDriverSharing();
  assert.equal(s.callbacks.length, 1);
  assert.equal(s.data.get('kufr_malik_show_demo_v1'), 'false');
  let settled = false;
  void pending.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  s.api.stopDriverSharing();
  assert.equal(await pending, false);
  assert.deepEqual(s.cleared, [0]);
}));

test('duplicate taps start only one GPS watch', () => withGPS(async s => {
  const pending = s.api.startDriverSharing();
  assert.equal(await s.api.startDriverSharing(), false);
  assert.equal(s.callbacks.length, 1);
  s.api.stopDriverSharing();
  assert.equal(await pending, false);
}));

test('old, future and invalid fixes cannot start sharing; a real fix updates only the signed-in driver', () => withGPS(async s => {
  const pending = s.api.startDriverSharing();
  const saved = () => JSON.parse(s.data.get('kufr_malik_transit_drivers_v8')!)[0];
  s.callbacks[0].success(fix(Date.now() - 130000));
  s.callbacks[0].success(fix(Date.now() + 60000));
  s.callbacks[0].success(fix(Date.now(), NaN));
  assert.equal(saved().gpsMode, 'simulation');
  s.callbacks[0].success(fix());
  // SSR has no restored server session: it must fail closed after GPS succeeds.
  assert.equal(await pending, false);
  assert.equal(saved().gpsMode, 'live');
  assert.equal(saved().id, 'driver-1');
}));

test('permission denial and signal timeout end startup and allow a fresh attempt', () => withGPS(async s => {
  for (const code of [1, 3]) {
    const pending = s.api.startDriverSharing();
    s.callbacks.at(-1)!.error!({ code, message: 'raw platform error' } as GeolocationPositionError);
    assert.equal(await pending, false);
  }
  assert.equal(s.callbacks.length, 2);
  assert.deepEqual(s.cleared, [0, 1]);
}));

test('cancel and driver logout reject delayed GPS callbacks', () => withGPS(async s => {
  for (const stop of [s.api.stopDriverSharing, s.api.logoutDriver]) {
    const before = s.data.get('kufr_malik_transit_drivers_v8');
    const pending = s.api.startDriverSharing();
    stop();
    s.callbacks.at(-1)!.success(fix());
    assert.equal(await pending, false);
    assert.equal(s.data.get('kufr_malik_transit_drivers_v8'), before);
  }
}));

test('offline start never requests phone location', () => withGPS(async s => {
  assert.equal(await s.api.startDriverSharing(), false);
  assert.equal(s.callbacks.length, 0);
}, false));
