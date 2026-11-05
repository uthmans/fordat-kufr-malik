-- Synthetic credentials exist only inside this transaction. No real codes/users.
begin;
do $$ begin
  if exists (select 1 from private_transit.driver_credentials) then
    raise exception 'Run code-auth regression on a clean test project before provisioning real codes';
  end if;
end $$;
insert into private_transit.driver_credentials (driver_id, code_hash) values
  ('driver-1', extensions.crypt('83527491', extensions.gen_salt('bf', 10))),
  ('driver-2', extensions.crypt('65837294', extensions.gen_salt('bf', 10)));

set local role anon;
do $$ begin
  perform * from public.transit_driver_live;
  begin
    perform * from private_transit.driver_credentials;
    raise exception 'Visitor read credential hashes';
  exception when insufficient_privilege then null; end;
  begin
    perform public.transit_driver_gateway('login', 'driver-1', '83527491', null, repeat('a',64));
    raise exception 'Visitor bypassed the Edge gateway';
  exception when insufficient_privilege then null; end;
  begin
    update public.transit_driver_live set snapshot = snapshot;
    raise exception 'Visitor directly wrote public updates';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.transit_driver_gateway('restore', p_token => repeat('f',64));
    raise exception 'Legacy Auth user accessed code gateway';
  exception when insufficient_privilege then null; end;
  begin
    update public.transit_driver_live set snapshot = snapshot;
    raise exception 'Legacy Auth user bypassed code session';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$
declare
  response jsonb;
  first_token text;
  second_token text;
  replacement_token text;
  snapshot jsonb;
  i integer;
begin
  response := public.transit_driver_gateway('login', 'driver-1', '1234', null, repeat('a',64));
  if response->>'error' <> 'invalid_code' then raise exception 'Default PIN accepted'; end if;
  response := public.transit_driver_gateway('login', 'driver-1', '83527491', null, repeat('a',64));
  if response->>'ok' <> 'true' or length(response->>'token') <> 64 then raise exception 'Valid code rejected'; end if;
  first_token := response->>'token';
  response := public.transit_driver_gateway('login', 'driver-2', '65837294', null, repeat('a',64));
  second_token := response->>'token';
  if first_token = second_token or second_token is null then raise exception 'Session tokens not unique'; end if;
  response := public.transit_driver_gateway('restore', p_token => first_token);
  if response->>'driver_id' <> 'driver-1' or response ? 'token' then raise exception 'Restore incorrect or token echoed'; end if;
  if exists (select 1 from private_transit.driver_sessions where token_hash = first_token) then raise exception 'Raw session stored'; end if;
  if exists (select 1 from private_transit.driver_credentials where code_hash = '83527491') then raise exception 'Raw code stored'; end if;

  snapshot := jsonb_build_object('id','driver-1','nameEn','Test Driver','nameAr','سائق تجريبي','phone','',
    'isOnDuty',false,'isLateShift',false,'status','in_kufr_malik','passengers',0,'maxCapacity',7,
    'lastUpdated','2026-11-05T00:00:00Z','departureNoteEn','','departureNoteAr','','currentStopEn','Test',
    'currentStopAr','تجريبي','proximityStatusEn','','proximityStatusAr','',
    'currentLocation',jsonb_build_object('lat',0,'lng',0,'timestamp',0),'detectedNodeId','kufr_malik','isDetour',false,'gpsMode','idle');
  response := public.transit_driver_gateway('publish', p_driver_id=>'driver-1', p_token=>first_token, p_snapshot=>snapshot);
  if response->>'ok' <> 'true' or response->'row'->>'revision' <> '1' then raise exception 'First publication failed'; end if;
  response := public.transit_driver_gateway('publish', p_driver_id=>'driver-1', p_token=>second_token, p_snapshot=>snapshot, p_revision=>1);
  if response->>'error' <> 'forbidden' then raise exception 'Cross-driver publication accepted'; end if;
  response := public.transit_driver_gateway('publish', p_driver_id=>'driver-1', p_token=>first_token, p_snapshot=>snapshot);
  if response->>'error' <> 'conflict' then raise exception 'Blind overwrite accepted'; end if;
  response := public.transit_driver_gateway('publish', p_driver_id=>'driver-1', p_token=>first_token, p_snapshot=>snapshot, p_revision=>1);
  if response->'row'->>'revision' <> '2' then raise exception 'Revision not advanced'; end if;
  response := public.transit_driver_gateway('publish', p_driver_id=>'driver-1', p_token=>first_token, p_snapshot=>snapshot, p_revision=>1);
  if response->>'error' <> 'conflict' then raise exception 'Stale revision accepted'; end if;
  begin
    perform public.transit_driver_gateway('publish', p_driver_id=>'driver-1', p_token=>first_token,
      p_snapshot=>snapshot || '{"pinCode":"private"}'::jsonb, p_revision=>2);
    raise exception 'Credential published';
  exception when check_violation then null; end;
  begin
    perform public.transit_driver_gateway('publish', p_driver_id=>'driver-1', p_token=>first_token,
      p_snapshot=>jsonb_set(snapshot,'{currentLocation,lat}','31.9'), p_revision=>2);
    raise exception 'Off-duty precise GPS exposed';
  exception when check_violation then null; end;

  response := public.transit_driver_gateway('logout', p_token=>first_token);
  response := public.transit_driver_gateway('restore', p_token=>first_token);
  if response->>'error' <> 'invalid_session' then raise exception 'Logout failed to revoke'; end if;
  response := public.transit_driver_gateway('login', 'driver-1', '83527491', null, repeat('a',64));
  replacement_token := response->>'token';
  update private_transit.driver_credentials set version = version + 1 where driver_id='driver-1';
  response := public.transit_driver_gateway('restore', p_token=>replacement_token);
  if response->>'error' <> 'invalid_session' then raise exception 'Code rotation did not invalidate session'; end if;

  for i in 1..5 loop
    response := public.transit_driver_gateway('login','driver-2','00000000',null,lpad(i::text,64,'0'));
  end loop;
  if response->>'error' <> 'rate_limited' then raise exception 'Per-driver lock missing'; end if;
  response := public.transit_driver_gateway('login','driver-2','65837294',null,repeat('b',64));
  if response->>'error' <> 'rate_limited' then raise exception 'Changed source bypassed driver lock'; end if;
  response := public.transit_driver_gateway('restore', p_token=>second_token);
  if response->>'ok' <> 'true' then raise exception 'Bad login attacks revoked a valid session'; end if;
  update private_transit.driver_credentials set blocked_until=now()-interval '1 second' where driver_id='driver-2';
  response := public.transit_driver_gateway('login','driver-2','65837294',null,repeat('a',64));
  if response->>'ok' <> 'true' then raise exception 'Expired lock did not recover'; end if;
  update private_transit.driver_sessions set expires_at=now()-interval '1 second' where driver_id='driver-2';
  response := public.transit_driver_gateway('restore', p_token=>second_token);
  if response->>'error' <> 'invalid_session' then raise exception 'Expired session accepted'; end if;
  for i in 1..31 loop
    response := public.transit_driver_gateway('login','driver-3','00000000',null,repeat('c',64));
  end loop;
  if response->>'error' <> 'rate_limited' then raise exception 'Source rate limit missing'; end if;
end $$;
reset role;
select 'PASS: email-free login, hashed secrets, browser isolation, lockouts, sessions, ownership, revisions, redaction' as result;
rollback;
