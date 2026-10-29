-- =============================================================================
-- Pruebas de 09-agencias-subcuentas.sql. NO se ejecuta en Supabase.
-- Postgres local:  _stub-auth.sql → 09-agencias-subcuentas.sql → este fichero.
-- Cada línea sale como [OK] o [FALLO].
-- =============================================================================
\set ON_ERROR_STOP off
\pset pager off

create or replace function pg_temp.entra_como(p_email text) returns void
language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  delete from auth._sesion; insert into auth._sesion values (v);
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
    case when obtenido is not distinct from esperado then '[OK]  ' else '[FALLO]' end,
    etiqueta, obtenido, esperado;
end $$;

grant execute on all functions in schema pg_temp to authenticated;

-- --- datos de partida ---------------------------------------------------------
delete from public.agencias;
delete from auth.users where email like '%@prueba.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@prueba.test',  'authenticated', 'authenticated', now(), now(), '{"nombre":"Dueña"}'),
  (gen_random_uuid(), 'admin@prueba.test',  'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'usuario@prueba.test','authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'cliente@prueba.test','authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otra@prueba.test',   'authenticated', 'authenticated', now(), now(), '{}');

set role authenticated;

-- --- alta de agencia ----------------------------------------------------------
select pg_temp.entra_como('duena@prueba.test');
select pg_temp.prueba('La dueña crea su agencia',
  $q$ select public.crear_agencia('Metatok Agencia') $q$, false);
select pg_temp.igual('La dueña queda como propietaria',
  (select rol::text from public.agencia_miembros), 'propietario');
select pg_temp.prueba('No se puede insertar una agencia a mano',
  $q$ insert into public.agencias (nombre) values ('Pirata') $q$, true);

select pg_temp.prueba('Añade al admin por correo',
  $q$ select public.agregar_miembro_agencia((select id from public.agencias), 'admin@prueba.test', 'admin') $q$, false);
select pg_temp.prueba('Añade al usuario por correo',
  $q$ select public.agregar_miembro_agencia((select id from public.agencias), 'usuario@prueba.test', 'usuario') $q$, false);
select pg_temp.igual('Correo inexistente devuelve null',
  (select public.agregar_miembro_agencia((select id from public.agencias), 'nadie@prueba.test')::text), null);

-- --- subcuentas ---------------------------------------------------------------
select pg_temp.prueba('La dueña crea dos subcuentas',
  $q$ insert into public.subcuentas (agencia_id, nombre, ciudad) values
      ((select id from public.agencias), 'LABS24K / GIJÓN', 'Gijón'),
      ((select id from public.agencias), 'METATOK.AI', 'Barcelona') $q$, false);
select pg_temp.prueba('Teléfono con letras se rechaza',
  $q$ insert into public.subcuentas (agencia_id, nombre, telefono) values ((select id from public.agencias), 'Mal', 'abc') $q$, true);

select pg_temp.prueba('Plan de 10 €/mes para Gijón',
  $q$ insert into public.suscripciones (agencia_id, subcuenta_id, plan, importe_mensual)
      values ('00000000-0000-0000-0000-000000000000',
              (select id from public.subcuentas where nombre like 'LABS%'), 'Básico', 10) $q$, false);
select pg_temp.igual('agencia_id de la suscripción sale de la subcuenta',
  (select (agencia_id = (select id from public.agencias))::text from public.suscripciones), 'true');
select pg_temp.prueba('Pago manual de 25 €',
  $q$ insert into public.pagos (agencia_id, subcuenta_id, importe, concepto)
      values ((select id from public.agencias), (select id from public.subcuentas where nombre like 'LABS%'), 25, 'Configuración') $q$, false);
select pg_temp.prueba('Un pago no se puede marcar como de Stripe desde la app',
  $q$ insert into public.pagos (agencia_id, importe, origen) values ((select id from public.agencias), 5, 'stripe') $q$, true);

select pg_temp.igual('MRR = 10',
  (select (public.metricas_agencia((select id from public.agencias)) ->> 'mrr')), '10.00');
select pg_temp.igual('Ingresos 30 días = 25',
  (select (public.metricas_agencia((select id from public.agencias)) ->> 'ingresos_30d')), '25.00');
