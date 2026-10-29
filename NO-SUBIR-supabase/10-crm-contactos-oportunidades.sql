-- =============================================================================
-- 10 · CRM DE LA SUBCUENTA: CONTACTOS, EMPRESAS, CAMPOS PERSONALIZADOS,
--      LISTAS INTELIGENTES, NOTAS, TAREAS, ACCIONES EN LOTE Y OPORTUNIDADES
--
-- Requiere 09-agencias-subcuentas.sql. Idempotente.
--
-- Todas las tablas llevan el prefijo crm_ para no chocar con las del panel
-- HTML antiguo (contactos, expedientes…), que viven en el mismo proyecto.
--
-- AISLAMIENTO
--   Cada fila cuelga de subcuenta_id y RLS usa public.puedo_ver_subcuenta().
--   Las referencias entre tablas son claves foráneas COMPUESTAS
--   (id, subcuenta_id): es imposible colgar una nota, tarea u oportunidad de
--   un contacto de otra subcuenta, aunque alguien conozca su id.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- =============================================================================
-- 1 · EMPRESAS
-- =============================================================================
create table if not exists public.crm_empresas (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 160),
  email        text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono     text not null default '',
  web          text not null default '',
  direccion    text not null default '',
  ciudad       text not null default '',
  pais         text not null default '',
  creado_por   uuid references auth.users(id) on delete set null,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  unique (id, subcuenta_id)
);
create unique index if not exists crm_empresas_nombre_uidx on public.crm_empresas(subcuenta_id, lower(nombre));

-- =============================================================================
-- 2 · CAMPOS PERSONALIZADOS
-- Los valores se guardan en crm_contactos.campos (jsonb) bajo la clave.
-- =============================================================================
create table if not exists public.crm_campos (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  clave        text not null check (clave ~ '^[a-z][a-z0-9_]{0,49}$'),
  nombre       text not null check (length(trim(nombre)) between 1 and 80),
  tipo         text not null check (tipo in ('texto', 'texto_largo', 'numero', 'moneda', 'fecha', 'lista',
                                             'casillas', 'si_no', 'telefono', 'email', 'url')),
  opciones     text[] not null default '{}',
  carpeta      text not null default 'Información adicional' check (length(trim(carpeta)) between 1 and 60),
  orden        int not null default 0,
  creado       timestamptz not null default now(),
  unique (subcuenta_id, clave),
  check (tipo not in ('lista', 'casillas') or cardinality(opciones) > 0)
);

-- =============================================================================
-- 3 · CONTACTOS
-- =============================================================================
create table if not exists public.crm_contactos (
  id               uuid primary key default gen_random_uuid(),
  subcuenta_id     uuid not null references public.subcuentas(id) on delete cascade,
  nombre           text not null default '' check (length(nombre) <= 100),
  apellidos        text not null default '' check (length(apellidos) <= 100),
  email            text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefono         text not null default '' check (telefono ~ '^\+?[0-9]{0,15}$'),
  empresa_id       uuid,
  tipo             text not null default 'lead' check (tipo in ('lead', 'cliente')),
  fuente           text not null default '' check (length(fuente) <= 100),
  direccion        text not null default '',
  ciudad           text not null default '',
  provincia        text not null default '',
  codigo_postal    text not null default '',
  pais             text not null default '',
  web              text not null default '',
  fecha_nacimiento date,
  zona_horaria     text not null default '',
  propietario_id   uuid references auth.users(id) on delete set null,
  etiquetas        text[] not null default '{}',
  dnd              boolean not null default false,
  dnd_canales      text[] not null default '{}'
                   check (dnd_canales <@ array['email', 'sms', 'llamada', 'whatsapp']::text[]),
  campos           jsonb not null default '{}'::jsonb check (jsonb_typeof(campos) = 'object'),
  ultima_actividad timestamptz,
  creado_por       uuid references auth.users(id) on delete set null,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now(),
  busqueda         text generated always as (
                     lower(nombre || ' ' || apellidos || ' ' || coalesce(email, '') || ' ' || telefono)
                   ) stored,
  unique (id, subcuenta_id),
  foreign key (empresa_id, subcuenta_id) references public.crm_empresas(id, subcuenta_id)
    on delete set null (empresa_id),
  -- Un contacto necesita al menos algo con lo que identificarlo.
  check (nombre <> '' or apellidos <> '' or email is not null or telefono <> '')
);
create index if not exists crm_contactos_sub_creado_idx on public.crm_contactos(subcuenta_id, creado desc);
create index if not exists crm_contactos_busqueda_idx on public.crm_contactos using gin (busqueda extensions.gin_trgm_ops);
create index if not exists crm_contactos_etiquetas_idx on public.crm_contactos using gin (etiquetas);
create unique index if not exists crm_contactos_email_uidx on public.crm_contactos(subcuenta_id, lower(email)) where email is not null;
create index if not exists crm_contactos_telefono_idx on public.crm_contactos(subcuenta_id, telefono) where telefono <> '';

