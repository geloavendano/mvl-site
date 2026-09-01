-- Nominee list for /mvl/vote. mvl_get_team_players returns {id, name,
-- jerseyNumber} and no photo, and the waiver page depends on that shape, so
-- this is a separate reader rather than a change to it.
--
-- Returns every player at once — 125 rows — so the ballot's team/player
-- selectors switch instantly instead of a round trip per team. Nothing here is
-- newly public: rosters already come back from mvl_get_team_players and the
-- photos live in a public storage bucket.
--
-- Apply individually, NOT with `supabase db push`.

create or replace function public.mvl_get_award_nominees()
returns jsonb
language sql
stable
security definer
set search_path = mvl, public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'teamId', p.team_id,
      'name', trim(p.display_name || ' ' || coalesce(p.surname, '')),
      'jerseyNumber', p.jersey_number,
      'photoUrl', p.photo_url
    )
    order by t.name, nullif(regexp_replace(coalesce(p.jersey_number, ''), '\D', '', 'g'), '')::int nulls last, p.display_name
  ), '[]'::jsonb)
  from mvl.players p
  join mvl.teams t on t.id = p.team_id
  where p.jersey_number is not null and trim(p.jersey_number) <> '';
$$;

revoke all on function public.mvl_get_award_nominees() from public;
grant execute on function public.mvl_get_award_nominees() to anon, authenticated;
