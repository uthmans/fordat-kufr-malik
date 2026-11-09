import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { SharedPublisher, publishableDriver } from './sharedPublisher';
import { PublicationError } from './publicationError';
import type { PublicDriver, SharedDriverRow } from './sharedDriver';
import { hasLastSharedLocation, isSharedDriverActive, formatLastSeen, publicationState } from './sharedAvailability';
import { PassengerDriverCard } from '../components/PassengerDriverCard';
import { RouteVisualizer } from '../components/RouteVisualizer';
import { PublicationStatus } from '../components/PublicationStatus';

const now = 1_800_000_000_000;
const live = (patch = {}) => ({ ...INITIAL_DRIVERS[0], isOnDuty: true, gpsMode: 'live' as const,
  passengers: 5, seatCountUpdatedAt: now, currentLocation: { lat: 31.98, lng: 35.3, timestamp: now }, ...patch });
const row = (snapshot: PublicDriver, revision = 1): SharedDriverRow => ({ driver_id: snapshot.id, snapshot, revision, received_at: new Date(now).toISOString() });

test('a temporary upload outage recovers without another Share tap and sends the latest changes', async () => {
  let clock = now, calls = 0, reads = 0, errors = 0;
  const waiting: boolean[] = [], sent: PublicDriver[] = [];
  const publisher = new SharedPublisher(async snapshot => {
    calls++; if (calls === 1) throw new TypeError('Failed to fetch');
    sent.push(snapshot); return row(snapshot);
  }, () => {}, () => { errors++; }, () => clock, {
    read: async () => { reads++; return null; }, onWaiting: value => waiting.push(value)
  });
  publisher.start('driver-1', null); publisher.queue(live()); await publisher.flush();
  publisher.queue(live({ passengers: 6 })); await publisher.flush();
  assert.equal(calls, 1); // backoff, no request storm
  clock += 2000; await publisher.flush();
  assert.equal(reads, 1); assert.equal(sent[0].passengers, 6); assert.equal(errors, 0);
  assert.equal(waiting.at(-1), false);
});

test('recovery recognises an upload committed before its reply was lost', async () => {
  let clock = now, calls = 0;
  const sent: { snapshot: PublicDriver; revision: number | null }[] = [];
  let remote: SharedDriverRow | null = null;
  const publisher = new SharedPublisher(async (snapshot, revision) => {
    calls++; sent.push({ snapshot, revision });
    if (calls === 1) { remote = row(snapshot, 8); throw new DOMException('timeout', 'AbortError'); }
    return row(snapshot, 9);
  }, () => {}, error => { throw error; }, () => clock, { read: async () => remote, onWaiting: () => {} });
  publisher.start('driver-1', null); publisher.queue(live()); await publisher.flush();
  publisher.queue(live({ passengers: 6 })); clock += 2000; await publisher.flush();
  assert.equal(calls, 2); assert.equal(sent[1].revision, 8); assert.equal(sent[1].snapshot.passengers, 6);
});

test('an acknowledged lost reply is not uploaded a second time', async () => {
  let clock = now, calls = 0;
  let remote: SharedDriverRow | null = null;
  const publisher = new SharedPublisher(async snapshot => { calls++; remote = row(snapshot); throw new Error('lost reply'); },
    () => {}, error => { throw error; }, () => clock, { read: async () => remote, onWaiting: () => {} });
  publisher.start('driver-1', null); publisher.queue(live()); await publisher.flush();
  clock += 2000; await publisher.flush(); await publisher.flush(); assert.equal(calls, 1);
});

test('another phone changing the record stops retries and exposes the competing row', async () => {
  let clock = now, sends = 0;
  const errors: unknown[] = [];
  const baseline = row(publishableDriver(live(), now)!, 3);
  const competing = row(publishableDriver(live({ passengers: 1 }), now)!, 4);
  const publisher = new SharedPublisher(async () => { sends++; throw new PublicationError('conflict'); }, () => {}, error => errors.push(error),
    () => clock, { read: async () => competing, onWaiting: () => {} });
  publisher.start('driver-1', baseline); publisher.queue(live({ passengers: 6 })); await publisher.flush();
  clock += 2000; await publisher.flush();
  publisher.queue(live()); publisher.reconnect(); await publisher.flush();
  assert.equal(sends, 1); assert.equal(errors.length, 1);
  assert.equal((errors[0] as PublicationError).kind, 'conflict'); assert.equal((errors[0] as PublicationError).row, competing);
});

test('offline/online signals recover with no pending changes, and stop cannot be undone by reconnect', async () => {
  let reads = 0, sends = 0;
  const baseline = row(publishableDriver(live(), now)!);
  const publisher = new SharedPublisher(async snapshot => { sends++; return row(snapshot); }, () => {}, error => { throw error; }, () => now,
    { read: async () => { reads++; return baseline; }, onWaiting: () => {} });
  publisher.start('driver-1', baseline); publisher.reconnect(); await publisher.flush();
  assert.equal(reads, 1); assert.equal(sends, 0);
  publisher.stop(); publisher.reconnect(); publisher.queue(live()); await publisher.flush(); assert.equal(reads, 1);
});

