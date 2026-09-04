-- Let an administrator add one baseline entry for every rostered player to a
-- draw. Check-ins in the selected range remain additional entries. All other
-- winner, furparent, team, and date exclusions apply to both entry sources.
--
-- Apply individually, NOT with `supabase db push`.

create or replace function public.mvl_admin_draw_raffle_winner_with_roster_entries(
  p_start_date date,
  p_end_date date,
  p_furparent_only boolean default false,
  p_include_previous_winners boolean default false,
  p_excluded_team_ids text[] default '{}'::text[],
  p_excluded_winner_dates date[] default '{}'::date[],
  p_include_all_players boolean default false
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
  v_include_all_players boolean := coalesce(p_include_all_players, false);
  v_excluded_team_ids text[];
  v_excluded_winner_dates date[];
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

  select coalesce(array_agg(distinct excluded.day order by excluded.day), '{}'::date[])
    into v_excluded_winner_dates
  from unnest(coalesce(p_excluded_winner_dates, '{}'::date[])) as excluded(day)
  where excluded.day is not null;

  if cardinality(v_excluded_team_ids) > 32 then
    raise exception 'Too many excluded teams';
  end if;
  if cardinality(v_excluded_winner_dates) > 32 then
    raise exception 'Too many excluded winner dates';
  end if;

  return (
    with checkin_entries as (
      select e.*
      from mvl.raffle_filtered_entries(v_start, v_end, v_furparent_only) e
    ), roster_entries as (
      select
        null::date as checkin_day,
        null::timestamptz as created_at,
        p.id as player_id,
        p.display_name as player_name,
        p.jersey_number,
        coalesce(p.photo_path, p.photo_url) as photo_url,
        t.id as team_id,
        t.name as team_name,
        t.sort_order as team_sort,
        latest.fur_parent,
        exists (
          select 1 from mvl.raffle_blacklist b where b.player_id = p.id
        ) as is_blacklisted
      from mvl.players p
      join mvl.teams t on t.id = p.team_id
      left join lateral (
        select w.fur_parent
        from mvl.waiver_submissions w
        where w.player_id = p.id
          or (
            w.player_id is null
            and w.team_id = p.team_id
            and mvl.normalized_person_name(concat_ws(' ', w.first_name, w.last_name))
              = mvl.normalized_person_name(p.display_name)
          )
        order by w.submitted_at desc, w.created_at desc
        limit 1
      ) latest on true
      where v_include_all_players
        and (
          not v_furparent_only
          or latest.fur_parent in ('dog', 'cat', 'dog_cat', 'other_pet')
        )
    ), combined_entries as (
      select * from checkin_entries
      union all
      select * from roster_entries
    ), eligible as (
      select e.*
      from combined_entries e
      where (v_include_previous_winners or not e.is_blacklisted)
        and not (e.team_id = any(v_excluded_team_ids))
        and not exists (
          select 1
          from mvl.raffle_blacklist b
          where b.player_id = e.player_id
            and (b.created_at at time zone 'Asia/Manila')::date = any(v_excluded_winner_dates)
        )
    ), chosen as (
      select * from eligible order by gen_random_uuid() limit 1
    )
    select jsonb_build_object(
      'startDate', v_start,
      'endDate', v_end,
      'furparentOnly', v_furparent_only,
      'includePreviousWinners', v_include_previous_winners,
      'includeAllPlayers', v_include_all_players,
      'excludedTeamIds', to_jsonb(v_excluded_team_ids),
      'excludedWinnerDates', to_jsonb(v_excluded_winner_dates),
      'entryCount', (select count(*) from eligible),
      'pool', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'playerName', e.player_name,
            'teamId', e.team_id,
            'teamName', e.team_name
          )
          order by e.checkin_day nulls first, e.team_sort, e.player_name, e.created_at
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

revoke all on function public.mvl_admin_draw_raffle_winner_with_roster_entries(date, date, boolean, boolean, text[], date[], boolean) from public;
revoke all on function public.mvl_admin_draw_raffle_winner_with_roster_entries(date, date, boolean, boolean, text[], date[], boolean) from anon;
grant execute on function public.mvl_admin_draw_raffle_winner_with_roster_entries(date, date, boolean, boolean, text[], date[], boolean) to authenticated;

notify pgrst, 'reload schema';
