-- =============================================================================
-- Pruebas de 16-pagos.sql. NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@pag.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@pag.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@pag.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@pag.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@pag.test';

set role authenticated;
select pg_temp.entra_como('duena@pag.test');
select public.crear_agencia('Agencia Pag');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from public.agencias;
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@pag.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas;
set role authenticated;
insert into public.crm_contactos (subcuenta_id, nombre, email) select id, 'Luis', 'luis@x.es' from public.subcuentas;

select pg_temp.prueba('La dueña pone prefijo FAC-2026- y moneda EUR',
  $q$ insert into public.pag_ajustes (subcuenta_id, prefijo, moneda) values ((select id from ids where clave = 'norte'), 'FAC-2026-', 'EUR') $q$, false);
select pg_temp.prueba('Clave de Stripe con formato malo se rechaza',
  $q$ select public.pag_guardar_secretos((select id from ids where clave = 'norte'), 'pk_test_123', '') $q$, true);
select pg_temp.prueba('La dueña guarda la clave secreta de prueba',
  $q$ select public.pag_guardar_secretos((select id from ids where clave = 'norte'), 'sk_test_abcdefghij123', 'whsec_abcdefghij123') $q$, false);
select pg_temp.igual('Solo se sabe que está puesta y en modo prueba',
  (select public.pag_estado_secretos((select id from ids where clave = 'norte')) ->> 'modo'), 'prueba');
select pg_temp.prueba('…nadie la lee', $q$ select stripe_secreta from public.pag_secretos $q$, true);

select pg_temp.entra_como('ana@pag.test');
select pg_temp.prueba('Ana crea un producto', $q$ insert into public.pag_productos (subcuenta_id, nombre, precio, impuesto) values ((select id from ids where clave = 'norte'), 'Limpieza dental', 60, 21) $q$, false);
select pg_temp.prueba('Ana crea una factura para Luis',
  $q$ insert into public.pag_facturas (subcuenta_id, contacto_id, vencimiento) select subcuenta_id, id, current_date + 15 from public.crm_contactos $q$, false);
select pg_temp.prueba('…y otra', $q$ insert into public.pag_facturas (subcuenta_id) values ((select id from ids where clave = 'norte')) $q$, false);
select pg_temp.igual('Se numeran solas y seguidas', (select string_agg(numero, ',' order by numero) from public.pag_facturas), 'FAC-2026-0001,FAC-2026-0002');
select pg_temp.prueba('Ana no puede inventarse el total',
  $q$ update public.pag_facturas set total = 1 $q$, true);
select pg_temp.prueba('Líneas: 2 × 60 € (21 %) y 1 × 10,50 € (0 %)',
  $q$ insert into public.pag_lineas (subcuenta_id, factura_id, descripcion, cantidad, precio, impuesto, orden)
      select subcuenta_id, id, 'Limpieza dental', 2, 60, 21, 1 from public.pag_facturas where numero = 'FAC-2026-0001'
      union all select subcuenta_id, id, 'Kit de higiene', 1, 10.50, 0, 2 from public.pag_facturas where numero = 'FAC-2026-0001' $q$, false);
select pg_temp.igual('Totales calculados: 130,50 + 25,20 = 155,70',
  (select subtotal || ' + ' || impuestos || ' = ' || total from public.pag_facturas where numero = 'FAC-2026-0001'), '130.50 + 25.20 = 155.70');
select pg_temp.igual('Guardar líneas en bloque (1 × 100 € al 10 %)',
  (select public.pag_guardar_lineas(id, '[{"descripcion":"Prueba","cantidad":1,"precio":100,"impuesto":10}]')::text from public.pag_facturas where numero = 'FAC-2026-0002'), '1');
select pg_temp.igual('…recalcula el total', (select total::text from public.pag_facturas where numero = 'FAC-2026-0002'), '110.00');
select pg_temp.prueba('Una línea con cantidad 0 se rechaza entera',
  $q$ select public.pag_guardar_lineas(id, '[{"descripcion":"A","cantidad":1,"precio":1},{"descripcion":"B","cantidad":0,"precio":1}]') from public.pag_facturas where numero = 'FAC-2026-0002' $q$, true);
select pg_temp.igual('…y se conservan las anteriores', (select total::text from public.pag_facturas where numero = 'FAC-2026-0002'), '110.00');
select pg_temp.prueba('No se puede marcar pagada sin cobro',
  $q$ update public.pag_facturas set estado = 'pagada' where numero = 'FAC-2026-0001' $q$, true);
select pg_temp.prueba('Ana la envía', $q$ update public.pag_facturas set estado = 'enviada' where numero = 'FAC-2026-0001' $q$, false);
select pg_temp.prueba('Ana no puede registrar un cobro «stripe» a mano',
  $q$ insert into public.pag_transacciones (subcuenta_id, factura_id, importe, moneda, metodo) select subcuenta_id, id, 155.70, 'EUR', 'stripe' from public.pag_facturas where numero = 'FAC-2026-0001' $q$, true);
select pg_temp.prueba('Ana registra 50 € en efectivo',
  $q$ insert into public.pag_transacciones (subcuenta_id, factura_id, importe, moneda, metodo) select subcuenta_id, id, 50, 'EUR', 'efectivo' from public.pag_facturas where numero = 'FAC-2026-0001' $q$, false);
select pg_temp.igual('Pago parcial: sigue enviada con 50 cobrados',
  (select estado || ' ' || cobrado from public.pag_facturas where numero = 'FAC-2026-0001'), 'enviada 50.00');
reset role;
delete from auth._sesion;

