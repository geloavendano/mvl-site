-- Adds a waiver-only Organizer test roster.
--
-- This team is intentionally not added to mvl/js/league-data.js, so it does
-- not appear in the public Teams fold, schedule, or standings previews.
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260802000300_add_organizer_waiver_test_roster.sql

insert into mvl.teams (id, name, division_label, color_a, color_b, sort_order)
values ('organizer', 'Organizer', 'Testing', '#D6D8E2', '#666A78', 99)
on conflict (id) do update set
  name = excluded.name,
  division_label = excluded.division_label,
  color_a = excluded.color_a,
  color_b = excluded.color_b,
  sort_order = excluded.sort_order;

with roster(display_name, sort_order) as (
  values
    ('Gelo Avendaño', 1),
    ('Bryan Cruz', 2),
    ('Peter Cam', 3),
    ('Chan dela Cruz', 4),
    ('Jay Vee Loresto', 5),
    ('Paul Yiu', 6),
    ('Joel Mediana', 7),
    ('Marcy Magallanes', 8),
    ('Pao Ancheta', 9)
)
insert into mvl.players (team_id, display_name, sort_order)
select 'organizer', r.display_name, r.sort_order
from roster r
where not exists (
  select 1
  from mvl.players p
  where p.team_id = 'organizer'
    and lower(trim(p.display_name)) = lower(trim(r.display_name))
);

notify pgrst, 'reload schema';
