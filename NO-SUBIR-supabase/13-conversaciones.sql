-- =============================================================================
-- 13 · CONVERSACIONES: BANDEJA DE ENTRADA (SMS, WHATSAPP, CORREO Y NOTAS
--      INTERNAS), FRAGMENTOS Y AJUSTES DE TWILIO / MAILGUN / SMTP
--
-- Requiere 09, 10, 11 y 12. Idempotente.
--
-- SEGURIDAD
--   · Las claves de los proveedores (token de Twilio, clave de Mailgun,
--     contraseña SMTP) viven en conv_secretos, que NADIE puede leer salvo el
--     servidor con la clave de servicio. Los administradores las escriben con
--     conv_guardar_secretos() y solo pueden saber si están puestas o no.
--   · Los mensajes salientes los crea el equipo (RLS); el estado del envío y
--     los mensajes entrantes solo los escribe el servidor (clave de servicio),
--     de modo que nadie puede falsificar un «entregado» o un mensaje recibido.
-- =============================================================================

-- =============================================================================
-- 1 · AJUSTES Y SECRETOS POR SUBCUENTA
-- =============================================================================
create table if not exists public.conv_ajustes (
  subcuenta_id         uuid primary key references public.subcuentas(id) on delete cascade,
  twilio_sid           text not null default '' check (twilio_sid = '' or twilio_sid ~ '^AC[0-9a-fA-F]{32}$'),
  twilio_numero_sms    text not null default '' check (twilio_numero_sms = '' or twilio_numero_sms ~ '^\+[0-9]{6,15}$'),
  twilio_numero_wa     text not null default '' check (twilio_numero_wa = '' or twilio_numero_wa ~ '^\+[0-9]{6,15}$'),
  correo_proveedor     text not null default '' check (correo_proveedor in ('', 'mailgun', 'smtp')),
  correo_remitente     text not null default '' check (correo_remitente = '' or correo_remitente ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  correo_nombre        text not null default '' check (length(correo_nombre) <= 120),
  mailgun_dominio      text not null default '' check (mailgun_dominio = '' or mailgun_dominio ~* '^[a-z0-9.-]+\.[a-z]{2,}$'),
  mailgun_region       text not null default 'eu' check (mailgun_region in ('us', 'eu')),
  smtp_host            text not null default '' check (length(smtp_host) <= 200),
  smtp_puerto          int not null default 587 check (smtp_puerto between 1 and 65535),
  smtp_seguro          boolean not null default false,
  smtp_usuario         text not null default '' check (length(smtp_usuario) <= 200),
  actualizado          timestamptz not null default now()
);

create table if not exists public.conv_secretos (
  subcuenta_id   uuid primary key references public.subcuentas(id) on delete cascade,
  twilio_token   text not null default '',
  mailgun_clave  text not null default '',
  mailgun_firma  text not null default '', -- «HTTP webhook signing key» de Mailgun
  smtp_clave     text not null default '',
  actualizado    timestamptz not null default now()
);

-- =============================================================================
-- 2 · CONVERSACIONES Y MENSAJES
-- =============================================================================
create table if not exists public.conv_conversaciones (
  id                uuid primary key default gen_random_uuid(),
  subcuenta_id      uuid not null references public.subcuentas(id) on delete cascade,
  contacto_id       uuid not null,
  asignado_id       uuid references auth.users(id) on delete set null,
  estado            text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  destacada         boolean not null default false,
  no_leidos         int not null default 0 check (no_leidos >= 0),
  ultimo_mensaje_en timestamptz,
  ultimo_extracto   text not null default '',
  ultimo_canal      text,
  ultima_direccion  text,
  creado            timestamptz not null default now(),
  unique (subcuenta_id, contacto_id),
  unique (id, subcuenta_id),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists conv_conversaciones_lista_idx on public.conv_conversaciones(subcuenta_id, ultimo_mensaje_en desc nulls last);

create table if not exists public.conv_mensajes (
  id              uuid primary key default gen_random_uuid(),
  subcuenta_id    uuid not null,
  conversacion_id uuid not null,
  direccion       text not null check (direccion in ('entrante', 'saliente')),
  canal           text not null check (canal in ('sms', 'whatsapp', 'email', 'nota')),
  asunto          text not null default '' check (length(asunto) <= 300),
  cuerpo          text not null check (length(cuerpo) between 1 and 20000),
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'enviado', 'entregado', 'leido', 'fallido', 'recibido')),
  error           text not null default '',
  proveedor_id    text,
  autor_id        uuid references auth.users(id) on delete set null,
  creado          timestamptz not null default now(),
  actualizado     timestamptz not null default now(),
  foreign key (conversacion_id, subcuenta_id) references public.conv_conversaciones(id, subcuenta_id) on delete cascade,
  check (canal <> 'nota' or direccion = 'saliente')
);
create index if not exists conv_mensajes_conv_idx on public.conv_mensajes(conversacion_id, creado);
create unique index if not exists conv_mensajes_proveedor_uidx on public.conv_mensajes(subcuenta_id, proveedor_id) where proveedor_id is not null;
create index if not exists conv_mensajes_sub_creado_idx on public.conv_mensajes(subcuenta_id, creado);

