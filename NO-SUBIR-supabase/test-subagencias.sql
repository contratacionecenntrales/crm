-- =============================================================================
-- Pruebas de 30-subagencias.sql. NO se ejecuta en Supabase.
-- =============================================================================
\set ON_ERROR_STOP off
\pset pager off

create or replace function pg_temp.entra_como(p_email text) returns void
language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  delete from auth._sesion; if v is not null then insert into auth._sesion values (v); end if;
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
create or replace function pg_temp.igual(etiqueta text, obtenido text, esperado text)
returns void language plpgsql as $$
begin
  raise notice '%  % (obtenido: %, esperado: %)',
    case when obtenido is not distinct from esperado then '[OK]  ' else '[FALLO]' end, etiqueta, obtenido, esperado;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

delete from public.agencias;
delete from public.agencias_altas;
delete from auth.users where email like '%@sub.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data)
select gen_random_uuid(), e, 'authenticated', 'authenticated', now(), now(), '{}' from unnest(array['madre@sub.test', 'empleado@sub.test', 'hija@sub.test', 'nieta@sub.test', 'bisnieta@sub.test', 'otro@sub.test']) e;
create temp table ids (clave text primary key, id uuid);
grant select, insert on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@sub.test';
set role authenticated;
select pg_temp.entra_como('madre@sub.test');
select public.crear_agencia('Agencia Madre');
reset role;
insert into ids select 'A', id from public.agencias where nombre = 'Agencia Madre';
insert into public.agencia_miembros (agencia_id, usuario_id, rol) select (select id from ids where clave = 'A'), (select id from ids where clave = 'empleado'), 'usuario';

set role authenticated;
select pg_temp.entra_como('empleado@sub.test');
select pg_temp.prueba('Un usuario sin rol de administrador no crea subagencias',
  $q$ select public.agencia_crear_subagencia((select id from ids where clave = 'A'), 'Intento', (select id from ids where clave = 'hija')) $q$, true);
select pg_temp.entra_como('madre@sub.test');
select pg_temp.prueba('La madre crea una subagencia para otro dueño',
  $q$ insert into ids select 'B', public.agencia_crear_subagencia((select id from ids where clave = 'A'), 'Agencia Hija', (select id from ids where clave = 'hija')) $q$, false);
select pg_temp.igual('…queda colgada de la madre', (select (agencia_padre_id = (select id from ids where clave = 'A'))::text from public.agencias where id = (select id from ids where clave = 'B')), 'true');
reset role;
select pg_temp.igual('…con su dueño como propietario y la madre como soporte',
  (select string_agg(split_part(u.email, '@', 1) || ':' || m.rol, ',' order by u.email) from public.agencia_miembros m join auth.users u on u.id = m.usuario_id where m.agencia_id = (select id from ids where clave = 'B')), 'hija:propietario,madre:admin');
set role authenticated;
select pg_temp.entra_como('madre@sub.test');
select pg_temp.igual('La madre ve su subagencia en la lista', (select nombre || ' · ' || dueno_email from public.agencia_subagencias((select id from ids where clave = 'A'))), 'Agencia Hija · hija@sub.test');
select pg_temp.prueba('Crear subagencias no gasta el límite de 3 agencias propias',
  $q$ select public.agencia_crear_subagencia((select id from ids where clave = 'A'), 'H2', (select id from ids where clave = 'otro')), public.agencia_crear_subagencia((select id from ids where clave = 'A'), 'H3', (select id from ids where clave = 'otro')), public.crear_agencia('Segunda propia') $q$, false);

select pg_temp.entra_como('hija@sub.test');
select pg_temp.prueba('La hija no puede soltarse de su madre', $q$ update public.agencias set agencia_padre_id = null where id = (select id from ids where clave = 'B') $q$, true);
select pg_temp.prueba('…ni cambiarse el límite que le pone su madre', $q$ update public.agencias set limite_subcuentas_padre = 999 where id = (select id from ids where clave = 'B') $q$, true);
select pg_temp.igual('…ni ver las subagencias de su madre', (select count(*)::text from public.agencia_subagencias((select id from ids where clave = 'A'))), '0');
select pg_temp.prueba('La hija crea su propia subcuenta', $q$ insert into public.subcuentas (agencia_id, nombre) select id, 'Cliente de la hija' from ids where clave = 'B' $q$, false);
select pg_temp.prueba('La hija crea una nieta (nivel 3)',
  $q$ insert into ids select 'C', public.agencia_crear_subagencia((select id from ids where clave = 'B'), 'Agencia Nieta', (select id from ids where clave = 'nieta')) $q$, false);
select pg_temp.entra_como('nieta@sub.test');
select pg_temp.prueba('Una nieta no puede tener hijas (máximo 3 niveles)',
  $q$ select public.agencia_crear_subagencia((select id from ids where clave = 'C'), 'Bisnieta', (select id from ids where clave = 'bisnieta')) $q$, true);
reset role;
insert into ids select 'subB', id from public.subcuentas where nombre = 'Cliente de la hija';

-- Suspensión en cascada --------------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('otro@sub.test');
select pg_temp.prueba('Una agencia ajena no puede suspender a la hija',
  $q$ select public.agencia_gestionar_subagencia((select id from ids where clave = 'A'), (select id from ids where clave = 'B'), true, null) $q$, true);
select pg_temp.entra_como('madre@sub.test');
select pg_temp.prueba('La madre suspende a la hija', $q$ select public.agencia_gestionar_subagencia((select id from ids where clave = 'A'), (select id from ids where clave = 'B'), true, null) $q$, false);
reset role;
select pg_temp.igual('Hija suspendida → no operativa', public.agencia_operativa((select id from ids where clave = 'B'))::text, 'false');
select pg_temp.igual('…y su nieta tampoco', public.agencia_operativa((select id from ids where clave = 'C'))::text, 'false');
set role authenticated;
select pg_temp.entra_como('hija@sub.test');
select pg_temp.igual('…y su equipo deja de ver sus subcuentas', public.puedo_ver_subcuenta((select id from ids where clave = 'subB'))::text, 'false');
select pg_temp.entra_como('madre@sub.test');
select public.agencia_gestionar_subagencia((select id from ids where clave = 'A'), (select id from ids where clave = 'B'), false, 1);
reset role;
select pg_temp.igual('Reactivada', public.agencia_operativa((select id from ids where clave = 'B'))::text, 'true');
delete from auth._sesion;
update public.agencias set estado = 'suspendida' where id = (select id from ids where clave = 'A');
select pg_temp.igual('Si la plataforma suspende a la madre, la hija cae también', public.agencia_operativa((select id from ids where clave = 'B'))::text, 'false');
update public.agencias set estado = 'activa' where id = (select id from ids where clave = 'A');

-- Límite de subcuentas fijado por la madre ----------------------------------------------
set role authenticated;
select pg_temp.entra_como('hija@sub.test');
select pg_temp.prueba('Con límite 1 y una subcuenta ya creada, no se crea otra',
  $q$ insert into public.subcuentas (agencia_id, nombre) select id, 'Otra' from ids where clave = 'B' $q$, true);
reset role;
