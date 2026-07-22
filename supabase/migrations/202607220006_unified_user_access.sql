begin;

insert into public.roles (id, code, name, description, is_system)
values (
  '00000000-0000-0000-0000-000000000005',
  'customer',
  'Cliente',
  'Acceso al portal privado de clientes.',
  true
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    is_system = true,
    is_active = true;

alter table public.clients
  add column profile_id uuid references public.profiles(id) on delete set null;

create unique index clients_profile_id_uidx
  on public.clients (profile_id)
  where profile_id is not null;

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_role_id constant uuid := '00000000-0000-0000-0000-000000000005';
  metadata_first_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), 100);
  metadata_last_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), 100);
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

  if tg_op = 'INSERT' then
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
  else
    update public.clients
    set email = new.email,
        updated_at = now()
    where profile_id = new.id;
  end if;

  return new;
end;
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
    and role.is_active;
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
  caller_id uuid := auth.uid();
  administrator_role_id constant uuid := '00000000-0000-0000-0000-000000000001';
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

create or replace function public.customer_portal_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_client public.clients%rowtype;
begin
  if current_user_id is null or not public.is_active_user() then
    raise exception 'Se requiere una sesión activa.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    join public.roles role on role.id = profile.role_id
    where profile.id = current_user_id
      and role.code = 'customer'
  ) then
    raise exception 'Esta función está disponible únicamente para clientes.' using errcode = '42501';
  end if;

  select client.*
  into current_client
  from public.clients client
  where client.profile_id = current_user_id
    and client.deleted_at is null
  limit 1;

  if current_client.id is null then
    raise exception 'No existe una ficha de cliente vinculada a esta cuenta.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'customer', jsonb_build_object(
      'id', current_client.id,
      'firstName', current_client.first_name,
      'lastName', current_client.last_name,
      'email', current_client.email,
      'phone', current_client.phone,
      'company', current_client.company
    ),
    'stats', jsonb_build_object(
      'inquiries', (
        select count(*) from public.inquiries inquiry
        where inquiry.client_id = current_client.id
      ),
      'activeQuotations', (
        select count(*) from public.quotations quotation
        where quotation.client_id = current_client.id
          and quotation.status in ('draft', 'sent')
      )
    ),
    'recentInquiries', (
      select coalesce(jsonb_agg(to_jsonb(recent_inquiry)), '[]'::jsonb)
      from (
        select inquiry.id, inquiry.status, inquiry.message, inquiry.created_at
        from public.inquiries inquiry
        where inquiry.client_id = current_client.id
        order by inquiry.created_at desc
        limit 5
      ) recent_inquiry
    ),
    'recentQuotations', (
      select coalesce(jsonb_agg(to_jsonb(recent_quotation)), '[]'::jsonb)
      from (
        select
          quotation.id,
          quotation.quote_number,
          quotation.status,
          quotation.total,
          quotation.currency_code,
          quotation.created_at
        from public.quotations quotation
        where quotation.client_id = current_client.id
        order by quotation.created_at desc
        limit 5
      ) recent_quotation
    ),
    'generatedAt', now()
  );
end;
$$;

drop policy if exists clients_select_policy on public.clients;
create policy clients_select_policy on public.clients
for select to authenticated
using (profile_id = auth.uid() or public.has_permission('clients.read'));

drop policy if exists inquiries_select_policy on public.inquiries;
create policy inquiries_select_policy on public.inquiries
for select to authenticated
using (
  public.has_permission('inquiries.read')
  or exists (
    select 1
    from public.clients client
    where client.id = client_id
      and client.profile_id = auth.uid()
  )
);

drop policy if exists quotations_select_policy on public.quotations;
create policy quotations_select_policy on public.quotations
for select to authenticated
using (
  public.has_permission('quotations.read')
  or exists (
    select 1
    from public.clients client
    where client.id = client_id
      and client.profile_id = auth.uid()
  )
);

drop policy if exists quotation_items_select_policy on public.quotation_items;
create policy quotation_items_select_policy on public.quotation_items
for select to authenticated
using (
  public.has_permission('quotations.read')
  or exists (
    select 1
    from public.quotations quotation
    join public.clients client on client.id = quotation.client_id
    where quotation.id = quotation_id
      and client.profile_id = auth.uid()
  )
);

revoke update on public.profiles from authenticated;

revoke execute on function public.current_permissions() from public;
revoke execute on function public.admin_update_user_access(uuid, uuid, text) from public;
revoke execute on function public.customer_portal_snapshot() from public;

grant execute on function public.current_permissions() to authenticated;
grant execute on function public.admin_update_user_access(uuid, uuid, text) to authenticated;
grant execute on function public.customer_portal_snapshot() to authenticated;

comment on column public.clients.profile_id
  is 'Vínculo opcional uno a uno con la identidad autenticada del cliente.';
comment on function public.admin_update_user_access(uuid, uuid, text)
  is 'Cambio administrativo y auditado de rol/estado; impide auto-bloqueo y protege al último administrador.';
comment on function public.customer_portal_snapshot()
  is 'Resumen privado del cliente autenticado, aislado por auth.uid().';

commit;
