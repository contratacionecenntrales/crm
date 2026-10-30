-- =============================================================================
-- 12 · CALENDARIOS: CALENDARIOS, HORARIOS, CITAS, FRANJAS BLOQUEADAS Y
--      RESERVA PÚBLICA
--
-- Requiere 09, 10 y 11. Idempotente.
--
-- MODELO
--   cal_calendarios  un calendario reservable (duración, intervalo, antelación,
--                    márgenes, equipo que atiende, zona horaria…)
--   cal_horarios     disponibilidad semanal: varias franjas por día
--   cal_citas        citas; una misma persona no puede tener dos citas que se
--                    pisen (restricción EXCLUDE, también entre calendarios)
--   cal_bloqueos     franjas bloqueadas para un calendario, una persona o toda
--                    la subcuenta
--
-- RESERVA PÚBLICA
--   La página /reservar/<slug> no tiene sesión: usa cal_publico, cal_huecos y
--   cal_reservar (SECURITY DEFINER, concedidas a anon). Nunca exponen datos de
--   otras citas: solo devuelven las horas libres.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- =============================================================================
-- 1 · TABLAS
-- =============================================================================
create table if not exists public.cal_calendarios (
  id              uuid primary key default gen_random_uuid(),
  subcuenta_id    uuid not null references public.subcuentas(id) on delete cascade,
  nombre          text not null check (length(trim(nombre)) between 1 and 120),
  descripcion     text not null default '' check (length(descripcion) <= 2000),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  color           text not null default '#155eef' check (color ~ '^#[0-9a-f]{6}$'),
  tipo            text not null default 'personal' check (tipo in ('personal', 'ronda')),
  equipo          uuid[] not null default '{}',
  duracion_min    int not null default 30 check (duracion_min between 5 and 480),
  intervalo_min   int not null default 30 check (intervalo_min between 5 and 480),
  antelacion_min  int not null default 60 check (antelacion_min between 0 and 43200),
  dias_reserva    int not null default 60 check (dias_reserva between 1 and 365),
  margen_antes    int not null default 0 check (margen_antes between 0 and 240),
  margen_despues  int not null default 0 check (margen_despues between 0 and 240),
  max_por_dia     int check (max_por_dia is null or max_por_dia between 1 and 500),
  zona_horaria    text not null default '',
  ubicacion       text not null default '' check (length(ubicacion) <= 500),
  confirmacion    text not null default '' check (length(confirmacion) <= 1000),
  activo          boolean not null default true,
  creado          timestamptz not null default now(),
  actualizado     timestamptz not null default now(),
  unique (id, subcuenta_id),
  check (tipo <> 'personal' or cardinality(equipo) <= 1)
);
create index if not exists cal_calendarios_sub_idx on public.cal_calendarios(subcuenta_id);

create table if not exists public.cal_horarios (
  id            uuid primary key default gen_random_uuid(),
  subcuenta_id  uuid not null,
  calendario_id uuid not null,
  dia           smallint not null check (dia between 0 and 6), -- 0 = domingo
  inicio        time not null,
  fin           time not null,
  check (fin > inicio),
  foreign key (calendario_id, subcuenta_id) references public.cal_calendarios(id, subcuenta_id) on delete cascade
);
create index if not exists cal_horarios_cal_idx on public.cal_horarios(calendario_id, dia);

create table if not exists public.cal_citas (
  id            uuid primary key default gen_random_uuid(),
  subcuenta_id  uuid not null references public.subcuentas(id) on delete cascade,
  calendario_id uuid not null,
  contacto_id   uuid,
  asignado_id   uuid references auth.users(id) on delete set null,
  titulo        text not null check (length(trim(titulo)) between 1 and 200),
  inicio        timestamptz not null,
  fin           timestamptz not null,
  estado        text not null default 'confirmada'
                check (estado in ('nueva', 'confirmada', 'cancelada', 'presentado', 'no_presentado')),
  notas         text not null default '' check (length(notas) <= 5000),
  ubicacion     text not null default '' check (length(ubicacion) <= 500),
  origen        text not null default 'interno' check (origen in ('interno', 'reserva')),
  creado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now(),
  check (fin > inicio and fin - inicio <= interval '24 hours'),
  foreign key (calendario_id, subcuenta_id) references public.cal_calendarios(id, subcuenta_id) on delete cascade,
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete set null (contacto_id)
);
create index if not exists cal_citas_sub_inicio_idx on public.cal_citas(subcuenta_id, inicio);
create index if not exists cal_citas_contacto_idx on public.cal_citas(contacto_id, inicio desc);
create index if not exists cal_citas_cal_idx on public.cal_citas(calendario_id, inicio);

