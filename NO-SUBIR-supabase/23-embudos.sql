-- =============================================================================
-- 23 · EMBUDOS (sitios y páginas)
-- Embudos de varias páginas («pasos») con editor por bloques. Cada paso tiene
-- borrador y versión publicada; la pública se sirve en /f/<embudo>/<paso>.
-- Los formularios crean el contacto, lo etiquetan, avisan y disparan
-- automatizaciones («Formulario enviado»). Requiere el 22. Re-ejecutable.
-- =============================================================================

create table if not exists public.emb_embudos (
  id            uuid primary key default gen_random_uuid(),
  subcuenta_id  uuid not null references public.subcuentas(id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) between 1 and 120),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  publicado     boolean not null default false,
  plantilla     text not null default '',
  creado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now(),
  unique (id, subcuenta_id)
);
create index if not exists emb_embudos_sub_idx on public.emb_embudos(subcuenta_id, creado desc);

create table if not exists public.emb_pasos (
  id             uuid primary key default gen_random_uuid(),
  embudo_id      uuid not null,
  subcuenta_id   uuid not null,
  nombre         text not null check (length(trim(nombre)) between 1 and 120),
  ruta           text not null check (ruta ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(ruta) between 1 and 60),
  orden          int not null default 0,
  contenido      jsonb not null default '{"secciones": []}'::jsonb check (jsonb_typeof(contenido) = 'object' and pg_column_size(contenido) <= 500000),
  publicado      jsonb check (publicado is null or (jsonb_typeof(publicado) = 'object' and pg_column_size(publicado) <= 500000)),
  publicado_en   timestamptz,
  seo_titulo     text not null default '' check (length(seo_titulo) <= 120),
  seo_descripcion text not null default '' check (length(seo_descripcion) <= 300),
  actualizado    timestamptz not null default now(),
  creado         timestamptz not null default now(),
  unique (embudo_id, ruta),
  unique (id, subcuenta_id),
  foreign key (embudo_id, subcuenta_id) references public.emb_embudos(id, subcuenta_id) on delete cascade
);
create index if not exists emb_pasos_embudo_idx on public.emb_pasos(embudo_id, orden);

-- Visitas y envíos por paso y día (contadores, sin datos personales).
create table if not exists public.emb_estadisticas (
  paso_id       uuid not null references public.emb_pasos(id) on delete cascade,
  subcuenta_id  uuid not null,
  dia           date not null,
  visitas       int not null default 0,
  envios        int not null default 0,
  primary key (paso_id, dia)
);

do $$
declare t text;
begin
  foreach t in array array['emb_embudos', 'emb_pasos', 'emb_estadisticas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_lee', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id))', t || '_lee', t);
  end loop;
end $$;
drop policy if exists emb_embudos_escribe on public.emb_embudos;
create policy emb_embudos_escribe on public.emb_embudos for all to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists emb_pasos_escribe on public.emb_pasos;
create policy emb_pasos_escribe on public.emb_pasos for all to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id));
grant select, delete on public.emb_embudos, public.emb_pasos to authenticated;
grant insert (subcuenta_id, nombre, slug, publicado, plantilla) on public.emb_embudos to authenticated;
grant update (nombre, slug, publicado, actualizado) on public.emb_embudos to authenticated;
grant insert (embudo_id, subcuenta_id, nombre, ruta, orden, contenido, seo_titulo, seo_descripcion) on public.emb_pasos to authenticated;
-- «publicado» solo se escribe con emb_publicar (copia del borrador validado).
grant update (nombre, ruta, orden, contenido, seo_titulo, seo_descripcion, actualizado) on public.emb_pasos to authenticated;
grant select on public.emb_estadisticas to authenticated;

-- Los embudos solo si el plan los incluye.
create or replace function public.emb_valida_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.plan_incluye((select agencia_id from public.subcuentas where id = new.subcuenta_id), 'embudos') then
    raise exception 'Tu plan no incluye embudos y páginas.' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.emb_embudos where subcuenta_id = new.subcuenta_id) >= 100 then
    raise exception 'Como mucho 100 embudos por subcuenta.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists emb_embudos_plan on public.emb_embudos;
create trigger emb_embudos_plan before insert on public.emb_embudos for each row execute function public.emb_valida_plan();

create or replace function public.emb_limite_pasos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.emb_pasos where embudo_id = new.embudo_id) >= 30 then
    raise exception 'Como mucho 30 pasos por embudo.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists emb_pasos_limite on public.emb_pasos;
create trigger emb_pasos_limite before insert on public.emb_pasos for each row execute function public.emb_limite_pasos();

