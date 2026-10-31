-- =============================================================================
-- Pruebas de 18-correcciones.sql (ataques de la auditoría). NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@fix.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@fix.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'admin@fix.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@fix.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@fix.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@fix.test';

set role authenticated;
select pg_temp.entra_como('otro@fix.test');
select public.crear_agencia('Ajena');
select pg_temp.entra_como('duena@fix.test');
select public.crear_agencia('Agencia Fix');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Fix';
insert into public.agencia_miembros (agencia_id, usuario_id, rol) select (select id from ids where clave = 'ag'), (select id from ids where clave = 'admin'), 'admin';
set role authenticated;
select pg_temp.entra_como('duena@fix.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@fix.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';

-- Banderas falsificadas
set role authenticated;
select pg_temp.entra_como('admin@fix.test');
select pg_temp.prueba('El admin no se hace propietario fingiendo la bandera antigua',
  $q$ select set_config('app.creando_agencia', 'si', false); update public.agencia_miembros set rol = 'propietario' where usuario_id = auth.uid() $q$, true);
select pg_temp.prueba('…ni puede escribir en las banderas internas', $q$ insert into public.banderas_internas values (txid_current(), 'creando_agencia') $q$, true);
select pg_temp.entra_como('ana@fix.test');
select pg_temp.prueba('El acceso a la subcuenta se sigue registrando', $q$ select public.registrar_acceso_subcuenta((select id from ids where clave = 'norte')) $q$, false);
select pg_temp.prueba('Zona horaria inventada en una subcuenta se rechaza', $q$ insert into public.subcuentas (agencia_id, nombre, zona_horaria) values ((select id from ids where clave = 'ag'), 'X', 'Marte/Olympus') $q$, true);

-- Notificaciones a ajenos y oráculo de pertenencia
reset role;
select pg_temp.prueba('Notificar a alguien ajeno a la subcuenta se rechaza',
  $q$ insert into public.notificaciones (usuario_id, subcuenta_id, titulo) values ((select id from ids where clave = 'otro'), (select id from ids where clave = 'norte'), 'Hola') $q$, true);
delete from auth._sesion;
set role anon;
select pg_temp.prueba('Anónimo no pregunta quién está en una subcuenta',
  $q$ select public.usuario_ve_subcuenta((select id from ids where clave = 'ana'), (select id from ids where clave = 'norte')) $q$, true);
reset role;

-- Pagos
set role authenticated;
select pg_temp.entra_como('ana@fix.test');
insert into public.pag_facturas (subcuenta_id) values ((select id from ids where clave = 'norte'));
insert into public.pag_facturas (subcuenta_id) values ((select id from ids where clave = 'norte'));
select public.pag_guardar_lineas((select id from public.pag_facturas order by numero limit 1), '[{"descripcion":"A","cantidad":1,"precio":100,"impuesto":0}]');
update public.pag_facturas set estado = 'enviada' where numero = (select min(numero) from public.pag_facturas);
insert into public.pag_transacciones (subcuenta_id, factura_id, importe, moneda, metodo)
  select subcuenta_id, id, 100, 'EUR', 'efectivo' from public.pag_facturas where numero = (select min(numero) from public.pag_facturas);
select pg_temp.igual('La primera factura queda pagada', (select estado from public.pag_facturas order by numero limit 1), 'pagada');
select pg_temp.prueba('No se puede mover una línea de la factura pagada a otra',
  $q$ update public.pag_lineas set factura_id = (select id from public.pag_facturas order by numero desc limit 1) $q$, true);
select pg_temp.prueba('No se cambian los datos de una factura pagada', $q$ update public.pag_facturas set notas = 'x' where estado = 'pagada' $q$, true);
select pg_temp.prueba('Un cobro en otra moneda se rechaza',
  $q$ insert into public.pag_transacciones (subcuenta_id, factura_id, importe, moneda, metodo) select subcuenta_id, id, 1, 'JPY', 'efectivo' from public.pag_facturas where estado = 'borrador' $q$, true);
reset role;
insert into public.subcuentas (agencia_id, nombre) select id, 'Sur' from ids where clave = 'ag';
insert into public.pag_productos (subcuenta_id, nombre, precio) select id, 'Ajeno', 1 from public.subcuentas where nombre = 'Sur';
set role authenticated;
select pg_temp.entra_como('ana@fix.test');
reset role;
select pg_temp.prueba('Una línea no puede usar un producto de otra subcuenta',
  $q$ insert into public.pag_lineas (subcuenta_id, factura_id, producto_id, descripcion, cantidad, precio)
      select (select id from ids where clave = 'norte'), (select id from public.pag_facturas where estado = 'borrador'),
             (select id from public.pag_productos where nombre = 'Ajeno'), 'z', 1, 1 $q$, true);
select pg_temp.prueba('Borrar un producto usado en una factura pagada funciona',
  $q$ insert into public.pag_productos (subcuenta_id, nombre, precio) values ((select id from ids where clave = 'norte'), 'Usado', 1);
      delete from public.pag_productos where nombre = 'Usado' $q$, false);

-- Columnas protegidas
set role authenticated;
select pg_temp.entra_como('ana@fix.test');
insert into public.crm_contactos (subcuenta_id, nombre) values ((select id from ids where clave = 'norte'), 'Luis');
insert into public.crm_notas (subcuenta_id, contacto_id, cuerpo) select subcuenta_id, id, 'Nota' from public.crm_contactos where nombre = 'Luis';
select pg_temp.prueba('El autor no puede atribuir su nota a otra persona',
  $q$ update public.crm_notas set autor_id = (select id from ids where clave = 'duena') $q$, true);
select pg_temp.prueba('…pero sí editar el texto', $q$ update public.crm_notas set cuerpo = 'Nota editada' $q$, false);

-- Calendario: quitar a alguien del equipo
select pg_temp.entra_como('duena@fix.test');
insert into public.cal_calendarios (subcuenta_id, nombre, slug, tipo, equipo, antelacion_min)
values ((select id from ids where clave = 'norte'), 'Consulta', 'consulta-fix', 'personal', array[(select id from ids where clave = 'ana')], 0);
insert into public.cal_horarios (subcuenta_id, calendario_id, dia, inicio, fin) select subcuenta_id, id, d, '09:00', '12:00' from public.cal_calendarios, generate_series(0, 6) d;
delete from public.subcuenta_miembros where usuario_id = (select id from ids where clave = 'ana');
reset role;
select pg_temp.igual('Ana sale del equipo del calendario', (select cardinality(equipo)::text from public.cal_calendarios), '0');
delete from auth._sesion;
set role anon;
select pg_temp.prueba('La reserva pública sigue funcionando',
  $q$ select public.cal_reservar('consulta-fix', (select h from public.cal_huecos('consulta-fix', current_date + 2, current_date + 2) h limit 1), 'Eva', '', 'eva@x.es') $q$, false);
reset role;

-- Automatización: bucle entre dos flujos y renombrado
set role authenticated;
select pg_temp.entra_como('duena@fix.test');
insert into public.aut_flujos (subcuenta_id, nombre, disparador, filtro, activo, permitir_reentrada, pasos)
values ((select id from ids where clave = 'norte'), 'A', 'etiqueta_anadida', '{"etiqueta":"x"}', true, true, '[{"tipo":"nota","texto":"a"}]'),
       ((select id from ids where clave = 'norte'), 'Renombrado', 'etiqueta_anadida', '{"etiqueta":"Nueva"}', true, false, '[{"tipo":"nota","texto":"b"}]');
insert into public.crm_contactos (subcuenta_id, nombre, etiquetas) values ((select id from ids where clave = 'norte'), 'Bucle', '{}');
do $$ begin for i in 1..40 loop
  update public.crm_contactos set etiquetas = '{}' where nombre = 'Bucle';
  update public.crm_contactos set etiquetas = '{x}' where nombre = 'Bucle';
end loop; end $$;
select pg_temp.igual('El tope por flujo corta en 10 entradas', (select count(*)::text from public.aut_ejecuciones), '10');
insert into public.crm_contactos (subcuenta_id, nombre, etiquetas) values ((select id from ids where clave = 'norte'), 'Vieja', '{antigua}');
select public.crm_renombrar_etiqueta((select id from ids where clave = 'norte'), 'antigua', 'Nueva');
reset role;
select pg_temp.igual('Renombrar una etiqueta no dispara flujos',
  (select count(*)::text from public.aut_ejecuciones e join public.aut_flujos f on f.id = e.flujo_id where f.nombre = 'Renombrado'), '0');
delete from public.agencias;
