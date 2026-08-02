-- Adds an optional Instagram handle to waiver submissions.
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260802000500_add_instagram_handle_to_waivers.sql

alter table mvl.waiver_submissions
  add column if not exists instagram_handle text;

alter table mvl.waiver_submissions
  drop constraint if exists waiver_submissions_instagram_handle_check;

alter table mvl.waiver_submissions
  add constraint waiver_submissions_instagram_handle_check
  check (
    instagram_handle is null
    or instagram_handle ~ '^[a-z0-9._]{1,30}$'
  );

drop function if exists public.mvl_submit_player_waiver(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  timestamptz,
  text
);

create function public.mvl_submit_player_waiver(
  p_team_id text,
  p_player_id uuid,
  p_contact_number text,
  p_email text,
  p_instagram_handle text,
  p_fur_parent text,
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
  v_instagram_handle text;
begin
  if p_waiver_acknowledged is not true then
    raise exception 'Waiver acknowledgement is required';
  end if;

  v_instagram_handle := nullif(
    regexp_replace(lower(trim(coalesce(p_instagram_handle, ''))), '^@', ''),
    ''
  );

  if v_instagram_handle is not null
    and v_instagram_handle !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'Enter a valid Instagram handle';
  end if;

  if nullif(p_fur_parent, '') is null
    or p_fur_parent not in ('dog', 'cat', 'dog_cat', 'other_pet', 'not_now') then
    raise exception 'Select your furparent status';
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
    instagram_handle,
    fur_parent,
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
    v_instagram_handle,
    p_fur_parent,
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
  text,
  text,
  boolean,
  timestamptz,
  text
) to anon, authenticated;

notify pgrst, 'reload schema';
