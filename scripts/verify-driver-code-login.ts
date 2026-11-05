// Tests real login/restore/logout without uploading locations or printing secrets.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sharedBackend } from '../src/config/sharedBackend';
const privateFile = resolve('..', 'outputs', 'private-transit', 'driver-access-codes.json');
const { drivers } = JSON.parse(await readFile(privateFile, 'utf8'));
const endpoint = `${sharedBackend.url}/functions/v1/driver-session`;
async function call(body: object, token?: string) {
  const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', apikey: sharedBackend.publishableKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, result: await response.json() as any };
}
for (const driver of drivers) {
  const login = await call({ action: 'login', driver_id: driver.driverId, code: driver.code });
  assert.equal(login.status, 200, `Login endpoint failed for ${driver.driverId}: ${login.result.error ?? 'unavailable'}`);
  assert.equal(login.result.driver_id, driver.driverId);
  const token = login.result.token;
  assert.match(token, /^[a-f0-9]{64}$/);
  const restored = await call({ action: 'restore' }, token);
  assert.equal(restored.result.driver_id, driver.driverId);
  assert.equal(restored.result.token, undefined);
  assert.equal((await call({ action: 'logout' }, token)).result.ok, true);
  assert.equal((await call({ action: 'restore' }, token)).result.error, 'invalid_session');
  console.log(`Verified login, restore and revocation: ${driver.driverId}`);
}
console.log('All driver codes verified. No locations or bookings were published.');
