-- Raffle check-in override dates.
--
-- The check-in gate previously allowed entries only on days that have a row in
-- mvl.games. Opening a test window that way would mean inserting fake games,
-- which would then surface on the public schedule and gametime pages (both read
-- games from Supabase via mvl_get_public_data). This table separates the two
-- concerns: check-in can be opened on a date without inventing a game.
--
-- Open a day:   insert into mvl.raffle_open_dates (day, note) values ('2026-08-01', 'why');
-- Close it:     delete from mvl.raffle_open_dates where day = '2026-08-01';
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260731000100_raffle_open_dates.sql

create table if not exists mvl.raffle_open_dates (
  day date primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table mvl.raffle_open_dates enable row level security;

-- readable so the front end could surface the window later; writes stay
-- restricted to the service role / SQL editor.
drop policy if exists "Public can read raffle open dates" on mvl.raffle_open_dates;
create policy "Public can read raffle open dates" on mvl.raffle_open_dates for select using (true);
grant select on mvl.raffle_open_dates to anon, authenticated;

-- RPC: same as before, but a day is open if it has a game OR an override row.
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
  -- open on scheduled game days, or on an explicit override date (Manila time)
  if not exists (
    select 1 from mvl.games g
    where (g.starts_at at time zone 'Asia/Manila')::date = v_today
  ) and not exists (
    select 1 from mvl.raffle_open_dates d where d.day = v_today
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
