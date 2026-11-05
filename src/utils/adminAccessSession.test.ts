import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdminAccessSession, ADMIN_SESSION_KEY } from './adminAccessSession';
const token='c'.repeat(64);
const expiry=()=>new Date(Date.now()+86400000).toISOString();
const success=()=>({ok:true,role:'admin',token,expires_at:expiry()});
function fixture(reply: (body:any)=>any=()=>success()) {
  const data=new Map<string,string>(); const calls:any[]=[];
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
  const fetcher=(async (_:unknown,init:RequestInit)=>{const body=JSON.parse(init.body as string);calls.push(body);return Response.json(await reply(body));}) as typeof fetch;
  return {data,calls,storage,fetcher,client:new AdminAccessSession(()=>storage,fetcher)};
}
test('public demo PIN and driver codes cannot start an admin login request',async()=>{
  const f=fixture(); for(const code of ['9999','1234','83527491','invalid']) assert.equal(await f.client.login(code),false);
  assert.equal(f.calls.length,0);
});
test('admin verification requires the server admin role, a full token and future expiry',async()=>{
  for(const patch of [{role:'driver'},{token:'short'},{expires_at:'invalid'},{ok:false}]) {
    const f=fixture(()=>({...success(),...patch})); assert.equal(await f.client.login('123456789012'),false); assert.equal(f.client.read(),null);
  }
});
test('admin persistence saves a session, not the private code',async()=>{
  const f=fixture(); assert.equal(await f.client.login('123456789012'),true);
  assert.equal(f.data.get(ADMIN_SESSION_KEY)!.includes('123456789012'),false);
  const reopened=new AdminAccessSession(()=>f.storage,f.fetcher); assert.equal(await reopened.restore(),true);
  assert.equal(f.calls.at(-1).action,'admin_restore'); assert.equal(f.calls.at(-1).code,undefined);
});
test('legacy saved flags and forged driver-shaped identities are not admin sessions',()=>{
  const f=fixture(); f.data.set('kufr_malik_admin_auth_v6','true');
  assert.equal(f.client.read(),null);
  f.data.set(ADMIN_SESSION_KEY,JSON.stringify({driverId:'driver-1',token:'short',expiresAt:expiry()}));
  assert.equal(f.client.read(),null);
});
test('late login responses cannot restore admin access after logout',async()=>{
  let resolve:(value:any)=>void=()=>{};
  const f=fixture(()=>new Promise(done=>{resolve=done;}));
  const pending=f.client.login('123456789012'); await f.client.logout(); resolve(success());
  assert.equal(await pending,false); assert.equal(f.client.read(),null);
});
test('a revoked or unavailable session never authorizes admin',async()=>{
  let valid=true;
  const f=fixture(body=>body.action==='admin_restore'&&!valid?{ok:false,error:'invalid_session'}:success());
  await f.client.login('123456789012'); valid=false; assert.equal(await f.client.restore(),false); assert.equal(f.client.read(),null);
  const offline=new AdminAccessSession(()=>f.storage,(async()=>{throw new Error('offline');}) as typeof fetch);
  assert.equal(await offline.restore(),false);
});
