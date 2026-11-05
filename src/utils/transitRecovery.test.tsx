import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { VillagerView } from '../components/VillagerView';
import { DriverView } from '../components/DriverView';
import { AdminPortal } from '../components/AdminPortal';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

function Collections() {
  const state = useTransit();
  return <output>{JSON.stringify({
    requests: state.seatRequests.map(r => r.id), logs: state.tripLogs.map(l => l.id),
    history: state.tripHistory.map(t => t.entries.map(e => e.id)),
    driver: state.currentDriver?.nameEn, name: state.villagerName
  })}</output>;
}

function renderWithStorage(data: Record<string, string>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data[key] ?? null,
    setItem: () => { throw Error('Startup must not rewrite data'); },
    removeItem: () => {}
  } });
  try {
    return renderToStaticMarkup(<TransitProvider><Collections /><VillagerView /><DriverView /><AdminPortal /></TransitProvider>);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('passenger, driver and admin screens render with corrupt saved collections', () => {
  for (const broken of ['null', '{}', '[null]', '[{"id":42}]', '{broken']) {
    const html = renderWithStorage({
      kufr_malik_transit_drivers_v8: broken,
      kufr_malik_transit_requests_v6: broken,
      kufr_malik_transit_triplogs_v6: broken,
      kufr_malik_transit_history_v6: broken
    });
    assert.ok(html.includes('علاء حمايل'));
    assert.ok(html.includes('جارٍ استعادة دخولك'));
    assert.ok(html.includes('بوابة إدارة خط كفر مالك'));
  }
});

test('damaged neighbours do not erase a valid edited driver, remembered session or villager name', () => {
  const html = renderWithStorage({
    kufr_malik_transit_drivers_v8: JSON.stringify([{ ...INITIAL_DRIVERS[0], nameEn: 'Saved Driver', nameAr: 'سائق محفوظ' }, null]),
    kufr_malik_auth_driver_id_v6: 'driver-1',
    kufr_malik_villager_name_v1: 'أم أحمد',
    kufr_malik_transit_requests_v6: 'null', kufr_malik_transit_triplogs_v6: '{}', kufr_malik_transit_history_v6: '[null]'
  });
  assert.ok(html.includes('Saved Driver'));
  assert.ok(html.includes('سائق محفوظ'));
  assert.ok(html.includes('أم أحمد'));
  assert.ok(!html.includes('تسجيل دخول السائقين'));
});
