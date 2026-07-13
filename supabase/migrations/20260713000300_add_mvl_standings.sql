drop function if exists public.mvl_get_standings();

create function public.mvl_get_standings()
returns table (
  rank integer,
  team_id text,
  team_name text,
  wins integer,
  losses integer,
  sets_won integer,
  sets_lost integer,
  set_ratio numeric,
  points_for integer,
  points_against integer,
  points_ratio numeric,
  head_to_head_wins integer
)
language sql
stable
security definer
set search_path = mvl, public, extensions
as $$
with team_match_stats as (
  select
    t.id as team_id,
    g.id as game_id,
    case when g.winner_team_id = t.id then 1 else 0 end as win,
    case when g.winner_team_id is not null and g.winner_team_id <> t.id then 1 else 0 end as loss,
    count(gs.id) filter (where gs.winner_team_id = t.id)::integer as sets_won,
    count(gs.id) filter (where gs.winner_team_id is not null and gs.winner_team_id <> t.id)::integer as sets_lost,
    coalesce(sum(case when g.team_a_id = t.id then gs.team_a_score else gs.team_b_score end), 0)::integer as points_for,
    coalesce(sum(case when g.team_a_id = t.id then gs.team_b_score else gs.team_a_score end), 0)::integer as points_against
  from mvl.games g
  join mvl.teams t on t.id in (g.team_a_id, g.team_b_id)
  left join mvl.game_sets gs on gs.game_id = g.id
  where g.status = 'final'
  group by t.id, g.id, g.winner_team_id
),
base as (
  select
    t.id as team_id,
    t.name as team_name,
    coalesce(sum(s.win), 0)::integer as wins,
    coalesce(sum(s.loss), 0)::integer as losses,
    coalesce(sum(s.sets_won), 0)::integer as sets_won,
    coalesce(sum(s.sets_lost), 0)::integer as sets_lost,
    coalesce(sum(s.points_for), 0)::integer as points_for,
    coalesce(sum(s.points_against), 0)::integer as points_against
  from mvl.teams t
  left join team_match_stats s on s.team_id = t.id
  group by t.id, t.name
),
ratios as (
  select
    *,
    case
      when sets_lost = 0 and sets_won > 0 then null
      when sets_lost = 0 then null
      else round(sets_won::numeric / sets_lost, 4)
    end as set_ratio,
    case
      when points_against = 0 and points_for > 0 then null
      when points_against = 0 then null
      else round(points_for::numeric / points_against, 4)
    end as points_ratio,
    case
      when sets_lost = 0 and sets_won > 0 then 999999::numeric
      when sets_lost = 0 then 0::numeric
      else sets_won::numeric / sets_lost
    end as set_ratio_sort,
    case
      when points_against = 0 and points_for > 0 then 999999::numeric
      when points_against = 0 then 0::numeric
      else points_for::numeric / points_against
    end as points_ratio_sort
  from base
),
head_to_head as (
  select
    r.team_id,
    coalesce(sum(case when g.winner_team_id = r.team_id then 1 else 0 end), 0)::integer as h2h_wins,
    count(gs.id) filter (where gs.winner_team_id = r.team_id)::integer as h2h_sets_won,
    count(gs.id) filter (where gs.winner_team_id is not null and gs.winner_team_id <> r.team_id)::integer as h2h_sets_lost,
    coalesce(sum(case when g.team_a_id = r.team_id then gs.team_a_score else gs.team_b_score end), 0)::integer as h2h_points_for,
    coalesce(sum(case when g.team_a_id = r.team_id then gs.team_b_score else gs.team_a_score end), 0)::integer as h2h_points_against
  from ratios r
  join ratios tied
    on tied.team_id <> r.team_id
   and tied.wins = r.wins
   and tied.set_ratio_sort = r.set_ratio_sort
   and tied.points_ratio_sort = r.points_ratio_sort
  join mvl.games g
    on g.status = 'final'
   and r.team_id in (g.team_a_id, g.team_b_id)
   and tied.team_id in (g.team_a_id, g.team_b_id)
  left join mvl.game_sets gs on gs.game_id = g.id
  group by r.team_id
),
ranked as (
  select
    r.*,
    coalesce(h.h2h_wins, 0) as h2h_wins,
    case
      when coalesce(h.h2h_sets_lost, 0) = 0 and coalesce(h.h2h_sets_won, 0) > 0 then 999999::numeric
      when coalesce(h.h2h_sets_lost, 0) = 0 then 0::numeric
      else h.h2h_sets_won::numeric / h.h2h_sets_lost
    end as h2h_set_ratio_sort,
    case
      when coalesce(h.h2h_points_against, 0) = 0 and coalesce(h.h2h_points_for, 0) > 0 then 999999::numeric
      when coalesce(h.h2h_points_against, 0) = 0 then 0::numeric
      else h.h2h_points_for::numeric / h.h2h_points_against
    end as h2h_points_ratio_sort
  from ratios r
  left join head_to_head h on h.team_id = r.team_id
)
select
  row_number() over (
    order by
      wins desc,
      set_ratio_sort desc,
      points_ratio_sort desc,
      h2h_wins desc,
      h2h_set_ratio_sort desc,
      h2h_points_ratio_sort desc,
      team_name asc
  )::integer as rank,
  team_id,
  team_name,
  wins,
  losses,
  sets_won,
  sets_lost,
  set_ratio,
  points_for,
  points_against,
  points_ratio,
  h2h_wins as head_to_head_wins
from ranked
order by rank;
$$;

grant execute on function public.mvl_get_standings() to anon, authenticated;
