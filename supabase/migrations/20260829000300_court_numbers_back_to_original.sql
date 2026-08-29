-- Client correction mid-game-day: the court hosting Thurstrap vs S24 (venue
-- 2222…) is Court 2, not Court 1. That restores the original numbering and
-- undoes the swap in 20260829000200.
--   venue 1111… -> Court 1   (Secret vs Gizmo, Metarice X vs SSVC, …)
--   venue 2222… -> Court 2   (Thurstrap vs S24, Metarice Y vs Gremlins, …)
-- Labels only: no game changes venue, so scores already recorded stay with
-- their court.
--
-- Apply individually, NOT with `supabase db push`.

update mvl.venues set name = 'Gameville Ball Park · Court 1'
where id = '11111111-1111-4111-8111-111111111111';

update mvl.venues set name = 'Gameville Ball Park · Court 2'
where id = '22222222-2222-4222-8222-222222222222';

-- Livestream slot 0 is venue 1111…, which is Court 1 again.
update mvl.site_settings
set value = jsonb_set(
      value, '{streams}',
      (select jsonb_agg(
         jsonb_set(s, '{court}', (case idx when 1 then '"Court 1"' else '"Court 2"' end)::jsonb)
         order by idx)
       from jsonb_array_elements(value->'streams') with ordinality as t(s, idx))
    ),
    updated_at = now()
where key = 'livestream' and value ? 'streams';

create or replace function public.mvl_admin_update_livestreams(p_streams jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'mvl', 'public'
as $function$
declare
  v_court_1 jsonb;
  v_court_2 jsonb;
  v_streams jsonb;
  v_primary jsonb;
  v_value jsonb;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_streams is null
    or jsonb_typeof(p_streams) <> 'array'
    or jsonb_array_length(p_streams) <> 2
  then
    raise exception 'Provide one livestream configuration for each court';
  end if;

  v_court_1 := p_streams->0;
  v_court_2 := p_streams->1;

  if coalesce((v_court_1->>'is_live')::boolean, false)
    and coalesce(v_court_1->>'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$'
  then
    raise exception 'Court 1 needs a valid YouTube livestream link before it can go live';
  end if;
  if coalesce((v_court_2->>'is_live')::boolean, false)
    and coalesce(v_court_2->>'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$'
  then
    raise exception 'Court 2 needs a valid YouTube livestream link before it can go live';
  end if;

  v_streams := jsonb_build_array(
    jsonb_build_object(
      'court', 'Court 1',
      'is_live', coalesce((v_court_1->>'is_live')::boolean, false),
      'youtube_url', coalesce(nullif(trim(v_court_1->>'youtube_url'), ''), 'https://www.youtube.com/@metaricevolley'),
      'youtube_id', coalesce(trim(v_court_1->>'youtube_id'), '')
    ),
    jsonb_build_object(
      'court', 'Court 2',
      'is_live', coalesce((v_court_2->>'is_live')::boolean, false),
      'youtube_url', coalesce(nullif(trim(v_court_2->>'youtube_url'), ''), 'https://www.youtube.com/@metaricevolley'),
      'youtube_id', coalesce(trim(v_court_2->>'youtube_id'), '')
    )
  );

  v_primary := case
    when (v_streams->0->>'is_live')::boolean then v_streams->0
    when (v_streams->1->>'is_live')::boolean then v_streams->1
    else v_streams->0
  end;
  v_value := jsonb_build_object(
    'streams', v_streams,
    'is_live', (v_streams->0->>'is_live')::boolean or (v_streams->1->>'is_live')::boolean,
    'youtube_url', v_primary->>'youtube_url',
    'youtube_id', v_primary->>'youtube_id'
  );

  insert into mvl.site_settings (key, value, updated_at, updated_by)
  values ('livestream', v_value, now(), auth.uid())
  on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return v_value;
end;
$function$;
