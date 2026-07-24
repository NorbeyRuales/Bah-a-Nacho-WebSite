begin;

alter table public.profiles
  add column archived_at timestamptz;

create index profiles_created_at_idx
  on public.profiles (created_at desc);

create index profiles_status_created_at_idx
  on public.profiles (status, created_at desc)
  where archived_at is null;

create index profiles_role_created_at_idx
  on public.profiles (role_id, created_at desc)
  where archived_at is null;

create index profiles_archived_at_idx
  on public.profiles (archived_at desc)
  where archived_at is not null;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.roles role on role.id = profile.role_id
    where profile.id = auth.uid()
      and profile.status = 'active'
      and profile.archived_at is null
      and role.is_active
  );
$$;

create or replace function public.current_role_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role_id
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.status = 'active'
    and profile.archived_at is null;
$$;

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.roles role on role.id = profile.role_id
    join public.role_permissions role_permission on role_permission.role_id = role.id
    join public.permissions permission on permission.id = role_permission.permission_id
    where profile.id = auth.uid()
      and profile.status = 'active'
      and profile.archived_at is null
      and role.is_active
      and permission.code = required_permission
  );
$$;

create or replace function public.current_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(permission.code::text order by permission.code::text), array[]::text[])
  from public.profiles profile
  join public.roles role on role.id = profile.role_id
  join public.role_permissions role_permission on role_permission.role_id = role.id
  join public.permissions permission on permission.id = role_permission.permission_id
  where profile.id = auth.uid()
    and profile.status = 'active'
    and profile.archived_at is null
    and role.is_active;
$$;

