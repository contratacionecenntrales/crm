-- =============================================================================
-- Pruebas del esquema. Se lanzan contra un Postgres local con el stub de auth;
-- comprueban los disparadores de blindaje y las políticas RLS.
-- =============================================================================
\set ON_ERROR_STOP off
\pset pager off

create or replace function pg_temp.entra_como(p_email text) returns void
language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  delete from auth._sesion; insert into auth._sesion values (v);
end $$;

create or replace function pg_temp.prueba(etiqueta text, sentencia text, espera_error boolean)
returns void language plpgsql as $$
declare fallo text := null;
begin
  begin execute sentencia; exception when others then fallo := SQLERRM; end;
  if espera_error then
    raise notice '%  %', case when fallo is not null then '[OK]  ' else '[FALLO]' end,
      etiqueta || case when fallo is not null then ' → ' || split_part(fallo, E'\n', 1) else ' (no dio error)' end;
  else
    raise notice '%  %', case when fallo is null then '[OK]  ' else '[FALLO]' end,
      etiqueta || case when fallo is not null then ' → ' || fallo else '' end;
  end if;
end $$;

-- --- usuarios de prueba ------------------------------------------------------
do $$
declare v uuid;
begin
  foreach v in array array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()] loop null; end loop;
end $$;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values (gen_random_uuid(), 'marta@labs24k.com', 'authenticated','authenticated', now(), now()),
       (gen_random_uuid(), 'asuncion@labs24k.com','authenticated','authenticated', now(), now()),
       (gen_random_uuid(), 'ana.admin@labs24k.com','authenticated','authenticated', now(), now())
on conflict (email) do nothing;

insert into public.perfiles (id, nombre, apellidos, email, rol, rel, permisos)
select u.id, 'Marta', 'Rodríguez', u.email, 'commercial', '0-528-147',
       public.permisos_de_rol('commercial')
from auth.users u where u.email = 'marta@labs24k.com' on conflict (id) do nothing;

insert into public.perfiles (id, nombre, apellidos, email, rol, rel, permisos)
select u.id, 'Asunción', 'Prieto', u.email, 'backoffice', '0-771-402',
       public.permisos_de_rol('backoffice')
from auth.users u where u.email = 'asuncion@labs24k.com' on conflict (id) do nothing;

insert into public.perfiles (id, nombre, apellidos, email, rol, rel, permisos)
select u.id, 'Ana', 'Segura', u.email, 'admin', '0-900-100',
       public.permisos_de_rol('admin')
from auth.users u where u.email = 'ana.admin@labs24k.com' on conflict (id) do nothing;

\echo ''
\echo '=== 1. Blindaje de la cuenta de raíz ==='
select pg_temp.entra_como('ana.admin@labs24k.com');
select pg_temp.prueba('No se puede eliminar',
  'delete from public.perfiles where raiz', true);
select pg_temp.prueba('No se puede suspender',
  'update public.perfiles set estado = ''Suspendido'' where raiz', true);
select pg_temp.prueba('No se puede dar de baja',
  'update public.perfiles set estado = ''Dado de baja'' where raiz', true);
select pg_temp.prueba('No se le cambia el correo',
  'update public.perfiles set email = ''otro@labs24k.com'' where raiz', true);
select pg_temp.prueba('No se le degrada el rol',
  'update public.perfiles set rol = ''commercial'' where raiz', true);
select pg_temp.prueba('No se le retira la marca de raíz',
  'update public.perfiles set raiz = false where raiz', true);
select pg_temp.prueba('No se puede crear una segunda raíz',
  'update public.perfiles set raiz = true where email = ''marta@labs24k.com''', true);
select pg_temp.prueba('Sí admite cambios inocuos',
  'update public.perfiles set telefono = ''600 112 244'' where raiz', false);

do $$
declare n int; total int;
begin
  select count(*) into total from public.permisos_catalogo;
  update public.perfiles set permisos = '{"presu.ver": true}'::jsonb where raiz;
  select count(*) into n from jsonb_each((select permisos from public.perfiles where raiz))
    where value::text = 'true';
  raise notice '%  Los permisos recortados se reimponen (quedan % de %)',
    case when n = total then '[OK]  ' else '[FALLO]' end, n, total;
end $$;

\echo ''
\echo '=== 2. Escalada de privilegios ==='
select pg_temp.entra_como('marta@labs24k.com');
select pg_temp.prueba('Nadie se cambia su propio rol',
  'update public.perfiles set rol = ''admin'' where id = auth.uid()', true);
select pg_temp.prueba('Nadie se cambia su propio estado',
  'update public.perfiles set estado = ''Suspendido'' where id = auth.uid()', true);
select pg_temp.prueba('Nadie se concede permisos',
  'update public.perfiles set permisos = public.permisos_de_rol(''admin'') where id = auth.uid()', true);
select pg_temp.prueba('Sí puede cambiar su propio teléfono',
  'update public.perfiles set telefono = ''600 445 000'' where id = auth.uid()', false);

\echo ''
\echo '=== 3. El sistema nunca se queda sin administrador ==='
select pg_temp.entra_como('ana.admin@labs24k.com');
-- actúa la raíz, para que no salte el disparador de auto-escalada
select pg_temp.entra_como('jalvarez@labs24k.com');
select pg_temp.prueba('No se puede suspender a todos los administradores a la vez',
  'update public.perfiles set estado = ''Suspendido'' where rol = ''admin''', true);
