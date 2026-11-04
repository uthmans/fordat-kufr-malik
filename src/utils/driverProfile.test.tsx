import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { changedProfileFields, editDriverProfile, DriverProfileUpdates } from './driverProfile';

const now = 1_800_000_000_000;
const original = INITIAL_DRIVERS[0];

test('forms send only fields changed from their original snapshot', () => {
  assert.deepEqual(changedProfileFields(original, {
    nameAr: original.nameAr, nameEn: ' Updated name ', phone: original.phone,
    pinCode: original.pinCode, maxCapacity: original.maxCapacity
  }), { nameEn: 'Updated name' });
  assert.deepEqual(changedProfileFields(original, { nameAr: original.nameAr }), {});
});

test('an untouched phone or PIN changed while the form was open is retained', () => {
  const latest = { ...original, phone: '+970599111222', pinCode: '005826' };
  const patch = changedProfileFields(original, { nameEn: 'Updated name', phone: original.phone, pinCode: original.pinCode });
  const [saved] = editDriverProfile([latest], original.id, patch, now)!;
  assert.equal(saved.nameEn, 'Updated name');
  assert.equal(saved.phone, latest.phone);
  assert.equal(saved.pinCode, latest.pinCode);
});

test('profile edits retain latest GPS, occupancy, duty state and other driver records', () => {
  const latest = { ...original, passengers: 6, currentStopEn: 'Latest stop', isOnDuty: false,
    autoPausedForInactivity: true, currentLocation: { ...original.currentLocation, timestamp: now } };
  const drivers = [latest, INITIAL_DRIVERS[1]];
  const before = structuredClone(drivers);
  const next = editDriverProfile(drivers, latest.id, { nameAr: 'اسم جديد' }, now)!;
  assert.deepEqual(drivers, before);
  assert.equal(next[1], drivers[1]);
  for (const key of ['currentLocation', 'currentStopEn', 'passengers', 'isOnDuty', 'autoPausedForInactivity'] as const) {
    assert.deepEqual(next[0][key], latest[key]);
  }
});

test('profile API cannot overwrite IDs, passenger counts or GPS through extra fields', () => {
  const payload = { nameEn: 'Updated', id: 'changed-id', passengers: 0, currentLocation: null } as DriverProfileUpdates;
  const [saved] = editDriverProfile([original], original.id, payload, now)!;
  assert.equal(saved.id, original.id);
  assert.equal(saved.passengers, original.passengers);
  assert.deepEqual(saved.currentLocation, original.currentLocation);
  assert.equal(saved.nameEn, 'Updated');
});

test('invalid editable values reject the whole save and never reset fields to defaults', () => {
  for (const patch of [{ nameEn: ' ' }, { phone: 'invalid' }, { pinCode: '' }, { pinCode: '123' },
    { maxCapacity: 0 }, { maxCapacity: 2 }, { maxCapacity: 7.5 }]) {
    assert.equal(editDriverProfile([original], original.id, patch, now), null);
  }
  assert.equal(editDriverProfile([original], 'missing', { nameEn: 'Updated' }, now), null);
});

test('valid local/international phones and PINs with leading zeroes remain supported', () => {
  for (const phone of ['0599111222', '+970599111222', '+972599111222']) {
    const [saved] = editDriverProfile([original], original.id, { phone, pinCode: '005826' }, now)!;
    assert.equal(saved.phone, phone);
    assert.equal(saved.pinCode, '005826');
  }
});

test('unchanged profiles need no write and capacity reductions use latest occupancy', () => {
  const drivers = [original];
  assert.equal(editDriverProfile(drivers, original.id, {}, now), drivers);
  const latest = { ...original, passengers: 8, maxCapacity: 9 };
  assert.equal(editDriverProfile([latest], latest.id, { maxCapacity: 7 }, now), null);
  assert.equal(editDriverProfile([latest], latest.id, { maxCapacity: 8 }, now)![0].maxCapacity, 8);
});

function withProvider(run: (api: ReturnType<typeof useTransit>, data: Map<string, string>) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>([
    ['kufr_malik_transit_drivers_v8', JSON.stringify([{ ...original, passengers: 0, isOnDuty: true }, INITIAL_DRIVERS[1]])],
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
    run(api, data);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('original profile handlers cannot overwrite a just-accepted booking before rerender', () => withProvider((api, data) => {
  assert.equal(api.acceptSeatRequest('req-now'), true);
  assert.equal(api.updateDriverProfile('driver-1', { nameEn: 'Updated' }), true);
  assert.equal(api.adminUpdateDriver('driver-2', { nameEn: 'Other updated' }), true);
  const drivers = JSON.parse(data.get('kufr_malik_transit_drivers_v8')!);
  assert.equal(drivers[0].passengers, 2);
  assert.equal(drivers[0].nameEn, 'Updated');
  assert.equal(drivers[1].nameEn, 'Other updated');
  assert.equal(JSON.parse(data.get('kufr_malik_transit_triplogs_v6')!).length, 1);
}));

test('failed provider save reports failure without overwriting persisted driver data', () => withProvider((api, data) => {
  const before = data.get('kufr_malik_transit_drivers_v8');
  assert.equal(api.updateDriverProfile('driver-1', { phone: 'invalid' }), false);
  assert.equal(data.get('kufr_malik_transit_drivers_v8'), before);
}));
