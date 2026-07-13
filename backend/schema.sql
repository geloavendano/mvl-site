-- MVL 2026 backend schema draft for Supabase/Postgres.
-- Enable PostGIS in Supabase before using geography radius checks.
create extension if not exists postgis;

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  location geography(point, 4326),
  checkin_radius_m integer not null default 150,
  created_at timestamptz not null default now()
);

create table public.teams (
  id text primary key,
  name text not null,
  division_label text,
  color_a text not null,
  color_b text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id) on delete cascade,
  display_name text not null,
  jersey_number text,
  role text,
  photo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.games (
  id text primary key,
  day integer not null,
  venue_id uuid references public.venues(id),
  starts_at timestamptz not null,
  team_a_id text not null references public.teams(id),
  team_b_id text not null references public.teams(id),
  status text not null default 'pending' check (status in ('pending', 'live', 'final', 'cancelled')),
  winner_team_id text references public.teams(id),
  player_of_game_id uuid references public.players(id),
  created_at timestamptz not null default now(),
  constraint winner_is_participant check (
    winner_team_id is null or winner_team_id in (team_a_id, team_b_id)
  )
);

create table public.game_sets (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  winner_team_id text references public.teams(id),
  unique (game_id, set_number)
);

create table public.game_videos (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  youtube_id text not null,
  title text,
  duration_seconds integer,
  published_at timestamptz,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text,
  billing_tier integer not null default 100,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.raffle_checkins (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id),
  entrant_name text not null,
  venue_id uuid not null references public.venues(id),
  detected_location geography(point, 4326) not null,
  accuracy_m numeric,
  inside_radius boolean not null,
  distance_m numeric not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.waiver_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id),
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
  constraint waiver_acknowledged_required check (waiver_acknowledged is true)
);

create index raffle_checkins_team_created_idx on public.raffle_checkins (team_id, created_at desc);
create index raffle_checkins_location_idx on public.raffle_checkins using gist (detected_location);
create index waiver_submissions_team_created_idx on public.waiver_submissions (team_id, created_at desc);
create index waiver_submissions_email_idx on public.waiver_submissions (lower(email));
create index games_team_a_idx on public.games (team_a_id);
create index games_team_b_idx on public.games (team_b_id);
create index games_starts_at_idx on public.games (starts_at);
create index game_videos_published_idx on public.game_videos (published_at desc);

-- Server-side helper for raffle insertion.
-- Call this from a Supabase Edge Function or RPC after validating payload shape.
create or replace function public.create_raffle_checkin(
  p_team_id text,
  p_entrant_name text,
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m numeric,
  p_user_agent text default null
) returns public.raffle_checkins
language plpgsql
security definer
as $$
declare
  v_venue public.venues;
  v_point geography(point, 4326);
  v_distance numeric;
  v_checkin public.raffle_checkins;
begin
  select * into v_venue from public.venues where id = p_venue_id;
  if not found then
    raise exception 'Venue not found';
  end if;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_distance := st_distance(v_point, v_venue.location);

  insert into public.raffle_checkins (
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
