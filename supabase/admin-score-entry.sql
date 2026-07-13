-- MVL admin score-entry playbook.
-- Run these in Supabase SQL Editor, replacing the sample IDs/values.

-- 1) See scheduled games and their team IDs.
select
  g.id as game_id,
  g.day,
  g.starts_at,
  a.id as team_a_id,
  a.name as team_a,
  b.id as team_b_id,
  b.name as team_b,
  g.status,
  w.name as winner
from mvl.games g
join mvl.teams a on a.id = g.team_a_id
join mvl.teams b on b.id = g.team_b_id
left join mvl.teams w on w.id = g.winner_team_id
order by g.starts_at;

-- 2) Add or find a player for Player of the Game.
--    Keep the returned id; use it as p_player_of_game_id below.
insert into mvl.players (
  team_id,
  display_name,
  jersey_number,
  role
) values (
  'metarice-y',
  'Player Name',
  '7',
  'outside hitter'
)
returning id, team_id, display_name;

-- 3) Record final score, winner, Player of the Game, and video in one go.
--    p_sets are always from team A / team B perspective for that game.
select *
from public.mvl_record_game_result(
  p_game_id := 'g1',
  p_winner_team_id := 'metarice-y',
  p_player_of_game_id := null, -- replace with player uuid, or keep null for TBD
  p_sets := '[
    {"team_a_score": 25, "team_b_score": 21},
    {"team_a_score": 24, "team_b_score": 26},
    {"team_a_score": 10, "team_b_score": 15}
  ]'::jsonb,
  p_youtube_id := 'YOUTUBE_VIDEO_ID',
  p_video_title := 'Metarice X vs Metarice Y · Full Game',
  p_duration_seconds := 6130,
  p_video_published_at := now(),
  p_video_is_featured := true
);

-- 4) Attach or update a YouTube recording only.
insert into mvl.game_videos (
  game_id,
  youtube_id,
  title,
  duration_seconds,
  published_at,
  is_featured
) values (
  'g1',
  'YOUTUBE_VIDEO_ID',
  'Metarice X vs Metarice Y · Full Game',
  6130,
  now(),
  true
)
on conflict (game_id, youtube_id) do update set
  title = excluded.title,
  duration_seconds = excluded.duration_seconds,
  published_at = excluded.published_at,
  is_featured = excluded.is_featured
returning *;

-- 5) Update only Player of the Game.
update mvl.games
set player_of_game_id = 'PLAYER_UUID_HERE'
where id = 'g1'
returning id, player_of_game_id;

-- 6) Revert a game back to pending and clear scores/videos if needed.
update mvl.games
set status = 'pending',
    winner_team_id = null,
    player_of_game_id = null
where id = 'g1';

delete from mvl.game_sets where game_id = 'g1';
delete from mvl.game_videos where game_id = 'g1';

-- 7) Read a game result with set scores, POG, and videos.
select
  g.id as game_id,
  g.status,
  a.name as team_a,
  b.name as team_b,
  w.name as winner,
  pog.display_name as player_of_game,
  jsonb_agg(
    jsonb_build_object(
      'set_number', gs.set_number,
      'team_a_score', gs.team_a_score,
      'team_b_score', gs.team_b_score,
      'winner_team_id', gs.winner_team_id
    )
    order by gs.set_number
  ) filter (where gs.id is not null) as sets,
  jsonb_agg(
    jsonb_build_object(
      'youtube_id', gv.youtube_id,
      'title', gv.title,
      'duration_seconds', gv.duration_seconds,
      'published_at', gv.published_at,
      'is_featured', gv.is_featured
    )
    order by gv.published_at desc nulls last, gv.created_at desc
  ) filter (where gv.id is not null) as videos
from mvl.games g
join mvl.teams a on a.id = g.team_a_id
join mvl.teams b on b.id = g.team_b_id
left join mvl.teams w on w.id = g.winner_team_id
left join mvl.players pog on pog.id = g.player_of_game_id
left join mvl.game_sets gs on gs.game_id = g.id
left join mvl.game_videos gv on gv.game_id = g.id
where g.id = 'g1'
group by g.id, a.name, b.name, w.name, pog.display_name;
