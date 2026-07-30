-- Allow one game to have multiple ordered, labeled YouTube recordings.

alter table mvl.game_videos
  add column if not exists label text,
  add column if not exists sort_order integer;

update mvl.game_videos
set
  label = coalesce(nullif(trim(label), ''), 'Full Game'),
  sort_order = coalesce(sort_order, 0);

alter table mvl.game_videos
  alter column label set default 'Full Game',
  alter column label set not null,
  alter column sort_order set default 0,
  alter column sort_order set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'mvl.game_videos'::regclass
      and conname = 'game_videos_label_not_blank'
  ) then
    alter table mvl.game_videos
      add constraint game_videos_label_not_blank
      check (length(trim(label)) between 1 and 80);
  end if;
end;
$$;

create index if not exists game_videos_game_order_idx
  on mvl.game_videos (game_id, sort_order, created_at);

create or replace function public.mvl_admin_save_game_result(
  p_game_id text,
  p_winner_team_id text,
  p_player_of_game_id uuid,
  p_sets jsonb,
  p_videos jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_game mvl.games;
  v_set_count integer;
  v_video_count integer;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_game
  from mvl.games g
  where g.id = p_game_id
  for update;

  if not found then
    raise exception 'Game % not found', p_game_id;
  end if;

  if p_winner_team_id not in (v_game.team_a_id, v_game.team_b_id) then
    raise exception 'Winner must be one of the game teams';
  end if;

  if p_player_of_game_id is not null and not exists (
    select 1
    from mvl.players p
    where p.id = p_player_of_game_id
      and p.team_id = p_winner_team_id
  ) then
    raise exception 'Player of the Game must belong to the winning team';
  end if;

  if p_sets is null
    or jsonb_typeof(p_sets) <> 'array'
    or jsonb_array_length(p_sets) = 0
  then
    raise exception 'At least one set score is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_sets) as row(item)
    where (item->>'team_a_score') is null
      or (item->>'team_b_score') is null
      or (item->>'team_a_score')::integer < 0
      or (item->>'team_b_score')::integer < 0
  ) then
    raise exception 'Every set must have two non-negative scores';
  end if;

  if p_videos is null or jsonb_typeof(p_videos) <> 'array' then
    raise exception 'Videos must be provided as a list';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_videos) as row(item)
    where nullif(trim(item->>'label'), '') is null
      or coalesce(trim(item->>'youtube_id'), '') !~ '^[A-Za-z0-9_-]{11}$'
  ) then
    raise exception 'Every video needs a label and a valid YouTube URL';
  end if;

  if exists (
    select 1
    from (
      select trim(item->>'youtube_id') as youtube_id
      from jsonb_array_elements(p_videos) as row(item)
      group by trim(item->>'youtube_id')
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'The same YouTube video cannot be added twice to one game';
  end if;

  delete from mvl.game_sets gs
  where gs.game_id = p_game_id;

  insert into mvl.game_sets (
    game_id,
    set_number,
    team_a_score,
    team_b_score,
    winner_team_id
  )
  select
    p_game_id,
    row_number::integer,
    (item->>'team_a_score')::integer,
    (item->>'team_b_score')::integer,
    case
      when (item->>'team_a_score')::integer > (item->>'team_b_score')::integer then v_game.team_a_id
      when (item->>'team_b_score')::integer > (item->>'team_a_score')::integer then v_game.team_b_id
      else null
    end
  from jsonb_array_elements(p_sets) with ordinality as row(item, row_number);

  get diagnostics v_set_count = row_count;

  update mvl.games g
  set
    status = 'final',
    winner_team_id = p_winner_team_id,
    player_of_game_id = p_player_of_game_id
  where g.id = p_game_id;

  delete from mvl.game_videos gv
  where gv.game_id = p_game_id;

  insert into mvl.game_videos (
    game_id,
    youtube_id,
    label,
    title,
    duration_seconds,
    published_at,
    is_featured,
    sort_order
  )
  select
    p_game_id,
    trim(item->>'youtube_id'),
    trim(item->>'label'),
    trim(item->>'label'),
    null,
    now(),
    row_number = 1,
    row_number::integer - 1
  from jsonb_array_elements(p_videos) with ordinality as row(item, row_number);

  get diagnostics v_video_count = row_count;

  return jsonb_build_object(
    'gameId', p_game_id,
    'status', 'final',
    'winnerTeamId', p_winner_team_id,
    'playerOfGameId', p_player_of_game_id,
    'setCount', v_set_count,
    'videoCount', v_video_count
  );
end;
$$;

revoke all on function public.mvl_admin_save_game_result(text, text, uuid, jsonb, jsonb) from public;
grant execute on function public.mvl_admin_save_game_result(text, text, uuid, jsonb, jsonb) to authenticated;

create or replace function public.mvl_get_public_data()
returns jsonb
language sql
stable
security definer
set search_path = mvl, public
as $$
select jsonb_build_object(
  'livestream', coalesce(
    (select value from mvl.site_settings where key = 'livestream'),
    '{}'::jsonb
  ),
  'games', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'day', g.day,
      'gameOrder', g.game_order,
      'court', coalesce(v.name, 'Gameville Ball Park'),
      'startsAt', g.starts_at,
      'teamA', g.team_a_id,
      'teamB', g.team_b_id,
      'teamALabel', g.team_a_label,
      'teamBLabel', g.team_b_label,
      'status', g.status,
      'winner', g.winner_team_id,
      'playerOfGame', case when p.id is null then null else jsonb_build_object(
        'id', p.id,
        'name', p.display_name,
        'team', p.team_id,
        'jerseyNumber', p.jersey_number,
        'photoPath', coalesce(p.photo_path, p.photo_url),
        'lookupKey',
          regexp_replace(
            lower(trim(coalesce(p.surname, regexp_replace(p.display_name, '^.*\s+', '')))),
            '[^a-z0-9]+',
            '-',
            'g'
          ) || '-' || lpad(p.jersey_number, 2, '0')
      ) end,
      'sets', coalesce((
        select jsonb_agg(
          jsonb_build_object('a', s.team_a_score, 'b', s.team_b_score)
          order by s.set_number
        )
        from mvl.game_sets s
        where s.game_id = g.id
      ), '[]'::jsonb),
      'videos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id,
          'youtubeId', x.youtube_id,
          'label', x.label,
          'duration', case when x.duration_seconds is null then '' else concat(
            floor(x.duration_seconds / 3600),
            ':',
            lpad(floor((x.duration_seconds % 3600) / 60)::text, 2, '0'),
            ':',
            lpad((x.duration_seconds % 60)::text, 2, '0')
          ) end
        ) order by x.sort_order, x.created_at, x.id)
        from mvl.game_videos x
        where x.game_id = g.id
      ), '[]'::jsonb),
      'youtubeId', coalesce(vid.youtube_id, ''),
      'videoLabel', coalesce(vid.label, ''),
      'duration', case when vid.duration_seconds is null then '' else concat(
        floor(vid.duration_seconds / 3600),
        ':',
        lpad(floor((vid.duration_seconds % 3600) / 60)::text, 2, '0'),
        ':',
        lpad((vid.duration_seconds % 60)::text, 2, '0')
      ) end
    ) order by g.day, g.game_order, g.starts_at, g.id)
    from mvl.games g
    left join mvl.venues v on v.id = g.venue_id
    left join mvl.players p on p.id = g.player_of_game_id
    left join lateral (
      select x.youtube_id, x.label, x.duration_seconds
      from mvl.game_videos x
      where x.game_id = g.id
      order by x.sort_order, x.is_featured desc, x.published_at desc nulls last, x.created_at
      limit 1
    ) vid on true
  ), '[]'::jsonb)
)
$$;

grant execute on function public.mvl_get_public_data() to anon, authenticated;
