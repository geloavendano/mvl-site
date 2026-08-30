-- Let admins correct only the prize/note on an existing raffle winner.
-- Apply individually, NOT with `supabase db push`.

create or replace function public.mvl_admin_update_raffle_blacklist_note(
  p_blacklist_id uuid,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_note text := trim(coalesce(p_note, ''));
  v_player_id uuid;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if length(v_note) not between 1 and 240 then
    raise exception 'Enter a prize or note between 1 and 240 characters';
  end if;

  update mvl.raffle_blacklist b
  set note = v_note
  where b.id = p_blacklist_id
  returning b.player_id into v_player_id;

  if not found then
    raise exception 'Raffle Winner entry not found';
  end if;

  return jsonb_build_object(
    'id', p_blacklist_id,
    'playerId', v_player_id,
    'note', v_note
  );
end;
$$;

revoke all on function public.mvl_admin_update_raffle_blacklist_note(uuid, text) from public;
grant execute on function public.mvl_admin_update_raffle_blacklist_note(uuid, text) to authenticated;

notify pgrst, 'reload schema';
