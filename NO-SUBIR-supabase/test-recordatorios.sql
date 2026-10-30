-- =============================================================================
-- Pruebas de 14-recordatorios.sql. NO se ejecuta en Supabase.
-- _stub-auth.sql → 09 → … → 13 → 14 → este fichero.
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

create or replace function pg_temp.h(dias int, hora text) returns timestamptz language sql as $$
  select ((current_date + dias)::text || ' ' || hora)::timestamp at time zone 'Europe/Madrid'
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

delete from public.agencias;
delete from auth.users where email like '%@rec.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@rec.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@rec.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@rec.test';

set role authenticated;
select pg_temp.entra_como('duena@rec.test');
select public.crear_agencia('Agencia Rec');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from public.agencias;
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@rec.test', 'usuario');
insert into public.cal_calendarios (subcuenta_id, nombre, slug, antelacion_min, avisos_canales, recordatorios)
select id, 'Consulta', 'consulta-rec', 0, '{email,sms}', '{1440,60}' from public.subcuentas;
insert into public.cal_horarios (subcuenta_id, calendario_id, dia, inicio, fin)
select subcuenta_id, id, d, '08:00', '20:00' from public.cal_calendarios, generate_series(0, 6) d;
insert into public.crm_contactos (subcuenta_id, nombre, email, telefono) select id, 'Luis', 'luis@x.es', '+34611222333' from public.subcuentas;

select pg_temp.prueba('Recordatorio de 1 minuto se rechaza', $q$ update public.cal_calendarios set recordatorios = '{1}' $q$, true);
select pg_temp.prueba('Más de 5 recordatorios se rechazan', $q$ update public.cal_calendarios set recordatorios = '{10,20,30,40,50,60}' $q$, true);
select pg_temp.prueba('Canal desconocido se rechaza', $q$ update public.cal_calendarios set avisos_canales = '{fax}' $q$, true);

select pg_temp.entra_como('ana@rec.test');
select pg_temp.prueba('Ana crea una cita para dentro de 3 días a las 10:00',
  $q$ insert into public.cal_citas (subcuenta_id, calendario_id, contacto_id, asignado_id, titulo, inicio, fin)
      select c.subcuenta_id, c.id, k.id, auth.uid(), 'Revisión', pg_temp.h(3, '10:00'), pg_temp.h(3, '10:30') from public.cal_calendarios c, public.crm_contactos k $q$, false);
select pg_temp.igual('Cola: confirmación + 2 recordatorios × 2 canales = 6',
  (select count(*)::text from public.cal_avisos), '6');
select pg_temp.igual('Ana ve la cola pero no puede escribirla',
  (select count(*)::text from public.cal_avisos where tipo = 'recordatorio'), '4');
select pg_temp.prueba('…no puede insertar avisos', $q$ insert into public.cal_avisos (subcuenta_id, cita_id, tipo, canal, enviar_en) select subcuenta_id, id, 'recordatorio', 'email', now() from public.cal_citas $q$, true);
select pg_temp.igual('El recordatorio de 1 día es 24 h antes',
  (select min(enviar_en)::text from public.cal_avisos where tipo = 'recordatorio'), (pg_temp.h(2, '10:00'))::text);

select pg_temp.prueba('Ana mueve la cita al día 4', $q$ update public.cal_citas set inicio = pg_temp.h(4, '10:00'), fin = pg_temp.h(4, '10:30') $q$, false);
select pg_temp.igual('Ahora hay avisos de cambio, no de confirmación',
  (select string_agg(distinct tipo, ',' order by tipo) from public.cal_avisos where estado = 'pendiente'), 'cambio,recordatorio');
select pg_temp.igual('…y los recordatorios siguen la nueva hora',
  (select min(enviar_en)::text from public.cal_avisos where tipo = 'recordatorio'), (pg_temp.h(3, '10:00'))::text);

-- --- El servidor toma la cola ---------------------------------------------------
reset role;
set role service_role;
select pg_temp.igual('El servidor toma los 2 avisos vencidos (cambio por correo y SMS)',
  (select count(*)::text from public.cal_tomar_avisos(50)), '2');
select pg_temp.igual('Una segunda pasada no los repite', (select count(*)::text from public.cal_tomar_avisos(50)), '0');
update public.cal_avisos set estado = 'enviado', enviado_en = now() where estado = 'procesando';
reset role;
set role authenticated;
select pg_temp.prueba('Ana no puede usar la cola', $q$ select * from public.cal_tomar_avisos(5) $q$, true);

-- --- Cancelación por el cliente ---------------------------------------------------
reset role;
delete from auth._sesion;
create temp table tk as select token from public.cal_citas;
grant select on tk to anon;
set role anon;
select pg_temp.igual('El enlace muestra la cita y deja cancelar',
  (select (public.cal_cita_publica((select token from tk)) ->> 'puede_cancelar')), 'true');
select pg_temp.igual('Un token inventado no muestra nada', (select public.cal_cita_publica(gen_random_uuid())::text), null);
select pg_temp.igual('El cliente cancela', (select public.cal_cancelar_publico((select token from tk), 'Me ha surgido algo')::text), 'true');
select pg_temp.igual('Cancelar dos veces no hace nada', (select public.cal_cancelar_publico((select token from tk))::text), 'false');
select pg_temp.prueba('Anónimo no lee la cola', $q$ select * from public.cal_avisos $q$, true);
reset role;
select pg_temp.igual('La cita queda cancelada con el motivo en las notas',
  (select estado || ' / ' || (notas like '%Me ha surgido algo%')::text from public.cal_citas), 'cancelada / true');
select pg_temp.igual('Pendientes: solo los 2 avisos de cancelación (los recordatorios se borran)',
  (select string_agg(tipo, ',') from public.cal_avisos where estado = 'pendiente'), 'cancelacion,cancelacion');
select pg_temp.igual('Ana recibe el aviso de la cancelación',
  (select count(*)::text from public.notificaciones where titulo like 'Cita cancelada%'), '1');

-- --- Sin avisar -----------------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('ana@rec.test');
select pg_temp.prueba('Cita marcada «no avisar»',
  $q$ insert into public.cal_citas (subcuenta_id, calendario_id, contacto_id, titulo, inicio, fin, avisar)
      select c.subcuenta_id, c.id, k.id, 'Interna', pg_temp.h(5, '12:00'), pg_temp.h(5, '12:30'), false from public.cal_calendarios c, public.crm_contactos k $q$, false);
select pg_temp.igual('…no genera avisos',
  (select count(*)::text from public.cal_avisos a join public.cal_citas x on x.id = a.cita_id where x.titulo = 'Interna'), '0');
reset role;
update public.cal_calendarios set permitir_cancelar = false;
create temp table tk2 as select token from public.cal_citas where titulo = 'Interna';
grant select on tk2 to anon;
set role anon;
select pg_temp.igual('Calendario sin cancelación pública: el enlace no ofrece cancelar',
  (select public.cal_cita_publica((select token from tk2)) ->> 'puede_cancelar'), 'false');
select pg_temp.prueba('…y cancelar da error', $q$ select public.cal_cancelar_publico((select token from tk2)) $q$, true);
reset role;
delete from public.agencias;