create table if not exists public.conv_fragmentos (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 120),
  cuerpo       text not null check (length(trim(cuerpo)) between 1 and 5000),
  creado_por   uuid default auth.uid() references auth.users(id) on delete set null,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);
create index if not exists conv_fragmentos_sub_idx on public.conv_fragmentos(subcuenta_id, nombre);

-- =============================================================================
-- 3 · DISPARADORES
-- =============================================================================
drop trigger if exists conv_mensajes_actualizado on public.conv_mensajes;
create trigger conv_mensajes_actualizado before update on public.conv_mensajes
  for each row execute function public.toca_actualizado();
drop trigger if exists conv_fragmentos_actualizado on public.conv_fragmentos;
create trigger conv_fragmentos_actualizado before update on public.conv_fragmentos
  for each row execute function public.toca_actualizado();
drop trigger if exists conv_ajustes_actualizado on public.conv_ajustes;
create trigger conv_ajustes_actualizado before update on public.conv_ajustes
  for each row execute function public.toca_actualizado();

-- La persona asignada a una conversación tiene que ver la subcuenta.
create or replace function public.conv_valida_asignado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.asignado_id is not null and not public.usuario_ve_subcuenta(new.asignado_id, new.subcuenta_id) then
    raise exception 'La persona asignada no tiene acceso a esta subcuenta.'
      using errcode = 'check_violation', hint = 'ASIGNADO_SIN_ACCESO';
  end if;
  return new;
end $$;
drop trigger if exists conv_conversaciones_asignado on public.conv_conversaciones;
create trigger conv_conversaciones_asignado before insert or update of asignado_id on public.conv_conversaciones
  for each row execute function public.conv_valida_asignado();

-- Un mensaje nuevo actualiza el resumen de la conversación, la última
-- actividad del contacto y, si es entrante, avisa a quien lleva el contacto.
create or replace function public.conv_al_insertar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.conv_conversaciones;
  v_contacto public.crm_contactos;
  v_destino uuid;
