-- Run against the configured Supabase database. Every fixture is rolled back.
begin;
do $$ begin
  if exists (select 1 from public.transit_driver_owners) then
    raise exception 'Run this rollback-only test before provisioning real driver assignments';
  end if;
end $$;
select set_config('test.driver_one', gen_random_uuid()::text, true);
select set_config('test.driver_two', gen_random_uuid()::text, true);
insert into auth.users (id, email) values
  (current_setting('test.driver_one')::uuid, 'transit-test-one@example.invalid'),
  (current_setting('test.driver_two')::uuid, 'transit-test-two@example.invalid');
insert into public.transit_driver_owners (driver_id, user_id) values
  ('driver-1', current_setting('test.driver_one')::uuid),
  ('driver-2', current_setting('test.driver_two')::uuid);

insert into public.transit_driver_feed (driver_id, snapshot)
select id, jsonb_build_object(
  'id', id, 'nameEn', 'Test Driver', 'nameAr', 'سائق تجريبي', 'phone', '',
  'isOnDuty', false, 'isLateShift', false, 'status', 'in_kufr_malik',
  'passengers', 0, 'maxCapacity', 7, 'lastUpdated', '2026-11-04T16:00:00Z',
  'departureNoteEn', '', 'departureNoteAr', '', 'currentStopEn', 'Test',
  'currentStopAr', 'تجريبي', 'proximityStatusEn', '', 'proximityStatusAr', '',
  'currentLocation', jsonb_build_object('lat', 0, 'lng', 0, 'timestamp', 0),
  'detectedNodeId', 'kufr_malik', 'isDetour', false, 'gpsMode', 'idle')
from (values ('driver-2')) ids(id);

set local role anon;
do $$ begin
  if (select count(*) from public.transit_driver_feed) <> 1 then raise exception 'Public feed read failed'; end if;
  begin
    perform * from public.transit_driver_owners;
    raise exception 'Visitor read private assignments';
  exception when insufficient_privilege then null; end;
  begin
    update public.transit_driver_feed set snapshot = snapshot where driver_id = 'driver-1';
    raise exception 'Visitor changed a driver';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.driver_one'), true);
set local role authenticated;
do $$ declare affected integer; begin
  if (select count(*) from public.transit_driver_owners) <> 1 then raise exception 'Assignments not isolated'; end if;
  insert into public.transit_driver_feed (driver_id, snapshot)
    select 'driver-1', jsonb_set(snapshot, '{id}', '"driver-1"') from public.transit_driver_feed where driver_id = 'driver-2';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner first publication failed'; end if;
  update public.transit_driver_feed set snapshot = jsonb_set(snapshot, '{passengers}', '3') where driver_id = 'driver-1' and revision = 1;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner update failed'; end if;
  if (select revision from public.transit_driver_feed where driver_id = 'driver-1') <> 2 then raise exception 'Server revision not advanced'; end if;
  update public.transit_driver_feed set snapshot = jsonb_set(snapshot, '{passengers}', '5') where driver_id = 'driver-2';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Driver changed another driver'; end if;
  update public.transit_driver_feed set snapshot = snapshot where driver_id = 'driver-1' and revision = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale revision overwrote newer data'; end if;
  begin
    update public.transit_driver_feed set revision = 100 where driver_id = 'driver-1';
    raise exception 'Client spoofed server revision';
  exception when insufficient_privilege then null; end;
  begin
    update public.transit_driver_owners set driver_id = 'driver-3';
    raise exception 'Client changed driver assignment';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.transit_driver_feed (driver_id, snapshot)
      select 'driver-3', jsonb_set(snapshot, '{id}', '"driver-3"') from public.transit_driver_feed where driver_id = 'driver-1';
    raise exception 'Driver published an unassigned profile';
  exception when insufficient_privilege then null; end;
  begin
    update public.transit_driver_feed set snapshot = snapshot || '{"pinCode":"private"}'::jsonb where driver_id = 'driver-1';
    raise exception 'Credential entered public feed';
  exception when check_violation then null; end;
  begin
    update public.transit_driver_feed set snapshot = jsonb_set(snapshot, '{passengers}', '8') where driver_id = 'driver-1';
    raise exception 'Capacity overflow accepted';
  exception when check_violation then null; end;
  begin
    update public.transit_driver_feed set snapshot = jsonb_set(snapshot, '{gpsMode}', '"simulation"') where driver_id = 'driver-1';
    raise exception 'Simulation entered live feed';
  exception when check_violation then null; end;
  begin
    update public.transit_driver_feed set snapshot = jsonb_set(snapshot, '{currentLocation,lat}', '100') where driver_id = 'driver-1';
    raise exception 'Invalid coordinate accepted';
  exception when check_violation then null; end;
  begin
    delete from public.transit_driver_feed where driver_id = 'driver-1';
    raise exception 'Driver deleted public feed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('test.driver_two'), true);
set local role authenticated;
do $$ declare affected integer; begin
  update public.transit_driver_feed set snapshot = jsonb_set(snapshot, '{passengers}', '2') where driver_id = 'driver-2';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Second driver update failed'; end if;
  update public.transit_driver_feed set snapshot = snapshot where driver_id = 'driver-1';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Second driver changed first driver'; end if;
end $$;
reset role;
select 'PASS: public reads, private assignments, two-owner isolation, revisions, no client deletion, payload validation' as result;
rollback;
