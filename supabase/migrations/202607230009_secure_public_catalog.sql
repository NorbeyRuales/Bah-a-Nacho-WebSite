begin;

create or replace function public.get_public_catalog()
returns table (
  product_id uuid,
  reference_code text,
  product_name text,
  product_slug text,
  product_description text,
  category_name text,
  subcategory_name text,
  brand_name text,
  sale_price numeric,
  currency_code text,
  availability text,
  image_urls jsonb,
  compatibility_labels jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    product.id as product_id,
    coalesce(product.oem_code::text, product.manufacturer_code::text, '') as reference_code,
    product.name as product_name,
    product.slug as product_slug,
    coalesce(product.description, '') as product_description,
    category.name::text as category_name,
    subcategory.name::text as subcategory_name,
    brand.name::text as brand_name,
    product.sale_price,
    product.currency_code::text,
    case
      when coalesce(balance.available_stock, 0) <= 0 then 'out_of_stock'
      when product.min_stock > 0
        and coalesce(balance.available_stock, 0) <= product.min_stock then 'low_stock'
      else 'available'
    end as availability,
    coalesce(images.urls, '[]'::jsonb) as image_urls,
    coalesce(compatibilities.labels, '[]'::jsonb) as compatibility_labels
  from public.products product
  join public.brands brand on brand.id = product.brand_id
  join public.categories category on category.id = product.category_id
  left join public.subcategories subcategory on subcategory.id = product.subcategory_id
  left join lateral (
    select
      coalesce(sum(inventory.quantity - inventory.reserved_quantity), 0)::numeric(14,3)
        as available_stock
    from public.inventory_balances inventory
    where inventory.product_id = product.id
  ) balance on true
  left join lateral (
    select jsonb_agg(image_row.url order by image_row.is_primary desc, image_row.sort_order, image_row.created_at) as urls
    from (
      select image.url, image.is_primary, image.sort_order, image.created_at
      from public.product_images image
      where image.product_id = product.id
      order by image.is_primary desc, image.sort_order, image.created_at
      limit 12
    ) image_row
  ) images on true
  left join lateral (
    select jsonb_agg(compatibility.label order by compatibility.label) as labels
    from (
      select distinct concat_ws(
        ' ',
        engine_brand.name::text,
        nullif(btrim(engine.model), ''),
        to_char(engine.horsepower, 'FM999999990.##') || ' HP',
        case when engine.model_year is not null then engine.model_year::text end
      ) as label
      from public.product_engine_compatibilities product_compatibility
      join public.engines engine on engine.id = product_compatibility.engine_id
      join public.brands engine_brand on engine_brand.id = engine.brand_id
      where product_compatibility.product_id = product.id
        and engine.is_active
    ) compatibility
  ) compatibilities on true
  where product.status = 'active'
    and product.deleted_at is null
    and brand.is_active
    and category.is_active
  order by product.updated_at desc
  limit 2000;
$$;

drop policy if exists products_public_select_policy on public.products;
create policy products_staff_select_policy on public.products
for select to authenticated
using (public.has_permission('products.read'));

drop policy if exists engines_public_select_policy on public.engines;
create policy engines_staff_select_policy on public.engines
for select to authenticated
using (public.has_permission('products.read'));

drop policy if exists product_images_public_select_policy on public.product_images;
create policy product_images_staff_select_policy on public.product_images
for select to authenticated
using (public.has_permission('products.read'));

drop policy if exists compatibilities_public_select_policy on public.product_engine_compatibilities;
create policy compatibilities_staff_select_policy on public.product_engine_compatibilities
for select to authenticated
using (public.has_permission('products.read'));

drop policy if exists inventory_balances_public_select_policy on public.inventory_balances;
create policy inventory_balances_staff_select_policy on public.inventory_balances
for select to authenticated
using (public.has_permission('inventory.read'));

revoke select on public.engines, public.product_images,
  public.product_engine_compatibilities, public.product_stock,
  public.product_catalog, public.products, public.inventory_balances
from anon;

revoke select (
  id, internal_code, oem_code, manufacturer_code, name, slug, description,
  category_id, subcategory_id, brand_id, sale_price, currency_code, tax_rate,
  min_stock, max_stock, status, weight_kg, length_cm, width_cm, height_cm,
  created_at, updated_at, deleted_at
) on public.products from anon;

revoke select (product_id, quantity, reserved_quantity)
on public.inventory_balances from anon;

revoke execute on function public.get_public_catalog() from public;
grant execute on function public.get_public_catalog() to anon, authenticated;

comment on function public.get_public_catalog()
  is 'Catálogo público seguro: no expone códigos internos, costos, impuestos, ubicaciones ni cantidades exactas.';

commit;
