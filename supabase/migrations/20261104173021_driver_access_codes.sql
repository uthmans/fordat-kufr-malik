begin;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private_transit;
revoke all on schema private_transit from public, anon, authenticated;
grant usage on schema private_transit to service_role;

create table private_transit.driver_credentials (
  driver_id text primary key check (driver_id ~ '^driver-[1-8]$'),
  code_hash text not null,
  version integer not null default 1,
  enabled boolean not null default true,
  failed_attempts integer not null default 0,
  blocked_until timestamptz
);
create table private_transit.driver_sessions (
  token_hash text primary key,
  driver_id text not null references private_transit.driver_credentials(driver_id),
  credential_version integer not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index driver_sessions_driver_idx on private_transit.driver_sessions(driver_id, issued_at desc);
create index driver_sessions_expiry_idx on private_transit.driver_sessions(expires_at);
create table private_transit.login_limits (
  source_hash text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
alter table private_transit.driver_credentials enable row level security;
alter table private_transit.driver_sessions enable row level security;
alter table private_transit.login_limits enable row level security;
revoke all on all tables in schema private_transit from public, anon, authenticated;
grant all on all tables in schema private_transit to service_role;

-- Add a separate code-authenticated feed without changing existing tables or grants.
-- LIKE copies validation/column/index definitions, but does not copy foreign keys.
create table public.transit_driver_live (like public.transit_driver_feed including defaults including constraints including indexes);
alter table public.transit_driver_live enable row level security;
alter table public.transit_driver_live add constraint feed_known_driver check (driver_id ~ '^driver-[1-8]$');
alter table public.transit_driver_live add constraint off_duty_location_redacted check (
  (snapshot->>'isOnDuty')::boolean or
  (snapshot->>'gpsMode' = 'idle' and snapshot->'currentLocation' @> '{"lat":0,"lng":0,"timestamp":0}'::jsonb)
);
revoke all on public.transit_driver_live from anon, authenticated;
grant select on public.transit_driver_live to anon, authenticated;
grant all on public.transit_driver_live to service_role;
create policy "Visitors can read code-authenticated driver updates" on public.transit_driver_live
  for select to anon, authenticated using (true);
create trigger stamp_transit_driver_live before insert or update on public.transit_driver_live
  for each row execute function public.stamp_transit_driver_feed();
alter publication supabase_realtime add table public.transit_driver_live;

-- Invoker privileges: only the trusted Edge Function's service role can call it.
-- Never grant EXECUTE or private schema access to browser roles.
create function public.transit_driver_gateway(
  p_action text, p_driver_id text default null, p_code text default null,
  p_token text default null, p_source text default null,
  p_snapshot jsonb default null, p_revision bigint default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  credential private_transit.driver_credentials%rowtype;
  limiter private_transit.login_limits%rowtype;
  session_driver text;
  session_expiry timestamptz;
  session_hash text;
  raw_token text;
  updated public.transit_driver_live%rowtype;
  retry_seconds integer;
begin
  if p_action = 'login' then
    if p_driver_id is null or p_driver_id !~ '^driver-[1-8]$' or p_code is null or p_code !~ '^[0-9]{8}$'
      or p_source is null or p_source !~ '^[a-f0-9]{64}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_code');
    end if;
    delete from private_transit.login_limits where window_start < now() - interval '1 day';
    insert into private_transit.login_limits (source_hash, window_start, attempts) values (p_source, now(), 1)
      on conflict (source_hash) do update set
        window_start = case when private_transit.login_limits.window_start <= now() - interval '15 minutes' then now() else private_transit.login_limits.window_start end,
        attempts = case when private_transit.login_limits.window_start <= now() - interval '15 minutes' then 1 else private_transit.login_limits.attempts + 1 end
      returning * into limiter;
    if limiter.attempts > 30 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited', 'retry_after',
        greatest(1, ceil(extract(epoch from (limiter.window_start + interval '15 minutes' - now())))));
    end if;
    select * into credential from private_transit.driver_credentials where driver_id = p_driver_id for update;
    if not found or not credential.enabled then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
    if credential.blocked_until > now() then
      return jsonb_build_object('ok', false, 'error', 'rate_limited', 'retry_after',
        greatest(1, ceil(extract(epoch from (credential.blocked_until - now())))));
    end if;
    if credential.blocked_until is not null then credential.failed_attempts := 0; end if;
    if extensions.crypt(p_code, credential.code_hash) <> credential.code_hash then
      update private_transit.driver_credentials set failed_attempts = credential.failed_attempts + 1,
        blocked_until = case when credential.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
        where driver_id = p_driver_id;
      if credential.failed_attempts + 1 >= 5 then
        return jsonb_build_object('ok', false, 'error', 'rate_limited', 'retry_after', 900);
      end if;
      return jsonb_build_object('ok', false, 'error', 'invalid_code');
    end if;
    update private_transit.driver_credentials set failed_attempts = 0, blocked_until = null where driver_id = p_driver_id;
    delete from private_transit.driver_sessions where expires_at < now() - interval '1 day';
    raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    session_expiry := now() + interval '90 days';
    insert into private_transit.driver_sessions (token_hash, driver_id, credential_version, expires_at)
      values (encode(extensions.digest(raw_token, 'sha256'), 'hex'), p_driver_id, credential.version, session_expiry);
    update private_transit.driver_sessions set revoked_at = now() where token_hash in (
      select token_hash from private_transit.driver_sessions where driver_id = p_driver_id and revoked_at is null
      order by issued_at desc, token_hash offset 10
    );
    return jsonb_build_object('ok', true, 'driver_id', p_driver_id, 'token', raw_token, 'expires_at', session_expiry);
  end if;

  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  session_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select sessions.driver_id, sessions.expires_at into session_driver, session_expiry
    from private_transit.driver_sessions sessions join private_transit.driver_credentials codes on codes.driver_id = sessions.driver_id
    where sessions.token_hash = session_hash and sessions.revoked_at is null and sessions.expires_at > now()
      and codes.enabled and codes.version = sessions.credential_version
    for update of sessions for share of codes;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if p_action = 'restore' then
    return jsonb_build_object('ok', true, 'driver_id', session_driver, 'expires_at', session_expiry);
  elsif p_action = 'logout' then
    update private_transit.driver_sessions set revoked_at = now() where token_hash = session_hash;
    return jsonb_build_object('ok', true);
  elsif p_action = 'publish' then
    if p_driver_id is distinct from session_driver or p_snapshot->>'id' is distinct from session_driver then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
    if p_revision is null then
      begin
        insert into public.transit_driver_live (driver_id, snapshot) values (session_driver, p_snapshot) returning * into updated;
      exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'conflict'); end;
    else
      update public.transit_driver_live set snapshot = p_snapshot where driver_id = session_driver and revision = p_revision returning * into updated;
      if not found then return jsonb_build_object('ok', false, 'error', 'conflict'); end if;
    end if;
    return jsonb_build_object('ok', true, 'row', to_jsonb(updated));
  end if;
  return jsonb_build_object('ok', false, 'error', 'invalid_request');
end;
$$;
revoke all on function public.transit_driver_gateway(text,text,text,text,text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.transit_driver_gateway(text,text,text,text,text,jsonb,bigint) to service_role;
commit;