test('slow recovery uses a GPS fix queued during the read and never revives a stopped driver', async () => {
  let resolve!: (row: SharedDriverRow | null) => void;
  let sends = 0;
  const publisher = new SharedPublisher(async snapshot => { sends++; assert.equal(snapshot.currentLocation.lng, 35.31); return row(snapshot); },
    () => {}, error => { throw error; }, () => now, { read: () => new Promise(done => { resolve = done; }), onWaiting: () => {} });
  publisher.start('driver-1', null); publisher.queue(live()); publisher.reconnect(); const pending = publisher.flush();
  publisher.queue(live({ currentLocation: { lat: 31.99, lng: 35.31, timestamp: now } })); resolve(null); await pending; assert.equal(sends, 1);
  publisher.reconnect(); const stopped = publisher.flush(); publisher.stop(); resolve(null); await stopped; assert.equal(sends, 1);
});

test('repeated recovery failures back off and never publish stale GPS after an outage', async () => {
  let clock = now, reads = 0, sends = 0;
  const publisher = new SharedPublisher(async snapshot => { sends++; return row(snapshot); }, () => {}, error => { throw error; }, () => clock,
    { read: async () => { reads++; if (reads < 3) throw new TypeError('no network'); return null; }, onWaiting: () => {} });
  publisher.start('driver-1', null); publisher.queue(live()); publisher.reconnect();
  await publisher.flush(); await publisher.flush(); assert.equal(reads, 1);
  clock += 2000; await publisher.flush(); clock += 2000; await publisher.flush(); assert.equal(reads, 2);
  clock += 120000; await publisher.flush(); assert.equal(reads, 3); assert.equal(sends, 0);
  publisher.queue(live({ currentLocation: { lat: 31.98, lng: 35.3, timestamp: clock } })); await publisher.flush(); assert.equal(sends, 1);
});

test('revoked sessions and malformed publication requests are terminal, not network retries', async () => {
  for (const kind of ['invalid_session', 'invalid_request'] as const) {
    let sends = 0, errors = 0, reads = 0;
    const publisher = new SharedPublisher(async () => { sends++; throw new PublicationError(kind); }, () => {}, () => { errors++; }, () => now,
      { read: async () => { reads++; return null; }, onWaiting: () => {} });
    publisher.start('driver-1', null); publisher.queue(live()); await publisher.flush(); publisher.reconnect(); await publisher.flush();
    assert.equal(sends, 1); assert.equal(errors, 1); assert.equal(reads, 0);
  }
});

test('old on-duty reports remain last-seen history, never live availability', () => {
  const old = row(publishableDriver(live(), now)!);
  for (const age of [120000, 3600000, 3 * 86400000]) {
    assert.equal(isSharedDriverActive(old, now + age), false); assert.equal(hasLastSharedLocation(old, now + age), true);
  }
  for (const patch of [{ isOnDuty: false }, { gpsMode: 'simulation' as const }, { gpsMode: 'idle' as const },
    { currentLocation: { lat: 0, lng: 0, timestamp: 0 } }, { currentLocation: { lat: 31.98, lng: 35.3, timestamp: now + 1 } }]) {
    assert.equal(hasLastSharedLocation(row({ ...old.snapshot, ...patch }), now), false);
  }
  assert.equal(hasLastSharedLocation(undefined, now), false);
});

test('last-seen cards retain contacts while hiding old seat counts and departure claims in both languages', () => {
  for (const isAr of [true, false]) {
    const driver = live({ departureCountdown: 'in_5_mins' as const, departureCountdownSetAt: now });
    const html = renderToStaticMarkup(<PassengerDriverCard driver={driver} now={now + 180000} isAr={isAr} demo={false} lastSeen onWhatsApp={() => {}} />);
    assert.ok(html.includes(isAr ? 'آخر ظهور' : 'Last seen 3 minutes ago'));
    assert.ok(html.includes('href="tel:+972597073155"')); assert.ok(html.includes(isAr ? 'واتساب' : 'WhatsApp'));
    assert.ok(!html.includes('2 seats')); assert.ok(!html.includes('Departing in 5 mins'));
    const map = renderToStaticMarkup(<RouteVisualizer drivers={[driver]} now={now + 180000} language={isAr ? 'ar' : 'en'} staleDriverIds={[driver.id]} />);
    assert.ok(map.includes(isAr ? 'آخر ظهور' : 'Last seen')); assert.ok(!map.includes('5/7'));
  }
});

test('a stale server report cannot claim fresh seats even if its GPS timestamp looks recent', () => {
  const html = renderToStaticMarkup(<PassengerDriverCard driver={live()} now={now} isAr={false} demo={false} lastSeen onWhatsApp={() => {}} />);
  assert.ok(!html.includes('2 seats')); assert.ok(html.includes('Location not updating'));
});

test('last-seen ages stay truthful for hours, days and missing timestamps; recovery never looks live', () => {
  assert.equal(formatLastSeen(now - 3600000, now, false), 'Last seen 1 hour ago');
  assert.ok(formatLastSeen(now - 3 * 86400000, now, false).includes('3 days ago'));
  assert.equal(formatLastSeen(now + 1, now, false), 'No reported location');
  const state = publicationState({ driver: live(), sharing: true, online: true, gpsError: false, recovering: true, lastPublished: null, now });
  assert.equal(state, 'recovering');
  for (const isAr of [true, false]) assert.ok(renderToStaticMarkup(<PublicationStatus state={state} isAr={isAr} />).includes('role="status"'));
});
