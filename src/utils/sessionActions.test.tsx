import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

type Api = ReturnType<typeof useTransit>;
function withSession(run: (api: Api, data: Map<string, string>) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>([
    ['kufr_malik_transit_drivers_v8', JSON.stringify(INITIAL_DRIVERS.slice(0, 2).map(d => ({ ...d, passengers: 0, isOnDuty: true })))],
    ['kufr_malik_auth_driver_id_v6', 'driver-1'],
    ['kufr_malik_transit_requests_v6', JSON.stringify([1, 2].map(n => ({ id: `req-${n}`, driverId: `driver-${n}`, passengerName: 'Family', seatCount: 2, timestamp: Date.now(), status: 'pending' })))]
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
    run(api, data);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('original login handler rejects a PIN changed since render and accepts only the current PIN', () => withSession((api, data) => {
  assert.equal(api.updateDriverProfile('driver-1', { pinCode: '005826' }), true);
  api.logoutDriver();
  const before = data.get('kufr_malik_transit_drivers_v8');
  assert.equal(api.loginDriver('driver-1', '1234'), false);
  assert.equal(data.get('kufr_malik_transit_drivers_v8'), before);
  assert.equal(data.has('kufr_malik_auth_driver_id_v6'), false);
  assert.equal(api.loginDriver('driver-1', '005826'), true);
  assert.equal(data.get('kufr_malik_auth_driver_id_v6'), 'driver-1');
}));

test('an accept handler captured before logout cannot confirm a request after logout', () => withSession((api, data) => {
  const before = new Map(data);
  api.logoutDriver();
  assert.equal(api.acceptSeatRequest('req-1'), false);
  for (const key of ['kufr_malik_transit_drivers_v8', 'kufr_malik_transit_requests_v6', 'kufr_malik_transit_triplogs_v6']) {
    assert.equal(data.get(key), before.get(key));
  }
}));

test('switching drivers makes an old accept handler use the new session and reject the previous driver request', () => withSession((api, data) => {
  assert.equal(api.loginDriver('driver-2', '1234'), true);
  assert.equal(api.acceptSeatRequest('req-1'), false);
  assert.equal(api.acceptSeatRequest('req-2'), true);
  const requests = JSON.parse(data.get('kufr_malik_transit_requests_v6')!);
  assert.equal(requests[0].status, 'pending');
  assert.equal(requests[1].status, 'accepted');
  const drivers = JSON.parse(data.get('kufr_malik_transit_drivers_v8')!);
  assert.equal(drivers[0].passengers, 0);
  assert.equal(drivers[1].passengers, 2);
}));

test('logout followed by valid sign-in restores normal acceptance without requiring an intervening render', () => withSession((api, data) => {
  api.logoutDriver();
  assert.equal(api.acceptSeatRequest('req-1'), false);
  assert.equal(api.loginDriver('driver-1', '1234'), true);
  assert.equal(api.acceptSeatRequest('req-1'), true);
  assert.equal(JSON.parse(data.get('kufr_malik_transit_drivers_v8')!)[0].passengers, 2);
}));

test('failed sign-in neither replaces an existing session nor permits another drivers request', () => withSession((api, data) => {
  assert.equal(api.loginDriver('driver-2', 'wrong'), false);
  assert.equal(api.loginDriver('missing', '1234'), false);
  assert.equal(data.get('kufr_malik_auth_driver_id_v6'), 'driver-1');
  assert.equal(api.acceptSeatRequest('req-2'), false);
  assert.equal(api.acceptSeatRequest('req-1'), true);
}));

test('logout clears the GPS watch and ignores a queued old-session location', () => withSession((api, data) => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let position: PositionCallback | undefined;
  const cleared: number[] = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(callback: PositionCallback) { position = callback; return 7; }, clearWatch(id: number) { cleared.push(id); }
  } } });
  try {
    api.startRealGPSTracking();
    assert.ok(position);
    api.logoutDriver();
    const before = data.get('kufr_malik_transit_drivers_v8');
    position({ coords: { latitude: 31.94, longitude: 35.22, accuracy: 5 }, timestamp: Date.now() } as GeolocationPosition);
    assert.deepEqual(cleared, [7]);
    assert.equal(data.get('kufr_malik_transit_drivers_v8'), before);
    assert.equal(api.acceptSeatRequest('req-1'), false);
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
}));

const countActions: [string, (api: Api, id: string) => void][] = [
  ['increase', (api, id) => api.incrementPassengers(id)],
  ['decrease', (api, id) => api.decrementPassengers(id)],
  ['preset/seat selection', (api, id) => api.updateDriverPassengers(id, 1)],
  ['confirmation', (api, id) => api.confirmDriverPassengers(id)],
  ['FULL', (api, id) => api.fillDriverPassengers(id)]
];

function runCountAction(action: (api: Api, id: string) => void, api: Api, id: string) {
  // A confirmation in the same millisecond would conceal an unauthorized write.
  const originalNow = Date.now;
  const later = originalNow() + 1000;
  Date.now = () => later;
  try { action(api, id); } finally { Date.now = originalNow; }
}

for (const [name, action] of countActions) {
  test(`old ${name} handler cannot write after logout`, () => withSession((api, data) => {
    api.updateDriverPassengers('driver-1', 3);
    api.logoutDriver();
    const before = [...data];
    runCountAction(action, api, 'driver-1');
    assert.deepEqual([...data], before);
  }));

  test(`old ${name} handler cannot edit the previous driver after switching`, () => withSession((api, data) => {
    api.updateDriverPassengers('driver-1', 3);
    assert.equal(api.loginDriver('driver-2', '1234'), true);
    const before = [...data];
    runCountAction(action, api, 'driver-1');
    assert.deepEqual([...data], before);
  }));

  test(`${name} cannot target another driver while signed in`, () => withSession((api, data) => {
    assert.equal(api.loginDriver('driver-2', '1234'), true);
    api.updateDriverPassengers('driver-2', 3);
    assert.equal(api.loginDriver('driver-1', '1234'), true);
    const before = [...data];
    runCountAction(action, api, 'driver-2');
    assert.deepEqual([...data], before);
  }));
}

test('all count controls resume for the current driver after sign-in without rerender', () => withSession((api, data) => {
  api.logoutDriver();
  assert.equal(api.loginDriver('driver-2', '1234'), true);
  api.fillDriverPassengers('driver-2');
  const drivers = () => JSON.parse(data.get('kufr_malik_transit_drivers_v8')!);
  assert.equal(drivers()[1].passengers, 7);
  api.decrementPassengers('driver-2');
  assert.equal(drivers()[1].passengers, 6);
  api.updateDriverPassengers('driver-2', 2);
  api.incrementPassengers('driver-2');
  api.confirmDriverPassengers('driver-2');
  assert.equal(drivers()[1].passengers, 3);
  assert.ok(drivers()[1].seatCountUpdatedAt);
  assert.equal(drivers()[0].passengers, 0);
}));
