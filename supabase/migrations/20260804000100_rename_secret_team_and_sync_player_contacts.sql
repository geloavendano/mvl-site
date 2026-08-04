-- Rename Secret's legacy team ID and keep the latest waiver contact details
-- on the canonical player record.

do $$
begin
  if exists (select 1 from mvl.teams where id = 'up-leftout')
    and exists (select 1 from mvl.teams where id = 'secret') then
    raise exception 'Cannot rename up-leftout: team ID secret already exists';
  end if;
end;
$$;

insert into mvl.teams (
  id, name, division_label, color_a, color_b, photo_url, sort_order, created_at
)
select
  'secret', name, division_label, color_a, color_b, photo_url, sort_order, created_at
from mvl.teams
where id = 'up-leftout'
on conflict (id) do nothing;

-- Update every FK reference before removing the legacy team row. Game team
-- fields are changed together so winner_is_participant remains valid.
update mvl.games
set team_a_id = case when team_a_id = 'up-leftout' then 'secret' else team_a_id end,
    team_b_id = case when team_b_id = 'up-leftout' then 'secret' else team_b_id end,
    winner_team_id = case when winner_team_id = 'up-leftout' then 'secret' else winner_team_id end
where 'up-leftout' in (team_a_id, team_b_id)
   or winner_team_id = 'up-leftout';

update mvl.game_sets
set winner_team_id = 'secret'
where winner_team_id = 'up-leftout';

update mvl.players
set team_id = 'secret'
where team_id = 'up-leftout';

update mvl.raffle_checkins
set team_id = 'secret'
where team_id = 'up-leftout';

update mvl.waiver_submissions
set team_id = 'secret'
where team_id = 'up-leftout';

delete from mvl.teams where id = 'up-leftout';

alter table mvl.players
  add column if not exists contact_number text,
  add column if not exists email text,
  add column if not exists instagram_handle text;

-- Existing players receive the values from their most recent waiver.
update mvl.players p
set contact_number = latest.contact_number,
    email = latest.email,
    instagram_handle = latest.instagram_handle
from (
  select distinct on (w.player_id)
    w.player_id,
    trim(w.contact_number) as contact_number,
    lower(trim(w.email)) as email,
    nullif(trim(w.instagram_handle), '') as instagram_handle
  from mvl.waiver_submissions w
  where w.player_id is not null
  order by w.player_id, w.submitted_at desc, w.created_at desc
) latest
where p.id = latest.player_id;

create or replace function public.mvl_submit_player_waiver(
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
  v_contact_number text;
  v_email text;
  v_instagram_handle text;
begin
  if p_waiver_acknowledged is not true then
    raise exception 'Waiver acknowledgement is required';
  end if;

  v_contact_number := trim(p_contact_number);
  v_email := lower(trim(p_email));
  v_instagram_handle := nullif(trim(coalesce(p_instagram_handle, '')), '');

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

  update mvl.players
  set contact_number = v_contact_number,
      email = v_email,
      instagram_handle = v_instagram_handle
  where id = v_player.id;

  insert into mvl.waiver_submissions (
    team_id, player_id, first_name, last_name, contact_number, email,
    instagram_handle, fur_parent, emergency_contact_name,
    emergency_contact_number, relationship, relationship_other,
    waiver_acknowledged, submitted_at, user_agent
  ) values (
    p_team_id, v_player.id, v_first_name, v_last_name, v_contact_number, v_email,
    v_instagram_handle, p_fur_parent, p_emergency_contact_name,
    p_emergency_contact_number, p_relationship, nullif(p_relationship_other, ''),
    p_waiver_acknowledged, coalesce(p_submitted_at, now()), p_user_agent
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

grant execute on function public.mvl_submit_player_waiver(
  text, uuid, text, text, text, text, text, text, text, text, boolean, timestamptz, text
) to anon, authenticated;

notify pgrst, 'reload schema';
