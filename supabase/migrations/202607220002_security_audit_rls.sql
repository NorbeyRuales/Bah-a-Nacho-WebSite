begin;

alter table public.inquiries
  add column ip_address inet;

create index inquiries_ip_rate_limit_idx
  on public.inquiries (ip_address, created_at desc)
  where ip_address is not null;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.status = 'active'
      and r.is_active
  );
$$;

create or replace function public.current_role_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.role_id
  from public.profiles p
  where p.id = auth.uid()
    and p.status = 'active';
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
      and role.is_active
      and permission.code = required_permission
  );
$$;

create or replace function public.touch_last_access()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_time timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada.' using errcode = '28000';
  end if;

  update public.profiles
  set last_access_at = access_time,
      updated_at = access_time
  where id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'El usuario no existe o está inactivo.' using errcode = '42501';
  end if;

  return access_time;
end;
$$;

create or replace function public.current_request_ip()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  headers jsonb;
  candidate text;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  candidate := split_part(
    coalesce(headers ->> 'x-forwarded-for', headers ->> 'x-real-ip', ''),
    ',',
    1
  );

  if btrim(candidate) <> '' then
    return btrim(candidate)::inet;
  end if;

  return inet_client_addr();
exception
  when others then
    return inet_client_addr();
end;
$$;

create or replace function public.current_request_user_agent()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  headers jsonb;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  return left(headers ->> 'user-agent', 1000);
exception
  when others then
    return null;
end;
$$;

create or replace function public.current_request_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  headers jsonb;
  candidate text;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  candidate := headers ->> 'x-request-id';
  if candidate is null or btrim(candidate) = '' then
    return null;
  end if;
  return candidate::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
  after_row jsonb;
  affected_id text;
  changed_columns text[];
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
    affected_id := after_row ->> 'id';
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
    affected_id := coalesce(after_row ->> 'id', before_row ->> 'id');

    select array_agg(key_name order by key_name)
      into changed_columns
    from (
      select jsonb_object_keys(coalesce(before_row, '{}'::jsonb)) as key_name
      union
      select jsonb_object_keys(coalesce(after_row, '{}'::jsonb)) as key_name
    ) keys
    where before_row -> key_name is distinct from after_row -> key_name;
  else
    before_row := to_jsonb(old);
    affected_id := before_row ->> 'id';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    schema_name,
    table_name,
    record_id,
    before_data,
    after_data,
    changed_fields,
    ip_address,
    user_agent,
    request_id
  )
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_schema,
    tg_table_name,
    affected_id,
    before_row,
    after_row,
    changed_columns,
    public.current_request_ip(),
    public.current_request_user_agent(),
    public.current_request_id()
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roles', 'permissions', 'role_permissions', 'profiles', 'brands', 'categories',
    'subcategories', 'engines', 'warehouses', 'warehouse_locations', 'products',
    'product_images', 'product_engine_compatibilities', 'suppliers', 'product_suppliers',
    'inventory_balances', 'inventory_movements', 'clients', 'inquiries', 'quotations',
    'quotation_items', 'excel_imports', 'app_settings'
  ]
  loop
    execute format(
      'create trigger audit_%1$s_trigger after insert or update or delete on public.%1$I for each row execute function public.write_audit_log()',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.prevent_system_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'Los roles del sistema no se pueden eliminar.' using errcode = '55000';
  end if;

  if old.is_system and (
    new.id is distinct from old.id
    or new.code is distinct from old.code
    or new.is_system is distinct from old.is_system
  ) then
    raise exception 'El identificador y código de un rol del sistema son inmutables.' using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger prevent_system_role_change_trigger
before update or delete on public.roles
for each row execute function public.prevent_system_role_change();

create or replace function public.submit_inquiry(
  contact_name text,
  contact_email text,
  contact_phone text,
  inquiry_message text,
  requested_product_id uuid default null,
  inquiry_source text default 'web'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_inquiry_id uuid;
  requester_ip inet := public.current_request_ip();
  recent_count integer;
begin
  contact_name := btrim(contact_name);
  contact_email := nullif(lower(btrim(contact_email)), '');
  contact_phone := nullif(btrim(contact_phone), '');
  inquiry_message := btrim(inquiry_message);

  if char_length(contact_name) not between 2 and 160 then
    raise exception 'El nombre debe contener entre 2 y 160 caracteres.' using errcode = '22023';
  end if;

  if contact_email is null and contact_phone is null then
    raise exception 'Debe indicar un correo o teléfono.' using errcode = '22023';
  end if;

  if contact_email is not null and (
    char_length(contact_email) > 254
    or contact_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  ) then
    raise exception 'El correo no tiene un formato válido.' using errcode = '22023';
  end if;

  if char_length(inquiry_message) not between 5 and 5000 then
    raise exception 'El mensaje debe contener entre 5 y 5000 caracteres.' using errcode = '22023';
  end if;

  if inquiry_source not in ('web', 'whatsapp', 'phone', 'email', 'in_person', 'other') then
    raise exception 'El origen de la consulta no es válido.' using errcode = '22023';
  end if;

  if requested_product_id is not null and not exists (
    select 1
    from public.products product
    where product.id = requested_product_id
      and product.status = 'active'
      and product.deleted_at is null
  ) then
    raise exception 'El producto consultado no está disponible.' using errcode = '22023';
  end if;

  if requester_ip is not null then
    select count(*)
      into recent_count
    from public.inquiries inquiry
    where inquiry.ip_address = requester_ip
      and inquiry.created_at >= now() - interval '10 minutes';

    if recent_count >= 5 then
      raise exception 'Demasiadas consultas recientes. Intente nuevamente más tarde.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.inquiries (
    product_id,
    name,
    email,
    phone,
    message,
    source,
    status,
    ip_address
  )
  values (
    requested_product_id,
    contact_name,
    contact_email,
    contact_phone,
    inquiry_message,
    inquiry_source,
    'new',
    requester_ip
  )
  returning id into new_inquiry_id;

  return new_inquiry_id;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roles', 'permissions', 'role_permissions', 'profiles', 'brands', 'categories',
    'subcategories', 'engines', 'warehouses', 'warehouse_locations', 'products',
    'product_images', 'product_engine_compatibilities', 'suppliers', 'product_suppliers',
    'inventory_balances', 'inventory_movements', 'clients', 'inquiries', 'quotations',
    'quotation_items', 'audit_logs', 'excel_imports', 'excel_import_errors', 'app_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy roles_select_policy on public.roles
for select to authenticated
using (id = public.current_role_id() or public.has_permission('roles.read'));
create policy roles_manage_policy on public.roles
for all to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));

