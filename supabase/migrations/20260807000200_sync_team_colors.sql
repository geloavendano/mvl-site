-- Keep database-backed scoreboard colors aligned with the canonical public-site palette.

update mvl.teams as team
set color_a = palette.color_a,
    color_b = palette.color_b
from (values
  ('metarice-x', '#3FE39A', '#0E7A4C'),
  ('metarice-y', '#7C3BFF', '#2E00A8'),
  ('thurstrap', '#10E0D4', '#078D96'),
  ('gizmo', '#FF3FB4', '#D50083'),
  ('gremlins', '#3D9E2A', '#0D4E14'),
  ('ssvc', '#FFE44D', '#D6A900'),
  ('s24', '#F51642', '#B90025'),
  ('secret', '#FF9A05', '#FF5A00')
) as palette(id, color_a, color_b)
where team.id = palette.id
  and (team.color_a, team.color_b) is distinct from (palette.color_a, palette.color_b);

-- Force every active overlay to repaint even when its score has not changed.
update mvl.scoreboards
set updated_at = now()
where archived_at is null;