-- Nadie tiene dos citas a la vez; un calendario sin equipo tampoco.
do $$ begin
  alter table public.cal_citas add constraint cal_citas_sin_solape_persona
    exclude using gist (asignado_id with =, tstzrange(inicio, fin) with &&)
    where (estado <> 'cancelada' and asignado_id is not null);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.cal_citas add constraint cal_citas_sin_solape_calendario
    exclude using gist (calendario_id with =, tstzrange(inicio, fin) with &&)
    where (estado <> 'cancelada' and asignado_id is null);
exception when duplicate_object or duplicate_table then null; end $$;

create table if not exists public.cal_bloqueos (
  id            uuid primary key default gen_random_uuid(),
  subcuenta_id  uuid not null references public.subcuentas(id) on delete cascade,
  calendario_id uuid,
  usuario_id    uuid references auth.users(id) on delete cascade,
  titulo        text not null default 'Bloqueado' check (length(trim(titulo)) between 1 and 200),
  inicio        timestamptz not null,
  fin           timestamptz not null,
  todo_el_dia   boolean not null default false,
  creado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  creado        timestamptz not null default now(),
  check (fin > inicio and fin - inicio <= interval '62 days'),
  foreign key (calendario_id, subcuenta_id) references public.cal_calendarios(id, subcuenta_id) on delete cascade
);
create index if not exists cal_bloqueos_sub_idx on public.cal_bloqueos(subcuenta_id, inicio);

-- =============================================================================
-- 2 · DISPARADORES
-- =============================================================================
drop trigger if exists cal_calendarios_actualizado on public.cal_calendarios;
create trigger cal_calendarios_actualizado before update on public.cal_calendarios
  for each row execute function public.toca_actualizado();
drop trigger if exists cal_citas_actualizado on public.cal_citas;
create trigger cal_citas_actualizado before update on public.cal_citas
  for each row execute function public.toca_actualizado();

-- Calendario: zona horaria válida (por defecto la de la subcuenta), equipo sin
-- repetidos y formado por gente con acceso a la subcuenta.
create or replace function public.cal_normaliza_calendario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.nombre := trim(new.nombre);
  if coalesce(trim(new.zona_horaria), '') = '' then
    select zona_horaria into new.zona_horaria from public.subcuentas where id = new.subcuenta_id;
  end if;
  if not exists (select 1 from pg_timezone_names where name = new.zona_horaria) then
    raise exception 'Zona horaria no válida: %', new.zona_horaria using errcode = 'check_violation';
  end if;
  new.equipo := coalesce((select array_agg(distinct u) from unnest(new.equipo) u where u is not null), '{}');
  if exists (select 1 from unnest(new.equipo) u where not public.usuario_ve_subcuenta(u, new.subcuenta_id)) then
    raise exception 'Alguien del equipo no tiene acceso a esta subcuenta.'
      using errcode = 'check_violation', hint = 'ASIGNADO_SIN_ACCESO';
  end if;
  return new;
end $$;

drop trigger if exists cal_calendarios_normaliza on public.cal_calendarios;
create trigger cal_calendarios_normaliza before insert or update on public.cal_calendarios
  for each row execute function public.cal_normaliza_calendario();

-- Cita y bloqueo: la persona asignada tiene que ver la subcuenta.
create or replace function public.cal_valida_persona()
returns trigger language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  v := (to_jsonb(new) ->> case tg_table_name when 'cal_bloqueos' then 'usuario_id' else 'asignado_id' end)::uuid;
  if v is not null and not public.usuario_ve_subcuenta(v, new.subcuenta_id) then
    raise exception 'La persona asignada no tiene acceso a esta subcuenta.'
      using errcode = 'check_violation', hint = 'ASIGNADO_SIN_ACCESO';
  end if;
  if tg_table_name = 'cal_citas' then
    new.titulo := trim(new.titulo);
  end if;
  return new;
end $$;

drop trigger if exists cal_citas_persona on public.cal_citas;
create trigger cal_citas_persona before insert or update on public.cal_citas
  for each row execute function public.cal_valida_persona();