-- Página pública
create temp table tk as select numero, token, id from public.pag_facturas;
grant select on tk to anon, service_role;
set role anon;
select pg_temp.igual('La página pública muestra el total y 2 líneas',
  (select (public.pag_factura_publica(token) ->> 'total') || ' / ' || jsonb_array_length(public.pag_factura_publica(token) -> 'lineas')
   from tk where numero = 'FAC-2026-0001'), '155.70 / 2');
select pg_temp.igual('Un borrador no se ve en público',
  (select count(*)::text from tk where public.pag_factura_publica(token) is not null), '1');
select pg_temp.prueba('Anónimo no registra pagos', $q$ select public.pag_registrar_pago_stripe((select id from ids where clave = 'norte'), gen_random_uuid(), 1, 'EUR', 'x') $q$, true);
reset role;

-- Stripe confirma el resto
set role service_role;
select pg_temp.prueba('El webhook registra 105,70 € por Stripe',
  $q$ select public.pag_registrar_pago_stripe((select id from ids where clave = 'norte'), (select id from tk where numero = 'FAC-2026-0001'), 105.70, 'eur', 'pi_123') $q$, false);
select pg_temp.prueba('El mismo aviso repetido no duplica',
  $q$ select public.pag_registrar_pago_stripe((select id from ids where clave = 'norte'), (select id from tk where numero = 'FAC-2026-0001'), 105.70, 'eur', 'pi_123') $q$, false);
reset role;
select pg_temp.igual('Factura pagada con 155,70 cobrados',
  (select estado || ' ' || cobrado || ' ' || (pagada_en is not null)::text from public.pag_facturas where numero = 'FAC-2026-0001'), 'pagada 155.70 true');
select pg_temp.igual('2 transacciones', (select count(*)::text from public.pag_transacciones), '2');
select pg_temp.igual('La ficha de Luis anota la factura pagada', (select count(*)::text from public.crm_eventos where tipo = 'factura_pagada'), '1');
select pg_temp.igual('Ana (creadora) recibe el aviso', (select count(*)::text from public.notificaciones where categoria = 'Pagos'), '1');

set role authenticated;
select pg_temp.entra_como('ana@pag.test');
select pg_temp.prueba('No se pueden cambiar líneas de una factura pagada',
  $q$ update public.pag_lineas set precio = 1 where descripcion = 'Kit de higiene' $q$, true);
select pg_temp.igual('Una factura pagada no se borra (0 filas)',
  (select count(*)::text from public.pag_facturas where numero = 'FAC-2026-0001'), '1');
select pg_temp.prueba('…su DELETE no hace nada', $q$ delete from public.pag_facturas where numero = 'FAC-2026-0001' $q$, false);
select pg_temp.igual('…y sigue ahí', (select count(*)::text from public.pag_facturas where numero = 'FAC-2026-0001'), '1');
select pg_temp.prueba('Ana no reembolsa (solo administradores)', $q$ update public.pag_transacciones set estado = 'reembolsada' where metodo = 'efectivo' $q$, false);
select pg_temp.igual('…el cobro sigue completado', (select estado from public.pag_transacciones where metodo = 'efectivo'), 'completada');
select pg_temp.entra_como('duena@pag.test');
select pg_temp.prueba('La dueña marca el efectivo como reembolsado', $q$ update public.pag_transacciones set estado = 'reembolsada' where metodo = 'efectivo' $q$, false);
select pg_temp.igual('La factura vuelve a pendiente', (select estado || ' ' || cobrado from public.pag_facturas where numero = 'FAC-2026-0001'), 'enviada 105.70');
select pg_temp.prueba('Una factura emitida no vuelve a borrador', $q$ update public.pag_facturas set estado = 'borrador' where numero = 'FAC-2026-0001' $q$, true);
select pg_temp.prueba('El contador no retrocede', $q$ update public.pag_ajustes set siguiente_numero = 1 $q$, true);
select pg_temp.prueba('Borrar el borrador FAC-2026-0002', $q$ delete from public.pag_facturas where numero = 'FAC-2026-0002' $q$, false);
select pg_temp.prueba('Anular la 0001', $q$ update public.pag_facturas set estado = 'anulada' where numero = 'FAC-2026-0001' $q$, false);
select pg_temp.prueba('Una anulada no se reabre', $q$ update public.pag_facturas set estado = 'enviada' where numero = 'FAC-2026-0001' $q$, true);
select pg_temp.prueba('Nueva factura: el número no reutiliza el borrado',
  $q$ insert into public.pag_facturas (subcuenta_id) values ((select id from ids where clave = 'norte')) $q$, false);
select pg_temp.igual('…es la 0003', (select max(numero) from public.pag_facturas), 'FAC-2026-0003');
reset role;
set role service_role;
select pg_temp.prueba('Stripe cobra la factura anulada: se registra igualmente',
  $q$ select public.pag_registrar_pago_stripe((select id from ids where clave = 'norte'), (select id from tk where numero = 'FAC-2026-0001'), 10, 'eur', 'pi_anulada') $q$, false);
reset role;
select pg_temp.igual('…y avisa para revisarlo', (select count(*)::text from public.notificaciones where titulo like 'Revisar cobro%'), '1');
set role service_role;
select pg_temp.igual('Reembolso desde Stripe marca la transacción', (select public.pag_reembolso_stripe((select id from ids where clave = 'norte'), 'pi_123')::text), '1');
reset role;
set role authenticated;
select pg_temp.entra_como('duena@pag.test');

select pg_temp.entra_como('otro@pag.test');
select pg_temp.igual('Una persona ajena no ve facturas', (select count(*)::text from public.pag_facturas), '0');
select pg_temp.prueba('…ni el estado de Stripe', $q$ select public.pag_estado_secretos((select id from ids where clave = 'norte')) $q$, true);
reset role;
delete from public.agencias;
