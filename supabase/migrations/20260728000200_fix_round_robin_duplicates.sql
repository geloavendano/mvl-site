-- Complete the single round robin by replacing the two duplicated pairings:
-- C-D becomes C-H, and G-H becomes D-G.
delete from mvl.game_sets where game_id in ('pre-26', 'pre-28');
delete from mvl.game_videos where game_id in ('pre-26', 'pre-28');

update mvl.games
set team_a_id = 'thurstrap',
    team_b_id = 'up-leftout',
    status = 'pending',
    winner_team_id = null,
    player_of_game_id = null
where id = 'pre-26';

update mvl.games
set team_a_id = 'gizmo',
    team_b_id = 's24',
    status = 'pending',
    winner_team_id = null,
    player_of_game_id = null
where id = 'pre-28';