begin
  if new.canal = 'nota' then
    update public.conv_conversaciones set ultimo_mensaje_en = coalesce(ultimo_mensaje_en, new.creado) where id = new.conversacion_id;
    return null;
  end if;
  update public.conv_conversaciones set
    ultimo_mensaje_en = new.creado,
    ultimo_extracto = left(regexp_replace(case when new.canal = 'email' and new.asunto <> '' then new.asunto || ' — ' || new.cuerpo else new.cuerpo end, '\s+', ' ', 'g'), 200),
    ultimo_canal = new.canal,
    ultima_direccion = new.direccion,
    no_leidos = case when new.direccion = 'entrante' then no_leidos + 1 else 0 end,
    estado = case when new.direccion = 'entrante' then 'abierta' else estado end
  where id = new.conversacion_id
  returning * into c;

  update public.crm_contactos set ultima_actividad = now() where id = c.contacto_id
  returning * into v_contacto;

  if new.direccion = 'entrante' then
    v_destino := coalesce(c.asignado_id, v_contacto.propietario_id);
    if v_destino is not null then
      insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
      select v_destino, s.agencia_id, s.id, 'alerta', 'Conversaciones',
             'Nuevo ' || case new.canal when 'sms' then 'SMS' when 'whatsapp' then 'WhatsApp' else 'correo' end
               || ' de ' || coalesce(nullif(trim(v_contacto.nombre || ' ' || v_contacto.apellidos), ''), v_contacto.email, v_contacto.telefono),
             left(new.cuerpo, 200),
             '/subcuenta/' || s.id || '/conversaciones?c=' || c.id
      from public.subcuentas s where s.id = new.subcuenta_id;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists conv_mensajes_resumen on public.conv_mensajes;
create trigger conv_mensajes_resumen after insert on public.conv_mensajes
  for each row execute function public.conv_al_insertar_mensaje();

-- =============================================================================
-- 4 · RLS
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['conv_ajustes', 'conv_secretos', 'conv_conversaciones', 'conv_mensajes', 'conv_fragmentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Ajustes: los ven todos los del equipo (para saber qué canales hay); los
-- cambian los administradores. Los secretos: sin políticas (nadie los lee).
drop policy if exists conv_ajustes_lee on public.conv_ajustes;
create policy conv_ajustes_lee on public.conv_ajustes for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists conv_ajustes_admin on public.conv_ajustes;
create policy conv_ajustes_admin on public.conv_ajustes for all to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
grant select, insert, update on public.conv_ajustes to authenticated;

drop policy if exists conv_conversaciones_lee on public.conv_conversaciones;
create policy conv_conversaciones_lee on public.conv_conversaciones for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists conv_conversaciones_alta on public.conv_conversaciones;
create policy conv_conversaciones_alta on public.conv_conversaciones for insert to authenticated
  with check (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists conv_conversaciones_edita on public.conv_conversaciones;
create policy conv_conversaciones_edita on public.conv_conversaciones for update to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists conv_conversaciones_borra on public.conv_conversaciones;
create policy conv_conversaciones_borra on public.conv_conversaciones for delete to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id));
grant select, delete on public.conv_conversaciones to authenticated;
grant insert (subcuenta_id, contacto_id, asignado_id) on public.conv_conversaciones to authenticated;
grant update (asignado_id, estado, destacada, no_leidos) on public.conv_conversaciones to authenticated;

drop policy if exists conv_mensajes_lee on public.conv_mensajes;
create policy conv_mensajes_lee on public.conv_mensajes for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
-- Solo salientes, en estado pendiente (o notas ya «enviadas») y a su nombre.
drop policy if exists conv_mensajes_alta on public.conv_mensajes;
create policy conv_mensajes_alta on public.conv_mensajes for insert to authenticated
  with check (public.puedo_ver_subcuenta(subcuenta_id) and direccion = 'saliente' and autor_id = auth.uid()
              and proveedor_id is null and error = ''
              and (estado = 'pendiente' or (canal = 'nota' and estado = 'enviado')));
grant select on public.conv_mensajes to authenticated;
grant insert (subcuenta_id, conversacion_id, direccion, canal, asunto, cuerpo, estado, autor_id) on public.conv_mensajes to authenticated;

drop policy if exists conv_fragmentos_lee on public.conv_fragmentos;
create policy conv_fragmentos_lee on public.conv_fragmentos for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists conv_fragmentos_escribe on public.conv_fragmentos;
create policy conv_fragmentos_escribe on public.conv_fragmentos for all to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id));
grant select, insert, update, delete on public.conv_fragmentos to authenticated;

