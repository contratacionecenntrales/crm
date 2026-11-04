-- =============================================================================
-- 20 · AJUSTES DE AGENCIA (segunda tanda)
-- Enlaces de menú personalizados, claves de API, servicios por defecto de la
-- agencia (correo y teléfono), datos de muestra y JS personalizado.
-- Requiere el 19. Se puede volver a ejecutar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · ENLACES DE MENÚ PERSONALIZADOS
-- La agencia añade enlaces a la barra lateral: de la propia agencia y/o de sus
-- subcuentas (todas o algunas). Se abren en otra pestaña o dentro de la app.
-- -----------------------------------------------------------------------------
create table if not exists public.menu_enlaces (
  id             uuid primary key default gen_random_uuid(),
  agencia_id     uuid not null references public.agencias(id) on delete cascade,
  nombre         text not null check (length(trim(nombre)) between 1 and 40),
  url            text not null check (url ~ '^https://[^\s/$.?#][^\s]*$' and length(url) <= 1000),
  icono          text not null default 'enlace'
                 check (icono in ('enlace', 'globo', 'documento', 'video', 'ayuda', 'carrito', 'grafico', 'estrella', 'chat', 'calendario')),
  modo           text not null default 'pestana' check (modo in ('pestana', 'iframe')),
  en_agencia     boolean not null default true,
  en_subcuentas  boolean not null default true,
  subcuentas     uuid[] not null default '{}' check (cardinality(subcuentas) <= 500), -- vacío = todas
  orden          int not null default 0,
  creado         timestamptz not null default now()
);
create index if not exists menu_enlaces_agencia_idx on public.menu_enlaces(agencia_id, orden);

alter table public.menu_enlaces enable row level security;
revoke all on public.menu_enlaces from anon, authenticated;
grant all on public.menu_enlaces to service_role;
drop policy if exists menu_enlaces_lee on public.menu_enlaces;
create policy menu_enlaces_lee on public.menu_enlaces for select to authenticated
  using (public.soy_admin_agencia(agencia_id));
drop policy if exists menu_enlaces_escribe on public.menu_enlaces;
create policy menu_enlaces_escribe on public.menu_enlaces for all to authenticated
  using (public.soy_admin_agencia(agencia_id)) with check (public.soy_admin_agencia(agencia_id));
grant select, insert, update, delete on public.menu_enlaces to authenticated;

-- Las subcuentas elegidas tienen que ser de la misma agencia.
create or replace function public.menu_enlaces_valida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.subcuentas := coalesce((select array_agg(distinct x) from unnest(new.subcuentas) x), '{}');
  if exists (select 1 from unnest(new.subcuentas) x
             where not exists (select 1 from public.subcuentas s where s.id = x and s.agencia_id = new.agencia_id)) then
    raise exception 'Alguna de las subcuentas elegidas no es de esta agencia.' using errcode = 'check_violation';
  end if;
  if not new.en_agencia and not new.en_subcuentas then
    raise exception 'Elige dónde se muestra el enlace: en la agencia, en las subcuentas o en ambas.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists menu_enlaces_valida on public.menu_enlaces;
create trigger menu_enlaces_valida before insert or update on public.menu_enlaces
  for each row execute function public.menu_enlaces_valida();

-- Enlaces que ve quien está en una vista: la de agencia (p_subcuenta nulo) o una subcuenta.
create or replace function public.enlaces_menu(p_agencia uuid, p_subcuenta uuid default null)
returns table (id uuid, nombre text, url text, icono text, modo text)
language sql stable security definer set search_path = public as $$
  select e.id, e.nombre, e.url, e.icono, e.modo
  from public.menu_enlaces e
  where case
    when p_subcuenta is null then
      e.agencia_id = p_agencia and e.en_agencia and public.es_miembro_agencia(p_agencia)
    else
      e.en_subcuentas and public.puedo_ver_subcuenta(p_subcuenta)
      and e.agencia_id = (select s.agencia_id from public.subcuentas s where s.id = p_subcuenta)
      and (cardinality(e.subcuentas) = 0 or p_subcuenta = any (e.subcuentas))
  end
  order by e.orden, e.creado;
