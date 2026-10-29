-- =============================================================================
-- 09 · AGENCIAS Y SUBCUENTAS (base multi-tenant de la plataforma Next.js)
--
-- CÓMO SE EJECUTA
--   Panel de Supabase → SQL Editor → New query → pegar todo → Run.
--   Idempotente: se puede volver a lanzar. No depende de los guiones 01–08:
--   la plataforma nueva usa auth.users directamente.
--
-- MODELO
--   agencias            · el inquilino de primer nivel (tu agencia)
--   agencia_miembros    · usuarios de la agencia: propietario / admin / usuario
--   subcuentas          · cada negocio cliente (la "location" de HighLevel)
--   subcuenta_miembros  · usuarios con acceso a una subcuenta: admin / usuario
--   subcuenta_fijadas   · subcuentas fijadas en el selector, por usuario
--   suscripciones       · plan mensual de cada subcuenta (alimenta el MRR)
--   pagos               · cobros registrados (manuales o desde Stripe)
--   actividad           · registro de solo-añadir de lo que pasa en la agencia
--
-- AISLAMIENTO
--   Propietario y admin de agencia ven todas las subcuentas de SU agencia.
--   Un usuario de agencia o de subcuenta solo ve las subcuentas a las que se
--   le ha dado acceso en subcuenta_miembros. Todo lo filtra RLS en la base de
--   datos, no la aplicación. Las tablas de módulos futuros (contactos,
--   oportunidades, conversaciones…) colgarán de subcuenta_id y usarán
--   public.puedo_ver_subcuenta() en sus políticas.
-- =============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- =============================================================================
-- 1 · TIPOS
-- =============================================================================
do $$ begin
  create type public.rol_agencia as enum ('propietario', 'admin', 'usuario');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rol_subcuenta as enum ('admin', 'usuario');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_subcuenta as enum ('activa', 'suspendida');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 2 · TABLAS
-- =============================================================================
create table if not exists public.agencias (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(trim(nombre)) between 2 and 120),
  email        text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono     text not null default '',
  web          text not null default '',
  logo_url     text,
  moneda       text not null default 'EUR' check (moneda ~ '^[A-Z]{3}$'),
  zona_horaria text not null default 'Europe/Madrid',
  creado_por   uuid references auth.users(id) on delete set null,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);

create table if not exists public.agencia_miembros (
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol        public.rol_agencia not null default 'usuario',
  creado     timestamptz not null default now(),
  primary key (agencia_id, usuario_id)
);
create index if not exists agencia_miembros_usuario_idx on public.agencia_miembros(usuario_id);

create table if not exists public.subcuentas (
  id            uuid primary key default gen_random_uuid(),
  agencia_id    uuid not null references public.agencias(id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) between 2 and 120),
  email         text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  prefijo       text not null default '+34' check (prefijo ~ '^\+\d{1,4}$'),
  telefono      text not null default '' check (telefono ~ '^[0-9 ]{0,20}$'),
  direccion     text not null default '',
  ciudad        text not null default '',
  provincia     text not null default '',
  codigo_postal text not null default '',
  pais          text not null default 'ES' check (pais ~ '^[A-Z]{2}$'),
  web           text not null default '',
  zona_horaria  text not null default 'Europe/Madrid',
  logo_url      text,
  etapa         text not null default 'Cerrado (Ganado)'
                check (etapa in ('Prospecto', 'Prueba', 'Cerrado (Ganado)', 'Cancelado')),
  estado        public.estado_subcuenta not null default 'activa',
  ultimo_acceso timestamptz,
  creado_por    uuid references auth.users(id) on delete set null,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);
create index if not exists subcuentas_agencia_idx on public.subcuentas(agencia_id);
create index if not exists subcuentas_nombre_idx  on public.subcuentas(agencia_id, lower(nombre));

create table if not exists public.subcuenta_miembros (
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  rol          public.rol_subcuenta not null default 'usuario',
  creado       timestamptz not null default now(),
  primary key (subcuenta_id, usuario_id)
);
create index if not exists subcuenta_miembros_usuario_idx on public.subcuenta_miembros(usuario_id);

create table if not exists public.subcuenta_fijadas (
  usuario_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  creado       timestamptz not null default now(),
  primary key (usuario_id, subcuenta_id)
);

