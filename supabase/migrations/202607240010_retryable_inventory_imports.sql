begin;

drop index if exists public.excel_imports_completed_hash_uidx;

create or replace function public.normalize_excel_import_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' and new.error_count > 0 then
    new.status := 'failed';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_excel_import_status_trigger
on public.excel_imports;

create trigger normalize_excel_import_status_trigger
before insert or update of status, error_count
on public.excel_imports
for each row
execute function public.normalize_excel_import_status();

update public.excel_imports
set status = 'failed'
where status = 'completed'
  and error_count > 0;

create unique index excel_imports_completed_hash_uidx
  on public.excel_imports (file_hash)
  where file_hash is not null
    and status = 'completed'
    and error_count = 0;

revoke execute on function public.normalize_excel_import_status() from public;

comment on function public.normalize_excel_import_status()
  is 'Marca como fallida cualquier importación con errores para permitir corregirla y reintentar el mismo archivo.';

commit;
