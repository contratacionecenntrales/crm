-- =============================================================================
-- Pruebas de 19-chat-web.sql (chat web: ataques y flujo completo). NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@chat.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@chat.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'admin@chat.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@chat.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@chat.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@chat.test';

set role authenticated;
select pg_temp.entra_como('otro@chat.test');
select public.crear_agencia('Ajena');
select pg_temp.entra_como('duena@chat.test');
select public.crear_agencia('Agencia Chat');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Chat';
insert into public.agencia_miembros (agencia_id, usuario_id, rol) select (select id from ids where clave = 'ag'), (select id from ids where clave = 'admin'), 'admin';
set role authenticated;
select pg_temp.entra_como('duena@chat.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@chat.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';

-- Ajustes: solo administradores
set role authenticated;
select pg_temp.entra_como('ana@chat.test');
select pg_temp.prueba('Un usuario (no admin) no puede crear el chat',
  $q$ insert into public.chat_widgets (subcuenta_id, activo) values ((select id from ids where clave = 'norte'), true) $q$, true);
select pg_temp.entra_como('duena@chat.test');
select pg_temp.prueba('El admin crea el chat',
  $q$ insert into public.chat_widgets (subcuenta_id, activo, dominios) values ((select id from ids where clave = 'norte'), true, '{tuweb.com}') $q$, false);
select pg_temp.prueba('No se puede elegir la clave a mano',
  $q$ update public.chat_widgets set clave = 'abc' $q$, true);
select pg_temp.prueba('Dominio mal escrito se rechaza',
  $q$ update public.chat_widgets set dominios = '{https://tuweb.com/x}' $q$, true);
reset role;
create temp table k (clave text); grant select on k to anon, authenticated;
insert into k select clave from public.chat_widgets;

-- Visitante anónimo
delete from auth._sesion;
set role anon;
select pg_temp.igual('La configuración pública se lee sin sesión',
  (select public.chat_config((select clave from k)) ->> 'titulo'), 'Chatea con nosotros');
select pg_temp.igual('Una clave inventada no da nada', (select public.chat_config('inventada')::text), null);
select pg_temp.prueba('Desde una web no autorizada no se puede iniciar',
  $q$ select public.chat_iniciar((select clave from k), 'Eva', 'eva@x.es', '', 'malo.com') $q$, true);
select pg_temp.prueba('Sin nombre no se inicia',
  $q$ select public.chat_iniciar((select clave from k), '', 'eva@x.es', '', 'tuweb.com') $q$, true);
create temp table t (quien text, token text); grant all on t to anon, authenticated;
insert into t select 'eva', public.chat_iniciar((select clave from k), 'Eva', 'eva@x.es', '600111222', 'www.tuweb.com') ->> 'token';
select pg_temp.prueba('Eva escribe', $q$ select public.chat_enviar((select clave from k), (select token from t where quien = 'eva'), 'Hola, ¿abrís el sábado?') $q$, false);
select pg_temp.prueba('Un token falso no puede escribir', $q$ select public.chat_enviar((select clave from k), repeat('a', 64), 'hola') $q$, true);
select pg_temp.prueba('El anónimo no lee tablas directamente', $q$ select * from public.conv_mensajes $q$, true);
select pg_temp.prueba('…ni los visitantes', $q$ select * from public.chat_visitantes $q$, true);
reset role;

select pg_temp.igual('Eva es un contacto nuevo con fuente «Chat web» y teléfono con prefijo',
  (select fuente || ' ' || telefono from public.crm_contactos where email = 'eva@x.es'), 'Chat web +34600111222');
select pg_temp.igual('Su mensaje entra en Conversaciones como chat',
  (select canal || '/' || direccion from public.conv_mensajes where cuerpo like 'Hola, ¿abrís%'), 'chat/entrante');
select pg_temp.igual('La conversación queda con 1 sin leer', (select no_leidos::text from public.conv_conversaciones c join public.crm_contactos k on k.id = c.contacto_id where k.email = 'eva@x.es'), '1');
select pg_temp.igual('El token no se guarda en claro', (select count(*)::text from public.chat_visitantes where token_hash = (select token from t where quien = 'eva')), '0');

-- El equipo responde desde la bandeja
set role authenticated;
select pg_temp.entra_como('ana@chat.test');
select pg_temp.prueba('Ana responde por el chat',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
      select subcuenta_id, id, 'saliente', 'chat', 'Sí, de 10 a 14', 'pendiente', auth.uid()
      from public.conv_conversaciones where contacto_id = (select id from public.crm_contactos where email = 'eva@x.es') $q$, false);
insert into public.crm_contactos (subcuenta_id, nombre, email) values ((select id from ids where clave = 'norte'), 'Sin chat', 'sinchat@x.es');
insert into public.conv_conversaciones (subcuenta_id, contacto_id) select subcuenta_id, id from public.crm_contactos where email = 'sinchat@x.es';
select pg_temp.prueba('No se puede responder por chat a quien no tiene chat abierto',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
      select subcuenta_id, id, 'saliente', 'chat', 'hola', 'pendiente', auth.uid()
      from public.conv_conversaciones where contacto_id = (select id from public.crm_contactos where email = 'sinchat@x.es') $q$, true);
reset role;

set role anon;
select pg_temp.igual('Eva ve su mensaje y la respuesta (2)',
  (select jsonb_array_length(public.chat_mensajes((select clave from k), (select token from t where quien = 'eva')))::text), '2');
-- Un impostor con el correo de Eva
insert into t select 'impostor', public.chat_iniciar((select clave from k), 'Falso', 'EVA@x.es', '+34999000111', 'tuweb.com') ->> 'token';
select pg_temp.igual('El impostor no ve la conversación anterior de Eva',
  (select jsonb_array_length(public.chat_mensajes((select clave from k), (select token from t where quien = 'impostor')))::text), '0');
reset role;
select pg_temp.igual('No se ha tocado el teléfono de Eva',
  (select telefono from public.crm_contactos where email = 'eva@x.es'), '+34600111222');
select pg_temp.igual('El equipo recibe una nota de aviso (correo sin verificar)',
  (select count(*)::text from public.conv_mensajes where canal = 'nota' and cuerpo like 'Chat web iniciado por «Falso»%'), '1');
select pg_temp.igual('La respuesta quedó como leída al verla Eva',
  (select estado from public.conv_mensajes where cuerpo = 'Sí, de 10 a 14'), 'leido');

-- Límites
set role anon;
do $$ begin for i in 1..19 loop perform public.chat_enviar((select clave from k), (select token from t where quien = 'eva'), 'm' || i); end loop; end $$;
select pg_temp.prueba('El mensaje 21 en 5 minutos se frena',
  $q$ select public.chat_enviar((select clave from k), (select token from t where quien = 'eva'), 'otro') $q$, true);
select pg_temp.prueba('Un mensaje de más de 2000 caracteres se rechaza',
  $q$ select public.chat_enviar((select clave from k), (select token from t where quien = 'impostor'), repeat('x', 2001)) $q$, true);
reset role;

-- Desactivar o renovar la clave corta el acceso
set role authenticated;
select pg_temp.entra_como('ana@chat.test');
select pg_temp.prueba('Un usuario no puede renovar la clave', $q$ select public.chat_renovar_clave((select id from ids where clave = 'norte')) $q$, true);
select pg_temp.entra_como('duena@chat.test');
select public.chat_renovar_clave((select id from ids where clave = 'norte'));
reset role;
set role anon;
select pg_temp.prueba('Con la clave antigua ya no se puede escribir',
  $q$ select public.chat_enviar((select clave from k), (select token from t where quien = 'impostor'), 'hola') $q$, true);
reset role;
delete from public.agencias;
delete from auth.users where email like '%@chat.test';
