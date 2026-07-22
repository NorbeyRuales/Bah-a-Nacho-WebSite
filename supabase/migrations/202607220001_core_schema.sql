begin;

create schema if not exists extensions;
create extension if not exists citext with schema extensions;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_code_format check (code::text ~ '^[a-z][a-z0-9_]{1,49}$'),
  constraint roles_name_length check (char_length(btrim(name)) between 2 and 80)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique,
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint permissions_code_format check (code::text ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  constraint permissions_module_length check (char_length(btrim(module)) between 2 and 50),
  constraint permissions_action_length check (char_length(btrim(action)) between 2 and 50)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

insert into public.roles (id, code, name, description, is_system)
values
  ('00000000-0000-0000-0000-000000000001', 'administrator', 'Administrador', 'Acceso completo al sistema.', true),
  ('00000000-0000-0000-0000-000000000002', 'employee', 'Empleado', 'Gestión operativa de catálogo e inventario.', true),
  ('00000000-0000-0000-0000-000000000003', 'seller', 'Vendedor', 'Gestión comercial de clientes, consultas y cotizaciones.', true),
  ('00000000-0000-0000-0000-000000000004', 'viewer', 'Solo lectura', 'Consulta de información sin permisos de modificación.', true)
on conflict (id) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email extensions.citext not null unique,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active',
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_status_check check (status in ('active', 'inactive')),
  constraint profiles_first_name_length check (char_length(first_name) <= 100),
  constraint profiles_last_name_length check (char_length(last_name) <= 100)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name extensions.citext not null unique,
  slug text not null unique,
  description text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_name_length check (char_length(btrim(name::text)) between 2 and 100),
  constraint brands_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name extensions.citext not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_length check (char_length(btrim(name::text)) between 2 and 120),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint categories_sort_order_check check (sort_order >= 0)
);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  parent_id uuid,
  name extensions.citext not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcategories_id_category_unique unique (id, category_id),
  constraint subcategories_parent_fk foreign key (parent_id, category_id)
    references public.subcategories(id, category_id) on delete restrict,
  constraint subcategories_no_self_parent check (parent_id is null or parent_id <> id),
  constraint subcategories_name_length check (char_length(btrim(name::text)) between 2 and 120),
  constraint subcategories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint subcategories_sort_order_check check (sort_order >= 0)
);

create unique index subcategories_root_name_uidx
  on public.subcategories (category_id, lower(name::text))
  where parent_id is null;
create unique index subcategories_child_name_uidx
  on public.subcategories (category_id, parent_id, lower(name::text))
  where parent_id is not null;
create unique index subcategories_category_slug_uidx
  on public.subcategories (category_id, slug);

create table public.engines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  model text not null,
  horsepower numeric(7,2) not null,
  displacement_cc integer,
  model_year smallint,
  engine_type text not null,
  serial_number extensions.citext,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engines_model_length check (char_length(btrim(model)) between 1 and 120),
  constraint engines_horsepower_check check (horsepower > 0 and horsepower <= 5000),
  constraint engines_displacement_check check (displacement_cc is null or displacement_cc > 0),
  constraint engines_year_check check (model_year is null or model_year between 1900 and 2200),
  constraint engines_type_check check (engine_type in ('two_stroke', 'four_stroke', 'electric', 'diesel', 'other'))
);

create unique index engines_catalog_identity_uidx
  on public.engines (brand_id, lower(model), horsepower, coalesce(model_year, 0), engine_type)
  where serial_number is null;
create unique index engines_serial_number_uidx
  on public.engines (serial_number)
  where serial_number is not null;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique,
  name text not null,
  address text,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_code_format check (code::text ~ '^[A-Za-z0-9_-]{2,30}$'),
  constraint warehouses_name_length check (char_length(btrim(name)) between 2 and 120)
);

