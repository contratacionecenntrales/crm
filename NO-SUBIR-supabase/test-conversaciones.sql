-- =============================================================================
-- Pruebas de 13-conversaciones.sql. NO se ejecuta en Supabase.
-- _stub-auth.sql → 09 → 10 → 11 → 12 → 13 → este fichero.
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
delete from auth.users where email like '%@conv.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@conv.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@conv.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@conv.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@conv.test';

set role authenticated;
select pg_temp.entra_como('duena@conv.test');
select public.crear_agencia('Agencia Conv');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from public.agencias;
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@conv.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';
set role authenticated;

-- --- Ajustes y secretos ----------------------------------------------------------
select pg_temp.prueba('La dueña guarda los ajustes de Twilio',
  $q$ insert into public.conv_ajustes (subcuenta_id, twilio_sid, twilio_numero_sms, correo_proveedor, correo_remitente)
      values ((select id from ids where clave = 'norte'), 'AC' || repeat('a', 32), '+34600000001', 'mailgun', 'hola@norte.es') $q$, false);
select pg_temp.prueba('SID de Twilio con formato malo se rechaza',
  $q$ update public.conv_ajustes set twilio_sid = 'XX123' $q$, true);
select pg_temp.prueba('La dueña guarda el token y la clave de Mailgun',
  $q$ select public.conv_guardar_secretos((select id from ids where clave = 'norte'), '{"twilio_token":"tok123","mailgun_clave":"key-1"}') $q$, false);
select pg_temp.prueba('…pero no puede leerlos', $q$ select twilio_token from public.conv_secretos $q$, true);
select pg_temp.igual('Solo sabe que están puestos',
  (select public.conv_estado_secretos((select id from ids where clave = 'norte')) ->> 'twilio_token'), 'true');
select pg_temp.prueba('Una cadena vacía no borra la clave',
  $q$ select public.conv_guardar_secretos((select id from ids where clave = 'norte'), '{"twilio_token":""}') $q$, false);
reset role;
select pg_temp.igual('El token sigue igual', (select twilio_token from public.conv_secretos), 'tok123');
set role authenticated;
select pg_temp.prueba('null borra la clave de Mailgun',
  $q$ select public.conv_guardar_secretos((select id from ids where clave = 'norte'), '{"mailgun_clave":null}') $q$, false);
select pg_temp.igual('…y queda vacía', (select public.conv_estado_secretos((select id from ids where clave = 'norte')) ->> 'mailgun_clave'), 'false');
select pg_temp.prueba('Claves desconocidas se rechazan',
  $q$ select public.conv_guardar_secretos((select id from ids where clave = 'norte'), '{"otra":"x"}') $q$, true);

select pg_temp.entra_como('ana@conv.test');
select pg_temp.prueba('Una usuaria no cambia claves',
  $q$ select public.conv_guardar_secretos((select id from ids where clave = 'norte'), '{"twilio_token":"robado"}') $q$, true);
select pg_temp.prueba('…su UPDATE no afecta a nada', $q$ update public.conv_ajustes set correo_nombre = 'Hack' $q$, false);
select pg_temp.igual('…y el nombre sigue vacío', (select correo_nombre from public.conv_ajustes), '');
select pg_temp.igual('Pero sí ve qué canales hay', (select twilio_numero_sms from public.conv_ajustes), '+34600000001');

-- --- Mensajes salientes ----------------------------------------------------------
insert into public.crm_contactos (subcuenta_id, nombre, telefono, email, propietario_id)
values ((select id from ids where clave = 'norte'), 'Luis', '+34611222333', 'luis@x.es', (select id from ids where clave = 'ana'));
select pg_temp.prueba('Ana abre conversación con Luis',
  $q$ insert into public.conv_conversaciones (subcuenta_id, contacto_id) select subcuenta_id, id from public.crm_contactos $q$, false);
select pg_temp.prueba('No se puede abrir otra con el mismo contacto',
  $q$ insert into public.conv_conversaciones (subcuenta_id, contacto_id) select subcuenta_id, id from public.crm_contactos $q$, true);
select pg_temp.prueba('Ana escribe un SMS (pendiente)',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
      select subcuenta_id, id, 'saliente', 'sms', 'Hola Luis', 'pendiente', auth.uid() from public.conv_conversaciones $q$, false);
select pg_temp.prueba('Ana no puede marcar un SMS como enviado',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
      select subcuenta_id, id, 'saliente', 'sms', 'Falso', 'enviado', auth.uid() from public.conv_conversaciones $q$, true);
select pg_temp.prueba('Ana no puede inventar un mensaje entrante',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
      select subcuenta_id, id, 'entrante', 'sms', 'Falso', 'pendiente', auth.uid() from public.conv_conversaciones $q$, true);
