-- Player of the Game lookup and public player-photo support.

alter table mvl.players
  add column if not exists surname text,
  add column if not exists photo_path text;

update mvl.players
set surname = regexp_replace(trim(display_name), '^.*\s+', '')
where surname is null;

alter table mvl.players
  drop constraint if exists players_jersey_number_format;

alter table mvl.players
  add constraint players_jersey_number_format
    check (jersey_number is null or jersey_number ~ '^[0-9]{1,3}$');

create unique index if not exists players_team_jersey_unique
  on mvl.players (team_id, (ltrim(jersey_number, '0')))
  where jersey_number ~ '^[0-9]+$';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'mvl-player-photos',
  'mvl-player-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.mvl_admin_lookup_player(
  p_game_id text,
  p_winner_team_id text,
  p_lookup text
) returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public
as $$
declare
  v_game mvl.games;
  v_player mvl.players;
  v_match text[];
  v_surname text;
  v_jersey integer;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_game
  from mvl.games
  where id = p_game_id;

  if not found then
    raise exception 'Game % not found', p_game_id;
  end if;

  if p_winner_team_id not in (v_game.team_a_id, v_game.team_b_id) then
    raise exception 'Choose the winning team before looking up a player';
  end if;

  v_match := regexp_match(lower(trim(coalesce(p_lookup, ''))), '^(.+)-([0-9]{1,3})$');
  if v_match is null then
    raise exception 'Use surname-jersey format, for example santos-04';
  end if;

  v_surname := trim(both '-' from regexp_replace(v_match[1], '[^a-z0-9]+', '-', 'g'));
  v_jersey := v_match[2]::integer;

  select p.* into v_player
  from mvl.players p
  where p.team_id = p_winner_team_id
    and regexp_replace(
      lower(trim(coalesce(p.surname, regexp_replace(p.display_name, '^.*\s+', '')))),
      '[^a-z0-9]+',
      '-',
      'g'
    ) = v_surname
    and p.jersey_number ~ '^[0-9]+$'
    and p.jersey_number::integer = v_jersey
  limit 1;

  if not found then
    raise exception 'No player matching % was found on the winning team', lower(trim(p_lookup));
  end if;

  return jsonb_build_object(
    'id', v_player.id,
    'name', v_player.display_name,
    'surname', v_player.surname,
    'jerseyNumber', v_player.jersey_number,
    'team', v_player.team_id,
    'photoPath', coalesce(v_player.photo_path, v_player.photo_url),
    'lookupKey',
      regexp_replace(
        lower(trim(coalesce(v_player.surname, regexp_replace(v_player.display_name, '^.*\s+', '')))),
        '[^a-z0-9]+',
        '-',
        'g'
      ) || '-' || lpad(v_player.jersey_number, 2, '0')
  );
end;
$$;

revoke all on function public.mvl_admin_lookup_player(text, text, text) from public;
grant execute on function public.mvl_admin_lookup_player(text, text, text) to authenticated;

create or replace function mvl.enforce_player_of_game_from_winner()
returns trigger
language plpgsql
set search_path = mvl, public
as $$
declare
  v_player_team text;
begin
  if new.player_of_game_id is null then
    return new;
  end if;

  select team_id into v_player_team
  from mvl.players
  where id = new.player_of_game_id;

  if new.winner_team_id is null or v_player_team is distinct from new.winner_team_id then
    raise exception 'Player of the Game must belong to the winning team';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_player_of_game_from_winner on mvl.games;
create trigger enforce_player_of_game_from_winner
before insert or update of winner_team_id, player_of_game_id
on mvl.games
for each row
execute function mvl.enforce_player_of_game_from_winner();

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
      'youtubeId', coalesce(vid.youtube_id, ''),
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
      select youtube_id, duration_seconds
      from mvl.game_videos x
      where x.game_id = g.id
      order by is_featured desc, published_at desc nulls last, created_at desc
      limit 1
    ) vid on true
  ), '[]'::jsonb)
)
$$;

grant execute on function public.mvl_get_public_data() to anon, authenticated;

