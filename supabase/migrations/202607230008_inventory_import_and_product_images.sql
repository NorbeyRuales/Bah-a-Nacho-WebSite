begin;

alter table public.excel_imports
  add column file_hash text,
  add column sheet_name text,
  add column file_size_bytes bigint;

alter table public.excel_imports
  add constraint excel_imports_file_hash_check
    check (file_hash is null or file_hash ~ '^[a-f0-9]{64}$'),
  add constraint excel_imports_sheet_name_length
    check (sheet_name is null or char_length(sheet_name) between 1 and 120),
  add constraint excel_imports_file_size_check
    check (file_size_bytes is null or file_size_bytes between 1 and 5242880);

create unique index excel_imports_completed_hash_uidx
  on public.excel_imports (file_hash)
  where file_hash is not null and status = 'completed';

create or replace function public.slugify_catalog_value(input_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(
        lower(
          regexp_replace(
            translate(
              coalesce(input_value, ''),
              'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇáàâäãåéèêëíìîïóòôöõúùûüñç',
              'AAAAAAEEEEIIIIOOOOOUUUUNCaaaaaaeeeeiiiiooooouuuunc'
            ),
            '[^a-zA-Z0-9]+',
            '-',
            'g'
          )
        ),
        '-'
      ),
      ''
    ),
    'item'
  );
$$;

