-- Avoid PL/pgSQL output-column ambiguity in mvl_record_game_result.
--
-- The function returns a column named game_id. Its original
-- `on conflict (game_id, youtube_id)` target could therefore refer either to
-- the output variable or mvl.game_videos.game_id. A named unique constraint
-- makes the upsert target explicit.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'mvl.game_videos'::regclass
      and conname = 'game_videos_game_youtube_key'
  ) then
    if to_regclass('mvl.game_videos_game_youtube_idx') is not null then
      alter table mvl.game_videos
        add constraint game_videos_game_youtube_key
        unique using index game_videos_game_youtube_idx;
    else
      alter table mvl.game_videos
        add constraint game_videos_game_youtube_key
        unique (game_id, youtube_id);
    end if;
  end if;
end;
$$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.mvl_record_game_result(text,text,uuid,jsonb,text,text,integer,timestamptz,boolean)'::regprocedure
  )
  into definition;

  if position('on conflict (game_id, youtube_id)' in definition) > 0 then
    definition := replace(
      definition,
      'on conflict (game_id, youtube_id)',
      'on conflict on constraint game_videos_game_youtube_key'
    );
    execute definition;
  elsif position('on conflict on constraint game_videos_game_youtube_key' in definition) = 0 then
    raise exception 'Could not locate the game video upsert in mvl_record_game_result';
  end if;
end;
$$;
