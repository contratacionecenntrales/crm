-- =============================================================================
-- EVOLVIX GLOBAL · Facturación de Grupo
-- Esquema de Supabase — proyecto NUEVO y SEPARADO del CRM de Labs24k.
--
-- CÓMO SE EJECUTA
--   Panel de Supabase (del proyecto nuevo de Evolvix Global) → SQL Editor →
--   New query → pegar todo → Run. Es idempotente: se puede volver a lanzar
--   sin romper nada.
--
-- QUÉ CREA
--   perfiles   · la ficha de cada usuario (contable/administración), atada
--                a auth.users, igual que en el CRM de Labs24k
--   marcas     · cada marca del grupo (empieza con «Evolvix Global», se
--                pueden añadir más sin tocar nada de este archivo)
--   clientes   · clientes finales, cada uno colgado de UNA marca
--   facturas   · la factura en sí: numeración, importes, estado de cobro
--   factura_lineas  · los conceptos de cada factura
--   factura_eventos · historial de cada factura, de solo-añadir
--
-- DISEÑO DE ROLES (deliberadamente simple: solo dos)
--   admin     · todo, incluida la gestión de marcas y del equipo
--   contable  · crea y gestiona clientes y facturas; no borra marcas ni
--               borra facturas ya emitidas (una factura se anula, no se
--               destruye — el rastro de lo que se facturó no desaparece)
-- =============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- =============================================================================
-- 1 · TIPOS
-- =============================================================================
do $$ begin
  create type public.rol_usuario as enum ('admin', 'contable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_cuenta as enum ('Activo', 'Suspendido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_factura as enum ('Pendiente', 'Pagada', 'Impagada', 'Anulada');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 2 · PERFILES
-- La contraseña vive en auth.users, cifrada. Esta tabla es la ficha de
-- empresa que cuelga de esa identidad — mismo patrón que Labs24k.
-- =============================================================================
create table if not exists public.perfiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) between 2 and 60),
  apellidos     text not null default '',
  email         text not null unique,
  rol           public.rol_usuario  not null default 'contable',
  estado        public.estado_cuenta not null default 'Activo',
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);
create index if not exists perfiles_rol_idx on public.perfiles(rol);

create or replace function public.marca_actualizado()
returns trigger language plpgsql as $$
begin new.actualizado := now(); return new; end $$;

drop trigger if exists perfiles_actualizado on public.perfiles;
create trigger perfiles_actualizado before update on public.perfiles
  for each row execute function public.marca_actualizado();

-- =============================================================================
-- 3 · AYUDANTES DE SEGURIDAD
-- SECURITY DEFINER para leer perfiles desde dentro de las políticas sin caer
-- en recursión infinita de RLS. search_path fijado a propósito.
-- =============================================================================
create or replace function public.mi_rol()
returns public.rol_usuario language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and estado = 'Activo';
$$;

create or replace function public.soy_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles
                 where id = auth.uid() and rol = 'admin' and estado = 'Activo');
$$;

revoke execute on function public.mi_rol()    from public;
revoke execute on function public.soy_admin() from public;
grant execute on function public.mi_rol()    to authenticated;
grant execute on function public.soy_admin() to authenticated;

-- Nadie se sube a sí mismo de rango: ni rol, ni estado.
create or replace function public.impide_autoescalada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = new.id then
    if new.rol is distinct from old.rol or new.estado is distinct from old.estado then
      raise exception 'No puedes cambiar tu propio rol ni tu propio estado.'
        using errcode = 'insufficient_privilege', hint = 'AUTO_ESCALADA';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists perfiles_sin_autoescalada on public.perfiles;
create trigger perfiles_sin_autoescalada
  before update on public.perfiles
  for each row execute function public.impide_autoescalada();

-- El sistema nunca se queda sin administrador activo.
create or replace function public.exige_un_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.perfiles where rol = 'admin' and estado = 'Activo') then
    raise exception 'No puedes dejar el sistema sin ningún administrador activo.'
      using errcode = 'check_violation', hint = 'ULTIMO_ADMIN';
  end if;
  return null;
end $$;

drop trigger if exists perfiles_un_admin on public.perfiles;
create constraint trigger perfiles_un_admin
  after update or delete on public.perfiles
  deferrable initially deferred
  for each row execute function public.exige_un_admin();