create or replace function public.admin_import_inventory(
  import_file_name text,
  import_sheet_name text,
  import_file_hash text,
  import_file_size_bytes bigint,
  import_storage_path text,
  import_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_import_id uuid;
  existing_import_id uuid;
  default_location_id uuid;
  source_row jsonb;
  row_index integer := 0;
  row_number integer;
  internal_code_value text;
  product_name_value text;
  oem_code_value text;
  brand_name_value text;
  category_name_value text;
  short_description_value text;
  long_description_value text;
  product_description_value text;
  purchase_price_value numeric(14,2);
  sale_price_value numeric(14,2);
  target_stock_value numeric(14,3);
  brand_id_value uuid;
  category_id_value uuid;
  existing_brand_id uuid;
  existing_category_id uuid;
  product_id_value uuid;
  product_exists boolean;
  current_stock_value numeric(14,3);
  stock_delta_value numeric(14,3);
  created_count_value integer := 0;
  updated_count_value integer := 0;
  error_count_value integer := 0;
  error_summary_value jsonb := '[]'::jsonb;
begin
  if current_user_id is null or not public.has_permission('imports.manage') then
    raise exception 'No tienes permiso para importar inventario.' using errcode = '42501';
  end if;

  import_file_name := btrim(coalesce(import_file_name, ''));
  import_sheet_name := btrim(coalesce(import_sheet_name, ''));
  import_file_hash := lower(btrim(coalesce(import_file_hash, '')));
  import_storage_path := btrim(coalesce(import_storage_path, ''));

  if char_length(import_file_name) not between 1 and 255
     or import_file_name ~ '[\\/]'
     or lower(import_file_name) !~ '\.(xls|xlsx)$' then
    raise exception 'El nombre o la extensión del archivo no son válidos.' using errcode = '22023';
  end if;

  if char_length(import_sheet_name) not between 1 and 120 then
    raise exception 'El nombre de la hoja no es válido.' using errcode = '22023';
  end if;

  if import_file_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'La huella del archivo no es válida.' using errcode = '22023';
  end if;

  if import_file_size_bytes not between 1 and 5242880 then
    raise exception 'El archivo supera el límite de 5 MB.' using errcode = '22023';
  end if;

  if import_storage_path = ''
     or import_storage_path !~ ('^' || current_user_id::text || '/[a-f0-9]{64}\.(xls|xlsx)$') then
    raise exception 'La ruta privada del archivo no es válida.' using errcode = '22023';
  end if;

  if import_rows is null
     or jsonb_typeof(import_rows) <> 'array'
     or jsonb_array_length(import_rows) not between 1 and 2000 then
    raise exception 'La importación debe contener entre 1 y 2000 productos.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select lower(btrim(source.value ->> 'internalCode')) as normalized_code
      from jsonb_array_elements(import_rows) source(value)
      where btrim(coalesce(source.value ->> 'internalCode', '')) <> ''
      group by lower(btrim(source.value ->> 'internalCode'))
      having count(*) > 1
    ) duplicate
  ) then
    raise exception 'El archivo contiene códigos internos duplicados.' using errcode = '22023';
  end if;

  select import_record.id
  into existing_import_id
  from public.excel_imports import_record
  where import_record.file_hash = import_file_hash
    and import_record.status = 'completed'
  order by import_record.completed_at desc
  limit 1;

  if existing_import_id is not null then
    return jsonb_build_object(
      'importId', existing_import_id,
      'duplicate', true,
      'message', 'Este archivo ya fue importado y no se procesó nuevamente.'
    );
  end if;

  select location.id
  into default_location_id
  from public.warehouse_locations location
  join public.warehouses warehouse on warehouse.id = location.warehouse_id
  where warehouse.code = 'MAIN'
    and location.code = 'GENERAL'
    and warehouse.is_active
    and location.is_active
  limit 1;

  if default_location_id is null then
    raise exception 'No existe la ubicación MAIN/GENERAL requerida para la importación.' using errcode = 'P0002';
  end if;

  insert into public.excel_imports (
    file_name,
    storage_path,
    file_hash,
    sheet_name,
    file_size_bytes,
    status,
    total_rows,
    user_id,
    started_at
  )
  values (
    import_file_name,
    import_storage_path,
    import_file_hash,
    import_sheet_name,
    import_file_size_bytes,
    'processing',
    jsonb_array_length(import_rows),
    current_user_id,
    now()
  )
  returning id into current_import_id;

  for source_row in
    select value
    from jsonb_array_elements(import_rows)
  loop
    row_index := row_index + 1;

    begin
      row_number := coalesce(nullif(source_row ->> 'rowNumber', '')::integer, row_index + 2);
      internal_code_value := btrim(coalesce(source_row ->> 'internalCode', ''));
      product_name_value := btrim(coalesce(source_row ->> 'name', ''));
      oem_code_value := nullif(btrim(coalesce(source_row ->> 'oemCode', '')), '');
      brand_name_value := nullif(btrim(coalesce(source_row ->> 'brandName', '')), '');
      category_name_value := nullif(btrim(coalesce(source_row ->> 'categoryName', '')), '');
      short_description_value := nullif(btrim(coalesce(source_row ->> 'shortDescription', '')), '');
      long_description_value := nullif(btrim(coalesce(source_row ->> 'longDescription', '')), '');
      product_description_value := coalesce(long_description_value, short_description_value);
      purchase_price_value := (source_row ->> 'purchasePrice')::numeric(14,2);
      sale_price_value := (source_row ->> 'salePrice')::numeric(14,2);
      target_stock_value := (source_row ->> 'stock')::numeric(14,3);

      if char_length(internal_code_value) not between 2 and 80
         or internal_code_value !~ '^[A-Za-z0-9._/-]+$' then
        raise exception 'El código interno no es válido.' using errcode = '22023';
      end if;

      if char_length(product_name_value) not between 2 and 240 then
        raise exception 'El nombre del producto no es válido.' using errcode = '22023';
      end if;

      if (brand_name_value is not null and char_length(brand_name_value) not between 2 and 100)
         or (category_name_value is not null and char_length(category_name_value) not between 2 and 120) then
        raise exception 'La marca o categoría no es válida.' using errcode = '22023';
      end if;

      if purchase_price_value < 0
         or sale_price_value < 0
         or target_stock_value < 0 then
        raise exception 'Los precios y el stock no pueden ser negativos.' using errcode = '22023';
      end if;

      select product.id, product.brand_id, product.category_id
      into product_id_value, existing_brand_id, existing_category_id
      from public.products product
      where product.internal_code = internal_code_value
      limit 1
      for update;

      product_exists := product_id_value is not null;

      if brand_name_value is null and product_exists then
        brand_id_value := existing_brand_id;
      else
        brand_name_value := coalesce(brand_name_value, 'Sin marca');

        insert into public.brands (name, slug, is_active)
        values (
          brand_name_value,
          public.slugify_catalog_value(brand_name_value) || '-' || substr(md5(lower(brand_name_value)), 1, 6),
          true
        )
        on conflict (name) do update
        set is_active = true,
            updated_at = now()
        returning id into brand_id_value;
      end if;

      if category_name_value is null and product_exists then
        category_id_value := existing_category_id;
      else
        category_name_value := coalesce(category_name_value, 'Otros');

        insert into public.categories (name, slug, is_active)
        values (
          category_name_value,
          public.slugify_catalog_value(category_name_value) || '-' || substr(md5(lower(category_name_value)), 1, 6),
          true
        )
        on conflict (name) do update
        set is_active = true,
            updated_at = now()
        returning id into category_id_value;
      end if;

      if product_exists then
        update public.products
        set oem_code = coalesce(oem_code_value, oem_code),
            name = product_name_value,
            description = coalesce(product_description_value, description),
            category_id = category_id_value,
            brand_id = brand_id_value,
            purchase_price = purchase_price_value,
            sale_price = sale_price_value,
            currency_code = 'COP',
            status = 'active',
            updated_by = current_user_id,
            updated_at = now(),
            deleted_at = null
        where id = product_id_value;

        updated_count_value := updated_count_value + 1;
      else
        insert into public.products (
          internal_code,
          oem_code,
          name,
          slug,
          description,
          category_id,
          brand_id,
          purchase_price,
          sale_price,
          currency_code,
          status,
          created_by,
          updated_by
        )
        values (
          internal_code_value,
          oem_code_value,
          product_name_value,
          public.slugify_catalog_value(product_name_value) || '-' || substr(md5(lower(internal_code_value)), 1, 8),
          product_description_value,
          category_id_value,
          brand_id_value,
          purchase_price_value,
          sale_price_value,
          'COP',
          'active',
          current_user_id,
          current_user_id
        )
        returning id into product_id_value;

        created_count_value := created_count_value + 1;
      end if;

      select coalesce(balance.quantity, 0)
      into current_stock_value
      from public.inventory_balances balance
      where balance.product_id = product_id_value
        and balance.location_id = default_location_id;

      current_stock_value := coalesce(current_stock_value, 0);
      stock_delta_value := target_stock_value - current_stock_value;

      if stock_delta_value <> 0 then
        insert into public.inventory_movements (
          product_id,
          location_id,
          movement_type,
          quantity_delta,
          unit_cost,
          source_type,
          source_id,
          notes,
          user_id
        )
        values (
          product_id_value,
          default_location_id,
          'adjustment',
          stock_delta_value,
          purchase_price_value,
          'excel_import',
          current_import_id,
          'Conciliación de stock desde ' || import_file_name || ', fila ' || row_number,
          current_user_id
        );
      end if;
    exception
      when others then
        error_count_value := error_count_value + 1;

        insert into public.excel_import_errors (
          import_id,
          row_number,
          product_code,
          error_code,
          error_message,
          raw_data
        )
        values (
          current_import_id,
          row_number,
          nullif(internal_code_value, ''),
          sqlstate,
          left(sqlerrm, 2000),
          source_row
        );
    end;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'rowNumber', import_error.row_number,
        'productCode', import_error.product_code,
        'fieldName', import_error.field_name,
        'errorCode', import_error.error_code,
        'message', import_error.error_message
      )
      order by import_error.row_number
    ),
    '[]'::jsonb
  )
  into error_summary_value
  from (
    select *
    from public.excel_import_errors
    where import_id = current_import_id
    order by row_number
    limit 25
  ) import_error;

  update public.excel_imports
  set status = 'completed',
      created_count = created_count_value,
      updated_count = updated_count_value,
      error_count = error_count_value,
      error_summary = error_summary_value,
      completed_at = now()
  where id = current_import_id;

  return jsonb_build_object(
    'importId', current_import_id,
    'duplicate', false,
    'totalRows', jsonb_array_length(import_rows),
    'createdCount', created_count_value,
    'updatedCount', updated_count_value,
    'errorCount', error_count_value,
    'errors', error_summary_value
  );