create or replace function public.admin_save_user_profile(
  target_user_id uuid,
  target_first_name text,
  target_last_name text,
  target_role_id uuid,
  target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  administrator_role_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  current_role_id uuid;
  current_status text;
  current_archived_at timestamptz;
  target_role_code text;
  target_email text;
  active_administrator_count integer;
begin
  target_first_name := btrim(coalesce(target_first_name, ''));
  target_last_name := btrim(coalesce(target_last_name, ''));

  if caller_id is null or not public.has_permission('users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;

  if target_user_id is null
     or target_role_id is null
     or target_status not in ('active', 'inactive')
     or char_length(target_first_name) not between 2 and 100
     or char_length(target_last_name) > 100 then
    raise exception 'Los datos del usuario no son válidos.' using errcode = '22023';
  end if;

  select
    profile.role_id,
    profile.status,
    profile.archived_at,
    profile.email::text
  into
    current_role_id,
    current_status,
    current_archived_at,
    target_email
  from public.profiles profile
  where profile.id = target_user_id
  for update;

  if not found then
    raise exception 'El usuario indicado no existe.' using errcode = 'P0002';
  end if;

  if current_archived_at is not null then
    raise exception 'Restaura el usuario antes de modificarlo.' using errcode = '55000';
  end if;

  select role.code::text
  into target_role_code
  from public.roles role
  where role.id = target_role_id
    and role.is_active;

  if target_role_code is null then
    raise exception 'El rol indicado no existe o está inactivo.' using errcode = '22023';
  end if;

  if target_user_id = caller_id
     and (target_role_id is distinct from current_role_id or target_status is distinct from current_status) then
    raise exception 'No puedes cambiar tu propio rol o estado.' using errcode = '42501';
  end if;

  if current_role_id = administrator_role_id
     and current_status = 'active'
     and (target_role_id <> administrator_role_id or target_status <> 'active') then
    select count(*)
    into active_administrator_count
    from public.profiles profile
    where profile.role_id = administrator_role_id
      and profile.status = 'active'
      and profile.archived_at is null;

    if active_administrator_count <= 1 then
      raise exception 'Debe permanecer al menos un administrador activo.' using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set first_name = target_first_name,
      last_name = target_last_name,
      role_id = target_role_id,
      status = target_status
  where id = target_user_id;

  if target_role_code = 'customer' then
    insert into public.clients (profile_id, first_name, last_name, email, status)
    values (
      target_user_id,
      target_first_name,
      nullif(target_last_name, ''),
      target_email,
      target_status
    )
    on conflict (profile_id) where profile_id is not null do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        email = excluded.email,
        status = excluded.status,
        updated_at = now();
  end if;

  return jsonb_build_object(
    'id', target_user_id,
    'roleId', target_role_id,
    'roleCode', target_role_code,
    'status', target_status
  );
end;
$$;

create or replace function public.admin_update_user_access(
  target_user_id uuid,
  target_role_id uuid,
  target_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_first_name text;
  current_last_name text;
begin
  select profile.first_name, profile.last_name
  into current_first_name, current_last_name
  from public.profiles profile
  where profile.id = target_user_id;

  if not found then
    raise exception 'El usuario indicado no existe.' using errcode = 'P0002';
  end if;

  return public.admin_save_user_profile(
    target_user_id,
    current_first_name,
    current_last_name,
    target_role_id,
    target_status
  );
end;
$$;

create or replace function public.admin_archive_user(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  administrator_role_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  current_role_id uuid;
  current_status text;
  current_archived_at timestamptz;
  active_administrator_count integer;
begin
  if caller_id is null or not public.has_permission('users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;

  if target_user_id is null or target_user_id = caller_id then
    raise exception 'No puedes eliminar tu propia cuenta.' using errcode = '42501';
  end if;

  select profile.role_id, profile.status, profile.archived_at
  into current_role_id, current_status, current_archived_at
  from public.profiles profile
  where profile.id = target_user_id
  for update;

  if not found then
    raise exception 'El usuario indicado no existe.' using errcode = 'P0002';
  end if;

  if current_archived_at is not null then
    return jsonb_build_object('id', target_user_id, 'archived', true);
  end if;

  if current_role_id = administrator_role_id and current_status = 'active' then
    select count(*)
    into active_administrator_count
    from public.profiles profile
    where profile.role_id = administrator_role_id
      and profile.status = 'active'
      and profile.archived_at is null;

    if active_administrator_count <= 1 then
      raise exception 'Debe permanecer al menos un administrador activo.' using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set status = 'inactive',
      archived_at = now()
  where id = target_user_id;

  update public.clients
  set status = 'inactive',
      updated_at = now()
  where profile_id = target_user_id
    and deleted_at is null;

  return jsonb_build_object('id', target_user_id, 'archived', true);
end;
$$;

create or replace function public.admin_restore_user(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_archived_at timestamptz;
  target_role_active boolean;
begin
  if caller_id is null or not public.has_permission('users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;

  if target_user_id is null then
    raise exception 'El usuario indicado no es válido.' using errcode = '22023';
  end if;

  select profile.archived_at, role.is_active
  into current_archived_at, target_role_active
  from public.profiles profile
  join public.roles role on role.id = profile.role_id
  where profile.id = target_user_id
  for update of profile;

  if not found then
    raise exception 'El usuario indicado no existe.' using errcode = 'P0002';
  end if;

  if current_archived_at is null then
    return jsonb_build_object('id', target_user_id, 'archived', false);
  end if;

  if not target_role_active then
    raise exception 'No se puede restaurar un usuario con un rol inactivo.' using errcode = '23514';
  end if;

  update public.profiles
  set status = 'active',
      archived_at = null
  where id = target_user_id;

  update public.clients
  set status = 'active',
      updated_at = now()
  where profile_id = target_user_id
    and deleted_at is null;

  return jsonb_build_object('id', target_user_id, 'archived', false);
end;
$$;

revoke execute on function public.admin_save_user_profile(uuid, text, text, uuid, text) from public;
revoke execute on function public.admin_archive_user(uuid) from public;
revoke execute on function public.admin_restore_user(uuid) from public;
revoke execute on function public.admin_update_user_access(uuid, uuid, text) from public;

grant execute on function public.admin_save_user_profile(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.admin_archive_user(uuid) to authenticated;
grant execute on function public.admin_restore_user(uuid) to authenticated;
grant execute on function public.admin_update_user_access(uuid, uuid, text) to authenticated;

comment on column public.profiles.archived_at
  is 'Baja lógica reversible. La identidad permanece en Auth y conserva sus referencias históricas.';
comment on function public.admin_save_user_profile(uuid, text, text, uuid, text)
  is 'Actualiza datos, rol y estado con RBAC, protección de cuenta propia y del último administrador.';
comment on function public.admin_archive_user(uuid)
  is 'Archiva una cuenta sin borrar su identidad ni romper referencias históricas.';
comment on function public.admin_restore_user(uuid)
  is 'Restaura y activa una cuenta archivada cuyo rol continúa activo.';

commit;
