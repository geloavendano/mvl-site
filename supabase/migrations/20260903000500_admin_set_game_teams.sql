-- Assign the two teams to a bracket game.
--
-- Quarterfinal and semifinal rows ship with seed labels ("3rd Seed") over
-- placeholder team ids. mvl_admin_save_game_result reads those ids to validate
-- the winner but never sets them, and refuses a winner that is not already on
-- the row — so with placeholders in place a bracket game could not be recorded
-- at all. This is the missing step.
--
-- Apply individually, NOT with `supabase db push`.

create or replace function public.mvl_admin_set_game_teams(
  p_game_id text,
  p_team_a_id text,
  p_team_b_id text
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public
as $$
declare
  v_game mvl.games;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_game from mvl.games g where g.id = p_game_id;
  if not found then
    raise exception 'GAME_NOT_FOUND';
  end if;

  -- Reassigning the teams under a recorded result would leave scores attached
  -- to teams that did not play them.
  if v_game.status = 'final' then
    raise exception 'GAME_ALREADY_FINAL';
  end if;

  if p_team_a_id is null or p_team_b_id is null then
    raise exception 'BOTH_TEAMS_REQUIRED';
  end if;
  if p_team_a_id = p_team_b_id then
    raise exception 'TEAMS_MUST_DIFFER';
  end if;
  if not exists (select 1 from mvl.teams t where t.id = p_team_a_id)
     or not exists (select 1 from mvl.teams t where t.id = p_team_b_id) then
    raise exception 'UNKNOWN_TEAM';
  end if;

  -- Clearing the labels is what turns the card from a seed placeholder into a
  -- real fixture, and what re-enables the result form for this game.
  update mvl.games g
  set team_a_id = p_team_a_id,
      team_b_id = p_team_b_id,
      team_a_label = null,
      team_b_label = null
  where g.id = p_game_id;

  return jsonb_build_object('id', p_game_id, 'team_a_id', p_team_a_id, 'team_b_id', p_team_b_id);
end;
$$;

revoke all on function public.mvl_admin_set_game_teams(text, text, text) from public, anon;
grant execute on function public.mvl_admin_set_game_teams(text, text, text) to authenticated;