create table public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  code extensions.citext not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_locations_identity_unique unique (warehouse_id, code),
  constraint warehouse_locations_code_format check (code::text ~ '^[A-Za-z0-9._/-]{1,50}$')
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  internal_code extensions.citext not null unique,
  oem_code extensions.citext,
  manufacturer_code extensions.citext,
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid,
  brand_id uuid not null references public.brands(id) on delete restrict,
  purchase_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  currency_code char(3) not null default 'COP',
  tax_rate numeric(5,2) not null default 19.00,
  min_stock numeric(14,3) not null default 0,
  max_stock numeric(14,3),
  status text not null default 'active',
  weight_kg numeric(12,3),
  length_cm numeric(12,2),
  width_cm numeric(12,2),
  height_cm numeric(12,2),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint products_subcategory_fk foreign key (subcategory_id, category_id)
    references public.subcategories(id, category_id) on delete restrict,
  constraint products_internal_code_length check (char_length(btrim(internal_code::text)) between 2 and 80),
  constraint products_name_length check (char_length(btrim(name)) between 2 and 240),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_purchase_price_check check (purchase_price >= 0),
  constraint products_sale_price_check check (sale_price >= 0),
  constraint products_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint products_tax_rate_check check (tax_rate between 0 and 100),
  constraint products_min_stock_check check (min_stock >= 0),
  constraint products_max_stock_check check (max_stock is null or max_stock >= min_stock),
  constraint products_status_check check (status in ('active', 'inactive', 'discontinued')),
  constraint products_weight_check check (weight_kg is null or weight_kg >= 0),
  constraint products_dimensions_check check (
    (length_cm is null or length_cm >= 0)
    and (width_cm is null or width_cm >= 0)
    and (height_cm is null or height_cm >= 0)
  )
);

create unique index products_brand_oem_uidx
  on public.products (brand_id, oem_code)
  where oem_code is not null and deleted_at is null;
create unique index products_brand_manufacturer_code_uidx
  on public.products (brand_id, manufacturer_code)
  where manufacturer_code is not null and deleted_at is null;
create index products_catalog_filter_idx
  on public.products (status, brand_id, category_id, subcategory_id)
  where deleted_at is null;
create index products_name_search_idx on public.products (lower(name));

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  storage_bucket text not null default 'product-images',
  storage_path text,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_url_length check (char_length(url) between 5 and 2048),
  constraint product_images_sort_order_check check (sort_order >= 0),
  constraint product_images_storage_path_check check (storage_path is null or storage_path !~ '(^|/)\.\.(/|$)')
);

create unique index product_images_primary_uidx
  on public.product_images (product_id)
  where is_primary;
create index product_images_order_idx on public.product_images (product_id, sort_order, created_at);

create table public.product_engine_compatibilities (
  product_id uuid not null references public.products(id) on delete cascade,
  engine_id uuid not null references public.engines(id) on delete cascade,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (product_id, engine_id)
);

create index product_engine_compatibilities_engine_idx
  on public.product_engine_compatibilities (engine_id, product_id);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name extensions.citext not null unique,
  contact_name text,
  email extensions.citext,
  phone text,
  city text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint suppliers_name_length check (char_length(btrim(name::text)) between 2 and 180),
  constraint suppliers_email_length check (email is null or char_length(email::text) <= 254),
  constraint suppliers_status_check check (status in ('active', 'inactive'))
);

create table public.product_suppliers (
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_product_code extensions.citext,
  last_purchase_price numeric(14,2),
  currency_code char(3) not null default 'COP',
  lead_time_days integer,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, supplier_id),
  constraint product_suppliers_price_check check (last_purchase_price is null or last_purchase_price >= 0),
  constraint product_suppliers_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint product_suppliers_lead_time_check check (lead_time_days is null or lead_time_days >= 0)
);

create unique index product_suppliers_primary_uidx
  on public.product_suppliers (product_id)
  where is_primary;

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  quantity numeric(14,3) not null default 0,
  reserved_quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventory_balances_identity_unique unique (product_id, location_id),
  constraint inventory_balances_quantity_check check (quantity >= 0),
  constraint inventory_balances_reserved_check check (reserved_quantity >= 0 and reserved_quantity <= quantity)
);

