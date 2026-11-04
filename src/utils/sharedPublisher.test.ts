import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DRIVERS } from '../data/initialDrivers';
import { SharedPublisher, publishableDriver } from './sharedPublisher';
import { type PublicDriver, type SharedDriverRow } from './sharedDriver';

const now = 1_800_000_000_000;
const live = (patch = {}) => ({ ...INITIAL_DRIVERS[0], gpsMode: 'live' as const,
  currentLocation: { lat: 31.984, lng: 35.3115, timestamp: now }, ...patch });
const saved = (snapshot: PublicDriver, revision = 1): SharedDriverRow => ({
  driver_id: snapshot.id, revision, snapshot, received_at: new Date(now).toISOString()
});

test('simulation and stale or future on-duty GPS never become shared live updates', () => {
  assert.equal(publishableDriver({ ...live(), gpsMode: 'simulation' }, now), null);
  assert.equal(publishableDriver({ ...live(), gpsMode: 'idle' }, now), null);
  for (const timestamp of [now - 120_000, now + 1]) {
    assert.equal(publishableDriver(live({ currentLocation: { ...live().currentLocation, timestamp } }), now), null);
  }
  assert.ok(publishableDriver(live(), now));
});

test('off-duty publishing removes the precise location without mutating local GPS', () => {
  const driver = live({ isOnDuty: false });
  const snapshot = publishableDriver(driver, now)!;
  assert.deepEqual(snapshot.currentLocation, { lat: 0, lng: 0, timestamp: 0 });
  assert.equal(snapshot.gpsMode, 'idle');
  assert.equal(driver.currentLocation.lat, 31.984);
  assert.equal(Object.hasOwn(snapshot, 'pinCode'), false);
});

test('GPS updates are capped at one per minute, using the latest queued fix', async () => {
  let clock = now;
  const sends: PublicDriver[] = [];
  const publisher = new SharedPublisher(async snapshot => {
    sends.push(snapshot); return saved(snapshot, sends.length);
  }, () => {}, error => { throw error; }, () => clock);
  publisher.start('driver-1', null);
  publisher.queue(live()); await publisher.flush();
  clock += 1000;
  publisher.queue(live({ currentLocation: { lat: 31.99, lng: 35.31, timestamp: clock } }));
  await publisher.flush();
  assert.equal(sends.length, 1);
  clock += 59_000;
  publisher.queue(live({ currentLocation: { lat: 31.98, lng: 35.3, timestamp: clock } }));
  await publisher.flush();
  assert.equal(sends.length, 2);
  assert.equal(sends[1].currentLocation.lng, 35.3);
});

test('seat and duty changes publish promptly even inside the GPS interval', async () => {
  const sends: PublicDriver[] = [];
  const revisions: (number | null)[] = [];
  const publisher = new SharedPublisher(async (snapshot, revision) => {
    sends.push(snapshot); revisions.push(revision); return saved(snapshot, (revision ?? 0) + 1);
  }, () => {}, error => { throw error; }, () => now);
  publisher.start('driver-1', null);
  for (const driver of [live(), live({ passengers: 5 }), live({ passengers: 5, isOnDuty: false })]) {
    publisher.queue(driver); await publisher.flush();
  }
  assert.equal(sends.length, 3);
  assert.deepEqual(revisions, [null, 1, 2]);
  assert.equal(sends[2].isOnDuty, false);
});

test('unchanged data is not uploaded repeatedly and wrong driver IDs are ignored', async () => {
  let calls = 0;
  const driver = live();
  const publisher = new SharedPublisher(async snapshot => { calls++; return saved(snapshot); }, () => {}, () => {}, () => now);
  publisher.start('driver-1', saved(publishableDriver(driver, now)!, 5));
  publisher.queue(driver); await publisher.flush();
  publisher.queue({ ...driver, id: 'driver-2' }); await publisher.flush();
  assert.equal(calls, 0);
});

test('server JSONB key ordering does not turn unchanged state into another upload', async () => {
  const snapshot = publishableDriver(live(), now)!;
  const reordered = Object.fromEntries(Object.entries(snapshot).reverse()) as PublicDriver;
  reordered.currentLocation = Object.fromEntries(Object.entries(snapshot.currentLocation).reverse()) as unknown as PublicDriver['currentLocation'];
  let calls = 0;
  const publisher = new SharedPublisher(async incoming => { calls++; return saved(incoming); }, () => {}, () => {}, () => now);
  publisher.start('driver-1', saved(reordered));
  publisher.queue(live()); await publisher.flush();
  assert.equal(calls, 0);
});

test('stop cancels a pending request and ignores its late result after a driver switch', async () => {
  let resolve: (row: SharedDriverRow) => void = () => {};
  let signal: AbortSignal | undefined;
  const received: SharedDriverRow[] = [];
  const publisher = new SharedPublisher((_, __, abortSignal) => {
    signal = abortSignal; return new Promise(done => { resolve = done; });
  }, row => received.push(row), () => {}, () => now);
  publisher.start('driver-1', null);
  publisher.queue(live()); const request = publisher.flush();
  publisher.stop();
  assert.equal(signal?.aborted, true);
  publisher.start('driver-2', null);
  resolve(saved(publishableDriver(live(), now)!)); await request;
  assert.equal(received.length, 0);
});

test('in-flight changes stay queued and use the acknowledged revision on the next save', async () => {
  let resolve: (row: SharedDriverRow) => void = () => {};
  const calls: { snapshot: PublicDriver; revision: number | null }[] = [];
  const publisher = new SharedPublisher((snapshot, revision) => {
    calls.push({ snapshot, revision });
    if (calls.length === 1) return new Promise(done => { resolve = done; });
    return Promise.resolve(saved(snapshot, 2));
  }, () => {}, () => {}, () => now);
  publisher.start('driver-1', null); publisher.queue(live());
  const request = publisher.flush();
  publisher.queue(live({ passengers: 6 })); await publisher.flush();
  assert.equal(calls.length, 1);
  resolve(saved(calls[0].snapshot)); await request; await publisher.flush();
  assert.equal(calls[1].snapshot.passengers, 6);
  assert.equal(calls[1].revision, 1);
});

test('a failed or conflicting save stops publishing and cannot replay old state automatically', async () => {
  let calls = 0; let errors = 0;
  const publisher = new SharedPublisher(async () => { calls++; throw new Error('conflict'); }, () => {}, () => { errors++; }, () => now);
  publisher.start('driver-1', null); publisher.queue(live()); await publisher.flush();
  publisher.queue(live({ passengers: 6 })); await publisher.flush();
  assert.equal(calls, 1); assert.equal(errors, 1);
});
