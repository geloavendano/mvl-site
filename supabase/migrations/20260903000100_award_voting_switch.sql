-- Admin switch for the special-awards ballot.
--
-- Stored in mvl.site_settings like the livestream config. The public payload
-- carries it so /mvl/vote can show a closed state, but the gate that matters
-- is in mvl_submit_award_votes: a client-side check alone is bypassable, and
-- that RPC is reachable with the public anon key.
--
-- Apply individually, NOT with `supabase db push`.

insert into mvl.site_settings (key, value, updated_at)
values ('award_voting', '{"is_open": true}'::jsonb, now())
on conflict (key) do nothing;

create or replace function public.mvl_admin_set_award_voting(p_open boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'mvl', 'public'
as $function$
declare
  v_value jsonb;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  v_value := jsonb_build_object('is_open', coalesce(p_open, true));
  insert into mvl.site_settings (key, value, updated_at, updated_by)
  values ('award_voting', v_value, now(), auth.uid())
  on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return v_value;
end;
$function$;

grant execute on function public.mvl_admin_set_award_voting(boolean) to authenticated;

create or replace function public.mvl_get_public_data()
returns jsonb
language sql
stable
security definer
set search_path to 'mvl', 'public'
as $function$

select jsonb_build_object(
  'livestream', coalesce(
    (select value from mvl.site_settings where key = 'livestream'),
    '{}'::jsonb
  ),
  -- Award voting open/closed. A missing row means open, so the ballot keeps
  -- working on a database that predates this switch.
  'voting', coalesce(
    (select value from mvl.site_settings where key = 'award_voting'),
    '{"is_open": true}'::jsonb
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

$function$;

create or replace function public.mvl_submit_award_votes(
  p_team_id text, p_jersey_number text, p_email text, p_votes jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'mvl', 'public'
as $function$
declare
  v_player mvl.players;
  v_count int;
  v_inserted int;
begin
  -- checked before the voter is even resolved, so a closed ballot records nothing
  if not coalesce(
       (select (value->>'is_open')::boolean from mvl.site_settings where key = 'award_voting'),
       true)
  then
    raise exception 'VOTING_CLOSED';
  end if;

  v_player := mvl.award_voter(p_team_id, p_jersey_number, p_email);

  if exists (select 1 from mvl.award_votes v where v.voter_player_id = v_player.id) then
    raise exception 'ALREADY_VOTED';
  end if;

  if p_votes is null or jsonb_typeof(p_votes) <> 'array' or jsonb_array_length(p_votes) = 0 then
    raise exception 'NO_VOTES';
  end if;

  select count(*) into v_count
  from jsonb_array_elements(p_votes) e
  where not exists (
    select 1 from mvl.players p where p.id = (e->>'nominee_player_id')::uuid
  );
  if v_count > 0 then
    raise exception 'UNKNOWN_NOMINEE';
  end if;

  insert into mvl.award_votes (voter_player_id, award_id, nominee_player_id)
  select v_player.id, e->>'award_id', (e->>'nominee_player_id')::uuid
  from jsonb_array_elements(p_votes) e;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'id', v_player.id,
      'display_name', v_player.display_name,
      'surname', v_player.surname,
      'jersey_number', v_player.jersey_number,
      'team_id', v_player.team_id
    ),
    'votes', v_inserted
  );
end;
$function$;