create policy permissions_select_policy on public.permissions
for select to authenticated
using (public.has_permission('roles.read'));
create policy permissions_manage_policy on public.permissions
for all to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));

create policy role_permissions_select_policy on public.role_permissions
for select to authenticated
using (role_id = public.current_role_id() or public.has_permission('roles.read'));
create policy role_permissions_manage_policy on public.role_permissions
for all to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));

create policy profiles_select_policy on public.profiles
for select to authenticated
using (id = auth.uid() or public.has_permission('users.read'));
create policy profiles_update_policy on public.profiles
for update to authenticated
using (public.has_permission('users.manage'))
with check (public.has_permission('users.manage'));

create policy brands_public_select_policy on public.brands
for select to anon, authenticated
using (is_active or public.has_permission('products.read'));
create policy brands_manage_policy on public.brands
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy categories_public_select_policy on public.categories
for select to anon, authenticated
using (is_active or public.has_permission('products.read'));
create policy categories_manage_policy on public.categories
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy subcategories_public_select_policy on public.subcategories
for select to anon, authenticated
using (is_active or public.has_permission('products.read'));
create policy subcategories_manage_policy on public.subcategories
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy engines_public_select_policy on public.engines
for select to anon, authenticated
using (is_active or public.has_permission('products.read'));
create policy engines_manage_policy on public.engines
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy warehouses_select_policy on public.warehouses
for select to authenticated
using (public.has_permission('inventory.read'));
create policy warehouses_manage_policy on public.warehouses
for all to authenticated
using (public.has_permission('inventory.manage'))
with check (public.has_permission('inventory.manage'));