create index inventory_balances_location_idx on public.inventory_balances (location_id, product_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  location_id uuid not null references public.warehouse_locations(id) on delete restrict,
  movement_type text not null,
  quantity_delta numeric(14,3) not null,
  quantity_before numeric(14,3) not null default 0,
  quantity_after numeric(14,3) not null default 0,
  unit_cost numeric(14,2),
  source_type text,
  source_id uuid,
  notes text,
  user_id uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (
    movement_type in ('entry', 'exit', 'adjustment', 'purchase', 'sale', 'correction')
  ),
  constraint inventory_movements_delta_check check (quantity_delta <> 0),
  constraint inventory_movements_before_check check (quantity_before >= 0),
  constraint inventory_movements_after_check check (quantity_after >= 0),
  constraint inventory_movements_unit_cost_check check (unit_cost is null or unit_cost >= 0)
);

create index inventory_movements_product_date_idx
  on public.inventory_movements (product_id, occurred_at desc);
create index inventory_movements_location_date_idx
  on public.inventory_movements (location_id, occurred_at desc);
create index inventory_movements_user_date_idx
  on public.inventory_movements (user_id, occurred_at desc);
create index inventory_movements_source_idx
  on public.inventory_movements (source_type, source_id)
  where source_id is not null;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  phone text,
  email extensions.citext,
  company text,
  notes text,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clients_first_name_length check (char_length(btrim(first_name)) between 2 and 120),
  constraint clients_contact_check check (phone is not null or email is not null),
  constraint clients_status_check check (status in ('active', 'inactive'))
);

create index clients_email_idx on public.clients (lower(email::text)) where email is not null;
create index clients_phone_idx on public.clients (phone) where phone is not null;
create index clients_company_idx on public.clients (lower(company)) where company is not null;

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  email extensions.citext,
  phone text,
  message text not null,
  source text not null default 'web',
  status text not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inquiries_name_length check (char_length(btrim(name)) between 2 and 160),
  constraint inquiries_contact_check check (phone is not null or email is not null),
  constraint inquiries_message_length check (char_length(btrim(message)) between 5 and 5000),
  constraint inquiries_source_check check (source in ('web', 'whatsapp', 'phone', 'email', 'in_person', 'other')),
  constraint inquiries_status_check check (status in ('new', 'in_progress', 'answered', 'closed', 'spam'))
);

create index inquiries_status_date_idx on public.inquiries (status, created_at desc);
create index inquiries_product_date_idx on public.inquiries (product_id, created_at desc) where product_id is not null;
create index inquiries_client_date_idx on public.inquiries (client_id, created_at desc) where client_id is not null;

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number bigint generated always as identity (start with 1000),
  client_id uuid not null references public.clients(id) on delete restrict,
  status text not null default 'draft',
  currency_code char(3) not null default 'COP',
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  issued_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_quote_number_unique unique (quote_number),
  constraint quotations_status_check check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
  constraint quotations_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint quotations_totals_check check (subtotal >= 0 and tax_total >= 0 and total >= 0),
  constraint quotations_expiration_check check (expires_at is null or issued_at is null or expires_at >= issued_at)
);

create index quotations_client_date_idx on public.quotations (client_id, created_at desc);
create index quotations_status_date_idx on public.quotations (status, created_at desc);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_code text,
  product_name text not null,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 19.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotation_items_product_name_length check (char_length(btrim(product_name)) between 2 and 240),
  constraint quotation_items_quantity_check check (quantity > 0),
  constraint quotation_items_unit_price_check check (unit_price >= 0),
  constraint quotation_items_discount_check check (discount_amount >= 0 and discount_amount <= quantity * unit_price),
  constraint quotation_items_tax_rate_check check (tax_rate between 0 and 100)
);

