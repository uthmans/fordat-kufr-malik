import type * as WebAuthn from '@simplewebauthn/server';
type Verifier = Pick<typeof WebAuthn, 'generateRegistrationOptions' | 'generateAuthenticationOptions' | 'verifyRegistrationResponse' | 'verifyAuthenticationResponse'>;
type Gateway = (parameters: Record<string, unknown>) => Promise<{ data: any; error: unknown }>;
export const encodeBytes = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const decodeBytes = (text: string) => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')), ch => ch.charCodeAt(0));
const allowed = (origin: string) => origin === 'https://uthmans.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

export function driverSecurityHandler(gateway: Gateway, webauthn: Verifier, sourceHash: (value: string) => Promise<string>) {
  return async (request: Request) => {
    const origin = request.headers.get('Origin') || '';
    const headers: Record<string,string> = { 'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
      'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type' };
    const reply = (data: any, status = data?.ok ? 200 : data?.error === 'rate_limited' ? 429 : 401) => new Response(JSON.stringify(data),{status,headers});
    if (origin && !allowed(origin)) return reply({ok:false,error:'invalid_origin'},403);
    if (origin) headers['Access-Control-Allow-Origin']=origin;
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if (request.method!=='POST') return reply({ok:false,error:'invalid_request'},405);
    try {
      const text = await request.text();
      if (text.length>65536) return reply({ok:false,error:'invalid_request'},413);
      const body=JSON.parse(text);
      if (!body || !['change_pin','status','remove_passkeys','register_begin','register_finish','login_begin','login_finish'].includes(body.action)) return reply({ok:false,error:'invalid_request'},400);
      const token=request.headers.get('Authorization')?.replace(/^Bearer /,'') || null;
      if (!body.action.startsWith('login_') && (!token || !/^[a-f0-9]{64}$/.test(token))) return reply({ok:false,error:'invalid_session'});
      const source = await sourceHash('security:'+(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'));
      const rpc=async (action: string,data: Record<string,unknown>={}) => {
        const result=await gateway({p_action:action,p_token:token,p_driver_id:body.driver_id ?? null,
          p_code:typeof body.code==='string'?body.code:null,p_new_code:typeof body.new_code==='string'?body.new_code:null,p_data:data,p_source:source});
        if(result.error || !result.data) throw Error('Backend unavailable');
        return result.data;
      };
      if (['change_pin','status','remove_passkeys'].includes(body.action)) {
        if(body.action==='change_pin' && !/^\d{6,8}$/.test(body.new_code || '')) return reply({ok:false,error:'invalid_code'});
        return reply(await rpc(body.action));
      }
      if (!origin || !allowed(origin) || new URL(origin).hostname==='127.0.0.1') return reply({ok:false,error:'unsupported_origin'},400);
      const rpID=new URL(origin).hostname;
      const register=body.action.startsWith('register_');
      if (body.action.endsWith('_begin')) {
        if (!register && !/^driver-[1-8]$/.test(body.driver_id || '')) return reply({ok:false,error:'invalid_request'},400);
        const challenge=encodeBytes(crypto.getRandomValues(new Uint8Array(32)));
        const result=await rpc(register?'begin_register':'begin_login',{challenge,origin});
        if(!result.ok) return reply(result);
        const ids=result.keys.map((key: any)=>({id:key.id,transports:key.transports}));
        const options=register ? await webauthn.generateRegistrationOptions({rpName:'Kufr Malik Transit',rpID,
          userName:result.driver_id,userDisplayName:`Kufr Malik Transit ${result.driver_id}`,userID:new TextEncoder().encode(result.driver_id),
          challenge:decodeBytes(challenge),attestationType:'none',excludeCredentials:ids,
          authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'required',userVerification:'required'},
          supportedAlgorithmIDs:[-7,-257],timeout:60000})
          : await webauthn.generateAuthenticationOptions({rpID,challenge:decodeBytes(challenge),allowCredentials:ids,userVerification:'required',timeout:60000});
        return reply({ok:true,challenge_id:result.challenge_id,options});
      }
      if(typeof body.challenge_id!=='string' || !body.response || typeof body.response.id!=='string') return reply({ok:false,error:'invalid_request'},400);
      const result=await rpc(register?'take_register':'take_login',{challenge_id:body.challenge_id});
      if(!result.ok) return reply(result);
      if(result.origin!==origin) return reply({ok:false,error:'invalid_origin'},403);
      if(register) {
        const verified=await webauthn.verifyRegistrationResponse({response:body.response,expectedChallenge:result.challenge,
          expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});
        if(!verified.verified || !verified.registrationInfo.userVerified) return reply({ok:false,error:'verification_failed'});
        const credential=verified.registrationInfo.credential;
        const transports=(credential.transports || []).filter(value=>['internal','hybrid','usb','nfc','ble','smart-card'].includes(value));
        return reply(await rpc('finish_register',{challenge_id:body.challenge_id,credential_id:credential.id,
          public_key:encodeBytes(credential.publicKey),counter:credential.counter,transports}));
      }
      const stored=result.keys.find((key: any)=>key.id===body.response.id);
      if(!stored) return reply({ok:false,error:'verification_failed'});
      const verified=await webauthn.verifyAuthenticationResponse({response:body.response,expectedChallenge:result.challenge,
        expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,
        credential:{id:stored.id,publicKey:decodeBytes(stored.publicKey),counter:stored.counter,transports:stored.transports}});
      if(!verified.verified || !verified.authenticationInfo.userVerified) return reply({ok:false,error:'verification_failed'});
      return reply(await rpc('finish_login',{challenge_id:body.challenge_id,credential_id:stored.id,
        expected_counter:stored.counter,counter:verified.authenticationInfo.newCounter}));
    } catch { return reply({ok:false,error:'unavailable'},503); }
  };
}
