import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driverSessionHandler } from '../../supabase/functions/driver-session/handler';

const request = (body: unknown, origin = 'https://uthmans.github.io', token?: string) => new Request('https://test.invalid/driver-session', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
});
test('gateway validates origin and rejects unsupported actions before database calls', async () => {
  let calls = 0;
  const handler = driverSessionHandler(async () => { calls++; return { data: { ok: true }, error: null }; }, async () => 'a'.repeat(64));
  assert.equal((await handler(request({ action: 'login' }, 'https://attacker.invalid'))).status, 403);
  assert.equal((await handler(request({ action: 'admin' }))).status, 400);
  assert.equal((await handler(request({ action: 'restore' }))).status, 401);
  assert.equal(calls, 0);
});
test('login passes a source hash to the private gateway and responses cannot be cached', async () => {
  let parameters: any;
  const handler = driverSessionHandler(async input => { parameters = input; return { data: { ok: true }, error: null }; }, async () => 'a'.repeat(64));
  const response = await handler(request({ action: 'login', driver_id: 'driver-1', code: '83527491' }));
  assert.equal(response.status, 200);
  assert.equal(parameters.p_source, 'a'.repeat(64));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('rate limits return Retry-After and database details stay private', async () => {
  const limited = driverSessionHandler(async () => ({ data: { ok: false, error: 'rate_limited', retry_after: 900 }, error: null }), async () => 'a'.repeat(64));
  const response = await limited(request({ action: 'login', driver_id: 'driver-1', code: '83527491' }));
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '900');
  const failure = driverSessionHandler(async () => ({ data: null, error: 'private database details' }), async () => 'a'.repeat(64));
  const failed = await failure(request({ action: 'restore' }, undefined, 'a'.repeat(64)));
  assert.equal(failed.status, 503); assert.equal((await failed.text()).includes('private database'), false);
});
test('publication requires an opaque session and a valid revision', async () => {
  let calls = 0;
  const handler = driverSessionHandler(async () => { calls++; return { data: { ok: true }, error: null }; }, async () => 'a'.repeat(64));
  assert.equal((await handler(request({ action: 'publish', driver_id: 'driver-1', snapshot: {}, revision: 0 }, undefined, 'a'.repeat(64)))).status, 400);
  assert.equal((await handler(request({ action: 'publish', driver_id: 'driver-1', snapshot: {}, revision: null }, undefined, 'short'))).status, 401);
  assert.equal(calls, 0);
});
test('admin actions use a separate gateway and never reach driver publication',async()=>{
  let driverCalls=0; let adminParameters:any;
  const handler=driverSessionHandler(async()=>{driverCalls++;return {data:{ok:true},error:null};},async()=> 'a'.repeat(64),
    async input=>{adminParameters=input;return {data:{ok:true,role:'admin'},error:null};});
  assert.equal((await handler(request({action:'admin_login',code:'9999'}))).status,401);
  assert.equal((await handler(request({action:'admin_login',code:'123456789012'}))).status,200);
  assert.equal(adminParameters.p_action,'login'); assert.equal(driverCalls,0);
  assert.equal((await handler(request({action:'admin_publish'},undefined,'a'.repeat(64)))).status,400);
});
