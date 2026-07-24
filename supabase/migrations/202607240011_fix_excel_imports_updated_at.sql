begin;

alter table public.excel_imports
  add column if not exists updated_at timestamptz not null default now();

comment on column public.excel_imports.updated_at
  is 'Fecha de la última modificación del estado o resultado de la importación.';

commit;