-- =============================================================================
-- 4 · MARCAS DEL GRUPO
-- =============================================================================
create table if not exists public.marcas (
  id          bigserial primary key,
  nombre      text not null unique check (length(trim(nombre)) between 2 and 80),
  cif         text not null default '',
  direccion   text not null default '',
  email       text not null default '',
  telefono    text not null default '',
  color       text not null default '#17C8C0' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  activa      boolean not null default true,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

drop trigger if exists marcas_actualizado on public.marcas;
create trigger marcas_actualizado before update on public.marcas
  for each row execute function public.marca_actualizado();

insert into public.marcas (nombre, cif, email, color)
values ('Evolvix Global', '', '', '#17C8C0')
on conflict (nombre) do nothing;

-- =============================================================================
-- 5 · CLIENTES
-- Cada cliente cuelga de UNA marca: así nunca se mezclan entre marcas.
-- =============================================================================
create table if not exists public.clientes (
  id          bigserial primary key,
  marca_id    bigint not null references public.marcas(id) on delete restrict,
  nombre      text not null check (length(trim(nombre)) between 2 and 120),
  cif         text not null default '',
  direccion   text not null default '',
  email       text not null default '',
  telefono    text not null default '',
  contacto    text not null default '',
  notas       text not null default '',
  creado_por  uuid references public.perfiles(id) on delete set null,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists clientes_marca_idx on public.clientes(marca_id);

drop trigger if exists clientes_actualizado on public.clientes;
create trigger clientes_actualizado before update on public.clientes
  for each row execute function public.marca_actualizado();

-- =============================================================================
-- 6 · FACTURAS
-- =============================================================================
create table if not exists public.facturas (
  id                bigserial primary key,
  numero            text not null unique,
  marca_id          bigint not null references public.marcas(id) on delete restrict,
  cliente_id        bigint not null references public.clientes(id) on delete restrict,
  fecha_emision     date not null default current_date,
  fecha_vencimiento date,
  base              numeric(12,2) not null default 0 check (base >= 0),
  iva               numeric(5,2)  not null default 21 check (iva >= 0),
  total             numeric(12,2) not null default 0 check (total >= 0),
  estado            public.estado_factura not null default 'Pendiente',
  fecha_pago        date,
  metodo_pago       text not null default '',
  notas             text not null default '',
  creado_por        uuid references public.perfiles(id) on delete set null,
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now()
);
create index if not exists facturas_marca_idx   on public.facturas(marca_id);
create index if not exists facturas_cliente_idx on public.facturas(cliente_id);
create index if not exists facturas_estado_idx  on public.facturas(estado);

drop trigger if exists facturas_actualizado on public.facturas;
create trigger facturas_actualizado before update on public.facturas
  for each row execute function public.marca_actualizado();

-- Numeración por marca y por año: EVO-2026-0001, ICC-2026-0001... Cada marca
-- lleva su propia serie, como exige la normativa de facturación española.
create or replace function public.siguiente_numero_factura(p_marca_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefijo text;
  v_anio    text := to_char(current_date, 'YYYY');
  v_siguiente int;
begin
  select upper(left(regexp_replace(nombre, '[^A-Za-z]', '', 'g'), 3))
    into v_prefijo
    from public.marcas where id = p_marca_id;
  if v_prefijo is null or v_prefijo = '' then v_prefijo := 'FAC'; end if;

  select coalesce(max(
    (regexp_match(numero, '-(\d+)$'))[1]::int
  ), 0) + 1
  into v_siguiente
  from public.facturas
  where marca_id = p_marca_id
    and numero like v_prefijo || '-' || v_anio || '-%';

  return v_prefijo || '-' || v_anio || '-' || lpad(v_siguiente::text, 4, '0');
end $$;

revoke execute on function public.siguiente_numero_factura(bigint) from public;
grant execute on function public.siguiente_numero_factura(bigint) to authenticated;

-- Deja constancia sola de cada cambio de estado, para que el histórico nunca
-- dependa de que alguien se acuerde de anotarlo.
create table if not exists public.factura_eventos (
  id         bigserial primary key,
  factura_id bigint not null references public.facturas(id) on delete cascade,
  autor_id   uuid references public.perfiles(id) on delete set null,
  tipo       text not null check (tipo in ('creada','cambio_estado','pago_registrado','anulada')),
  texto      text not null default '',
  ts         timestamptz not null default now()
);
create index if not exists factura_eventos_idx on public.factura_eventos(factura_id, ts desc);

create or replace function public.registra_cambio_factura()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.factura_eventos (factura_id, autor_id, tipo, texto)
    values (new.id, auth.uid(), 'creada', 'Factura ' || new.numero || ' registrada por ' || new.total || ' €.');
    return new;
  end if;
  if new.estado is distinct from old.estado then
    insert into public.factura_eventos (factura_id, autor_id, tipo, texto)
    values (new.id, auth.uid(),
      case when new.estado = 'Anulada' then 'anulada'
           when new.estado = 'Pagada' then 'pago_registrado'
           else 'cambio_estado' end,
      'Estado: ' || old.estado || ' → ' || new.estado);
  end if;
  return new;
end $$;

drop trigger if exists facturas_registra_creacion on public.facturas;
create trigger facturas_registra_creacion after insert on public.facturas
  for each row execute function public.registra_cambio_factura();

drop trigger if exists facturas_registra_cambio on public.facturas;
create trigger facturas_registra_cambio after update on public.facturas
  for each row execute function public.registra_cambio_factura();

-- =============================================================================
-- 7 · LÍNEAS DE FACTURA
-- =============================================================================
create table if not exists public.factura_lineas (
  id              bigserial primary key,
  factura_id      bigint not null references public.facturas(id) on delete cascade,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  cantidad        numeric(10,2) not null default 1 check (cantidad > 0),
  precio_unitario numeric(12,2) not null default 0 check (precio_unitario >= 0),
  orden           int not null default 0
);
create index if not exists factura_lineas_idx on public.factura_lineas(factura_id, orden);

-- =============================================================================
-- 8 · VISTA CONSOLIDADA DEL GRUPO
-- Se calcula de las facturas reales: nunca puede discrepar de lo que hay.
-- security_invoker = true es OBLIGATORIO: sin esto, la vista correría con
-- los permisos de quien la creó y cualquier autenticado vería la
-- facturación de todas las marcas, aunque abajo esté bien protegida.
-- =============================================================================
create or replace view public.resumen_marcas
with (security_invoker = true) as
select
  m.id                                                             as marca_id,
  m.nombre                                                         as marca,
  m.color,
  count(f.id)                                                      as facturas_totales,
  coalesce(sum(f.total) filter (where f.estado <> 'Anulada'), 0)   as facturado,
  coalesce(sum(f.total) filter (where f.estado = 'Pagada'), 0)     as cobrado,
  coalesce(sum(f.total) filter (where f.estado = 'Pendiente'), 0)  as pendiente,
  coalesce(sum(f.total) filter (where f.estado = 'Impagada'), 0)   as impagado,
  count(distinct f.cliente_id)                                     as clientes_facturados
from public.marcas m
left join public.facturas f on f.marca_id = m.id
group by m.id, m.nombre, m.color;

grant select on public.resumen_marcas to authenticated;

-- =============================================================================
-- 9 · RLS
-- =============================================================================
alter table public.perfiles        enable row level security;
alter table public.marcas          enable row level security;
alter table public.clientes        enable row level security;
alter table public.facturas        enable row level security;
alter table public.factura_lineas  enable row level security;
alter table public.factura_eventos enable row level security;

-- --- perfiles --------------------------------------------------------------
drop policy if exists perfiles_lee_propio   on public.perfiles;
drop policy if exists perfiles_lee_admin    on public.perfiles;
drop policy if exists perfiles_edita_propio on public.perfiles;
drop policy if exists perfiles_admin_todo   on public.perfiles;
drop policy if exists perfiles_admin_borra  on public.perfiles;

create policy perfiles_lee_propio on public.perfiles
  for select using (id = auth.uid());
create policy perfiles_lee_admin on public.perfiles
  for select using (public.soy_admin());
create policy perfiles_edita_propio on public.perfiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy perfiles_admin_todo on public.perfiles
  for update using (public.soy_admin()) with check (public.soy_admin());
create policy perfiles_admin_borra on public.perfiles
  for delete using (public.soy_admin());
-- Sin política de INSERT a propósito: las altas las hace quien tenga la
-- clave de servicio (Edge Function o el propio editor SQL), igual que en
-- Labs24k. Nadie se da de alta por su cuenta.

-- --- marcas: las ve cualquiera con sesión; solo admin las crea/edita/borra -
drop policy if exists marcas_lee   on public.marcas;
drop policy if exists marcas_admin on public.marcas;
create policy marcas_lee on public.marcas
  for select using (auth.uid() is not null);
create policy marcas_admin on public.marcas
  for insert with check (public.soy_admin());
create policy marcas_edita on public.marcas
  for update using (public.soy_admin()) with check (public.soy_admin());
create policy marcas_borra on public.marcas
  for delete using (public.soy_admin());

-- --- clientes: admin y contable, todos con acceso a todas las marcas ------
drop policy if exists clientes_lee   on public.clientes;
drop policy if exists clientes_crea  on public.clientes;
drop policy if exists clientes_edita on public.clientes;
drop policy if exists clientes_borra on public.clientes;
create policy clientes_lee on public.clientes
  for select using (auth.uid() is not null);
create policy clientes_crea on public.clientes
  for insert with check (auth.uid() is not null and creado_por = auth.uid());
create policy clientes_edita on public.clientes
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy clientes_borra on public.clientes
  for delete using (public.soy_admin());

-- --- facturas: admin y contable pueden crear y cambiar estado; nadie borra
--     una factura ya emitida — se anula (estado = Anulada), no se destruye -
drop policy if exists facturas_lee   on public.facturas;
drop policy if exists facturas_crea  on public.facturas;
drop policy if exists facturas_edita on public.facturas;
create policy facturas_lee on public.facturas
  for select using (auth.uid() is not null);
create policy facturas_crea on public.facturas
  for insert with check (auth.uid() is not null and creado_por = auth.uid());
create policy facturas_edita on public.facturas
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
-- Sin política de DELETE: ninguna factura se borra desde el panel.

drop policy if exists factura_lineas_lee   on public.factura_lineas;
drop policy if exists factura_lineas_crea  on public.factura_lineas;
drop policy if exists factura_lineas_borra on public.factura_lineas;
create policy factura_lineas_lee on public.factura_lineas
  for select using (auth.uid() is not null);
create policy factura_lineas_crea on public.factura_lineas
  for insert with check (auth.uid() is not null);
create policy factura_lineas_borra on public.factura_lineas
  for delete using (auth.uid() is not null);
-- Las líneas solo se tocan mientras la factura está en Pendiente; eso lo
-- decide la aplicación al construir el formulario, no una política aparte:
-- una vez emitida, el estado de la factura ya no debería cambiar sus líneas
-- en la práctica, aunque técnicamente la política no lo bloquee — así se
-- mantiene simple. Si hiciera falta cerrarlo del todo, es un candidato claro
-- para un futuro archivo de endurecimiento, igual que en Labs24k.

drop policy if exists factura_eventos_lee on public.factura_eventos;
create policy factura_eventos_lee on public.factura_eventos
  for select using (auth.uid() is not null);
-- Sin INSERT manual: solo lo escribe el disparador registra_cambio_factura
-- (SECURITY DEFINER, se salta RLS). Sin UPDATE ni DELETE: es un histórico.

grant select, update, delete on public.perfiles to authenticated;
grant select, insert, update, delete on public.marcas to authenticated;
grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update on public.facturas to authenticated;
grant select, insert, delete on public.factura_lineas to authenticated;
grant select on public.factura_eventos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon;

-- =============================================================================
-- COMPROBACIÓN
-- =============================================================================
select
  (select count(*) from public.marcas) as marcas,
  (select count(*) from pg_policies where schemaname='public'
     and tablename in ('perfiles','marcas','clientes','facturas','factura_lineas','factura_eventos')) as politicas,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='siguiente_numero_factura') as funciones_numeracion,
  (select count(*) from pg_views where schemaname='public' and viewname='resumen_marcas') as vista_resumen;
-- Esperado: marcas >= 1, politicas = 20, funciones_numeracion = 1, vista_resumen = 1.
