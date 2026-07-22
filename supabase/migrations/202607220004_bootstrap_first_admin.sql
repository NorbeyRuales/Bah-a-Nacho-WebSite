begin;

do $$
declare
  administrator_role_id constant uuid := '00000000-0000-0000-0000-000000000001';
  existing_profile_count integer;
  existing_administrator_count integer;
  candidate_profile_id uuid;
begin
  select
    count(*),
    count(*) filter (where role_id = administrator_role_id)
  into existing_profile_count, existing_administrator_count
  from public.profiles;

  if existing_administrator_count > 0 then
    raise notice 'Ya existe un administrador; no se realizó ninguna promoción.';
    return;
  end if;

  if existing_profile_count = 0 then
    raise notice 'No existen perfiles todavía; el primer administrador deberá asignarse después de crear el usuario.';
    return;
  end if;

  if existing_profile_count <> 1 then
    raise exception 'El bootstrap requiere exactamente un perfil y encontró %.', existing_profile_count
      using errcode = '55000';
  end if;

  select id
  into candidate_profile_id
  from public.profiles
  limit 1;

  update public.profiles
  set role_id = administrator_role_id,
      status = 'active',
      updated_at = now()
  where id = candidate_profile_id;

  raise notice 'El primer perfil fue promovido al rol Administrador.';
end;
$$;

commit;