-- Publicar = copiar el borrador a la versión pública.
create or replace function public.emb_publicar(p_paso uuid)
returns timestamptz language plpgsql volatile security definer set search_path = public as $$
declare v_sub uuid; v_ts timestamptz := now();
begin
  select subcuenta_id into v_sub from public.emb_pasos where id = p_paso;
  if v_sub is null or not public.puedo_ver_subcuenta(v_sub) then
    raise exception 'No tienes acceso a esta página.' using errcode = 'insufficient_privilege';
  end if;
  update public.emb_pasos set publicado = contenido, publicado_en = v_ts where id = p_paso;
  return v_ts;
end $$;
revoke all on function public.emb_publicar(uuid) from public, anon;
grant execute on function public.emb_publicar(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Lo público
-- -----------------------------------------------------------------------------
-- Página publicada de un embudo (ruta vacía = primer paso). Devuelve también
-- la ruta del paso siguiente, para el botón «Ir al siguiente paso».
create or replace function public.emb_pagina_publica(p_slug text, p_ruta text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.emb_embudos; p public.emb_pasos; v_sig text; s public.subcuentas;
begin
  select * into e from public.emb_embudos where slug = lower(p_slug) and publicado;
  if e.id is null or not public.subcuenta_operativa(e.subcuenta_id)
     or not public.plan_incluye((select agencia_id from public.subcuentas where id = e.subcuenta_id), 'embudos') then
    return null;
  end if;
  if coalesce(p_ruta, '') = '' then
    select * into p from public.emb_pasos where embudo_id = e.id and publicado is not null order by orden, creado limit 1;
  else
    select * into p from public.emb_pasos where embudo_id = e.id and ruta = lower(p_ruta) and publicado is not null;
  end if;
  if p.id is null then return null; end if;
  select ruta into v_sig from public.emb_pasos
  where embudo_id = e.id and publicado is not null and (orden, creado) > (p.orden, p.creado) order by orden, creado limit 1;
  select * into s from public.subcuentas where id = e.subcuenta_id;
  return jsonb_build_object('paso_id', p.id, 'embudo', e.nombre, 'slug', e.slug, 'ruta', p.ruta, 'nombre', p.nombre,
    'contenido', p.publicado, 'siguiente', v_sig, 'seo_titulo', p.seo_titulo, 'seo_descripcion', p.seo_descripcion,
    'empresa', s.nombre, 'logo', s.logo_url);
end $$;
revoke all on function public.emb_pagina_publica(text, text) from public;
grant execute on function public.emb_pagina_publica(text, text) to anon, authenticated;

create or replace function public.emb_registrar_visita(p_paso uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_sub uuid;
begin
  select p.subcuenta_id into v_sub from public.emb_pasos p join public.emb_embudos e on e.id = p.embudo_id
  where p.id = p_paso and e.publicado and p.publicado is not null;
  if v_sub is null then return; end if;
  insert into public.emb_estadisticas (paso_id, subcuenta_id, dia, visitas) values (p_paso, v_sub, current_date, 1)
  on conflict (paso_id, dia) do update set visitas = public.emb_estadisticas.visitas + 1;
end $$;
revoke all on function public.emb_registrar_visita(uuid) from public;
grant execute on function public.emb_registrar_visita(uuid) to anon, authenticated;

-- Formulario de una página publicada. El formulario tiene que existir en la
-- versión publicada (se busca por su id), y solo se aceptan sus campos.
create or replace function public.emb_enviar_formulario(p_paso uuid, p_bloque text, p_datos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  p public.emb_pasos; e public.emb_embudos; s public.subcuentas;
  b jsonb; v_email text; v_nombre text; v_tel text; v_contacto uuid; v_nuevo boolean := false;
  v_etiquetas text[]; v_notas text := ''; c jsonb; v_val text;
begin
  select * into p from public.emb_pasos where id = p_paso;
  select * into e from public.emb_embudos where id = p.embudo_id;
  if p.id is null or not e.publicado or p.publicado is null or not public.subcuenta_operativa(p.subcuenta_id) then
    raise exception 'Este formulario no está disponible.' using errcode = 'no_data_found';
  end if;
  select * into s from public.subcuentas where id = p.subcuenta_id;
  select blq into b from jsonb_array_elements(coalesce(p.publicado -> 'secciones', '[]')) sec,
                         jsonb_array_elements(coalesce(sec -> 'bloques', '[]')) blq
  where blq ->> 'id' = p_bloque and blq ->> 'tipo' = 'formulario' limit 1;
  if b is null then raise exception 'Este formulario no está disponible.' using errcode = 'no_data_found'; end if;
  if jsonb_typeof(p_datos) <> 'object' or pg_column_size(p_datos) > 20000 then
    raise exception 'Datos no válidos.' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('emb_form:' || p.subcuenta_id::text));
  if (select coalesce(sum(envios), 0) from public.emb_estadisticas where subcuenta_id = p.subcuenta_id and dia = current_date) >= 2000 then
    raise exception 'Demasiados envíos hoy. Inténtalo mañana.' using errcode = 'check_violation';
  end if;

  v_email := nullif(lower(trim(coalesce(p_datos ->> 'email', ''))), '');
  v_nombre := left(trim(coalesce(p_datos ->> 'nombre', '')), 100);
  v_tel := regexp_replace(coalesce(p_datos ->> 'telefono', ''), '[^0-9+]', '', 'g');
  if v_tel <> '' and left(v_tel, 1) <> '+' then v_tel := s.prefijo || ltrim(v_tel, '0'); end if;
  if v_email is not null and (v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200) then
    raise exception 'Escribe un correo electrónico válido.' using errcode = 'check_violation';
  end if;
  if v_tel <> '' and v_tel !~ '^\+[0-9]{6,15}$' then raise exception 'El teléfono no es válido.' using errcode = 'check_violation'; end if;
  -- Campos obligatorios del formulario publicado.
  for c in select * from jsonb_array_elements(coalesce(b -> 'campos', '[]')) loop
    v_val := trim(coalesce(p_datos ->> (c ->> 'clave'), ''));
    if coalesce((c ->> 'obligatorio')::boolean, false) and v_val = '' then
      raise exception 'Rellena «%».', coalesce(c ->> 'etiqueta', c ->> 'clave') using errcode = 'check_violation';
    end if;
    if (c ->> 'clave') not in ('nombre', 'email', 'telefono') and v_val <> '' then
      v_notas := v_notas || coalesce(c ->> 'etiqueta', c ->> 'clave') || ': ' || left(v_val, 1000) || E'\n';
    end if;
  end loop;
  if v_email is null and v_tel = '' then
    raise exception 'Indica al menos un correo o un teléfono.' using errcode = 'check_violation';
  end if;

  v_etiquetas := coalesce((select array_agg(distinct left(trim(x), 60)) from jsonb_array_elements_text(coalesce(b -> 'etiquetas', '[]')) x where trim(x) <> ''), '{}');
  -- Contacto: por correo o teléfono; si existe no se toca su ficha (solo se añaden etiquetas).
  select id into v_contacto from public.crm_contactos
  where subcuenta_id = p.subcuenta_id and ((v_email is not null and email = v_email) or (v_email is null and v_tel <> '' and telefono = v_tel))
  limit 1;
  if v_contacto is null then
    insert into public.crm_contactos (subcuenta_id, nombre, email, telefono, fuente, etiquetas, creado_por)
    values (p.subcuenta_id, v_nombre, v_email, v_tel, left('Embudo: ' || e.nombre, 100), v_etiquetas, null)
    returning id into v_contacto;
    v_nuevo := true;
  elsif cardinality(v_etiquetas) > 0 then
    update public.crm_contactos set etiquetas = (select array_agg(distinct x) from unnest(etiquetas || v_etiquetas) x) where id = v_contacto;
  end if;

  insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle)
  values (p.subcuenta_id, v_contacto, 'formulario_enviado', jsonb_build_object('embudo', e.nombre, 'pagina', p.nombre,
          'datos', left(v_notas, 3000), 'nuevo', v_nuevo,
          'indicado', case when v_nuevo then null else jsonb_build_object('nombre', v_nombre, 'telefono', v_tel) end));
  insert into public.emb_estadisticas (paso_id, subcuenta_id, dia, envios) values (p.id, p.subcuenta_id, current_date, 1)
  on conflict (paso_id, dia) do update set envios = public.emb_estadisticas.envios + 1;

  perform public.aut_disparar(p.subcuenta_id, v_contacto, 'formulario_enviado',
    jsonb_build_object('embudo_web_id', e.id, 'paso_id', p.id, 'formulario', b ->> 'id'));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.emb_enviar_formulario(uuid, text, jsonb) from public;
grant execute on function public.emb_enviar_formulario(uuid, text, jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Automatización: disparador «Formulario enviado»
-- -----------------------------------------------------------------------------
alter table public.aut_flujos drop constraint if exists aut_flujos_disparador_check;
alter table public.aut_flujos add constraint aut_flujos_disparador_check check (disparador in (
  'contacto_creado', 'etiqueta_anadida', 'cita_reservada', 'cita_cancelada', 'cita_estado',
  'mensaje_recibido', 'oportunidad_etapa', 'factura_pagada', 'manual', 'formulario_enviado'));

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
    when 'formulario_enviado' then coalesce(p_filtro ->> 'embudo_web_id', '') in ('', p_datos ->> 'embudo_web_id')
    else true
  end;
$$;
