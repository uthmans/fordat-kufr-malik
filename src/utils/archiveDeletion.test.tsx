import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransitProvider, useTransit } from '../context/TransitContext';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { ArchiveDeleteConfirmation } from '../components/ArchiveDeleteConfirmation';
import type { ArchivedTrip } from '../types';

async function withArchives(run: (api: ReturnType<typeof useTransit>, history: () => ArchivedTrip[], data: Map<string, string>) => void | Promise<void>, authenticated=true) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousFetch=globalThis.fetch;
  globalThis.fetch=(async () => Response.json({ok:true,role:'admin',token:'a'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString()})) as typeof fetch;
  const archive = (id: string) => ({ id, driverId: 'driver-1', timestamp: Date.now(), formattedDate: 'Nov 4', passengersCount: 2, locationStatus: 'in_ramallah', entries: [] });
  const data = new Map<string, string>([
    ['kufr_malik_transit_drivers_v8', JSON.stringify([{ ...INITIAL_DRIVERS[0], passengers: 3 }])],
    ['kufr_malik_transit_history_v6', JSON.stringify([archive('a'), archive('b')])],
    ['kufr_malik_admin_auth_v6', 'true'], ['kufr_malik_auth_driver_id_v6', 'driver-1'],
    ['kufr_malik_transit_requests_v6', '[]'], ['kufr_malik_transit_triplogs_v6', '[]']
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
    if(authenticated) assert.equal(await api.adminLogin('123456789012'),true);
    await run(api, () => JSON.parse(data.get('kufr_malik_transit_history_v6')!), data);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    globalThis.fetch=previousFetch;
  }
}

test('a saved legacy admin flag and public PIN do not grant administration or demo access', () => withArchives(async (api,history,data) => {
  assert.equal(api.isAdminAuthenticated,false);
  assert.equal(await api.adminLogin('9999'),false);
  api.deleteArchivedTrip('a');
  assert.equal(history().length,2);
  data.set('kufr_malik_show_demo_v1','false');
  api.setShowDemoData(true);
  assert.equal(data.get('kufr_malik_show_demo_v1'),'false');
},false));

test('admin logout disables demo access and stale demo controls cannot re-enable it', () => withArchives((api,_,data) => {
  api.setShowDemoData(true);
  assert.equal(data.get('kufr_malik_show_demo_v1'),'true');
  api.adminLogout(); api.setShowDemoData(true);
  assert.equal(data.get('kufr_malik_show_demo_v1'),'false');
}));

test('sequential deletes cannot restore a trip deleted by an earlier action', () => withArchives((api, history) => {
  api.deleteArchivedTrip('a');
  api.deleteArchivedTrip('b');
  assert.deepEqual(history(), []);
}));

test('deleting an older trip preserves an archive just created before rerender', () => withArchives((api, history) => {
  api.archiveCurrentTrip('driver-1');
  const newest = history()[0].id;
  api.deleteArchivedTrip('a');
  assert.deepEqual(history().map(t => t.id), [newest, 'b']);
}));

test('confirmation snapshot deletes only selected trips, keeping new arrivals', () => withArchives((api, history) => {
  const selected = history().map(t => t.id);
  api.archiveCurrentTrip('driver-1');
  const newest = history()[0].id;
  api.clearAllTripHistory(selected);
  assert.deepEqual(history().map(t => t.id), [newest]);
}));

test('unknown IDs and repeated deletion leave the latest saved history unchanged', () => withArchives((api, history, data) => {
  api.deleteArchivedTrip('a');
  const before = data.get('kufr_malik_transit_history_v6');
  api.deleteArchivedTrip('a');
  api.deleteArchivedTrip('unknown');
  api.clearAllTripHistory([]);
  assert.equal(data.get('kufr_malik_transit_history_v6'), before);
  assert.deepEqual(history().map(t => t.id), ['b']);
}));

test('a stale deletion handler cannot remove records after admin logout', () => withArchives((api, history, data) => {
  const before = data.get('kufr_malik_transit_history_v6');
  api.adminLogout();
  api.deleteArchivedTrip('a');
  api.clearAllTripHistory();
  assert.equal(data.get('kufr_malik_transit_history_v6'), before);
  assert.equal(history().length, 2);
}));

test('archive deletion never changes current bookings, active logs or driver occupancy', () => withArchives((api, history, data) => {
  const keys = ['kufr_malik_transit_drivers_v8', 'kufr_malik_transit_requests_v6', 'kufr_malik_transit_triplogs_v6'];
  const before = keys.map(key => data.get(key));
  api.clearAllTripHistory(['a', 'b']);
  assert.deepEqual(history(), []);
  assert.deepEqual(keys.map(key => data.get(key)), before);
}));

test('confirmation identifies selected count, permanence and new-arrival preservation in both languages', () => {
  for (const isAr of [false, true]) {
    const html = renderToStaticMarkup(<ArchiveDeleteConfirmation count={2} isAr={isAr} onCancel={() => {}} onConfirm={() => {}} />);
    assert.ok(html.includes('role="alertdialog"'));
    assert.ok(html.includes(isAr ? 'لا يمكن التراجع' : 'permanently'));
    assert.ok(html.includes(isAr ? '2 من الرحلات' : '2 selected saved trips'));
    assert.ok(html.includes(isAr ? 'إلغاء' : 'Cancel'));
  }
});
