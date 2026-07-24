# Base de datos de Bahía Nacho

## Arquitectura

- Supabase Auth administra credenciales y contraseñas.
- `public.profiles` extiende cada usuario de `auth.users` con nombre, rol, estado y último acceso.
- `public.clients.profile_id` vincula, de forma opcional y uno a uno, la identidad autenticada con su ficha comercial.
- `roles`, `permissions` y `role_permissions` implementan RBAC sin guardar permisos directamente en el usuario.
- `products` contiene la información comercial; el stock no se duplica en esta tabla.
- `inventory_balances` mantiene el saldo por ubicación.
- `inventory_movements` es el libro mayor inmutable que actualiza los saldos de forma transaccional.
- `product_engine_compatibilities` resuelve la relación muchos-a-muchos entre productos y motores.
- `product_suppliers` resuelve la relación muchos-a-muchos entre productos y proveedores.
- Las fotografías se almacenan en el bucket `product-images`; PostgreSQL guarda URL, ruta, orden y bandera principal.
- `audit_logs` registra inserciones, modificaciones y eliminaciones de las entidades empresariales.

## Seguridad

Todas las tablas operativas tienen Row Level Security habilitado. Los permisos se resuelven con `public.has_permission(text)` y los datos administrativos no son accesibles con la clave pública. Los clientes solo pueden consultar las consultas y cotizaciones vinculadas a su propio `auth.uid()`.

Acceso público permitido:

- Catálogo comercial seguro mediante `get_public_catalog()`.
- Configuración pública del negocio.
- Registro de consultas únicamente mediante `submit_inquiry(...)`, que valida entradas y limita solicitudes por IP.

Nunca se debe usar una `service_role` o `secret key` en variables que comiencen con `VITE_`.

## Primer administrador

El entorno actual ya tiene su primer perfil promovido de forma segura mediante la migración de bootstrap.

En una instalación nueva:

1. Crea el usuario desde **Supabase Dashboard → Authentication → Users**.
2. El trigger `sync_auth_user_profile_trigger` creará automáticamente su perfil con el rol seguro por defecto `Cliente`.
3. Si las migraciones se ejecutaron antes de crear ese usuario, desde **SQL Editor** promueve exclusivamente el correo correspondiente:

```sql
update public.profiles
set role_id = '00000000-0000-0000-0000-000000000001'
where email = 'administrador@ejemplo.com';
```

No se insertan contraseñas manualmente en `public.profiles`.

## Alta y gestión de usuarios

1. Crea la credencial en **Supabase Dashboard → Authentication → Users**.
2. El trigger crea automáticamente `profiles` y la ficha `clients` con el rol `Cliente`.
3. Si la cuenta pertenece al personal, inicia sesión como administrador y abre **Usuarios** para asignar `Administrador`, `Empleado`, `Vendedor` o `Solo lectura`.

El formulario web de inicio de sesión es el mismo para todos. El rol decide el destino y PostgreSQL vuelve a comprobar los permisos mediante RLS; cambiar la interfaz del navegador no permite acceder a datos de otro rol.

## Imágenes de productos

Utiliza rutas con este formato dentro del bucket `product-images`:

```text
products/<product-id>/<uuid>.<extension>
```

Formatos permitidos: JPEG, PNG, WebP y AVIF. Tamaño máximo: 10 MiB.

## Migraciones

- `202607220001_core_schema.sql`: tablas, relaciones, índices, inventario transaccional y vistas.
- `202607220002_security_audit_rls.sql`: RBAC, RLS, auditoría, Storage y RPC pública.
- `202607220003_reference_data.sql`: roles, permisos, marcas, categorías, bodega y configuración inicial.
- `202607220004_bootstrap_first_admin.sql`: promoción controlada del único perfil inicial cuando todavía no existe un administrador.
- `202607220005_admin_dashboard_api.sql`: KPIs y alertas de inventario agregados en PostgreSQL para evitar consultas masivas desde el navegador.
- `202607220006_unified_user_access.sql`: rol Cliente, vínculo autenticado, permisos actuales, portal privado y administración segura de rol/estado.
- `202607220007_fix_user_access_function_types.sql`: tipado explícito de la protección del último administrador.
- `202607230008_inventory_import_and_product_images.sql`: importación idempotente, conciliación de stock, archivo privado y cambio transaccional de imagen principal.
- `202607230009_secure_public_catalog.sql`: RPC pública de catálogo y cierre del acceso directo a códigos, costos, stock exacto, motores e imágenes.
- `202607240010_retryable_inventory_imports.sql`: marca como fallidas las importaciones con errores y permite reintentar el mismo archivo después de corregir el problema.
- `202607240011_fix_excel_imports_updated_at.sql`: agrega la marca de modificación requerida por el trigger del historial de importaciones.
- `202607240012_admin_product_management.sql`: creación y edición manual segura de productos con ajuste transaccional de inventario.
- `202607240013_category_hierarchy_integrity.sql`: protección de integridad contra ciclos en la jerarquía de subcategorías.
- `202607240014_brand_data_integrity.sql`: integridad adicional de nombres, slugs y recursos de marcas.
- `202607240015_user_management_crud.sql`: CRUD administrativo de usuarios, baja lógica, restauración e índices de listado.
- `202607240016_safe_user_invite_provisioning.sql`: evita crear fichas comerciales para cuentas internas invitadas.