create table if not exists public.suscripciones (
  id                     uuid primary key default gen_random_uuid(),
  agencia_id             uuid not null references public.agencias(id) on delete cascade,
  subcuenta_id           uuid not null unique references public.subcuentas(id) on delete cascade,
  plan                   text not null default 'Plan mensual' check (length(trim(plan)) between 1 and 80),
  importe_mensual        numeric(12,2) not null default 0 check (importe_mensual >= 0),
  estado                 text not null default 'activa'
                         check (estado in ('activa', 'prueba', 'impagada', 'cancelada')),
  inicio                 date not null default current_date,
  cancelada_en           date,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  creado                 timestamptz not null default now(),
  actualizado            timestamptz not null default now()
);
create index if not exists suscripciones_agencia_idx on public.suscripciones(agencia_id);

create table if not exists public.pagos (
  id                 uuid primary key default gen_random_uuid(),
  agencia_id         uuid not null references public.agencias(id) on delete cascade,
  subcuenta_id       uuid references public.subcuentas(id) on delete set null,
  importe            numeric(12,2) not null check (importe <> 0),
  concepto           text not null default 'Suscripción' check (length(trim(concepto)) between 1 and 120),
  fecha              timestamptz not null default now(),
  origen             text not null default 'manual' check (origen in ('manual', 'stripe')),
  referencia_externa text unique,
  creado_por         uuid references auth.users(id) on delete set null,
  creado             timestamptz not null default now()
);
create index if not exists pagos_agencia_fecha_idx on public.pagos(agencia_id, fecha desc);

create table if not exists public.actividad (
  id           bigint generated always as identity primary key,
  agencia_id   uuid not null references public.agencias(id) on delete cascade,
  subcuenta_id uuid,
  actor_id     uuid references auth.users(id) on delete set null,
  accion       text not null,
  detalle      jsonb not null default '{}'::jsonb,
  ts           timestamptz not null default now()
);
create index if not exists actividad_agencia_ts_idx on public.actividad(agencia_id, ts desc);

-- =============================================================================
-- 3 · AYUDANTES DE SEGURIDAD
-- SECURITY DEFINER para leer membresías desde las políticas sin recursión de
-- RLS. search_path fijado para que nadie pueda suplantarlas con otro esquema.
-- =============================================================================
create or replace function public.rol_en_agencia(p_agencia uuid)
returns public.rol_agencia language sql stable security definer set search_path = public as $$
  select rol from public.agencia_miembros
  where agencia_id = p_agencia and usuario_id = auth.uid();
$$;

create or replace function public.es_miembro_agencia(p_agencia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agencia_miembros
                 where agencia_id = p_agencia and usuario_id = auth.uid());
$$;

create or replace function public.soy_admin_agencia(p_agencia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agencia_miembros
                 where agencia_id = p_agencia and usuario_id = auth.uid()
                   and rol in ('propietario', 'admin'));
$$;

create or replace function public.puedo_ver_subcuenta(p_subcuenta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subcuentas s
    join public.agencia_miembros am on am.agencia_id = s.agencia_id
    where s.id = p_subcuenta and am.usuario_id = auth.uid() and am.rol in ('propietario', 'admin')
  ) or exists (
    select 1 from public.subcuenta_miembros sm
    join public.subcuentas s on s.id = sm.subcuenta_id
    where sm.subcuenta_id = p_subcuenta and sm.usuario_id = auth.uid() and s.estado = 'activa'
  );
$$;

create or replace function public.soy_admin_subcuenta(p_subcuenta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subcuentas s
    join public.agencia_miembros am on am.agencia_id = s.agencia_id
    where s.id = p_subcuenta and am.usuario_id = auth.uid() and am.rol in ('propietario', 'admin')
  ) or exists (
    select 1 from public.subcuenta_miembros sm
    join public.subcuentas s on s.id = sm.subcuenta_id
    where sm.subcuenta_id = p_subcuenta and sm.usuario_id = auth.uid()
      and sm.rol = 'admin' and s.estado = 'activa'
  );
$$;

-- =============================================================================
-- 4 · DISPARADORES
-- =============================================================================
create or replace function public.toca_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists agencias_actualizado on public.agencias;
create trigger agencias_actualizado before update on public.agencias
  for each row execute function public.toca_actualizado();
drop trigger if exists subcuentas_actualizado on public.subcuentas;
create trigger subcuentas_actualizado before update on public.subcuentas
  for each row execute function public.toca_actualizado();
drop trigger if exists suscripciones_actualizado on public.suscripciones;
create trigger suscripciones_actualizado before update on public.suscripciones
  for each row execute function public.toca_actualizado();

