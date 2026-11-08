import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { toPublicDriver, type SharedDriverRow } from './sharedDriver';
import { planSharingStart, sharingSettingsSignature, type SharingResolution } from './sharingReconciliation';
import { SharedPublisher } from './sharedPublisher';
import { SharingConflictPanel } from '../components/SharingConflictPanel';

const now = 1_800_000_000_000;
const phone = { ...INITIAL_DRIVERS[0], isOnDuty: true, passengers: 2, gpsMode: 'live' as const,
  lastActiveTime: now, currentLocation: { lat: 31.98, lng: 35.3, timestamp: now }, seatCountUpdatedAt: now };
const row: SharedDriverRow = { driver_id: phone.id, revision: 7, received_at: new Date(now - 1000).toISOString(),
  snapshot: toPublicDriver({ ...phone, isOnDuty: false, passengers: 5, lastActiveTime: now - 500000 }) };
const choose = (choice: SharingResolution['choice']): SharingResolution => ({ driverId: phone.id, choice, revision: row.revision, localSignature: sharingSettingsSignature(phone) });

test('different duty or passenger values wait for a choice and mutate neither source', () => {
  const before = JSON.stringify({ phone, row });
  assert.equal(planSharingStart(phone, row).kind, 'conflict');
  assert.equal(JSON.stringify({ phone, row }), before);
  for (const snapshot of [{ ...toPublicDriver(phone), passengers: 1 }, { ...toPublicDriver(phone), isOnDuty: false }]) {
    assert.equal(planSharingStart(phone, { ...row, snapshot }).kind, 'conflict');
  }
});

test('choosing this phone keeps local settings and passenger-count freshness', () => {
  const plan = planSharingStart(phone, row, choose('phone'));
  assert.equal(plan.kind, 'ready');
  if (plan.kind !== 'ready') return;
  assert.equal(plan.driver.passengers, 2);
  assert.equal(plan.driver.isOnDuty, true);
  assert.equal(plan.driver.seatCountUpdatedAt, now);
});

test('choosing published settings retains this phone GPS, private fields and recent duty activity', () => {
  const plan = planSharingStart(phone, row, choose('published'));
  assert.equal(plan.kind, 'ready');
  if (plan.kind !== 'ready') return;
  assert.equal(plan.driver.passengers, 5);
  assert.equal(plan.driver.isOnDuty, false);
  assert.deepEqual(plan.driver.currentLocation, phone.currentLocation);
  assert.equal(plan.driver.gpsMode, 'live');
  assert.equal(plan.driver.pinCode, phone.pinCode);
  assert.equal(plan.driver.lastActiveTime, now);
});

test('new server revisions or local edits invalidate an older confirmation', () => {
  for (const choice of ['phone', 'published'] as const) {
    assert.equal(planSharingStart(phone, { ...row, revision: 8 }, choose(choice)).kind, 'conflict');
    assert.equal(planSharingStart({ ...phone, passengers: 3 }, row, choose(choice)).kind, 'conflict');
    assert.equal(planSharingStart({ ...phone, prayerShift: 'after_isha' }, row, choose(choice)).kind, 'conflict');
    assert.equal(planSharingStart(phone, row, { ...choose(choice), driverId: 'driver-2' }).kind, 'conflict');
  }
});

test('matching settings or a first publication need no confirmation; GPS movement alone is not a conflict', () => {
  assert.equal(planSharingStart(phone, null).kind, 'ready');
  const same = { ...row, snapshot: toPublicDriver(phone) };
  const plan = planSharingStart({ ...phone, currentLocation: { ...phone.currentLocation, timestamp: now + 1000 } }, same);
  assert.equal(plan.kind, 'ready');
  if (plan.kind === 'ready') assert.equal(plan.driver.currentLocation.timestamp, now + 1000);
});

test('shift, notice and confirmed count changes cannot silently disappear on startup', () => {
  for (const patch of [{ prayerShift: 'after_isha' as const }, { departureCountdown: 'in_5_mins' as const },
    { departureNoteAr: 'طالع قريباً' }, { seatCountUpdatedAt: now - 1000 }]) {
    assert.equal(planSharingStart({ ...phone, ...patch }, { ...row, snapshot: toPublicDriver(phone) }).kind, 'conflict');
  }
  assert.equal(planSharingStart(phone, { ...row, driver_id: 'driver-2' }).kind, 'invalid');
});

test('a confirmed local choice still publishes against the server revision and stops on a later conflict', async () => {
  const plan = planSharingStart(phone, row, choose('phone'));
  assert.equal(plan.kind, 'ready');
  if (plan.kind !== 'ready') return;
  let attempts = 0; let errors = 0;
  const publisher = new SharedPublisher(async (snapshot, revision) => {
    attempts++;
    assert.equal(snapshot.passengers, 2);
    assert.equal(revision, 7);
    throw new Error('Another phone wrote revision 8');
  }, () => assert.fail('No save'), () => errors++, () => now);
  publisher.start(phone.id, row); publisher.queue(plan.driver);
  await publisher.flush(); await publisher.flush();
  assert.equal(attempts, 1); assert.equal(errors, 1);
});

test('both languages show the two counts and explicit source choices', () => {
  for (const isAr of [true, false]) {
    const html = renderToStaticMarkup(<SharingConflictPanel conflict={{local: phone, published: row}} isAr={isAr} onResolve={() => {}} />);
    assert.ok(html.includes('2 / 7')); assert.ok(html.includes('5 / 7'));
    assert.ok(html.includes(isAr ? 'استخدم بيانات هذا الهاتف' : 'Use this phone’s settings'));
    assert.ok(html.includes(isAr ? 'استخدم البيانات المنشورة' : 'Use published settings'));
  }
});
