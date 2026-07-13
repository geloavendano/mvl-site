-- Cleanup from the initial public.mvl_* approach.
-- Safe after data has been seeded/migrated into mvl.*.

drop table if exists public.mvl_game_sets cascade;
drop table if exists public.mvl_game_videos cascade;
drop table if exists public.mvl_raffle_checkins cascade;
drop table if exists public.mvl_waiver_submissions cascade;
drop table if exists public.mvl_sponsors cascade;
drop table if exists public.mvl_games cascade;
drop table if exists public.mvl_players cascade;
drop table if exists public.mvl_teams cascade;
drop table if exists public.mvl_venues cascade;