-- =============================================================================
-- 5 · FUNCIONES
-- =============================================================================

-- Guarda las claves de los proveedores. Solo cambia las que llegan con valor;
-- una cadena vacía las deja como estaban y null las borra.
create or replace function public.conv_guardar_secretos(p_subcuenta uuid, p_datos jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.soy_admin_subcuenta(p_subcuenta) then
    raise exception 'Solo un administrador puede cambiar las claves.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_datos) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_datos) k where k not in ('twilio_token', 'mailgun_clave', 'mailgun_firma', 'smtp_clave')) then
    raise exception 'Datos no válidos.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from jsonb_each(p_datos) e where jsonb_typeof(e.value) not in ('string', 'null')
             or length(e.value #>> '{}') > 500) then
    raise exception 'Clave demasiado larga.' using errcode = 'check_violation';
  end if;
  insert into public.conv_secretos (subcuenta_id) values (p_subcuenta) on conflict do nothing;
  update public.conv_secretos set
    twilio_token = case when not p_datos ? 'twilio_token' or p_datos ->> 'twilio_token' = '' then twilio_token
                   when jsonb_typeof(p_datos -> 'twilio_token') = 'null' then '' else p_datos ->> 'twilio_token' end,
    mailgun_clave = case when not p_datos ? 'mailgun_clave' or p_datos ->> 'mailgun_clave' = '' then mailgun_clave
                    when jsonb_typeof(p_datos -> 'mailgun_clave') = 'null' then '' else p_datos ->> 'mailgun_clave' end,
    mailgun_firma = case when not p_datos ? 'mailgun_firma' or p_datos ->> 'mailgun_firma' = '' then mailgun_firma
                    when jsonb_typeof(p_datos -> 'mailgun_firma') = 'null' then '' else p_datos ->> 'mailgun_firma' end,
    smtp_clave = case when not p_datos ? 'smtp_clave' or p_datos ->> 'smtp_clave' = '' then smtp_clave
                 when jsonb_typeof(p_datos -> 'smtp_clave') = 'null' then '' else p_datos ->> 'smtp_clave' end,
    actualizado = now()
  where subcuenta_id = p_subcuenta;
end $$;

-- ¿Qué claves están puestas? (sin revelarlas)
create or replace function public.conv_estado_secretos(p_subcuenta uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object('twilio_token', twilio_token <> '', 'mailgun_clave', mailgun_clave <> '',
                            'mailgun_firma', mailgun_firma <> '', 'smtp_clave', smtp_clave <> '')
  into r from public.conv_secretos where subcuenta_id = p_subcuenta;
  return coalesce(r, '{"twilio_token":false,"mailgun_clave":false,"mailgun_firma":false,"smtp_clave":false}'::jsonb);
end $$;

-- Mensaje entrante desde un proveedor (solo lo llama el servidor con la clave
-- de servicio, tras comprobar la firma del webhook). Busca el contacto por
-- teléfono o correo, o lo crea, y abre o reutiliza su conversación.
-- Idempotente: si el proveedor reenvía el mismo mensaje, no se duplica.
create or replace function public.conv_registrar_entrante(p_subcuenta uuid, p_canal text, p_de text, p_cuerpo text,
                                                          p_asunto text default '', p_proveedor_id text default null,
                                                          p_nombre text default '')
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_contacto uuid;
  v_conv uuid;
  v_msg uuid;
  v_de text := trim(coalesce(p_de, ''));
  v_nombre text := left(trim(coalesce(p_nombre, '')), 100);
begin
  if p_canal not in ('sms', 'whatsapp', 'email') then
    raise exception 'Canal no válido.' using errcode = 'check_violation';
  end if;
  if p_proveedor_id is not null then
    select id into v_msg from public.conv_mensajes where subcuenta_id = p_subcuenta and proveedor_id = p_proveedor_id;
    if v_msg is not null then return v_msg; end if;
  end if;

  if p_canal = 'email' then
    v_de := lower(v_de);
    if v_de !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Remitente no válido.' using errcode = 'check_violation';
    end if;
    select id into v_contacto from public.crm_contactos where subcuenta_id = p_subcuenta and email = v_de;
    if v_contacto is null then
      insert into public.crm_contactos (subcuenta_id, nombre, email, fuente)
      values (p_subcuenta, v_nombre, v_de, 'Correo entrante') returning id into v_contacto;
    end if;
  else
    v_de := regexp_replace(v_de, '^whatsapp:', '');
    v_de := regexp_replace(v_de, '[^0-9+]', '', 'g');
    if v_de !~ '^\+[0-9]{6,15}$' then
      raise exception 'Número no válido.' using errcode = 'check_violation';
    end if;
    select id into v_contacto from public.crm_contactos where subcuenta_id = p_subcuenta and telefono = v_de
    order by creado limit 1;
    if v_contacto is null then
      insert into public.crm_contactos (subcuenta_id, nombre, telefono, fuente)
      values (p_subcuenta, v_nombre, v_de, case p_canal when 'sms' then 'SMS entrante' else 'WhatsApp entrante' end)
      returning id into v_contacto;
    end if;
  end if;

  insert into public.conv_conversaciones (subcuenta_id, contacto_id) values (p_subcuenta, v_contacto)
  on conflict (subcuenta_id, contacto_id) do update set estado = 'abierta'
  returning id into v_conv;

  insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, asunto, cuerpo, estado, proveedor_id)
  values (p_subcuenta, v_conv, 'entrante', p_canal, left(coalesce(p_asunto, ''), 300),
          left(coalesce(nullif(trim(p_cuerpo), ''), '(mensaje vacío)'), 20000), 'recibido', p_proveedor_id)
  returning id into v_msg;
  return v_msg;
end $$;

revoke all on function public.conv_guardar_secretos(uuid, jsonb) from public, anon;
revoke all on function public.conv_estado_secretos(uuid) from public, anon;
revoke all on function public.conv_registrar_entrante(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.conv_guardar_secretos(uuid, jsonb) to authenticated;
grant execute on function public.conv_estado_secretos(uuid) to authenticated;
grant execute on function public.conv_registrar_entrante(uuid, text, text, text, text, text, text) to service_role;

-- Analítica: mensajes por día y dirección en la zona de la subcuenta.
create or replace function public.conv_analitica(p_subcuenta uuid, p_dias int default 30)
returns table (dia date, entrantes bigint, salientes bigint, fallidos bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_tz text;
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  select zona_horaria into v_tz from public.subcuentas where id = p_subcuenta;
  return query
    select d::date,
           count(m.id) filter (where m.direccion = 'entrante'),
           count(m.id) filter (where m.direccion = 'saliente' and m.estado <> 'fallido'),
           count(m.id) filter (where m.estado = 'fallido')
    from generate_series((now() at time zone v_tz)::date - (least(greatest(p_dias, 1), 366) - 1), (now() at time zone v_tz)::date, interval '1 day') d
    left join public.conv_mensajes m
      on m.subcuenta_id = p_subcuenta and m.canal <> 'nota' and (m.creado at time zone v_tz)::date = d::date
    group by d order by d;
end $$;
revoke all on function public.conv_analitica(uuid, int) from public, anon;
grant execute on function public.conv_analitica(uuid, int) to authenticated;

-- Tiempo real: la bandeja se refresca sola con cada mensaje.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conv_mensajes') then
      alter publication supabase_realtime add table public.conv_mensajes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conv_conversaciones') then
      alter publication supabase_realtime add table public.conv_conversaciones;
    end if;
  end if;
end $$;
