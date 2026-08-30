-- Let admins save or clear a game's YouTube links without finalizing the game.
-- Apply individually, NOT with `supabase db push`.

create or replace function public.mvl_admin_save_game_videos(
  p_game_id text,
  p_videos jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_video_count integer;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  perform 1
  from mvl.games g
  where g.id = p_game_id
  for update;

  if not found then
    raise exception 'Game % not found', p_game_id;
  end if;

  if p_videos is null or jsonb_typeof(p_videos) <> 'array' then
    raise exception 'Videos must be provided as a list';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_videos) as row(item)
    where nullif(trim(item->>'label'), '') is null
      or length(trim(item->>'label')) > 80
      or coalesce(trim(item->>'youtube_id'), '') !~ '^[A-Za-z0-9_-]{11}$'
  ) then
    raise exception 'Every video needs a label and a valid YouTube URL';
  end if;

  if exists (
    select 1
    from (
      select trim(item->>'youtube_id') as youtube_id
      from jsonb_array_elements(p_videos) as row(item)
      group by trim(item->>'youtube_id')
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'The same YouTube video cannot be added twice to one game';
  end if;

  delete from mvl.game_videos gv
  where gv.game_id = p_game_id;

  insert into mvl.game_videos (
    game_id,
    youtube_id,
    label,
    title,
    duration_seconds,
    published_at,
    is_featured,
    sort_order
  )
  select
    p_game_id,
    trim(item->>'youtube_id'),
    trim(item->>'label'),
    trim(item->>'label'),
    null,
    now(),
    row_number = 1,
    row_number::integer - 1
  from jsonb_array_elements(p_videos) with ordinality as row(item, row_number);

  get diagnostics v_video_count = row_count;

  return jsonb_build_object(
    'gameId', p_game_id,
    'videoCount', v_video_count
  );
end;
$$;

revoke all on function public.mvl_admin_save_game_videos(text, jsonb) from public;
grant execute on function public.mvl_admin_save_game_videos(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
