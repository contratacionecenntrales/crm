-- =============================================================================
-- Pruebas de 12-calendarios.sql. NO se ejecuta en Supabase.
-- _stub-auth.sql → 09 → 10 → 11 → 12 → este fichero.
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
-- Un día concreto (dentro de una semana) a una hora de Madrid.
create or replace function pg_temp.h(hora text) returns timestamptz language sql as $$
  select ((current_date + 7)::text || ' ' || hora)::timestamp at time zone 'Europe/Madrid'
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

delete from public.agencias;
delete from auth.users where email like '%@cal.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@cal.test', 'authenticated', 'authenticated', now(), now(), '{"nombre":"Dueña"}'),
  (gen_random_uuid(), 'ana@cal.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'luis@cal.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@cal.test', 'authenticated', 'authenticated', now(), now(), '{}');

create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@cal.test';

set role authenticated;
select pg_temp.entra_como('duena@cal.test');
select public.crear_agencia('Agencia Cal');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from public.agencias;
insert into public.subcuentas (agencia_id, nombre) select id, 'Sur' from public.agencias;
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Norte'), 'ana@cal.test', 'usuario');
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Norte'), 'luis@cal.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';
set role authenticated;

-- --- Configuración -----------------------------------------------------------
select pg_temp.prueba('Un calendario «personal» no admite dos personas',
  $q$ insert into public.cal_calendarios (subcuenta_id, nombre, slug, tipo, equipo)
      values ((select id from ids where clave = 'norte'), 'X', 'x-personal', 'personal',
              array[(select id from ids where clave = 'ana'), (select id from ids where clave = 'luis')]) $q$, true);
select pg_temp.prueba('El equipo no puede incluir a alguien ajeno',
  $q$ insert into public.cal_calendarios (subcuenta_id, nombre, slug, tipo, equipo)
      values ((select id from ids where clave = 'norte'), 'X', 'x-ajeno', 'ronda', array[(select id from ids where clave = 'otro')]) $q$, true);
select pg_temp.prueba('Zona horaria inventada se rechaza',
  $q$ insert into public.cal_calendarios (subcuenta_id, nombre, slug, zona_horaria)
      values ((select id from ids where clave = 'norte'), 'X', 'x-zona', 'Marte/Olympus') $q$, true);
select pg_temp.prueba('Slug con mayúsculas o espacios se rechaza',
  $q$ insert into public.cal_calendarios (subcuenta_id, nombre, slug) values ((select id from ids where clave = 'norte'), 'X', 'Mi Cal') $q$, true);
select pg_temp.prueba('La dueña crea un calendario en ronda (Ana y Luis), 30 min, sin antelación',
  $q$ insert into public.cal_calendarios (subcuenta_id, nombre, slug, tipo, equipo, antelacion_min)
      values ((select id from ids where clave = 'norte'), 'Consulta', 'consulta-norte', 'ronda',
              array[(select id from ids where clave = 'ana'), (select id from ids where clave = 'luis')], 0) $q$, false);
select pg_temp.igual('Hereda la zona horaria de la subcuenta',
  (select zona_horaria from public.cal_calendarios where slug = 'consulta-norte'), 'Europe/Madrid');
select pg_temp.prueba('Horario: todos los días de 09:00 a 11:00',
  $q$ insert into public.cal_horarios (subcuenta_id, calendario_id, dia, inicio, fin)
      select c.subcuenta_id, c.id, d, '09:00', '11:00' from public.cal_calendarios c, generate_series(0, 6) d
      where c.slug = 'consulta-norte' $q$, false);
select pg_temp.igual('Guardar el horario en bloque: lunes 9-11 y 16-18',
  (select public.cal_guardar_horario((select id from public.cal_calendarios), '[{"dia":1,"inicio":"09:00","fin":"11:00"},{"dia":1,"inicio":"16:00","fin":"18:00"}]')::text), '2');
select pg_temp.prueba('Franjas que se pisan se rechazan',
  $q$ select public.cal_guardar_horario((select id from public.cal_calendarios), '[{"dia":2,"inicio":"09:00","fin":"11:00"},{"dia":2,"inicio":"10:00","fin":"12:00"}]') $q$, true);
delete from public.cal_horarios;
select pg_temp.prueba('Horario de nuevo: todos los días de 09:00 a 11:00',
  $q$ insert into public.cal_horarios (subcuenta_id, calendario_id, dia, inicio, fin)
      select c.subcuenta_id, c.id, d, '09:00', '11:00' from public.cal_calendarios c, generate_series(0, 6) d
      where c.slug = 'consulta-norte' $q$, false);
select pg_temp.prueba('Franja que acaba antes de empezar se rechaza',
  $q$ insert into public.cal_horarios (subcuenta_id, calendario_id, dia, inicio, fin)
      select subcuenta_id, id, 1, '12:00', '11:00' from public.cal_calendarios where slug = 'consulta-norte' $q$, true);

select pg_temp.entra_como('ana@cal.test');
select pg_temp.prueba('Una usuaria (no admin) no crea calendarios',
  $q$ insert into public.cal_calendarios (subcuenta_id, nombre, slug) values ((select id from ids where clave = 'norte'), 'Mío', 'mio-ana') $q$, true);
select pg_temp.prueba('…ni cambia su horario',
  $q$ select public.cal_guardar_horario((select id from public.cal_calendarios), '[]') $q$, true);
select pg_temp.igual('…pero sí ve el calendario', (select count(*)::text from public.cal_calendarios), '1');
select pg_temp.igual('Huecos internos del día: 4 (9:00, 9:30, 10:00, 10:30)',
  (select count(*)::text from public.cal_huecos_internos((select id from public.cal_calendarios), current_date + 7, current_date + 7)), '4');

-- --- Reserva pública -----------------------------------------------------------
reset role;
delete from auth._sesion;
set role anon;
select pg_temp.igual('Anónimo ve los datos públicos del calendario',
  (select public.cal_publico('consulta-norte') ->> 'empresa'), 'Norte');
select pg_temp.igual('Anónimo: 4 huecos libres ese día',
  (select count(*)::text from public.cal_huecos('consulta-norte', current_date + 7, current_date + 7)), '4');
select pg_temp.prueba('Anónimo no lee citas directamente', $q$ select * from public.cal_citas $q$, true);
select pg_temp.prueba('Anónimo no usa los huecos internos',
  $q$ select * from public.cal_huecos_internos((select id from ids where clave = 'norte'), current_date, current_date) $q$, true);
select pg_temp.prueba('Reserva 1 a las 09:00 (Marta)',
  $q$ select public.cal_reservar('consulta-norte', pg_temp.h('09:00'), 'Marta', 'Ruiz', 'marta@x.es', '600 111 222', 'Primera visita') $q$, false);
select pg_temp.igual('Sigue habiendo hueco a las 09:00 (queda otra persona libre)',
  (select count(*)::text from public.cal_huecos('consulta-norte', current_date + 7, current_date + 7) h where h = pg_temp.h('09:00')), '1');
select pg_temp.prueba('Reserva 2 a las 09:00 (Pedro)',
  $q$ select public.cal_reservar('consulta-norte', pg_temp.h('09:00'), 'Pedro', '', 'pedro@x.es') $q$, false);
select pg_temp.igual('Ya no hay hueco a las 09:00: quedan 3',
  (select count(*)::text from public.cal_huecos('consulta-norte', current_date + 7, current_date + 7)), '3');
select pg_temp.prueba('Una tercera reserva a las 09:00 se rechaza',
  $q$ select public.cal_reservar('consulta-norte', pg_temp.h('09:00'), 'Eva', '', 'eva@x.es') $q$, true);
select pg_temp.prueba('Una hora fuera del horario se rechaza',
  $q$ select public.cal_reservar('consulta-norte', pg_temp.h('15:00'), 'Eva', '', 'eva@x.es') $q$, true);
select pg_temp.prueba('Correo no válido se rechaza',
  $q$ select public.cal_reservar('consulta-norte', pg_temp.h('10:00'), 'Eva', '', 'eva-sin-arroba') $q$, true);
select pg_temp.prueba('Slug inexistente se rechaza',
  $q$ select public.cal_reservar('no-existe', pg_temp.h('10:00'), 'Eva', '', 'eva@x.es') $q$, true);
select pg_temp.prueba('Marta reserva otra vez (10:00) con el mismo correo',
  $q$ select public.cal_reservar('consulta-norte', pg_temp.h('10:00'), 'Marta', 'Ruiz', 'MARTA@x.es') $q$, false);
reset role;

select pg_temp.igual('Las dos citas de las 09:00 van a personas distintas',
  (select count(distinct asignado_id)::text from public.cal_citas where inicio = pg_temp.h('09:00')), '2');
select pg_temp.igual('Marta es un único contacto (se reutiliza por correo)',
  (select count(*)::text from public.crm_contactos where email = 'marta@x.es'), '1');
select pg_temp.igual('Su teléfono se guarda con el prefijo de la subcuenta',
  (select telefono from public.crm_contactos where email = 'marta@x.es'), '+34600111222');
select pg_temp.igual('La línea de tiempo de Marta tiene 2 citas',
  (select count(*)::text from public.crm_eventos e join public.crm_contactos c on c.id = e.contacto_id
   where c.email = 'marta@x.es' and e.tipo = 'cita_creada'), '2');
select pg_temp.igual('Ana y Luis reciben aviso de sus citas (3 avisos)',
  (select count(*)::text from public.notificaciones where categoria = 'Citas'), '3');

-- --- Equipo -----------------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('ana@cal.test');
select pg_temp.prueba('Ana no puede tener dos citas a la vez',
  $q$ insert into public.cal_citas (subcuenta_id, calendario_id, asignado_id, titulo, inicio, fin)
      select c.subcuenta_id, c.id, x.asignado_id, 'Solape', pg_temp.h('09:15'), pg_temp.h('09:45')
      from public.cal_calendarios c, public.cal_citas x where x.inicio = pg_temp.h('09:00') and x.asignado_id = (select id from ids where clave = 'ana')
      limit 1 $q$, true);
select pg_temp.prueba('Ana crea una cita interna a las 12:00',
  $q$ insert into public.cal_citas (subcuenta_id, calendario_id, asignado_id, titulo, inicio, fin)
      select subcuenta_id, id, (select id from ids where clave = 'ana'), 'Llamada interna', pg_temp.h('12:00'), pg_temp.h('12:30')
      from public.cal_calendarios $q$, false);
select pg_temp.prueba('Ana bloquea el calendario de 10:30 a 11:00',
  $q$ insert into public.cal_bloqueos (subcuenta_id, calendario_id, titulo, inicio, fin)
      select subcuenta_id, id, 'Reunión', pg_temp.h('10:30'), pg_temp.h('11:00') from public.cal_calendarios $q$, false);
select pg_temp.igual('Tras el bloqueo quedan 09:30 y 10:00 (a las 10:00 solo una persona)',
  (select string_agg(cardinality(usuarios)::text, ',' order by inicio) from public.cal_huecos_internos((select id from public.cal_calendarios), current_date + 7, current_date + 7)), '2,1');
select pg_temp.prueba('Ana marca una cita como presentada',
  $q$ update public.cal_citas set estado = 'presentado' where inicio = pg_temp.h('10:00') $q$, false);
select pg_temp.prueba('Ana no puede cambiar el origen de una cita',
  $q$ update public.cal_citas set origen = 'interno' where inicio = pg_temp.h('10:00') $q$, true);
select pg_temp.prueba('Ana intenta borrar las reservas', $q$ delete from public.cal_citas where origen = 'reserva' $q$, false);
select pg_temp.igual('…pero no borra ninguna que no creó',
  (select count(*)::text from public.cal_citas where origen = 'reserva'), '3');
select pg_temp.prueba('Cancelar libera la hora',
  $q$ update public.cal_citas set estado = 'cancelada' where inicio = pg_temp.h('10:00') $q$, false);
select pg_temp.igual('…y a las 10:00 vuelven a estar libres las dos personas',
  (select string_agg(cardinality(usuarios)::text, ',' order by inicio) from public.cal_huecos_internos((select id from public.cal_calendarios), current_date + 7, current_date + 7)), '2,2');
select pg_temp.igual('Quedan 2 huecos',
  (select count(*)::text from public.cal_huecos_internos((select id from public.cal_calendarios), current_date + 7, current_date + 7)), '2');

select pg_temp.entra_como('otro@cal.test');
select pg_temp.igual('Una persona ajena no ve citas', (select count(*)::text from public.cal_citas), '0');
select pg_temp.prueba('Una persona ajena no pide huecos internos',
  $q$ select * from public.cal_huecos_internos((select id from ids where clave = 'norte'), current_date, current_date) $q$, true);

-- --- Límites -----------------------------------------------------------------
select pg_temp.entra_como('duena@cal.test');
select pg_temp.prueba('Máximo 2 citas al día',
  $q$ update public.cal_calendarios set max_por_dia = 2 $q$, false);
select pg_temp.igual('…con 2 citas activas ese día ya no hay huecos',
  (select count(*)::text from public.cal_huecos('consulta-norte', current_date + 7, current_date + 7)), '0');
select pg_temp.prueba('Antelación de 30 días', $q$ update public.cal_calendarios set max_por_dia = null, antelacion_min = 43200 $q$, false);
select pg_temp.igual('…el público no ve huecos dentro de una semana',
  (select count(*)::text from public.cal_huecos('consulta-norte', current_date + 7, current_date + 7)), '0');
select pg_temp.igual('…el equipo sí',
  (select count(*)::text from public.cal_huecos_internos((select id from public.cal_calendarios), current_date + 7, current_date + 7)), '2');
select pg_temp.prueba('Desactivar el calendario', $q$ update public.cal_calendarios set activo = false, antelacion_min = 0 $q$, false);
reset role;
delete from auth._sesion;
set role anon;
select pg_temp.igual('Calendario inactivo: sin datos públicos', (select public.cal_publico('consulta-norte')::text), null);
select pg_temp.igual('Calendario inactivo: sin huecos',
  (select count(*)::text from public.cal_huecos('consulta-norte', current_date + 7, current_date + 7)), '0');
reset role;
delete from public.agencias;
