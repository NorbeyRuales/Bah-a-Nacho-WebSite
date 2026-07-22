begin;

insert into public.permissions (code, module, action, description)
values
  ('dashboard.read', 'dashboard', 'read', 'Consultar indicadores del panel.'),
  ('users.read', 'users', 'read', 'Consultar usuarios internos.'),
  ('users.manage', 'users', 'manage', 'Activar, desactivar y asignar roles a usuarios.'),
  ('roles.read', 'roles', 'read', 'Consultar roles y permisos.'),
  ('roles.manage', 'roles', 'manage', 'Administrar roles y sus permisos.'),
  ('products.read', 'products', 'read', 'Consultar el catálogo interno completo.'),
  ('products.manage', 'products', 'manage', 'Crear y modificar productos, marcas, categorías, motores e imágenes.'),
  ('inventory.read', 'inventory', 'read', 'Consultar existencias y movimientos.'),
  ('inventory.manage', 'inventory', 'manage', 'Registrar movimientos y administrar ubicaciones.'),
  ('suppliers.read', 'suppliers', 'read', 'Consultar proveedores y relaciones de suministro.'),
  ('suppliers.manage', 'suppliers', 'manage', 'Administrar proveedores y relaciones de suministro.'),
  ('clients.read', 'clients', 'read', 'Consultar clientes.'),
  ('clients.manage', 'clients', 'manage', 'Crear y modificar clientes.'),
  ('inquiries.read', 'inquiries', 'read', 'Consultar solicitudes de contacto.'),
  ('inquiries.manage', 'inquiries', 'manage', 'Asignar, responder y cerrar solicitudes de contacto.'),
  ('quotations.read', 'quotations', 'read', 'Consultar cotizaciones.'),
  ('quotations.manage', 'quotations', 'manage', 'Crear y modificar cotizaciones propias.'),
  ('quotations.manage_all', 'quotations', 'manage_all', 'Modificar cotizaciones de cualquier usuario.'),
  ('imports.read', 'imports', 'read', 'Consultar importaciones y errores.'),
  ('imports.manage', 'imports', 'manage', 'Ejecutar importaciones de inventario.'),
  ('reports.read', 'reports', 'read', 'Consultar y exportar reportes.'),
  ('audit.read', 'audit', 'read', 'Consultar el registro de auditoría.'),
  ('settings.read', 'settings', 'read', 'Consultar configuración interna.'),
  ('settings.manage', 'settings', 'manage', 'Modificar la configuración del sistema.')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000001'::uuid, permission.id
from public.permissions permission
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000002'::uuid, permission.id
from public.permissions permission
where permission.code in (
  'dashboard.read',
  'products.read', 'products.manage',
  'inventory.read', 'inventory.manage',
  'suppliers.read', 'suppliers.manage',
  'clients.read', 'clients.manage',
  'inquiries.read', 'inquiries.manage',
  'quotations.read', 'quotations.manage', 'quotations.manage_all',
  'imports.read', 'imports.manage',
  'reports.read', 'audit.read', 'settings.read'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000003'::uuid, permission.id
from public.permissions permission
where permission.code in (
  'dashboard.read', 'products.read', 'inventory.read',
  'clients.read', 'clients.manage',
  'inquiries.read', 'inquiries.manage',
  'quotations.read', 'quotations.manage',
  'reports.read'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000004'::uuid, permission.id
from public.permissions permission
where permission.code in (
  'dashboard.read', 'products.read', 'inventory.read',
  'suppliers.read', 'clients.read', 'inquiries.read',
  'quotations.read', 'imports.read', 'reports.read', 'settings.read'
)
on conflict do nothing;

insert into public.brands (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Yamaha', 'yamaha'),
  ('20000000-0000-0000-0000-000000000002', 'Mercury', 'mercury'),
  ('20000000-0000-0000-0000-000000000003', 'Suzuki', 'suzuki'),
  ('20000000-0000-0000-0000-000000000004', 'Honda', 'honda'),
  ('20000000-0000-0000-0000-000000000005', 'Tohatsu', 'tohatsu'),
  ('20000000-0000-0000-0000-000000000006', 'Mariner', 'mariner'),
  ('20000000-0000-0000-0000-000000000007', 'Johnson', 'johnson'),
  ('20000000-0000-0000-0000-000000000008', 'Evinrude', 'evinrude')
on conflict (id) do nothing;

insert into public.categories (id, name, slug, sort_order)
values
  ('10000000-0000-0000-0000-000000000001', 'Sellos', 'sellos', 10),
  ('10000000-0000-0000-0000-000000000002', 'Bombas', 'bombas', 20),
  ('10000000-0000-0000-0000-000000000003', 'Hélices', 'helices', 30),
  ('10000000-0000-0000-0000-000000000004', 'Empaques', 'empaques', 40),
  ('10000000-0000-0000-0000-000000000005', 'Carburadores', 'carburadores', 50),
  ('10000000-0000-0000-0000-000000000006', 'Filtros', 'filtros', 60),
  ('10000000-0000-0000-0000-000000000007', 'Aceites', 'aceites', 70),
  ('10000000-0000-0000-0000-000000000008', 'Tornillos', 'tornillos', 80)
on conflict (id) do nothing;

insert into public.subcategories (id, category_id, parent_id, name, slug, sort_order)
values (
  '11000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  null,
  'Bocín',
  'bocin',
  10
)
on conflict (id) do nothing;

insert into public.subcategories (id, category_id, parent_id, name, slug, sort_order)
values (
  '11000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'Laberinto',
  'laberinto',
  20
)
on conflict (id) do nothing;

insert into public.subcategories (id, category_id, parent_id, name, slug, sort_order)
values (
  '11000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000002',
  'Cuello',
  'cuello',
  30
)
on conflict (id) do nothing;

insert into public.warehouses (id, code, name, city)
values (
  '30000000-0000-0000-0000-000000000001',
  'MAIN',
  'Bodega principal',
  'Barranquilla'
)
on conflict (id) do nothing;

insert into public.warehouse_locations (id, warehouse_id, code, description)
values (
  '31000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'GENERAL',
  'Ubicación general temporal; reemplazar por pasillo, estante y nivel al organizar la bodega.'
)
on conflict (id) do nothing;

insert into public.app_settings (
  id,
  whatsapp,
  email,
  address,
  colors,
  business_hours
)
values (
  1,
  '+573001234567',
  'info@bahianacho.com',
  'Cra. 45 #120-65, Barranquilla, Colombia',
  '{"primary":"#1565ff","secondary":"#00b4d8","background":"#060d1a"}'::jsonb,
  '{"monday":"07:00-18:00","tuesday":"07:00-18:00","wednesday":"07:00-18:00","thursday":"07:00-18:00","friday":"07:00-18:00","saturday":"07:00-18:00","sunday":null}'::jsonb
)
on conflict (id) do nothing;

commit;
