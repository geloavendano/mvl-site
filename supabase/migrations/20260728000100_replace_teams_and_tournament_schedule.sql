-- Replace the tournament schedule supplied on July 28, 2026.
-- Placeholder time slots are used because only dates, courts, and order were supplied.
-- Team mapping: A Metarice X, B Metarice Y, C Thurstrap, D Gizmo,
-- E Gremlins, F SSVC, G S24, H Secret.

alter table mvl.games add column if not exists team_a_label text;
alter table mvl.games add column if not exists team_b_label text;

update mvl.teams set name = 'Secret' where id = 'up-leftout';
update mvl.venues set name = 'Gameville Ball Park · Court 1'
where id = '11111111-1111-4111-8111-111111111111';
update mvl.venues set name = 'Gameville Ball Park · Court 2'
where id = '22222222-2222-4222-8222-222222222222';

delete from mvl.games;

insert into mvl.games (
  id, day, game_order, venue_id, starts_at, team_a_id, team_b_id,
  team_a_label, team_b_label, status, winner_team_id
) values
  -- August 29 · Court 1 / Court 2
  ('pre-01', 1, 1, '11111111-1111-4111-8111-111111111111', '2026-08-29T09:00:00+08:00', 'metarice-x', 'up-leftout', null, null, 'pending', null),
  ('pre-02', 1, 2, '22222222-2222-4222-8222-222222222222', '2026-08-29T09:00:00+08:00', 'metarice-y', 's24', null, null, 'pending', null),
  ('pre-03', 1, 3, '11111111-1111-4111-8111-111111111111', '2026-08-29T10:30:00+08:00', 'thurstrap', 'ssvc', null, null, 'pending', null),
  ('pre-04', 1, 4, '22222222-2222-4222-8222-222222222222', '2026-08-29T10:30:00+08:00', 'gizmo', 'gremlins', null, null, 'pending', null),
  ('pre-05', 1, 5, '11111111-1111-4111-8111-111111111111', '2026-08-29T12:00:00+08:00', 'metarice-x', 's24', null, null, 'pending', null),
  ('pre-06', 1, 6, '22222222-2222-4222-8222-222222222222', '2026-08-29T12:00:00+08:00', 'up-leftout', 'ssvc', null, null, 'pending', null),
  ('pre-07', 1, 7, '11111111-1111-4111-8111-111111111111', '2026-08-29T13:30:00+08:00', 'metarice-y', 'gremlins', null, null, 'pending', null),
  ('pre-08', 1, 8, '22222222-2222-4222-8222-222222222222', '2026-08-29T13:30:00+08:00', 'thurstrap', 'gizmo', null, null, 'pending', null),

  -- August 30 · Court 1 / Court 2
  ('pre-09', 2, 1, '11111111-1111-4111-8111-111111111111', '2026-08-30T09:00:00+08:00', 'metarice-x', 'ssvc', null, null, 'pending', null),
  ('pre-10', 2, 2, '22222222-2222-4222-8222-222222222222', '2026-08-30T09:00:00+08:00', 's24', 'gremlins', null, null, 'pending', null),
  ('pre-11', 2, 3, '11111111-1111-4111-8111-111111111111', '2026-08-30T10:30:00+08:00', 'up-leftout', 'gizmo', null, null, 'pending', null),
  ('pre-12', 2, 4, '22222222-2222-4222-8222-222222222222', '2026-08-30T10:30:00+08:00', 'metarice-y', 'thurstrap', null, null, 'pending', null),
  ('pre-13', 2, 5, '11111111-1111-4111-8111-111111111111', '2026-08-30T12:00:00+08:00', 'metarice-x', 'gremlins', null, null, 'pending', null),
  ('pre-14', 2, 6, '22222222-2222-4222-8222-222222222222', '2026-08-30T12:00:00+08:00', 'ssvc', 'gizmo', null, null, 'pending', null),
  ('pre-15', 2, 7, '11111111-1111-4111-8111-111111111111', '2026-08-30T13:30:00+08:00', 's24', 'thurstrap', null, null, 'pending', null),
  ('pre-16', 2, 8, '22222222-2222-4222-8222-222222222222', '2026-08-30T13:30:00+08:00', 'up-leftout', 'metarice-y', null, null, 'pending', null),

  -- August 31 · Court 1 / Court 2
  ('pre-17', 3, 1, '11111111-1111-4111-8111-111111111111', '2026-08-31T09:00:00+08:00', 'metarice-x', 'gizmo', null, null, 'pending', null),
  ('pre-18', 3, 2, '22222222-2222-4222-8222-222222222222', '2026-08-31T09:00:00+08:00', 'gremlins', 'thurstrap', null, null, 'pending', null),
  ('pre-19', 3, 3, '11111111-1111-4111-8111-111111111111', '2026-08-31T10:30:00+08:00', 'ssvc', 'metarice-y', null, null, 'pending', null),
  ('pre-20', 3, 4, '22222222-2222-4222-8222-222222222222', '2026-08-31T10:30:00+08:00', 's24', 'up-leftout', null, null, 'pending', null),
  ('pre-21', 3, 5, '11111111-1111-4111-8111-111111111111', '2026-08-31T12:00:00+08:00', 'metarice-x', 'thurstrap', null, null, 'pending', null),
  ('pre-22', 3, 6, '22222222-2222-4222-8222-222222222222', '2026-08-31T12:00:00+08:00', 'gizmo', 'metarice-y', null, null, 'pending', null),
  ('pre-23', 3, 7, '11111111-1111-4111-8111-111111111111', '2026-08-31T13:30:00+08:00', 'gremlins', 'up-leftout', null, null, 'pending', null),
  ('pre-24', 3, 8, '22222222-2222-4222-8222-222222222222', '2026-08-31T13:30:00+08:00', 'ssvc', 's24', null, null, 'pending', null),

  -- September 5 · final preliminary matches and Quarter-Finals
  ('pre-25', 4, 1, '11111111-1111-4111-8111-111111111111', '2026-09-05T09:00:00+08:00', 'metarice-x', 'metarice-y', null, null, 'pending', null),
  ('pre-26', 4, 2, '22222222-2222-4222-8222-222222222222', '2026-09-05T09:00:00+08:00', 'thurstrap', 'up-leftout', null, null, 'pending', null),
  ('pre-27', 4, 3, '11111111-1111-4111-8111-111111111111', '2026-09-05T10:30:00+08:00', 'gremlins', 'ssvc', null, null, 'pending', null),
  ('pre-28', 4, 4, '22222222-2222-4222-8222-222222222222', '2026-09-05T10:30:00+08:00', 'gizmo', 's24', null, null, 'pending', null),
  ('qf1', 4, 5, '11111111-1111-4111-8111-111111111111', '2026-09-05T12:00:00+08:00', 'thurstrap', 'ssvc', '3rd Seed', '6th Seed', 'pending', null),
  ('qf2', 4, 6, '22222222-2222-4222-8222-222222222222', '2026-09-05T12:00:00+08:00', 'gizmo', 'gremlins', '4th Seed', '5th Seed', 'pending', null),
  ('qf3', 4, 7, '11111111-1111-4111-8111-111111111111', '2026-09-05T13:30:00+08:00', 'metarice-y', 's24', '2nd Seed', '7th Seed', 'pending', null),
  ('qf4', 4, 8, '22222222-2222-4222-8222-222222222222', '2026-09-05T13:30:00+08:00', 'metarice-x', 'up-leftout', '1st Seed', '8th Seed', 'pending', null),

  -- September 6 · Semi-Finals, third place, and Finals
  ('sf1', 5, 1, '11111111-1111-4111-8111-111111111111', '2026-09-06T09:00:00+08:00', 'metarice-x', 'up-leftout', 'Winner QF1', 'Winner QF4', 'pending', null),
  ('sf2', 5, 2, '22222222-2222-4222-8222-222222222222', '2026-09-06T09:00:00+08:00', 'gizmo', 's24', 'Winner QF2', 'Winner QF3', 'pending', null),
  ('bronze', 5, 3, '11111111-1111-4111-8111-111111111111', '2026-09-06T11:00:00+08:00', 'metarice-x', 'gizmo', 'Loser SF1', 'Loser SF2', 'pending', null),
  ('final', 5, 4, '11111111-1111-4111-8111-111111111111', '2026-09-06T13:00:00+08:00', 'metarice-x', 'gizmo', 'Winner SF1', 'Winner SF2', 'pending', null);

