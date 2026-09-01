-- Let admins remove selected teams from a raffle draw without changing exports.
-- Earlier draw RPCs remain available for cached admin clients.
-- Apply individually, NOT with `supabase db push`.

create or replace function public.mvl_admin_draw_raffle_winner_with_filters(
  p_start_date date,
  p_end_date date,
  p_furparent_only boolean default false,
  p_include_previous_winners boolean default false,
  p_excluded_team_ids text[] default '{}'::text[]
) returns jsonb
language plpgsql
volatile
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_start date := p_start_date;
  v_end date := p_end_date;
  v_furparent_only boolean := coalesce(p_furparent_only, false);
  v_include_previous_winners boolean := coalesce(p_include_previous_winners, false);
  v_excluded_team_ids text[];
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_start is null or v_end is null then
    raise exception 'Choose a start and end date';
  end if;
  if v_start > v_end then
    raise exception 'Start date must be on or before end date';
  end if;
  if v_end - v_start > 366 then
    raise exception 'Date range cannot exceed 366 days';
  end if;

  select coalesce(array_agg(distinct excluded.id), '{}'::text[])
    into v_excluded_team_ids
  from unnest(coalesce(p_excluded_team_ids, '{}'::text[])) as excluded(id)
  where excluded.id is not null and btrim(excluded.id) <> '';

  if cardinality(v_excluded_team_ids) > 32 then
    raise exception 'Too many excluded teams';
  end if;

  return (
    with eligible as (
      select *
      from mvl.raffle_filtered_entries(v_start, v_end, v_furparent_only)
      where (v_include_previous_winners or not is_blacklisted)
        and not (team_id = any(v_excluded_team_ids))
    ), chosen as (
      select * from eligible order by gen_random_uuid() limit 1
    )
    select jsonb_build_object(
      'startDate', v_start,
      'endDate', v_end,
      'furparentOnly', v_furparent_only,
      'includePreviousWinners', v_include_previous_winners,
      'excludedTeamIds', to_jsonb(v_excluded_team_ids),
      'entryCount', (select count(*) from eligible),
      'pool', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'playerName', e.player_name,
            'teamId', e.team_id,
            'teamName', e.team_name
          )
          order by e.checkin_day, e.team_sort, e.player_name, e.created_at
        )
        from eligible e
      ), '[]'::jsonb),
      'winner', (
        select jsonb_build_object(
          'playerId', c.player_id,
          'playerName', c.player_name,
          'jerseyNumber', c.jersey_number,
          'photoUrl', c.photo_url,
          'teamId', c.team_id,
          'teamName', c.team_name,
          'furparentType', c.fur_parent
        )
        from chosen c
      )
    )
  );
end;
$$;

revoke all on function public.mvl_admin_draw_raffle_winner_with_filters(date, date, boolean, boolean, text[]) from public;
grant execute on function public.mvl_admin_draw_raffle_winner_with_filters(date, date, boolean, boolean, text[]) to authenticated;

notify pgrst, 'reload schema';
