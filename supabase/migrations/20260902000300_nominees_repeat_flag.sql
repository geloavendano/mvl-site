-- Expose is_repeat on the nominee list so the ballot can restrict the Fresh New
-- Player award to players who did not appear in 2024 or 2025.
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
      'photoUrl', p.photo_url,
      'isRepeat', p.is_repeat
    )
    order by t.name, nullif(regexp_replace(coalesce(p.jersey_number, ''), '\D', '', 'g'), '')::int nulls last, p.display_name
  ), '[]'::jsonb)
  from mvl.players p
  join mvl.teams t on t.id = p.team_id
  where p.jersey_number is not null and trim(p.jersey_number) <> '';
$$;

revoke all on function public.mvl_get_award_nominees() from public;
grant execute on function public.mvl_get_award_nominees() to anon, authenticated;
