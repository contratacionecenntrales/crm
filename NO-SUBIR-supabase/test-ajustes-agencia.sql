-- =============================================================================
-- Pruebas de 20-ajustes-agencia.sql. NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@aj.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@aj.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'admin@aj.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@aj.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@aj.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@aj.test';

set role authenticated;
select pg_temp.entra_como('otro@aj.test');
select public.crear_agencia('Ajena');
select pg_temp.entra_como('duena@aj.test');
select public.crear_agencia('Agencia Aj');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Aj';
insert into public.agencia_miembros (agencia_id, usuario_id, rol) select (select id from ids where clave = 'ag'), (select id from ids where clave = 'admin'), 'admin';
set role authenticated;
select pg_temp.entra_como('duena@aj.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@aj.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';
insert into ids select 'ajena', id from public.agencias where nombre = 'Ajena';
set role authenticated;
select pg_temp.entra_como('duena@aj.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Sur' from ids where clave = 'ag';
reset role;
insert into ids select 'sur', id from public.subcuentas where nombre = 'Sur';

-- 1 · Enlaces de menú
set role authenticated;
select pg_temp.entra_como('ana@aj.test');
select pg_temp.prueba('Un usuario de subcuenta no puede crear enlaces',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url) values ((select id from ids where clave = 'ag'), 'X', 'https://x.com') $q$, true);
select pg_temp.entra_como('duena@aj.test');
select pg_temp.prueba('La agencia crea un enlace para todas sus subcuentas',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, en_agencia) values ((select id from ids where clave = 'ag'), 'Formación', 'https://formacion.com/{{subcuenta.id}}', false) $q$, false);
select pg_temp.prueba('…y uno solo para la subcuenta Sur',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, subcuentas) values ((select id from ids where clave = 'ag'), 'Solo Sur', 'https://sur.com', array[(select id from ids where clave = 'sur')]) $q$, false);
select pg_temp.prueba('Una URL sin https se rechaza',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url) values ((select id from ids where clave = 'ag'), 'Malo', 'javascript:alert(1)') $q$, true);
select pg_temp.prueba('No se puede apuntar a una subcuenta de otra agencia',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, subcuentas) values ((select id from ids where clave = 'ag'), 'X', 'https://x.com', array[gen_random_uuid()]) $q$, true);
select pg_temp.prueba('Sin agencia ni subcuentas no tiene sentido',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, en_agencia, en_subcuentas) values ((select id from ids where clave = 'ag'), 'X', 'https://x.com', false, false) $q$, true);
select pg_temp.igual('En la vista de agencia sale solo «Solo Sur» (el otro es solo de subcuentas)',
  (select string_agg(nombre, ',') from public.enlaces_menu((select id from ids where clave = 'ag'), null)), 'Solo Sur');
select pg_temp.entra_como('ana@aj.test');
select pg_temp.igual('Ana (en Norte) ve solo «Formación»',
  (select string_agg(nombre, ',') from public.enlaces_menu(null, (select id from ids where clave = 'norte'))), 'Formación');
select pg_temp.igual('Ana no ve los enlaces de Sur (no tiene acceso)',
  (select count(*)::text from public.enlaces_menu(null, (select id from ids where clave = 'sur'))), '0');
select pg_temp.igual('Ana no lee la tabla directamente', (select count(*)::text from public.menu_enlaces), '0');
select pg_temp.entra_como('otro@aj.test');
select pg_temp.igual('Otra agencia no ve los enlaces de esta', (select count(*)::text from public.enlaces_menu((select id from ids where clave = 'ag'), null)), '0');
reset role;

-- 2 · Claves de API
create temp table tk (quien text, token text, id uuid); grant all on tk to authenticated, anon, service_role;
set role authenticated;
select pg_temp.entra_como('ana@aj.test');
select pg_temp.prueba('Un usuario de subcuenta no puede crear claves',
  $q$ select public.api_crear_clave((select id from ids where clave = 'ag'), 'X', array['contactos.leer']) $q$, true);
select pg_temp.entra_como('duena@aj.test');
insert into tk select 'norte', r ->> 'token', (r ->> 'id')::uuid from (select public.api_crear_clave((select id from ids where clave = 'ag'), 'Zapier', array['contactos.leer', 'contactos.escribir'], array[(select id from ids where clave = 'norte')]) r) x;
select pg_temp.prueba('Un permiso inventado se rechaza',
  $q$ select public.api_crear_clave((select id from ids where clave = 'ag'), 'X', array['todo']) $q$, true);
