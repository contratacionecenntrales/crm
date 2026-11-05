-- =============================================================================
-- Pruebas de 24-asistentes.sql. NO se ejecuta en Supabase.
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
delete from public.planes where nombre = 'IA Sin IA';
delete from auth.users where email like '%@ia.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@ia.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@ia.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@ia.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@ia.test';

set role authenticated;
select pg_temp.entra_como('otro@ia.test');
select public.crear_agencia('Ajena IA');
select pg_temp.entra_como('duena@ia.test');
select public.crear_agencia('Agencia IA');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia IA';
set role authenticated;
select pg_temp.entra_como('duena@ia.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Norte'), 'ana@ia.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';
insert into public.crm_contactos (subcuenta_id, nombre, telefono) select id, 'Eva', '+34600111222' from ids where clave = 'norte';
insert into ids select 'eva', id from public.crm_contactos where telefono = '+34600111222';
insert into public.conv_conversaciones (subcuenta_id, contacto_id) select (select id from ids where clave = 'norte'), (select id from ids where clave = 'eva');
insert into ids select 'conv', id from public.conv_conversaciones where contacto_id = (select id from ids where clave = 'eva');

-- Asistentes: permisos y validaciones ----------------------------------------------
set role authenticated;
select pg_temp.entra_como('ana@ia.test');
select pg_temp.prueba('Ana (usuaria) no puede crear asistentes',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre) select id, 'X' from ids where clave = 'norte' $q$, true);
select pg_temp.entra_como('duena@ia.test');
select pg_temp.prueba('La dueña crea un asistente activo en chat y WhatsApp',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre, canales, activo, traspaso_palabras) select id, 'Lucía', '{whatsapp,chat,chat}', true, '{" Humano ",""}' from ids where clave = 'norte' $q$, false);
select pg_temp.igual('Canales sin repetir y ordenados', (select array_to_string(canales, ',') from public.ia_asistentes where nombre = 'Lucía'), 'chat,whatsapp');
select pg_temp.igual('Palabras de traspaso limpias', (select array_to_string(traspaso_palabras, ',') from public.ia_asistentes where nombre = 'Lucía'), 'humano');
select pg_temp.prueba('Otro asistente activo en un canal ocupado → error',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre, canales, activo) select id, 'Pepe', '{whatsapp}', true from ids where clave = 'norte' $q$, true);
select pg_temp.prueba('…pero sí en otro canal',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre, canales, activo) select id, 'Pepe', '{email}', true from ids where clave = 'norte' $q$, false);
select pg_temp.prueba('Canal inventado → error',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre, canales) select id, 'Raro', '{fax}' from ids where clave = 'norte' $q$, true);
select pg_temp.entra_como('ana@ia.test');
select pg_temp.igual('Ana ve los asistentes', (select count(*)::text from public.ia_asistentes), '2');
update public.ia_asistentes set instrucciones = 'hackeado';
select pg_temp.entra_como('otro@ia.test');
select pg_temp.igual('Otra agencia no los ve', (select count(*)::text from public.ia_asistentes), '0');
select pg_temp.prueba('Nadie puede escribir en la cola a mano',
  $q$ insert into public.ia_cola (subcuenta_id, conversacion_id, mensaje_id, asistente_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()) $q$, true);
select pg_temp.prueba('…ni tomar trabajo de la cola', $q$ select public.ia_tomar(5) $q$, true);
select pg_temp.prueba('…ni sumar uso', $q$ select public.ia_sumar_tokens((select id from ids where clave = 'norte'), 1, 1) $q$, true);
select pg_temp.igual('…ni gastar el cupo de otra subcuenta', public.ia_reservar_uso((select id from ids where clave = 'norte'))::text, 'false');
reset role;
select pg_temp.igual('La usuaria no pudo cambiar instrucciones', (select count(*)::text from public.ia_asistentes where instrucciones = 'hackeado'), '0');