$$;
revoke all on function public.enlaces_menu(uuid, uuid) from public, anon;
grant execute on function public.enlaces_menu(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · CLAVES DE API (integraciones privadas)
-- Solo se guarda la huella SHA-256 del token; el token se enseña una vez.
-- La API (/api/v1) valida cada petición con api_autenticar (solo servidor).
-- -----------------------------------------------------------------------------
create table if not exists public.api_claves (
  id           uuid primary key default gen_random_uuid(),
  agencia_id   uuid not null references public.agencias(id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 60),
  prefijo      text not null,
  huella       text not null unique,
  permisos     text[] not null check (cardinality(permisos) between 1 and 10 and permisos <@ array[
                 'contactos.leer', 'contactos.escribir', 'oportunidades.leer', 'oportunidades.escribir',
                 'conversaciones.escribir', 'calendarios.leer']::text[]),
  subcuentas   uuid[] not null default '{}' check (cardinality(subcuentas) <= 500), -- vacío = todas
  creado_por   uuid references auth.users(id) on delete set null,
  creado       timestamptz not null default now(),
  ultimo_uso   timestamptz,
  caduca       timestamptz,
  revocada_en  timestamptz
);
create index if not exists api_claves_agencia_idx on public.api_claves(agencia_id, creado desc);

create table if not exists public.api_uso (
  clave_id uuid not null references public.api_claves(id) on delete cascade,
  minuto   timestamptz not null,
  n        int not null default 0,
  primary key (clave_id, minuto)
);

alter table public.api_claves enable row level security;
alter table public.api_uso enable row level security;
revoke all on public.api_claves, public.api_uso from anon, authenticated;
grant all on public.api_claves, public.api_uso to service_role;
drop policy if exists api_claves_lee on public.api_claves;
create policy api_claves_lee on public.api_claves for select to authenticated using (public.soy_admin_agencia(agencia_id));
drop policy if exists api_claves_revoca on public.api_claves;
create policy api_claves_revoca on public.api_claves for update to authenticated
  using (public.soy_admin_agencia(agencia_id)) with check (public.soy_admin_agencia(agencia_id));
drop policy if exists api_claves_borra on public.api_claves;
create policy api_claves_borra on public.api_claves for delete to authenticated using (public.soy_admin_agencia(agencia_id));
-- La huella no se puede leer ni tocar desde el navegador.
grant select (id, agencia_id, nombre, prefijo, permisos, subcuentas, creado_por, creado, ultimo_uso, caduca, revocada_en)
  on public.api_claves to authenticated;
grant update (nombre, revocada_en) on public.api_claves to authenticated;
grant delete on public.api_claves to authenticated;

create or replace function public.api_claves_valida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.revocada_en is not null and new.revocada_en is distinct from old.revocada_en then
    raise exception 'Una clave revocada no se puede reactivar: crea una nueva.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(new.subcuentas) x
             where not exists (select 1 from public.subcuentas s where s.id = x and s.agencia_id = new.agencia_id)) then
    raise exception 'Alguna de las subcuentas elegidas no es de esta agencia.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists api_claves_valida on public.api_claves;
create trigger api_claves_valida before insert or update on public.api_claves
  for each row execute function public.api_claves_valida();