-- Catálogo de etiquetas de la subcuenta (se rellena solo con las que se usan).
create table if not exists public.crm_etiquetas (
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 60),
  creado       timestamptz not null default now(),
  primary key (subcuenta_id, nombre)
);

-- =============================================================================
-- 4 · NOTAS, TAREAS Y LÍNEA DE TIEMPO
-- =============================================================================
create table if not exists public.crm_notas (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null,
  contacto_id  uuid not null,
  cuerpo       text not null check (length(trim(cuerpo)) between 1 and 10000),
  autor_id     uuid default auth.uid() references auth.users(id) on delete set null,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists crm_notas_contacto_idx on public.crm_notas(contacto_id, creado desc);

create table if not exists public.crm_tareas (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  contacto_id  uuid,
  titulo       text not null check (length(trim(titulo)) between 1 and 200),
  descripcion  text not null default '' check (length(descripcion) <= 5000),
  vence        timestamptz,
  asignado_id  uuid references auth.users(id) on delete set null,
  completada   timestamptz,
  creado_por   uuid default auth.uid() references auth.users(id) on delete set null,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists crm_tareas_sub_idx on public.crm_tareas(subcuenta_id, completada, vence);
create index if not exists crm_tareas_contacto_idx on public.crm_tareas(contacto_id);

create table if not exists public.crm_eventos (
  id           bigint generated always as identity primary key,
  subcuenta_id uuid not null,
  contacto_id  uuid not null,
  tipo         text not null,
  detalle      jsonb not null default '{}'::jsonb,
  actor_id     uuid references auth.users(id) on delete set null,
  ts           timestamptz not null default now(),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists crm_eventos_contacto_idx on public.crm_eventos(contacto_id, ts desc);

-- =============================================================================
-- 5 · LISTAS INTELIGENTES Y ACCIONES EN LOTE
-- =============================================================================
create table if not exists public.crm_listas (
  id             uuid primary key default gen_random_uuid(),
  subcuenta_id   uuid not null references public.subcuentas(id) on delete cascade,
  nombre         text not null check (length(trim(nombre)) between 1 and 60),
  filtros        jsonb not null default '[]'::jsonb check (jsonb_typeof(filtros) = 'array'),
  busqueda       text not null default '',
  orden          text not null default 'creado.desc',
  columnas       text[] not null default '{}',
  compartida     boolean not null default true,
  propietario_id uuid default auth.uid() references auth.users(id) on delete cascade,
  creado         timestamptz not null default now()
);

create table if not exists public.crm_acciones_lote (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  etiqueta     text not null check (length(trim(etiqueta)) between 1 and 200),
  operacion    text not null check (operacion in ('exportar', 'importar', 'añadir_etiqueta', 'quitar_etiqueta',
                                                   'asignar_propietario', 'borrar')),
  estado       text not null default 'completada' check (estado in ('en_curso', 'completada', 'error')),
  usuario_id   uuid default auth.uid() references auth.users(id) on delete set null,
  total        int not null default 0,
  correctos    int not null default 0,
  errores      int not null default 0,
  detalle      jsonb not null default '{}'::jsonb,
  creado       timestamptz not null default now(),
  completado   timestamptz
);
create index if not exists crm_acciones_lote_sub_idx on public.crm_acciones_lote(subcuenta_id, creado desc);

-- =============================================================================
-- 6 · OPORTUNIDADES (embudos, etapas y oportunidades)
-- =============================================================================
create table if not exists public.crm_embudos (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 80),
  orden        int not null default 0,
  creado       timestamptz not null default now(),
  unique (id, subcuenta_id)
);

create table if not exists public.crm_etapas (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null,
  embudo_id    uuid not null,
  nombre       text not null check (length(trim(nombre)) between 1 and 80),
  orden        int not null default 0,
  creado       timestamptz not null default now(),
  unique (id, embudo_id),
  foreign key (embudo_id, subcuenta_id) references public.crm_embudos(id, subcuenta_id) on delete cascade
);
create index if not exists crm_etapas_embudo_idx on public.crm_etapas(embudo_id, orden);

create table if not exists public.crm_oportunidades (
  id             uuid primary key default gen_random_uuid(),
  subcuenta_id   uuid not null,
  embudo_id      uuid not null,
  etapa_id       uuid not null,
  contacto_id    uuid not null,
  nombre         text not null check (length(trim(nombre)) between 1 and 160),
  valor          numeric(14,2) not null default 0 check (valor >= 0),
  estado         text not null default 'abierta' check (estado in ('abierta', 'ganada', 'perdida', 'abandonada')),
  propietario_id uuid references auth.users(id) on delete set null,
  fuente         text not null default '' check (length(fuente) <= 100),
  motivo_perdida text not null default '' check (length(motivo_perdida) <= 300),
  posicion       double precision not null default 0,
  etapa_desde    timestamptz not null default now(),
  cerrada_en     timestamptz,
  creado_por     uuid default auth.uid() references auth.users(id) on delete set null,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now(),
  foreign key (embudo_id, subcuenta_id) references public.crm_embudos(id, subcuenta_id) on delete cascade,
  foreign key (etapa_id, embudo_id) references public.crm_etapas(id, embudo_id),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists crm_oportunidades_tablero_idx on public.crm_oportunidades(embudo_id, etapa_id, posicion);
create index if not exists crm_oportunidades_contacto_idx on public.crm_oportunidades(contacto_id);
create index if not exists crm_oportunidades_sub_creado_idx on public.crm_oportunidades(subcuenta_id, creado);

-- =============================================================================
-- 7 · DISPARADORES
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['crm_empresas', 'crm_contactos', 'crm_notas', 'crm_tareas', 'crm_oportunidades'] loop
    execute format('drop trigger if exists %1$s_actualizado on public.%1$s', t);
    execute format('create trigger %1$s_actualizado before update on public.%1$s
                    for each row execute function public.toca_actualizado()', t);
  end loop;
end $$;

-- Normaliza etiquetas (sin espacios sobrantes, sin repetidas, sin vacías) y
-- el correo, y alimenta el catálogo de etiquetas.
create or replace function public.crm_normaliza_contacto()
returns trigger language plpgsql as $$
begin
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.nombre := trim(new.nombre);
  new.apellidos := trim(new.apellidos);
  new.etiquetas := coalesce((
    select array_agg(e order by e) from (
      select distinct left(regexp_replace(trim(x), '\s+', ' ', 'g'), 60) as e
      from unnest(new.etiquetas) x where trim(x) <> ''
    ) s), '{}');
  return new;
end $$;

drop trigger if exists crm_contactos_normaliza on public.crm_contactos;
create trigger crm_contactos_normaliza before insert or update on public.crm_contactos
  for each row execute function public.crm_normaliza_contacto();

create or replace function public.crm_catalogo_etiquetas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.crm_etiquetas (subcuenta_id, nombre)
  select new.subcuenta_id, e from unnest(new.etiquetas) e
  on conflict do nothing;
  return null;
end $$;

drop trigger if exists crm_contactos_catalogo on public.crm_contactos;
create trigger crm_contactos_catalogo after insert or update of etiquetas on public.crm_contactos
  for each row execute function public.crm_catalogo_etiquetas();

-- El propietario de un contacto u oportunidad tiene que poder ver la subcuenta.
create or replace function public.crm_valida_asignado()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_usuario uuid;
begin
  v_usuario := (to_jsonb(new) ->> case tg_table_name when 'crm_tareas' then 'asignado_id' else 'propietario_id' end)::uuid;
  if v_usuario is not null and not public.usuario_ve_subcuenta(v_usuario, new.subcuenta_id) then
    raise exception 'La persona asignada no tiene acceso a esta subcuenta.'
      using errcode = 'check_violation', hint = 'ASIGNADO_SIN_ACCESO';
  end if;
  return new;
end $$;

-- Igual que puedo_ver_subcuenta pero para cualquier usuario (no solo el actual).
create or replace function public.usuario_ve_subcuenta(p_usuario uuid, p_subcuenta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subcuentas s
    join public.agencia_miembros am on am.agencia_id = s.agencia_id
    where s.id = p_subcuenta and am.usuario_id = p_usuario and am.rol in ('propietario', 'admin')
  ) or exists (
    select 1 from public.subcuenta_miembros sm
    where sm.subcuenta_id = p_subcuenta and sm.usuario_id = p_usuario
  );
$$;

drop trigger if exists crm_contactos_asignado on public.crm_contactos;
create trigger crm_contactos_asignado before insert or update of propietario_id on public.crm_contactos
  for each row execute function public.crm_valida_asignado();
drop trigger if exists crm_oportunidades_asignado on public.crm_oportunidades;
create trigger crm_oportunidades_asignado before insert or update of propietario_id on public.crm_oportunidades
  for each row execute function public.crm_valida_asignado();
drop trigger if exists crm_tareas_asignado on public.crm_tareas;
create trigger crm_tareas_asignado before insert or update of asignado_id on public.crm_tareas
  for each row execute function public.crm_valida_asignado();

-- Oportunidad: fecha de cierre coherente y fecha de entrada en la etapa.
create or replace function public.crm_estado_oportunidad()
returns trigger language plpgsql as $$
begin
  if new.estado = 'abierta' then
    new.cerrada_en := null;
  elsif tg_op = 'INSERT' or old.estado is distinct from new.estado then
    new.cerrada_en := now();
  end if;
  if tg_op = 'UPDATE' and new.etapa_id is distinct from old.etapa_id then
    new.etapa_desde := now();
  end if;
  return new;
end $$;

drop trigger if exists crm_oportunidades_estado on public.crm_oportunidades;
create trigger crm_oportunidades_estado before insert or update on public.crm_oportunidades
  for each row execute function public.crm_estado_oportunidad();

-- Línea de tiempo del contacto + última actividad.
create or replace function public.crm_anota_evento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_contacto uuid;
  v_sub uuid;
  v_tipo text;
  v_detalle jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'crm_contactos' then
    v_contacto := new.id; v_sub := new.subcuenta_id;
    if tg_op = 'INSERT' then
      v_tipo := 'contacto_creado';
    elsif new.etiquetas is distinct from old.etiquetas then
      v_tipo := 'etiquetas';
      v_detalle := jsonb_build_object(
        'añadidas', (select coalesce(jsonb_agg(e), '[]') from unnest(new.etiquetas) e where not e = any(old.etiquetas)),
        'quitadas', (select coalesce(jsonb_agg(e), '[]') from unnest(old.etiquetas) e where not e = any(new.etiquetas)));
    elsif new.dnd is distinct from old.dnd then
      v_tipo := case when new.dnd then 'dnd_activado' else 'dnd_desactivado' end;
    elsif new.propietario_id is distinct from old.propietario_id then
      v_tipo := 'propietario';
      v_detalle := jsonb_build_object('propietario_id', new.propietario_id);
    else
      return null;
    end if;
  elsif tg_table_name = 'crm_notas' then
    v_contacto := new.contacto_id; v_sub := new.subcuenta_id; v_tipo := 'nota';
    v_detalle := jsonb_build_object('nota_id', new.id, 'extracto', left(new.cuerpo, 140));
  elsif tg_table_name = 'crm_tareas' then
    if new.contacto_id is null then return null; end if;
    v_contacto := new.contacto_id; v_sub := new.subcuenta_id;
    if tg_op = 'INSERT' then
      v_tipo := 'tarea_creada';
    elsif new.completada is not null and old.completada is null then
      v_tipo := 'tarea_completada';
    else
      return null;
    end if;
    v_detalle := jsonb_build_object('tarea_id', new.id, 'titulo', new.titulo);
  elsif tg_table_name = 'crm_oportunidades' then
    v_contacto := new.contacto_id; v_sub := new.subcuenta_id;
    if tg_op = 'INSERT' then
      v_tipo := 'oportunidad_creada';
    elsif new.etapa_id is distinct from old.etapa_id then
      v_tipo := 'oportunidad_etapa';
    elsif new.estado is distinct from old.estado then
      v_tipo := 'oportunidad_estado';
    else
      return null;
    end if;
    v_detalle := jsonb_build_object('oportunidad_id', new.id, 'nombre', new.nombre, 'estado', new.estado,
      'etapa', (select nombre from public.crm_etapas where id = new.etapa_id), 'valor', new.valor);
  end if;

  insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle, actor_id)
  values (v_sub, v_contacto, v_tipo, v_detalle, auth.uid());
  update public.crm_contactos set ultima_actividad = now() where id = v_contacto;
  return null;
end $$;

drop trigger if exists crm_contactos_evento on public.crm_contactos;
create trigger crm_contactos_evento after insert or update of etiquetas, dnd, propietario_id on public.crm_contactos
  for each row execute function public.crm_anota_evento();
drop trigger if exists crm_notas_evento on public.crm_notas;
create trigger crm_notas_evento after insert on public.crm_notas
  for each row execute function public.crm_anota_evento();
drop trigger if exists crm_tareas_evento on public.crm_tareas;
create trigger crm_tareas_evento after insert or update of completada on public.crm_tareas
  for each row execute function public.crm_anota_evento();
drop trigger if exists crm_oportunidades_evento on public.crm_oportunidades;
create trigger crm_oportunidades_evento after insert or update of etapa_id, estado on public.crm_oportunidades
  for each row execute function public.crm_anota_evento();

-- Avisa a quien se le asigna una tarea.
create or replace function public.crm_notifica_tarea()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.asignado_id is not null and new.asignado_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.asignado_id is distinct from old.asignado_id) then
    insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
    select new.asignado_id, s.agencia_id, s.id, 'alerta', 'Tareas', 'Nueva tarea: ' || left(new.titulo, 150),
           coalesce('Vence el ' || to_char(new.vence at time zone s.zona_horaria, 'DD/MM/YYYY HH24:MI'), 'Sin fecha de vencimiento'),
           '/subcuenta/' || s.id || '/contactos/tareas'
    from public.subcuentas s where s.id = new.subcuenta_id;
  end if;
  return null;
end $$;

drop trigger if exists crm_tareas_notifica on public.crm_tareas;
create trigger crm_tareas_notifica after insert or update of asignado_id on public.crm_tareas
  for each row execute function public.crm_notifica_tarea();

-- Toda subcuenta nueva nace con un embudo de ventas listo para usar.
create or replace function public.crm_embudo_inicial()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_embudo uuid;
begin
  insert into public.crm_embudos (subcuenta_id, nombre, orden)
  values (new.id, 'Embudo de ventas', 0) returning id into v_embudo;
  insert into public.crm_etapas (subcuenta_id, embudo_id, nombre, orden)
  select new.id, v_embudo, e, o
  from unnest(array['Nuevo lead', 'Contactado', 'Propuesta enviada', 'Negociación', 'Cerrado']) with ordinality as t(e, o);
  return null;
end $$;

drop trigger if exists subcuentas_embudo_inicial on public.subcuentas;
create trigger subcuentas_embudo_inicial after insert on public.subcuentas
  for each row execute function public.crm_embudo_inicial();

-- =============================================================================
-- 8 · RLS
-- Trabajo diario (contactos, notas, tareas, oportunidades): cualquiera con
-- acceso a la subcuenta. Configuración (campos, embudos, etapas) y borrado de
-- contactos: solo administradores. Una nota solo la edita o borra su autor o
-- un administrador. Las listas privadas solo las ve su dueño.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['crm_empresas', 'crm_campos', 'crm_contactos', 'crm_etiquetas', 'crm_notas', 'crm_tareas',
                           'crm_eventos', 'crm_listas', 'crm_acciones_lote', 'crm_embudos', 'crm_etapas', 'crm_oportunidades'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Lectura común a todas
do $$
declare t text;
begin
  foreach t in array array['crm_empresas', 'crm_campos', 'crm_contactos', 'crm_etiquetas', 'crm_notas', 'crm_tareas',
                           'crm_eventos', 'crm_acciones_lote', 'crm_embudos', 'crm_etapas', 'crm_oportunidades'] loop
    execute format('drop policy if exists %1$s_lee on public.%1$s', t);
    execute format('create policy %1$s_lee on public.%1$s for select to authenticated
                    using (public.puedo_ver_subcuenta(subcuenta_id))', t);
  end loop;
end $$;

-- Escritura para cualquiera con acceso
do $$
declare t text;
begin
  foreach t in array array['crm_empresas', 'crm_contactos', 'crm_tareas', 'crm_oportunidades'] loop
    execute format('drop policy if exists %1$s_alta on public.%1$s', t);
    execute format('create policy %1$s_alta on public.%1$s for insert to authenticated
                    with check (public.puedo_ver_subcuenta(subcuenta_id))', t);
    execute format('drop policy if exists %1$s_edita on public.%1$s', t);
    execute format('create policy %1$s_edita on public.%1$s for update to authenticated
                    using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id))', t);
  end loop;
end $$;

drop policy if exists crm_tareas_borra on public.crm_tareas;
create policy crm_tareas_borra on public.crm_tareas for delete to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists crm_oportunidades_borra on public.crm_oportunidades;
create policy crm_oportunidades_borra on public.crm_oportunidades for delete to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists crm_contactos_borra on public.crm_contactos;
create policy crm_contactos_borra on public.crm_contactos for delete to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id));
drop policy if exists crm_empresas_borra on public.crm_empresas;
create policy crm_empresas_borra on public.crm_empresas for delete to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id));

