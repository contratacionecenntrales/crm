-- =============================================================================
-- Pruebas de 27-reputacion.sql. NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@rep.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@rep.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@rep.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@rep.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@rep.test';
set role authenticated;
select pg_temp.entra_como('otro@rep.test');
select public.crear_agencia('Ajena Rep');
select pg_temp.entra_como('duena@rep.test');
select public.crear_agencia('Agencia Rep');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Rep';
set role authenticated;
select pg_temp.entra_como('duena@rep.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Norte'), 'ana@rep.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';
insert into public.crm_contactos (subcuenta_id, nombre, email, telefono, propietario_id)
  select (select id from ids where clave = 'norte'), 'Lola', 'lola@x.com', '+34611222333', (select id from ids where clave = 'duena');
insert into public.crm_contactos (subcuenta_id, nombre, email) select (select id from ids where clave = 'norte'), 'Pepe', 'pepe@x.com';
insert into ids select 'lola', id from public.crm_contactos where nombre = 'Lola';
insert into ids select 'pepe', id from public.crm_contactos where nombre = 'Pepe';
create temp table tk (quien text, t uuid); grant all on tk to authenticated, anon;

set role authenticated;
select pg_temp.entra_como('ana@rep.test');
select pg_temp.prueba('Una usuaria no cambia los ajustes',
  $q$ insert into public.rep_ajustes (subcuenta_id, enlace_resena) select id, 'https://g.page/x' from ids where clave = 'norte' $q$, true);
select pg_temp.prueba('…pero sí puede pedir reseñas', $q$ insert into tk select 'lola', public.rep_crear((select id from ids where clave = 'norte'), (select id from ids where clave = 'lola'), 'sms') $q$, false);
select pg_temp.prueba('Otra en la misma semana → error', $q$ select public.rep_crear((select id from ids where clave = 'norte'), (select id from ids where clave = 'lola'), 'email') $q$, true);
select pg_temp.prueba('Sin teléfono no hay SMS', $q$ select public.rep_crear((select id from ids where clave = 'norte'), (select id from ids where clave = 'pepe'), 'sms') $q$, true);
select pg_temp.prueba('El equipo no puede leer los enlaces (tokens)', $q$ select token from public.rep_solicitudes $q$, true);
select pg_temp.entra_como('duena@rep.test');
select pg_temp.prueba('La dueña guarda el enlace de Google',
  $q$ insert into public.rep_ajustes (subcuenta_id, enlace_resena, umbral) select id, 'https://g.page/r/abc/review', 4 from ids where clave = 'norte' $q$, false);
select pg_temp.prueba('Enlace que no es https → error',
  $q$ update public.rep_ajustes set enlace_resena = 'javascript:alert(1)' $q$, true);
insert into tk select 'pepe', public.rep_crear((select id from ids where clave = 'norte'), (select id from ids where clave = 'pepe'), 'email');
select pg_temp.entra_como('otro@rep.test');
select pg_temp.prueba('Otra agencia no pide reseñas a mis contactos', $q$ select public.rep_crear((select id from ids where clave = 'norte'), (select id from ids where clave = 'pepe'), 'email') $q$, true);
select pg_temp.igual('…ni ve las solicitudes', (select count(*)::text from public.rep_solicitudes), '0');
reset role;

delete from auth._sesion;
set role anon;
select pg_temp.igual('La página pública muestra la empresa', public.rep_pagina((select t from tk where quien = 'lola')) ->> 'empresa', 'Norte');
select pg_temp.igual('Token inventado → nada', coalesce(public.rep_pagina(gen_random_uuid())::text, '∅'), '∅');
select pg_temp.prueba('Puntuación fuera de rango → error', $q$ select public.rep_valorar((select t from tk where quien = 'lola'), 9, '') $q$, true);
select pg_temp.igual('5 estrellas → a Google', public.rep_valorar((select t from tk where quien = 'lola'), 5, '¡Genial!') ->> 'enlace', 'https://g.page/r/abc/review');
select pg_temp.prueba('No se puede valorar dos veces', $q$ select public.rep_valorar((select t from tk where quien = 'lola'), 1, 'cambio') $q$, true);
select pg_temp.igual('2 estrellas → se queda en privado', coalesce(public.rep_valorar((select t from tk where quien = 'pepe'), 2, 'Tardaron mucho') ->> 'enlace', '∅'), '∅');
reset role;
select pg_temp.igual('Quedan guardadas', (select string_agg(puntuacion::text || ':' || estado, ',' order by puntuacion) from public.rep_solicitudes), '2:valorada,5:valorada');
select pg_temp.igual('…con evento en la ficha', (select count(*)::text from public.crm_eventos where tipo = 'resena'), '2');
select pg_temp.igual('La mala avisa a quien la pidió', (select count(*)::text from public.notificaciones where categoria = 'Reputación' and usuario_id = (select id from ids where clave = 'duena')), '1');
delete from auth._sesion;
update public.agencias set estado = 'suspendida' where id = (select id from ids where clave = 'ag');
set role anon;
select pg_temp.igual('Agencia suspendida → la página no se sirve', coalesce(public.rep_pagina((select t from tk where quien = 'lola'))::text, '∅'), '∅');
reset role;

-- Informes (28) ---------------------------------------------------------------------
delete from auth._sesion;
update public.agencias set estado = 'activa' where id = (select id from ids where clave = 'ag');
set role authenticated;
select pg_temp.entra_como('ana@rep.test');
select pg_temp.igual('Informe: contactos nuevos del periodo', (public.inf_resumen((select id from ids where clave = 'norte'), current_date - 30, current_date) -> 'contactos' ->> 'nuevos'), '2');
select pg_temp.igual('Informe: nota media de reseñas', (public.inf_resumen((select id from ids where clave = 'norte'), current_date - 30, current_date) -> 'resenas' ->> 'media'), '3.50');
select pg_temp.prueba('Informe de más de un año → error', $q$ select public.inf_resumen((select id from ids where clave = 'norte'), current_date - 400, current_date) $q$, true);
select pg_temp.entra_como('otro@rep.test');
select pg_temp.prueba('Otra agencia no ve el informe', $q$ select public.inf_resumen((select id from ids where clave = 'norte'), current_date - 30, current_date) $q$, true);
reset role;
