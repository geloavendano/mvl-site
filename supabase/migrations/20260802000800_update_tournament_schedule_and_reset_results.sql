-- Update the MVL 2026 public schedule and reset all games to pending.
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260802000800_update_tournament_schedule_and_reset_results.sql

begin;

delete from mvl.game_sets;
delete from mvl.game_videos;

update mvl.games
set status = 'pending',
    winner_team_id = null,
    player_of_game_id = null;

update mvl.games as g
set day = v.day,
    game_order = v.game_order,
    venue_id = v.venue_id::uuid,
    starts_at = v.starts_at::timestamptz,
    team_a_id = v.team_a_id,
    team_b_id = v.team_b_id,
    team_a_label = nullif(v.team_a_label, ''),
    team_b_label = nullif(v.team_b_label, ''),
    status = 'pending',
    winner_team_id = null,
    player_of_game_id = null
from (values
  -- August 29
  ('pre-01', 1, 1, '11111111-1111-4111-8111-111111111111', '2026-08-29 16:00:00+08', 'up-leftout', 'gizmo', '', ''),
  ('pre-02', 1, 2, '22222222-2222-4222-8222-222222222222', '2026-08-29 16:00:00+08', 'thurstrap', 's24', '', ''),
  ('pre-03', 1, 3, '11111111-1111-4111-8111-111111111111', '2026-08-29 17:20:00+08', 'metarice-x', 'ssvc', '', ''),
  ('pre-04', 1, 4, '22222222-2222-4222-8222-222222222222', '2026-08-29 17:20:00+08', 'metarice-y', 'gremlins', '', ''),
  ('pre-05', 1, 5, '11111111-1111-4111-8111-111111111111', '2026-08-29 18:40:00+08', 'up-leftout', 's24', '', ''),
  ('pre-06', 1, 6, '22222222-2222-4222-8222-222222222222', '2026-08-29 18:40:00+08', 'gizmo', 'ssvc', '', ''),
  ('pre-07', 1, 7, '11111111-1111-4111-8111-111111111111', '2026-08-29 20:00:00+08', 'thurstrap', 'gremlins', '', ''),
  ('pre-08', 1, 8, '22222222-2222-4222-8222-222222222222', '2026-08-29 20:00:00+08', 'metarice-x', 'metarice-y', '', ''),

  -- August 30
  ('pre-09', 2, 1, '11111111-1111-4111-8111-111111111111', '2026-08-30 15:00:00+08', 'up-leftout', 'ssvc', '', ''),
  ('pre-10', 2, 2, '22222222-2222-4222-8222-222222222222', '2026-08-30 15:00:00+08', 'gizmo', 'metarice-y', '', ''),
  ('pre-11', 2, 3, '11111111-1111-4111-8111-111111111111', '2026-08-30 16:20:00+08', 's24', 'gremlins', '', ''),
  ('pre-12', 2, 4, '22222222-2222-4222-8222-222222222222', '2026-08-30 16:20:00+08', 'thurstrap', 'metarice-x', '', ''),
  ('pre-13', 2, 5, '11111111-1111-4111-8111-111111111111', '2026-08-30 17:40:00+08', 'up-leftout', 'gremlins', '', ''),
  ('pre-14', 2, 6, '22222222-2222-4222-8222-222222222222', '2026-08-30 17:40:00+08', 'ssvc', 'metarice-y', '', ''),
  ('pre-15', 2, 7, '11111111-1111-4111-8111-111111111111', '2026-08-30 19:00:00+08', 's24', 'metarice-x', '', ''),
  ('pre-16', 2, 8, '22222222-2222-4222-8222-222222222222', '2026-08-30 19:00:00+08', 'gizmo', 'thurstrap', '', ''),

  -- August 31
  ('pre-17', 3, 1, '11111111-1111-4111-8111-111111111111', '2026-08-31 15:00:00+08', 'up-leftout', 'metarice-y', '', ''),
  ('pre-18', 3, 2, '22222222-2222-4222-8222-222222222222', '2026-08-31 15:00:00+08', 'ssvc', 'thurstrap', '', ''),
  ('pre-19', 3, 3, '11111111-1111-4111-8111-111111111111', '2026-08-31 16:20:00+08', 'gremlins', 'metarice-x', '', ''),
  ('pre-20', 3, 4, '22222222-2222-4222-8222-222222222222', '2026-08-31 16:20:00+08', 's24', 'gizmo', '', ''),
  ('pre-21', 3, 5, '11111111-1111-4111-8111-111111111111', '2026-08-31 17:40:00+08', 'metarice-y', 'thurstrap', '', ''),
  ('pre-22', 3, 6, '22222222-2222-4222-8222-222222222222', '2026-08-31 17:40:00+08', 'ssvc', 's24', '', ''),
  ('pre-23', 3, 7, '11111111-1111-4111-8111-111111111111', '2026-08-31 19:00:00+08', 'up-leftout', 'metarice-x', '', ''),
  ('pre-24', 3, 8, '22222222-2222-4222-8222-222222222222', '2026-08-31 19:00:00+08', 'gremlins', 'gizmo', '', ''),

  -- September 5
  ('pre-25', 4, 1, '11111111-1111-4111-8111-111111111111', '2026-09-05 13:00:00+08', 'up-leftout', 'thurstrap', '', ''),
  ('pre-26', 4, 2, '22222222-2222-4222-8222-222222222222', '2026-09-05 13:00:00+08', 'metarice-x', 'gizmo', '', ''),
  ('pre-27', 4, 3, '11111111-1111-4111-8111-111111111111', '2026-09-05 14:20:00+08', 'gremlins', 'ssvc', '', ''),
  ('pre-28', 4, 4, '22222222-2222-4222-8222-222222222222', '2026-09-05 14:20:00+08', 's24', 'metarice-y', '', ''),
  ('qf1', 4, 5, '11111111-1111-4111-8111-111111111111', '2026-09-05 16:00:00+08', 'thurstrap', 'ssvc', '3rd Seed', '6th Seed'),
  ('qf2', 4, 6, '22222222-2222-4222-8222-222222222222', '2026-09-05 16:00:00+08', 'gizmo', 'gremlins', '4th Seed', '5th Seed'),
  ('qf3', 4, 7, '11111111-1111-4111-8111-111111111111', '2026-09-05 18:30:00+08', 'metarice-y', 's24', '2nd Seed', '7th Seed'),
  ('qf4', 4, 8, '22222222-2222-4222-8222-222222222222', '2026-09-05 18:30:00+08', 'metarice-x', 'up-leftout', '1st Seed', '8th Seed'),

  -- September 6
  ('sf1', 5, 1, '11111111-1111-4111-8111-111111111111', '2026-09-06 13:00:00+08', 'metarice-x', 'up-leftout', 'Winner QF1', 'Winner QF4'),
  ('sf2', 5, 2, '22222222-2222-4222-8222-222222222222', '2026-09-06 13:00:00+08', 'gizmo', 's24', 'Winner QF2', 'Winner QF3'),
  ('bronze', 5, 3, '11111111-1111-4111-8111-111111111111', '2026-09-06 16:00:00+08', 'metarice-x', 'gizmo', 'Loser SF1', 'Loser SF2'),
  ('final', 5, 4, '11111111-1111-4111-8111-111111111111', '2026-09-06 19:00:00+08', 'metarice-x', 'gizmo', 'Winner SF1', 'Winner SF2')
) as v(
  id,
  day,
  game_order,
  venue_id,
  starts_at,
  team_a_id,
  team_b_id,
  team_a_label,
  team_b_label
)
where g.id = v.id;

do $$
declare
  v_expected integer := 36;
  v_updated integer;
begin
  select count(*) into v_updated
  from mvl.games
  where id in (
    'pre-01','pre-02','pre-03','pre-04','pre-05','pre-06','pre-07','pre-08',
    'pre-09','pre-10','pre-11','pre-12','pre-13','pre-14','pre-15','pre-16',
    'pre-17','pre-18','pre-19','pre-20','pre-21','pre-22','pre-23','pre-24',
    'pre-25','pre-26','pre-27','pre-28','qf1','qf2','qf3','qf4',
    'sf1','sf2','bronze','final'
  );

  if v_updated <> v_expected then
    raise exception 'Expected % scheduled games, found %', v_expected, v_updated;
  end if;
end $$;

commit;
