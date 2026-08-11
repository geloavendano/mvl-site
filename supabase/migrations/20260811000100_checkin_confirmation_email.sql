-- Check-in confirmation email: give the client the row id to send against, and
-- give the edge function everything the message renders.
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260811000100_checkin_confirmation_email.sql

-- ---------------------------------------------------------------------------
-- 1. The confirmation payload gains the check-in id.
--    Without it the browser has nothing to name when asking the edge function
--    to send, and the function has nothing to look up. The signature changes,
--    so the old one is dropped rather than overloaded.
-- ---------------------------------------------------------------------------
drop function if exists mvl.checkin_payload(mvl.players, boolean, timestamptz);

create or replace function mvl.checkin_payload(
  p_player mvl.players,
  p_already boolean,
  p_at timestamptz,
  p_checkin_id uuid
) returns jsonb language sql stable set search_path = mvl, public as $$
  select jsonb_build_object(
    'ok', true,
    'checkin_id', p_checkin_id,
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
-- 2. Both check-in paths capture the inserted id and hand it back.
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
  v_id uuid;
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
    return mvl.checkin_payload(v_player, true, v_existing.created_at, v_existing.id);
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
  )
  returning id into v_id;

  return mvl.checkin_payload(v_player, false, now(), v_id);
end;
$$;

revoke all on function public.mvl_self_checkin(text, text, text, uuid, double precision, double precision, numeric, text) from public;
grant execute on function public.mvl_self_checkin(text, text, text, uuid, double precision, double precision, numeric, text) to anon, authenticated;

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
  v_id uuid;
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
    return mvl.checkin_payload(v_player, true, v_existing.created_at, v_existing.id);
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
  )
  returning id into v_id;

  return mvl.checkin_payload(v_player, false, now(), v_id);
end;
$$;

revoke all on function public.mvl_qr_checkin(text, text) from public, anon;
grant execute on function public.mvl_qr_checkin(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. What the confirmation email renders.
--    Team colours are deliberately absent for the same reason as
--    mvl.checkin_payload: mvl.teams still carries pre-2026 colours for several
--    teams, so the edge function keeps its own copy of the palette.
-- ---------------------------------------------------------------------------
create or replace function public.mvl_get_checkin_confirmation_email_payload(
  p_checkin_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = mvl, public
as $$
  select jsonb_build_object(
    'checkin', jsonb_build_object(
      'id', r.id,
      'checkin_day', r.checkin_day,
      'created_at', r.created_at,
      'method', r.method,
      -- self check-in stores the address the player typed; the QR path copies
      -- the one on file, which may be null
      'email', coalesce(r.email, p.email)
    ),
    'player', jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'surname', p.surname,
      'jersey_number', p.jersey_number
    ),
    'team', jsonb_build_object('id', t.id, 'name', t.name),
    -- the day's fixtures for this player's team, so the mail is useful after
    -- it has confirmed the entry
    'games', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'starts_at', g.starts_at,
                 'opponent', case
                   when g.team_a_id = p.team_id then coalesce(tb.name, g.team_b_label, g.team_b_id)
                   else coalesce(ta.name, g.team_a_label, g.team_a_id)
                 end,
                 'venue', v.name
               )
               order by g.starts_at
             )
      from mvl.games g
      left join mvl.teams ta on ta.id = g.team_a_id
      left join mvl.teams tb on tb.id = g.team_b_id
      left join mvl.venues v on v.id = g.venue_id
      where (g.starts_at at time zone 'Asia/Manila')::date = r.checkin_day
        and p.team_id in (g.team_a_id, g.team_b_id)
    ), '[]'::jsonb),
    'day_number', (
      select g.day from mvl.games g
      where (g.starts_at at time zone 'Asia/Manila')::date = r.checkin_day
      order by g.starts_at
      limit 1
    )
  )
  from mvl.raffle_checkins r
  join mvl.players p on p.id = r.player_id
  join mvl.teams t on t.id = p.team_id
  where r.id = p_checkin_id;
$$;

revoke all on function public.mvl_get_checkin_confirmation_email_payload(uuid)
  from public, anon, authenticated;

grant execute on function public.mvl_get_checkin_confirmation_email_payload(uuid)
  to service_role;

notify pgrst, 'reload schema';
