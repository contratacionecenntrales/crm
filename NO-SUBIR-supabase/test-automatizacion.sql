-- =============================================================================
-- Pruebas de 17-automatizacion.sql. NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@aut.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@aut.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@aut.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@aut.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@aut.test';

set role authenticated;
select pg_temp.entra_como('duena@aut.test');
select public.crear_agencia('Agencia Aut');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from public.agencias;
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@aut.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas;
set role authenticated;

select pg_temp.prueba('Disparador desconocido se rechaza',
  $q$ insert into public.aut_flujos (subcuenta_id, nombre, disparador) values ((select id from ids where clave = 'norte'), 'X', 'cuando_llueva') $q$, true);
select pg_temp.prueba('La dueña crea «Bienvenida» (contacto creado), publicado',
  $q$ insert into public.aut_flujos (subcuenta_id, nombre, disparador, activo, pasos) values ((select id from ids where clave = 'norte'), 'Bienvenida', 'contacto_creado', true,
      '[{"tipo":"enviar_email","asunto":"Hola","texto":"Hola {{contacto.nombre}}"},{"tipo":"esperar","cantidad":1,"unidad":"dias"},{"tipo":"anadir_etiqueta","etiqueta":"seguimiento"}]') $q$, false);
select pg_temp.prueba('…«VIP» (etiqueta vip añadida), publicado',
  $q$ insert into public.aut_flujos (subcuenta_id, nombre, disparador, filtro, activo, pasos) values ((select id from ids where clave = 'norte'), 'VIP', 'etiqueta_anadida', '{"etiqueta":"vip"}', true, '[{"tipo":"nota","texto":"Cliente VIP"}]') $q$, false);
select pg_temp.prueba('…«Precio» (mensaje con la palabra precio)',
  $q$ insert into public.aut_flujos (subcuenta_id, nombre, disparador, filtro, activo, pasos) values ((select id from ids where clave = 'norte'), 'Precio', 'mensaje_recibido', '{"palabra":"precio"}', true, '[{"tipo":"anadir_etiqueta","etiqueta":"interesado"}]') $q$, false);
select pg_temp.prueba('…«Borrador» sin publicar',
  $q$ insert into public.aut_flujos (subcuenta_id, nombre, disparador, activo, pasos) values ((select id from ids where clave = 'norte'), 'Borrador', 'contacto_creado', false, '[{"tipo":"nota","texto":"x"}]') $q$, false);

select pg_temp.entra_como('ana@aut.test');
select pg_temp.prueba('Una usuaria no crea flujos',
  $q$ insert into public.aut_flujos (subcuenta_id, nombre) values ((select id from ids where clave = 'norte'), 'Mío') $q$, true);
select pg_temp.prueba('Ana crea un contacto con la etiqueta vip',
  $q$ insert into public.crm_contactos (subcuenta_id, nombre, email, etiquetas) values ((select id from ids where clave = 'norte'), 'Luis', 'luis@x.es', '{vip}') $q$, false);
select pg_temp.igual('Entra en Bienvenida y en VIP (no en el borrador)',
  (select string_agg(f.nombre, ',' order by f.nombre) from public.aut_ejecuciones e join public.aut_flujos f on f.id = e.flujo_id), 'Bienvenida,VIP');
select pg_temp.igual('La ejecución guarda copia de los pasos', (select jsonb_array_length(e.pasos)::text from public.aut_ejecuciones e join public.aut_flujos f on f.id = e.flujo_id where f.nombre = 'Bienvenida'), '3');
select pg_temp.prueba('Quitar y volver a poner vip',
  $q$ update public.crm_contactos set etiquetas = '{}' where nombre = 'Luis' $q$, false);
select pg_temp.prueba('…', $q$ update public.crm_contactos set etiquetas = '{vip}' where nombre = 'Luis' $q$, false);
select pg_temp.igual('Sin reentrada: sigue habiendo una sola ejecución de VIP',
  (select count(*)::text from public.aut_ejecuciones e join public.aut_flujos f on f.id = e.flujo_id where f.nombre = 'VIP'), '1');
select pg_temp.prueba('Ana no puede usar el motor', $q$ select * from public.aut_tomar(10) $q$, true);
select pg_temp.prueba('Ana no puede disparar a mano', $q$ select public.aut_disparar((select id from ids where clave = 'norte'), (select id from public.crm_contactos limit 1), 'contacto_creado') $q$, true);
select pg_temp.prueba('Ana prueba el borrador con Luis (inscripción manual)',
  $q$ select public.aut_inscribir((select id from public.aut_flujos where nombre = 'Borrador'), (select id from public.crm_contactos where nombre = 'Luis')) $q$, false);
select pg_temp.prueba('Ana para la ejecución de Bienvenida',
  $q$ update public.aut_ejecuciones set estado = 'terminada', motivo = 'Parada a mano', terminado = now() where flujo_id = (select id from public.aut_flujos where nombre = 'Bienvenida') $q$, false);
select pg_temp.prueba('…pero no puede marcarla como completada', $q$ update public.aut_ejecuciones set estado = 'completada' $q$, true);

-- Mensaje entrante con «precio»
reset role;
set role service_role;
select pg_temp.prueba('Llega un SMS «¿Qué PRECIO tiene?»',
  $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34600111222', '¿Qué PRECIO tiene?', '', 'SMa') $q$, false);
select pg_temp.prueba('…y otro sin la palabra', $q$ select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34600111333', 'Hola', '', 'SMb') $q$, false);
reset role;
select pg_temp.igual('Solo el primero entra en «Precio»',
  (select count(*)::text from public.aut_ejecuciones e join public.aut_flujos f on f.id = e.flujo_id where f.nombre = 'Precio'), '1');

-- Cola del motor
set role service_role;
select pg_temp.igual('El motor toma las pendientes (VIP, Borrador, Precio + Bienvenida de los 2 contactos nuevos)',
  (select count(*)::text from public.aut_tomar(50)), '5');
select pg_temp.igual('No las repite', (select count(*)::text from public.aut_tomar(50)), '0');
reset role;

set role authenticated;
select pg_temp.entra_como('otro@aut.test');
select pg_temp.igual('Una persona ajena no ve flujos', (select count(*)::text from public.aut_flujos), '0');
select pg_temp.prueba('…ni inscribe', $q$ select public.aut_inscribir((select id from ids where clave = 'norte'), (select id from ids where clave = 'norte')) $q$, true);
reset role;
delete from public.agencias;
