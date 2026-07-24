begin;

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_role_id constant uuid := '00000000-0000-0000-0000-000000000005'::uuid;
  metadata_first_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), 100);
  metadata_last_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), 100);
  should_provision_client boolean :=
    coalesce(new.raw_user_meta_data ->> 'provision_client_profile', 'true') <> 'false';
  linked_client_id uuid;
begin
  if new.email is null then
    raise exception 'La aplicación requiere una dirección de correo para crear el perfil.'
      using errcode = '23502';
  end if;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    email,
    role_id,
    status
  )
  values (
    new.id,
    metadata_first_name,
    metadata_last_name,
    new.email,
    customer_role_id,
    'active'
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  if tg_op = 'INSERT' and should_provision_client then
    update public.clients
    set profile_id = new.id,
        email = new.email,
        updated_at = now()
    where id = (
      select client.id
      from public.clients client
      where client.profile_id is null
        and client.deleted_at is null
        and lower(client.email::text) = lower(new.email)
      order by client.created_at
      limit 1
    )
    returning id into linked_client_id;

    if linked_client_id is null then
      insert into public.clients (
        profile_id,
        first_name,
        last_name,
        email,
        status
      )
      values (
        new.id,
        coalesce(nullif(metadata_first_name, ''), 'Cliente'),
        nullif(metadata_last_name, ''),
        new.email,
        'active'
      );
    end if;
  elsif tg_op = 'UPDATE' then
    update public.clients
    set email = new.email,
        updated_at = now()
    where profile_id = new.id;
  end if;

  return new;
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
  if auth.uid() is null or not public.has_permission('users.manage') then
    raise exception 'No tienes permiso para administrar usuarios.' using errcode = '42501';
  end if;

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

revoke execute on function public.sync_auth_user_profile() from public;
revoke execute on function public.admin_update_user_access(uuid, uuid, text) from public;
grant execute on function public.admin_update_user_access(uuid, uuid, text) to authenticated;

comment on function public.sync_auth_user_profile()
  is 'Sincroniza Auth con profiles y solo crea una ficha comercial cuando la invitación corresponde a un cliente.';

commit;
