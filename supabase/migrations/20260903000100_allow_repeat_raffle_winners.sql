-- Record every raffle prize separately, including repeat wins when an admin
-- intentionally includes previous winners in the draw pool. Eligibility is
-- enforced by the draw RPC, not when the resulting prize is saved.
--
-- Apply individually, NOT with `supabase db push`.

alter table mvl.raffle_blacklist
  drop constraint if exists raffle_blacklist_player_id_key;

create index if not exists raffle_blacklist_player_idx
  on mvl.raffle_blacklist (player_id);

create or replace function public.mvl_admin_add_raffle_blacklist(
  p_player_id uuid,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_note text := trim(coalesce(p_note, ''));
  v_id uuid;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from mvl.players p where p.id = p_player_id) then
    raise exception 'Player not found';
  end if;
  if length(v_note) not between 1 and 240 then
    raise exception 'Enter a prize or note between 1 and 240 characters';
  end if;

  insert into mvl.raffle_blacklist (player_id, note, created_by)
  values (p_player_id, v_note, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'playerId', p_player_id, 'note', v_note);
end;
$$;

revoke all on function public.mvl_admin_add_raffle_blacklist(uuid, text) from public;
revoke all on function public.mvl_admin_add_raffle_blacklist(uuid, text) from anon;
grant execute on function public.mvl_admin_add_raffle_blacklist(uuid, text) to authenticated;

notify pgrst, 'reload schema';
