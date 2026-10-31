-- =============================================================================
-- 18 · CORRECCIONES DE LA AUDITORÍA DE SEGURIDAD Y CORRECCIÓN
--
-- Requiere del 09 al 17. Idempotente: se puede volver a ejecutar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Banderas internas que nadie puede falsificar
--    Antes se usaban variables de sesión (set_config), que cualquier rol puede
--    fijar. Ahora las funciones de confianza apuntan la transacción en una
--    tabla privada (sin permisos para nadie más) y la borran al terminar.
-- -----------------------------------------------------------------------------
create table if not exists public.banderas_internas (
  txid   bigint not null,
  nombre text not null,
  primary key (txid, nombre)
);
alter table public.banderas_internas enable row level security;
revoke all on public.banderas_internas from public, anon, authenticated;

create or replace function public.bandera_activa(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.banderas_internas where txid = txid_current() and nombre = p_nombre)
$$;
revoke all on function public.bandera_activa(text) from public, anon, authenticated;

create or replace function public.protege_subcuenta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.agencia_id is distinct from old.agencia_id then
    raise exception 'Una subcuenta no se puede mover a otra agencia.'
      using errcode = 'check_violation', hint = 'SUBCUENTA_AGENCIA_FIJA';
  end if;
  if (new.estado is distinct from old.estado or new.etapa is distinct from old.etapa
      or new.ultimo_acceso is distinct from old.ultimo_acceso)
     and auth.uid() is not null
     and not public.soy_admin_agencia(old.agencia_id)
     and not (public.bandera_activa('registrando_acceso')
              and (to_jsonb(new) - 'ultimo_acceso' - 'actualizado') = (to_jsonb(old) - 'ultimo_acceso' - 'actualizado')) then
    raise exception 'Solo la agencia cambia el estado o la etapa de una subcuenta.'
      using errcode = 'insufficient_privilege', hint = 'SUBCUENTA_SOLO_AGENCIA';
  end if;
  return new;
end $$;

create or replace function public.protege_miembros_agencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_agencia uuid := coalesce(new.agencia_id, old.agencia_id);
  v_soy_prop boolean := public.rol_en_agencia(v_agencia) = 'propietario';
begin
  if auth.uid() is null or public.bandera_activa('creando_agencia') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.agencias where id = v_agencia) then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.usuario_id = auth.uid() and new.rol is distinct from old.rol then
    raise exception 'No puedes cambiar tu propio rol.' using errcode = 'insufficient_privilege', hint = 'AUTOESCALADA';
  end if;
  if (tg_op in ('INSERT', 'UPDATE') and new.rol = 'propietario'
      or tg_op in ('UPDATE', 'DELETE') and old.rol = 'propietario')
     and not v_soy_prop then
    raise exception 'Solo un propietario puede nombrar o retirar propietarios.'
      using errcode = 'insufficient_privilege', hint = 'SOLO_PROPIETARIO';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.rol = 'propietario'
     and (tg_op = 'DELETE' or new.rol <> 'propietario')
     and not exists (select 1 from public.agencia_miembros
                     where agencia_id = v_agencia and rol = 'propietario' and usuario_id <> old.usuario_id) then
    raise exception 'La agencia tiene que conservar al menos un propietario.'
      using errcode = 'check_violation', hint = 'ULTIMO_PROPIETARIO';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.crear_agencia(p_nombre text, p_moneda text default 'EUR',
                                                p_zona_horaria text default 'Europe/Madrid')
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.banderas_internas values (txid_current(), 'creando_agencia') on conflict do nothing;
  insert into public.agencias (nombre, moneda, zona_horaria, creado_por)
  values (trim(p_nombre), upper(coalesce(nullif(trim(p_moneda), ''), 'EUR')),
          coalesce(nullif(trim(p_zona_horaria), ''), 'Europe/Madrid'), auth.uid())
  returning id into v_id;
  insert into public.agencia_miembros (agencia_id, usuario_id, rol) values (v_id, auth.uid(), 'propietario');
  delete from public.banderas_internas where txid = txid_current() and nombre = 'creando_agencia';
  return v_id;
end $$;