create policy warehouse_locations_select_policy on public.warehouse_locations
for select to authenticated
using (public.has_permission('inventory.read'));
create policy warehouse_locations_manage_policy on public.warehouse_locations
for all to authenticated
using (public.has_permission('inventory.manage'))
with check (public.has_permission('inventory.manage'));

create policy products_public_select_policy on public.products
for select to anon, authenticated
using ((status = 'active' and deleted_at is null) or public.has_permission('products.read'));
create policy products_insert_policy on public.products
for insert to authenticated
with check (
  public.has_permission('products.manage')
  and (created_by is null or created_by = auth.uid())
  and (updated_by is null or updated_by = auth.uid())
);
create policy products_update_policy on public.products
for update to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage') and (updated_by is null or updated_by = auth.uid()));
create policy products_delete_policy on public.products
for delete to authenticated
using (public.has_permission('products.manage'));

create policy product_images_public_select_policy on public.product_images
for select to anon, authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and ((product.status = 'active' and product.deleted_at is null) or public.has_permission('products.read'))
  )
);
create policy product_images_manage_policy on public.product_images
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy compatibilities_public_select_policy on public.product_engine_compatibilities
for select to anon, authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and ((product.status = 'active' and product.deleted_at is null) or public.has_permission('products.read'))
  )
);
create policy compatibilities_manage_policy on public.product_engine_compatibilities
for all to authenticated
using (public.has_permission('products.manage'))
with check (public.has_permission('products.manage'));

create policy suppliers_select_policy on public.suppliers
for select to authenticated
using (public.has_permission('suppliers.read'));
create policy suppliers_manage_policy on public.suppliers
for all to authenticated
using (public.has_permission('suppliers.manage'))
with check (public.has_permission('suppliers.manage'));

create policy product_suppliers_select_policy on public.product_suppliers
for select to authenticated
using (public.has_permission('suppliers.read') or public.has_permission('products.read'));
create policy product_suppliers_manage_policy on public.product_suppliers
for all to authenticated
using (public.has_permission('suppliers.manage'))
with check (public.has_permission('suppliers.manage'));

create policy inventory_balances_public_select_policy on public.inventory_balances
for select to anon, authenticated
using (
  exists (
    select 1 from public.products product
    where product.id = product_id
      and ((product.status = 'active' and product.deleted_at is null) or public.has_permission('inventory.read'))
  )
);

create policy inventory_movements_select_policy on public.inventory_movements
for select to authenticated
using (public.has_permission('inventory.read'));
create policy inventory_movements_insert_policy on public.inventory_movements
for insert to authenticated
with check (public.has_permission('inventory.manage') and user_id = auth.uid());

create policy clients_select_policy on public.clients
for select to authenticated
using (public.has_permission('clients.read'));
create policy clients_manage_policy on public.clients
for all to authenticated
using (public.has_permission('clients.manage'))
with check (public.has_permission('clients.manage'));

create policy inquiries_select_policy on public.inquiries
for select to authenticated
using (public.has_permission('inquiries.read'));
create policy inquiries_manage_policy on public.inquiries
for all to authenticated
using (public.has_permission('inquiries.manage'))
with check (public.has_permission('inquiries.manage'));

create policy quotations_select_policy on public.quotations
for select to authenticated
using (public.has_permission('quotations.read'));
create policy quotations_manage_policy on public.quotations
for all to authenticated
using (public.has_permission('quotations.manage'))
with check (
  public.has_permission('quotations.manage')
  and (created_by = auth.uid() or public.has_permission('quotations.manage_all'))
);

create policy quotation_items_select_policy on public.quotation_items
for select to authenticated
using (public.has_permission('quotations.read'));
create policy quotation_items_manage_policy on public.quotation_items
for all to authenticated
using (public.has_permission('quotations.manage'))
with check (
  public.has_permission('quotations.manage')
  and exists (
    select 1 from public.quotations quotation
    where quotation.id = quotation_id
      and (quotation.created_by = auth.uid() or public.has_permission('quotations.manage_all'))
  )
);