end;
$$;

create or replace function public.set_product_primary_image(target_image_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_product_id uuid;
begin
  if auth.uid() is null or not public.has_permission('products.manage') then
    raise exception 'No tienes permiso para administrar imágenes.' using errcode = '42501';
  end if;

  select image.product_id
  into target_product_id
  from public.product_images image
  where image.id = target_image_id;

  if target_product_id is null then
    raise exception 'La imagen indicada no existe.' using errcode = 'P0002';
  end if;

  update public.product_images
  set is_primary = false,
      updated_at = now()
  where product_id = target_product_id
    and is_primary;

  update public.product_images
  set is_primary = true,
      updated_at = now()
  where id = target_image_id;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-imports',
  'inventory-imports',
  false,
  5242880,
  array[
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy inventory_imports_storage_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'inventory-imports'
  and public.has_permission('imports.read')
);

create policy inventory_imports_storage_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'inventory-imports'
  and public.has_permission('imports.manage')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy inventory_imports_storage_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'inventory-imports'
  and public.has_permission('imports.manage')
);

revoke execute on function public.slugify_catalog_value(text) from public;
revoke execute on function public.admin_import_inventory(text, text, text, bigint, text, jsonb) from public;
revoke execute on function public.set_product_primary_image(uuid) from public;

grant execute on function public.admin_import_inventory(text, text, text, bigint, text, jsonb) to authenticated;
grant execute on function public.set_product_primary_image(uuid) to authenticated;

comment on function public.admin_import_inventory(text, text, text, bigint, text, jsonb)
  is 'Importa productos validados, concilia stock mediante movimientos y registra errores por fila.';
comment on function public.set_product_primary_image(uuid)
  is 'Cambia la imagen principal de un producto dentro de una transacción.';

commit;
