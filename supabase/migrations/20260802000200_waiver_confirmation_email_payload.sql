-- Provides the server-side email function with the saved waiver payload.
--
-- Apply with:
--   supabase db query --linked --file supabase/migrations/20260802000200_waiver_confirmation_email_payload.sql

create or replace function public.mvl_get_waiver_confirmation_email_payload(
  p_submission_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = mvl, public
as $$
  select jsonb_build_object(
    'submission',
    jsonb_build_object(
      'id', s.id,
      'team_id', s.team_id,
      'player_id', s.player_id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'email', s.email,
      'submitted_at', s.submitted_at,
      'fur_parent', s.fur_parent
    ),
    'team',
    jsonb_build_object(
      'id', t.id,
      'name', t.name
    )
  )
  from mvl.waiver_submissions s
  join mvl.teams t on t.id = s.team_id
  where s.id = p_submission_id;
$$;

revoke all on function public.mvl_get_waiver_confirmation_email_payload(uuid)
  from public, anon, authenticated;

grant execute on function public.mvl_get_waiver_confirmation_email_payload(uuid)
  to service_role;

notify pgrst, 'reload schema';