create policy audit_logs_select_policy on public.audit_logs
for select to authenticated
using (public.has_permission('audit.read'));

create policy excel_imports_select_policy on public.excel_imports
for select to authenticated
using (public.has_permission('imports.read'));
create policy excel_imports_manage_policy on public.excel_imports
for all to authenticated
using (public.has_permission('imports.manage'))
with check (public.has_permission('imports.manage') and user_id = auth.uid());

create policy excel_import_errors_select_policy on public.excel_import_errors
for select to authenticated
using (
  public.has_permission('imports.read')
  and exists (select 1 from public.excel_imports import where import.id = import_id)
);
create policy excel_import_errors_insert_policy on public.excel_import_errors
for insert to authenticated
with check (
  public.has_permission('imports.manage')
  and exists (
    select 1 from public.excel_imports import
    where import.id = import_id and import.user_id = auth.uid()
  )
);

create policy app_settings_public_select_policy on public.app_settings
for select to anon, authenticated
using (true);
create policy app_settings_manage_policy on public.app_settings
for all to authenticated
using (public.has_permission('settings.manage'))
with check (public.has_permission('settings.manage') and id = 1);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.brands, public.categories, public.subcategories, public.engines,
  public.product_images, public.product_engine_compatibilities, public.product_stock,
  public.product_catalog, public.app_settings to anon;
grant select (
  id, internal_code, oem_code, manufacturer_code, name, slug, description,
  category_id, subcategory_id, brand_id, sale_price, currency_code, tax_rate,
  min_stock, max_stock, status, weight_kg, length_cm, width_cm, height_cm,
  created_at, updated_at, deleted_at
) on public.products to anon;
grant select (product_id, quantity, reserved_quantity) on public.inventory_balances to anon;

grant select, insert, update, delete on public.roles, public.permissions, public.role_permissions,
  public.brands, public.categories, public.subcategories, public.engines, public.warehouses,
  public.warehouse_locations, public.products, public.product_images,
  public.product_engine_compatibilities, public.suppliers, public.product_suppliers,
  public.clients, public.inquiries, public.quotations, public.quotation_items,
  public.excel_imports, public.excel_import_errors, public.app_settings to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.inventory_balances, public.audit_logs to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select on public.product_stock, public.product_catalog to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.sync_auth_user_profile() from public;
revoke execute on function public.apply_inventory_movement() from public;
revoke execute on function public.prevent_immutable_record_change() from public;
revoke execute on function public.recalculate_quotation_totals() from public;
revoke execute on function public.write_audit_log() from public;
revoke execute on function public.prevent_system_role_change() from public;
revoke execute on function public.current_request_ip() from public;
revoke execute on function public.current_request_user_agent() from public;
revoke execute on function public.current_request_id() from public;

revoke execute on function public.is_active_user() from public;
revoke execute on function public.current_role_id() from public;
revoke execute on function public.has_permission(text) from public;
revoke execute on function public.touch_last_access() from public;
revoke execute on function public.submit_inquiry(text, text, text, text, uuid, text) from public;

grant execute on function public.is_active_user() to anon, authenticated;
grant execute on function public.current_role_id() to anon, authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.touch_last_access() to authenticated;
grant execute on function public.submit_inquiry(text, text, text, text, uuid, text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_storage_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy product_images_storage_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.has_permission('products.manage')
  and (storage.foldername(name))[1] = 'products'
);

create policy product_images_storage_update
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.has_permission('products.manage'))
with check (
  bucket_id = 'product-images'
  and public.has_permission('products.manage')
  and (storage.foldername(name))[1] = 'products'
);

create policy product_images_storage_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.has_permission('products.manage'));

comment on function public.submit_inquiry(text, text, text, text, uuid, text)
  is 'Punto de entrada público validado y limitado por IP para registrar consultas sin exponer INSERT directo.';
comment on function public.has_permission(text)
  is 'Comprueba permisos RBAC del usuario autenticado sin recursión de políticas RLS.';

commit;
