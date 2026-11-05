begin;
create table private_transit.admin_credentials (
  id integer primary key check (id = 1), code_hash text not null,
  version integer not null default 1, failed_attempts integer not null default 0,
  blocked_until timestamptz, enabled boolean not null default true
);
create table private_transit.admin_sessions (
  token_hash text primary key, credential_version integer not null,
  expires_at timestamptz not null, revoked_at timestamptz
);
create index admin_sessions_expiry_idx on private_transit.admin_sessions(expires_at);
alter table private_transit.admin_credentials enable row level security;
alter table private_transit.admin_sessions enable row level security;
revoke all on private_transit.admin_credentials, private_transit.admin_sessions from public, anon, authenticated;
grant all on private_transit.admin_credentials, private_transit.admin_sessions to service_role;
create policy "Trusted admin gateway only" on private_transit.admin_credentials for all to service_role using (true) with check (true);
create policy "Trusted admin session gateway only" on private_transit.admin_sessions for all to service_role using (true) with check (true);

create function public.transit_admin_gateway(p_action text, p_code text default null,
  p_token text default null, p_source text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  credential private_transit.admin_credentials%rowtype;
  limiter private_transit.login_limits%rowtype;
  session private_transit.admin_sessions%rowtype;
  raw_token text;
begin
  if p_action = 'login' then
    if p_code is null or p_code !~ '^[0-9]{12}$' or p_source is null or p_source !~ '^[a-f0-9]{64}$' then
      return jsonb_build_object('ok',false,'error','invalid_code');
    end if;
    insert into private_transit.login_limits(source_hash,window_start,attempts) values(p_source,now(),1)
      on conflict(source_hash) do update set
        window_start=case when private_transit.login_limits.window_start <= now()-interval '15 minutes' then now() else private_transit.login_limits.window_start end,
        attempts=case when private_transit.login_limits.window_start <= now()-interval '15 minutes' then 1 else private_transit.login_limits.attempts+1 end
      returning * into limiter;
    if limiter.attempts > 10 then return jsonb_build_object('ok',false,'error','rate_limited','retry_after',900); end if;
    select * into credential from private_transit.admin_credentials where id=1 for update;
    if not found or not credential.enabled then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
    if credential.blocked_until > now() then return jsonb_build_object('ok',false,'error','rate_limited','retry_after',
      greatest(1,ceil(extract(epoch from(credential.blocked_until-now()))))); end if;
    if credential.blocked_until is not null then credential.failed_attempts:=0; end if;
    if extensions.crypt(p_code,credential.code_hash)<>credential.code_hash then
      update private_transit.admin_credentials set failed_attempts=credential.failed_attempts+1,
        blocked_until=case when credential.failed_attempts+1>=5 then now()+interval '15 minutes' else null end where id=1;
      return jsonb_build_object('ok',false,'error',case when credential.failed_attempts+1>=5 then 'rate_limited' else 'invalid_code' end,'retry_after',900);
    end if;
    update private_transit.admin_credentials set failed_attempts=0,blocked_until=null where id=1;
    delete from private_transit.admin_sessions where expires_at < now();
    raw_token:=encode(extensions.gen_random_bytes(32),'hex');
    insert into private_transit.admin_sessions(token_hash,credential_version,expires_at)
      values(encode(extensions.digest(raw_token,'sha256'),'hex'),credential.version,now()+interval '7 days');
    return jsonb_build_object('ok',true,'role','admin','token',raw_token,'expires_at',now()+interval '7 days');
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','invalid_session'); end if;
  select * into credential from private_transit.admin_credentials where id=1 and enabled for share;
  if not found then return jsonb_build_object('ok',false,'error','invalid_session'); end if;
  select * into session from private_transit.admin_sessions
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and revoked_at is null
      and expires_at>now() and credential_version=credential.version for update;
  if not found then return jsonb_build_object('ok',false,'error','invalid_session'); end if;
  if p_action='restore' then return jsonb_build_object('ok',true,'role','admin','expires_at',session.expires_at);
  elsif p_action='logout' then
    update private_transit.admin_sessions set revoked_at=now() where token_hash=session.token_hash;
    return jsonb_build_object('ok',true);
  end if;
  return jsonb_build_object('ok',false,'error','invalid_request');
end;
$$;
revoke all on function public.transit_admin_gateway(text,text,text,text) from public, anon, authenticated;
grant execute on function public.transit_admin_gateway(text,text,text,text) to service_role;
commit;
