-- Short public codes keep court-TV links easy to type while the UUID and
-- control token remain the identifiers for OBS and score management.

create sequence if not exists mvl.scoreboard_public_code_seq
  minvalue 1
  maxvalue 46655
  start with 1
  no cycle;

create or replace function mvl.next_scoreboard_public_code()
returns text
language plpgsql
volatile
security definer
set search_path = mvl, public
as $$
declare
  v_value integer := nextval('mvl.scoreboard_public_code_seq')::integer;
  v_alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_code text := '';
begin
  for v_position in 1..3 loop
    v_code := substr(v_alphabet, (v_value % 36) + 1, 1) || v_code;
    v_value := v_value / 36;
  end loop;
  return v_code;
end;
$$;

revoke all on function mvl.next_scoreboard_public_code() from public;
revoke all on sequence mvl.scoreboard_public_code_seq from public;

alter table mvl.scoreboards add column if not exists public_code text;
alter table mvl.scoreboards alter column public_code set default mvl.next_scoreboard_public_code();
update mvl.scoreboards set public_code = mvl.next_scoreboard_public_code() where public_code is null;
alter table mvl.scoreboards alter column public_code set not null;

create unique index if not exists scoreboards_public_code_idx on mvl.scoreboards (public_code);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scoreboard_public_code_format'
      and conrelid = 'mvl.scoreboards'::regclass
  ) then
    alter table mvl.scoreboards
      add constraint scoreboard_public_code_format
      check (public_code ~ '^[0-9A-Z]{3}$');
  end if;
end;
$$;

create or replace function mvl.scoreboard_payload(p_board mvl.scoreboards, p_include_control_token boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = mvl, public
as $$
  select jsonb_build_object(
    'id', p_board.id,
    'publicCode', p_board.public_code,
    'name', p_board.name,
    'leftScore', p_board.left_score,
    'rightScore', p_board.right_score,
    'leftSets', p_board.left_sets,
    'rightSets', p_board.right_sets,
    'servingSide', p_board.serving_side,
    'currentSet', p_board.current_set,
    'updatedAt', p_board.updated_at,
    'leftTeam', jsonb_build_object('id', l.id, 'name', l.name, 'colorA', l.color_a, 'colorB', l.color_b),
    'rightTeam', jsonb_build_object('id', r.id, 'name', r.name, 'colorA', r.color_a, 'colorB', r.color_b),
    'game', (
      select jsonb_build_object(
        'id', g.id,
        'day', g.day,
        'startsAt', g.starts_at,
        'status', g.status,
        'maxSets', case when g.id like 'pre-%' then 3 else 5 end,
        'court', coalesce(v.name, 'Gameville Ball Park'),
        'teamA', g.team_a_id,
        'teamB', g.team_b_id
      )
      from mvl.games g
      left join mvl.venues v on v.id = g.venue_id
      where g.id = p_board.game_id
    ),
    'savedSets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'setNumber', gs.set_number,
        'teamAScore', gs.team_a_score,
        'teamBScore', gs.team_b_score,
        'leftScore', case when p_board.team_left_id = g.team_a_id then gs.team_a_score else gs.team_b_score end,
        'rightScore', case when p_board.team_right_id = g.team_b_id then gs.team_b_score else gs.team_a_score end
      ) order by gs.set_number)
      from mvl.game_sets gs
      join mvl.games g on g.id = gs.game_id
      where gs.game_id = p_board.game_id
    ), '[]'::jsonb)
  ) || case when p_include_control_token
    then jsonb_build_object('controlToken', p_board.control_token)
    else '{}'::jsonb end
  from mvl.teams l, mvl.teams r
  where l.id = p_board.team_left_id and r.id = p_board.team_right_id
$$;

revoke all on function mvl.scoreboard_payload(mvl.scoreboards, boolean) from public;

create or replace function public.mvl_get_scoreboard_by_code(p_board_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public
as $$
declare
  v_board mvl.scoreboards;
begin
  select * into v_board
  from mvl.scoreboards
  where public_code = upper(trim(p_board_code))
    and archived_at is null;
  if not found then raise exception 'Scoreboard not found'; end if;
  return mvl.scoreboard_payload(v_board, false);
end;
$$;

revoke all on function public.mvl_get_scoreboard_by_code(text) from public;
grant execute on function public.mvl_get_scoreboard_by_code(text) to anon, authenticated;

notify pgrst, 'reload schema';
