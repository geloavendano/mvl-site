-- Keep roster contact fields out of the public Data API and expose only the
-- minimum information required by authenticated MVL administrators.

revoke all on table mvl.players from anon, authenticated;

drop policy if exists "Public can read players" on mvl.players;

-- The public waiver page continues to use public.mvl_get_team_players(), which
-- returns only player ID, display name, and jersey number.

create or replace function public.mvl_admin_get_player_contact_index(
  p_team_id text
) returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public, extensions
as $$
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (select 1 from mvl.teams t where t.id = p_team_id) then
    raise exception 'Team not found';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'playerId', p.id,
        'instagramHandle', nullif(trim(coalesce(latest.instagram_handle, p.instagram_handle, '')), ''),
        'hasEmergencyContact',
          latest.emergency_contact_name is not null
          and latest.emergency_contact_number is not null
      )
      order by p.sort_order, p.display_name
    )
    from mvl.players p
    left join lateral (
      select
        nullif(trim(w.instagram_handle), '') as instagram_handle,
        nullif(trim(w.emergency_contact_name), '') as emergency_contact_name,
        nullif(trim(w.emergency_contact_number), '') as emergency_contact_number
      from mvl.waiver_submissions w
      where w.player_id = p.id
        or (
          w.player_id is null
          and w.team_id = p.team_id
          and mvl.normalized_person_name(concat_ws(' ', w.first_name, w.last_name))
            = mvl.normalized_person_name(p.display_name)
        )
      order by w.submitted_at desc, w.created_at desc
      limit 1
    ) latest on true
    where p.team_id = p_team_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.mvl_admin_get_player_emergency_contact(
  p_player_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = mvl, public, extensions
as $$
declare
  v_contact jsonb;
begin
  if not mvl.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerName', p.display_name,
    'contactName', trim(w.emergency_contact_name),
    'relationship', case
      when lower(trim(w.relationship)) = 'other'
        and nullif(trim(w.relationship_other), '') is not null
        then trim(w.relationship_other)
      else trim(w.relationship)
    end,
    'phoneNumber', trim(w.emergency_contact_number)
  )
  into v_contact
  from mvl.players p
  join lateral (
    select
      waiver.emergency_contact_name,
      waiver.emergency_contact_number,
      waiver.relationship,
      waiver.relationship_other
    from mvl.waiver_submissions waiver
    where waiver.player_id = p.id
      or (
        waiver.player_id is null
        and waiver.team_id = p.team_id
        and mvl.normalized_person_name(concat_ws(' ', waiver.first_name, waiver.last_name))
          = mvl.normalized_person_name(p.display_name)
      )
    order by waiver.submitted_at desc, waiver.created_at desc
    limit 1
  ) w on true
  where p.id = p_player_id
    and nullif(trim(w.emergency_contact_name), '') is not null
    and nullif(trim(w.emergency_contact_number), '') is not null;

  if v_contact is null then
    raise exception 'Emergency contact not found';
  end if;

  return v_contact;
end;
$$;

revoke all on function public.mvl_admin_get_player_contact_index(text) from public;
revoke all on function public.mvl_admin_get_player_emergency_contact(uuid) from public;

grant execute on function public.mvl_admin_get_player_contact_index(text) to authenticated;
grant execute on function public.mvl_admin_get_player_emergency_contact(uuid) to authenticated;

notify pgrst, 'reload schema';
