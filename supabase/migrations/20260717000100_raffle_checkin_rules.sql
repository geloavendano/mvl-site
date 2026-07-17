-- Raffle check-in rules (client-confirmed 2026-07-17):
--   1. Set Gameville Ball Park's real pin (venues were seeded with NULL
--      locations, which made every distance check fail).
--      Coordinates resolved from the official Maps link:
--      https://maps.app.goo.gl/sK1HuKBVwRSZPpHz9 -> 14.575241, 121.0543052
--   2. Remove the duplicate venue row (leftover from the two-venue plan).
--   3. One successful (inside-radius) entry per person per game day.
--      Outside-radius attempts are still recorded (ineligible) and don't
--      block a later successful entry the same day.
--   4. Check-ins only open on days that have a scheduled game (Manila time),
--      driven by mvl.games so date changes need no code edits.
--
-- Apply with:  supabase db query --linked --file supabase/migrations/20260717000100_raffle_checkin_rules.sql
-- (Do NOT `supabase db push` — the linked project has unrelated migration history.)

-- 1. real venue pin (PostGIS: lng first, lat second) + widened check-in
--    radius (client asked for 500m in case the courts sit far from the pin)
update mvl.venues
set location = st_setsrid(st_makepoint(121.0543052, 14.575241), 4326)::geography,
    checkin_radius_m = 500
where id = '11111111-1111-4111-8111-111111111111';

-- 2. drop the duplicate venue (no games or check-ins reference it)
delete from mvl.venues
where id = '22222222-2222-4222-8222-222222222222'
  and not exists (select 1 from mvl.games g where g.venue_id = '22222222-2222-4222-8222-222222222222')
  and not exists (select 1 from mvl.raffle_checkins r where r.venue_id = '22222222-2222-4222-8222-222222222222');

-- 3. backstop for the one-successful-entry-per-day rule (race safety;
--    the RPC below checks first and returns a friendly flag)
create unique index if not exists raffle_checkins_one_win_per_day_idx
  on mvl.raffle_checkins (team_id, lower(trim(entrant_name)), ((created_at at time zone 'Asia/Manila')::date))
  where inside_radius;

-- 4. updated RPC: game-day gate + duplicate detection.
--    Signature change: adds `already_entered` to the result row.
drop function if exists public.mvl_create_raffle_checkin(text, text, uuid, double precision, double precision, numeric, text);
create function public.mvl_create_raffle_checkin(
  p_team_id text,
  p_entrant_name text,
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m numeric,
  p_user_agent text default null
) returns table (
  id uuid,
  inside_radius boolean,
  distance_m numeric,
  already_entered boolean
)
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_venue mvl.venues;
  v_point geography(point, 4326);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_existing mvl.raffle_checkins;
begin
  -- only accept entries on scheduled game days (Manila time)
  if not exists (
    select 1 from mvl.games g
    where (g.starts_at at time zone 'Asia/Manila')::date = v_today
  ) then
    raise exception 'RAFFLE_CLOSED';
  end if;

  select * into v_venue from mvl.venues v where v.id = p_venue_id;
  if not found then
    raise exception 'Venue not found';
  end if;
  if v_venue.location is null then
    raise exception 'Venue location not configured';
  end if;

  -- already successfully entered today? return that entry instead of inserting
  select * into v_existing
  from mvl.raffle_checkins r
  where r.team_id = p_team_id
    and lower(trim(r.entrant_name)) = lower(trim(p_entrant_name))
    and (r.created_at at time zone 'Asia/Manila')::date = v_today
    and r.inside_radius
  limit 1;
  if found then
    return query select v_existing.id, v_existing.inside_radius, v_existing.distance_m, true;
    return;
  end if;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  return query
  insert into mvl.raffle_checkins (
    team_id, entrant_name, venue_id, detected_location,
    accuracy_m, inside_radius, distance_m, user_agent
  )
  select
    p_team_id, p_entrant_name, p_venue_id, v_point,
    p_accuracy_m,
    st_distance(v_point, v_venue.location) <= v_venue.checkin_radius_m,
    st_distance(v_point, v_venue.location),
    p_user_agent
  returning raffle_checkins.id, raffle_checkins.inside_radius, raffle_checkins.distance_m, false;
end;
$$;

grant execute on function public.mvl_create_raffle_checkin(text, text, uuid, double precision, double precision, numeric, text) to anon, authenticated;
