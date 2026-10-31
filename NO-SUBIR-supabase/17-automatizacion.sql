-- =============================================================================
-- 17 · AUTOMATIZACIÓN: FLUJOS «SI PASA X, HAZ Y»
--
-- Requiere 10, 12, 13 y 16. Idempotente.
--
-- MODELO
--   aut_flujos       el flujo: un disparador (tipo + filtro) y una lista de
--                    pasos (enviar mensaje, etiquetar, esperar, crear tarea…)
--   aut_ejecuciones  cada contacto que entra en un flujo. Guarda una copia de
--                    los pasos del momento de entrar, por dónde va y cuándo
--                    toca el siguiente paso.
--   aut_registro     lo que hizo cada paso (para el historial)
--
-- MOTOR
--   · Los eventos del CRM (contacto creado, etiqueta añadida, cita reservada o
--     cancelada, mensaje recibido, oportunidad que cambia de etapa, factura
--     pagada) llaman a aut_disparar(), que inscribe al contacto en los flujos
--     publicados cuyo filtro coincide.
--   · El servidor (/api/cron/recordatorios, cada 5 minutos) toma las
--     ejecuciones pendientes con aut_tomar() y ejecuta sus pasos hasta llegar
--     a una espera o al final.
--   · Protección contra bucles: un contacto no entra dos veces a la vez en el
--     mismo flujo, ni más de 10 veces por hora.
-- =============================================================================

create table if not exists public.aut_flujos (
  id                uuid primary key default gen_random_uuid(),
  subcuenta_id      uuid not null references public.subcuentas(id) on delete cascade,
  nombre            text not null check (length(trim(nombre)) between 1 and 120),
  activo            boolean not null default false,
  disparador        text not null default 'contacto_creado' check (disparador in (
                      'contacto_creado', 'etiqueta_anadida', 'cita_reservada', 'cita_cancelada', 'cita_estado',
                      'mensaje_recibido', 'oportunidad_etapa', 'factura_pagada', 'manual')),
  filtro            jsonb not null default '{}'::jsonb check (jsonb_typeof(filtro) = 'object'),
  pasos             jsonb not null default '[]'::jsonb check (jsonb_typeof(pasos) = 'array' and jsonb_array_length(pasos) <= 50),
  permitir_reentrada boolean not null default false,
  creado_por        uuid default auth.uid() references auth.users(id) on delete set null,
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now(),
  unique (id, subcuenta_id)
);
create index if not exists aut_flujos_disparo_idx on public.aut_flujos(subcuenta_id, disparador) where activo;

create table if not exists public.aut_ejecuciones (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null,
  flujo_id     uuid not null,
  contacto_id  uuid not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'procesando', 'esperando', 'completada', 'terminada', 'error')),
  paso         int not null default 0,
  pasos        jsonb not null,
  datos        jsonb not null default '{}'::jsonb,
  siguiente_en timestamptz not null default now(),
  tomado_en    timestamptz,
  motivo       text not null default '',
  creado       timestamptz not null default now(),
  terminado    timestamptz,
  foreign key (flujo_id, subcuenta_id) references public.aut_flujos(id, subcuenta_id) on delete cascade,
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists aut_ejecuciones_cola_idx on public.aut_ejecuciones(siguiente_en) where estado in ('pendiente', 'esperando', 'procesando');
create index if not exists aut_ejecuciones_flujo_idx on public.aut_ejecuciones(flujo_id, creado desc);
create index if not exists aut_ejecuciones_contacto_idx on public.aut_ejecuciones(contacto_id, flujo_id);

create table if not exists public.aut_registro (
  id           bigint generated always as identity primary key,
  subcuenta_id uuid not null,
  ejecucion_id uuid not null references public.aut_ejecuciones(id) on delete cascade,
  paso         int not null,
  tipo         text not null,
  ok           boolean not null,
  detalle      text not null default '',
  ts           timestamptz not null default now()
);
create index if not exists aut_registro_ejec_idx on public.aut_registro(ejecucion_id, id);

drop trigger if exists aut_flujos_actualizado on public.aut_flujos;
create trigger aut_flujos_actualizado before update on public.aut_flujos
  for each row execute function public.toca_actualizado();

-- =============================================================================
-- RLS: el equipo ve todo; crear y cambiar flujos, solo administradores.
-- Ejecuciones y registro los escribe el motor (clave de servicio y funciones).
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['aut_flujos', 'aut_ejecuciones', 'aut_registro'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %1$s_lee on public.%1$s', t);
    execute format('create policy %1$s_lee on public.%1$s for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id))', t);
  end loop;
end $$;
drop policy if exists aut_flujos_admin on public.aut_flujos;
create policy aut_flujos_admin on public.aut_flujos for all to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
grant select, insert, update, delete on public.aut_flujos to authenticated;
grant select on public.aut_ejecuciones, public.aut_registro to authenticated;
-- Parar una ejecución en marcha (cualquiera del equipo).
drop policy if exists aut_ejecuciones_para on public.aut_ejecuciones;
create policy aut_ejecuciones_para on public.aut_ejecuciones for update to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id) and estado = 'terminada');
grant update (estado, motivo, terminado) on public.aut_ejecuciones to authenticated;

