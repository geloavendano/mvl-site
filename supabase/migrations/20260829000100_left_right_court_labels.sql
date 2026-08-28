-- Rename the two courts from "Court 1"/"Court 2" to "Left Court"/"Right Court".
-- The numbering meant nothing to anyone standing at Gameville Ball Park; the
-- sides do.
--
-- Apply individually, NOT with `supabase db push` — the linked project carries
-- unrelated migration history.
--   supabase db query --linked --file supabase/migrations/20260829000100_left_right_court_labels.sql

-- 1. Venue names. schedule.js takes the half after the "·" for the card, so
--    this alone changes what the public schedule shows.
update mvl.venues set name = 'Gameville Ball Park · Left Court'
where name = 'Gameville Ball Park · Court 1';

update mvl.venues set name = 'Gameville Ball Park · Right Court'
where name = 'Gameville Ball Park · Court 2';

-- 2. The stored livestream labels.
update mvl.site_settings
set value = jsonb_set(
      value,
      '{streams}',
      (
        select jsonb_agg(
          case s->>'court'
            when 'Court 1' then jsonb_set(s, '{court}', '"Left Court"')
            when 'Court 2' then jsonb_set(s, '{court}', '"Right Court"')
            else s
          end
          order by idx
        )
        from jsonb_array_elements(value->'streams') with ordinality as t(s, idx)
      )
    ),
    updated_at = now()
where key = 'livestream'
  and value ? 'streams';

-- 3. mvl_admin_update_livestreams WRITES the labels, so without this the next
--    save from the admin console would put "Court 1"/"Court 2" back. Body is
--    unchanged apart from the four labels.
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
    raise exception 'Left Court needs a valid YouTube livestream link before it can go live';
  end if;
  if coalesce((v_court_2->>'is_live')::boolean, false)
    and coalesce(v_court_2->>'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$'
  then
    raise exception 'Right Court needs a valid YouTube livestream link before it can go live';
  end if;

  v_streams := jsonb_build_array(
    jsonb_build_object(
      'court', 'Left Court',
      'is_live', coalesce((v_court_1->>'is_live')::boolean, false),
      'youtube_url', coalesce(nullif(trim(v_court_1->>'youtube_url'), ''), 'https://www.youtube.com/@metaricevolley'),
      'youtube_id', coalesce(trim(v_court_1->>'youtube_id'), '')
    ),
    jsonb_build_object(
      'court', 'Right Court',
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
