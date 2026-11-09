begin;
do $test$
declare result jsonb; old_token text; new_token text; device_token text; fixture_challenge text; version_before integer;
begin
  if has_function_privilege('anon','public.transit_driver_security(text,text,text,text,text,jsonb,text)','execute')
    or has_function_privilege('authenticated','public.transit_driver_security(text,text,text,text,text,jsonb,text)','execute')
    or has_schema_privilege('anon','private_transit','usage') then raise exception 'Browser privilege leak'; end if;
  if not (select relrowsecurity from pg_class where oid='private_transit.driver_passkeys'::regclass)
    or not (select relrowsecurity from pg_class where oid='private_transit.driver_passkey_challenges'::regclass) then raise exception 'RLS missing'; end if;
  -- Isolated transactional fixture; no real driver's code/session is changed after rollback.
  update private_transit.driver_credentials set code_hash=extensions.crypt('87654321',extensions.gen_salt('bf',4)),version=version+100,
    enabled=true,failed_attempts=0,blocked_until=null where driver_id='driver-8' returning version into version_before;
  result:=public.transit_driver_gateway('login',p_driver_id=>'driver-8',p_code=>'87654321',p_source=>repeat('d',64));
  if result->>'ok'<>'true' then raise exception 'Fixture login failed'; end if; old_token:=result->>'token';
  result:=public.transit_driver_security('change_pin',p_token=>old_token,p_code=>'111111',p_new_code=>'654321',p_source=>repeat('d',64));
  if result->>'ok'='true' then raise exception 'Wrong current PIN accepted'; end if;
  result:=public.transit_driver_security('change_pin',p_token=>old_token,p_code=>'87654321',p_new_code=>'654321',p_source=>repeat('d',64));
  if result->>'ok'<>'true' then raise exception 'PIN change failed'; end if; new_token:=result->>'token';
  if public.transit_driver_gateway('restore',p_token=>old_token)->>'ok'='true' then raise exception 'Old session still valid'; end if;
  if public.transit_driver_gateway('restore',p_token=>new_token)->>'ok'<>'true' then raise exception 'Replacement session missing'; end if;
  if public.transit_driver_gateway('login',p_driver_id=>'driver-8',p_code=>'87654321',p_source=>repeat('d',64))->>'ok'='true' then raise exception 'Old PIN still valid'; end if;
  if public.transit_driver_gateway('login',p_driver_id=>'driver-8',p_code=>'654321',p_source=>repeat('d',64))->>'ok'<>'true' then raise exception 'Six-digit PIN failed'; end if;
  result:=public.transit_driver_security('begin_register',p_token=>new_token,p_code=>'654321',p_source=>repeat('d',64),p_data=>'{"challenge":"test","origin":"https://uthmans.github.io"}');
  if result->>'ok'<>'true' then raise exception 'Registration fixture_challenge failed'; end if;fixture_challenge:=result->>'challenge_id';
  if public.transit_driver_security('take_register',p_token=>new_token,p_data=>jsonb_build_object('challenge_id',fixture_challenge))->>'ok'<>'true' then raise exception 'Challenge consume failed'; end if;
  if public.transit_driver_security('take_register',p_token=>new_token,p_data=>jsonb_build_object('challenge_id',fixture_challenge))->>'ok'='true' then raise exception 'Challenge replay accepted'; end if;
  result:=public.transit_driver_security('finish_register',p_token=>new_token,p_data=>jsonb_build_object('challenge_id',fixture_challenge,'credential_id','transactional-test-key','public_key','fixture-key','counter',0,'transports',jsonb_build_array('internal')));
  if result->>'ok'<>'true' then raise exception 'Verified key persistence failed'; end if;
  result:=public.transit_driver_security('begin_login',p_driver_id=>'driver-8',p_source=>repeat('d',64),p_data=>'{"challenge":"test","origin":"https://uthmans.github.io"}');
  fixture_challenge:=result->>'challenge_id';
  update private_transit.driver_passkey_challenges set expires_at=now()-interval '1 second' where id=fixture_challenge::uuid;
  if public.transit_driver_security('take_login',p_data=>jsonb_build_object('challenge_id',fixture_challenge))->>'ok'='true' then raise exception 'Expired fixture_challenge accepted'; end if;
  result:=public.transit_driver_security('begin_login',p_driver_id=>'driver-8',p_source=>repeat('d',64),p_data=>'{"challenge":"test2","origin":"https://uthmans.github.io"}');fixture_challenge:=result->>'challenge_id';
  if public.transit_driver_security('take_login',p_data=>jsonb_build_object('challenge_id',fixture_challenge))->>'ok'<>'true' then raise exception 'Login fixture_challenge failed'; end if;
  result:=public.transit_driver_security('finish_login',p_data=>jsonb_build_object('challenge_id',fixture_challenge,'credential_id','transactional-test-key','expected_counter',0,'counter',1));
  if result->>'ok'<>'true' then raise exception 'Verified device login failed'; end if; device_token:=result->>'token';
  if public.transit_driver_gateway('restore',p_token=>device_token)->>'driver_id'<>'driver-8' then raise exception 'Wrong device identity'; end if;
  result:=public.transit_driver_security('change_pin',p_token=>device_token,p_new_code=>'765432',p_source=>repeat('d',64));
  if result->>'ok'<>'true' then raise exception 'Recent verified device could not reset forgotten PIN'; end if;
  if (select credential_version from private_transit.driver_passkeys where credential_id='transactional-test-key')<>(select version from private_transit.driver_credentials where driver_id='driver-8') then raise exception 'Own PIN change lost device key'; end if;
  update private_transit.driver_credentials set version=version+1 where driver_id='driver-8';
  if public.transit_driver_security('begin_login',p_driver_id=>'driver-8',p_source=>repeat('d',64),p_data=>'{"challenge":"test3","origin":"https://uthmans.github.io"}')->>'error'<>'not_enrolled' then raise exception 'Admin reset did not invalidate device keys'; end if;
end $test$;
rollback;
select 'PIN changes, session rotation, private grants, passkey challenge replay/expiry and revocation passed' as verification;