## Gestión completa de usuarios

El módulo **Usuarios** permite crear cuentas mediante invitación, editar nombre, correo,
rol y estado, enviar correos de restablecimiento, archivar y restaurar usuarios. La
eliminación es lógica: la identidad de Supabase Auth y las referencias históricas se
conservan para no romper movimientos, cotizaciones ni auditorías.

Las operaciones que modifican Supabase Auth se ejecutan en la Edge Function
`admin-users`. La función valida por sí misma el token de acceso y el permiso
`users.manage`; la `service_role` nunca se entrega al navegador. La función se despliega
con verificación JWT de plataforma desactivada porque admite claves públicas modernas y
realiza una verificación explícita con `auth.getUser(token)` antes de procesar cualquier
acción.

## Separación entre ERP y catálogo público

La web pública consulta exclusivamente `get_public_catalog()`. Esta función devuelve nombre, referencia, marca, categoría, descripción, precio, imágenes, compatibilidades y una etiqueta de disponibilidad.

No devuelve código interno, costo de compra, IVA, stock exacto, mínimos, ubicación, proveedor ni estado administrativo. Los roles internos siguen consultando `product_catalog` bajo permisos `products.read` e `inventory.read`; clientes y usuarios anónimos no pueden leer directamente las tablas administrativas.

## Importación del inventario

Desde **Panel de gestión → Importar Excel**, un usuario con `imports.manage` puede cargar archivos `.xls` o `.xlsx` de máximo 5 MiB y 2.000 productos. El lector revisa todas las hojas y hasta 250 filas por hoja antes de escoger la estructura con más coincidencias. Antes de escribir se valida la firma real del archivo, los encabezados, los códigos duplicados, los textos, los precios y el stock.

Mapeo del informe **Saldos de Productos**:

- `Codigo` → código interno y clave de actualización.
- `Referencia` → código OEM.
- `Nombre Producto` → nombre.
- `Cantidad` → stock objetivo; la diferencia se registra como movimiento de ajuste.
- `Ult. Val. Compra` → precio de compra.
- `PrecioMedio` → precio de venta en COP.
- `Nombre Categoria` y `Marca` → catálogos normalizados.
- `Descripcion Corta` y `DesCripcion Larga` → descripción cuando contienen datos.

El campo `Valor` no se guarda como precio porque representa el valor total del inventario. La huella SHA-256 impide procesar dos veces el mismo archivo completado sin errores; una ejecución con errores queda como fallida y puede reintentarse. El original queda en el bucket privado `inventory-imports` y cada ejecución queda registrada en `excel_imports`.

## Gestión manual de productos

Desde **Panel de gestión → Productos** se pueden crear productos y modificar referencia, código del fabricante, nombre, descripción, marca, categoría, subcategoría, precios, moneda, IVA, stock mínimo y máximo, estado, peso, dimensiones, ubicación, existencias e imágenes.

El código interno se define al crear el producto y queda protegido después, porque es la clave con la que el ERP identifica cada registro. Si el mismo código aparece más adelante en un Excel, la importación actualiza ese producto en lugar de duplicarlo.

El stock nunca se escribe directamente en `inventory_balances`. `admin_save_product(...)` calcula la diferencia y genera un movimiento `adjustment`; por eso la modificación manual conserva el kardex, el usuario responsable y la auditoría. Los campos incluidos en el informe del ERP pueden volver a ser actualizados por una importación posterior.

## Integración del panel web

El frontend utiliza únicamente:

```env
VITE_SUPABASE_URL=https://project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

También acepta temporalmente `VITE_SUPABASE_ANON_KEY` para proyectos que todavía utilizan la clave pública heredada. La sesión se conserva y renueva mediante Supabase Auth; RLS sigue validando todas las consultas del panel y del portal del cliente.

El acceso se realiza desde **Iniciar sesión** con el correo y contraseña creados en Supabase Authentication. Hay un único formulario: los clientes llegan a su portal privado y los roles internos al panel de gestión. Dashboard, inventario, catálogo público, imágenes, usuarios, auditoría, importaciones y alertas consultan datos reales.

Para revisar migraciones pendientes sin aplicarlas:

```powershell
supabase db push --db-url $env:SUPABASE_DB_URL --include-all --dry-run
```

Para aplicar migraciones nuevas:

```powershell
supabase db push --db-url $env:SUPABASE_DB_URL --include-all
```
