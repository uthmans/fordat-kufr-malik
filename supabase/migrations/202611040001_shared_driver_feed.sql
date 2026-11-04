-- Stage 1: public driver feed. No booking, PIN, or archive data belongs here.
-- Apply to a new Supabase project, then assign Auth users through the dashboard.
begin;

create schema if not exists extensions;
create extension if not exists pg_jsonschema with schema extensions;

create table public.transit_driver_owners (
  driver_id text primary key check (driver_id ~ '^driver-[1-8]$'),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table public.transit_driver_owners enable row level security;
revoke all on public.transit_driver_owners from anon, authenticated;
grant select on public.transit_driver_owners to authenticated;
create policy "Drivers can read only their own assignment"
  on public.transit_driver_owners for select to authenticated
  using (user_id = (select auth.uid()));
-- No client role can create or change assignments, including its own.

create table public.transit_driver_feed (
  driver_id text primary key references public.transit_driver_owners(driver_id),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  received_at timestamptz not null default now(),
  snapshot jsonb not null,
  constraint snapshot_matches_driver check (snapshot->>'id' = driver_id),
  constraint public_snapshot_only check (extensions.jsonb_matches_schema(
    $json$
    {
      "type": "object", "additionalProperties": false,
      "required": ["id", "nameEn", "nameAr", "phone", "isOnDuty", "isLateShift",
        "status", "passengers", "maxCapacity", "lastUpdated", "departureNoteEn", "departureNoteAr",
        "currentStopEn", "currentStopAr", "proximityStatusEn", "proximityStatusAr",
        "currentLocation", "detectedNodeId", "isDetour", "gpsMode"],
      "properties": {
        "id": {"type": "string", "pattern": "^driver-[1-8]$"},
        "nameEn": {"type": "string", "minLength": 1, "maxLength": 100},
        "nameAr": {"type": "string", "minLength": 1, "maxLength": 100},
        "phone": {"type": "string", "maxLength": 40},
        "isOnDuty": {"type": "boolean"},
        "isLateShift": {"type": "boolean"},
        "autoPausedForInactivity": {"type": "boolean"},
        "prayerShift": {"enum": ["regular_day", "after_maghrib", "after_isha", "final_trip"]},
        "departureCountdown": {"enum": [null, "leaving_now", "in_5_mins", "in_10_mins"]},
        "departureCountdownSetAt": {"type": "number", "minimum": 0},
        "lastActiveTime": {"type": "number", "minimum": 0},
        "seatCountUpdatedAt": {"type": "number", "minimum": 0},
        "lastTripLabelEn": {"type": "string", "maxLength": 200},
        "lastTripLabelAr": {"type": "string", "maxLength": 200},
        "status": {"enum": ["in_kufr_malik", "to_ramallah", "in_ramallah", "to_kufr_malik", "detour"]},
        "passengers": {"type": "integer", "minimum": 0, "maximum": 100},
        "maxCapacity": {"type": "integer", "minimum": 1, "maximum": 100},
        "lastUpdated": {"type": "string", "format": "date-time"},
        "departureNoteEn": {"type": "string", "maxLength": 500},
        "departureNoteAr": {"type": "string", "maxLength": 500},
        "currentStopEn": {"type": "string", "maxLength": 200},
        "currentStopAr": {"type": "string", "maxLength": 200},
        "proximityStatusEn": {"type": "string", "maxLength": 500},
        "proximityStatusAr": {"type": "string", "maxLength": 500},
        "detectedNodeId": {"type": "string", "maxLength": 100},
        "isDetour": {"type": "boolean"},
        "detourNameEn": {"type": "string", "maxLength": 200},
        "detourNameAr": {"type": "string", "maxLength": 200},
        "gpsMode": {"enum": ["live", "idle"]},
        "bearing": {"enum": ["southbound", "northbound", "stationary"]},
        "currentLocation": {
          "type": "object", "additionalProperties": false,
          "required": ["lat", "lng", "timestamp"],
          "properties": {
            "lat": {"type": "number", "minimum": -90, "maximum": 90},
            "lng": {"type": "number", "minimum": -180, "maximum": 180},
            "timestamp": {"type": "number", "minimum": 0},
            "accuracy": {"type": "number", "minimum": 0},
            "heading": {"type": ["number", "null"], "minimum": 0, "maximum": 360},
            "speed": {"type": ["number", "null"], "minimum": 0}
          }
        }
      }
    }
    $json$::json, snapshot)),
  constraint occupancy_within_capacity check (
    (snapshot->>'passengers')::integer <= (snapshot->>'maxCapacity')::integer)
);
alter table public.transit_driver_feed enable row level security;
revoke all on public.transit_driver_feed from anon, authenticated;
grant select on public.transit_driver_feed to anon, authenticated;
-- Clients cannot set the server clock/revision or delete the public roster.
grant insert (driver_id, snapshot), update (snapshot) on public.transit_driver_feed to authenticated;

create policy "Visitors can read public driver updates"
  on public.transit_driver_feed for select to anon, authenticated using (true);
create policy "Assigned driver can publish first update"
  on public.transit_driver_feed for insert to authenticated
  with check (exists (select 1 from public.transit_driver_owners owners
    where owners.driver_id = transit_driver_feed.driver_id and owners.user_id = (select auth.uid())));
create policy "Assigned driver can update own feed"
  on public.transit_driver_feed for update to authenticated
  using (exists (select 1 from public.transit_driver_owners owners
    where owners.driver_id = transit_driver_feed.driver_id and owners.user_id = (select auth.uid())))
  with check (exists (select 1 from public.transit_driver_owners owners
    where owners.driver_id = transit_driver_feed.driver_id and owners.user_id = (select auth.uid())));

create function public.stamp_transit_driver_feed() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.received_at := clock_timestamp();
  if tg_op = 'INSERT' then new.revision := 1;
  else new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_transit_driver_feed() from public, anon, authenticated;
create trigger stamp_transit_driver_feed before insert or update on public.transit_driver_feed
  for each row execute function public.stamp_transit_driver_feed();

alter publication supabase_realtime add table public.transit_driver_feed;
commit;
