-- QR codes are printed as <Team Short Code>-<Jersey Number>, e.g. THT-23.
--
-- Only mvl.teams gains anything: the short code is a team attribute. Players
-- need no new column — a code resolves to (team_id, jersey_number), and that
-- pair is already uniquely indexed by players_team_jersey_key.
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260817000100_team_short_codes.sql

alter table mvl.teams add column if not exists short_code text;

update mvl.teams set short_code = v.code
from (values
  ('organizer',  'ORG'),
  ('thurstrap',  'THT'),
  ('gizmo',      'GZM'),
  ('ssvc',       'SVC'),
  ('metarice-y', 'MTY'),
  ('s24',        'S24'),
  ('metarice-x', 'MTX'),
  ('gremlins',   'GML'),
  ('secret',     'SEC')
) as v(id, code)
where mvl.teams.id = v.id;

-- Case-insensitive uniqueness: a scanner may emit either case, and two teams
-- sharing a code would make a scan ambiguous.
create unique index if not exists teams_short_code_key
  on mvl.teams (upper(trim(short_code)))
  where short_code is not null and trim(short_code) <> '';

-- ---------------------------------------------------------------------------
-- Parse the printed format, while still accepting the original
-- <team_id>_<jersey> payload so anything already generated keeps working.
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
  v_parts text[];
  v_token text;
  v_jersey text;
  v_team text;
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

  -- Greedy (.*) splits on the LAST separator, so a team id that itself
  -- contains a hyphen still parses: 'metarice-x-12' -> 'metarice-x' + '12',
  -- 'THT-23' -> 'THT' + '23', 'gizmo_31' -> 'gizmo' + '31'.
  v_parts := regexp_match(v_code, '^(.*)[-_]([^-_]+)$');
  if v_parts is null then
    raise exception 'BAD_CODE';
  end if;
  v_token := trim(v_parts[1]);
  v_jersey := trim(v_parts[2]);

  -- short code first, then the raw team id, so a short code always wins if the
  -- two namespaces ever collide
  select t.id into v_team from mvl.teams t
  where upper(trim(t.short_code)) = upper(v_token)
  limit 1;
  if v_team is null then
    select t.id into v_team from mvl.teams t where t.id = lower(v_token) limit 1;
  end if;
  if v_team is null then
    raise exception 'UNKNOWN_TEAM_CODE:%', v_token;
  end if;

  select * into v_player
  from mvl.players p
  where p.team_id = v_team
    and lower(trim(p.jersey_number)) = lower(v_jersey)
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

notify pgrst, 'reload schema';
