import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import type { SeatRequest } from '../types';
import { ReservationHandoff } from './reservationHandoff';

type Api = ReturnType<typeof useTransit>;
function withBookings(run: (api: Api, requests: () => SeatRequest[], data: Map<string, string>) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>([
    ['kufr_malik_transit_drivers_v8', JSON.stringify([{ ...INITIAL_DRIVERS[0], passengers: 0, isOnDuty: true }])],
    ['kufr_malik_auth_driver_id_v6', 'driver-1'],
    ['kufr_malik_villager_name_v1', 'Saved family'],
    ['kufr_malik_transit_requests_v6', JSON.stringify([{ id: 'req-existing', driverId: 'driver-1', passengerName: 'Existing family', seatCount: 2, timestamp: Date.now(), status: 'pending' }])]
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
    run(api, () => JSON.parse(data.get('kufr_malik_transit_requests_v6')!), data);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('back-to-back submissions retain both new requests and the existing request', () => withBookings((api, requests) => {
  assert.equal(api.requestSeat('driver-1', 'First family', 2), true);
  assert.equal(api.requestSeat('driver-1', 'Second family', 3), true);
  assert.deepEqual(requests().map(r => r.passengerName), ['Second family', 'First family', 'Existing family']);
  assert.equal(new Set(requests().map(r => r.id)).size, 3);
}));

test('new submissions cannot restore an accepted request to pending', () => withBookings((api, requests, data) => {
  assert.equal(api.acceptSeatRequest('req-existing'), true);
  assert.equal(api.requestSeat('driver-1', 'New family', 1), true);
  assert.equal(requests().find(r => r.id === 'req-existing')?.status, 'accepted');
  assert.equal(JSON.parse(data.get('kufr_malik_transit_drivers_v8')!)[0].passengers, 2);
  assert.equal(JSON.parse(data.get('kufr_malik_transit_triplogs_v6')!).length, 1);
}));

test('new submissions retain declined requests from the latest state', () => withBookings((api, requests) => {
  assert.equal(api.declineSeatRequest('req-existing'), true);
  api.requestSeat('driver-1', 'New family', 1);
  assert.equal(requests().find(r => r.id === 'req-existing')?.status, 'declined');
}));

test('invalid or unknown-driver requests change neither requests nor saved identity', () => withBookings((api, requests, data) => {
  const before = requests();
  for (const count of [0, -1, 1.5, NaN, Infinity, 8]) assert.equal(api.requestSeat('driver-1', 'Invalid new name', count), false);
  assert.equal(api.requestSeat('missing', 'Invalid new name', 1), false);
  assert.equal(api.requestSeat('driver-1', ' ', 1), false);
  assert.deepEqual(requests(), before);
  assert.equal(data.get('kufr_malik_villager_name_v1'), 'Saved family');
}));

test('creation uses current capacity and normalizes the saved primary name', () => withBookings((api, requests, data) => {
  assert.equal(api.adminUpdateDriver('driver-1', { maxCapacity: 2 }), true);
  assert.equal(api.requestSeat('driver-1', 'Too many', 3), false);
  assert.equal(api.requestSeat('driver-1', '  أم   أحمد  ', 2), true);
  assert.equal(requests()[0].passengerName, 'أم أحمد');
  assert.equal(data.get('kufr_malik_villager_name_v1'), 'أم أحمد');
}));

test('a stale modal capacity cannot prepare WhatsApp when the current app rejects the request', () => withBookings((api, requests) => {
  api.adminUpdateDriver('driver-1', { maxCapacity: 2 });
  const result = new ReservationHandoff().submit({ driverId: 'driver-1', phone: '+970599111222', name: 'Family', seats: 3, capacity: 7, isArabic: false },
    reservation => api.requestSeat(reservation.driverId, reservation.name, reservation.seats), () => assert.fail('No launch'));
  assert.deepEqual(result, { ok: false, error: 'request' });
  assert.equal(requests().length, 1);
}));
