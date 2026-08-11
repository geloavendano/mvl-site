-- Two independent court livestreams and game-linked scoreboard set scoring.

update mvl.site_settings
set value = value || jsonb_build_object(
  'streams', jsonb_build_array(
    jsonb_build_object(
      'court', 'Court 1',
      'is_live', coalesce((value->>'is_live')::boolean, false),
      'youtube_url', coalesce(nullif(value->>'youtube_url', ''), 'https://www.youtube.com/@metaricevolley'),
      'youtube_id', coalesce(value->>'youtube_id', '')
    ),
    jsonb_build_object(
      'court', 'Court 2',
      'is_live', false,
      'youtube_url', 'https://www.youtube.com/@metaricevolley',
      'youtube_id', ''
    )
  )
)
where key = 'livestream'
  and jsonb_typeof(value->'streams') is distinct from 'array';

create or replace function public.mvl_admin_update_livestreams(p_streams jsonb)
returns jsonb
language plpgsql
security definer
set search_path = mvl, public
as $$
declare
  v_court_1 jsonb;
  v_court_2 jsonb;
  v_streams jsonb;
  v_primary jsonb;
  v_value jsonb;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_streams is null
    or jsonb_typeof(p_streams) <> 'array'
    or jsonb_array_length(p_streams) <> 2
  then
    raise exception 'Provide one livestream configuration for each court';
  end if;

  v_court_1 := p_streams->0;
  v_court_2 := p_streams->1;

  if coalesce((v_court_1->>'is_live')::boolean, false)
    and coalesce(v_court_1->>'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$'
  then
    raise exception 'Court 1 needs a valid YouTube livestream link before it can go live';
  end if;
  if coalesce((v_court_2->>'is_live')::boolean, false)
    and coalesce(v_court_2->>'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$'
  then
    raise exception 'Court 2 needs a valid YouTube livestream link before it can go live';
  end if;

  v_streams := jsonb_build_array(
    jsonb_build_object(
      'court', 'Court 1',
      'is_live', coalesce((v_court_1->>'is_live')::boolean, false),
      'youtube_url', coalesce(nullif(trim(v_court_1->>'youtube_url'), ''), 'https://www.youtube.com/@metaricevolley'),
      'youtube_id', coalesce(trim(v_court_1->>'youtube_id'), '')
    ),
    jsonb_build_object(
      'court', 'Court 2',
      'is_live', coalesce((v_court_2->>'is_live')::boolean, false),
      'youtube_url', coalesce(nullif(trim(v_court_2->>'youtube_url'), ''), 'https://www.youtube.com/@metaricevolley'),
      'youtube_id', coalesce(trim(v_court_2->>'youtube_id'), '')
    )
  );

  v_primary := case
    when (v_streams->0->>'is_live')::boolean then v_streams->0
    when (v_streams->1->>'is_live')::boolean then v_streams->1
    else v_streams->0
  end;
  v_value := jsonb_build_object(
    'streams', v_streams,
    'is_live', (v_streams->0->>'is_live')::boolean or (v_streams->1->>'is_live')::boolean,
    'youtube_url', v_primary->>'youtube_url',
    'youtube_id', v_primary->>'youtube_id'
  );

  insert into mvl.site_settings (key, value, updated_at, updated_by)
  values ('livestream', v_value, now(), auth.uid())
  on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return v_value;
end;
$$;

revoke all on function public.mvl_admin_update_livestreams(jsonb) from public;
grant execute on function public.mvl_admin_update_livestreams(jsonb) to authenticated;

alter table mvl.scoreboards
  add column if not exists game_id text references mvl.games(id) on delete set null,
  add column if not exists current_set integer not null default 1 check (current_set between 1 and 5);

create index if not exists scoreboards_game_idx on mvl.scoreboards (game_id) where game_id is not null;

create or replace function mvl.scoreboard_payload(p_board mvl.scoreboards, p_include_control_token boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = mvl, public
as $$
  select jsonb_build_object(
    'id', p_board.id,
    'name', p_board.name,
    'leftScore', p_board.left_score,
    'rightScore', p_board.right_score,
    'leftSets', p_board.left_sets,
    'rightSets', p_board.right_sets,
    'servingSide', p_board.serving_side,
    'currentSet', p_board.current_set,
    'updatedAt', p_board.updated_at,
    'leftTeam', jsonb_build_object('id', l.id, 'name', l.name, 'colorA', l.color_a, 'colorB', l.color_b),
    'rightTeam', jsonb_build_object('id', r.id, 'name', r.name, 'colorA', r.color_a, 'colorB', r.color_b),
    'game', (
      select jsonb_build_object(
        'id', g.id,
        'day', g.day,
        'startsAt', g.starts_at,
        'status', g.status,
        'maxSets', case when g.id like 'pre-%' then 3 else 5 end,
        'court', coalesce(v.name, 'Gameville Ball Park'),
        'teamA', g.team_a_id,
        'teamB', g.team_b_id
      )
      from mvl.games g
      left join mvl.venues v on v.id = g.venue_id
      where g.id = p_board.game_id
    ),
    'savedSets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'setNumber', gs.set_number,
        'teamAScore', gs.team_a_score,
        'teamBScore', gs.team_b_score,
        'leftScore', case when p_board.team_left_id = g.team_a_id then gs.team_a_score else gs.team_b_score end,
        'rightScore', case when p_board.team_right_id = g.team_b_id then gs.team_b_score else gs.team_a_score end
      ) order by gs.set_number)
      from mvl.game_sets gs
      join mvl.games g on g.id = gs.game_id
      where gs.game_id = p_board.game_id
    ), '[]'::jsonb)
  ) || case when p_include_control_token
    then jsonb_build_object('controlToken', p_board.control_token)
    else '{}'::jsonb end
  from mvl.teams l, mvl.teams r
  where l.id = p_board.team_left_id and r.id = p_board.team_right_id
