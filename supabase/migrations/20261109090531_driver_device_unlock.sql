begin;
alter table private_transit.driver_sessions add column passkey_verified_at timestamptz;
create table private_transit.driver_passkeys (
  credential_id text primary key,
  driver_id text not null references private_transit.driver_credentials(driver_id),
  credential_version integer not null,
  public_key text not null,
  counter bigint not null check(counter >= 0),
  transports jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index driver_passkeys_owner_idx on private_transit.driver_passkeys(driver_id);
create table private_transit.driver_passkey_challenges (
  id uuid primary key default gen_random_uuid(), driver_id text not null references private_transit.driver_credentials(driver_id),
  credential_version integer not null, kind text not null check(kind in ('register','login')),
  challenge text not null, origin text not null, session_hash text, used boolean not null default false,
  expires_at timestamptz not null default now() + interval '5 minutes'
);
create index driver_passkey_challenges_expiry_idx on private_transit.driver_passkey_challenges(expires_at);
alter table private_transit.driver_passkeys enable row level security;
alter table private_transit.driver_passkey_challenges enable row level security;
revoke all on private_transit.driver_passkeys, private_transit.driver_passkey_challenges from public, anon, authenticated;
grant all on private_transit.driver_passkeys, private_transit.driver_passkey_challenges to service_role;
create policy service_driver_passkeys on private_transit.driver_passkeys to service_role using (true) with check (true);
create policy service_driver_challenges on private_transit.driver_passkey_challenges to service_role using (true) with check (true);

-- Keep existing 8-digit codes valid; new PINs can contain 6 to 8 digits.
do $patch$ declare definition text; begin
  definition := pg_get_functiondef('public.transit_driver_gateway(text,text,text,text,text,jsonb,bigint)'::regprocedure);
  if position('^[0-9]{8}$' in definition) = 0 then raise exception 'Unexpected driver gateway definition'; end if;
  execute replace(definition, '^[0-9]{8}$', '^[0-9]{6,8}$');
end $patch$;

create function public.transit_driver_security(
  p_action text, p_token text default null, p_driver_id text default null, p_code text default null,
  p_new_code text default null, p_data jsonb default '{}', p_source text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  credential private_transit.driver_credentials%rowtype;
  session_row private_transit.driver_sessions%rowtype;
  challenge_row private_transit.driver_passkey_challenges%rowtype;
  key_row private_transit.driver_passkeys%rowtype;
  limiter private_transit.login_limits%rowtype;
  owner_id text; session_hash text; raw_token text; expiry timestamptz; challenge_id uuid; keys jsonb;
begin
  if p_action not in ('begin_register','begin_login','take_register','take_login','finish_register','finish_login','change_pin','status','remove_passkeys') then
    return jsonb_build_object('ok',false,'error','invalid_request');
  end if;
  if p_action in ('begin_login','take_login','finish_login') then
    if p_action = 'begin_login' then owner_id := p_driver_id;
    else
      select driver_id into owner_id from private_transit.driver_passkey_challenges where id=(p_data->>'challenge_id')::uuid;
    end if;
  else
    if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','invalid_session'); end if;
    session_hash := encode(extensions.digest(p_token,'sha256'),'hex');
    select * into session_row from private_transit.driver_sessions where token_hash=session_hash and revoked_at is null and expires_at>now() for share;
    if not found then return jsonb_build_object('ok',false,'error','invalid_session'); end if;
    owner_id := session_row.driver_id;
  end if;
  select * into credential from private_transit.driver_credentials where driver_id=owner_id and enabled for update;
  if not found then return jsonb_build_object('ok',false,'error','invalid_session'); end if;
  if session_hash is not null and credential.version<>session_row.credential_version then return jsonb_build_object('ok',false,'error','invalid_session'); end if;

  if p_action in ('begin_login','begin_register','change_pin') then
    if p_source is null or p_source !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
    insert into private_transit.login_limits(source_hash,window_start,attempts) values(p_source,now(),1)
      on conflict(source_hash) do update set
        attempts=case when private_transit.login_limits.window_start<now()-interval '15 minutes' then 1 else private_transit.login_limits.attempts+1 end,
        window_start=case when private_transit.login_limits.window_start<now()-interval '15 minutes' then now() else private_transit.login_limits.window_start end returning * into limiter;
    if limiter.attempts>60 then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
  end if;
  if p_action in ('begin_register','change_pin') and (session_row.passkey_verified_at is null or session_row.passkey_verified_at<now()-interval '5 minutes') then
    if credential.blocked_until>now() then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
    if credential.blocked_until is not null then credential.failed_attempts:=0; end if;
    if p_code is null or p_code !~ '^[0-9]{6,8}$' or extensions.crypt(p_code,credential.code_hash)<>credential.code_hash then
      update private_transit.driver_credentials set failed_attempts=credential.failed_attempts+1,
        blocked_until=case when credential.failed_attempts+1>=5 then now()+interval '15 minutes' else null end where driver_id=owner_id;
      return jsonb_build_object('ok',false,'error',case when credential.failed_attempts+1>=5 then 'rate_limited' else 'invalid_code' end);
    end if;
    update private_transit.driver_credentials set failed_attempts=0,blocked_until=null where driver_id=owner_id;
  end if;
  if p_action='change_pin' then
    if p_new_code is null or p_new_code !~ '^[0-9]{6,8}$' then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
    update private_transit.driver_credentials set code_hash=extensions.crypt(p_new_code,extensions.gen_salt('bf',10)), version=version+1,
      failed_attempts=0,blocked_until=null where driver_id=owner_id;
    update private_transit.driver_passkeys set credential_version=credential.version+1 where driver_id=owner_id and credential_version=credential.version;
    -- The version increment immediately invalidates every older session.
    delete from private_transit.driver_passkey_challenges where driver_id=owner_id;
    raw_token:=encode(extensions.gen_random_bytes(32),'hex'); expiry:=now()+interval '90 days';
    insert into private_transit.driver_sessions(token_hash,driver_id,credential_version,expires_at)
      values(encode(extensions.digest(raw_token,'sha256'),'hex'),owner_id,credential.version+1,expiry);
    return jsonb_build_object('ok',true,'driver_id',owner_id,'token',raw_token,'expires_at',expiry);
  elsif p_action='status' then
    return jsonb_build_object('ok',true,'passkeys',(select count(*) from private_transit.driver_passkeys where driver_id=owner_id and credential_version=credential.version));
  elsif p_action='remove_passkeys' then
    delete from private_transit.driver_passkeys where driver_id=owner_id;
    delete from private_transit.driver_passkey_challenges where driver_id=owner_id;
    return jsonb_build_object('ok',true);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',credential_id,'publicKey',public_key,'counter',counter,'transports',transports)),'[]') into keys
    from private_transit.driver_passkeys where driver_id=owner_id and credential_version=credential.version;
  if p_action in ('begin_register','begin_login') then
    if p_action='begin_login' and jsonb_array_length(keys)=0 then return jsonb_build_object('ok',false,'error','not_enrolled'); end if;
    if p_action='begin_register' and jsonb_array_length(keys)>=8 then return jsonb_build_object('ok',false,'error','key_limit'); end if;
    if p_data->>'challenge' is null or p_data->>'origin' is null then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
    delete from private_transit.driver_passkey_challenges where expires_at<now();
    if (select count(*) from private_transit.driver_passkey_challenges where driver_id=owner_id)>30 then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
    insert into private_transit.driver_passkey_challenges(driver_id,credential_version,kind,challenge,origin,session_hash)
      values(owner_id,credential.version,case when p_action='begin_register' then 'register' else 'login' end,p_data->>'challenge',p_data->>'origin',session_hash) returning id into challenge_id;
    return jsonb_build_object('ok',true,'driver_id',owner_id,'challenge_id',challenge_id,'keys',keys);
  end if;
  select * into challenge_row from private_transit.driver_passkey_challenges where id=(p_data->>'challenge_id')::uuid for update;
  if not found or challenge_row.driver_id<>owner_id or challenge_row.credential_version<>credential.version or challenge_row.expires_at<=now()
    or challenge_row.kind<>(case when p_action like '%register' then 'register' else 'login' end)
    or (challenge_row.kind='register' and challenge_row.session_hash is distinct from session_hash) then
    return jsonb_build_object('ok',false,'error','invalid_challenge');
  end if;
  if p_action in ('take_register','take_login') then
    if challenge_row.used then return jsonb_build_object('ok',false,'error','invalid_challenge'); end if;
    update private_transit.driver_passkey_challenges set used=true where id=challenge_row.id;
    return jsonb_build_object('ok',true,'driver_id',owner_id,'challenge',challenge_row.challenge,'origin',challenge_row.origin,'keys',keys);
  end if;
  if not challenge_row.used then return jsonb_build_object('ok',false,'error','invalid_challenge'); end if;
  delete from private_transit.driver_passkey_challenges where id=challenge_row.id;
  if p_action='finish_register' then
    if jsonb_array_length(keys)>=8 then return jsonb_build_object('ok',false,'error','key_limit'); end if;
    if p_data->>'credential_id' is null or p_data->>'public_key' is null then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
    insert into private_transit.driver_passkeys(credential_id,driver_id,credential_version,public_key,counter,transports)
      values(p_data->>'credential_id',owner_id,credential.version,p_data->>'public_key',(p_data->>'counter')::bigint,coalesce(p_data->'transports','[]'));
    return jsonb_build_object('ok',true);
  end if;
  select * into key_row from private_transit.driver_passkeys where credential_id=p_data->>'credential_id' and driver_id=owner_id and credential_version=credential.version for update;
  if not found or key_row.counter<>(p_data->>'expected_counter')::bigint or (p_data->>'counter')::bigint<key_row.counter then return jsonb_build_object('ok',false,'error','invalid_challenge'); end if;
  update private_transit.driver_passkeys set counter=(p_data->>'counter')::bigint where credential_id=key_row.credential_id;
  raw_token:=encode(extensions.gen_random_bytes(32),'hex'); expiry:=now()+interval '90 days';
  insert into private_transit.driver_sessions(token_hash,driver_id,credential_version,expires_at,passkey_verified_at)
    values(encode(extensions.digest(raw_token,'sha256'),'hex'),owner_id,credential.version,expiry,now());
  update private_transit.driver_sessions set revoked_at=now() where token_hash in (
    select token_hash from private_transit.driver_sessions where driver_id=owner_id and revoked_at is null order by issued_at desc,token_hash offset 10);
  return jsonb_build_object('ok',true,'driver_id',owner_id,'token',raw_token,'expires_at',expiry);
exception when invalid_text_representation or unique_violation or check_violation then
  return jsonb_build_object('ok',false,'error','invalid_request');
end $$;
revoke all on function public.transit_driver_security(text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.transit_driver_security(text,text,text,text,text,jsonb,text) to service_role;
commit;
