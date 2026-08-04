insert into mvl.venues (id, name, address, location, checkin_radius_m)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Gameville Ball Park · Court 1',
    null,
    null,
    150
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Gameville Ball Park · Court 2',
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
  ('metarice-x', 'Metarice X', 'Mint Division', '#3FE39A', '#0E7A4C', 1),
  ('metarice-y', 'Metarice Y', 'Violet Division', '#7C3BFF', '#2E00A8', 2),
  ('thurstrap', 'Thurstrap', 'Aqua Division', '#10E0D4', '#078D96', 3),
  ('gizmo', 'Gizmo', 'Pink Division', '#FF3FB4', '#D50083', 4),
  ('gremlins', 'Gremlins', 'Forest Division', '#3D9E2A', '#0D4E14', 5),
  ('ssvc', 'SSVC', 'Yellow Division', '#FFE44D', '#D6A900', 6),
  ('s24', 'S24', 'Red Division', '#F51642', '#B90025', 7),
  ('secret', 'Secret', 'Orange Division', '#FF9A05', '#FF5A00', 8)
on conflict (id) do update set
  name = excluded.name,
  division_label = excluded.division_label,
  color_a = excluded.color_a,
  color_b = excluded.color_b,
  sort_order = excluded.sort_order;

-- The complete tournament schedule is maintained by
-- migrations/20260728000100_replace_teams_and_tournament_schedule.sql.
