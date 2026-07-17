alter table mvl.games add column if not exists game_order integer;

with ranked as (
  select id, row_number() over (partition by day order by starts_at, id)::integer as position
  from mvl.games
)
update mvl.games g set game_order = ranked.position
from ranked where ranked.id = g.id and g.game_order is null;

alter table mvl.games alter column game_order set default 1;
alter table mvl.games alter column game_order set not null;
alter table mvl.games drop constraint if exists games_game_order_check;
alter table mvl.games add constraint games_game_order_check check (game_order > 0);

create or replace function public.mvl_get_public_data() returns jsonb language sql stable security definer set search_path=mvl,public as $$
select jsonb_build_object(
 'livestream',coalesce((select value from mvl.site_settings where key='livestream'),'{}'::jsonb),
 'games',coalesce((select jsonb_agg(jsonb_build_object(
  'id',g.id,'day',g.day,'gameOrder',g.game_order,'court',coalesce(v.name,'Gameville Ball Park'),'startsAt',g.starts_at,
  'teamA',g.team_a_id,'teamB',g.team_b_id,'status',g.status,'winner',g.winner_team_id,
  'playerOfGame',case when p.id is null then null else jsonb_build_object('name',p.display_name,'team',p.team_id) end,
  'sets',coalesce((select jsonb_agg(jsonb_build_object('a',s.team_a_score,'b',s.team_b_score) order by s.set_number) from mvl.game_sets s where s.game_id=g.id),'[]'::jsonb),
  'youtubeId',coalesce(vid.youtube_id,''),
  'duration',case when vid.duration_seconds is null then '' else concat(floor(vid.duration_seconds/3600),':',lpad(floor((vid.duration_seconds%3600)/60)::text,2,'0'),':',lpad((vid.duration_seconds%60)::text,2,'0')) end
 ) order by g.day,g.game_order,g.starts_at,g.id) from mvl.games g left join mvl.venues v on v.id=g.venue_id left join mvl.players p on p.id=g.player_of_game_id
 left join lateral(select youtube_id,duration_seconds from mvl.game_videos x where x.game_id=g.id order by is_featured desc,published_at desc nulls last,created_at desc limit 1) vid on true),'[]'::jsonb)
) $$;
grant execute on function public.mvl_get_public_data() to anon,authenticated;

drop function if exists public.mvl_admin_update_game_schedule(text,integer,timestamptz);
create function public.mvl_admin_update_game_schedule(
  p_game_id text, p_day integer, p_game_order integer, p_starts_at timestamptz,
  p_team_a_id text, p_team_b_id text
) returns jsonb language plpgsql security definer set search_path=mvl,public as $$
declare v_game mvl.games; v_matchup_changed boolean;
begin
  if not mvl.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_day is null or p_day < 1 then raise exception 'Match day must be at least 1'; end if;
  if p_game_order is null or p_game_order < 1 then raise exception 'Game order must be at least 1'; end if;
  if p_starts_at is null then raise exception 'Game date and time are required'; end if;
  if p_team_a_id = p_team_b_id then raise exception 'Team A and Team B must be different'; end if;
  select * into v_game from mvl.games where id=p_game_id for update;
  if not found then raise exception 'Game % not found',p_game_id; end if;
  v_matchup_changed := v_game.team_a_id<>p_team_a_id or v_game.team_b_id<>p_team_b_id;
  if v_game.day = p_day and v_game.game_order <> p_game_order then
    if p_game_order < v_game.game_order then
      update mvl.games set game_order=game_order+1
      where day=p_day and id<>p_game_id and game_order>=p_game_order and game_order<v_game.game_order;
    else
      update mvl.games set game_order=game_order-1
      where day=p_day and id<>p_game_id and game_order>v_game.game_order and game_order<=p_game_order;
    end if;
  elsif v_game.day <> p_day then
    update mvl.games set game_order=game_order-1
    where day=v_game.day and id<>p_game_id and game_order>v_game.game_order;
    update mvl.games set game_order=game_order+1
    where day=p_day and id<>p_game_id and game_order>=p_game_order;
  end if;
  if v_matchup_changed then
    delete from mvl.game_sets where game_id=p_game_id;
    delete from mvl.game_videos where game_id=p_game_id;
  end if;
  update mvl.games set day=p_day,game_order=p_game_order,starts_at=p_starts_at,
    team_a_id=p_team_a_id,team_b_id=p_team_b_id,
    status=case when v_matchup_changed then 'pending' else status end,
    winner_team_id=case when v_matchup_changed then null else winner_team_id end,
    player_of_game_id=case when v_matchup_changed then null else player_of_game_id end
  where id=p_game_id returning * into v_game;
  return jsonb_build_object('id',v_game.id,'day',v_game.day,'gameOrder',v_game.game_order,
    'startsAt',v_game.starts_at,'teamA',v_game.team_a_id,'teamB',v_game.team_b_id,
    'matchupChanged',v_matchup_changed);
end $$;
grant execute on function public.mvl_admin_update_game_schedule(text,integer,integer,timestamptz,text,text) to authenticated;