-- Notas: crea cualquiera con acceso (como sí mismo); edita/borra autor o admin.
drop policy if exists crm_notas_alta on public.crm_notas;
create policy crm_notas_alta on public.crm_notas for insert to authenticated
  with check (public.puedo_ver_subcuenta(subcuenta_id) and autor_id = auth.uid());
drop policy if exists crm_notas_edita on public.crm_notas;
create policy crm_notas_edita on public.crm_notas for update to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id) and (autor_id = auth.uid() or public.soy_admin_subcuenta(subcuenta_id)))
  with check (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists crm_notas_borra on public.crm_notas;
create policy crm_notas_borra on public.crm_notas for delete to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id) and (autor_id = auth.uid() or public.soy_admin_subcuenta(subcuenta_id)));

-- Configuración: solo administradores.
do $$
declare t text;
begin
  foreach t in array array['crm_campos', 'crm_embudos', 'crm_etapas'] loop
    execute format('drop policy if exists %1$s_escribe on public.%1$s', t);
    execute format('create policy %1$s_escribe on public.%1$s for all to authenticated
                    using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id))', t);
  end loop;
end $$;

drop policy if exists crm_etiquetas_borra on public.crm_etiquetas;
create policy crm_etiquetas_borra on public.crm_etiquetas for delete to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id));

