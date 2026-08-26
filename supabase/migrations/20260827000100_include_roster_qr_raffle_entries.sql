-- Roster QR check-ins do not request GPS. Treat a player-linked QR scan as
-- venue-confirmed while preserving the GPS requirement for self check-ins.

create or replace function mvl.raffle_filtered_entries(
  p_start_date date,
  p_end_date date,
  p_furparent_only boolean default false
) returns table (
  checkin_day date,
  created_at timestamptz,
  player_id uuid,
  player_name text,
  jersey_number text,
  photo_url text,
  team_id text,
  team_name text,
  team_sort integer,
  fur_parent text,
  is_blacklisted boolean
)
language sql
stable
security definer
set search_path = mvl, public, extensions
as $$
  select
    r.checkin_day,
    r.created_at,
    p.id as player_id,
    p.display_name as player_name,
    p.jersey_number,
    p.photo_url,
    t.id as team_id,
    t.name as team_name,
    t.sort_order as team_sort,
    latest.fur_parent,
    exists (
      select 1 from mvl.raffle_blacklist b where b.player_id = p.id
    ) as is_blacklisted
  from mvl.raffle_checkins r
  join mvl.teams t on t.id = r.team_id
  join lateral (
    select player.*
    from mvl.players player
    where player.team_id = r.team_id
      and (
        player.id = r.player_id
        or (
          r.player_id is null
          and mvl.normalized_person_name(player.display_name)
            = mvl.normalized_person_name(r.entrant_name)
        )
      )
    order by case when player.id = r.player_id then 0 else 1 end, player.sort_order
    limit 1
  ) p on true
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
  where r.checkin_day between p_start_date and p_end_date
    and (
      r.inside_radius is true
      or (r.method = 'qr' and r.player_id is not null)
    )
    and (
      not coalesce(p_furparent_only, false)
      or latest.fur_parent in ('dog', 'cat', 'dog_cat', 'other_pet')
    );
$$;

revoke all on function mvl.raffle_filtered_entries(date, date, boolean) from public, anon, authenticated;

create or replace function public.mvl_admin_get_raffle_entries(
  p_start_date date,
  p_end_date date,
  p_furparent_only boolean default false
) returns jsonb
language plpgsql
stable
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
    with filtered as (
      select * from mvl.raffle_filtered_entries(v_start, v_end, v_furparent_only)
    ), eligible as (
      select * from filtered where not is_blacklisted
    )
    select jsonb_build_object(
      'startDate', v_start,
      'endDate', v_end,
      'furparentOnly', v_furparent_only,
      'entryCount', (select count(*) from eligible),
      'blacklistedExcluded', (select count(*) from filtered where is_blacklisted),
      'entries', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'checkinDay', e.checkin_day,
            'checkedInAt', e.created_at,
            'playerName', e.player_name,
            'jerseyNumber', e.jersey_number,
            'teamName', e.team_name,
            'furparentType', e.fur_parent
          )
          order by e.checkin_day, e.team_sort, e.team_name, e.player_name, e.created_at
        )
        from eligible e
      ), '[]'::jsonb)
    )
  );
end;
$$;

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
        select jsonb_agg(e.player_name order by e.checkin_day, e.team_sort, e.player_name, e.created_at)
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

revoke all on function public.mvl_admin_get_raffle_entries(date, date, boolean) from public;
revoke all on function public.mvl_admin_draw_raffle_winner(date, date, boolean) from public;

grant execute on function public.mvl_admin_get_raffle_entries(date, date, boolean) to authenticated;
grant execute on function public.mvl_admin_draw_raffle_winner(date, date, boolean) to authenticated;

notify pgrst, 'reload schema';