select pg_temp.igual('Total clientes = 2',
  (select (public.metricas_agencia((select id from public.agencias)) ->> 'total_clientes')), '2');
select pg_temp.igual('La serie trae 7 meses',
  (select jsonb_array_length(public.metricas_agencia((select id from public.agencias)) -> 'serie')::text), '7');

select pg_temp.prueba('Cancelar la suscripción pone fecha de baja',
  $q$ update public.suscripciones set estado = 'cancelada' $q$, false);
select pg_temp.igual('cancelada_en = hoy',
  (select (cancelada_en = current_date)::text from public.suscripciones), 'true');
select pg_temp.igual('MRR tras cancelar = 0',
  (select (public.metricas_agencia((select id from public.agencias)) ->> 'mrr')), '0');
update public.suscripciones set estado = 'activa';

select pg_temp.prueba('Fijar una subcuenta',
  $q$ insert into public.subcuenta_fijadas (subcuenta_id) values ((select id from public.subcuentas where nombre = 'METATOK.AI')) $q$, false);
select pg_temp.prueba('Dar acceso al cliente a Gijón como admin',
  $q$ select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre like 'LABS%'), 'cliente@prueba.test', 'admin') $q$, false);
select pg_temp.prueba('Dar acceso al usuario de agencia a METATOK.AI',
  $q$ select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'METATOK.AI'), 'usuario@prueba.test', 'usuario') $q$, false);
select pg_temp.igual('La actividad se anota sola',
  (select (count(*) >= 4)::text from public.actividad), 'true');


-- --- notificaciones -----------------------------------------------------------
select pg_temp.entra_como('admin@prueba.test');
select pg_temp.igual('El admin recibió aviso de las 2 subcuentas nuevas',
  (select count(*)::text from public.notificaciones where titulo like 'Nueva subcuenta%'), '2');
select pg_temp.prueba('No se pueden crear notificaciones desde la app',
  $q$ insert into public.notificaciones (usuario_id, titulo) values (auth.uid(), 'falsa') $q$, true);
select pg_temp.prueba('No se puede cambiar el texto de una notificación',
  $q$ update public.notificaciones set titulo = 'x' $q$, true);
select pg_temp.igual('Marcar todo como leído marca 2',
  (select public.marcar_notificaciones_leidas()::text), '2');
select pg_temp.entra_como('cliente@prueba.test');
select pg_temp.igual('El cliente recibió el aviso de acceso',
  (select count(*)::text from public.notificaciones where titulo like 'Tienes acceso%'), '1');
select pg_temp.igual('El cliente no ve las del admin', (select count(*)::text from public.notificaciones), '1');

-- --- admin de agencia ---------------------------------------------------------
select pg_temp.entra_como('admin@prueba.test');
select pg_temp.igual('El admin ve las 2 subcuentas', (select count(*)::text from public.subcuentas), '2');
select pg_temp.igual('El admin ve la facturación', (select count(*)::text from public.suscripciones), '1');
select pg_temp.prueba('El admin no puede quitar a la propietaria',
  $q$ delete from public.agencia_miembros where rol = 'propietario' $q$, true);
select pg_temp.igual('…y la propietaria sigue ahí',
  (select count(*)::text from public.agencia_miembros where rol = 'propietario'), '1');
select pg_temp.igual('El admin no ve las fijadas de la dueña', (select count(*)::text from public.subcuenta_fijadas), '0');
select pg_temp.prueba('El admin no puede ascenderse',
  $q$ update public.agencia_miembros set rol = 'propietario' where usuario_id = auth.uid() $q$, true);
select pg_temp.prueba('El admin no puede nombrar propietario a otro',
  $q$ select public.agregar_miembro_agencia((select id from public.agencias), 'usuario@prueba.test', 'propietario') $q$, true);

-- --- usuario de agencia -------------------------------------------------------
select pg_temp.entra_como('usuario@prueba.test');
select pg_temp.igual('El usuario solo ve la subcuenta asignada',
  (select string_agg(nombre, ',') from public.subcuentas), 'METATOK.AI');
select pg_temp.igual('El usuario no ve la facturación', (select count(*)::text from public.suscripciones), '0');
select pg_temp.prueba('El usuario no ve métricas',
  $q$ select public.metricas_agencia((select id from public.agencias)) $q$, true);