alter table mvl.games drop constraint if exists final_games_require_actual_teams;
alter table mvl.games add constraint final_games_require_actual_teams check (
  status <> 'final' or (team_a_label is null and team_b_label is null)
);

create or replace function public.mvl_get_public_data() returns jsonb language sql stable security definer set search_path=mvl,public as $$
select jsonb_build_object(
 'livestream',coalesce((select value from mvl.site_settings where key='livestream'),'{}'::jsonb),
 'games',coalesce((select jsonb_agg(jsonb_build_object(
  'id',g.id,'day',g.day,'gameOrder',g.game_order,'court',coalesce(v.name,'Gameville Ball Park'),'startsAt',g.starts_at,
  'teamA',g.team_a_id,'teamB',g.team_b_id,'teamALabel',g.team_a_label,'teamBLabel',g.team_b_label,
  'status',g.status,'winner',g.winner_team_id,
  'playerOfGame',case when p.id is null then null else jsonb_build_object('name',p.display_name,'team',p.team_id) end,
  'sets',coalesce((select jsonb_agg(jsonb_build_object('a',s.team_a_score,'b',s.team_b_score) order by s.set_number) from mvl.game_sets s where s.game_id=g.id),'[]'::jsonb),
  'youtubeId',coalesce(vid.youtube_id,''),
  'duration',case when vid.duration_seconds is null then '' else concat(floor(vid.duration_seconds/3600),':',lpad(floor((vid.duration_seconds%3600)/60)::text,2,'0'),':',lpad((vid.duration_seconds%60)::text,2,'0')) end
 ) order by g.day,g.game_order,g.starts_at,g.id) from mvl.games g left join mvl.venues v on v.id=g.venue_id left join mvl.players p on p.id=g.player_of_game_id
 left join lateral(select youtube_id,duration_seconds from mvl.game_videos x where x.game_id=g.id order by is_featured desc,published_at desc nulls last,created_at desc limit 1) vid on true),'[]'::jsonb)
) $$;
grant execute on function public.mvl_get_public_data() to anon,authenticated;

