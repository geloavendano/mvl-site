alter table mvl.waiver_submissions
  add column if not exists player_id uuid references mvl.players(id);

create index if not exists waiver_submissions_player_idx
  on mvl.waiver_submissions (player_id);

create or replace function public.mvl_get_team_players(
  p_team_id text
) returns jsonb
language sql
stable
security definer
set search_path = mvl, public, extensions
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.display_name,
        'jerseyNumber', p.jersey_number
      )
      order by p.sort_order, p.display_name
    ),
    '[]'::jsonb
  )
  from mvl.players p
  where p.team_id = p_team_id;
$$;

grant execute on function public.mvl_get_team_players(text)
  to anon, authenticated;

create or replace function public.mvl_submit_player_waiver(
  p_team_id text,
  p_player_id uuid,
  p_contact_number text,
  p_email text,
  p_emergency_contact_name text,
  p_emergency_contact_number text,
  p_relationship text,
  p_relationship_other text,
  p_waiver_acknowledged boolean,
  p_submitted_at timestamptz default now(),
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_player mvl.players;
  v_submission_id uuid;
  v_first_name text;
  v_last_name text;
begin
  if p_waiver_acknowledged is not true then
    raise exception 'Waiver acknowledgement is required';
  end if;

  select *
  into v_player
  from mvl.players
  where id = p_player_id
    and team_id = p_team_id;

  if not found then
    raise exception 'Select a registered player from the chosen team';
  end if;

  if trim(v_player.display_name) ~ '\s' then
    v_first_name := regexp_replace(trim(v_player.display_name), '\s+\S+$', '');
    v_last_name := regexp_replace(trim(v_player.display_name), '^.*\s+', '');
  else
    v_first_name := trim(v_player.display_name);
    v_last_name := '';
  end if;

  insert into mvl.waiver_submissions (
    team_id,
    player_id,
    first_name,
    last_name,
    contact_number,
    email,
    emergency_contact_name,
    emergency_contact_number,
    relationship,
    relationship_other,
    waiver_acknowledged,
    submitted_at,
    user_agent
  ) values (
    p_team_id,
    v_player.id,
    v_first_name,
    v_last_name,
    p_contact_number,
    lower(p_email),
    p_emergency_contact_name,
    p_emergency_contact_number,
    p_relationship,
    nullif(p_relationship_other, ''),
    p_waiver_acknowledged,
    coalesce(p_submitted_at, now()),
    p_user_agent
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

grant execute on function public.mvl_submit_player_waiver(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  timestamptz,
  text
) to anon, authenticated;