select pg_temp.prueba('El usuario no crea subcuentas',
  $q$ insert into public.subcuentas (agencia_id, nombre) values ((select id from public.agencias), 'Intrusa') $q$, true);
select pg_temp.prueba('El usuario no puede fijar una subcuenta que no ve',
  $q$ insert into public.subcuenta_fijadas (subcuenta_id) select id from public.subcuentas where false
      union all select (select s.id from public.agencias a, lateral (select '00000000-0000-0000-0000-000000000001'::uuid as id) s) $q$, true);

-- --- admin de subcuenta (cliente) ---------------------------------------------
select pg_temp.entra_como('cliente@prueba.test');
select pg_temp.igual('El cliente solo ve Gijón',
  (select string_agg(nombre, ',') from public.subcuentas), 'LABS24K / GIJÓN');
select pg_temp.igual('El cliente no ve la agencia', (select count(*)::text from public.agencias), '0');
select pg_temp.prueba('El cliente edita los datos de su negocio',
  $q$ update public.subcuentas set web = 'https://labs24k.com' where nombre like 'LABS%' $q$, false);
select pg_temp.prueba('El cliente no puede cambiar su etapa',
  $q$ update public.subcuentas set etapa = 'Prueba' where nombre like 'LABS%' $q$, true);
select pg_temp.prueba('El cliente no puede suspenderse ni reactivarse',
  $q$ update public.subcuentas set estado = 'suspendida' where nombre like 'LABS%' $q$, true);
select pg_temp.prueba('El cliente registra su acceso',
  $q$ select public.registrar_acceso_subcuenta((select id from public.subcuentas where nombre like 'LABS%')) $q$, false);
select pg_temp.igual('El acceso quedó anotado',
  (select (ultimo_acceso is not null)::text from public.subcuentas where nombre like 'LABS%'), 'true');
select pg_temp.prueba('El cliente no puede borrar su subcuenta',
  $q$ delete from public.subcuentas where nombre like 'LABS%' returning 1 $q$, false);
select pg_temp.igual('…y sigue existiendo', (select count(*)::text from public.subcuentas), '1');
select pg_temp.igual('El cliente ve su equipo',
  (select count(*)::text from public.miembros_subcuenta((select id from public.subcuentas limit 1))), '1');

-- --- otra persona sin agencia -------------------------------------------------
select pg_temp.entra_como('otra@prueba.test');
select pg_temp.igual('Una desconocida no ve nada', (select count(*)::text from public.subcuentas), '0');
select pg_temp.prueba('Una desconocida no se cuela en la agencia',
  $q$ insert into public.agencia_miembros (agencia_id, usuario_id, rol)
      select id, auth.uid(), 'admin' from public.agencias $q$, false);
reset role;
select pg_temp.igual('…la inserción no metió a nadie',
  (select count(*)::text from public.agencia_miembros m join auth.users u on u.id = m.usuario_id
   where u.email = 'otra@prueba.test'), '0');
set role authenticated;
select pg_temp.prueba('Una desconocida no ve el equipo',
  $q$ select * from public.miembros_subcuenta((select id from public.subcuentas limit 1)) $q$, true);

-- --- suspensión ---------------------------------------------------------------
select pg_temp.entra_como('duena@prueba.test');
select pg_temp.prueba('La dueña suspende Gijón',
  $q$ update public.subcuentas set estado = 'suspendida' where nombre like 'LABS%' $q$, false);
select pg_temp.entra_como('cliente@prueba.test');
select pg_temp.igual('El cliente de una subcuenta suspendida no entra', (select count(*)::text from public.subcuentas), '0');
select pg_temp.entra_como('duena@prueba.test');
select pg_temp.prueba('La dueña no puede quedarse sin propietario',
  $q$ delete from public.agencia_miembros where usuario_id = auth.uid() $q$, true);
select pg_temp.prueba('La dueña borra una subcuenta',
  $q$ delete from public.subcuentas where nombre = 'METATOK.AI' $q$, false);
select pg_temp.igual('Quedan 1 subcuenta', (select count(*)::text from public.subcuentas), '1');
select pg_temp.prueba('La dueña borra la agencia entera',
  $q$ delete from public.agencias $q$, false);
reset role;
select pg_temp.igual('Todo borrado en cascada', (select count(*)::text from public.subcuentas), '0');
