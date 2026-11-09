// @ts-nocheck -- Deno checks the pinned runtime imports during deployment.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import * as webauthn from 'npm:@simplewebauthn/server@13.2.2';
import { driverSecurityHandler } from './handler.ts';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const url=Deno.env.get('SUPABASE_URL');
if(!key || !url) throw Error('Server configuration missing');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(driverSecurityHandler(parameters=>db.rpc('transit_driver_security',parameters),webauthn,async value=>{
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${key}:${value}`));
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}));
