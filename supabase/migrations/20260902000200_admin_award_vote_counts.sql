-- Aggregate-only special-award results for signed-in MVL administrators.
-- Individual ballots and voter identities remain inaccessible.
--
-- Apply individually, NOT with `supabase db push`.

create or replace function public.mvl_admin_get_award_vote_counts(
  p_award_id text
) returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public
as $$
declare
  v_award_id text := trim(coalesce(p_award_id, ''));
  v_result jsonb;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if v_award_id = '' then
    raise exception 'Award is required' using errcode = '22023';
  end if;

  with vote_counts as (
    select
      v.nominee_player_id,
      count(*)::integer as vote_count
    from mvl.award_votes v
    where v.award_id = v_award_id
    group by v.nominee_player_id
  )
  select jsonb_build_object(
    'awardId', v_award_id,
    'totalVotes', coalesce(sum(vc.vote_count), 0),
    'nominees', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'playerId', p.id,
          'playerName', trim(concat_ws(' ', p.display_name, p.surname)),
          'jerseyNumber', p.jersey_number,
          'teamId', p.team_id,
          'teamName', t.name,
          'voteCount', vc.vote_count
        )
        order by vc.vote_count desc, t.name asc, p.display_name asc, p.surname asc
      ) filter (where vc.nominee_player_id is not null),
      '[]'::jsonb
    )
  ) into v_result
  from vote_counts vc
  join mvl.players p on p.id = vc.nominee_player_id
  join mvl.teams t on t.id = p.team_id;

  return v_result;
end;
$$;

revoke all on function public.mvl_admin_get_award_vote_counts(text) from public;
revoke all on function public.mvl_admin_get_award_vote_counts(text) from anon;
grant execute on function public.mvl_admin_get_award_vote_counts(text) to authenticated;

notify pgrst, 'reload schema';