drop trigger if exists cal_bloqueos_persona on public.cal_bloqueos;
create trigger cal_bloqueos_persona before insert or update on public.cal_bloqueos
  for each row execute function public.cal_valida_persona();

-- Línea de tiempo del contacto y aviso a la persona asignada.
create or replace function public.cal_anota_cita()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
  v_cal text;
  v_tz text;
begin
  select c.nombre, c.zona_horaria into v_cal, v_tz from public.cal_calendarios c where c.id = new.calendario_id;

  if new.contacto_id is not null then
    if tg_op = 'INSERT' then
      v_tipo := 'cita_creada';
    elsif new.estado is distinct from old.estado then
      v_tipo := 'cita_estado';
    elsif new.inicio is distinct from old.inicio then
      v_tipo := 'cita_movida';
    elsif new.contacto_id is distinct from old.contacto_id then
      v_tipo := 'cita_creada';
    end if;
    if v_tipo is not null then
      insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle, actor_id)
      values (new.subcuenta_id, new.contacto_id, v_tipo,
              jsonb_build_object('cita_id', new.id, 'titulo', new.titulo, 'inicio', new.inicio,
                                 'estado', new.estado, 'calendario', v_cal, 'origen', new.origen),
              auth.uid());
      update public.crm_contactos set ultima_actividad = now() where id = new.contacto_id;
    end if;
  end if;

  if new.asignado_id is not null and new.asignado_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.asignado_id is distinct from old.asignado_id
          or (new.estado = 'cancelada' and old.estado <> 'cancelada')) then
    insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
    select new.asignado_id, s.agencia_id, s.id, 'alerta', 'Citas',
           case when new.estado = 'cancelada' then 'Cita cancelada: ' else 'Nueva cita: ' end || left(new.titulo, 150),
           to_char(new.inicio at time zone v_tz, 'DD/MM/YYYY HH24:MI') || ' · ' || v_cal,
           '/subcuenta/' || s.id || '/calendarios?fecha=' || to_char(new.inicio at time zone v_tz, 'YYYY-MM-DD')
    from public.subcuentas s where s.id = new.subcuenta_id;
  end if;
  return null;
end $$;

drop trigger if exists cal_citas_anota on public.cal_citas;
create trigger cal_citas_anota after insert or update of estado, inicio, contacto_id, asignado_id on public.cal_citas
  for each row execute function public.cal_anota_cita();