-- Una subcuenta nunca cambia de agencia, y solo la agencia (no el admin de la
-- propia subcuenta) decide su etapa comercial y si está suspendida.
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
     and current_setting('app.registrando_acceso', true) is distinct from 'si' then
    raise exception 'Solo la agencia cambia el estado o la etapa de una subcuenta.'
      using errcode = 'insufficient_privilege', hint = 'SUBCUENTA_SOLO_AGENCIA';
  end if;
  return new;
end $$;

drop trigger if exists subcuentas_protege on public.subcuentas;
create trigger subcuentas_protege before update on public.subcuentas
  for each row execute function public.protege_subcuenta();

-- Reglas de la tabla de miembros de agencia:
--   · solo un propietario nombra o retira propietarios
--   · la agencia no se queda nunca sin propietario
--   · nadie se cambia su propio rol
create or replace function public.protege_miembros_agencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_agencia uuid := coalesce(new.agencia_id, old.agencia_id);
  v_soy_prop boolean := public.rol_en_agencia(v_agencia) = 'propietario';
begin
  -- La clave de servicio (sin usuario) y crear_agencia() pasan sin preguntas.
  if auth.uid() is null or current_setting('app.creando_agencia', true) = 'si' then
    return coalesce(new, old);
  end if;
  -- Borrado en cascada de la agencia entera: ya no hay nada que proteger.
  if tg_op = 'DELETE' and not exists (select 1 from public.agencias where id = v_agencia) then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.usuario_id = auth.uid() and new.rol is distinct from old.rol then
    raise exception 'No puedes cambiar tu propio rol.'
      using errcode = 'insufficient_privilege', hint = 'AUTOESCALADA';
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
                     where agencia_id = v_agencia and rol = 'propietario'
                       and usuario_id <> old.usuario_id) then
    raise exception 'La agencia tiene que conservar al menos un propietario.'
      using errcode = 'check_violation', hint = 'ULTIMO_PROPIETARIO';
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists agencia_miembros_protege on public.agencia_miembros;
create trigger agencia_miembros_protege before insert or update or delete on public.agencia_miembros
  for each row execute function public.protege_miembros_agencia();

-- agencia_id de suscripciones y pagos sale SIEMPRE de la subcuenta: así no se
-- puede colgar un cobro de una subcuenta ajena en tu agencia ni al revés.
create or replace function public.agencia_desde_subcuenta()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agencia uuid;
begin
  if new.subcuenta_id is not null then
    select agencia_id into v_agencia from public.subcuentas where id = new.subcuenta_id;
    if v_agencia is null then
      raise exception 'La subcuenta no existe.' using errcode = 'foreign_key_violation';
    end if;
    if tg_op = 'UPDATE' and v_agencia is distinct from old.agencia_id then
      raise exception 'No se puede mover a otra agencia.' using errcode = 'check_violation';
    end if;
    new.agencia_id := v_agencia;
  end if;
  return new;
end $$;

drop trigger if exists suscripciones_agencia on public.suscripciones;
create trigger suscripciones_agencia before insert or update on public.suscripciones
  for each row execute function public.agencia_desde_subcuenta();
drop trigger if exists pagos_agencia on public.pagos;
create trigger pagos_agencia before insert or update on public.pagos
  for each row execute function public.agencia_desde_subcuenta();

-- Fecha de baja coherente con el estado: es lo que usa el histórico del MRR.
create or replace function public.fecha_baja_suscripcion()
returns trigger language plpgsql as $$
begin
  if new.estado = 'cancelada' and new.cancelada_en is null then
    new.cancelada_en := current_date;
  elsif new.estado <> 'cancelada' then
    new.cancelada_en := null;
  end if;
  return new;
end $$;

drop trigger if exists suscripciones_baja on public.suscripciones;
create trigger suscripciones_baja before insert or update on public.suscripciones
  for each row execute function public.fecha_baja_suscripcion();

