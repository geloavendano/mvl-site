create table if not exists mvl.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists mvl.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table mvl.admin_users enable row level security;
alter table mvl.site_settings enable row level security;
insert into mvl.site_settings values ('livestream','{"is_live":false,"youtube_url":"https://www.youtube.com/@metaricevolley","youtube_id":""}',now(),null) on conflict (key) do nothing;

create or replace function mvl.is_admin() returns boolean language sql stable security definer set search_path=mvl,public as $$
select exists(select 1 from mvl.admin_users where user_id=auth.uid()) $$;
revoke all on function mvl.is_admin() from public;
grant execute on function mvl.is_admin() to authenticated;

create or replace function public.mvl_get_public_data() returns jsonb language sql stable security definer set search_path=mvl,public as $$
select jsonb_build_object(
 'livestream',coalesce((select value from mvl.site_settings where key='livestream'),'{}'::jsonb),
 'games',coalesce((select jsonb_agg(jsonb_build_object(
  'id',g.id,'day',g.day,'court',coalesce(v.name,'Gameville Ball Park'),'startsAt',g.starts_at,
  'teamA',g.team_a_id,'teamB',g.team_b_id,'status',g.status,'winner',g.winner_team_id,
  'playerOfGame',case when p.id is null then null else jsonb_build_object('name',p.display_name,'team',p.team_id) end,
  'sets',coalesce((select jsonb_agg(jsonb_build_object('a',s.team_a_score,'b',s.team_b_score) order by s.set_number) from mvl.game_sets s where s.game_id=g.id),'[]'::jsonb),
  'youtubeId',coalesce(vid.youtube_id,''),
  'duration',case when vid.duration_seconds is null then '' else concat(floor(vid.duration_seconds/3600),':',lpad(floor((vid.duration_seconds%3600)/60)::text,2,'0'),':',lpad((vid.duration_seconds%60)::text,2,'0')) end
 ) order by g.starts_at) from mvl.games g left join mvl.venues v on v.id=g.venue_id left join mvl.players p on p.id=g.player_of_game_id
 left join lateral(select youtube_id,duration_seconds from mvl.game_videos x where x.game_id=g.id order by is_featured desc,published_at desc nulls last,created_at desc limit 1) vid on true),'[]'::jsonb)
) $$;
grant execute on function public.mvl_get_public_data() to anon,authenticated;

create or replace function public.mvl_admin_get_dashboard() returns jsonb language plpgsql stable security definer set search_path=mvl,public as $$
begin if not mvl.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
return jsonb_build_object('email',auth.jwt()->>'email','publicData',public.mvl_get_public_data()); end $$;
grant execute on function public.mvl_admin_get_dashboard() to authenticated;

create or replace function public.mvl_admin_update_livestream(p_is_live boolean,p_youtube_url text,p_youtube_id text) returns jsonb language plpgsql security definer set search_path=mvl,public as $$
declare val jsonb; begin if not mvl.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
val=jsonb_build_object('is_live',coalesce(p_is_live,false),'youtube_url',coalesce(nullif(trim(p_youtube_url),''),'https://www.youtube.com/@metaricevolley'),'youtube_id',coalesce(trim(p_youtube_id),''));
insert into mvl.site_settings values('livestream',val,now(),auth.uid()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by; return val; end $$;
grant execute on function public.mvl_admin_update_livestream(boolean,text,text) to authenticated;

create or replace function public.mvl_admin_reset_game(p_game_id text) returns void language plpgsql security definer set search_path=mvl,public as $$
begin if not mvl.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
update mvl.games set status='pending',winner_team_id=null,player_of_game_id=null where id=p_game_id;
delete from mvl.game_sets where game_id=p_game_id; end $$;
grant execute on function public.mvl_admin_reset_game(text) to authenticated;

-- The original result RPC remains transactional; this wrapper-level guard is
-- inserted at the beginning of its function body when this migration is applied.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.mvl_record_game_result(text,text,uuid,jsonb,text,text,integer,timestamptz,boolean)'::regprocedure) into definition;
 if position('Admin access required' in definition)=0 then
  definition:=replace(definition,'begin'||chr(10),'begin'||chr(10)||'  if not mvl.is_admin() then raise exception ''Admin access required'' using errcode = ''42501''; end if;'||chr(10));
  execute definition;
 end if;
end $$;
