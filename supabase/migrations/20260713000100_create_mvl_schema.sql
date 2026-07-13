-- MVL tables for the existing "sansayaw" Supabase project.
-- Table names are prefixed with mvl_ to avoid collisions with other apps.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.mvl_venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  location geography(point, 4326),
  checkin_radius_m integer not null default 150,
  created_at timestamptz not null default now()
);

create table if not exists public.mvl_teams (
  id text primary key,
  name text not null,
  division_label text,
  color_a text not null,
  color_b text not null,
  photo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mvl_players (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.mvl_teams(id) on delete cascade,
  display_name text not null,
  jersey_number text,
  role text,
  photo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mvl_games (
  id text primary key,
  day integer not null,
  venue_id uuid references public.mvl_venues(id),
  starts_at timestamptz not null,
  team_a_id text not null references public.mvl_teams(id),
  team_b_id text not null references public.mvl_teams(id),
  status text not null default 'pending' check (status in ('pending', 'live', 'final', 'cancelled')),
  winner_team_id text references public.mvl_teams(id),
  player_of_game_id uuid references public.mvl_players(id),
  created_at timestamptz not null default now(),
  constraint mvl_winner_is_participant check (
    winner_team_id is null or winner_team_id in (team_a_id, team_b_id)
  )
);

create table if not exists public.mvl_game_sets (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.mvl_games(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  winner_team_id text references public.mvl_teams(id),
  unique (game_id, set_number)
);

create table if not exists public.mvl_game_videos (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.mvl_games(id) on delete cascade,
  youtube_id text not null,
  title text,
  duration_seconds integer,
  published_at timestamptz,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mvl_sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text,
  billing_tier integer not null default 100,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mvl_raffle_checkins (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.mvl_teams(id),
  entrant_name text not null,
  venue_id uuid not null references public.mvl_venues(id),
  detected_location geography(point, 4326) not null,
  accuracy_m numeric,
  inside_radius boolean not null,
  distance_m numeric not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.mvl_waiver_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.mvl_teams(id),
  first_name text not null,
  last_name text not null,
  contact_number text not null,
  email text not null,
  emergency_contact_name text not null,
  emergency_contact_number text not null,
  relationship text not null,
  relationship_other text,
  waiver_acknowledged boolean not null,
  submitted_at timestamptz not null default now(),
  user_agent text,
  created_at timestamptz not null default now(),
  constraint mvl_waiver_acknowledged_required check (waiver_acknowledged is true)
);

create index if not exists mvl_raffle_checkins_team_created_idx on public.mvl_raffle_checkins (team_id, created_at desc);
create index if not exists mvl_raffle_checkins_location_idx on public.mvl_raffle_checkins using gist (detected_location);
create index if not exists mvl_waiver_submissions_team_created_idx on public.mvl_waiver_submissions (team_id, created_at desc);
create index if not exists mvl_waiver_submissions_email_idx on public.mvl_waiver_submissions (lower(email));
create index if not exists mvl_games_team_a_idx on public.mvl_games (team_a_id);
create index if not exists mvl_games_team_b_idx on public.mvl_games (team_b_id);
create index if not exists mvl_games_starts_at_idx on public.mvl_games (starts_at);
create index if not exists mvl_game_videos_published_idx on public.mvl_game_videos (published_at desc);

alter table public.mvl_venues enable row level security;
alter table public.mvl_teams enable row level security;
alter table public.mvl_players enable row level security;
alter table public.mvl_games enable row level security;
alter table public.mvl_game_sets enable row level security;
alter table public.mvl_game_videos enable row level security;
alter table public.mvl_sponsors enable row level security;
alter table public.mvl_raffle_checkins enable row level security;
alter table public.mvl_waiver_submissions enable row level security;

drop policy if exists "Public can read MVL venues" on public.mvl_venues;
create policy "Public can read MVL venues" on public.mvl_venues for select using (true);

drop policy if exists "Public can read MVL teams" on public.mvl_teams;
create policy "Public can read MVL teams" on public.mvl_teams for select using (true);

drop policy if exists "Public can read MVL players" on public.mvl_players;
create policy "Public can read MVL players" on public.mvl_players for select using (true);

drop policy if exists "Public can read MVL games" on public.mvl_games;
create policy "Public can read MVL games" on public.mvl_games for select using (true);

drop policy if exists "Public can read MVL game sets" on public.mvl_game_sets;
create policy "Public can read MVL game sets" on public.mvl_game_sets for select using (true);

drop policy if exists "Public can read MVL game videos" on public.mvl_game_videos;
create policy "Public can read MVL game videos" on public.mvl_game_videos for select using (true);

drop policy if exists "Public can read active MVL sponsors" on public.mvl_sponsors;
create policy "Public can read active MVL sponsors" on public.mvl_sponsors for select using (is_active);

drop policy if exists "Public can submit MVL waivers" on public.mvl_waiver_submissions;
create policy "Public can submit MVL waivers" on public.mvl_waiver_submissions
  for insert
  with check (waiver_acknowledged is true);

grant select on
  public.mvl_venues,
  public.mvl_teams,
  public.mvl_players,
  public.mvl_games,
  public.mvl_game_sets,
  public.mvl_game_videos,
  public.mvl_sponsors
to anon, authenticated;

grant insert on public.mvl_waiver_submissions to anon, authenticated;

create or replace function public.mvl_create_raffle_checkin(
  p_team_id text,
  p_entrant_name text,
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m numeric,
  p_user_agent text default null
) returns public.mvl_raffle_checkins
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_venue public.mvl_venues;
  v_point geography(point, 4326);
  v_distance numeric;
  v_checkin public.mvl_raffle_checkins;
begin
  select * into v_venue from public.mvl_venues where id = p_venue_id;
  if not found then
    raise exception 'Venue not found';
  end if;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_distance := st_distance(v_point, v_venue.location);

  insert into public.mvl_raffle_checkins (
    team_id,
    entrant_name,
    venue_id,
    detected_location,
    accuracy_m,
    inside_radius,
    distance_m,
    user_agent
  ) values (
    p_team_id,
    p_entrant_name,
    p_venue_id,
    v_point,
    p_accuracy_m,
    v_distance <= v_venue.checkin_radius_m,
    v_distance,
    p_user_agent
  )
  returning * into v_checkin;

  return v_checkin;
end;
$$;

grant execute on function public.mvl_create_raffle_checkin(text, text, uuid, double precision, double precision, numeric, text) to anon, authenticated;