create or replace function public.registrar_acceso_subcuenta(p_subcuenta uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.banderas_internas values (txid_current(), 'registrando_acceso') on conflict do nothing;
  update public.subcuentas set ultimo_acceso = now() where id = p_subcuenta;
  delete from public.banderas_internas where txid = txid_current() and nombre = 'registrando_acceso';
end $$;

-- -----------------------------------------------------------------------------
-- 2. Zonas horarias válidas en agencias y subcuentas
-- -----------------------------------------------------------------------------
create or replace function public.valida_zona_horaria()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.zona_horaria) then
    raise exception 'Zona horaria no válida: %', new.zona_horaria using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists agencias_zona on public.agencias;
create trigger agencias_zona before insert or update of zona_horaria on public.agencias
  for each row execute function public.valida_zona_horaria();
drop trigger if exists subcuentas_zona on public.subcuentas;
create trigger subcuentas_zona before insert or update of zona_horaria on public.subcuentas
  for each row execute function public.valida_zona_horaria();

-- -----------------------------------------------------------------------------
-- 3. Notificaciones: el destinatario tiene que pertenecer a la subcuenta o agencia
-- -----------------------------------------------------------------------------
create or replace function public.valida_notificacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.subcuenta_id is not null and not public.usuario_ve_subcuenta(new.usuario_id, new.subcuenta_id) then
    raise exception 'El destinatario no tiene acceso a esa subcuenta.' using errcode = 'check_violation';
  end if;
  if new.subcuenta_id is null and new.agencia_id is not null
     and not exists (select 1 from public.agencia_miembros where agencia_id = new.agencia_id and usuario_id = new.usuario_id) then
    raise exception 'El destinatario no pertenece a esa agencia.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists notificaciones_valida on public.notificaciones;
create trigger notificaciones_valida before insert on public.notificaciones
  for each row execute function public.valida_notificacion();

-- usuario_ve_subcuenta solo la usan funciones internas y el servidor.
revoke all on function public.usuario_ve_subcuenta(uuid, uuid) from public, anon, authenticated;
grant execute on function public.usuario_ve_subcuenta(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Columnas que el equipo no debe poder cambiar
-- -----------------------------------------------------------------------------
revoke update on public.cal_bloqueos from authenticated;
grant update (calendario_id, usuario_id, titulo, inicio, fin, todo_el_dia) on public.cal_bloqueos to authenticated;
revoke update on public.crm_notas from authenticated;
grant update (cuerpo) on public.crm_notas to authenticated;
revoke update on public.pag_lineas from authenticated;
grant update (producto_id, descripcion, cantidad, precio, impuesto, orden) on public.pag_lineas to authenticated;
-- Re-ejecutar el 12 después del 14 retiraba este permiso.
grant insert (avisar), update (avisar) on public.cal_citas to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Pagos: carreras, facturas cerradas, moneda y productos de otra subcuenta
-- -----------------------------------------------------------------------------
create or replace function public.pag_recalcular()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_factura uuid;
  v_estado text;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return null; end if;
  -- Solo cambia el producto (p. ej. al borrar el producto): no toca importes.
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'producto_id') = (to_jsonb(old) - 'producto_id') then return null; end if;
  for v_factura in select distinct x from unnest(array[case when tg_op <> 'INSERT' then old.factura_id end,
                                                        case when tg_op <> 'DELETE' then new.factura_id end]) x where x is not null loop
    -- Bloquea la factura antes de sumar: dos cambios a la vez no se pisan.
    select estado into v_estado from public.pag_facturas where id = v_factura for update;
    if v_estado in ('pagada', 'anulada') then
      raise exception 'No se pueden cambiar las líneas de una factura %.', v_estado using errcode = 'check_violation';
    end if;
    update public.pag_facturas f set
      subtotal = coalesce(s.sub, 0), impuestos = coalesce(s.imp, 0), total = coalesce(s.sub, 0) + coalesce(s.imp, 0)
    from (select round(sum(cantidad * precio), 2) as sub, round(sum(round(cantidad * precio * impuesto / 100, 2)), 2) as imp
          from public.pag_lineas where factura_id = v_factura) s
    where f.id = v_factura;
    update public.pag_facturas set estado = 'pagada'
    where id = v_factura and estado = 'enviada' and total > 0 and cobrado >= total;
  end loop;
  return null;
