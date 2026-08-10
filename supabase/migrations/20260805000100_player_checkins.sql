-- Player check-in: QR at the booth, or self check-in from a phone.
--
-- Both paths resolve a real player rather than a typed name, so a check-in can
-- be tied to a roster entry, deduped reliably, and confirmed back with the
-- player's own photo and jersey.
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260805000100_player_checkins.sql

-- ---------------------------------------------------------------------------
-- 1. A QR payload is <team_id>_<jersey_number>, so that pair has to identify
--    exactly one player. It does today (checked: zero collisions across 123
--    players); this keeps it that way.
-- ---------------------------------------------------------------------------
create unique index if not exists players_team_jersey_key
  on mvl.players (team_id, lower(trim(jersey_number)))
  where jersey_number is not null and trim(jersey_number) <> '';

-- ---------------------------------------------------------------------------
-- 2. raffle_checkins was built for the typed-name flow: it stores no player
--    reference, and location is mandatory. The booth scanner has no location
--    for the participant — the laptop's position says nothing about where the
--    player is — so those columns have to be optional.
-- ---------------------------------------------------------------------------
alter table mvl.raffle_checkins
  add column if not exists player_id uuid references mvl.players (id) on delete set null,
  add column if not exists email text,
  add column if not exists method text not null default 'self',
  -- Manila day held as its own column: the unique index below cannot be built
  -- on (created_at at time zone 'Asia/Manila') because that expression is
  -- STABLE, not IMMUTABLE.
  add column if not exists checkin_day date;

alter table mvl.raffle_checkins
  alter column detected_location drop not null,
  alter column distance_m drop not null,
  alter column inside_radius drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'raffle_checkins_method_check'
  ) then
    alter table mvl.raffle_checkins
      add constraint raffle_checkins_method_check check (method in ('self', 'qr', 'legacy'));
  end if;
end $$;

-- existing rows predate the player link; mark them so reports can tell them apart
update mvl.raffle_checkins
set checkin_day = (created_at at time zone 'Asia/Manila')::date
where checkin_day is null;

update mvl.raffle_checkins set method = 'legacy' where player_id is null and method = 'self';

alter table mvl.raffle_checkins alter column checkin_day set default ((now() at time zone 'Asia/Manila')::date);
alter table mvl.raffle_checkins alter column checkin_day set not null;

-- One successful check-in per player per day. This is the dedupe the old flow
-- could only approximate by matching on a typed name.
create unique index if not exists raffle_checkins_player_day_key
  on mvl.raffle_checkins (player_id, checkin_day)
  where player_id is not null;

create index if not exists raffle_checkins_day_idx on mvl.raffle_checkins (checkin_day);

-- ---------------------------------------------------------------------------
-- 3. Shared helpers
-- ---------------------------------------------------------------------------

-- Check-in is open on a scheduled game day, or on an explicit override date.
create or replace function mvl.checkin_is_open(p_day date)
returns boolean language sql stable security definer set search_path = mvl, public as $$
  select exists (
    select 1 from mvl.games g
    where (g.starts_at at time zone 'Asia/Manila')::date = p_day
  ) or exists (
    select 1 from mvl.raffle_open_dates d where d.day = p_day
  );
$$;