drop function if exists public.mvl_admin_update_game_schedule(text,integer,integer,timestamptz,text,text);
create function public.mvl_admin_update_game_schedule(
  p_game_id text, p_day integer, p_game_order integer, p_starts_at timestamptz,
  p_team_a_id text, p_team_b_id text, p_team_a_label text, p_team_b_label text
) returns jsonb language plpgsql security definer set search_path=mvl,public as $$
declare v_game mvl.games; v_matchup_changed boolean;
begin
  if not mvl.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_day is null or p_day < 1 then raise exception 'Match day must be at least 1'; end if;
  if p_game_order is null or p_game_order < 1 then raise exception 'Game order must be at least 1'; end if;
  if p_starts_at is null then raise exception 'Game date and time are required'; end if;
  if p_team_a_id = p_team_b_id then raise exception 'Team A and Team B must be different'; end if;
  select * into v_game from mvl.games where id=p_game_id for update;
  if not found then raise exception 'Game % not found',p_game_id; end if;
  v_matchup_changed := v_game.team_a_id is distinct from p_team_a_id
    or v_game.team_b_id is distinct from p_team_b_id
    or v_game.team_a_label is distinct from p_team_a_label
    or v_game.team_b_label is distinct from p_team_b_label;
  if v_game.day = p_day and v_game.game_order <> p_game_order then
    if p_game_order < v_game.game_order then
      update mvl.games set game_order=game_order+1 where day=p_day and id<>p_game_id and game_order>=p_game_order and game_order<v_game.game_order;
    else
      update mvl.games set game_order=game_order-1 where day=p_day and id<>p_game_id and game_order>v_game.game_order and game_order<=p_game_order;
    end if;
  elsif v_game.day <> p_day then
    update mvl.games set game_order=game_order-1 where day=v_game.day and id<>p_game_id and game_order>v_game.game_order;
    update mvl.games set game_order=game_order+1 where day=p_day and id<>p_game_id and game_order>=p_game_order;
  end if;
  if v_matchup_changed then
    delete from mvl.game_sets where game_id=p_game_id;
    delete from mvl.game_videos where game_id=p_game_id;
  end if;
  update mvl.games set day=p_day,game_order=p_game_order,starts_at=p_starts_at,
    team_a_id=p_team_a_id,team_b_id=p_team_b_id,
    team_a_label=nullif(trim(p_team_a_label),''),team_b_label=nullif(trim(p_team_b_label),''),
    status=case when v_matchup_changed then 'pending' else status end,
    winner_team_id=case when v_matchup_changed then null else winner_team_id end,
    player_of_game_id=case when v_matchup_changed then null else player_of_game_id end
  where id=p_game_id returning * into v_game;
  return jsonb_build_object('id',v_game.id,'day',v_game.day,'gameOrder',v_game.game_order,
    'startsAt',v_game.starts_at,'teamA',v_game.team_a_id,'teamB',v_game.team_b_id,
    'teamALabel',v_game.team_a_label,'teamBLabel',v_game.team_b_label,
    'matchupChanged',v_matchup_changed);
end $$;
grant execute on function public.mvl_admin_update_game_schedule(text,integer,integer,timestamptz,text,text,text,text) to authenticated;
