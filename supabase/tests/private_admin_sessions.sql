begin;
do $$ begin
  if exists(select 1 from private_transit.admin_credentials) then raise exception 'Run on a clean admin test setup before provisioning the real administrator'; end if;
end $$;
insert into private_transit.admin_credentials(id,code_hash) values(1,extensions.crypt('835274916203',extensions.gen_salt('bf',10)));
set local role anon;
do $$ begin
  begin perform * from private_transit.admin_credentials; raise exception 'Browser read admin credentials'; exception when insufficient_privilege then null; end;
  begin perform public.transit_admin_gateway('login','835274916203',null,repeat('a',64)); raise exception 'Browser called privileged admin gateway'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare result jsonb; admin_token text; i integer; begin
  result:=public.transit_admin_gateway('login','9999',null,repeat('a',64));
  if result->>'error'<>'invalid_code' then raise exception 'Public PIN accepted'; end if;
  result:=public.transit_admin_gateway('login','83527491',null,repeat('a',64));
  if result->>'error'<>'invalid_code' then raise exception 'Driver code accepted'; end if;
  result:=public.transit_admin_gateway('login','835274916203',null,repeat('a',64));
  if result->>'role'<>'admin' or length(result->>'token')<>64 then raise exception 'Admin code failed'; end if;
  admin_token:=result->>'token';
  result:=public.transit_driver_gateway('restore',p_token=>admin_token);
  if result->>'error'<>'invalid_session' then raise exception 'Admin session used as driver'; end if;
  insert into private_transit.driver_sessions(token_hash,driver_id,credential_version,expires_at)
    select encode(extensions.digest(repeat('e',64),'sha256'),'hex'),driver_id,version,now()+interval '1 day'
    from private_transit.driver_credentials where driver_id='driver-1';
  result:=public.transit_admin_gateway('restore',p_token=>repeat('e',64));
  if result->>'error'<>'invalid_session' then raise exception 'Driver session used as admin'; end if;
  result:=public.transit_admin_gateway('restore',p_token=>admin_token);
  if result->>'role'<>'admin' or result ? 'token' then raise exception 'Admin restoration failed'; end if;
  for i in 1..5 loop result:=public.transit_admin_gateway('login','000000000000',null,lpad(i::text,64,'0')); end loop;
  if result->>'error'<>'rate_limited' then raise exception 'Admin lockout missing'; end if;
  result:=public.transit_admin_gateway('login','835274916203',null,repeat('b',64));
  if result->>'error'<>'rate_limited' then raise exception 'Changed source bypassed lock'; end if;
  result:=public.transit_admin_gateway('restore',p_token=>admin_token);
  if result->>'ok'<>'true' then raise exception 'Guessing attack revoked administrator'; end if;
  result:=public.transit_admin_gateway('logout',p_token=>admin_token);
  result:=public.transit_admin_gateway('restore',p_token=>admin_token);
  if result->>'error'<>'invalid_session' then raise exception 'Admin logout failed'; end if;
end $$;
reset role;
select 'PASS: private administrator, role isolation, browser denial, lockouts, restoration and logout' result;
rollback;