-- Registro de actividad automático.
create or replace function public.anota_actividad()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fila jsonb := to_jsonb(coalesce(new, old));
  v_agencia uuid;
  v_sub uuid;
  v_detalle jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'subcuentas' then
    v_agencia := (v_fila ->> 'agencia_id')::uuid;
    v_sub := (v_fila ->> 'id')::uuid;
    v_detalle := jsonb_build_object('nombre', v_fila ->> 'nombre');
    -- Entrar en una subcuenta no es un cambio que merezca una línea.
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'ultimo_acceso' - 'actualizado')
                          = (to_jsonb(old) - 'ultimo_acceso' - 'actualizado') then
      return new;
    end if;
    if tg_op = 'UPDATE' then
      v_detalle := v_detalle || jsonb_build_object('cambios', (
        select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(to_jsonb(new)) k
        where k not in ('actualizado', 'ultimo_acceso')
          and to_jsonb(new) -> k is distinct from to_jsonb(old) -> k));
    end if;
  elsif tg_table_name = 'subcuenta_miembros' then
    v_sub := (v_fila ->> 'subcuenta_id')::uuid;
    select agencia_id into v_agencia from public.subcuentas where id = v_sub;
    if v_agencia is null then return coalesce(new, old); end if; -- borrado en cascada
    v_detalle := jsonb_build_object('usuario_id', v_fila ->> 'usuario_id', 'rol', v_fila ->> 'rol');
  elsif tg_table_name = 'agencia_miembros' then
    v_agencia := (v_fila ->> 'agencia_id')::uuid;
    if not exists (select 1 from public.agencias where id = v_agencia) then
      return coalesce(new, old);
    end if;
    v_detalle := jsonb_build_object('usuario_id', v_fila ->> 'usuario_id', 'rol', v_fila ->> 'rol');
  elsif tg_table_name = 'suscripciones' then
    v_agencia := (v_fila ->> 'agencia_id')::uuid;
    v_sub := (v_fila ->> 'subcuenta_id')::uuid;
    if not exists (select 1 from public.agencias where id = v_agencia) then
      return coalesce(new, old);
    end if;
    v_detalle := jsonb_build_object('plan', v_fila ->> 'plan', 'importe_mensual', v_fila -> 'importe_mensual',
                                    'estado', v_fila ->> 'estado');
  end if;

  if v_agencia is not null and exists (select 1 from public.agencias where id = v_agencia) then
    insert into public.actividad (agencia_id, subcuenta_id, actor_id, accion, detalle)
    values (v_agencia, v_sub, auth.uid(), tg_table_name || '.' || lower(tg_op), v_detalle);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists subcuentas_actividad on public.subcuentas;
create trigger subcuentas_actividad after insert or update or delete on public.subcuentas
  for each row execute function public.anota_actividad();
drop trigger if exists subcuenta_miembros_actividad on public.subcuenta_miembros;
create trigger subcuenta_miembros_actividad after insert or update or delete on public.subcuenta_miembros
  for each row execute function public.anota_actividad();
drop trigger if exists agencia_miembros_actividad on public.agencia_miembros;
create trigger agencia_miembros_actividad after insert or update or delete on public.agencia_miembros
  for each row execute function public.anota_actividad();
drop trigger if exists suscripciones_actividad on public.suscripciones;
create trigger suscripciones_actividad after insert or update or delete on public.suscripciones
  for each row execute function public.anota_actividad();

-- =============================================================================
-- 5 · RLS
-- =============================================================================
alter table public.agencias           enable row level security;
alter table public.agencia_miembros   enable row level security;
alter table public.subcuentas         enable row level security;
alter table public.subcuenta_miembros enable row level security;
alter table public.subcuenta_fijadas  enable row level security;
alter table public.suscripciones      enable row level security;
alter table public.pagos              enable row level security;
alter table public.actividad          enable row level security;

-- agencias: los miembros la ven; admins la editan; solo el propietario la borra.
-- No hay política de INSERT: se crea con public.crear_agencia().
drop policy if exists agencias_lee on public.agencias;
create policy agencias_lee on public.agencias for select to authenticated
  using (public.es_miembro_agencia(id));
drop policy if exists agencias_edita on public.agencias;
create policy agencias_edita on public.agencias for update to authenticated
  using (public.soy_admin_agencia(id)) with check (public.soy_admin_agencia(id));
drop policy if exists agencias_borra on public.agencias;
create policy agencias_borra on public.agencias for delete to authenticated
  using (public.rol_en_agencia(id) = 'propietario');

-- agencia_miembros
drop policy if exists agencia_miembros_lee on public.agencia_miembros;
create policy agencia_miembros_lee on public.agencia_miembros for select to authenticated
  using (public.es_miembro_agencia(agencia_id));
drop policy if exists agencia_miembros_alta on public.agencia_miembros;
create policy agencia_miembros_alta on public.agencia_miembros for insert to authenticated
  with check (public.soy_admin_agencia(agencia_id));
