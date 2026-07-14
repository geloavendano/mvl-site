insert into mvl.venues (id, name, address, location, checkin_radius_m)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Gameville Ball Park',
    null,
    null,
    150
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Gameville Ball Park',
    null,
    null,
    150
  )
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  checkin_radius_m = excluded.checkin_radius_m;

insert into mvl.teams (id, name, division_label, color_a, color_b, sort_order)
values
  ('metarice-x', 'Metarice X', 'Violet Division', '#7C3BFF', '#2E00A8', 1),
  ('metarice-y', 'Metarice Y', 'Green Division', '#00B453', '#067B45', 2),
  ('thurstrap', 'Thurstrap', 'Aqua Division', '#10E0D4', '#078D96', 3),
  ('gizmo', 'Gizmo', 'Pink Division', '#FF3FB4', '#D50083', 4),
  ('gremlins', 'Gremlins', 'Red Division', '#F51642', '#B90025', 5),
  ('ssvc', 'SSVC', 'Yellow Division', '#FFE44D', '#D6A900', 6),
  ('s24', 'S24', 'Blue Division', '#3478FF', '#0039B8', 7),
  ('up-leftout', 'UP Leftout', 'Orange Division', '#FF9A05', '#FF5A00', 8)
on conflict (id) do update set
  name = excluded.name,
  division_label = excluded.division_label,
  color_a = excluded.color_a,
  color_b = excluded.color_b,
  sort_order = excluded.sort_order;

insert into mvl.games (
  id,
  day,
  venue_id,
  starts_at,
  team_a_id,
  team_b_id,
  status,
  winner_team_id
)
values
  ('g1', 1, '11111111-1111-4111-8111-111111111111', '2026-08-29T21:00:00+08:00', 'metarice-x', 'metarice-y', 'final', 'metarice-y'),
  ('g2', 1, '11111111-1111-4111-8111-111111111111', '2026-08-29T22:00:00+08:00', 'thurstrap', 'gizmo', 'final', 'gizmo'),
  ('g3', 1, '22222222-2222-4222-8222-222222222222', '2026-08-29T23:00:00+08:00', 'gremlins', 'ssvc', 'final', 'ssvc'),
  ('g4', 2, '11111111-1111-4111-8111-111111111111', '2026-08-30T21:00:00+08:00', 's24', 'up-leftout', 'pending', null),
  ('g5', 2, '22222222-2222-4222-8222-222222222222', '2026-08-30T22:00:00+08:00', 'metarice-x', 'thurstrap', 'pending', null),
  ('g6', 3, '11111111-1111-4111-8111-111111111111', '2026-08-31T21:00:00+08:00', 'metarice-y', 'gremlins', 'pending', null),
  ('g7', 4, '11111111-1111-4111-8111-111111111111', '2026-09-05T21:00:00+08:00', 'gizmo', 's24', 'pending', null),
  ('g8', 5, '22222222-2222-4222-8222-222222222222', '2026-09-06T21:00:00+08:00', 'ssvc', 'up-leftout', 'pending', null)
on conflict (id) do update set
  day = excluded.day,
  venue_id = excluded.venue_id,
  starts_at = excluded.starts_at,
  team_a_id = excluded.team_a_id,
  team_b_id = excluded.team_b_id,
  status = excluded.status,
  winner_team_id = excluded.winner_team_id;

insert into mvl.game_sets (game_id, set_number, team_a_score, team_b_score, winner_team_id)
values
  ('g1', 1, 25, 21, 'metarice-x'),
  ('g1', 2, 24, 26, 'metarice-y'),
  ('g1', 3, 10, 15, 'metarice-y'),
  ('g2', 1, 25, 21, 'thurstrap'),
  ('g2', 2, 24, 26, 'gizmo'),
  ('g2', 3, 10, 15, 'gizmo'),
  ('g3', 1, 25, 21, 'gremlins'),
  ('g3', 2, 24, 26, 'ssvc'),
  ('g3', 3, 10, 15, 'ssvc')
on conflict (game_id, set_number) do update set
  team_a_score = excluded.team_a_score,
  team_b_score = excluded.team_b_score,
  winner_team_id = excluded.winner_team_id;