create index quotation_items_quotation_idx on public.quotation_items (quotation_id, created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  schema_name text not null default 'public',
  table_name text not null,
  record_id text,
  before_data jsonb,
  after_data jsonb,
  changed_fields text[],
  ip_address inet,
  user_agent text,
  request_id uuid,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_check check (action in ('insert', 'update', 'delete'))
);

create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id, created_at desc);
create index audit_logs_user_date_idx on public.audit_logs (user_id, created_at desc) where user_id is not null;
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_changed_fields_gin_idx on public.audit_logs using gin (changed_fields);

create table public.excel_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text,
  status text not null default 'pending',
  total_rows integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  error_count integer not null default 0,
  error_summary jsonb not null default '[]'::jsonb,
  user_id uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint excel_imports_file_name_length check (char_length(btrim(file_name)) between 1 and 255),
  constraint excel_imports_storage_path_check check (storage_path is null or storage_path !~ '(^|/)\.\.(/|$)'),
  constraint excel_imports_status_check check (status in ('pending', 'validating', 'processing', 'completed', 'failed', 'cancelled')),
  constraint excel_imports_counts_check check (
    total_rows >= 0 and created_count >= 0 and updated_count >= 0 and error_count >= 0
  ),
  constraint excel_imports_dates_check check (completed_at is null or started_at is null or completed_at >= started_at)
);

create index excel_imports_user_date_idx on public.excel_imports (user_id, created_at desc);
create index excel_imports_status_date_idx on public.excel_imports (status, created_at desc);

create table public.excel_import_errors (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.excel_imports(id) on delete cascade,
  row_number integer,
  product_code text,
  field_name text,
  error_code text,
  error_message text not null,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  constraint excel_import_errors_row_check check (row_number is null or row_number > 0),
  constraint excel_import_errors_message_length check (char_length(error_message) between 1 and 2000)
);

create index excel_import_errors_import_row_idx on public.excel_import_errors (import_id, row_number);

create table public.app_settings (
  id smallint primary key default 1,
  logo_url text,
  whatsapp text,
  email extensions.citext,
  address text,
  facebook_url text,
  instagram_url text,
  colors jsonb not null default '{"primary":"#1565ff","secondary":"#00b4d8","background":"#060d1a"}'::jsonb,
  business_hours jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1),
  constraint app_settings_colors_object check (jsonb_typeof(colors) = 'object'),
  constraint app_settings_hours_object check (jsonb_typeof(business_hours) = 'object')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roles', 'profiles', 'brands', 'categories', 'subcategories', 'engines',
    'warehouses', 'warehouse_locations', 'products', 'product_images',
    'suppliers', 'product_suppliers', 'clients', 'inquiries', 'quotations',
    'quotation_items', 'excel_imports', 'app_settings'
  ]
  loop
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_role_id uuid := '00000000-0000-0000-0000-000000000004';
begin
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
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    viewer_role_id,
    'active'
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

create trigger sync_auth_user_profile_trigger
after insert or update of email on auth.users
for each row execute function public.sync_auth_user_profile();

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_quantity numeric(14,3);
  next_quantity numeric(14,3);
begin
  if new.movement_type in ('entry', 'purchase') and new.quantity_delta <= 0 then
    raise exception 'Los movimientos de entrada o compra requieren una cantidad positiva.' using errcode = '22023';
  end if;

  if new.movement_type in ('exit', 'sale') and new.quantity_delta >= 0 then
    raise exception 'Los movimientos de salida o venta requieren una cantidad negativa.' using errcode = '22023';
  end if;

  insert into public.inventory_balances (product_id, location_id, quantity, reserved_quantity)
  values (new.product_id, new.location_id, 0, 0)
  on conflict (product_id, location_id) do nothing;

  select quantity
    into current_quantity
  from public.inventory_balances
  where product_id = new.product_id
    and location_id = new.location_id
  for update;

  next_quantity := current_quantity + new.quantity_delta;

  if next_quantity < 0 then
    raise exception 'El movimiento produciría inventario negativo. Disponible: %, movimiento: %.', current_quantity, new.quantity_delta
      using errcode = '23514';
  end if;

  new.quantity_before := current_quantity;
  new.quantity_after := next_quantity;

  update public.inventory_balances
  set quantity = next_quantity,
      updated_at = now()
  where product_id = new.product_id
    and location_id = new.location_id;

  return new;
