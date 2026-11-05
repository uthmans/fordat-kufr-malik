// @ts-nocheck -- Supabase's Deno runtime type-checks this entry point at deployment.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { driverSessionHandler } from './handler.ts';

const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const url = Deno.env.get('SUPABASE_URL');
if (!key || !url) throw new Error('Server configuration missing');
const database = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(driverSessionHandler(parameters => database.rpc('transit_driver_gateway', parameters), async source => {
  const bytes = new TextEncoder().encode(`${key}:${source}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}, parameters => database.rpc('transit_admin_gateway', parameters)));
