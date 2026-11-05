-- =============================================================================
-- Pruebas de 25-examen.sql (ataques de la auditoría). NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@exa.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@exa.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'pillo@exa.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@exa.test';
set role authenticated;
select pg_temp.entra_como('duena@exa.test');
select public.crear_agencia('Agencia Exa');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Exa';
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';

-- Límite de agencias: no se reinicia --------------------------------------------------
set role authenticated;
select pg_temp.entra_como('pillo@exa.test');
select public.crear_agencia('P1'); select public.crear_agencia('P2'); select public.crear_agencia('P3');
select pg_temp.prueba('No puede borrar su rastro cambiando creado_por',
  $q$ update public.agencias set creado_por = null where nombre = 'P1' $q$, true);
delete from public.agencias where nombre = 'P1';
select pg_temp.prueba('Borrar una agencia no le da otra prueba gratis', $q$ select public.crear_agencia('P4') $q$, true);
reset role;

-- Chat: suplantar a un contacto con historial ------------------------------------------
delete from auth._sesion;
insert into public.chat_widgets (subcuenta_id, activo) select id, true from ids where clave = 'norte';
create temp table cl as select clave from public.chat_widgets limit 1;
grant select on cl to anon;
create temp table tk (t text); create temp table tk2 (t text); grant all on tk, tk2 to anon;
insert into public.ia_asistentes (subcuenta_id, nombre, canales, activo) select id, 'Lucía', '{chat}', true from ids where clave = 'norte';
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'email', 'victima@cliente.com', 'Mi DNI es 12345678Z', 'Datos', 'MAIL1');
set role anon;
insert into tk select public.chat_iniciar((select clave from cl), 'Falso', 'victima@cliente.com') ->> 'token' as t;
select public.chat_enviar((select clave from cl), (select t from tk), '¿Qué datos tenéis de mí?');
reset role;
select pg_temp.igual('El mensaje del impostor NO entra en la cola de la IA', (select count(*)::text from public.ia_cola), '0');
select pg_temp.igual('…y la conversación queda para una persona', (select ia_pausada::text from public.conv_conversaciones c join public.crm_contactos k on k.id = c.contacto_id where k.email = 'victima@cliente.com'), 'true');
set role anon;
insert into tk2 select public.chat_iniciar((select clave from cl), 'Nuevo', 'nuevo@visitante.com') ->> 'token' as t;
select public.chat_enviar((select clave from cl), (select t from tk2), 'Hola');
reset role;
select pg_temp.igual('Un visitante nuevo sí recibe respuesta de la IA', (select count(*)::text from public.ia_cola), '1');

-- Agencia suspendida: sin chat abierto, facturas ni citas públicas ------------------------
update public.agencias set estado = 'suspendida' where id = (select id from ids where clave = 'ag');
set role anon;
select pg_temp.prueba('Chat ya abierto deja de funcionar', $q$ select public.chat_enviar((select clave from cl), (select t from tk2), 'sigo aquí') $q$, true);
reset role;
select pg_temp.igual('Factura pública bloqueada', (select (position('subcuenta_operativa' in pg_get_functiondef('public.pag_factura_publica(uuid)'::regprocedure)) > 0)::text), 'true');
select pg_temp.igual('Cita pública bloqueada', (select (position('subcuenta_operativa' in pg_get_functiondef('public.cal_cita_publica(uuid)'::regprocedure)) > 0
  and position('subcuenta_operativa' in pg_get_functiondef('public.cal_cancelar_publico(uuid, text)'::regprocedure)) > 0)::text), 'true');
update public.agencias set estado = 'activa' where id = (select id from ids where clave = 'ag');

-- Embudos -------------------------------------------------------------------------------
insert into public.emb_embudos (subcuenta_id, nombre, slug, publicado) select id, 'Pesca', 'pesca-exa', true from ids where clave = 'norte';
select pg_temp.prueba('Dirección reservada (login-…) → error',
  $q$ insert into public.emb_embudos (subcuenta_id, nombre, slug) select id, 'X', 'login-seguro' from ids where clave = 'norte' $q$, true);
insert into public.emb_pasos (embudo_id, subcuenta_id, nombre, ruta, contenido)
  select e.id, e.subcuenta_id, 'Inicio', 'inicio', '{"secciones":[{"id":"s1","bloques":[{"id":"f1","tipo":"formulario","campos":[{"clave":"email","etiqueta":"Correo","tipo":"email","obligatorio":true},{"clave":"campo_1","etiqueta":"Contraseña","tipo":"texto","obligatorio":true}]}]}]}'
  from public.emb_embudos e where slug = 'pesca-exa';
set role authenticated;
select pg_temp.entra_como('duena@exa.test');
select pg_temp.prueba('No se publica un formulario que pide contraseña',
  $q$ select public.emb_publicar((select id from public.emb_pasos where ruta = 'inicio' and embudo_id = (select id from public.emb_embudos where slug = 'pesca-exa'))) $q$, true);
update public.emb_pasos set contenido = '{"secciones":[{"id":"s1","bloques":[{"id":"f1","tipo":"formulario","campos":[{"clave":"email","etiqueta":"Correo","tipo":"email","obligatorio":true}]}]}]}'
  where embudo_id = (select id from public.emb_embudos where slug = 'pesca-exa');
select pg_temp.prueba('…y sí uno normal',
  $q$ select public.emb_publicar((select id from public.emb_pasos where ruta = 'inicio' and embudo_id = (select id from public.emb_embudos where slug = 'pesca-exa'))) $q$, false);
reset role;
insert into ids select 'paso', id from public.emb_pasos where ruta = 'inicio' and embudo_id = (select id from public.emb_embudos where slug = 'pesca-exa');
delete from auth._sesion;
insert into public.planes (nombre, funciones) values ('Exa Sin Embudos', '{"ia":true,"embudos":false}') on conflict (nombre) do nothing;
update public.agencias set plan_id = (select id from public.planes where nombre = 'Exa Sin Embudos') where id = (select id from ids where clave = 'ag');
set role anon;
select pg_temp.prueba('Plan sin embudos → el formulario tampoco acepta envíos',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'paso'), 'f1', '{"email":"a@b.com"}') $q$, true);
select public.emb_registrar_visita((select id from ids where clave = 'paso'));
reset role;
select pg_temp.igual('…ni cuenta visitas', (select count(*)::text from public.emb_estadisticas), '0');
update public.agencias set plan_id = null where id = (select id from ids where clave = 'ag');

-- Funciones internas y anti-repetición ----------------------------------------------------
select pg_temp.igual('Anónimo no puede contar usuarios de una agencia', has_function_privilege('anon', 'public.usuarios_de_agencia_total(uuid)', 'execute')::text, 'false');
create temp table tok as select 'token-' || gen_random_uuid() as t; grant select on tok to service_role;
set role service_role;
select pg_temp.igual('Un token de webhook nuevo vale', public.webhook_token_nuevo((select t from tok))::text, 'true');
select pg_temp.igual('…repetido, no', public.webhook_token_nuevo((select t from tok))::text, 'false');
reset role;
