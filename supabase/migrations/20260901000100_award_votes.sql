-- Special-award voting. One ballot per player, four awards, cast from
-- /mvl/vote. Identity is the same triple the self check-in uses — team,
-- jersey number and the email already on file — so a ballot cannot be cast by
-- someone who merely knows a jersey number.
--
-- Apply individually, NOT with `supabase db push`.

create table if not exists mvl.award_votes (
  id uuid primary key default gen_random_uuid(),
  voter_player_id uuid not null references mvl.players(id) on delete cascade,
  award_id text not null,
  nominee_player_id uuid not null references mvl.players(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One vote per player per award. The ballot is submitted whole, so this also
-- makes a double submission a no-op rather than a second set of rows.
create unique index if not exists award_votes_voter_award_idx
  on mvl.award_votes (voter_player_id, award_id);
create index if not exists award_votes_nominee_idx
  on mvl.award_votes (award_id, nominee_player_id);

-- No policies: the table is reachable only through the definer functions below.
alter table mvl.award_votes enable row level security;

-- Shared identity check, so the status probe and the submit cannot drift.
create or replace function mvl.award_voter(p_team_id text, p_jersey_number text, p_email text)
returns mvl.players
language plpgsql
stable
security definer
set search_path = mvl, public
as $$
declare
  v_player mvl.players;
begin
  select * into v_player
  from mvl.players p
  where p.team_id = p_team_id
    and lower(trim(p.jersey_number)) = lower(trim(p_jersey_number))
  limit 1;

  if not found then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  -- The email is what separates "this is me" from "I know your jersey number".
  if v_player.email is null or trim(v_player.email) = '' then
    raise exception 'NO_EMAIL_ON_FILE';
  end if;
  if lower(trim(v_player.email)) <> lower(trim(coalesce(p_email, ''))) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  return v_player;
end;
$$;

-- Checked before the ballot is shown, so someone who has already voted is told
-- straight away rather than after picking four players.
create or replace function public.mvl_award_voter_status(
  p_team_id text,
  p_jersey_number text,
  p_email text
) returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public
as $$
declare
  v_player mvl.players;
  v_voted int;
begin
  v_player := mvl.award_voter(p_team_id, p_jersey_number, p_email);
  select count(*) into v_voted from mvl.award_votes v where v.voter_player_id = v_player.id;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'id', v_player.id,
      'display_name', v_player.display_name,
      'surname', v_player.surname,
      'jersey_number', v_player.jersey_number,
      'team_id', v_player.team_id
    ),
    'already_voted', v_voted > 0
  );
end;
$$;

create or replace function public.mvl_submit_award_votes(
  p_team_id text,
  p_jersey_number text,
  p_email text,
  p_votes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public
as $$
declare
  v_player mvl.players;
  v_count int;
  v_inserted int;
begin
  v_player := mvl.award_voter(p_team_id, p_jersey_number, p_email);

  if exists (select 1 from mvl.award_votes v where v.voter_player_id = v_player.id) then
    raise exception 'ALREADY_VOTED';
  end if;

  if p_votes is null or jsonb_typeof(p_votes) <> 'array' or jsonb_array_length(p_votes) = 0 then
    raise exception 'NO_VOTES';
  end if;

  -- Every nominee must be a real player; a ballot naming an unknown id is
  -- rejected whole rather than partly recorded.
  select count(*) into v_count
  from jsonb_array_elements(p_votes) e
  where not exists (
    select 1 from mvl.players p where p.id = (e->>'nominee_player_id')::uuid
  );
  if v_count > 0 then
    raise exception 'UNKNOWN_NOMINEE';
  end if;

  insert into mvl.award_votes (voter_player_id, award_id, nominee_player_id)
  select v_player.id, e->>'award_id', (e->>'nominee_player_id')::uuid
  from jsonb_array_elements(p_votes) e;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'id', v_player.id,
      'display_name', v_player.display_name,
      'surname', v_player.surname,
      'jersey_number', v_player.jersey_number,
      'team_id', v_player.team_id
    ),
    'votes', v_inserted
  );
end;
$$;

revoke all on function public.mvl_award_voter_status(text, text, text) from public;
grant execute on function public.mvl_award_voter_status(text, text, text) to anon, authenticated;
revoke all on function public.mvl_submit_award_votes(text, text, text, jsonb) from public;
grant execute on function public.mvl_submit_award_votes(text, text, text, jsonb) to anon, authenticated;
