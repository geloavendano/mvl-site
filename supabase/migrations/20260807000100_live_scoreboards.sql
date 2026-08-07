-- Multiple live scoreboards for OBS overlays and bearer-link remote controls.

create table if not exists mvl.scoreboards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_left_id text not null references mvl.teams(id),
  team_right_id text not null references mvl.teams(id),
  left_score integer not null default 0 check (left_score >= 0),
  right_score integer not null default 0 check (right_score >= 0),
  left_sets integer not null default 0 check (left_sets >= 0),
  right_sets integer not null default 0 check (right_sets >= 0),
  serving_side text check (serving_side in ('left', 'right')),
  control_token uuid not null default gen_random_uuid(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint scoreboard_teams_are_different check (team_left_id <> team_right_id)
);

create unique index if not exists scoreboards_control_token_idx on mvl.scoreboards (control_token);
create index if not exists scoreboards_active_updated_idx on mvl.scoreboards (updated_at desc) where archived_at is null;

alter table mvl.scoreboards enable row level security;

create or replace function mvl.scoreboard_payload(p_board mvl.scoreboards, p_include_control_token boolean default false)
returns jsonb language sql stable security definer set search_path = mvl, public as $$
  select jsonb_build_object(
    'id', p_board.id, 'name', p_board.name,
    'leftScore', p_board.left_score, 'rightScore', p_board.right_score,
    'leftSets', p_board.left_sets, 'rightSets', p_board.right_sets,
    'servingSide', p_board.serving_side, 'updatedAt', p_board.updated_at,
    'leftTeam', jsonb_build_object('id', l.id, 'name', l.name, 'colorA', l.color_a, 'colorB', l.color_b),
    'rightTeam', jsonb_build_object('id', r.id, 'name', r.name, 'colorA', r.color_a, 'colorB', r.color_b)
  ) || case when p_include_control_token
    then jsonb_build_object('controlToken', p_board.control_token)
    else '{}'::jsonb end
  from mvl.teams l, mvl.teams r
  where l.id = p_board.team_left_id and r.id = p_board.team_right_id
$$;
revoke all on function mvl.scoreboard_payload(mvl.scoreboards, boolean) from public;

create or replace function public.mvl_get_scoreboard(p_scoreboard_id uuid)
returns jsonb language plpgsql stable security definer set search_path = mvl, public as $$
declare v_board mvl.scoreboards;
begin
  select * into v_board from mvl.scoreboards where id = p_scoreboard_id and archived_at is null;
  if not found then raise exception 'Scoreboard not found'; end if;
  return mvl.scoreboard_payload(v_board, false);
end;
$$;
grant execute on function public.mvl_get_scoreboard(uuid) to anon, authenticated;

create or replace function public.mvl_scoreboard_get_control(p_scoreboard_id uuid, p_control_token uuid)
returns jsonb language plpgsql stable security definer set search_path = mvl, public as $$
declare v_board mvl.scoreboards;
begin
  select * into v_board from mvl.scoreboards
  where id = p_scoreboard_id and control_token = p_control_token and archived_at is null;
  if not found then raise exception 'This scoreboard control link is invalid or inactive'; end if;
  return mvl.scoreboard_payload(v_board, false);
end;
$$;
grant execute on function public.mvl_scoreboard_get_control(uuid, uuid) to anon, authenticated;

create or replace function public.mvl_admin_get_scoreboards()
returns jsonb language plpgsql stable security definer set search_path = mvl, public as $$
begin
  if not mvl.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(mvl.scoreboard_payload(board, true) order by board.created_at desc)
    from mvl.scoreboards board where board.archived_at is null), '[]'::jsonb);
end;
$$;
grant execute on function public.mvl_admin_get_scoreboards() to authenticated;