select pg_temp.prueba('La huella no se puede leer desde la app', $q$ select huella from public.api_claves $q$, true);
select pg_temp.igual('Se ve el prefijo para reconocerla', (select (prefijo = left((select token from tk), 12))::text from public.api_claves), 'true');
reset role;
select pg_temp.igual('El token no se guarda en claro', (select count(*)::text from public.api_claves where huella = (select token from tk)), '0');

set role service_role;
select pg_temp.prueba('La clave sirve para leer contactos de Norte',
  $q$ select public.api_autenticar((select token from tk), (select id from ids where clave = 'norte'), 'contactos.leer') $q$, false);
select pg_temp.prueba('…pero no para Sur (no está en su lista)',
  $q$ select public.api_autenticar((select token from tk), (select id from ids where clave = 'sur'), 'contactos.leer') $q$, true);
select pg_temp.prueba('…ni para un permiso que no tiene',
  $q$ select public.api_autenticar((select token from tk), (select id from ids where clave = 'norte'), 'oportunidades.leer') $q$, true);
select pg_temp.prueba('Un token inventado no entra',
  $q$ select public.api_autenticar('mtk_' || repeat('0', 48), (select id from ids where clave = 'norte'), 'contactos.leer') $q$, true);
reset role;
set role anon;
select pg_temp.prueba('El anónimo no puede llamar a la validación', $q$ select public.api_autenticar('x', null, 'x') $q$, true);
reset role;

set role authenticated;
select pg_temp.entra_como('duena@aj.test');
update public.api_claves set revocada_en = now();
select pg_temp.prueba('Una clave revocada no se reactiva', $q$ update public.api_claves set revocada_en = null $q$, true);
reset role;
set role service_role;
select pg_temp.prueba('Revocada ya no sirve',
  $q$ select public.api_autenticar((select token from tk), (select id from ids where clave = 'norte'), 'contactos.leer') $q$, true);
reset role;
-- límite por minuto
set role authenticated;
select pg_temp.entra_como('duena@aj.test');
insert into tk select 'todas', r ->> 'token', (r ->> 'id')::uuid from (select public.api_crear_clave((select id from ids where clave = 'ag'), 'Todas', array['contactos.leer']) r) x;
reset role;
set role service_role;
do $$ begin for i in 1..120 loop perform public.api_autenticar((select token from tk where quien = 'todas'), (select id from ids where clave = 'sur'), 'contactos.leer'); end loop; end $$;
select pg_temp.prueba('La petición 121 del minuto se frena',
  $q$ select public.api_autenticar((select token from tk where quien = 'todas'), (select id from ids where clave = 'sur'), 'contactos.leer') $q$, true);
reset role;

-- 3 · Reclamar envío
insert into public.crm_contactos (subcuenta_id, nombre, telefono) values ((select id from ids where clave = 'norte'), 'Envío', '+34600000001');
insert into public.conv_conversaciones (subcuenta_id, contacto_id) select subcuenta_id, id from public.crm_contactos where nombre = 'Envío';
insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado)
  select c.subcuenta_id, c.id, 'saliente', 'sms', 'Reclamo', 'pendiente' from public.conv_conversaciones c join public.crm_contactos k on k.id = c.contacto_id where k.nombre = 'Envío';
set role service_role;
select pg_temp.igual('El primero que reclama el mensaje lo consigue',
  (select public.conv_reclamar_envio((select id from public.conv_mensajes where cuerpo = 'Reclamo'), (select id from ids where clave = 'norte'))::text), 'true');
select pg_temp.igual('…el segundo no (no se envía dos veces)',
  (select public.conv_reclamar_envio((select id from public.conv_mensajes where cuerpo = 'Reclamo'), (select id from ids where clave = 'norte'))::text), 'false');
select pg_temp.igual('Con otra subcuenta no se reclama',
  (select public.conv_reclamar_envio((select id from public.conv_mensajes where cuerpo = 'Reclamo'), (select id from ids where clave = 'sur'))::text), 'false');
reset role;
set role authenticated;
select pg_temp.prueba('Un usuario no puede llamarla', $q$ select public.conv_reclamar_envio(gen_random_uuid(), gen_random_uuid()) $q$, true);
reset role;
-- 4 · Servicios por defecto de la agencia
set role authenticated;
select pg_temp.entra_como('ana@aj.test');
select pg_temp.prueba('Un usuario de subcuenta no configura el correo de la agencia',
  $q$ insert into public.agencia_servicios (agencia_id, correo_proveedor, correo_remitente) values ((select id from ids where clave = 'ag'), 'smtp', 'a@b.es') $q$, true);