select pg_temp.prueba('Ana no firma por otra persona',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
      select subcuenta_id, id, 'saliente', 'sms', 'Falso', 'pendiente', (select id from ids where clave = 'duena') from public.conv_conversaciones $q$, true);
select pg_temp.prueba('Ana deja una nota interna',
  $q$ insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, autor_id)
      select subcuenta_id, id, 'saliente', 'nota', 'Llamar el lunes', 'enviado', auth.uid() from public.conv_conversaciones $q$, false);
select pg_temp.prueba('Ana no puede cambiar el estado de un mensaje',
  $q$ update public.conv_mensajes set estado = 'entregado' $q$, true);
select pg_temp.igual('El resumen muestra el último SMS (la nota no cuenta)',
  (select ultimo_extracto from public.conv_conversaciones), 'Hola Luis');

-- --- Mensajes entrantes (servidor) -------------------------------------------------
reset role;
set role service_role;
select pg_temp.prueba('El servidor registra un SMS de Luis',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34 611 222 333', 'Vale, gracias', '', 'SM1') $q$, false);
select pg_temp.prueba('El mismo SMS reenviado no se duplica',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34611222333', 'Vale, gracias', '', 'SM1') $q$, false);
select pg_temp.prueba('Un WhatsApp de un número nuevo crea el contacto',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'whatsapp', 'whatsapp:+34699000111', 'Hola, ¿precio?', '', 'SM2', 'Rosa') $q$, false);
select pg_temp.prueba('Un correo de un remitente nuevo crea el contacto',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'email', 'Eva@Mail.com', 'Cuerpo', 'Presupuesto', '<m1@mail>') $q$, false);
select pg_temp.prueba('Número basura se rechaza',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', 'hola', 'x') $q$, true);
reset role;
select pg_temp.igual('Mensajes de Luis: 2 salientes + 1 entrante',
  (select count(*)::text from public.conv_mensajes m join public.conv_conversaciones c on c.id = m.conversacion_id
   join public.crm_contactos k on k.id = c.contacto_id where k.nombre = 'Luis'), '3');
select pg_temp.igual('La conversación de Luis tiene 1 sin leer',
  (select no_leidos::text from public.conv_conversaciones c join public.crm_contactos k on k.id = c.contacto_id where k.nombre = 'Luis'), '1');
select pg_temp.igual('Ana (propietaria de Luis) recibe el aviso',
  (select count(*)::text from public.notificaciones where categoria = 'Conversaciones' and usuario_id = (select id from ids where clave = 'ana')), '1');
select pg_temp.igual('Hay 3 conversaciones', (select count(*)::text from public.conv_conversaciones), '3');
select pg_temp.igual('Rosa se guarda con su nombre y teléfono',
  (select nombre || ' ' || telefono from public.crm_contactos where fuente = 'WhatsApp entrante'), 'Rosa +34699000111');
select pg_temp.igual('El correo se guarda en minúsculas', (select email from public.crm_contactos where fuente = 'Correo entrante'), 'eva@mail.com');

set role authenticated;
select pg_temp.entra_como('ana@conv.test');
select pg_temp.prueba('Ana marca la conversación como leída y destacada',
  $q$ update public.conv_conversaciones set no_leidos = 0, destacada = true where no_leidos > 0 and contacto_id = (select id from public.crm_contactos where nombre = 'Luis') $q$, false);
select pg_temp.prueba('Ana no puede tocar el resumen',
  $q$ update public.conv_conversaciones set ultimo_extracto = 'x' $q$, true);
select pg_temp.prueba('Ana no puede asignar la conversación a alguien ajeno',
  $q$ update public.conv_conversaciones set asignado_id = (select id from ids where clave = 'otro') $q$, true);
select pg_temp.prueba('Ana crea un fragmento',
  $q$ insert into public.conv_fragmentos (subcuenta_id, nombre, cuerpo) values ((select id from ids where clave = 'norte'), 'Saludo', 'Hola, gracias por escribirnos.') $q$, false);
select pg_temp.igual('La analítica de hoy: 3 entrantes y 1 saliente',
  (select entrantes || '/' || salientes from public.conv_analitica((select id from ids where clave = 'norte'), 7) order by dia desc limit 1), '3/1');

select pg_temp.entra_como('otro@conv.test');
select pg_temp.igual('Una persona ajena no ve conversaciones', (select count(*)::text from public.conv_conversaciones), '0');
select pg_temp.igual('…ni mensajes', (select count(*)::text from public.conv_mensajes), '0');
select pg_temp.prueba('…ni el estado de las claves',
  $q$ select public.conv_estado_secretos((select id from ids where clave = 'norte')) $q$, true);
select pg_temp.prueba('…ni registra mensajes entrantes',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34600000000', 'x') $q$, true);
reset role;
delete from auth._sesion;
set role anon;
select pg_temp.prueba('Anónimo no registra mensajes entrantes',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34600000000', 'x') $q$, true);
reset role;
delete from public.agencias;
