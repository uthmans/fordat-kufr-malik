import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DriverCodeSession, DRIVER_CODE_SESSION_KEY, normalizeDriverAccessCode } from './driverCodeSession';
import { toPublicDriver } from './sharedDriver';
import { INITIAL_DRIVERS } from '../data/initialDrivers';

const token = 'a'.repeat(64);
const expiry = () => new Date(Date.now() + 90 * 86400000).toISOString();
const success = () => ({ ok: true, driver_id: 'driver-1', token, expires_at: expiry() });
function fixture(reply: (body: any, init: RequestInit) => any = () => success()) {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const calls: any[] = [];
  const fetcher = (async (_: unknown, init: RequestInit) => {
    const body = JSON.parse(init.body as string); calls.push(body);
    return Response.json(await reply(body, init));
  }) as typeof fetch;
  return { data, storage, calls, fetcher, client: new DriverCodeSession(() => storage, fetcher) };
}

test('driver access code normalizes Arabic and Persian digits without dropping leading zeroes', () => {
  assert.equal(normalizeDriverAccessCode(' ٠۱۲٣٤۵٦٧ '), '01234567');
});
test('the default browser fetch keeps its required global receiver', async () => {
  const original = globalThis.fetch;
  const f = fixture();
  globalThis.fetch = (async function(this: unknown) {
    assert.equal(this, globalThis);
    return Response.json(success());
  }) as typeof fetch;
  try {
    const browserClient = new DriverCodeSession(() => f.storage);
    assert.equal((await browserClient.login('driver-1', '83527491')).ok, true);
  } finally { globalThis.fetch = original; }
});
test('legacy, malformed and unknown-driver codes are rejected without a network call', async () => {
  const f = fixture();
  for (const code of ['1234', '9999', '1234567x', '123456789']) assert.equal((await f.client.login('driver-1', code)).ok, false);
  assert.equal((await f.client.login('unknown', '12345678')).ok, false);
  assert.equal(f.calls.length, 0);
});
test('login stores only the opaque session, never the access code', async () => {
  const f = fixture();
  assert.equal((await f.client.login('driver-1', '83527491')).ok, true);
  const saved = f.data.get(DRIVER_CODE_SESSION_KEY)!;
  assert.equal(saved.includes('83527491'), false);
  assert.equal(JSON.parse(saved).token, token);
  assert.equal(f.client.remembered, true);
});
test('a new app instance restores the saved identity only after server validation', async () => {
  const f = fixture(body => body.action === 'restore' ? { ok: true, driver_id: 'driver-1', expires_at: expiry() } : success());
  await f.client.login('driver-1', '83527491');
  const reopened = new DriverCodeSession(() => f.storage, f.fetcher);
  assert.equal(await reopened.restore(), 'driver-1');
  assert.equal(f.calls.at(-1).action, 'restore');
  assert.equal(f.calls.at(-1).code, undefined);
});
test('an unavailable connection keeps a saved session retryable', async () => {
  const f = fixture(); await f.client.login('driver-1', '83527491');
  const offline = new DriverCodeSession(() => f.storage, (async () => { throw new Error('offline'); }) as typeof fetch);
  await assert.rejects(() => offline.restore());
  assert.ok(f.data.has(DRIVER_CODE_SESSION_KEY));
});
test('revoked sessions are removed, rather than accepted from the saved driver ID', async () => {
  const f = fixture(body => body.action === 'restore' ? { ok: false, error: 'invalid_session' } : success());
  await f.client.login('driver-1', '83527491');
  assert.equal(await f.client.restore(), null);
  assert.equal(f.data.has(DRIVER_CODE_SESSION_KEY), false);
});
test('server failures and rate limits produce distinct retryable errors', async () => {
  const f = fixture(() => ({ ok: false, error: 'rate_limited', retry_after: 900 }));
  assert.deepEqual(await f.client.login('driver-1', '83527491'), { ok: false, error: 'rate_limited', retryAfter: 900 });
  const unavailable = fixture(() => ({ ok: false, error: 'unavailable' }));
  assert.equal((await unavailable.client.login('driver-1', '83527491') as any).error, 'unavailable');
});
test('a wrong driver, expired session or malformed token cannot become a login', async () => {
  for (const patch of [{ driver_id: 'driver-2' }, { token: 'short' }, { expires_at: 'invalid' }, { expires_at: '2000-01-01T00:00:00Z' }]) {
    const f = fixture(() => ({ ...success(), ...patch }));
    assert.equal((await f.client.login('driver-1', '83527491')).ok, false);
    assert.equal(f.client.read(), null);
  }
});
test('logout clears the session immediately even while server revocation is pending', async () => {
  let resolve: (value: any) => void = () => {};
  const f = fixture(body => body.action === 'logout' ? new Promise(done => { resolve = done; }) : success());
  await f.client.login('driver-1', '83527491');
  const pending = f.client.logout();
  assert.equal(f.client.read(), null);
  resolve({ ok: true }); assert.equal(await pending, true);
});
test('a login response arriving after logout cannot restore a logged-out driver', async () => {
  let resolve: (value: any) => void = () => {};
  const f = fixture(() => new Promise(done => { resolve = done; }));
  const pending = f.client.login('driver-1', '83527491');
  await f.client.logout(); resolve(success());
  assert.equal((await pending).ok, false);
  assert.equal(f.client.read(), null);
});
test('blocked persistence keeps this launch signed in without claiming Remember Me was saved', async () => {
  const f = fixture();
  const blocked = new DriverCodeSession(() => ({ ...f.storage, setItem() { throw new Error('quota'); } }), f.fetcher);
  assert.equal((await blocked.login('driver-1', '83527491')).ok, true);
  assert.equal(blocked.read()?.driverId, 'driver-1');
  assert.equal(blocked.remembered, false);
  assert.equal(await blocked.restore(), 'driver-1');
  assert.equal(blocked.remembered, false);
});
test('read-only persistent storage cannot make a logged-out session active again in this app instance', async () => {
  const f = fixture(); await f.client.login('driver-1', '83527491');
  const readonly = new DriverCodeSession(() => ({ ...f.storage, removeItem() { throw new Error('readonly'); } }), f.fetcher);
  await readonly.logout();
  assert.equal(readonly.read(), null);
});
test('a driver cannot publish another profile and publication sends no code', async () => {
  const f = fixture(body => body.action === 'publish' ? { ok: true, row: { driver_id: 'driver-1', revision: 1,
    received_at: new Date().toISOString(), snapshot: body.snapshot } } : success());
  await f.client.login('driver-1', '83527491');
  const abort = new AbortController();
  await assert.rejects(() => f.client.publish(toPublicDriver(INITIAL_DRIVERS[1]), null, abort.signal));
  const row = await f.client.publish(toPublicDriver(INITIAL_DRIVERS[0]), null, abort.signal);
  assert.equal(row.driver_id, 'driver-1');
  assert.equal(f.calls.at(-1).code, undefined);
});
test('damaged stored identities are ignored', () => {
  const f = fixture();
  for (const value of ['broken', '{}', JSON.stringify({ driverId: 'driver-1', token, expiresAt: 'invalid' })]) {
    f.data.set(DRIVER_CODE_SESSION_KEY, value); assert.equal(f.client.read(), null);
  }
});