-- Listas inteligentes: compartidas visibles para todos; privadas solo para su dueño.
drop policy if exists crm_listas_lee on public.crm_listas;
create policy crm_listas_lee on public.crm_listas for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id) and (compartida or propietario_id = auth.uid()));
drop policy if exists crm_listas_alta on public.crm_listas;
create policy crm_listas_alta on public.crm_listas for insert to authenticated
  with check (public.puedo_ver_subcuenta(subcuenta_id) and propietario_id = auth.uid());
drop policy if exists crm_listas_edita on public.crm_listas;
create policy crm_listas_edita on public.crm_listas for update to authenticated
  using (propietario_id = auth.uid() or public.soy_admin_subcuenta(subcuenta_id))
  with check (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists crm_listas_borra on public.crm_listas;
create policy crm_listas_borra on public.crm_listas for delete to authenticated
  using (propietario_id = auth.uid() or public.soy_admin_subcuenta(subcuenta_id));

-- Acciones en lote: las registra quien las hace.
drop policy if exists crm_acciones_lote_alta on public.crm_acciones_lote;
create policy crm_acciones_lote_alta on public.crm_acciones_lote for insert to authenticated
  with check (public.puedo_ver_subcuenta(subcuenta_id) and usuario_id = auth.uid());
drop policy if exists crm_acciones_lote_edita on public.crm_acciones_lote;
create policy crm_acciones_lote_edita on public.crm_acciones_lote for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

grant select, insert, update, delete on public.crm_empresas, public.crm_notas, public.crm_tareas,
  public.crm_oportunidades, public.crm_campos, public.crm_embudos, public.crm_etapas, public.crm_listas to authenticated;
-- Contactos: se puede actualizar todo salvo lo que mantienen los disparadores
-- (ultima_actividad, creado, subcuenta_id). Un REVOKE de columna no anula un
-- GRANT de tabla, así que se concede columna a columna.
revoke update on public.crm_contactos from authenticated;
grant select, insert, delete on public.crm_contactos to authenticated;
grant update (nombre, apellidos, email, telefono, empresa_id, tipo, fuente, direccion, ciudad, provincia, codigo_postal,
              pais, web, fecha_nacimiento, zona_horaria, propietario_id, etiquetas, dnd, dnd_canales, campos)
  on public.crm_contactos to authenticated;
grant select, delete on public.crm_etiquetas to authenticated;
grant select on public.crm_eventos to authenticated;
grant select, insert, update on public.crm_acciones_lote to authenticated;

-- =============================================================================
-- 9 · FUNCIONES PARA LA APLICACIÓN
-- =============================================================================

-- Personas a las que se puede asignar algo en la subcuenta: su equipo y los
-- administradores de la agencia.
create or replace function public.usuarios_asignables(p_subcuenta uuid)
returns table (usuario_id uuid, email text, nombre text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select distinct on (u.id) u.id, u.email::text,
           coalesce(u.raw_user_meta_data ->> 'nombre', u.raw_user_meta_data ->> 'full_name', '')::text
    from auth.users u
    where u.id in (
      select sm.usuario_id from public.subcuenta_miembros sm where sm.subcuenta_id = p_subcuenta
      union
      select am.usuario_id from public.agencia_miembros am
      join public.subcuentas s on s.agencia_id = am.agencia_id
      where s.id = p_subcuenta and am.rol in ('propietario', 'admin')
    )
    order by u.id;
end $$;

-- Acciones masivas sobre una selección de contactos (máx. 5.000 por llamada).
-- Corre con los permisos de quien llama (security invoker): RLS sigue mandando.
create or replace function public.crm_contactos_lote(p_subcuenta uuid, p_ids uuid[], p_operacion text, p_valor text default null)
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_n int := 0;
begin
  if cardinality(p_ids) > 5000 then
    raise exception 'Máximo 5.000 contactos por operación.' using errcode = 'check_violation';
  end if;
  if p_operacion = 'añadir_etiqueta' then
    if coalesce(trim(p_valor), '') = '' then raise exception 'Falta la etiqueta.'; end if;
    update public.crm_contactos set etiquetas = array_append(etiquetas, trim(p_valor))
    where subcuenta_id = p_subcuenta and id = any(p_ids) and not trim(p_valor) = any(etiquetas);
  elsif p_operacion = 'quitar_etiqueta' then
    update public.crm_contactos set etiquetas = array_remove(etiquetas, trim(p_valor))
    where subcuenta_id = p_subcuenta and id = any(p_ids) and trim(p_valor) = any(etiquetas);
  elsif p_operacion = 'asignar_propietario' then
    update public.crm_contactos set propietario_id = nullif(p_valor, '')::uuid
    where subcuenta_id = p_subcuenta and id = any(p_ids);
  elsif p_operacion = 'borrar' then
    delete from public.crm_contactos where subcuenta_id = p_subcuenta and id = any(p_ids);
  else
    raise exception 'Operación no válida: %', p_operacion using errcode = 'check_violation';
  end if;
  get diagnostics v_n = row_count;

  insert into public.crm_acciones_lote (subcuenta_id, etiqueta, operacion, total, correctos, errores, detalle, completado)
  values (p_subcuenta,
          to_char(now(), 'DD_Mon_YYYY_HH24_MI'),
          p_operacion, cardinality(p_ids), v_n, cardinality(p_ids) - v_n,
          jsonb_build_object('valor', p_valor), now());
  return v_n;
end $$;

-- Mueve una oportunidad (arrastrar y soltar): etapa + posición en la columna.
create or replace function public.crm_mover_oportunidad(p_oportunidad uuid, p_etapa uuid, p_posicion double precision)
returns void language plpgsql security invoker set search_path = public as $$
declare v_n int;
begin
  update public.crm_oportunidades o
  set etapa_id = p_etapa, posicion = p_posicion
  where o.id = p_oportunidad
    and exists (select 1 from public.crm_etapas e where e.id = p_etapa and e.embudo_id = o.embudo_id);
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'No se pudo mover: la etapa no pertenece a este embudo o no tienes acceso.'
      using errcode = 'check_violation';
  end if;
end $$;

-- Borra una etapa trasladando antes sus oportunidades a otra del mismo embudo.
create or replace function public.crm_borrar_etapa(p_etapa uuid, p_destino uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_embudo uuid;
begin
  select embudo_id into v_embudo from public.crm_etapas where id = p_etapa;
  if v_embudo is null then raise exception 'La etapa no existe.'; end if;
  if exists (select 1 from public.crm_oportunidades where etapa_id = p_etapa) then
    if p_destino is null or p_destino = p_etapa
       or not exists (select 1 from public.crm_etapas where id = p_destino and embudo_id = v_embudo) then
      raise exception 'Elige otra etapa del mismo embudo para mover sus oportunidades.' using errcode = 'check_violation';
    end if;
    update public.crm_oportunidades set etapa_id = p_destino where etapa_id = p_etapa;
  end if;
  delete from public.crm_etapas where id = p_etapa;
  if not found then raise exception 'No tienes permiso para borrar etapas.' using errcode = 'insufficient_privilege'; end if;
end $$;

-- Datos de los widgets del tablero de la subcuenta.
--   p_desde/p_hasta filtran por fecha de creación de la oportunidad.
create or replace function public.crm_tablero(p_subcuenta uuid, p_desde timestamptz, p_hasta timestamptz,
                                              p_embudo_estado uuid default null, p_embudo_etapas uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v jsonb;
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;

  with ops as (
    select * from public.crm_oportunidades
    where subcuenta_id = p_subcuenta and creado >= p_desde and creado < p_hasta
  ),
  etapas as (
    select e.id, e.nombre, e.orden from public.crm_etapas e
    where e.embudo_id = p_embudo_etapas order by e.orden
  ),
  por_etapa as (
    select e.id, e.nombre, e.orden,
           count(o.id) filter (where o.estado = 'abierta' or o.estado = 'ganada') as n,
           coalesce(sum(o.valor) filter (where o.estado = 'abierta' or o.estado = 'ganada'), 0) as valor
    from etapas e left join ops o on o.etapa_id = e.id
    group by e.id, e.nombre, e.orden
  )
  select jsonb_build_object(
    'estado', (select jsonb_build_object(
        'abierta', count(*) filter (where estado = 'abierta'),
        'ganada', count(*) filter (where estado = 'ganada'),
        'perdida', count(*) filter (where estado = 'perdida'),
        'abandonada', count(*) filter (where estado = 'abandonada'))
      from ops where p_embudo_estado is null or embudo_id = p_embudo_estado),
    'valor', (select jsonb_build_object(
        'total', coalesce(sum(valor), 0),
        'abierta', coalesce(sum(valor) filter (where estado = 'abierta'), 0),
        'ganada', coalesce(sum(valor) filter (where estado = 'ganada'), 0),
        'perdida', coalesce(sum(valor) filter (where estado = 'perdida'), 0),
        'abandonada', coalesce(sum(valor) filter (where estado = 'abandonada'), 0))
      from ops),
    'conversion', (select jsonb_build_object(
        'total', count(*),
        'ganadas', count(*) filter (where estado = 'ganada'),
        'ingresos_ganados', coalesce(sum(valor) filter (where estado = 'ganada'), 0))
      from ops),
    -- Embudo: cuántas han llegado al menos a cada etapa (acumulado desde el final).
    'embudo', (select coalesce(jsonb_agg(jsonb_build_object('etapa', nombre, 'n', acumulado, 'valor', valor) order by orden), '[]')
      from (select nombre, orden, valor, sum(n) over (order by orden desc) as acumulado from por_etapa) x),
    'etapas', (select coalesce(jsonb_agg(jsonb_build_object('etapa', nombre, 'n', n, 'valor', valor) order by orden), '[]')
      from por_etapa)
  ) into v;
  return v;
end $$;

revoke all on function public.usuarios_asignables(uuid) from public, anon;
revoke all on function public.crm_contactos_lote(uuid, uuid[], text, text) from public, anon;
revoke all on function public.crm_mover_oportunidad(uuid, uuid, double precision) from public, anon;
revoke all on function public.crm_borrar_etapa(uuid, uuid) from public, anon;
revoke all on function public.crm_tablero(uuid, timestamptz, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.usuarios_asignables(uuid) to authenticated;
grant execute on function public.crm_contactos_lote(uuid, uuid[], text, text) to authenticated;
grant execute on function public.crm_mover_oportunidad(uuid, uuid, double precision) to authenticated;
grant execute on function public.crm_borrar_etapa(uuid, uuid) to authenticated;
grant execute on function public.crm_tablero(uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;

-- Las subcuentas que ya existían antes de este guion reciben su embudo inicial.
insert into public.crm_embudos (subcuenta_id, nombre, orden)
select s.id, 'Embudo de ventas', 0 from public.subcuentas s
where not exists (select 1 from public.crm_embudos e where e.subcuenta_id = s.id);
insert into public.crm_etapas (subcuenta_id, embudo_id, nombre, orden)
select e.subcuenta_id, e.id, t.n, t.o
from public.crm_embudos e
cross join unnest(array['Nuevo lead', 'Contactado', 'Propuesta enviada', 'Negociación', 'Cerrado']) with ordinality as t(n, o)
where not exists (select 1 from public.crm_etapas x where x.embudo_id = e.id);

-- Borra un campo personalizado y limpia su valor de todos los contactos.
create or replace function public.crm_borrar_campo(p_campo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.crm_campos%rowtype;
begin
  select * into v from public.crm_campos where id = p_campo;
  if v.id is null or not public.soy_admin_subcuenta(v.subcuenta_id) then
    raise exception 'Solo un administrador puede borrar campos.' using errcode = 'insufficient_privilege';
  end if;
  update public.crm_contactos set campos = campos - v.clave
  where subcuenta_id = v.subcuenta_id and campos ? v.clave;
  delete from public.crm_campos where id = p_campo;
end $$;
revoke all on function public.crm_borrar_campo(uuid) from public, anon;
grant execute on function public.crm_borrar_campo(uuid) to authenticated;

-- Moneda de la agencia, para quien trabaja en la subcuenta sin ver la agencia.
create or replace function public.moneda_subcuenta(p_subcuenta uuid)
returns text language sql stable security definer set search_path = public as $$
  select a.moneda from public.subcuentas s join public.agencias a on a.id = s.agencia_id
  where s.id = p_subcuenta and public.puedo_ver_subcuenta(p_subcuenta);
$$;
revoke all on function public.moneda_subcuenta(uuid) from public, anon;
grant execute on function public.moneda_subcuenta(uuid) to authenticated;
