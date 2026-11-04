import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { changePassengerCount, passengerShortcuts } from './passengerCount';
import { PassengerPresets } from '../components/PassengerPresets';

const now = 1_800_000_000_000;
const roster = (passengers = 0, maxCapacity = 7) => [{ ...INITIAL_DRIVERS[0], passengers, maxCapacity }, INITIAL_DRIVERS[1]];

test('quick shortcuts match smaller, standard and larger vehicle capacities', () => {
  assert.deepEqual(passengerShortcuts(4), [0, 1, 2, 3, 4]);
  assert.deepEqual(passengerShortcuts(7), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(passengerShortcuts(9), [0, 1, 2, 3, 4, 5, 6, 9]);
  assert.deepEqual(passengerShortcuts(1), [0, 1]);
});

test('quick choices stay bounded and invalid capacities produce no presets', () => {
  assert.equal(passengerShortcuts(1000).length, 8);
  for (const capacity of [0, -1, 1.5, NaN, Infinity]) assert.deepEqual(passengerShortcuts(capacity), []);
});

test('FULL uses actual capacity rather than seven and retains other vehicle data', () => {
  for (const capacity of [4, 7, 9]) {
    const drivers = roster(0, capacity);
    const next = changePassengerCount(drivers, 'driver-1', { kind: 'full' }, now)!;
    assert.equal(next[0].passengers, capacity);
    assert.equal(next[0].seatCountUpdatedAt, now);
    assert.deepEqual(next[0].currentLocation, drivers[0].currentLocation);
    assert.equal(next[1], drivers[1]);
  }
});

test('rendered Arabic and English presets have one correctly labelled FULL selection', () => {
  for (const capacity of [4, 7, 9]) {
    for (const isAr of [false, true]) {
      const html = renderToStaticMarkup(<PassengerPresets passengers={capacity} capacity={capacity} isAr={isAr} onSet={() => {}} onFull={() => {}} />);
      assert.ok(html.includes(isAr ? `تعيين السيارة مكتملة (${capacity} مقاعد)` : `Mark vehicle full (${capacity} seats)`));
      assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
      assert.equal((html.match(/<button /g) ?? []).length, passengerShortcuts(capacity).length);
      if (capacity === 4) assert.ok(!html.includes(isAr ? 'تعيين عدد الركاب إلى 6' : 'Set passenger count to 6'));
    }
  }
});

test('consecutive plus and minus operations accumulate against the latest count', () => {
  let drivers = roster();
  for (const delta of [1, 1, 1, -1] as const) {
    drivers = changePassengerCount(drivers, 'driver-1', { kind: 'adjust', delta }, now)!;
  }
  assert.equal(drivers[0].passengers, 2);
});

test('counter bounds do not overflow or falsely refresh a saved count', () => {
  const full = roster(7);
  const empty = roster();
  assert.equal(changePassengerCount(full, 'driver-1', { kind: 'adjust', delta: 1 }, now), full);
  assert.equal(changePassengerCount(empty, 'driver-1', { kind: 'adjust', delta: -1 }, now), empty);
});

test('absolute presets use the configured capacity, including vehicles larger than seven seats', () => {
  assert.equal(changePassengerCount(roster(0, 9), 'driver-1', { kind: 'set', count: 9 }, now)![0].passengers, 9);
  assert.equal(changePassengerCount(roster(0, 4), 'driver-1', { kind: 'set', count: 9 }, now)![0].passengers, 4);
  assert.equal(changePassengerCount(roster(2), 'driver-1', { kind: 'set', count: -1 }, now)![0].passengers, 0);
});

test('explicit confirmation refreshes timestamps without changing occupancy', () => {
  const next = changePassengerCount(roster(3), 'driver-1', { kind: 'confirm' }, now)![0];
  assert.equal(next.passengers, 3);
  assert.equal(next.seatCountUpdatedAt, now);
  assert.equal(next.lastActiveTime, now);
});

test('manual counts preserve GPS, other drivers, identity and an existing inactivity pause', () => {
  const drivers = roster(2);
  drivers[0].isOnDuty = false;
  drivers[0].autoPausedForInactivity = true;
  const before = structuredClone(drivers);
  const next = changePassengerCount(drivers, 'driver-1', { kind: 'adjust', delta: 1 }, now)!;
  assert.deepEqual(drivers, before);
  assert.equal(next[1], drivers[1]);
  for (const key of ['currentLocation', 'currentStopEn', 'pinCode', 'isOnDuty', 'autoPausedForInactivity'] as const) {
    assert.deepEqual(next[0][key], drivers[0][key]);
  }
});

test('invalid input and unknown drivers do not change counts', () => {
  for (const count of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(changePassengerCount(roster(), 'driver-1', { kind: 'set', count }, now), null);
  }
  for (const timestamp of [NaN, Infinity, 0, 1e30]) {
    assert.equal(changePassengerCount(roster(), 'driver-1', { kind: 'confirm' }, timestamp), null);
  }
  assert.equal(changePassengerCount(roster(), 'missing', { kind: 'confirm' }, now), null);
  assert.equal(changePassengerCount(roster(0, 0), 'driver-1', { kind: 'confirm' }, now), null);
});

function withProvider(run: (api: ReturnType<typeof useTransit>, read: (key: string) => any) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>([
    ['kufr_malik_transit_drivers_v8', JSON.stringify(roster())],
    ['kufr_malik_auth_driver_id_v6', 'driver-1'],
    ['kufr_malik_transit_requests_v6', JSON.stringify([{ id: 'req-now', driverId: 'driver-1', passengerName: 'Family', seatCount: 2, timestamp: Date.now(), status: 'pending' }])]
  ]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); }
  } });
  let api: ReturnType<typeof useTransit> | undefined;
  function Capture() { api = useTransit(); return null; }
  try {
    renderToStaticMarkup(<TransitProvider><Capture /></TransitProvider>);
    assert.ok(api);
    // Keep these original handlers: no intervening render can refresh their closures.
    run(api, key => JSON.parse(data.get(key)!));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('provider handlers preserve rapid taps before React rerenders', () => withProvider((api, read) => {
  api.incrementPassengers('driver-1');
  api.incrementPassengers('driver-1');
  assert.equal(read('kufr_malik_transit_drivers_v8')[0].passengers, 2);
  api.decrementPassengers('driver-1');
  assert.equal(read('kufr_malik_transit_drivers_v8')[0].passengers, 1);
}));

test('confirm and increment retain a booking accepted immediately before them', () => withProvider((api, read) => {
  assert.equal(api.acceptSeatRequest('req-now'), true);
  api.confirmDriverPassengers('driver-1');
  assert.equal(read('kufr_malik_transit_drivers_v8')[0].passengers, 2);
  api.incrementPassengers('driver-1');
  assert.equal(read('kufr_malik_transit_drivers_v8')[0].passengers, 3);
  assert.equal(read('kufr_malik_transit_requests_v6')[0].status, 'accepted');
  assert.equal(read('kufr_malik_transit_triplogs_v6').length, 1);
}));

test('a count edit cannot overwrite another change made since the handler was rendered', () => withProvider((api, read) => {
  api.updateDriverProfile('driver-1', { nameEn: 'Latest profile', nameAr: 'اسم محدث' });
  api.incrementPassengers('driver-1');
  const driver = read('kufr_malik_transit_drivers_v8')[0];
  assert.equal(driver.nameEn, 'Latest profile');
  assert.equal(driver.nameAr, 'اسم محدث');
  assert.equal(driver.passengers, 1);
}));

test('an original FULL handler uses a capacity changed since its screen rendered', () => withProvider((api, read) => {
  assert.equal(api.adminUpdateDriver('driver-1', { maxCapacity: 9 }), true);
  api.fillDriverPassengers('driver-1');
  assert.equal(read('kufr_malik_transit_drivers_v8')[0].passengers, 9);
  api.updateDriverPassengers('driver-1', 0);
  assert.equal(api.adminUpdateDriver('driver-1', { maxCapacity: 4 }), true);
  api.fillDriverPassengers('driver-1');
  assert.equal(read('kufr_malik_transit_drivers_v8')[0].passengers, 4);
}));
