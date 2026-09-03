-- Track whether each raffle prize has been handed to its winner.
-- Existing and newly-created prize records start as pending.
--
-- Apply individually, NOT with `supabase db push`.

alter table mvl.raffle_blacklist
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'awarded'));

create or replace function public.mvl_admin_get_raffle_blacklist()
returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public, extensions
as $$
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'playerId', p.id,
        'playerName', p.display_name,
        'jerseyNumber', p.jersey_number,
        'teamId', t.id,
        'teamName', t.name,
        'note', b.note,
        'status', b.status,
        'createdAt', b.created_at
      )
      order by b.created_at desc, t.sort_order, p.sort_order, p.display_name
    )
    from mvl.raffle_blacklist b
    join mvl.players p on p.id = b.player_id
    join mvl.teams t on t.id = p.team_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mvl_admin_update_raffle_winner_status(
  p_blacklist_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_player_id uuid;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'awarded') then
    raise exception 'Status must be pending or awarded' using errcode = '22023';
  end if;

  update mvl.raffle_blacklist b
  set status = v_status
  where b.id = p_blacklist_id
  returning b.player_id into v_player_id;

  if not found then
    raise exception 'Raffle winner record not found';
  end if;

  return jsonb_build_object(
    'id', p_blacklist_id,
    'playerId', v_player_id,
    'status', v_status
  );
end;
$$;

revoke all on function public.mvl_admin_get_raffle_blacklist() from public;
revoke all on function public.mvl_admin_update_raffle_winner_status(uuid, text) from public;
revoke all on function public.mvl_admin_update_raffle_winner_status(uuid, text) from anon;
grant execute on function public.mvl_admin_get_raffle_blacklist() to authenticated;
grant execute on function public.mvl_admin_update_raffle_winner_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