$$;

revoke all on function mvl.scoreboard_payload(mvl.scoreboards, boolean) from public;

create or replace function public.mvl_scoreboard_get_games(p_scoreboard_id uuid, p_control_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public
as $$
begin
  if not exists (
    select 1 from mvl.scoreboards
    where id = p_scoreboard_id and control_token = p_control_token and archived_at is null
  ) then
    raise exception 'This scoreboard control link is invalid or inactive';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'day', g.day,
      'startsAt', g.starts_at,
      'status', g.status,
      'court', coalesce(v.name, 'Gameville Ball Park'),
      'teamA', g.team_a_id,
      'teamB', g.team_b_id,
      'teamAName', a.name,
      'teamBName', b.name
    ) order by g.starts_at, g.game_order, g.id)
    from mvl.games g
    join mvl.teams a on a.id = g.team_a_id
    join mvl.teams b on b.id = g.team_b_id
    left join mvl.venues v on v.id = g.venue_id
    where g.status <> 'cancelled'
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.mvl_scoreboard_get_games(uuid, uuid) to anon, authenticated;

create or replace function public.mvl_scoreboard_set_game(
  p_scoreboard_id uuid,
  p_control_token uuid,
  p_game_id text
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public
as $$
declare
  v_board mvl.scoreboards;
  v_game mvl.games;
  v_next_set integer;
begin
  select * into v_board
  from mvl.scoreboards
  where id = p_scoreboard_id and control_token = p_control_token and archived_at is null
  for update;
  if not found then raise exception 'This scoreboard control link is invalid or inactive'; end if;

  if nullif(trim(p_game_id), '') is null then
    update mvl.scoreboards
    set game_id = null, current_set = 1, updated_at = now()
    where id = v_board.id returning * into v_board;
    return mvl.scoreboard_payload(v_board, false);
  end if;

  select * into v_game from mvl.games where id = p_game_id;
  if not found then raise exception 'Game not found'; end if;
  if v_game.status = 'cancelled' then raise exception 'A cancelled game cannot be scored'; end if;

  select least(
    coalesce(max(set_number) + 1, 1),
    case when v_game.id like 'pre-%' then 3 else 5 end
  )
  into v_next_set
  from mvl.game_sets
  where game_id = v_game.id;

  update mvl.scoreboards
  set game_id = v_game.id,
      team_left_id = v_game.team_a_id,
      team_right_id = v_game.team_b_id,
      left_score = 0,
      right_score = 0,
      left_sets = (select count(*) from mvl.game_sets where game_id = v_game.id and winner_team_id = v_game.team_a_id),
      right_sets = (select count(*) from mvl.game_sets where game_id = v_game.id and winner_team_id = v_game.team_b_id),
      serving_side = null,
      current_set = v_next_set,
      updated_at = now()
  where id = v_board.id
  returning * into v_board;

  return mvl.scoreboard_payload(v_board, false);
end;
$$;

grant execute on function public.mvl_scoreboard_set_game(uuid, uuid, text) to anon, authenticated;

create or replace function public.mvl_scoreboard_set_current_set(
  p_scoreboard_id uuid,
  p_control_token uuid,
  p_set_number integer
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public
as $$
declare
  v_board mvl.scoreboards;
  v_game mvl.games;
  v_set mvl.game_sets;
begin
  if p_set_number not between 1 and 5 then raise exception 'Set number must be between 1 and 5'; end if;
  select * into v_board
  from mvl.scoreboards
  where id = p_scoreboard_id and control_token = p_control_token and archived_at is null
  for update;
  if not found then raise exception 'This scoreboard control link is invalid or inactive'; end if;
  if v_board.game_id is null then raise exception 'Choose a game before selecting a set'; end if;

  select * into v_game from mvl.games where id = v_board.game_id;
  if v_game.id like 'pre-%' and p_set_number > 3 then
    raise exception 'Preliminary Round games have a maximum of three sets';
  end if;
  select * into v_set from mvl.game_sets
  where game_id = v_board.game_id and set_number = p_set_number;

  update mvl.scoreboards
  set current_set = p_set_number,
      left_score = case
        when v_set.id is null then 0
        when team_left_id = v_game.team_a_id then v_set.team_a_score
        else v_set.team_b_score end,
      right_score = case
        when v_set.id is null then 0
        when team_right_id = v_game.team_b_id then v_set.team_b_score
        else v_set.team_a_score end,
      serving_side = null,
      updated_at = now()
  where id = v_board.id
  returning * into v_board;
  return mvl.scoreboard_payload(v_board, false);
end;
$$;

grant execute on function public.mvl_scoreboard_set_current_set(uuid, uuid, integer) to anon, authenticated;

create or replace function public.mvl_scoreboard_save_set(
  p_scoreboard_id uuid,
  p_control_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public
as $$
declare
  v_board mvl.scoreboards;
  v_game mvl.games;
  v_team_a_score integer;
  v_team_b_score integer;
  v_next_set integer;
begin
  select * into v_board
  from mvl.scoreboards
  where id = p_scoreboard_id and control_token = p_control_token and archived_at is null
  for update;
  if not found then raise exception 'This scoreboard control link is invalid or inactive'; end if;
  if v_board.game_id is null then raise exception 'Choose a game before saving a set'; end if;
  if v_board.left_score = v_board.right_score then raise exception 'A completed set cannot have a tied score'; end if;

  select * into v_game from mvl.games where id = v_board.game_id for update;
  if v_board.team_left_id not in (v_game.team_a_id, v_game.team_b_id)
    or v_board.team_right_id not in (v_game.team_a_id, v_game.team_b_id)
  then
    raise exception 'The scoreboard teams do not match the selected game';
  end if;

  v_team_a_score := case when v_board.team_left_id = v_game.team_a_id then v_board.left_score else v_board.right_score end;
  v_team_b_score := case when v_board.team_right_id = v_game.team_b_id then v_board.right_score else v_board.left_score end;

  insert into mvl.game_sets (game_id, set_number, team_a_score, team_b_score, winner_team_id)
  values (
    v_game.id,
    v_board.current_set,
    v_team_a_score,
    v_team_b_score,
    case when v_team_a_score > v_team_b_score then v_game.team_a_id else v_game.team_b_id end
  )
  on conflict (game_id, set_number) do update
  set team_a_score = excluded.team_a_score,
      team_b_score = excluded.team_b_score,
      winner_team_id = excluded.winner_team_id;

  update mvl.games set status = 'live'
  where id = v_game.id and status = 'pending';

  v_next_set := least(
    v_board.current_set + 1,
    case when v_game.id like 'pre-%' then 3 else 5 end
  );
  update mvl.scoreboards
  set left_score = 0,
      right_score = 0,
      left_sets = (select count(*) from mvl.game_sets where game_id = v_game.id and winner_team_id = team_left_id),
      right_sets = (select count(*) from mvl.game_sets where game_id = v_game.id and winner_team_id = team_right_id),
      serving_side = null,
      current_set = v_next_set,
      updated_at = now()
  where id = v_board.id
  returning * into v_board;
  return mvl.scoreboard_payload(v_board, false);
end;
$$;

grant execute on function public.mvl_scoreboard_save_set(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