-- =============================================================================
-- 3 · RLS
-- Calendarios y horarios: los ve cualquiera con acceso; los configuran los
-- administradores. Citas y bloqueos: trabajo diario de todo el equipo; una
-- cita solo la borra un administrador o quien la creó.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['cal_calendarios', 'cal_horarios', 'cal_citas', 'cal_bloqueos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %1$s_lee on public.%1$s', t);
    execute format('create policy %1$s_lee on public.%1$s for select to authenticated
                    using (public.puedo_ver_subcuenta(subcuenta_id))', t);
  end loop;
  foreach t in array array['cal_calendarios', 'cal_horarios'] loop
    execute format('drop policy if exists %1$s_admin on public.%1$s', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated
                    using (public.soy_admin_subcuenta(subcuenta_id))
                    with check (public.soy_admin_subcuenta(subcuenta_id))', t);
  end loop;
  foreach t in array array['cal_citas', 'cal_bloqueos'] loop
    execute format('drop policy if exists %1$s_alta on public.%1$s', t);
    execute format('create policy %1$s_alta on public.%1$s for insert to authenticated
                    with check (public.puedo_ver_subcuenta(subcuenta_id))', t);
    execute format('drop policy if exists %1$s_edita on public.%1$s', t);
    execute format('create policy %1$s_edita on public.%1$s for update to authenticated
                    using (public.puedo_ver_subcuenta(subcuenta_id))
                    with check (public.puedo_ver_subcuenta(subcuenta_id))', t);
    execute format('drop policy if exists %1$s_borra on public.%1$s', t);
    execute format('create policy %1$s_borra on public.%1$s for delete to authenticated
                    using (creado_por = auth.uid() or public.soy_admin_subcuenta(subcuenta_id))', t);
  end loop;
end $$;

grant select, insert, update, delete on public.cal_calendarios, public.cal_horarios, public.cal_bloqueos to authenticated;
revoke update on public.cal_citas from authenticated;
grant select, insert, delete on public.cal_citas to authenticated;
grant update (calendario_id, contacto_id, asignado_id, titulo, inicio, fin, estado, notas, ubicacion)
  on public.cal_citas to authenticated;

-- =============================================================================
-- 4 · HUECOS LIBRES
-- =============================================================================

-- ¿Está libre esta persona (o el calendario, si p_usuario es null) entre
-- p_ini y p_fin? Tiene en cuenta márgenes, bloqueos y el máximo diario.
create or replace function public.cal_libre(p_cal uuid, p_usuario uuid, p_ini timestamptz, p_fin timestamptz,
                                            p_ignorar uuid default null)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare c public.cal_calendarios;
begin
  select * into c from public.cal_calendarios where id = p_cal;
  if not found then return false; end if;
  if exists (
    select 1 from public.cal_citas x
    where x.estado <> 'cancelada' and x.id is distinct from p_ignorar
      and tstzrange(x.inicio, x.fin) && tstzrange(p_ini - make_interval(mins => c.margen_antes),
                                                  p_fin + make_interval(mins => c.margen_despues))
      and (case when p_usuario is null then x.calendario_id = c.id and x.asignado_id is null
                else x.asignado_id = p_usuario end)
  ) then return false; end if;
  if exists (
    select 1 from public.cal_bloqueos b
    where b.subcuenta_id = c.subcuenta_id
      and tstzrange(b.inicio, b.fin) && tstzrange(p_ini, p_fin)
      and (b.calendario_id is null or b.calendario_id = c.id)
      and (b.usuario_id is null or b.usuario_id = p_usuario)
  ) then return false; end if;
  if c.max_por_dia is not null and (
    select count(*) from public.cal_citas x
    where x.calendario_id = c.id and x.estado <> 'cancelada' and x.id is distinct from p_ignorar
      and (x.inicio at time zone c.zona_horaria)::date = (p_ini at time zone c.zona_horaria)::date
  ) >= c.max_por_dia then return false; end if;
  return true;
end $$;

-- Horas de inicio libres entre dos fechas (en la zona del calendario) y quién
-- del equipo puede atender cada una. Máximo 62 días por consulta.
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
begin
  select * into c from public.cal_calendarios where id = p_cal;
  if not found then return; end if;
  v_hoy := (now() at time zone c.zona_horaria)::date;
  v_ini := greatest(p_desde, v_hoy);
  v_fin := least(p_hasta, v_ini + 61);
  if p_publico then v_fin := least(v_fin, v_hoy + c.dias_reserva); end if;
  if v_fin < v_ini then return; end if;
  v_minimo := now() + case when p_publico then make_interval(mins => c.antelacion_min) else interval '0' end;

  return query
  with dias as (
    select d::date as dia from generate_series(v_ini::timestamp, v_fin::timestamp, interval '1 day') d
  ), franjas as (
    select (dd.dia + h.inicio) at time zone c.zona_horaria as f_ini,
           (dd.dia + h.fin) at time zone c.zona_horaria as f_fin
    from dias dd join public.cal_horarios h on h.calendario_id = c.id and h.dia = extract(dow from dd.dia)
  ), candidatos as (
    select distinct g as ini
    from franjas f,
         generate_series(f.f_ini, f.f_fin - make_interval(mins => c.duracion_min), make_interval(mins => c.intervalo_min)) g
    where g >= v_minimo
  ), equipo as (
    select u from unnest(case when cardinality(c.equipo) = 0 then array[null::uuid] else c.equipo end) u
  )
  select k.ini, array_agg(e.u) filter (where e.u is not null)
  from candidatos k cross join equipo e
  where public.cal_libre(c.id, e.u, k.ini, k.ini + make_interval(mins => c.duracion_min))
  group by k.ini
  order by k.ini;
end $$;

revoke all on function public.cal_libre(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.cal_huecos_nucleo(uuid, date, date, boolean) from public, anon, authenticated;

-- Para el equipo (formulario de nueva cita): sin antelación ni ventana.
create or replace function public.cal_huecos_internos(p_cal uuid, p_desde date, p_hasta date)
returns table (inicio timestamptz, usuarios uuid[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cal_calendarios where id = p_cal and public.puedo_ver_subcuenta(subcuenta_id)) then
    raise exception 'No tienes acceso a este calendario.' using errcode = 'insufficient_privilege';
  end if;
  return query select * from public.cal_huecos_nucleo(p_cal, p_desde, p_hasta, false);
end $$;

-- ¿Quién atiende? De entre quienes están libres, quien menos citas tiene ese
-- día en el calendario; a igualdad, quien menos citas futuras tiene.
create or replace function public.cal_elegir_persona(p_cal uuid, p_inicio timestamptz, p_libres uuid[])
returns uuid language sql stable security definer set search_path = public as $$
  select u from unnest(p_libres) u, public.cal_calendarios c
  where c.id = p_cal
  order by (select count(*) from public.cal_citas x where x.calendario_id = c.id and x.asignado_id = u
              and x.estado <> 'cancelada'
              and (x.inicio at time zone c.zona_horaria)::date = (p_inicio at time zone c.zona_horaria)::date),
           (select count(*) from public.cal_citas x where x.asignado_id = u and x.estado <> 'cancelada' and x.inicio > now()),
           u
  limit 1;
$$;
revoke all on function public.cal_elegir_persona(uuid, timestamptz, uuid[]) from public, anon, authenticated;

-- =============================================================================
-- 5 · RESERVA PÚBLICA
-- =============================================================================
create or replace function public.cal_publico(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nombre', c.nombre, 'descripcion', c.descripcion, 'duracion_min', c.duracion_min, 'color', c.color,
    'zona_horaria', c.zona_horaria, 'ubicacion', c.ubicacion, 'dias_reserva', c.dias_reserva,
    'empresa', s.nombre, 'logo_url', coalesce(s.logo_url, a.logo_url),
    'privacidad', nullif(a.url_privacidad, ''), 'terminos', nullif(a.url_terminos, ''))
  from public.cal_calendarios c
  join public.subcuentas s on s.id = c.subcuenta_id
  join public.agencias a on a.id = s.agencia_id
  where c.slug = lower(p_slug) and c.activo and s.estado = 'activa';
$$;

create or replace function public.cal_huecos(p_slug text, p_desde date, p_hasta date)
returns setof timestamptz language plpgsql stable security definer set search_path = public as $$
declare v_cal uuid;
begin
  select c.id into v_cal from public.cal_calendarios c join public.subcuentas s on s.id = c.subcuenta_id
  where c.slug = lower(p_slug) and c.activo and s.estado = 'activa';
  if v_cal is null then return; end if;
  return query select h.inicio from public.cal_huecos_nucleo(v_cal, p_desde, p_hasta, true) h;
end $$;

create or replace function public.cal_reservar(p_slug text, p_inicio timestamptz, p_nombre text, p_apellidos text,
                                               p_email text, p_telefono text default '', p_notas text default '')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  c public.cal_calendarios;
  s public.subcuentas;
  v_dia date;
  v_libres uuid[];
  v_persona uuid;
  v_contacto uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_cita uuid;
  v_fin timestamptz;
begin
  select cc.* into c from public.cal_calendarios cc join public.subcuentas ss on ss.id = cc.subcuenta_id
  where cc.slug = lower(p_slug) and cc.activo and ss.estado = 'activa'
  for update of cc; -- serializa las reservas del mismo calendario
  if not found then
    raise exception 'Este calendario no existe o no admite reservas.' using errcode = 'no_data_found';
  end if;
  select * into s from public.subcuentas where id = c.subcuenta_id;

  if length(trim(coalesce(p_nombre, ''))) not between 1 and 100 then
    raise exception 'Escribe tu nombre.' using errcode = 'check_violation';
  end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Escribe un correo electrónico válido.' using errcode = 'check_violation';
  end if;
  if v_tel <> '' and left(v_tel, 1) <> '+' then v_tel := s.prefijo || ltrim(v_tel, '0'); end if;
  if v_tel !~ '^\+?[0-9]{0,15}$' then
    raise exception 'El teléfono no es válido.' using errcode = 'check_violation';
  end if;
  if length(coalesce(p_notas, '')) > 2000 then
    raise exception 'El mensaje es demasiado largo.' using errcode = 'check_violation';
  end if;

  v_dia := (p_inicio at time zone c.zona_horaria)::date;
  select h.usuarios into v_libres from public.cal_huecos_nucleo(c.id, v_dia, v_dia, true) h where h.inicio = p_inicio;
  if not found then
    raise exception 'Esa hora ya no está disponible. Elige otra.' using errcode = 'check_violation', hint = 'HUECO_OCUPADO';
  end if;
  v_persona := public.cal_elegir_persona(c.id, p_inicio, v_libres);
  v_fin := p_inicio + make_interval(mins => c.duracion_min);

  -- El contacto se reutiliza por correo; si no existe, se crea.
  select id into v_contacto from public.crm_contactos where subcuenta_id = c.subcuenta_id and email = v_email;
  if v_contacto is null then
    insert into public.crm_contactos (subcuenta_id, nombre, apellidos, email, telefono, fuente, propietario_id)
    values (c.subcuenta_id, left(trim(p_nombre), 100), left(trim(coalesce(p_apellidos, '')), 100), v_email, v_tel,
            left('Calendario: ' || c.nombre, 100), v_persona)
    returning id into v_contacto;
  else
    update public.crm_contactos set
      telefono = case when telefono = '' then v_tel else telefono end,
      nombre = case when nombre = '' then left(trim(p_nombre), 100) else nombre end
    where id = v_contacto;
  end if;

  if (select count(*) from public.cal_citas where contacto_id = v_contacto and calendario_id = c.id
        and estado <> 'cancelada' and inicio > now()) >= 3 then
    raise exception 'Ya tienes varias citas pendientes en este calendario.' using errcode = 'check_violation';
  end if;

  insert into public.cal_citas (subcuenta_id, calendario_id, contacto_id, asignado_id, titulo, inicio, fin,
                                estado, notas, ubicacion, origen, creado_por)
  values (c.subcuenta_id, c.id, v_contacto, v_persona,
          left(c.nombre || ' · ' || trim(p_nombre || ' ' || coalesce(p_apellidos, '')), 200),
          p_inicio, v_fin, 'confirmada', coalesce(p_notas, ''), c.ubicacion, 'reserva', null)
  returning id into v_cita;

  return jsonb_build_object('cita_id', v_cita, 'inicio', p_inicio, 'fin', v_fin,
                            'zona_horaria', c.zona_horaria, 'confirmacion', c.confirmacion, 'ubicacion', c.ubicacion);
end $$;

revoke all on function public.cal_publico(text) from public;
revoke all on function public.cal_huecos(text, date, date) from public;
revoke all on function public.cal_reservar(text, timestamptz, text, text, text, text, text) from public;
revoke all on function public.cal_huecos_internos(uuid, date, date) from public, anon;
grant execute on function public.cal_publico(text) to anon, authenticated;
grant execute on function public.cal_huecos(text, date, date) to anon, authenticated;
grant execute on function public.cal_reservar(text, timestamptz, text, text, text, text, text) to anon, authenticated;
grant execute on function public.cal_huecos_internos(uuid, date, date) to authenticated;

-- =============================================================================
-- 6 · HORARIO SEMANAL EN UNA SOLA OPERACIÓN
-- Sustituye todas las franjas de un calendario. Corre con los permisos de quien
-- llama (RLS: solo administradores). p_franjas = [{"dia":1,"inicio":"09:00","fin":"14:00"}, …]
-- =============================================================================
create or replace function public.cal_guardar_horario(p_cal uuid, p_franjas jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_sub uuid;
  v_n int;
begin
  select subcuenta_id into v_sub from public.cal_calendarios where id = p_cal;
  if v_sub is null or not public.soy_admin_subcuenta(v_sub) then
    raise exception 'No tienes permiso para cambiar este calendario.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_franjas) <> 'array' or jsonb_array_length(p_franjas) > 70 then
    raise exception 'Horario no válido.' using errcode = 'check_violation';
  end if;
  -- Franjas del mismo día que se pisan: error claro en vez de huecos duplicados.
  if exists (
    select 1 from jsonb_to_recordset(p_franjas) a(dia int, inicio time, fin time)
    join jsonb_to_recordset(p_franjas) b(dia int, inicio time, fin time)
      on a.dia = b.dia and (a.inicio, a.fin) <> (b.inicio, b.fin) and a.inicio < b.fin and b.inicio < a.fin
  ) then
    raise exception 'Hay franjas del mismo día que se solapan.' using errcode = 'check_violation';
  end if;
  delete from public.cal_horarios where calendario_id = p_cal;
  insert into public.cal_horarios (subcuenta_id, calendario_id, dia, inicio, fin)
  select distinct v_sub, p_cal, f.dia, f.inicio, f.fin from jsonb_to_recordset(p_franjas) f(dia int, inicio time, fin time);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.cal_guardar_horario(uuid, jsonb) from public, anon;
grant execute on function public.cal_guardar_horario(uuid, jsonb) to authenticated;
