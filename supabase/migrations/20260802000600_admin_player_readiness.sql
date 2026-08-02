-- Admin-only roster readiness view.
--
-- Waivers are linked to mvl.players by player_id. Raffle check-ins currently
-- collect a free-text attendee name, so check-in status is matched to the
-- selected team's roster using a normalized name. Entries that do not match a
-- roster player are returned separately for administrator review.

create or replace function mvl.normalized_person_name(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = mvl, public
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '[^[:alnum:]]+', '', 'g')
$$;

revoke all on function mvl.normalized_person_name(text) from public;

create or replace function public.mvl_admin_get_player_readiness(
  p_team_id text default null,
  p_day date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_team_id text;
  v_day date;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_team_id is null then
    select t.id
    into v_team_id
    from mvl.teams t
    order by
      case when exists (
        select 1 from mvl.players p where p.team_id = t.id
      ) then 0 else 1 end,
      t.sort_order,
      t.name
    limit 1;
  else
    select t.id
    into v_team_id
    from mvl.teams t
    where t.id = p_team_id;

    if not found then
      raise exception 'Team not found';
    end if;
  end if;

  if p_day is not null then
    v_day := p_day;
  else
    select available_days.day_date
    into v_day
    from (
      select distinct (g.starts_at at time zone 'Asia/Manila')::date as day_date
      from mvl.games g
      union
      select d.day from mvl.raffle_open_dates d
      union
      select distinct (r.created_at at time zone 'Asia/Manila')::date
      from mvl.raffle_checkins r
    ) available_days
    order by
      case when available_days.day_date >= v_today then 0 else 1 end,
      case when available_days.day_date >= v_today then available_days.day_date end asc,
      case when available_days.day_date < v_today then available_days.day_date end desc
    limit 1;

    v_day := coalesce(v_day, v_today);
  end if;

  return jsonb_build_object(
    'selectedTeam', v_team_id,
    'selectedDay', v_day,
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'name', t.name)
        order by t.sort_order, t.name
      )
      from mvl.teams t
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', calendar.day_date,
          'dayNumber', calendar.day_number
        )
        order by calendar.day_date
      )
      from (
        select source_days.day_date, min(source_days.day_number) as day_number
        from (
          select
            (g.starts_at at time zone 'Asia/Manila')::date as day_date,
            g.day as day_number
          from mvl.games g
          union all
          select d.day, null::integer
          from mvl.raffle_open_dates d
          union all
          select
            (r.created_at at time zone 'Asia/Manila')::date,
            null::integer
          from mvl.raffle_checkins r
        ) source_days
        group by source_days.day_date
      ) calendar
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', roster.id,
          'name', roster.display_name,
          'jerseyNumber', roster.jersey_number,
          'waiverCompleted', roster.waiver_submitted_at is not null,
          'waiverSubmittedAt', roster.waiver_submitted_at,
          'checkinStatus', case
            when coalesce(roster.inside_radius, false) then 'checked_in'
            when roster.checkin_attempted_at is not null then 'outside_radius'
            else 'not_checked_in'
          end,
          'checkedInAt', roster.checked_in_at,
          'checkinAttemptedAt', roster.checkin_attempted_at
        )
        order by roster.sort_order, roster.display_name
      )
      from (
        select
          p.id,
          p.display_name,
          p.jersey_number,
          p.sort_order,
          waiver.submitted_at as waiver_submitted_at,
          checkin.inside_radius,
          checkin.checked_in_at,
          checkin.attempted_at as checkin_attempted_at
        from mvl.players p
        left join lateral (
          select w.submitted_at
          from mvl.waiver_submissions w
          where w.player_id = p.id
            or (
              w.player_id is null
              and w.team_id = p.team_id
              and mvl.normalized_person_name(concat_ws(' ', w.first_name, w.last_name))
                = mvl.normalized_person_name(p.display_name)
            )
          order by w.submitted_at desc
          limit 1
        ) waiver on true
        left join lateral (
          select
            bool_or(r.inside_radius) as inside_radius,
            max(r.created_at) filter (where r.inside_radius) as checked_in_at,
            max(r.created_at) as attempted_at
          from mvl.raffle_checkins r
          where r.team_id = p.team_id
            and (r.created_at at time zone 'Asia/Manila')::date = v_day
            and mvl.normalized_person_name(r.entrant_name)
              = mvl.normalized_person_name(p.display_name)
        ) checkin on true
        where p.team_id = v_team_id
      ) roster
    ), '[]'::jsonb),
    'unmatchedCheckins', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', unmatched.entrant_name,
          'status', case
            when unmatched.inside_radius then 'checked_in'
            else 'outside_radius'
          end,
          'checkedInAt', unmatched.checked_in_at
        )
        order by unmatched.entrant_name
      )
      from (
        select
          min(r.entrant_name) as entrant_name,
          bool_or(r.inside_radius) as inside_radius,
          max(r.created_at) as checked_in_at
        from mvl.raffle_checkins r
        where r.team_id = v_team_id
          and (r.created_at at time zone 'Asia/Manila')::date = v_day
          and not exists (
            select 1
            from mvl.players p
            where p.team_id = v_team_id
              and mvl.normalized_person_name(p.display_name)
                = mvl.normalized_person_name(r.entrant_name)
          )
        group by mvl.normalized_person_name(r.entrant_name)
      ) unmatched
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.mvl_admin_get_player_readiness(text, date) from public;
grant execute on function public.mvl_admin_get_player_readiness(text, date) to authenticated;

notify pgrst, 'reload schema';