select pg_temp.prueba('…ni sus claves', $q$ select public.agencia_guardar_secretos((select id from ids where clave = 'ag'), '{"smtp_clave":"x"}') $q$, true);
select pg_temp.entra_como('duena@aj.test');
select pg_temp.prueba('La dueña guarda el SMTP y el Twilio de la agencia',
  $q$ insert into public.agencia_servicios (agencia_id, correo_proveedor, correo_remitente, smtp_host, twilio_sid)
      values ((select id from ids where clave = 'ag'), 'smtp', 'hola@agencia.es', 'smtp.agencia.es', 'AC' || repeat('a', 32)) $q$, false);
select public.agencia_guardar_secretos((select id from ids where clave = 'ag'), '{"smtp_clave":"secreta","twilio_token":"tok"}');
select public.agencia_guardar_secretos((select id from ids where clave = 'ag'), '{"smtp_clave":""}');
select pg_temp.prueba('Las claves de la agencia no se leen desde la app', $q$ select * from public.agencia_secretos $q$, true);
select pg_temp.igual('Solo se sabe si están puestas (y «vacío» no la borró)',
  (select public.agencia_estado_secretos((select id from ids where clave = 'ag')) ->> 'smtp_clave'), 'true');
select pg_temp.igual('El resumen lista sus 2 subcuentas', (select count(*)::text from public.agencia_resumen_servicios((select id from ids where clave = 'ag'))), '2');
select pg_temp.igual('Activar la verificación en todas', (select public.agencia_verificacion_correos((select id from ids where clave = 'ag'), true)::text), '2');
select pg_temp.entra_como('ana@aj.test');
select pg_temp.prueba('Ana no ve el resumen de la agencia', $q$ select * from public.agencia_resumen_servicios((select id from ids where clave = 'ag')) $q$, true);
select pg_temp.igual('Ana sabe que Norte usa el correo y el Twilio de la agencia',
  (select (r ->> 'correo') || '/' || (r ->> 'twilio') from (select public.servicios_heredados((select id from ids where clave = 'norte')) r) x), 'true/true');
select pg_temp.prueba('…pero no puede preguntar por Sur', $q$ select public.servicios_heredados((select id from ids where clave = 'sur')) $q$, true);
reset role;
select pg_temp.igual('Norte queda con la verificación de correos activada',
  (select verificar_correos::text from public.conv_ajustes where subcuenta_id = (select id from ids where clave = 'norte')), 'true');
-- 5 · Datos de muestra y JS personalizado
set role authenticated;
select pg_temp.entra_como('duena@aj.test');
update public.agencias set datos_muestra = true where id = (select id from ids where clave = 'ag');
insert into public.subcuentas (agencia_id, nombre) select id, 'Con muestra' from ids where clave = 'ag';
select pg_temp.igual('La subcuenta nueva nace con 5 contactos de muestra',
  (select count(*)::text from public.crm_contactos c join public.subcuentas s on s.id = c.subcuenta_id where s.nombre = 'Con muestra' and 'muestra' = any (c.etiquetas)), '5');
select pg_temp.igual('…y 5 oportunidades en su embudo',
  (select count(*)::text from public.crm_oportunidades o join public.subcuentas s on s.id = o.subcuenta_id where s.nombre = 'Con muestra'), '5');
update public.agencias set datos_muestra = false where id = (select id from ids where clave = 'ag');
insert into public.subcuentas (agencia_id, nombre) select id, 'Vacía' from ids where clave = 'ag';
select pg_temp.igual('Sin la opción, nace vacía',
  (select count(*)::text from public.crm_contactos c join public.subcuentas s on s.id = c.subcuenta_id where s.nombre = 'Vacía'), '0');
select pg_temp.prueba('La propietaria guarda JS', $q$ update public.agencias set js_personalizado = 'console.log(1)' where id = (select id from ids where clave = 'ag') $q$, false);
select pg_temp.entra_como('admin@aj.test');
select pg_temp.prueba('Un admin (no propietario) no puede cambiar el JS',
  $q$ update public.agencias set js_personalizado = 'robar()' where id = (select id from ids where clave = 'ag') $q$, true);
select pg_temp.prueba('…pero sí otros ajustes', $q$ update public.agencias set datos_muestra = true where id = (select id from ids where clave = 'ag') $q$, false);
select pg_temp.entra_como('ana@aj.test');
select pg_temp.igual('Ana recibe el JS de su agencia en Norte', (select public.js_agencia((select id from ids where clave = 'norte'))), 'console.log(1)');
select pg_temp.igual('…y nada de una subcuenta a la que no tiene acceso', (select coalesce(public.js_agencia((select id from ids where clave = 'sur')), '∅')), '∅');
reset role;
delete from public.agencias where nombre in ('Agencia Aj', 'Ajena');
delete from auth.users where email like '%@aj.test';
