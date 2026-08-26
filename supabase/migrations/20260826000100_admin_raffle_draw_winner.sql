-- Server-side raffle selection. Every eligible check-in is one entry.

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
        latest.fur_parent
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
      where r.checkin_day between v_start and v_end
        and r.inside_radius is true
        and not exists (
          select 1 from mvl.raffle_blacklist b where b.player_id = p.id
        )
        and (
          not v_furparent_only
          or latest.fur_parent in ('dog', 'cat', 'dog_cat', 'other_pet')
        )
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

create or replace function public.mvl_admin_add_raffle_blacklist(
  p_player_id uuid,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_note text := trim(coalesce(p_note, ''));
  v_id uuid;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from mvl.players p where p.id = p_player_id) then
    raise exception 'Player not found';
  end if;
  if length(v_note) not between 1 and 240 then
    raise exception 'Enter a prize or note between 1 and 240 characters';
  end if;
  if exists (select 1 from mvl.raffle_blacklist b where b.player_id = p_player_id) then
    raise exception 'This player is already recorded under Raffle Winners';
  end if;

  insert into mvl.raffle_blacklist (player_id, note, created_by)
  values (p_player_id, v_note, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'playerId', p_player_id, 'note', v_note);
end;
$$;

revoke all on function public.mvl_admin_draw_raffle_winner(date, date, boolean) from public;
revoke all on function public.mvl_admin_add_raffle_blacklist(uuid, text) from public;

grant execute on function public.mvl_admin_draw_raffle_winner(date, date, boolean) to authenticated;
grant execute on function public.mvl_admin_add_raffle_blacklist(uuid, text) to authenticated;

notify pgrst, 'reload schema';