end $$;

create or replace function public.pag_aplicar_cobro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f public.pag_facturas;
  v_factura uuid;
begin
  for v_factura in select distinct x from unnest(array[case when tg_op <> 'INSERT' then old.factura_id end,
                                                        case when tg_op <> 'DELETE' then new.factura_id end]) x where x is not null loop
    perform 1 from public.pag_facturas where id = v_factura for update;
    update public.pag_facturas x set cobrado = coalesce((select sum(importe) from public.pag_transacciones
                                                         where factura_id = v_factura and estado = 'completada'), 0)
    where x.id = v_factura returning * into f;
    if f.estado in ('borrador', 'enviada') and f.total > 0 and f.cobrado >= f.total then
      update public.pag_facturas set estado = 'pagada' where id = f.id;
      if f.contacto_id is not null then
        insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle, actor_id)
        values (f.subcuenta_id, f.contacto_id, 'factura_pagada',
                jsonb_build_object('factura_id', f.id, 'numero', f.numero, 'total', f.total, 'moneda', f.moneda), auth.uid());
      end if;
      if f.creado_por is not null and f.creado_por is distinct from auth.uid() then
        insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
        select f.creado_por, s.agencia_id, s.id, 'alerta', 'Pagos', 'Factura pagada: ' || f.numero,
               to_char(f.total, 'FM999G999G990D00') || ' ' || f.moneda, '/subcuenta/' || s.id || '/pagos/facturas/' || f.id
        from public.subcuentas s where s.id = f.subcuenta_id and public.usuario_ve_subcuenta(f.creado_por, s.id);
      end if;
    elsif f.estado = 'pagada' and f.cobrado < f.total then
      update public.pag_facturas set estado = 'enviada', pagada_en = null where id = f.id;
    end if;
  end loop;
  return null;
end $$;

-- Factura pagada o anulada: sus datos ya no cambian.
create or replace function public.pag_factura_cerrada()
returns trigger language plpgsql as $$
begin
  if old.estado in ('pagada', 'anulada')
     and (new.contacto_id, new.emision, new.vencimiento, new.notas) is distinct from (old.contacto_id, old.emision, old.vencimiento, old.notas) then
    raise exception 'La factura está % y ya no se puede modificar.', old.estado using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists pag_facturas_cerrada on public.pag_facturas;
create trigger pag_facturas_cerrada before update on public.pag_facturas
  for each row execute function public.pag_factura_cerrada();

-- Solo se borran borradores que nunca se enviaron.
drop policy if exists pag_facturas_borra on public.pag_facturas;
create policy pag_facturas_borra on public.pag_facturas as restrictive for delete to authenticated
  using (estado = 'borrador' and enviada_en is null);

-- El cobro tiene que ir en la moneda de la factura.
create or replace function public.pag_cobro_moneda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.factura_id is not null and new.moneda <> (select moneda from public.pag_facturas where id = new.factura_id) then
    raise exception 'El cobro tiene que ir en la moneda de la factura.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists pag_transacciones_moneda on public.pag_transacciones;
create trigger pag_transacciones_moneda before insert or update of moneda, factura_id on public.pag_transacciones
  for each row execute function public.pag_cobro_moneda();

-- El producto de una línea tiene que ser de la misma subcuenta.
do $$ begin
  alter table public.pag_productos add constraint pag_productos_id_sub_key unique (id, subcuenta_id);
exception when duplicate_table or duplicate_object then null; end $$;
alter table public.pag_lineas drop constraint if exists pag_lineas_producto_id_fkey;
do $$ begin
  alter table public.pag_lineas add constraint pag_lineas_producto_sub_fkey foreign key (producto_id, subcuenta_id)
    references public.pag_productos(id, subcuenta_id) on delete set null (producto_id);
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 6. Calendarios: equipo sin acceso y abuso de la reserva pública
-- -----------------------------------------------------------------------------
-- Quien ya no tiene acceso a la subcuenta sale de los equipos de sus calendarios.
create or replace function public.cal_limpiar_equipos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.cal_calendarios c set equipo = array_remove(equipo, old.usuario_id)
  where old.usuario_id = any(equipo) and not public.usuario_ve_subcuenta(old.usuario_id, c.subcuenta_id);
  return null;