drop policy if exists agencia_miembros_edita on public.agencia_miembros;
create policy agencia_miembros_edita on public.agencia_miembros for update to authenticated
  using (public.soy_admin_agencia(agencia_id)) with check (public.soy_admin_agencia(agencia_id));
drop policy if exists agencia_miembros_baja on public.agencia_miembros;
create policy agencia_miembros_baja on public.agencia_miembros for delete to authenticated
  using (public.soy_admin_agencia(agencia_id) or usuario_id = auth.uid());

-- subcuentas
drop policy if exists subcuentas_lee on public.subcuentas;
create policy subcuentas_lee on public.subcuentas for select to authenticated
  using (public.puedo_ver_subcuenta(id));
drop policy if exists subcuentas_alta on public.subcuentas;
create policy subcuentas_alta on public.subcuentas for insert to authenticated
  with check (public.soy_admin_agencia(agencia_id));
drop policy if exists subcuentas_edita on public.subcuentas;
create policy subcuentas_edita on public.subcuentas for update to authenticated
  using (public.soy_admin_subcuenta(id)) with check (public.soy_admin_subcuenta(id));
drop policy if exists subcuentas_borra on public.subcuentas;
create policy subcuentas_borra on public.subcuentas for delete to authenticated
  using (public.soy_admin_agencia(agencia_id));

-- subcuenta_miembros
drop policy if exists subcuenta_miembros_lee on public.subcuenta_miembros;
create policy subcuenta_miembros_lee on public.subcuenta_miembros for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists subcuenta_miembros_alta on public.subcuenta_miembros;
create policy subcuenta_miembros_alta on public.subcuenta_miembros for insert to authenticated
  with check (public.soy_admin_subcuenta(subcuenta_id));
drop policy if exists subcuenta_miembros_edita on public.subcuenta_miembros;
create policy subcuenta_miembros_edita on public.subcuenta_miembros for update to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id) and usuario_id <> auth.uid())
  with check (public.soy_admin_subcuenta(subcuenta_id));
drop policy if exists subcuenta_miembros_baja on public.subcuenta_miembros;
create policy subcuenta_miembros_baja on public.subcuenta_miembros for delete to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id));

-- subcuenta_fijadas: cada uno las suyas, y solo de subcuentas que puede ver.
drop policy if exists subcuenta_fijadas_lee on public.subcuenta_fijadas;
create policy subcuenta_fijadas_lee on public.subcuenta_fijadas for select to authenticated
  using (usuario_id = auth.uid());