-- =============================================================================
-- INSCRIPCIÓN
-- =============================================================================

-- ¿Cumple el evento el filtro del flujo?
create or replace function public.aut_coincide(p_tipo text, p_filtro jsonb, p_datos jsonb)
returns boolean language sql immutable as $$
  select case p_tipo
    when 'etiqueta_anadida' then coalesce(p_filtro ->> 'etiqueta', '') in ('', p_datos ->> 'etiqueta')
    when 'cita_reservada' then coalesce(p_filtro ->> 'calendario_id', '') in ('', p_datos ->> 'calendario_id')
                            and (coalesce((p_filtro ->> 'solo_online')::boolean, false) = false or p_datos ->> 'origen' = 'reserva')
    when 'cita_cancelada' then coalesce(p_filtro ->> 'calendario_id', '') in ('', p_datos ->> 'calendario_id')
    when 'cita_estado' then coalesce(p_filtro ->> 'calendario_id', '') in ('', p_datos ->> 'calendario_id')
                         and coalesce(p_filtro ->> 'estado', '') in ('', p_datos ->> 'estado')
    when 'mensaje_recibido' then coalesce(p_filtro ->> 'canal', '') in ('', p_datos ->> 'canal')
                              and (coalesce(p_filtro ->> 'palabra', '') = ''
                                   or position(lower(p_filtro ->> 'palabra') in lower(coalesce(p_datos ->> 'texto', ''))) > 0)
    when 'oportunidad_etapa' then coalesce(p_filtro ->> 'embudo_id', '') in ('', p_datos ->> 'embudo_id')
                               and coalesce(p_filtro ->> 'etapa_id', '') in ('', p_datos ->> 'etapa_id')
    else true
  end;
$$;