select pg_temp.prueba('Sí se puede suspender a un admin si queda otro',
  'update public.perfiles set estado = ''Suspendido'' where email = ''ana.admin@labs24k.com''', false);
update public.perfiles set estado = 'Activo' where email = 'ana.admin@labs24k.com';

\echo ''
\echo '=== 4. Bitácora automática ==='
do $$
declare n int; ult record;
begin
  update public.perfiles set rol = 'manager', permisos = public.permisos_de_rol('manager')
    where email = 'marta@labs24k.com';
  select count(*) into n from public.bitacora;
  select * into ult from public.bitacora order by ts desc limit 1;
  raise notice '%  Se anota sola: % apuntes · último «%» sobre % (%)',
    case when n > 0 then '[OK]  ' else '[FALLO]' end, n, ult.accion, ult.destino_nombre, ult.detalle;
end $$;

\echo ''
\echo '=== 5. La bitácora no se reescribe (RLS) ==='
-- Con RLS, la falta de política NO lanza error: sencillamente no afecta a
-- ninguna fila. El dato queda intacto, que es lo que importa.
select pg_temp.entra_como('ana.admin@labs24k.com');
do $$
declare antes int; n int;
begin
  select count(*) into antes from public.bitacora;
  set local role authenticated;
  update public.bitacora set detalle = 'manipulado';
  get diagnostics n = row_count;
  raise notice '%  UPDATE sobre la bitácora afecta a % filas',
    case when n = 0 then '[OK]  ' else '[FALLO]' end, n;
  delete from public.bitacora;
  get diagnostics n = row_count;
  raise notice '%  DELETE sobre la bitácora afecta a % filas',
    case when n = 0 then '[OK]  ' else '[FALLO]' end, n;
  reset role;
  raise notice '%  La bitácora sigue con sus % apuntes',
    case when (select count(*) from public.bitacora) = antes then '[OK]  ' else '[FALLO]' end, antes;
end $$;

\echo ''
\echo '=== 6. RLS del directorio de usuarios ==='
select pg_temp.entra_como('asuncion@labs24k.com');   -- backoffice
do $$
declare n int;
begin
  set local role authenticated;
  select count(*) into n from public.perfiles;
  reset role;
  raise notice '%  Back Office solo ve su propia ficha (ve %)',
    case when n = 1 then '[OK]  ' else '[FALLO]' end, n;
end $$;

select pg_temp.entra_como('ana.admin@labs24k.com');  -- admin
do $$
declare n int;
begin
  set local role authenticated;
  select count(*) into n from public.perfiles;
  reset role;
  raise notice '%  El administrador ve el directorio completo (ve %)',
    case when n >= 4 then '[OK]  ' else '[FALLO]' end, n;
end $$;

\echo ''
\echo '=== 7. RLS de expedientes por permiso ==='
insert into public.expedientes (empresa, sector, estado)
values ('Clínica Dental Asturias', 'Clínicas', 'Proyecto activo SaaS')
on conflict do nothing;

select pg_temp.entra_como('marta@labs24k.com');      -- manager: exp.ver y exp.estado
do $$
declare n int;
begin
  set local role authenticated;
  select count(*) into n from public.expedientes;
  raise notice '%  Dirección ve los expedientes (ve %)',
    case when n >= 1 then '[OK]  ' else '[FALLO]' end, n;
  delete from public.expedientes;
  get diagnostics n = row_count;
  reset role;
  raise notice '%  Sin permiso exp.borrar, el DELETE afecta a % filas',
    case when n = 0 then '[OK]  ' else '[FALLO]' end, n;
end $$;

-- lo retira la raíz; Marta no podría hacerlo sobre sí misma
select pg_temp.entra_como('jalvarez@labs24k.com');
update public.perfiles set permisos = permisos || '{"exp.ver": false}'::jsonb
  where email = 'marta@labs24k.com';
select pg_temp.entra_como('marta@labs24k.com');
do $$
declare n int;
begin
  set local role authenticated;
  select count(*) into n from public.expedientes;
  reset role;
  raise notice '%  Al retirar exp.ver deja de verlos (ve %)',
    case when n = 0 then '[OK]  ' else '[FALLO]' end, n;
end $$;

\echo ''
\echo '=== 8. Sin sesión no se ve nada ==='
delete from auth._sesion;
do $$
declare a int; b int; c int;
begin
  set local role authenticated;
  select count(*) into a from public.perfiles;
  select count(*) into b from public.expedientes;
  select count(*) into c from public.bitacora;
  reset role;
  raise notice '%  Perfiles: % · expedientes: % · bitácora: %',
    case when a = 0 and b = 0 and c = 0 then '[OK]  ' else '[FALLO]' end, a, b, c;
end $$;

\echo ''
\echo '=== 9. El visitante anónimo no tiene ni permiso de tabla ==='
set role anon;
select pg_temp.prueba('anon no puede leer perfiles', 'select 1 from public.perfiles', true);
select pg_temp.prueba('anon no puede leer la bitácora', 'select 1 from public.bitacora', true);
reset role;
\echo ''
