begin;

create or replace function public.admin_dashboard_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  statistics jsonb;
  activity jsonb;
  distribution jsonb;
  recent_activity jsonb := '[]'::jsonb;
begin
  if not public.has_permission('dashboard.read') then
    raise exception 'No tiene permiso para consultar el dashboard.' using errcode = '42501';
  end if;

  with product_stock as (
    select
      product.id,
      product.min_stock,
      coalesce(sum(balance.quantity), 0)::numeric(14,3) as stock
    from public.products product
    left join public.inventory_balances balance on balance.product_id = product.id
    where product.deleted_at is null
      and product.status = 'active'
    group by product.id, product.min_stock
  )
  select jsonb_build_object(
    'products', (select count(*) from public.products where deleted_at is null),
    'totalStock', coalesce((select sum(stock) from product_stock), 0),
    'outOfStock', (select count(*) from product_stock where stock <= 0),
    'lowStock', (select count(*) from product_stock where stock > 0 and stock <= min_stock),
    'inquiriesToday', (
      select count(*) from public.inquiries
      where created_at >= date_trunc('day', now())
    ),
    'activeBrands', (select count(*) from public.brands where is_active)
  )
  into statistics;

  with months as (
    select generate_series(
      date_trunc('month', now()) - interval '6 months',
      date_trunc('month', now()),
      interval '1 month'
    ) as month_start
  ), monthly as (
    select
      month.month_start,
      coalesce(sum(movement.quantity_delta) filter (where movement.quantity_delta > 0), 0) as entries,
      coalesce(abs(sum(movement.quantity_delta) filter (where movement.quantity_delta < 0)), 0) as exits,
      coalesce(sum(movement.quantity_delta), 0) as net
    from months month
    left join public.inventory_movements movement
      on movement.occurred_at >= month.month_start
      and movement.occurred_at < month.month_start + interval '1 month'
    group by month.month_start
    order by month.month_start
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', to_char(month_start, 'YYYY-MM'),
        'entries', entries,
        'exits', exits,
        'net', net
      ) order by month_start
    ),
    '[]'::jsonb
  )
  into activity
  from monthly;

  with category_counts as (
    select category.name, count(product.id) as product_count
    from public.categories category
    left join public.products product
      on product.category_id = category.id
      and product.deleted_at is null
      and product.status = 'active'
    where category.is_active
    group by category.id, category.name
    having count(product.id) > 0
    order by product_count desc, category.name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('name', name, 'value', product_count)
      order by product_count desc, name
    ),
    '[]'::jsonb
  )
  into distribution
  from category_counts;

  if public.has_permission('audit.read') then
    select coalesce(
      jsonb_agg(to_jsonb(recent_row) order by recent_row.created_at desc),
      '[]'::jsonb
    )
    into recent_activity
    from (
      select
        audit.id,
        audit.action,
        audit.table_name,
        audit.record_id,
        audit.changed_fields,
        audit.created_at,
        profile.email::text as user_email
      from public.audit_logs audit
      left join public.profiles profile on profile.id = audit.user_id
      order by audit.created_at desc
      limit 6
    ) recent_row;
  end if;

  return jsonb_build_object(
    'stats', statistics,
    'inventoryActivity', activity,
    'categoryDistribution', distribution,
    'recentActivity', recent_activity,
    'generatedAt', now()
  );
end;
$$;

create or replace function public.admin_inventory_alerts(max_rows integer default 50)
returns table (
  product_id uuid,
  internal_code text,
  product_name text,
  stock numeric,
  min_stock numeric,
  alert_type text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('inventory.read') then
    raise exception 'No tiene permiso para consultar alertas de inventario.' using errcode = '42501';
  end if;

  return query
  with product_stock as (
    select
      product.id,
      product.internal_code::text as code,
      product.name,
      product.min_stock,
      product.updated_at,
      coalesce(sum(balance.quantity), 0)::numeric(14,3) as current_stock
    from public.products product
    left join public.inventory_balances balance on balance.product_id = product.id
    where product.deleted_at is null
      and product.status = 'active'
    group by product.id
  )
  select
    product_stock.id,
    product_stock.code,
    product_stock.name,
    product_stock.current_stock,
    product_stock.min_stock,
    case when product_stock.current_stock <= 0 then 'out_of_stock' else 'low_stock' end,
    product_stock.updated_at
  from product_stock
  where product_stock.current_stock <= product_stock.min_stock
  order by
    case when product_stock.current_stock <= 0 then 0 else 1 end,
    product_stock.current_stock,
    product_stock.name
  limit least(greatest(coalesce(max_rows, 50), 1), 200);
end;
$$;

revoke execute on function public.admin_dashboard_snapshot() from public;
revoke execute on function public.admin_inventory_alerts(integer) from public;
grant execute on function public.admin_dashboard_snapshot() to authenticated;
grant execute on function public.admin_inventory_alerts(integer) to authenticated;

comment on function public.admin_dashboard_snapshot()
  is 'Agrega KPIs, movimientos, distribución por categoría y actividad reciente en una sola consulta autorizada.';
comment on function public.admin_inventory_alerts(integer)
  is 'Devuelve productos agotados o por debajo del stock mínimo para usuarios autorizados.';

commit;