end $$;
drop trigger if exists subcuenta_miembros_limpia_cal on public.subcuenta_miembros;
create trigger subcuenta_miembros_limpia_cal after delete on public.subcuenta_miembros
  for each row execute function public.cal_limpiar_equipos();
drop trigger if exists agencia_miembros_limpia_cal on public.agencia_miembros;
create trigger agencia_miembros_limpia_cal after delete or update of rol on public.agencia_miembros
  for each row execute function public.cal_limpiar_equipos();

-- Y, por si acaso, los huecos solo cuentan con personas con acceso.
create or replace function public.cal_huecos_nucleo(p_cal uuid, p_desde date, p_hasta date, p_publico boolean)
returns table (inicio timestamptz, usuarios uuid[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  c public.cal_calendarios;
  v_hoy date;
  v_ini date;
  v_fin date;
  v_minimo timestamptz;
  v_equipo uuid[];
begin
  select * into c from public.cal_calendarios where id = p_cal;
  if not found then return; end if;
  v_hoy := (now() at time zone c.zona_horaria)::date;
  v_ini := greatest(p_desde, v_hoy);
  v_fin := least(p_hasta, v_ini + 61);
  if p_publico then v_fin := least(v_fin, v_hoy + c.dias_reserva); end if;
  if v_fin < v_ini then return; end if;
  v_minimo := now() + case when p_publico then make_interval(mins => c.antelacion_min) else interval '0' end;
  select coalesce(array_agg(u), '{}') into v_equipo from unnest(c.equipo) u where public.usuario_ve_subcuenta(u, c.subcuenta_id);
  if cardinality(c.equipo) > 0 and cardinality(v_equipo) = 0 then return; end if;

  return query
  with dias as (
    select d::date as dia from generate_series(v_ini::timestamp, v_fin::timestamp, interval '1 day') d
  ), franjas as (
    select (dd.dia + h.inicio) at time zone c.zona_horaria as f_ini, (dd.dia + h.fin) at time zone c.zona_horaria as f_fin
    from dias dd join public.cal_horarios h on h.calendario_id = c.id and h.dia = extract(dow from dd.dia)
  ), candidatos as (
    select distinct g as ini
    from franjas f, generate_series(f.f_ini, f.f_fin - make_interval(mins => c.duracion_min), make_interval(mins => c.intervalo_min)) g
    where g >= v_minimo
  ), equipo as (
    select u from unnest(case when cardinality(v_equipo) = 0 then array[null::uuid] else v_equipo end) u
  )
  select k.ini, array_agg(e.u) filter (where e.u is not null)
  from candidatos k cross join equipo e
  where public.cal_libre(c.id, e.u, k.ini, k.ini + make_interval(mins => c.duracion_min))
  group by k.ini
  order by k.ini;
end $$;
revoke all on function public.cal_huecos_nucleo(uuid, date, date, boolean) from public, anon, authenticated;

-- Límite de reservas online por calendario (frena el envío masivo de SMS y
-- la creación de contactos falsos). El servidor añade además un límite por IP.
create or replace function public.cal_limite_reservas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origen = 'reserva' and (select count(*) from public.cal_citas
      where calendario_id = new.calendario_id and origen = 'reserva' and creado > now() - interval '1 hour') >= 30 then
    raise exception 'Hay demasiadas reservas en este momento. Inténtalo dentro de un rato.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists cal_citas_limite_reservas on public.cal_citas;
create trigger cal_citas_limite_reservas before insert on public.cal_citas
  for each row execute function public.cal_limite_reservas();

-- Avisos que agotaron sus intentos: pasan a fallido en vez de quedarse colgados.
create or replace function public.cal_tomar_avisos(p_limite int default 50)
returns table (aviso_id uuid, subcuenta_id uuid, cita_id uuid, tipo text, canal text)
language plpgsql volatile security definer set search_path = public as $$
begin
  update public.cal_avisos a set estado = 'fallido', error = 'El envío no se completó tras 3 intentos.'
  where a.estado = 'procesando' and a.intentos >= 3 and a.tomado_en < now() - interval '10 minutes';
  return query
  with elegidos as (
    select a.id from public.cal_avisos a
    where (a.estado = 'pendiente' and a.enviar_en <= now())
       or (a.estado = 'procesando' and a.tomado_en < now() - interval '10 minutes' and a.intentos < 3)
    order by a.enviar_en
    limit least(greatest(p_limite, 1), 200)
    for update skip locked
  )
  update public.cal_avisos a set estado = 'procesando', tomado_en = now(), intentos = a.intentos + 1
  from elegidos e where a.id = e.id
  returning a.id, a.subcuenta_id, a.cita_id, a.tipo, a.canal;
end $$;
revoke all on function public.cal_tomar_avisos(int) from public, anon, authenticated;
grant execute on function public.cal_tomar_avisos(int) to service_role;

-- Editar una cita sin cambiar hora ni estado ya no borra la confirmación o la
-- cancelación pendientes.
create or replace function public.cal_programar_avisos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.cal_calendarios;
  v_tipo text;
  v_canal text;
  v_min int;
begin
  if tg_op = 'UPDATE' and new.inicio is not distinct from old.inicio and new.estado is not distinct from old.estado
     and new.contacto_id is not distinct from old.contacto_id and new.calendario_id is not distinct from old.calendario_id
     and new.avisar is not distinct from old.avisar then
    return null;
  end if;
  if tg_op = 'INSERT' then
    v_tipo := 'confirmacion';
  elsif new.estado = 'cancelada' and old.estado <> 'cancelada' then
    v_tipo := 'cancelacion';
  elsif new.estado <> 'cancelada' and new.inicio is distinct from old.inicio then
    v_tipo := 'cambio';
  end if;
  -- Los recordatorios se rehacen siempre; los demás avisos pendientes solo si hay uno nuevo que los sustituye.
  delete from public.cal_avisos where cita_id = new.id and estado in ('pendiente', 'procesando')
    and (tipo = 'recordatorio' or v_tipo is not null or not new.avisar or new.contacto_id is null);
  if new.contacto_id is null or not new.avisar then return null; end if;
  select * into c from public.cal_calendarios where id = new.calendario_id;
  if v_tipo = 'confirmacion' and (new.estado = 'cancelada' or not c.aviso_confirmacion) then v_tipo := null; end if;
  if new.inicio <= now() then return null; end if;

  foreach v_canal in array c.avisos_canales loop
    if v_tipo is not null then
      insert into public.cal_avisos (subcuenta_id, cita_id, tipo, canal, enviar_en) values (new.subcuenta_id, new.id, v_tipo, v_canal, now());
    end if;
    if new.estado in ('nueva', 'confirmada') then
      foreach v_min in array c.recordatorios loop
        if new.inicio - make_interval(mins => v_min) > now() + interval '5 minutes' then
          insert into public.cal_avisos (subcuenta_id, cita_id, tipo, canal, enviar_en)
          values (new.subcuenta_id, new.id, 'recordatorio', v_canal, new.inicio - make_interval(mins => v_min));
        end if;
      end loop;
    end if;
  end loop;
  return null;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Automatización: bucles entre flujos y renombrado de etiquetas
-- -----------------------------------------------------------------------------
create or replace function public.aut_disparar(p_subcuenta uuid, p_contacto uuid, p_tipo text, p_datos jsonb default '{}'::jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  f public.aut_flujos;
  v_n int := 0;
begin
  if p_contacto is null or public.bandera_activa('sin_automatizacion') then return 0; end if;
  -- Tope global por contacto: corta bucles entre varios flujos (A → B → A…).
  if (select count(*) from public.aut_ejecuciones where contacto_id = p_contacto and creado > now() - interval '24 hours') >= 30 then
    return 0;
  end if;
  -- Serializa las inscripciones de este contacto (dos eventos a la vez no lo inscriben dos veces).
  perform pg_advisory_xact_lock(hashtextextended('aut:' || p_contacto::text, 0));
  for f in select * from public.aut_flujos where subcuenta_id = p_subcuenta and activo and disparador = p_tipo loop
    continue when not public.aut_coincide(p_tipo, f.filtro, p_datos);
    continue when jsonb_array_length(f.pasos) = 0;
    continue when not f.permitir_reentrada and exists (
      select 1 from public.aut_ejecuciones e where e.flujo_id = f.id and e.contacto_id = p_contacto
        and e.estado in ('pendiente', 'procesando', 'esperando'));
    continue when (select count(*) from public.aut_ejecuciones e where e.flujo_id = f.id and e.contacto_id = p_contacto
                   and e.creado > now() - interval '24 hours') >= 10;
    insert into public.aut_ejecuciones (subcuenta_id, flujo_id, contacto_id, pasos, datos)
    values (p_subcuenta, f.id, p_contacto, f.pasos, coalesce(p_datos, '{}'::jsonb) || jsonb_build_object('evento', p_tipo));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.aut_disparar(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.aut_disparar(uuid, uuid, text, jsonb) to service_role;

-- Renombrar una etiqueta no es «añadir» una etiqueta: no dispara flujos.
create or replace function public.crm_renombrar_etiqueta(p_subcuenta uuid, p_antes text, p_despues text)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int; v_nueva text := left(regexp_replace(trim(p_despues), '\s+', ' ', 'g'), 60);
begin
  if not public.soy_admin_subcuenta(p_subcuenta) then
    raise exception 'Solo un administrador puede renombrar etiquetas.' using errcode = 'insufficient_privilege';
  end if;
  if v_nueva = '' then raise exception 'La etiqueta no puede quedar vacía.' using errcode = 'check_violation'; end if;
  if v_nueva = p_antes then return 0; end if;
  insert into public.banderas_internas values (txid_current(), 'sin_automatizacion') on conflict do nothing;
  update public.crm_contactos
  set etiquetas = array_append(array_remove(etiquetas, p_antes), v_nueva)
  where subcuenta_id = p_subcuenta and p_antes = any(etiquetas);
  get diagnostics v_n = row_count;
  delete from public.banderas_internas where txid = txid_current() and nombre = 'sin_automatizacion';
  insert into public.crm_etiquetas (subcuenta_id, nombre, descripcion, categoria)
  select subcuenta_id, v_nueva, descripcion, categoria from public.crm_etiquetas
  where subcuenta_id = p_subcuenta and nombre = p_antes
  on conflict (subcuenta_id, nombre) do update set descripcion = excluded.descripcion, categoria = excluded.categoria;
  delete from public.crm_etiquetas where subcuenta_id = p_subcuenta and nombre = p_antes;
  return v_n;
end $$;

-- -----------------------------------------------------------------------------
-- 8. SSO: decidir por cómo se abrió la sesión (claim «amr»), también al renovarla
-- -----------------------------------------------------------------------------
create or replace function public.sso_hook_token(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_email text;
  v_metodos text[];
begin
  select coalesce(array_agg(m ->> 'method'), '{}') into v_metodos
  from jsonb_array_elements(coalesce(event -> 'claims' -> 'amr', '[]'::jsonb)) m;
  if v_metodos && array['sso/saml', 'oauth'] then
    return jsonb_build_object('claims', event -> 'claims');
  end if;
  select email into v_email from auth.users where id = (event ->> 'user_id')::uuid;
  if exists (select 1 from public.sso_dominios d join public.agencias a on a.id = d.agencia_id
             where a.sso_activo and a.sso_obligatorio and d.verificado and d.dominio = lower(split_part(v_email, '@', 2))) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Tu empresa exige entrar con inicio de sesión único (SSO).'));
  end if;
  return jsonb_build_object('claims', event -> 'claims');
end $$;
revoke all on function public.sso_hook_token(jsonb) from public, anon, authenticated;
do $$ begin grant execute on function public.sso_hook_token(jsonb) to supabase_auth_admin; exception when undefined_object then null; end $$;
