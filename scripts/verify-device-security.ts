// Read-only deployed checks. Never changes a real PIN or registers a device key.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DriverCodeSession } from '../src/utils/driverCodeSession';
import { sharedBackend } from '../src/config/sharedBackend';
const handover=JSON.parse(await readFile('../outputs/private-transit/driver-access-codes.json','utf8'));
const driver=handover.drivers[0];
const values=new Map<string,string>();
const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
const fetcher:typeof fetch=(input,init)=>fetch(input,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),Origin:'https://uthmans.github.io'}});
const session=new DriverCodeSession(()=>storage,fetcher);
try {
  assert.equal((await session.login(driver.driverId,driver.code)).ok,true);
  assert.equal(await session.restore(),driver.driverId);
  const status=await fetcher(`${sharedBackend.url}/functions/v1/driver-security`,{method:'POST',headers:{Authorization:`Bearer ${session.read()!.token}`,'Content-Type':'application/json',apikey:sharedBackend.publishableKey},body:JSON.stringify({action:'status'})});
  assert.equal((await status.json()).ok,true);
  let checked=false;
  const result=await session.enrollDevice(driver.code,async options=>{
    assert.equal(options.rp.id,'uthmans.github.io');
    assert.equal(options.authenticatorSelection.userVerification,'required');
    assert.equal(options.authenticatorSelection.authenticatorAttachment,'platform');
    checked=true;
    throw new Error('Intentional cancellation; no key is registered');
  });
  assert.equal(checked,true);assert.equal(result,'cancelled');
  process.stdout.write('Deployed login, session restore, private security status and platform-key options passed. No PIN/key changed.\n');
} finally {assert.equal(await session.logout(),true);}