drop policy if exists subcuenta_fijadas_alta on public.subcuenta_fijadas;
create policy subcuenta_fijadas_alta on public.subcuenta_fijadas for insert to authenticated
  with check (usuario_id = auth.uid() and public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists subcuenta_fijadas_baja on public.subcuenta_fijadas;
create policy subcuenta_fijadas_baja on public.subcuenta_fijadas for delete to authenticated
  using (usuario_id = auth.uid());

-- suscripciones y pagos: facturación de la agencia, solo sus administradores.
drop policy if exists suscripciones_lee on public.suscripciones;
create policy suscripciones_lee on public.suscripciones for select to authenticated
  using (public.soy_admin_agencia(agencia_id));
drop policy if exists suscripciones_escribe on public.suscripciones;
create policy suscripciones_escribe on public.suscripciones for all to authenticated
  using (public.soy_admin_agencia(agencia_id)) with check (public.soy_admin_agencia(agencia_id));

drop policy if exists pagos_lee on public.pagos;
create policy pagos_lee on public.pagos for select to authenticated
  using (public.soy_admin_agencia(agencia_id));
drop policy if exists pagos_alta on public.pagos;
create policy pagos_alta on public.pagos for insert to authenticated
  with check (public.soy_admin_agencia(agencia_id) and origen = 'manual');
drop policy if exists pagos_borra on public.pagos;
create policy pagos_borra on public.pagos for delete to authenticated
  using (public.soy_admin_agencia(agencia_id) and origen = 'manual');

-- actividad: solo lectura para los admins; la escriben los disparadores.
drop policy if exists actividad_lee on public.actividad;
create policy actividad_lee on public.actividad for select to authenticated
  using (public.soy_admin_agencia(agencia_id));

-- Permisos de tabla: nada para anon; RLS decide para authenticated.
revoke all on public.agencias, public.agencia_miembros, public.subcuentas, public.subcuenta_miembros,
              public.subcuenta_fijadas, public.suscripciones, public.pagos, public.actividad
  from anon;
grant select, update, delete on public.agencias to authenticated;
grant select, insert, update, delete on public.agencia_miembros, public.subcuentas,
  public.subcuenta_miembros, public.suscripciones to authenticated;
grant select, insert, delete on public.subcuenta_fijadas, public.pagos to authenticated;
grant select on public.actividad to authenticated;
grant all on public.agencias, public.agencia_miembros, public.subcuentas, public.subcuenta_miembros,
             public.subcuenta_fijadas, public.suscripciones, public.pagos, public.actividad
  to service_role;

-- =============================================================================
-- 6 · FUNCIONES QUE LLAMA LA APLICACIÓN
-- =============================================================================

-- Alta de agencia: la crea y deja a quien la crea como propietario.
create or replace function public.crear_agencia(p_nombre text, p_moneda text default 'EUR',
                                                p_zona_horaria text default 'Europe/Madrid')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('app.creando_agencia', 'si', true);
  insert into public.agencias (nombre, moneda, zona_horaria, creado_por)
  values (trim(p_nombre), upper(coalesce(nullif(trim(p_moneda), ''), 'EUR')),
          coalesce(nullif(trim(p_zona_horaria), ''), 'Europe/Madrid'), auth.uid())
  returning id into v_id;
  insert into public.agencia_miembros (agencia_id, usuario_id, rol)
  values (v_id, auth.uid(), 'propietario');
  perform set_config('app.creando_agencia', '', true);
  return v_id;
end $$;

-- Marca el último acceso al entrar en una subcuenta.
create or replace function public.registrar_acceso_subcuenta(p_subcuenta uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('app.registrando_acceso', 'si', true);
  update public.subcuentas set ultimo_acceso = now() where id = p_subcuenta;
  perform set_config('app.registrando_acceso', '', true);
end $$;

-- Equipo de una subcuenta, con correo y nombre de auth.users.
create or replace function public.miembros_subcuenta(p_subcuenta uuid)
returns table (usuario_id uuid, email text, nombre text, rol public.rol_subcuenta, creado timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select sm.usuario_id, u.email::text,
           coalesce(u.raw_user_meta_data ->> 'nombre', u.raw_user_meta_data ->> 'full_name', '')::text,
           sm.rol, sm.creado
    from public.subcuenta_miembros sm
    join auth.users u on u.id = sm.usuario_id
    where sm.subcuenta_id = p_subcuenta
    order by sm.creado;
end $$;

-- Equipo de la agencia.
create or replace function public.miembros_agencia(p_agencia uuid)
returns table (usuario_id uuid, email text, nombre text, rol public.rol_agencia, creado timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_miembro_agencia(p_agencia) then
    raise exception 'No perteneces a esta agencia.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select am.usuario_id, u.email::text,
           coalesce(u.raw_user_meta_data ->> 'nombre', u.raw_user_meta_data ->> 'full_name', '')::text,
           am.rol, am.creado
    from public.agencia_miembros am
    join auth.users u on u.id = am.usuario_id
    where am.agencia_id = p_agencia
    order by am.creado;
end $$;

-- Da acceso a una subcuenta a un usuario que ya existe, buscándolo por correo.
-- Si no existe devuelve null: la aplicación lo invita (clave de servicio) y
-- vuelve a llamar.
create or replace function public.agregar_miembro_subcuenta(p_subcuenta uuid, p_email text,
                                                            p_rol public.rol_subcuenta default 'usuario')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_usuario uuid;
begin
  if not public.soy_admin_subcuenta(p_subcuenta) then
    raise exception 'Solo un administrador puede dar acceso.' using errcode = 'insufficient_privilege';
  end if;
  select id into v_usuario from auth.users where lower(email) = lower(trim(p_email));
  if v_usuario is null then
    return null;
  end if;
  insert into public.subcuenta_miembros (subcuenta_id, usuario_id, rol)
  values (p_subcuenta, v_usuario, p_rol)
  on conflict (subcuenta_id, usuario_id) do update set rol = excluded.rol;
  return v_usuario;
end $$;

-- Igual para el equipo de la agencia.
create or replace function public.agregar_miembro_agencia(p_agencia uuid, p_email text,
                                                          p_rol public.rol_agencia default 'usuario')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_usuario uuid;
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador puede añadir usuarios.' using errcode = 'insufficient_privilege';
  end if;
  if p_rol = 'propietario' and public.rol_en_agencia(p_agencia) <> 'propietario' then
    raise exception 'Solo un propietario puede nombrar propietarios.' using errcode = 'insufficient_privilege';
  end if;
  select id into v_usuario from auth.users where lower(email) = lower(trim(p_email));
  if v_usuario is null then
    return null;
  end if;
  insert into public.agencia_miembros (agencia_id, usuario_id, rol)
  values (p_agencia, v_usuario, p_rol)
  on conflict (agencia_id, usuario_id) do update set rol = excluded.rol;
  return v_usuario;
end $$;

-- Métricas del tablero de la agencia.
--   ingresos_30d     · suma de pagos de los últimos 30 días
--   mrr              · suma de las suscripciones activas o impagadas hoy
--   nuevos_30d       · subcuentas creadas en los últimos 30 días
--   total_clientes   · subcuentas activas
--   serie            · por mes: nuevas subcuentas, MRR a cierre de mes, ingresos
--   distribucion     · ingresos del mes natural anterior por concepto
create or replace function public.metricas_agencia(p_agencia uuid, p_meses int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text;
  v_moneda text;
  v_res jsonb;
  v_mes_actual date;
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo los administradores de la agencia ven sus métricas.'
      using errcode = 'insufficient_privilege';
  end if;
  p_meses := greatest(1, least(coalesce(p_meses, 7), 24));
  select zona_horaria, moneda into v_tz, v_moneda from public.agencias where id = p_agencia;
  v_mes_actual := date_trunc('month', now() at time zone v_tz)::date;

  with meses as (
    select (v_mes_actual - make_interval(months => g))::date as mes
    from generate_series(p_meses - 1, 0, -1) g
  ),
  serie as (
    select m.mes,
      (select count(*) from public.subcuentas s
        where s.agencia_id = p_agencia
          and (s.creado at time zone v_tz) >= m.mes
          and (s.creado at time zone v_tz) < m.mes + interval '1 month') as nuevos,
      (select coalesce(sum(x.importe_mensual), 0) from public.suscripciones x
        where x.agencia_id = p_agencia and x.estado <> 'prueba'
          and x.inicio < m.mes + interval '1 month'
          and (x.cancelada_en is null or x.cancelada_en >= m.mes + interval '1 month')) as mrr,
      (select coalesce(sum(p.importe), 0) from public.pagos p
        where p.agencia_id = p_agencia
          and (p.fecha at time zone v_tz) >= m.mes
          and (p.fecha at time zone v_tz) < m.mes + interval '1 month') as ingresos
    from meses m
  )
  select jsonb_build_object(
    'moneda', v_moneda,
    'ingresos_30d', (select coalesce(sum(importe), 0) from public.pagos
                     where agencia_id = p_agencia and fecha >= now() - interval '30 days'),
    'mrr', (select coalesce(sum(importe_mensual), 0) from public.suscripciones
            where agencia_id = p_agencia and estado in ('activa', 'impagada')),
    'nuevos_30d', (select count(*) from public.subcuentas
                   where agencia_id = p_agencia and creado >= now() - interval '30 days'),
    'total_clientes', (select count(*) from public.subcuentas
                       where agencia_id = p_agencia and estado = 'activa'),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', to_char(mes, 'YYYY-MM'), 'nuevos', nuevos, 'mrr', mrr, 'ingresos', ingresos)
                order by mes), '[]'::jsonb) from serie),
    'distribucion', (select coalesce(jsonb_agg(jsonb_build_object('concepto', concepto, 'importe', total)
                       order by total desc), '[]'::jsonb)
                     from (select concepto, sum(importe) as total from public.pagos
                           where agencia_id = p_agencia
                             and (fecha at time zone v_tz) >= v_mes_actual - interval '1 month'
                             and (fecha at time zone v_tz) < v_mes_actual
                           group by concepto) d)
  ) into v_res;
  return v_res;
end $$;

revoke all on function public.crear_agencia(text, text, text)                          from public, anon;
revoke all on function public.registrar_acceso_subcuenta(uuid)                         from public, anon;
revoke all on function public.miembros_subcuenta(uuid)                                 from public, anon;
revoke all on function public.miembros_agencia(uuid)                                   from public, anon;
revoke all on function public.agregar_miembro_subcuenta(uuid, text, public.rol_subcuenta) from public, anon;
revoke all on function public.agregar_miembro_agencia(uuid, text, public.rol_agencia)  from public, anon;
revoke all on function public.metricas_agencia(uuid, int)                              from public, anon;
grant execute on function public.crear_agencia(text, text, text)                          to authenticated;
grant execute on function public.registrar_acceso_subcuenta(uuid)                         to authenticated;
grant execute on function public.miembros_subcuenta(uuid)                                 to authenticated;
grant execute on function public.miembros_agencia(uuid)                                   to authenticated;
grant execute on function public.agregar_miembro_subcuenta(uuid, text, public.rol_subcuenta) to authenticated;
grant execute on function public.agregar_miembro_agencia(uuid, text, public.rol_agencia)  to authenticated;
grant execute on function public.metricas_agencia(uuid, int)                              to authenticated;

-- =============================================================================
-- 7 · NOTIFICACIONES (la campana de la barra superior)
--   tipo 'sistema' · avisos de la plataforma (alta de subcuenta, accesos…)
--   tipo 'alerta'  · avisos que generen los módulos (mensajes, citas, pagos…)
-- Cada fila es de un único usuario. Las crean los disparadores o la clave de
-- servicio; el usuario solo puede leerlas, marcarlas como leídas o borrarlas.
-- =============================================================================
create table if not exists public.notificaciones (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  agencia_id   uuid references public.agencias(id) on delete cascade,
  subcuenta_id uuid references public.subcuentas(id) on delete cascade,
  tipo         text not null default 'sistema' check (tipo in ('sistema', 'alerta')),
  categoria    text not null default 'Sistema',
  titulo       text not null check (length(trim(titulo)) between 1 and 200),
  cuerpo       text not null default '',
  enlace       text check (enlace is null or enlace ~ '^/'),
  leida        timestamptz,
  creado       timestamptz not null default now()
);
create index if not exists notificaciones_usuario_idx on public.notificaciones(usuario_id, creado desc);
create index if not exists notificaciones_no_leidas_idx on public.notificaciones(usuario_id) where leida is null;

alter table public.notificaciones enable row level security;
drop policy if exists notificaciones_lee on public.notificaciones;
create policy notificaciones_lee on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());
drop policy if exists notificaciones_marca on public.notificaciones;
create policy notificaciones_marca on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists notificaciones_borra on public.notificaciones;
create policy notificaciones_borra on public.notificaciones for delete to authenticated
  using (usuario_id = auth.uid());

revoke all on public.notificaciones from anon;
grant select, delete on public.notificaciones to authenticated;
grant update (leida) on public.notificaciones to authenticated;
grant all on public.notificaciones to service_role;

-- Avisa a quien recibe acceso a una subcuenta, y a los admins de la agencia
-- cuando se da de alta una subcuenta nueva.
create or replace function public.notifica_eventos()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sub public.subcuentas%rowtype;
begin
  if tg_table_name = 'subcuenta_miembros' then
    select * into v_sub from public.subcuentas where id = new.subcuenta_id;
    if new.usuario_id is distinct from auth.uid() then
      insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, titulo, cuerpo, enlace)
      values (new.usuario_id, v_sub.agencia_id, v_sub.id,
              'Tienes acceso a ' || v_sub.nombre,
              'Te han dado acceso como ' || new.rol || ' a la subcuenta ' || v_sub.nombre || '.',
              '/subcuenta/' || v_sub.id);
    end if;
  elsif tg_table_name = 'subcuentas' then
    insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, titulo, cuerpo, enlace)
    select am.usuario_id, new.agencia_id, new.id,
           'Nueva subcuenta: ' || new.nombre,
           'Se ha creado la subcuenta ' || new.nombre || '.',
           '/subcuenta/' || new.id
    from public.agencia_miembros am
    where am.agencia_id = new.agencia_id and am.rol in ('propietario', 'admin')
      and am.usuario_id is distinct from auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists subcuenta_miembros_notifica on public.subcuenta_miembros;
create trigger subcuenta_miembros_notifica after insert on public.subcuenta_miembros
  for each row execute function public.notifica_eventos();
drop trigger if exists subcuentas_notifica on public.subcuentas;
create trigger subcuentas_notifica after insert on public.subcuentas
  for each row execute function public.notifica_eventos();

create or replace function public.marcar_notificaciones_leidas()
returns int language sql security invoker set search_path = public as $$
  with x as (update public.notificaciones set leida = now()
             where usuario_id = auth.uid() and leida is null returning 1)
  select count(*)::int from x;
$$;
revoke all on function public.marcar_notificaciones_leidas() from public, anon;
grant execute on function public.marcar_notificaciones_leidas() to authenticated;

-- Avisos en directo: la campana se suscribe a las filas nuevas por Realtime
-- (RLS sigue aplicándose: cada usuario solo recibe las suyas).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones') then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;
