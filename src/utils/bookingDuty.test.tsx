import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransitProvider } from '../context/TransitContext';
import { SeatRequestsList } from '../components/SeatRequestsList';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

function renderRequests(isOnDuty: boolean, language: 'ar' | 'en') {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data: Record<string, string> = {
    kufr_malik_transit_drivers_v8: JSON.stringify([{ ...INITIAL_DRIVERS[0], passengers: 0, isOnDuty }]),
    kufr_malik_transit_requests_v6: JSON.stringify([{ id: 'req-duty', driverId: 'driver-1', passengerName: 'Pending Family', seatCount: 2, timestamp: Date.now(), status: 'pending' }]),
    kufr_malik_transit_lang: language
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data[key] ?? null } });
  try { return renderToStaticMarkup(<TransitProvider><SeatRequestsList driverId="driver-1" /></TransitProvider>); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('off-duty request cards retain the request and explain the disabled accept button in both languages', () => {
  for (const language of ['ar', 'en'] as const) {
    const html = renderRequests(false, language);
    assert.ok(html.includes('Pending Family'));
    assert.ok(html.includes(language === 'ar' ? 'فعّل الدوام لقبول الطلب' : 'Go on duty to accept'));
    assert.ok(/<button[^>]*disabled=""/.test(html));
    assert.ok(!html.includes(language === 'ar' ? 'لا توجد مقاعد كافية' : 'Not enough seats'));
  }
});

test('on-duty request cards keep the normal enabled accept action', () => {
  const html = renderRequests(true, 'en');
  assert.ok(html.includes('Accept (+ Add)'));
  assert.ok(!html.includes('disabled=""'));
});