-- The payload the confirmation screen renders. Team colours are deliberately
-- NOT returned: mvl.teams still holds pre-2026 colours for four teams, so the
-- client maps team_id through league-data.js, which is the source of truth.
create or replace function mvl.checkin_payload(
  p_player mvl.players,
  p_already boolean,
  p_at timestamptz
) returns jsonb language sql stable set search_path = mvl, public as $$
  select jsonb_build_object(
    'ok', true,
    'already_checked_in', p_already,
    'checked_in_at', p_at,
    'player', jsonb_build_object(
      'id', p_player.id,
      'display_name', p_player.display_name,
      'surname', p_player.surname,
      'jersey_number', p_player.jersey_number,
      'photo_path', p_player.photo_path,
      'photo_url', p_player.photo_url
    ),
    'team', jsonb_build_object(
      'id', p_player.team_id,
      'name', (select t.name from mvl.teams t where t.id = p_player.team_id)
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Self check-in — public, from the participant's own device.
--    Guarded by: open day, venue radius, and the email on file for that
--    team+jersey acting as a shared secret so a stranger cannot check
--    somebody else in.
-- ---------------------------------------------------------------------------
create or replace function public.mvl_self_checkin(
  p_team_id text,
  p_jersey_number text,
  p_email text,
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m numeric default null,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_player mvl.players;
  v_venue mvl.venues;
  v_point geography(point, 4326);
  v_distance numeric;
  v_inside boolean;
  v_existing mvl.raffle_checkins;
begin
  if not mvl.checkin_is_open(v_today) then
    raise exception 'CHECKIN_CLOSED';
  end if;

  select * into v_player
  from mvl.players p
  where p.team_id = p_team_id
    and lower(trim(p.jersey_number)) = lower(trim(p_jersey_number))
  limit 1;

  if not found then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  -- The email is the only thing separating "I am checking myself in" from
  -- "I know your jersey number", so a player without one on file cannot use
  -- this path; they go to the booth instead.
  if v_player.email is null or trim(v_player.email) = '' then
    raise exception 'NO_EMAIL_ON_FILE';
  end if;
  if lower(trim(v_player.email)) <> lower(trim(coalesce(p_email, ''))) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  -- already in for today? hand back the original rather than erroring
  select * into v_existing
  from mvl.raffle_checkins r
  where r.player_id = v_player.id and r.checkin_day = v_today
  limit 1;
  if found then
    return mvl.checkin_payload(v_player, true, v_existing.created_at);
  end if;

  select * into v_venue from mvl.venues v where v.id = p_venue_id;
  if not found then
    raise exception 'VENUE_NOT_FOUND';
  end if;
  if v_venue.location is null then
    raise exception 'VENUE_LOCATION_MISSING';
  end if;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_distance := st_distance(v_point, v_venue.location);
  v_inside := v_distance <= v_venue.checkin_radius_m;

  if not v_inside then
    raise exception 'OUTSIDE_VENUE:%', round(v_distance);
  end if;

  insert into mvl.raffle_checkins (
    team_id, entrant_name, player_id, email, method, venue_id,
    detected_location, accuracy_m, inside_radius, distance_m, user_agent, checkin_day
  ) values (
    v_player.team_id, v_player.display_name, v_player.id, lower(trim(p_email)), 'self', p_venue_id,
    v_point, p_accuracy_m, true, v_distance, p_user_agent, v_today
  );

  return mvl.checkin_payload(v_player, false, now());
end;
$$;

revoke all on function public.mvl_self_checkin(text, text, text, uuid, double precision, double precision, numeric, text) from public;
grant execute on function public.mvl_self_checkin(text, text, text, uuid, double precision, double precision, numeric, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. QR check-in — booth only. The payload carries no secret, so the guard is
--    that only an admin can call this at all.
-- ---------------------------------------------------------------------------
create or replace function public.mvl_qr_checkin(
  p_code text,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_code text := trim(coalesce(p_code, ''));
  v_team text;
  v_jersey text;
  v_split int;
  v_player mvl.players;
  v_existing mvl.raffle_checkins;
begin
  if not mvl.is_admin() then
    raise exception 'NOT_AUTHORISED';
  end if;
  if not mvl.checkin_is_open(v_today) then
    raise exception 'CHECKIN_CLOSED';
  end if;

  -- split on the LAST underscore: team ids use hyphens, but this stays correct
  -- even if one ever gains an underscore
  v_split := length(v_code) - position('_' in reverse(v_code)) + 1;
  if v_split < 2 or position('_' in v_code) = 0 then
    raise exception 'BAD_CODE';
  end if;
  v_team := substring(v_code from 1 for v_split - 1);
  v_jersey := substring(v_code from v_split + 1);

  select * into v_player
  from mvl.players p
  where p.team_id = v_team
    and lower(trim(p.jersey_number)) = lower(trim(v_jersey))
  limit 1;

  if not found then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  select * into v_existing
  from mvl.raffle_checkins r
  where r.player_id = v_player.id and r.checkin_day = v_today
  limit 1;
  if found then
    return mvl.checkin_payload(v_player, true, v_existing.created_at);
  end if;

  -- No location: the booth laptop's position is not the participant's, and
  -- being scanned at the booth already proves presence.
  insert into mvl.raffle_checkins (
    team_id, entrant_name, player_id, email, method, venue_id,
    detected_location, accuracy_m, inside_radius, distance_m, user_agent, checkin_day
  ) values (
    v_player.team_id, v_player.display_name, v_player.id, v_player.email, 'qr',
    (select v.id from mvl.venues v order by v.created_at limit 1),
    null, null, null, null, p_user_agent, v_today
  );

  return mvl.checkin_payload(v_player, false, now());
end;
$$;

revoke all on function public.mvl_qr_checkin(text, text) from public, anon;
grant execute on function public.mvl_qr_checkin(text, text) to authenticated;

notify pgrst, 'reload schema';
