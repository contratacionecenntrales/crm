-- =============================================================================
-- Pruebas de 32-voz.sql. NO se ejecuta en Supabase.
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

delete from public.agencias;
delete from auth.users where email like '%@voz.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@voz.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@voz.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@voz.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
set role authenticated;
select pg_temp.entra_como('otro@voz.test');
select public.crear_agencia('Ajena Voz');
select pg_temp.entra_como('duena@voz.test');
select public.crear_agencia('Agencia Voz');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Voz';
set role authenticated;
select pg_temp.entra_como('duena@voz.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Clínica' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Clínica'), 'ana@voz.test', 'usuario');
reset role;
insert into ids select 'sub', id from public.subcuentas where nombre = 'Clínica';
update public.subcuentas set prefijo = '+34' where id = (select id from ids where clave = 'sub');

-- Asistente con canal de voz ------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('duena@voz.test');
select pg_temp.prueba('Crear un asistente activo en voz con saludo y desvío',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre, canales, activo, saludo_voz, desvio_voz) select id, 'Recepción', '{voz}', true, 'Hola, ¿qué tal?', '+34600999888' from ids where clave = 'sub' $q$, false);
select pg_temp.prueba('Desvío con formato no válido → error',
  $q$ update public.ia_asistentes set desvio_voz = '600 999' where nombre = 'Recepción' $q$, true);
select pg_temp.prueba('Segundo asistente activo en voz → error',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre, canales, activo) select id, 'Otro', '{voz,chat}', true from ids where clave = 'sub' $q$, true);
select pg_temp.prueba('Nadie puede iniciar llamadas desde el panel', $q$ select public.voz_iniciar((select id from ids where clave = 'sub'), 'CA' || repeat('a', 32), '+34600111222') $q$, true);
select pg_temp.prueba('…ni cerrarlas', $q$ select public.voz_terminar('CA' || repeat('a', 32), 'terminada', '') $q$, true);
select pg_temp.prueba('…ni escribir en las llamadas',
  $q$ insert into public.voz_llamadas (subcuenta_id, call_sid) select id, 'CA' || repeat('b', 32) from ids where clave = 'sub' $q$, true);
reset role;

-- Llamada (como el servidor) ------------------------------------------------------
set role service_role;
select pg_temp.igual('Al llamar se abre la llamada con el asistente',
  (public.voz_iniciar((select id from ids where clave = 'sub'), 'CA' || repeat('1', 32), '+34 600 111 222')->'asistente'->>'nombre'), 'Recepción');
select pg_temp.igual('Llega el desvío configurado',
  (public.voz_iniciar((select id from ids where clave = 'sub'), 'CA' || repeat('1', 32), '+34600111222')->'asistente'->>'desvio'), '+34600999888');
select pg_temp.igual('Repetir la misma llamada no la duplica', (select count(*)::text from public.voz_llamadas), '1');
select pg_temp.igual('Crea el contacto por su número', (select fuente from public.crm_contactos where telefono = '+34600111222'), 'Llamada entrante');
select pg_temp.igual('…y su conversación', (select count(*)::text from public.conv_conversaciones c join public.crm_contactos k on k.id = c.contacto_id where k.telefono = '+34600111222'), '1');
select pg_temp.igual('Llamada desde otra subcuenta con el mismo SID → nada',
  (public.voz_iniciar(gen_random_uuid(), 'CA' || repeat('1', 32), '+34600111222'))::text, null);
select pg_temp.igual('Añadir turno del asistente', public.voz_anadir((select id from public.voz_llamadas limit 1), 'asistente', 'Hola, ¿qué tal?')::text, '1');
select pg_temp.igual('Añadir turno del cliente', public.voz_anadir((select id from public.voz_llamadas limit 1), 'cliente', 'Quiero una cita el lunes')::text, '2');
select pg_temp.prueba('Turno de alguien raro → error', $q$ select public.voz_anadir((select id from public.voz_llamadas limit 1), 'sistema', 'x') $q$, true);
select public.voz_terminar('CA' || repeat('1', 32), 'desviada', 'Pidió hablar con una persona');
select pg_temp.igual('Al terminar queda desviada', (select estado from public.voz_llamadas limit 1), 'desviada');
select pg_temp.igual('La transcripción queda como comentario interno',
  (select count(*)::text from public.conv_mensajes where canal = 'nota' and cuerpo like '%Cliente: Quiero una cita el lunes%' and cuerpo like '%Recepción: Hola%'), '1');
select public.voz_terminar('CA' || repeat('1', 32), 'terminada', '');
select pg_temp.igual('Cerrar dos veces no duplica la nota', (select count(*)::text from public.conv_mensajes where canal = 'nota'), '1');
select pg_temp.igual('…ni cambia el estado', (select estado from public.voz_llamadas limit 1), 'desviada');
select pg_temp.igual('Una llamada cerrada no admite más turnos', public.voz_anadir((select id from public.voz_llamadas limit 1), 'cliente', 'hola')::text, '-1');
select pg_temp.igual('Número oculto: llamada sin contacto',
  (public.voz_iniciar((select id from ids where clave = 'sub'), 'CA' || repeat('2', 32), 'anonymous')->>'contacto'), null);
select public.voz_terminar('CA' || repeat('2', 32), 'sin_respuesta', '');
select pg_temp.igual('…y se cierra sin nota', (select count(*)::text from public.conv_mensajes where canal = 'nota'), '1');
reset role;
update public.ia_asistentes set activo = false where nombre = 'Recepción';
set role service_role;
select pg_temp.igual('Sin asistente de voz activo no se atiende',
  (public.voz_iniciar((select id from ids where clave = 'sub'), 'CA' || repeat('3', 32), '+34600111333'))::text, null);
reset role;
update public.ia_asistentes set activo = true where nombre = 'Recepción';
delete from auth._sesion;
update public.agencias set estado = 'suspendida' where id = (select id from ids where clave = 'ag');
set role service_role;
select pg_temp.igual('Agencia suspendida: no se atiende',
  (public.voz_iniciar((select id from ids where clave = 'sub'), 'CA' || repeat('4', 32), '+34600111444'))::text, null);
reset role;
update public.agencias set estado = 'activa' where id = (select id from ids where clave = 'ag');

-- Visibilidad ---------------------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('ana@voz.test');
select pg_temp.igual('Ana (del equipo) ve las llamadas', (select count(*)::text from public.voz_llamadas), '2');
select pg_temp.entra_como('otro@voz.test');
select pg_temp.igual('Otra agencia no las ve', (select count(*)::text from public.voz_llamadas), '0');
reset role;
