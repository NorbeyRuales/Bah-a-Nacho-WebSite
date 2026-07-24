begin;

create or replace function public.admin_save_product(
  target_product_id uuid,
  product_internal_code text,
  product_oem_code text,
  product_manufacturer_code text,
  product_name text,
  product_description text,
  product_category_id uuid,
  product_subcategory_id uuid,
  product_brand_id uuid,
  product_purchase_price numeric,
  product_sale_price numeric,
  product_currency_code text,
  product_tax_rate numeric,
  product_min_stock numeric,
  product_max_stock numeric,
  product_status text,
  product_weight_kg numeric,
  product_length_cm numeric,
  product_width_cm numeric,
  product_height_cm numeric,
  inventory_location_id uuid,
  inventory_target_stock numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_product_id uuid;
  existing_internal_code text;
  internal_code_value text := btrim(coalesce(product_internal_code, ''));
  oem_code_value text := nullif(btrim(coalesce(product_oem_code, '')), '');
  manufacturer_code_value text := nullif(btrim(coalesce(product_manufacturer_code, '')), '');
  name_value text := btrim(coalesce(product_name, ''));
  description_value text := nullif(btrim(coalesce(product_description, '')), '');
  currency_code_value text := upper(btrim(coalesce(product_currency_code, '')));
  location_id_value uuid := inventory_location_id;
  current_stock_value numeric(14,3) := 0;
  reserved_stock_value numeric(14,3) := 0;
  stock_delta_value numeric(14,3);
  total_stock_value numeric(14,3) := 0;
  was_created boolean := false;
begin
  if current_user_id is null or not public.has_permission('products.manage') then
    raise exception 'No tienes permiso para administrar productos.'
      using errcode = '42501';
  end if;

  if char_length(internal_code_value) not between 2 and 80
     or internal_code_value !~ '^[A-Za-z0-9._/-]+$' then
    raise exception 'El código interno debe tener entre 2 y 80 caracteres válidos.'
      using errcode = '22023';
  end if;

  if char_length(name_value) not between 2 and 240 then
    raise exception 'El nombre debe tener entre 2 y 240 caracteres.'
      using errcode = '22023';
  end if;

  if char_length(coalesce(oem_code_value, '')) > 120
     or char_length(coalesce(manufacturer_code_value, '')) > 120
     or char_length(coalesce(description_value, '')) > 5000 then
    raise exception 'La referencia, el código de fabricante o la descripción superan el límite permitido.'
      using errcode = '22023';
  end if;

  if currency_code_value !~ '^[A-Z]{3}$' then
    raise exception 'La moneda debe ser un código ISO de tres letras.'
      using errcode = '22023';
  end if;

  if product_status not in ('active', 'inactive', 'discontinued') then
    raise exception 'El estado del producto no es válido.'
      using errcode = '22023';
  end if;

  if product_purchase_price is null
     or product_sale_price is null
     or product_tax_rate is null
     or product_min_stock is null
     or product_purchase_price < 0
     or product_sale_price < 0
     or product_tax_rate not between 0 and 100
     or product_min_stock < 0
     or (product_max_stock is not null and product_max_stock < product_min_stock)
     or (product_weight_kg is not null and product_weight_kg < 0)
     or (product_length_cm is not null and product_length_cm < 0)
     or (product_width_cm is not null and product_width_cm < 0)
     or (product_height_cm is not null and product_height_cm < 0) then
    raise exception 'Precios, IVA, stock o medidas contienen valores no válidos.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.brands brand
    where brand.id = product_brand_id
  ) then
    raise exception 'La marca seleccionada no existe.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.categories category
    where category.id = product_category_id
  ) then
    raise exception 'La categoría seleccionada no existe.'
      using errcode = '22023';
  end if;

  if product_subcategory_id is not null and not exists (
    select 1
    from public.subcategories subcategory
    where subcategory.id = product_subcategory_id
      and subcategory.category_id = product_category_id
  ) then
    raise exception 'La subcategoría no pertenece a la categoría seleccionada.'
      using errcode = '22023';
  end if;

  if oem_code_value is not null and exists (
    select 1
    from public.products product
    where product.brand_id = product_brand_id
      and product.oem_code = oem_code_value
      and product.deleted_at is null
      and (target_product_id is null or product.id <> target_product_id)
  ) then
    raise exception 'Ya existe otro producto de esta marca con la misma referencia.'
      using errcode = '23505';
  end if;

  if manufacturer_code_value is not null and exists (
    select 1
    from public.products product
    where product.brand_id = product_brand_id
      and product.manufacturer_code = manufacturer_code_value
      and product.deleted_at is null
      and (target_product_id is null or product.id <> target_product_id)
  ) then
    raise exception 'Ya existe otro producto de esta marca con el mismo código de fabricante.'
      using errcode = '23505';
  end if;

  if target_product_id is null then
    if exists (
      select 1
      from public.products product
      where product.internal_code = internal_code_value
    ) then
      raise exception 'Ya existe un producto con ese código interno.'
        using errcode = '23505';
    end if;

    insert into public.products (
      internal_code,
      oem_code,
      manufacturer_code,
      name,
      slug,
      description,
      category_id,
      subcategory_id,
      brand_id,
      purchase_price,
      sale_price,
      currency_code,
      tax_rate,
      min_stock,
      max_stock,
      status,
      weight_kg,
      length_cm,
      width_cm,
      height_cm,
      created_by,
      updated_by
    )
    values (
      internal_code_value,
      oem_code_value,
      manufacturer_code_value,
      name_value,
      public.slugify_catalog_value(name_value) || '-' || substr(md5(lower(internal_code_value)), 1, 8),
      description_value,
      product_category_id,
      product_subcategory_id,
      product_brand_id,
      product_purchase_price,
      product_sale_price,
      currency_code_value,
      product_tax_rate,
      product_min_stock,
      product_max_stock,
      product_status,
      product_weight_kg,
      product_length_cm,
      product_width_cm,
      product_height_cm,
      current_user_id,
      current_user_id
    )
    returning id into saved_product_id;

    was_created := true;
  else
    select product.internal_code::text
    into existing_internal_code
    from public.products product
    where product.id = target_product_id
    for update;

    if not found then
      raise exception 'El producto indicado no existe.'
        using errcode = 'P0002';
    end if;

    if lower(existing_internal_code) <> lower(internal_code_value) then
      raise exception 'El código interno de un producto existente no puede cambiarse porque identifica las importaciones del ERP.'
        using errcode = '22023';
    end if;

    update public.products
    set oem_code = oem_code_value,
        manufacturer_code = manufacturer_code_value,
        name = name_value,
        description = description_value,
        category_id = product_category_id,
        subcategory_id = product_subcategory_id,
        brand_id = product_brand_id,
        purchase_price = product_purchase_price,
        sale_price = product_sale_price,
        currency_code = currency_code_value,
        tax_rate = product_tax_rate,
        min_stock = product_min_stock,
        max_stock = product_max_stock,
        status = product_status,
        weight_kg = product_weight_kg,
        length_cm = product_length_cm,
        width_cm = product_width_cm,
        height_cm = product_height_cm,
        updated_by = current_user_id,
        updated_at = now()
    where id = target_product_id;

    saved_product_id := target_product_id;
  end if;

  if inventory_target_stock is not null then
    if not public.has_permission('inventory.manage') then
      raise exception 'No tienes permiso para ajustar el inventario.'
        using errcode = '42501';
    end if;

    if inventory_target_stock < 0 then
      raise exception 'El stock objetivo no puede ser negativo.'
        using errcode = '22023';
    end if;

    if location_id_value is null then
      select location.id
      into location_id_value
      from public.warehouse_locations location
      join public.warehouses warehouse on warehouse.id = location.warehouse_id
      where warehouse.code = 'MAIN'
        and location.code = 'GENERAL'
        and warehouse.is_active
        and location.is_active
      limit 1;
    end if;

    if location_id_value is null or not exists (
      select 1
      from public.warehouse_locations location
      join public.warehouses warehouse on warehouse.id = location.warehouse_id
      where location.id = location_id_value
        and location.is_active
        and warehouse.is_active
    ) then
      raise exception 'La ubicación de inventario no existe o está inactiva.'
        using errcode = '22023';
    end if;

    select balance.quantity, balance.reserved_quantity
    into current_stock_value, reserved_stock_value
    from public.inventory_balances balance
    where balance.product_id = saved_product_id
      and balance.location_id = location_id_value
    for update;

    current_stock_value := coalesce(current_stock_value, 0);
    reserved_stock_value := coalesce(reserved_stock_value, 0);

    if inventory_target_stock < reserved_stock_value then
      raise exception 'El stock objetivo no puede ser menor que el stock reservado (%).', reserved_stock_value
        using errcode = '23514';
    end if;

    stock_delta_value := inventory_target_stock - current_stock_value;

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
        saved_product_id,
        location_id_value,
        'adjustment',
        stock_delta_value,
        product_purchase_price,
        'manual_product_edit',
        saved_product_id,
        'Ajuste manual desde el panel de gestión',
        current_user_id
      );
    end if;
  end if;

  select coalesce(sum(balance.quantity), 0)::numeric(14,3)
  into total_stock_value
  from public.inventory_balances balance
  where balance.product_id = saved_product_id;

  return jsonb_build_object(
    'productId', saved_product_id,
    'created', was_created,
    'internalCode', internal_code_value,
    'totalStock', total_stock_value,
    'locationId', location_id_value
  );
end;
$$;

revoke execute on function public.admin_save_product(
  uuid, text, text, text, text, text, uuid, uuid, uuid, numeric, numeric,
  text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric,
  uuid, numeric
) from public;

grant execute on function public.admin_save_product(
  uuid, text, text, text, text, text, uuid, uuid, uuid, numeric, numeric,
  text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric,
  uuid, numeric
) to authenticated;

comment on function public.admin_save_product(
  uuid, text, text, text, text, text, uuid, uuid, uuid, numeric, numeric,
  text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric,
  uuid, numeric
) is 'Crea o actualiza un producto y concilia el stock mediante un movimiento auditable, sin modificar la identidad usada por el Excel.';

commit;