create or replace function public.api_crear_clave(p_agencia uuid, p_nombre text, p_permisos text[],
                                                  p_subcuentas uuid[] default '{}', p_caduca timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_token text := 'mtk_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_id uuid;
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador de la agencia puede crear claves de API.' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.api_claves where agencia_id = p_agencia and revocada_en is null) >= 50 then
    raise exception 'Como mucho 50 claves activas por agencia: revoca las que no uses.' using errcode = 'check_violation';
  end if;
  if p_caduca is not null and p_caduca <= now() then
    raise exception 'La fecha de caducidad tiene que ser futura.' using errcode = 'check_violation';
  end if;
  insert into public.api_claves (agencia_id, nombre, prefijo, huella, permisos, subcuentas, creado_por, caduca)
  values (p_agencia, trim(p_nombre), left(v_token, 12), encode(extensions.digest(v_token, 'sha256'), 'hex'),
          (select array_agg(distinct x) from unnest(p_permisos) x),
          coalesce((select array_agg(distinct x) from unnest(p_subcuentas) x), '{}'), auth.uid(), p_caduca)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;
revoke all on function public.api_crear_clave(uuid, text, text[], uuid[], timestamptz) from public, anon;
grant execute on function public.api_crear_clave(uuid, text, text[], uuid[], timestamptz) to authenticated;

-- Valida token + subcuenta + permiso y cuenta la petición (120 por minuto y clave).
-- El motivo del rechazo va en «hint» para que la API devuelva el código HTTP correcto.
create or replace function public.api_autenticar(p_token text, p_subcuenta uuid, p_permiso text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  k public.api_claves;
  v_n int;
begin
  if coalesce(p_token, '') !~ '^mtk_[0-9a-f]{48}$' then
    raise exception 'Clave de API no válida.' using hint = 'no_autorizado';
  end if;
  select * into k from public.api_claves where huella = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if k.id is null or k.revocada_en is not null or (k.caduca is not null and k.caduca <= now()) then
    raise exception 'Clave de API no válida, revocada o caducada.' using hint = 'no_autorizado';
  end if;
  insert into public.api_uso (clave_id, minuto, n) values (k.id, date_trunc('minute', now()), 1)
  on conflict (clave_id, minuto) do update set n = public.api_uso.n + 1
  returning n into v_n;
  if v_n > 120 then
    raise exception 'Demasiadas peticiones: máximo 120 por minuto.' using hint = 'limite';
  end if;
  if not (p_permiso = any (k.permisos)) then
    raise exception 'Esta clave no tiene el permiso «%».', p_permiso using hint = 'prohibido';
  end if;
  if not exists (select 1 from public.subcuentas s where s.id = p_subcuenta and s.agencia_id = k.agencia_id and s.estado = 'activa')
     or (cardinality(k.subcuentas) > 0 and not (p_subcuenta = any (k.subcuentas))) then
    raise exception 'Esta clave no tiene acceso a esa subcuenta.' using hint = 'prohibido';
  end if;
  if k.ultimo_uso is null or k.ultimo_uso < now() - interval '1 minute' then
    update public.api_claves set ultimo_uso = now() where id = k.id;
  end if;
  delete from public.api_uso where clave_id = k.id and minuto < now() - interval '1 hour';
  return jsonb_build_object('clave_id', k.id, 'agencia_id', k.agencia_id);
end $$;
revoke all on function public.api_autenticar(text, uuid, text) from public, anon, authenticated;
grant execute on function public.api_autenticar(text, uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- 3 · CORRECCIÓN: reclamar un mensaje para enviarlo, de forma atómica.
-- (PostgREST no admite filtros «or» en un UPDATE: el envío fallaba en silencio
-- y el mensaje se quedaba «pendiente».) Solo un proceso lo envía.
-- -----------------------------------------------------------------------------
create or replace function public.conv_reclamar_envio(p_mensaje uuid, p_subcuenta uuid)
returns boolean language sql volatile security definer set search_path = public as $$
  with x as (
    update public.conv_mensajes set estado = 'pendiente', error = 'enviando', actualizado = now()
    where id = p_mensaje and subcuenta_id = p_subcuenta and direccion = 'saliente' and canal <> 'nota'
      and (estado = 'fallido' or (estado = 'pendiente' and error = ''))
    returning 1)
  select exists (select 1 from x);
$$;
revoke all on function public.conv_reclamar_envio(uuid, uuid) from public, anon, authenticated;
grant execute on function public.conv_reclamar_envio(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4 · SERVICIOS POR DEFECTO DE LA AGENCIA (correo y Twilio)
-- Si una subcuenta no tiene correo propio, envía con el de la agencia; si no
-- tiene cuenta de Twilio propia, usa la de la agencia con sus propios números.
-- Las claves solo las lee el servidor.
-- -----------------------------------------------------------------------------
create table if not exists public.agencia_servicios (
  agencia_id           uuid primary key references public.agencias(id) on delete cascade,
  twilio_sid           text not null default '' check (twilio_sid = '' or twilio_sid ~ '^AC[0-9a-fA-F]{32}$'),
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
create table if not exists public.agencia_secretos (
  agencia_id     uuid primary key references public.agencias(id) on delete cascade,
  twilio_token   text not null default '',
  mailgun_clave  text not null default '',
  mailgun_firma  text not null default '',
  smtp_clave     text not null default '',
  actualizado    timestamptz not null default now()
);
alter table public.agencia_servicios enable row level security;
alter table public.agencia_secretos enable row level security;
revoke all on public.agencia_servicios, public.agencia_secretos from anon, authenticated;
grant all on public.agencia_servicios, public.agencia_secretos to service_role;
drop policy if exists agencia_servicios_admin on public.agencia_servicios;
create policy agencia_servicios_admin on public.agencia_servicios for all to authenticated
  using (public.soy_admin_agencia(agencia_id)) with check (public.soy_admin_agencia(agencia_id));
grant select, insert, update on public.agencia_servicios to authenticated;

create or replace function public.agencia_guardar_secretos(p_agencia uuid, p_datos jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador de la agencia puede cambiar las claves.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_datos) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_datos) k where k not in ('twilio_token', 'mailgun_clave', 'mailgun_firma', 'smtp_clave')) then
    raise exception 'Datos no válidos.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from jsonb_each(p_datos) e where jsonb_typeof(e.value) not in ('string', 'null') or length(e.value #>> '{}') > 500) then
    raise exception 'Clave demasiado larga.' using errcode = 'check_violation';
  end if;
  insert into public.agencia_secretos (agencia_id) values (p_agencia) on conflict do nothing;
  -- Igual que en la subcuenta: vacío o ausente = no tocar; null = borrar.
  update public.agencia_secretos set
    twilio_token  = case when not p_datos ? 'twilio_token' or p_datos ->> 'twilio_token' = '' then twilio_token
                    when jsonb_typeof(p_datos -> 'twilio_token') = 'null' then '' else p_datos ->> 'twilio_token' end,
    mailgun_clave = case when not p_datos ? 'mailgun_clave' or p_datos ->> 'mailgun_clave' = '' then mailgun_clave
                    when jsonb_typeof(p_datos -> 'mailgun_clave') = 'null' then '' else p_datos ->> 'mailgun_clave' end,
    mailgun_firma = case when not p_datos ? 'mailgun_firma' or p_datos ->> 'mailgun_firma' = '' then mailgun_firma
                    when jsonb_typeof(p_datos -> 'mailgun_firma') = 'null' then '' else p_datos ->> 'mailgun_firma' end,
    smtp_clave    = case when not p_datos ? 'smtp_clave' or p_datos ->> 'smtp_clave' = '' then smtp_clave
                    when jsonb_typeof(p_datos -> 'smtp_clave') = 'null' then '' else p_datos ->> 'smtp_clave' end,
    actualizado   = now()
  where agencia_id = p_agencia;
end $$;

create or replace function public.agencia_estado_secretos(p_agencia uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador de la agencia puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object('twilio_token', twilio_token <> '', 'mailgun_clave', mailgun_clave <> '',
                            'mailgun_firma', mailgun_firma <> '', 'smtp_clave', smtp_clave <> '')
  into r from public.agencia_secretos where agencia_id = p_agencia;
  return coalesce(r, '{"twilio_token":false,"mailgun_clave":false,"mailgun_firma":false,"smtp_clave":false}'::jsonb);
end $$;
revoke all on function public.agencia_guardar_secretos(uuid, jsonb) from public, anon;
revoke all on function public.agencia_estado_secretos(uuid) from public, anon;
grant execute on function public.agencia_guardar_secretos(uuid, jsonb) to authenticated;
grant execute on function public.agencia_estado_secretos(uuid) to authenticated;

-- Verificación de correos (comprobar que el dominio del destinatario recibe correo).
alter table public.conv_ajustes add column if not exists verificar_correos boolean not null default false;

-- Resumen por subcuenta para las tablas de agencia (sin claves, solo si están puestas).
create or replace function public.agencia_resumen_servicios(p_agencia uuid)
returns table (subcuenta_id uuid, nombre text, correo_proveedor text, correo_remitente text, mailgun_dominio text,
               verificar_correos boolean, twilio_sid text, twilio_numero_sms text, twilio_numero_wa text,
               twilio_token boolean, correo_clave boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador de la agencia puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select s.id, s.nombre, coalesce(a.correo_proveedor, ''), coalesce(a.correo_remitente, ''), coalesce(a.mailgun_dominio, ''),
         coalesce(a.verificar_correos, false), coalesce(a.twilio_sid, ''), coalesce(a.twilio_numero_sms, ''), coalesce(a.twilio_numero_wa, ''),
         coalesce(k.twilio_token <> '', false),
         coalesce(case a.correo_proveedor when 'mailgun' then k.mailgun_clave <> '' when 'smtp' then k.smtp_clave <> '' else false end, false)
  from public.subcuentas s
  left join public.conv_ajustes a on a.subcuenta_id = s.id
  left join public.conv_secretos k on k.subcuenta_id = s.id
  where s.agencia_id = p_agencia
  order by s.nombre;
end $$;
revoke all on function public.agencia_resumen_servicios(uuid) from public, anon;
grant execute on function public.agencia_resumen_servicios(uuid) to authenticated;

-- Activar o quitar la verificación de correos en todas las subcuentas de golpe.
create or replace function public.agencia_verificacion_correos(p_agencia uuid, p_activar boolean)
returns int language plpgsql volatile security definer set search_path = public as $$
declare v int;
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador de la agencia puede cambiar esto.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.conv_ajustes (subcuenta_id, verificar_correos)
  select id, p_activar from public.subcuentas where agencia_id = p_agencia
  on conflict (subcuenta_id) do update set verificar_correos = excluded.verificar_correos, actualizado = now();
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function public.agencia_verificacion_correos(uuid, boolean) from public, anon;
grant execute on function public.agencia_verificacion_correos(uuid, boolean) to authenticated;

-- ¿Qué hereda una subcuenta de su agencia? (para avisarlo en sus ajustes)
create or replace function public.servicios_heredados(p_subcuenta uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g public.agencia_servicios; k public.agencia_secretos;
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  select a.* into g from public.agencia_servicios a join public.subcuentas s on s.agencia_id = a.agencia_id where s.id = p_subcuenta;
  select a.* into k from public.agencia_secretos a join public.subcuentas s on s.agencia_id = a.agencia_id where s.id = p_subcuenta;
  return jsonb_build_object(
    'correo', coalesce(g.correo_proveedor, '') <> '',
    'correo_remitente', coalesce(g.correo_remitente, ''),
    'twilio', coalesce(g.twilio_sid, '') <> '' and coalesce(k.twilio_token, '') <> '');
end $$;
revoke all on function public.servicios_heredados(uuid) from public, anon;
grant execute on function public.servicios_heredados(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5 · CONFIGURACIÓN AVANZADA: datos de muestra y JS personalizado
-- -----------------------------------------------------------------------------
alter table public.agencias add column if not exists datos_muestra boolean not null default false;
alter table public.agencias add column if not exists js_personalizado text not null default '' check (length(js_personalizado) <= 20000);

-- El JS corre en el navegador de todos los usuarios de la agencia y de sus
-- subcuentas: solo el propietario puede cambiarlo.
create or replace function public.agencias_protege_js()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.js_personalizado is distinct from old.js_personalizado
     and auth.uid() is not null and public.rol_en_agencia(new.id) is distinct from 'propietario' then
    raise exception 'Solo el propietario de la agencia puede cambiar el JS personalizado.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
drop trigger if exists agencias_protege_js on public.agencias;
create trigger agencias_protege_js before update on public.agencias
  for each row execute function public.agencias_protege_js();

-- JS de la agencia de una subcuenta (para quien está dentro de ella).
create or replace function public.js_agencia(p_subcuenta uuid)
returns text language sql stable security definer set search_path = public as $$
  select a.js_personalizado from public.agencias a join public.subcuentas s on s.agencia_id = a.id
  where s.id = p_subcuenta and public.puedo_ver_subcuenta(p_subcuenta);
$$;
revoke all on function public.js_agencia(uuid) from public, anon;
grant execute on function public.js_agencia(uuid) to authenticated;

-- Subcuenta nueva con datos de muestra (si la agencia lo tiene activado):
-- contactos y oportunidades de ejemplo con la etiqueta «muestra».
create or replace function public.subcuenta_datos_muestra()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_embudo uuid;
  v_etapas uuid[];
  c record;
  i int := 0;
begin
  if not coalesce((select datos_muestra from public.agencias where id = new.agencia_id), false) then
    return null;
  end if;
  select id into v_embudo from public.crm_embudos where subcuenta_id = new.id order by orden limit 1;
  select array_agg(id order by orden) into v_etapas from public.crm_etapas where embudo_id = v_embudo;
  for c in select * from (values
      ('Lucía', 'Martín', 'lucia.martin@example.com', '+34600100001', 'cliente', 'Implantación completa', 2400),
      ('Carlos', 'Ruiz', 'carlos.ruiz@example.com', '+34600100002', 'lead', 'Primera consulta', 150),
      ('Marta', 'Gómez', 'marta.gomez@example.com', '+34600100003', 'lead', 'Plan anual', 990),
      ('Javier', 'López', 'javier.lopez@example.com', '+34600100004', 'lead', 'Presupuesto web', 1800),
      ('Ana', 'Fernández', 'ana.fernandez@example.com', '+34600100005', 'cliente', 'Renovación', 600)
    ) as t(nombre, apellidos, email, telefono, tipo, oportunidad, valor)
  loop
    i := i + 1;
    with nuevo as (
      insert into public.crm_contactos (subcuenta_id, nombre, apellidos, email, telefono, tipo, fuente, etiquetas, creado_por)
      values (new.id, c.nombre, c.apellidos, c.email, c.telefono, c.tipo, 'Datos de muestra', array['muestra'], null)
      returning id)
    insert into public.crm_oportunidades (subcuenta_id, embudo_id, etapa_id, contacto_id, nombre, valor, fuente, posicion, creado_por)
    select new.id, v_embudo, v_etapas[1 + (i - 1) % greatest(cardinality(v_etapas), 1)], nuevo.id, c.oportunidad, c.valor, 'Datos de muestra', i, null
    from nuevo where v_embudo is not null and cardinality(v_etapas) > 0;
  end loop;
  return null;
end $$;
drop trigger if exists subcuentas_zz_datos_muestra on public.subcuentas;
create trigger subcuentas_zz_datos_muestra after insert on public.subcuentas
  for each row execute function public.subcuenta_datos_muestra();

-- -----------------------------------------------------------------------------
-- 6 · CORRECCIÓN: subir el logo de la agencia.
-- Storage vuelve a leer el objeto tras insertarlo: sin política de lectura la
-- subida falla con «new row violates row-level security policy». El bucket es
-- público (los logos se ven sin sesión), así que leerlo no expone nada.
-- -----------------------------------------------------------------------------
do $do$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute $p$drop policy if exists marcas_lee on storage.objects$p$;
    execute $p$create policy marcas_lee on storage.objects for select to anon, authenticated using (bucket_id = 'marcas')$p$;
  end if;
end $do$;
