import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as webauthn from '@simplewebauthn/server';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { driverSecurityHandler, encodeBytes, decodeBytes } from '../../supabase/functions/driver-security/handler';
import { DriverCodeSession, DRIVER_CODE_SESSION_KEY } from './driverCodeSession';

const origin='https://uthmans.github.io';
const token='a'.repeat(64);
const concat=(...arrays:Uint8Array[])=>new Uint8Array(arrays.flatMap(array=>Array.from(array)));
const hash=async(bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)));
const jsonBytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value));
function der(signature:Uint8Array){
  const integer=(bytes:Uint8Array)=>{let array=Array.from(bytes);while(array.length>1&&array[0]===0)array.shift();if(array[0]&128)array.unshift(0);return [2,array.length,...array];};
  const r=integer(signature.slice(0,32)),s=integer(signature.slice(32));return new Uint8Array([48,r.length+s.length,...r,...s]);
}

test('real WebAuthn verification accepts signed user-verified keys and rejects replay, wrong origin and missing verification',async()=>{
  const challenges=new Map<string,any>();let stored:any;let issued=0;let sequence=0;
  const handler=driverSecurityHandler(async p=>{
    const data=p.p_data as any;
    if(String(p.p_action).startsWith('begin_')){
      const id=String(++sequence);challenges.set(id,{...data,used:false});
      return {data:{ok:true,driver_id:'driver-1',challenge_id:id,keys:stored?[stored]:[]},error:null};
    }
    const challenge=challenges.get(data.challenge_id);
    if(String(p.p_action).startsWith('take_')){
      if(!challenge||challenge.used)return {data:{ok:false,error:'invalid_challenge'},error:null};
      challenge.used=true;return {data:{ok:true,driver_id:'driver-1',...challenge,keys:stored?[stored]:[]},error:null};
    }
    if(p.p_action==='finish_register'){
      stored={id:data.credential_id,publicKey:data.public_key,counter:data.counter,transports:data.transports};
      return {data:{ok:true},error:null};
    }
    if(p.p_action==='finish_login'){
      issued++;stored.counter=data.counter;return {data:{ok:true,driver_id:'driver-1',token,expires_at:new Date(Date.now()+86400000).toISOString()},error:null};
    }
    throw Error('Unexpected RPC');
  },webauthn,async()=> 'b'.repeat(64));
  const call=async(body:any,site=origin)=>{
    const response=await handler(new Request('https://example.test',{method:'POST',headers:{Origin:site,Authorization:`Bearer ${token}`},body:JSON.stringify(body)}));
    return response.json() as Promise<any>;
  };
  const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',key.publicKey);
  const credentialId=crypto.getRandomValues(new Uint8Array(32));
  const cose=isoCBOR.encode(new Map<any,any>([[1,2],[3,-7],[-1,1],[-2,decodeBytes(jwk.x!)],[-3,decodeBytes(jwk.y!)]]));
  const rpHash=await hash(new TextEncoder().encode('uthmans.github.io'));
  const begin=await call({action:'register_begin',code:'12345678'});
  assert.equal(begin.options.authenticatorSelection.userVerification,'required');
  const authData=concat(rpHash,new Uint8Array([0x45,0,0,0,0]),new Uint8Array(16),new Uint8Array([0,32]),credentialId,cose);
  const attestation=isoCBOR.encode(new Map<any,any>([['fmt','none'],['authData',authData],['attStmt',new Map()]]));
  const registration={id:encodeBytes(credentialId),rawId:encodeBytes(credentialId),type:'public-key',clientExtensionResults:{},authenticatorAttachment:'platform',
    response:{clientDataJSON:encodeBytes(jsonBytes({type:'webauthn.create',challenge:begin.options.challenge,origin,crossOrigin:false})),attestationObject:encodeBytes(attestation),transports:['internal']}};
  assert.equal((await call({action:'register_finish',challenge_id:begin.challenge_id,response:registration})).ok,true);
  assert.ok(stored.publicKey);
  const signIn=async(flags=5,clientOrigin=origin)=>{
    const options=await call({action:'login_begin',driver_id:'driver-1'});
    const clientData=jsonBytes({type:'webauthn.get',challenge:options.options.challenge,origin:clientOrigin,crossOrigin:false});
    const authenticatorData=concat(rpHash,new Uint8Array([flags,0,0,0,stored.counter+1]));
    const signature=der(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,concat(authenticatorData,await hash(clientData)))));
    const body={action:'login_finish',challenge_id:options.challenge_id,response:{id:stored.id,rawId:stored.id,type:'public-key',clientExtensionResults:{},
      response:{clientDataJSON:encodeBytes(clientData),authenticatorData:encodeBytes(authenticatorData),signature:encodeBytes(signature),userHandle:encodeBytes(new TextEncoder().encode('driver-1'))}}};
    return {body,result:await call(body)};
  };
  const success=await signIn();assert.equal(success.result.ok,true);assert.equal(issued,1);
  assert.equal((await call(success.body)).ok,false);assert.equal(issued,1);
  assert.equal((await signIn(1)).result.ok,false);assert.equal(issued,1);
  assert.equal((await signIn(5,'https://attacker.example')).result.ok,false);assert.equal(issued,1);
  assert.equal((await call({action:'login_begin',driver_id:'driver-1'},'https://attacker.example')).ok,false);
});

function sessionSetup(){
  const data=new Map<string,string>();
  const storage={getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
  const requests:any[]=[];let respond=(body:any)=>({ok:true,driver_id:'driver-1',token,expires_at:new Date(Date.now()+86400000).toISOString()});
  const session=new DriverCodeSession(()=>storage,(async(_url,options)=>{const body=JSON.parse(String(options?.body));requests.push(body);return Response.json(respond(body));}) as typeof fetch);
  return {session,data,requests,setRespond:(fn:typeof respond)=>{respond=fn;}};
}
test('driver PIN change stores only a rotated opaque session and accepts six-digit Arabic PINs',async()=>{
  const s=sessionSetup();assert.equal((await s.session.login('driver-1','12345678')).ok,true);
  s.setRespond(()=>({ok:true,driver_id:'driver-1',token:'c'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString()}));
  assert.equal(await s.session.changePin('12345678','٦٥٤٣٢١'),null);
  assert.equal(s.requests.at(-1).new_code,'654321');
  assert.equal(s.session.read()?.token,'c'.repeat(64));
  assert.ok(!s.data.get(DRIVER_CODE_SESSION_KEY)!.includes('654321'));
  assert.equal((await s.session.login('driver-1','654321')).ok,true);
});
test('device login validates the returned driver and cannot resume after cancellation/logout',async()=>{
  const s=sessionSetup();
  s.setRespond(body=>body.action==='login_begin'?{ok:true,options:{challenge:'test'},challenge_id:'test'} as any:
    {ok:true,driver_id:'driver-2',token,expires_at:new Date(Date.now()+86400000).toISOString()});
  assert.equal((await s.session.deviceLogin('driver-1',async()=>({}))).ok,false);
  assert.equal(s.session.read(),null);
  s.setRespond(()=>({ok:true,options:{},challenge_id:'test'}) as any);
  assert.equal((await s.session.deviceLogin('driver-1',async()=>{await s.session.logout();return {};})).ok,false);
  assert.ok(!s.requests.some(body=>body.action==='login_finish'&&s.requests.indexOf(body)>1));
});
