-- Include team identity for every raffle entry so the admin roulette can use
-- the existing team gradients without exposing additional player data.

create or replace function public.mvl_admin_draw_raffle_winner(
  p_start_date date,
  p_end_date date,
  p_furparent_only boolean default false
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

  return (
    with eligible as (
      select *
      from mvl.raffle_filtered_entries(v_start, v_end, v_furparent_only)
      where not is_blacklisted
    ), chosen as (
      select * from eligible order by gen_random_uuid() limit 1
    )
    select jsonb_build_object(
      'startDate', v_start,
      'endDate', v_end,
      'furparentOnly', v_furparent_only,
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

revoke all on function public.mvl_admin_draw_raffle_winner(date, date, boolean) from public;
grant execute on function public.mvl_admin_draw_raffle_winner(date, date, boolean) to authenticated;

notify pgrst, 'reload schema';
