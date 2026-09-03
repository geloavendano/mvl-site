-- Payload for the special-award vote confirmation email.
-- (Do NOT `supabase db push` — the linked project has unrelated migration history.)
--
-- mvl_submit_award_votes already returns what the /vote done screen needs, but
-- the email is sent from an edge function that only has the voter's id, and it
-- needs each nominee's name, team and photo to draw the cards. Same shape and
-- same service_role-only lock as mvl_get_checkin_confirmation_email_payload.

create or replace function public.mvl_get_vote_confirmation_email_payload(p_voter_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'mvl', 'public'
as $function$
declare
  v_voter mvl.players;
  v_team  mvl.teams;
  v_picks jsonb;
begin
  select * into v_voter from mvl.players p where p.id = p_voter_player_id;
  if not found then
    return null;
  end if;

  select * into v_team from mvl.teams t where t.id = v_voter.team_id;

  -- Ordered by the ballot's own order rather than created_at, so the email
  -- lists the awards the same way /vote presents them however the rows landed.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'award_id',      x.award_id,
        'player_name',   trim(x.display_name || ' ' || coalesce(x.surname, '')),
        'jersey_number', x.jersey_number,
        'team_id',       x.team_id,
        'team_name',     x.team_name,
        'photo_url',     x.photo_url
      )
      order by x.rank, x.created_at
    ),
    '[]'::jsonb
  )
  into v_picks
  from (
    select
      v.award_id,
      v.created_at,
      coalesce(
        array_position(
          array['fresh-new-player', 'extra-strong-sigaw',
                'outstanding-sportsmanship', 'face-of-the-league'],
          v.award_id
        ),
        99
      ) as rank,
      p.display_name,
      p.surname,
      p.jersey_number,
      p.team_id,
      t.name as team_name,
      p.photo_url
    from mvl.award_votes v
    join mvl.players p on p.id = v.nominee_player_id
    left join mvl.teams t on t.id = p.team_id
    where v.voter_player_id = p_voter_player_id
  ) x;

  return jsonb_build_object(
    -- When the ballot was cast. The email's idempotency key is built from this
    -- so a retrying client cannot send twice, while a voter who genuinely casts
    -- a new ballot (their old one cleared) still gets a fresh confirmation.
    'cast_at', (
      select max(v.created_at) from mvl.award_votes v
      where v.voter_player_id = p_voter_player_id
    ),
    'voter', jsonb_build_object(
      'display_name', v_voter.display_name,
      'surname',      v_voter.surname,
      'email',        v_voter.email,
      'team_name',    v_team.name
    ),
    'picks', v_picks
  );
end;
$function$;

-- The payload carries a participant's email address, so only the edge function
-- may read it. anon holds the site's public key.
revoke all on function public.mvl_get_vote_confirmation_email_payload(uuid) from public;
revoke all on function public.mvl_get_vote_confirmation_email_payload(uuid) from anon;
revoke all on function public.mvl_get_vote_confirmation_email_payload(uuid) from authenticated;
grant execute on function public.mvl_get_vote_confirmation_email_payload(uuid) to service_role;