end;
$$;

create trigger apply_inventory_movement_trigger
before insert on public.inventory_movements
for each row execute function public.apply_inventory_movement();

create or replace function public.prevent_immutable_record_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los registros de % son inmutables; cree un movimiento de corrección.', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger inventory_movements_immutable_trigger
before update or delete on public.inventory_movements
for each row execute function public.prevent_immutable_record_change();

create trigger audit_logs_immutable_trigger
before update or delete on public.audit_logs
for each row execute function public.prevent_immutable_record_change();

create or replace function public.recalculate_quotation_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_quotation_id uuid := coalesce(new.quotation_id, old.quotation_id);
begin
  update public.quotations q
  set subtotal = totals.subtotal,
      tax_total = totals.tax_total,
      total = totals.subtotal + totals.tax_total,
      updated_at = now()
  from (
    select
      coalesce(sum((i.quantity * i.unit_price) - i.discount_amount), 0)::numeric(14,2) as subtotal,
      coalesce(sum(((i.quantity * i.unit_price) - i.discount_amount) * i.tax_rate / 100), 0)::numeric(14,2) as tax_total
    from public.quotation_items i
    where i.quotation_id = target_quotation_id
  ) totals
  where q.id = target_quotation_id;

  return coalesce(new, old);
end;
$$;

create trigger recalculate_quotation_totals_trigger
after insert or update or delete on public.quotation_items
for each row execute function public.recalculate_quotation_totals();

create or replace view public.product_stock
with (security_invoker = true)
as
select
  p.id as product_id,
  coalesce(sum(b.quantity), 0)::numeric(14,3) as stock,
  coalesce(sum(b.reserved_quantity), 0)::numeric(14,3) as reserved_stock,
  coalesce(sum(b.quantity - b.reserved_quantity), 0)::numeric(14,3) as available_stock
from public.products p
left join public.inventory_balances b on b.product_id = p.id
where p.deleted_at is null
group by p.id;

create or replace view public.product_catalog
with (security_invoker = true)
as
select
  p.id,
  p.internal_code,
  p.oem_code,
  p.manufacturer_code,
  p.name,
  p.slug,
  p.description,
  p.category_id,
  c.name as category_name,
  p.subcategory_id,
  sc.name as subcategory_name,
  p.brand_id,
  b.name as brand_name,
  p.sale_price,
  p.currency_code,
  p.tax_rate,
  ps.stock,
  ps.available_stock,
  p.min_stock,
  p.max_stock,
  p.status,
  p.weight_kg,
  p.length_cm,
  p.width_cm,
  p.height_cm,
  image.url as primary_image_url,
  p.created_at,
  p.updated_at
from public.products p
join public.brands b on b.id = p.brand_id
join public.categories c on c.id = p.category_id
left join public.subcategories sc on sc.id = p.subcategory_id
join public.product_stock ps on ps.product_id = p.id
left join lateral (
  select pi.url
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.sort_order, pi.created_at
  limit 1
) image on true
where p.deleted_at is null;

comment on table public.profiles is 'Perfil empresarial asociado uno a uno con auth.users. Las contraseñas permanecen exclusivamente en Supabase Auth.';
comment on table public.inventory_movements is 'Libro mayor inmutable de entradas, salidas, ajustes, compras, ventas y correcciones de inventario.';
comment on view public.product_stock is 'Existencias calculadas a partir de los saldos por ubicación.';

commit;
