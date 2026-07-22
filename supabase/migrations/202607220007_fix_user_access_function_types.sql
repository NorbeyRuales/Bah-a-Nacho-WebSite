begin;

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
  caller_id uuid := auth.uid();
  administrator_role_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  current_role_id uuid;
  target_role_code text;
  target_email text;
  target_first_name text;
  target_last_name text;
  active_administrator_count integer;
begin
  if caller_id is null or not public.has_permission('users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;

  if target_user_id is null or target_role_id is null or target_status not in ('active', 'inactive') then
    raise exception 'Los datos de acceso enviados no son válidos.' using errcode = '22023';
  end if;

  if target_user_id = caller_id then
    raise exception 'No puedes cambiar tu propio rol o estado.' using errcode = '42501';
  end if;

  select profile.role_id, profile.email::text, profile.first_name, profile.last_name
  into current_role_id, target_email, target_first_name, target_last_name
  from public.profiles profile
  where profile.id = target_user_id
  for update;

  if not found then
    raise exception 'El usuario indicado no existe.' using errcode = 'P0002';
  end if;

  select role.code::text
  into target_role_code
  from public.roles role
  where role.id = target_role_id
    and role.is_active;

  if target_role_code is null then
    raise exception 'El rol indicado no existe o está inactivo.' using errcode = '22023';
  end if;

  if current_role_id = administrator_role_id
     and (target_role_id <> administrator_role_id or target_status <> 'active') then
    select count(*)
    into active_administrator_count
    from public.profiles profile
    where profile.role_id = administrator_role_id
      and profile.status = 'active';

    if active_administrator_count <= 1 then
      raise exception 'Debe permanecer al menos un administrador activo.' using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set role_id = target_role_id,
      status = target_status,
      updated_at = now()
  where id = target_user_id;

  if target_role_code = 'customer' then
    insert into public.clients (profile_id, first_name, last_name, email, status)
    values (
      target_user_id,
      coalesce(nullif(btrim(target_first_name), ''), 'Cliente'),
      nullif(btrim(target_last_name), ''),
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

revoke execute on function public.admin_update_user_access(uuid, uuid, text) from public;
grant execute on function public.admin_update_user_access(uuid, uuid, text) to authenticated;

commit;
