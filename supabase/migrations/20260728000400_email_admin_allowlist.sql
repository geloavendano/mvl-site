-- Allow MVL administrators to be registered by email before their first
-- Google sign-in. Existing UUID-based administrators are preserved.

alter table mvl.admin_users
  add column if not exists email text;

update mvl.admin_users a
set email = lower(trim(u.email))
from auth.users u
where u.id = a.user_id
  and a.email is null;

do $$
begin
  if exists (select 1 from mvl.admin_users where email is null) then
    raise exception 'Cannot migrate an MVL admin without an Auth email';
  end if;
end;
$$;

alter table mvl.admin_users
  drop constraint if exists admin_users_pkey;

alter table mvl.admin_users
  alter column user_id drop not null,
  alter column email set not null;

alter table mvl.admin_users
  add constraint admin_users_pkey primary key (email),
  add constraint admin_users_email_normalized
    check (email = lower(trim(email))),
  add constraint admin_users_user_id_key unique (user_id);

create or replace function mvl.is_admin()
returns boolean
language sql
stable
security definer
set search_path = mvl, public
as $$
  select
    coalesce(auth.jwt()->'app_metadata'->>'provider', '') = 'google'
    and exists (
      select 1
      from mvl.admin_users
      where email = lower(trim(auth.jwt()->>'email'))
    )
$$;

revoke all on function mvl.is_admin() from public;
grant execute on function mvl.is_admin() to authenticated;