create or replace function public.mvl_admin_create_scoreboard(p_name text, p_team_left_id text, p_team_right_id text)
returns jsonb language plpgsql security definer set search_path = mvl, public as $$
declare v_board mvl.scoreboards;
begin
  if not mvl.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_team_left_id = p_team_right_id then raise exception 'Choose two different teams'; end if;
  if not exists (select 1 from mvl.teams where id = p_team_left_id)
    or not exists (select 1 from mvl.teams where id = p_team_right_id) then
    raise exception 'Choose two valid teams';
  end if;
  insert into mvl.scoreboards (name, team_left_id, team_right_id, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Live match'), p_team_left_id, p_team_right_id, auth.uid())
  returning * into v_board;
  return mvl.scoreboard_payload(v_board, true);
end;
$$;
grant execute on function public.mvl_admin_create_scoreboard(text, text, text) to authenticated;

create or replace function public.mvl_scoreboard_set_teams(
  p_scoreboard_id uuid, p_control_token uuid, p_team_left_id text, p_team_right_id text
) returns jsonb language plpgsql security definer set search_path = mvl, public as $$
declare v_board mvl.scoreboards;
begin
  if p_team_left_id = p_team_right_id then raise exception 'Choose two different teams'; end if;
  if not exists (select 1 from mvl.teams where id = p_team_left_id)
    or not exists (select 1 from mvl.teams where id = p_team_right_id) then
    raise exception 'Choose two valid teams';
  end if;
  update mvl.scoreboards set team_left_id = p_team_left_id, team_right_id = p_team_right_id,
    serving_side = null, updated_at = now()
  where id = p_scoreboard_id and control_token = p_control_token and archived_at is null
  returning * into v_board;
  if not found then raise exception 'This scoreboard control link is invalid or inactive'; end if;
  return mvl.scoreboard_payload(v_board, false);
end;
$$;
grant execute on function public.mvl_scoreboard_set_teams(uuid, uuid, text, text) to anon, authenticated;

create or replace function public.mvl_scoreboard_control(p_scoreboard_id uuid, p_control_token uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = mvl, public as $$
declare v_board mvl.scoreboards;
begin
  select * into v_board from mvl.scoreboards
  where id = p_scoreboard_id and control_token = p_control_token and archived_at is null for update;
  if not found then raise exception 'This scoreboard control link is invalid or inactive'; end if;

  case p_action
    when 'left-score-add' then v_board.left_score := v_board.left_score + 1; v_board.serving_side := 'left';
    when 'left-score-subtract' then v_board.left_score := greatest(0, v_board.left_score - 1);
    when 'right-score-add' then v_board.right_score := v_board.right_score + 1; v_board.serving_side := 'right';
    when 'right-score-subtract' then v_board.right_score := greatest(0, v_board.right_score - 1);
    when 'left-set-add' then v_board.left_sets := v_board.left_sets + 1;
    when 'left-set-subtract' then v_board.left_sets := greatest(0, v_board.left_sets - 1);
    when 'right-set-add' then v_board.right_sets := v_board.right_sets + 1;
    when 'right-set-subtract' then v_board.right_sets := greatest(0, v_board.right_sets - 1);
    when 'reset-scores' then v_board.left_score := 0; v_board.right_score := 0; v_board.serving_side := null;
    when 'switch-sides' then
      select v_board.team_right_id, v_board.team_left_id, v_board.right_score, v_board.left_score,
        v_board.right_sets, v_board.left_sets,
        case v_board.serving_side when 'left' then 'right' when 'right' then 'left' else null end
      into v_board.team_left_id, v_board.team_right_id, v_board.left_score, v_board.right_score,
        v_board.left_sets, v_board.right_sets, v_board.serving_side;
    else raise exception 'Unknown scoreboard action';
  end case;

  update mvl.scoreboards set team_left_id = v_board.team_left_id, team_right_id = v_board.team_right_id,
    left_score = v_board.left_score, right_score = v_board.right_score,
    left_sets = v_board.left_sets, right_sets = v_board.right_sets,
    serving_side = v_board.serving_side, updated_at = now()
  where id = v_board.id returning * into v_board;
  return mvl.scoreboard_payload(v_board, false);
end;
$$;
grant execute on function public.mvl_scoreboard_control(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