-- Cola ------------------------------------------------------------------------------
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'whatsapp', 'whatsapp:+34600111222', 'Hola, ¿abrís el sábado?', '', 'SM1');
select pg_temp.igual('Un WhatsApp entrante entra en la cola de Lucía', (select a.nombre from public.ia_cola q join public.ia_asistentes a on a.id = q.asistente_id), 'Lucía');
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34600111222', 'Y por SMS', '', 'SM2');
select pg_temp.igual('Un SMS no (ningún asistente lo cubre)', (select count(*)::text from public.ia_cola), '1');
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'whatsapp', '+34600111222', 'Otra pregunta', '', 'SM3');
select pg_temp.igual('El segundo WhatsApp también entra', (select count(*)::text from public.ia_cola), '2');
set role service_role;
select pg_temp.igual('El servidor toma los dos', (select count(*)::text from public.ia_tomar(10)), '2');
select pg_temp.igual('El primero ya no se contesta (hay uno más nuevo)',
  public.ia_reservar((select q.id from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM1')), 'Llegaron más mensajes: se contesta al último.');
select pg_temp.igual('El último sí', coalesce(public.ia_reservar((select q.id from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM3')), 'OK'), 'OK');
select pg_temp.igual('Cuenta en el uso del día', (select respuestas::text from public.ia_uso where subcuenta_id = (select id from ids where clave = 'norte')), '1');
select public.ia_sumar_tokens((select id from ids where clave = 'norte'), 1200, 80);
select pg_temp.igual('Suma tokens', (select tokens_entrada || '/' || tokens_salida from public.ia_uso where subcuenta_id = (select id from ids where clave = 'norte')), '1200/80');
reset role;
-- La IA contesta: no pausa. Una persona contesta: pausa.
insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, ia)
  select (select id from ids where clave = 'norte'), (select id from ids where clave = 'conv'), 'saliente', 'whatsapp', 'Sí, de 10 a 14.', 'enviado', true;
select pg_temp.igual('Una respuesta de la IA no pausa el asistente', (select ia_pausada::text from public.conv_conversaciones where id = (select id from ids where clave = 'conv')), 'false');
set role service_role;
select pg_temp.igual('Si ya se contestó, no se contesta otra vez',
  public.ia_reservar((select q.id from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM3')), 'Ya se contestó.');
reset role;
insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
  select (select id from ids where clave = 'norte'), (select id from ids where clave = 'conv'), 'saliente', 'nota', 'nota interna', 'enviado', (select id from ids where clave = 'ana');
select pg_temp.igual('Una nota interna no pausa', (select ia_pausada::text from public.conv_conversaciones where id = (select id from ids where clave = 'conv')), 'false');
insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
  select (select id from ids where clave = 'norte'), (select id from ids where clave = 'conv'), 'saliente', 'whatsapp', 'Te atiendo yo', 'pendiente', (select id from ids where clave = 'ana');
select pg_temp.igual('Una respuesta de una persona pausa el asistente', (select ia_pausada::text from public.conv_conversaciones where id = (select id from ids where clave = 'conv')), 'true');
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'whatsapp', '+34600111222', 'Gracias', '', 'SM4');
select pg_temp.igual('Con el asistente pausado no entra nada en la cola', (select count(*)::text from public.ia_cola), '2');
set role authenticated;
select pg_temp.entra_como('ana@ia.test');
select pg_temp.prueba('El equipo puede reanudar el asistente',
  $q$ update public.conv_conversaciones set ia_pausada = false where id = (select id from ids where clave = 'conv') $q$, false);
select pg_temp.prueba('…pero no marcar mensajes como de la IA',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, ia) select (select id from ids where clave = 'norte'), (select id from ids where clave = 'conv'), 'saliente', 'nota', 'x', true $q$, true);
reset role;
select pg_temp.igual('Reanudado', (select ia_pausada::text from public.conv_conversaciones where id = (select id from ids where clave = 'conv')), 'false');

-- Límites ---------------------------------------------------------------------------
update public.ia_asistentes set max_respuestas = 1 where nombre = 'Lucía';
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'whatsapp', '+34600111222', '¿Y el domingo?', '', 'SM5');
set role service_role;
select pg_temp.igual('Máximo de respuestas por conversación',
  public.ia_reservar((select q.id from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM5')), 'El asistente ya contestó el máximo de veces en esta conversación hoy.');
reset role;
update public.ia_asistentes set max_respuestas = 30 where nombre = 'Lucía';
update public.ia_uso set respuestas = 500 where subcuenta_id = (select id from ids where clave = 'norte');
set role service_role;
select pg_temp.igual('Límite diario de la subcuenta',
  public.ia_reservar((select q.id from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM5')), 'Límite diario de respuestas con IA alcanzado (500).');
select pg_temp.igual('…también fuera de la cola', public.ia_reservar_uso((select id from ids where clave = 'norte'))::text, 'false');
reset role;
update public.ia_uso set respuestas = 3 where subcuenta_id = (select id from ids where clave = 'norte');

-- Plan y suspensión -----------------------------------------------------------------
delete from auth._sesion;
insert into public.planes (nombre, funciones) values ('IA Sin IA', '{"ia":false,"embudos":true,"whatsapp":true,"api":true,"marca_blanca":false}');
update public.agencias set plan_id = (select id from public.planes where nombre = 'IA Sin IA') where id = (select id from ids where clave = 'ag');
set role service_role;
select pg_temp.igual('Plan sin IA → no se contesta',
  public.ia_reservar((select q.id from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM5')), 'La subcuenta no tiene la IA disponible.');
reset role;
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'whatsapp', '+34600111222', 'Hola otra vez', '', 'SM6');
select pg_temp.igual('Plan sin IA → no entra en la cola', (select count(*)::text from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM6'), '0');
set role authenticated;
select pg_temp.entra_como('duena@ia.test');
select pg_temp.prueba('Plan sin IA → no se crean asistentes',
  $q$ insert into public.ia_asistentes (subcuenta_id, nombre) select id, 'Nuevo' from ids where clave = 'norte' $q$, true);
reset role;
delete from auth._sesion;
update public.agencias set plan_id = null, estado = 'suspendida' where id = (select id from ids where clave = 'ag');
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'whatsapp', '+34600111222', 'Suspendida', '', 'SM7');
select pg_temp.igual('Agencia suspendida → no entra en la cola', (select count(*)::text from public.ia_cola q join public.conv_mensajes m on m.id = q.mensaje_id where m.proveedor_id = 'SM7'), '0');
update public.agencias set estado = 'activa' where id = (select id from ids where clave = 'ag');

-- Chat web ---------------------------------------------------------------------------
select pg_temp.igual('El globo del chat etiqueta las respuestas de la IA',
  (select position('''Asistente''' in pg_get_functiondef('public.chat_mensajes(text, text, timestamptz)'::regprocedure)) > 0)::text, 'true');