-- Inscribe al contacto en los flujos publicados que escuchan este evento.
-- Devuelve cuántas ejecuciones nuevas creó.
create or replace function public.aut_disparar(p_subcuenta uuid, p_contacto uuid, p_tipo text, p_datos jsonb default '{}'::jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  f public.aut_flujos;
  v_n int := 0;
begin
  if p_contacto is null then return 0; end if;
  for f in select * from public.aut_flujos where subcuenta_id = p_subcuenta and activo and disparador = p_tipo loop
    continue when not public.aut_coincide(p_tipo, f.filtro, p_datos);
    continue when jsonb_array_length(f.pasos) = 0;
    -- Ya está dentro (sin reentrada) o demasiadas veces en la última hora.
    continue when not f.permitir_reentrada and exists (
      select 1 from public.aut_ejecuciones e where e.flujo_id = f.id and e.contacto_id = p_contacto
        and e.estado in ('pendiente', 'procesando', 'esperando'));
    continue when (select count(*) from public.aut_ejecuciones e where e.flujo_id = f.id and e.contacto_id = p_contacto
                   and e.creado > now() - interval '1 hour') >= 10;
    insert into public.aut_ejecuciones (subcuenta_id, flujo_id, contacto_id, pasos, datos)
    values (p_subcuenta, f.id, p_contacto, f.pasos, coalesce(p_datos, '{}'::jsonb) || jsonb_build_object('evento', p_tipo));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Inscripción a mano («Probar» o «Añadir al flujo»): cualquiera del equipo,
-- aunque el flujo esté en borrador.
create or replace function public.aut_inscribir(p_flujo uuid, p_contacto uuid)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  f public.aut_flujos;
  v uuid;
begin
  select * into f from public.aut_flujos where id = p_flujo;
  if not found or not public.puedo_ver_subcuenta(f.subcuenta_id) then
    raise exception 'No tienes acceso a este flujo.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_array_length(f.pasos) = 0 then
    raise exception 'El flujo no tiene pasos.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.crm_contactos where id = p_contacto and subcuenta_id = f.subcuenta_id) then
    raise exception 'El contacto no es de esta subcuenta.' using errcode = 'check_violation';
  end if;
  insert into public.aut_ejecuciones (subcuenta_id, flujo_id, contacto_id, pasos, datos)
  values (f.subcuenta_id, f.id, p_contacto, f.pasos, jsonb_build_object('evento', 'manual', 'por', auth.uid()))
  returning id into v;
  return v;
end $$;

-- El servidor toma las ejecuciones que tocan ahora.
create or replace function public.aut_tomar(p_limite int default 50, p_solo uuid default null)
returns setof public.aut_ejecuciones language plpgsql volatile security definer set search_path = public as $$
begin
  return query
  with elegidas as (
    select e.id from public.aut_ejecuciones e
    where (p_solo is null or e.id = p_solo)
      and ((e.estado in ('pendiente', 'esperando') and e.siguiente_en <= now())
           or (e.estado = 'procesando' and e.tomado_en < now() - interval '10 minutes'))
    order by e.siguiente_en
    limit least(greatest(p_limite, 1), 200)
    for update skip locked
  )
  update public.aut_ejecuciones e set estado = 'procesando', tomado_en = now()
  from elegidas x where e.id = x.id
  returning e.*;
end $$;

revoke all on function public.aut_disparar(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.aut_inscribir(uuid, uuid) from public, anon;
revoke all on function public.aut_tomar(int, uuid) from public, anon, authenticated;
grant execute on function public.aut_disparar(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.aut_inscribir(uuid, uuid) to authenticated;
grant execute on function public.aut_tomar(int, uuid) to service_role;

-- =============================================================================
-- EVENTOS DEL CRM → aut_disparar
-- =============================================================================
create or replace function public.aut_evento_contacto()
returns trigger language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if tg_op = 'INSERT' then
    perform public.aut_disparar(new.subcuenta_id, new.id, 'contacto_creado', jsonb_build_object('fuente', new.fuente));
    foreach v in array new.etiquetas loop
      perform public.aut_disparar(new.subcuenta_id, new.id, 'etiqueta_anadida', jsonb_build_object('etiqueta', v));
    end loop;
  elsif new.etiquetas is distinct from old.etiquetas then
    for v in select e from unnest(new.etiquetas) e where not e = any(old.etiquetas) loop
      perform public.aut_disparar(new.subcuenta_id, new.id, 'etiqueta_anadida', jsonb_build_object('etiqueta', v));
    end loop;
  end if;
  return null;
end $$;
drop trigger if exists crm_contactos_automatizacion on public.crm_contactos;
create trigger crm_contactos_automatizacion after insert or update of etiquetas on public.crm_contactos
  for each row execute function public.aut_evento_contacto();

create or replace function public.aut_evento_cita()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_datos jsonb;
  v_tz text;
begin
  if new.contacto_id is null then return null; end if;
  select zona_horaria into v_tz from public.cal_calendarios where id = new.calendario_id;
  v_datos := jsonb_build_object('cita_id', new.id, 'calendario_id', new.calendario_id, 'origen', new.origen, 'estado', new.estado,
    'inicio', new.inicio, 'titulo', new.titulo, 'zona', v_tz);
  if tg_op = 'INSERT' and new.estado <> 'cancelada' then
    perform public.aut_disparar(new.subcuenta_id, new.contacto_id, 'cita_reservada', v_datos);
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    if new.estado = 'cancelada' then
      perform public.aut_disparar(new.subcuenta_id, new.contacto_id, 'cita_cancelada', v_datos);
    else
      perform public.aut_disparar(new.subcuenta_id, new.contacto_id, 'cita_estado', v_datos);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists cal_citas_automatizacion on public.cal_citas;
create trigger cal_citas_automatizacion after insert or update of estado on public.cal_citas
  for each row execute function public.aut_evento_cita();

create or replace function public.aut_evento_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_contacto uuid;
begin
  if new.direccion <> 'entrante' then return null; end if;
  select contacto_id into v_contacto from public.conv_conversaciones where id = new.conversacion_id;
  perform public.aut_disparar(new.subcuenta_id, v_contacto, 'mensaje_recibido',
    jsonb_build_object('canal', new.canal, 'texto', left(new.cuerpo, 2000), 'asunto', new.asunto));
  return null;
end $$;
drop trigger if exists conv_mensajes_automatizacion on public.conv_mensajes;
create trigger conv_mensajes_automatizacion after insert on public.conv_mensajes
  for each row execute function public.aut_evento_mensaje();

create or replace function public.aut_evento_oportunidad()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    perform public.aut_disparar(new.subcuenta_id, new.contacto_id, 'oportunidad_etapa',
      jsonb_build_object('oportunidad_id', new.id, 'embudo_id', new.embudo_id, 'etapa_id', new.etapa_id, 'nombre', new.nombre, 'valor', new.valor));
  end if;
  return null;
end $$;
drop trigger if exists crm_oportunidades_automatizacion on public.crm_oportunidades;
create trigger crm_oportunidades_automatizacion after insert or update of etapa_id on public.crm_oportunidades
  for each row execute function public.aut_evento_oportunidad();

create or replace function public.aut_evento_factura()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'pagada' and old.estado is distinct from 'pagada' and new.contacto_id is not null then
    perform public.aut_disparar(new.subcuenta_id, new.contacto_id, 'factura_pagada',
      jsonb_build_object('factura_id', new.id, 'numero', new.numero, 'total', new.total, 'moneda', new.moneda));
  end if;
  return null;
end $$;
drop trigger if exists pag_facturas_automatizacion on public.pag_facturas;
create trigger pag_facturas_automatizacion after update of estado on public.pag_facturas
  for each row execute function public.aut_evento_factura();
