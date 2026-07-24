begin;

create or replace function public.prevent_subcategory_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- El catálogo es pequeño; serializar cambios jerárquicos evita que dos
  -- transacciones concurrentes creen un ciclo que ninguna alcance a observar.
  perform pg_catalog.pg_advisory_xact_lock(738491027::bigint);

  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Una subcategoría no puede depender de sí misma.'
      using errcode = '23514';
  end if;

  if exists (
    with recursive ancestors as (
      select
        subcategory.id,
        subcategory.parent_id,
        array[subcategory.id] as visited
      from public.subcategories subcategory
      where subcategory.id = new.parent_id

      union all

      select
        parent.id,
        parent.parent_id,
        ancestors.visited || parent.id
      from public.subcategories parent
      join ancestors on parent.id = ancestors.parent_id
      where not parent.id = any(ancestors.visited)
    )
    select 1
    from ancestors
    where ancestors.id = new.id
  ) then
    raise exception 'La jerarquía de subcategorías no puede contener ciclos.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_subcategory_cycle_trigger on public.subcategories;
create trigger prevent_subcategory_cycle_trigger
before insert or update of parent_id, category_id on public.subcategories
for each row execute function public.prevent_subcategory_cycle();

comment on function public.prevent_subcategory_cycle()
  is 'Impide referencias circulares al organizar subcategorías en varios niveles.';

commit;
