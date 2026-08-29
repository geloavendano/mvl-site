-- Same NULL-folding as 20260829000400, in the summary this time. A booth QR
-- scan stores inside_radius = NULL because mvl_qr_checkin runs no geofence
-- check, and `and r.inside_radius` drops a NULL row — so the summary counted
-- only self check-ins and under-reported attendance.
--
-- raffle_filtered_entries already had an explicit `or (r.method = 'qr' and
-- r.player_id is not null)`, so the draw pool was never affected.
--
-- Apply individually, NOT with `supabase db push`.

CREATE OR REPLACE FUNCTION public.mvl_admin_get_readiness_summary(p_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'mvl', 'public', 'extensions'
AS $function$
declare
  v_day date;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
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
    'selectedDay', v_day,
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teamId', summary.team_id,
          'teamName', summary.team_name,
          'rosterCount', summary.roster_count,
          'waiverCount', summary.waiver_count,
          'checkinCount', summary.checkin_count,
          'outsideRadiusCount', summary.outside_radius_count,
          'unmatchedCheckinCount', summary.unmatched_checkin_count
        )
        order by summary.sort_order, summary.team_name
      )
      from (
        select
          t.id as team_id,
          t.name as team_name,
          t.sort_order,
          count(p.id) as roster_count,
          count(p.id) filter (where p.waiver_completed) as waiver_count,
          count(p.id) filter (where p.checked_in) as checkin_count,
          count(p.id) filter (
            where p.checkin_attempted and not p.checked_in
          ) as outside_radius_count,
          (
            select count(distinct mvl.normalized_person_name(r.entrant_name))
            from mvl.raffle_checkins r
            where r.team_id = t.id
              and (r.created_at at time zone 'Asia/Manila')::date = v_day
              and not exists (
                select 1
                from mvl.players roster_player
                where roster_player.team_id = t.id
                  and mvl.normalized_person_name(roster_player.display_name)
                    = mvl.normalized_person_name(r.entrant_name)
              )
          ) as unmatched_checkin_count
        from mvl.teams t
        left join lateral (
          select
            player.id,
            exists (
              select 1
              from mvl.waiver_submissions w
              where w.player_id = player.id
                or (
                  w.player_id is null
                  and w.team_id = player.team_id
                  and mvl.normalized_person_name(concat_ws(' ', w.first_name, w.last_name))
                    = mvl.normalized_person_name(player.display_name)
                )
            ) as waiver_completed,
            exists (
              select 1
              from mvl.raffle_checkins r
              where r.team_id = player.team_id
                and (r.created_at at time zone 'Asia/Manila')::date = v_day
                and coalesce(r.inside_radius, r.method = 'qr')
                and mvl.normalized_person_name(r.entrant_name)
                  = mvl.normalized_person_name(player.display_name)
            ) as checked_in,
            exists (
              select 1
              from mvl.raffle_checkins r
              where r.team_id = player.team_id
                and (r.created_at at time zone 'Asia/Manila')::date = v_day
                and mvl.normalized_person_name(r.entrant_name)
                  = mvl.normalized_person_name(player.display_name)
            ) as checkin_attempted
          from mvl.players player
          where player.team_id = t.id
        ) p on true
        where exists (
          select 1
          from mvl.games g
          where g.team_a_id = t.id or g.team_b_id = t.id
        )
        group by t.id, t.name, t.sort_order
      ) summary
    ), '[]'::jsonb)
  );
end;
$function$
;
