create or replace function public.mvl_admin_update_game_schedule(
  p_game_id text,
  p_day integer,
  p_starts_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public
as $$
declare v_game mvl.games;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_day is null or p_day < 1 then raise exception 'Match day must be at least 1'; end if;
  if p_starts_at is null then raise exception 'Game date and time are required'; end if;
  update mvl.games set day = p_day, starts_at = p_starts_at where id = p_game_id returning * into v_game;
  if not found then raise exception 'Game % not found', p_game_id; end if;
  return jsonb_build_object('id',v_game.id,'day',v_game.day,'startsAt',v_game.starts_at);
end;
$$;
grant execute on function public.mvl_admin_update_game_schedule(text,integer,timestamptz) to authenticated;
