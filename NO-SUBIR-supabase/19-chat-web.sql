-- =============================================================================
-- 19 · CHAT WEB
-- Un globo de chat que la subcuenta pega en su web. Lo que escribe el visitante
-- entra en Conversaciones como un canal más («chat») y el equipo responde desde
-- la misma bandeja. Requiere el 18. Se puede volver a ejecutar.
--
-- Seguridad:
--  · El visitante no tiene sesión: se identifica con un token aleatorio que solo
--    guarda su navegador (aquí solo se guarda su huella SHA-256).
--  · Solo ve SUS mensajes de chat (los de su token), nunca el historial del
--    contacto aunque escriba el correo de alguien que ya existe.
--  · No modifica contactos existentes con datos sin verificar.
--  · Límites anti-abuso por subcuenta y por visitante.
-- =============================================================================

-- 1 · Canal «chat» en los mensajes ------------------------------------------------
alter table public.conv_mensajes drop constraint if exists conv_mensajes_canal_check;
alter table public.conv_mensajes add constraint conv_mensajes_canal_check
  check (canal in ('sms', 'whatsapp', 'email', 'nota', 'chat'));
alter table public.conv_mensajes add column if not exists chat_visitante_id uuid;
alter table public.conv_conversaciones add column if not exists chat_visitante_id uuid;
create index if not exists conv_mensajes_visitante_idx on public.conv_mensajes(chat_visitante_id, creado) where chat_visitante_id is not null;

-- 2 · Ajustes del globo de chat (uno por subcuenta) -------------------------------
create table if not exists public.chat_widgets (
  subcuenta_id   uuid primary key references public.subcuentas(id) on delete cascade,
  clave          text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  activo         boolean not null default false,
  titulo         text not null default 'Chatea con nosotros' check (length(trim(titulo)) between 1 and 60),
  subtitulo      text not null default 'Normalmente respondemos en unos minutos' check (length(subtitulo) <= 120),
  saludo         text not null default '¡Hola! ¿En qué podemos ayudarte?' check (length(saludo) <= 300),
  color          text not null default '#155eef' check (color ~* '^#[0-9a-f]{6}$'),
  posicion       text not null default 'derecha' check (posicion in ('derecha', 'izquierda')),
  pedir_telefono boolean not null default false,
  aviso_legal    text not null default '' check (length(aviso_legal) <= 400),
  dominios       text[] not null default '{}' check (cardinality(dominios) <= 20),
  actualizado    timestamptz not null default now()
);

create table if not exists public.chat_visitantes (
  id            uuid primary key default gen_random_uuid(),
  subcuenta_id  uuid not null,
  contacto_id   uuid not null,
  token_hash    text not null unique,
  nombre        text not null default '',
  origen        text not null default '',
  creado        timestamptz not null default now(),
  ultimo_visto  timestamptz not null default now(),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists chat_visitantes_sub_idx on public.chat_visitantes(subcuenta_id, creado);

alter table public.chat_widgets enable row level security;
alter table public.chat_visitantes enable row level security;
revoke all on public.chat_widgets, public.chat_visitantes from anon, authenticated;
grant all on public.chat_widgets, public.chat_visitantes to service_role;

drop policy if exists chat_widgets_lee on public.chat_widgets;
create policy chat_widgets_lee on public.chat_widgets for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists chat_widgets_alta on public.chat_widgets;
create policy chat_widgets_alta on public.chat_widgets for insert to authenticated
  with check (public.soy_admin_subcuenta(subcuenta_id));
drop policy if exists chat_widgets_cambia on public.chat_widgets;
create policy chat_widgets_cambia on public.chat_widgets for update to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
grant select on public.chat_widgets to authenticated;
-- La clave no se elige a mano: se genera (y se renueva con chat_renovar_clave).
grant insert (subcuenta_id, activo, titulo, subtitulo, saludo, color, posicion, pedir_telefono, aviso_legal, dominios)
  on public.chat_widgets to authenticated;
grant update (activo, titulo, subtitulo, saludo, color, posicion, pedir_telefono, aviso_legal, dominios, actualizado)
  on public.chat_widgets to authenticated;

-- Dominios: «tuweb.com» o «www.tuweb.com», sin protocolo ni rutas.
create or replace function public.chat_valida_widget()
returns trigger language plpgsql set search_path = public as $$
declare d text;
begin
  new.dominios := coalesce((select array_agg(distinct x) from unnest(new.dominios) x where x <> ''), '{}');
  foreach d in array new.dominios loop
    if d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
      raise exception '«%» no es un dominio válido (ej. tuweb.com).', d using errcode = 'check_violation';
    end if;
  end loop;
  new.actualizado := now();
  return new;
end $$;
drop trigger if exists chat_widgets_valida on public.chat_widgets;
create trigger chat_widgets_valida before insert or update on public.chat_widgets
  for each row execute function public.chat_valida_widget();

-- Renovar la clave invalida el código pegado en la web (por si se filtra o se abusa).
create or replace function public.chat_renovar_clave(p_subcuenta uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v text := encode(extensions.gen_random_bytes(12), 'hex');
begin
  if not public.soy_admin_subcuenta(p_subcuenta) then
    raise exception 'Solo un administrador puede renovar el código del chat.' using errcode = 'insufficient_privilege';
  end if;
  update public.chat_widgets set clave = v where subcuenta_id = p_subcuenta;
  if not found then raise exception 'Guarda primero los ajustes del chat.' using errcode = 'no_data_found'; end if;
  return v;
end $$;
revoke all on function public.chat_renovar_clave(uuid) from public, anon;
grant execute on function public.chat_renovar_clave(uuid) to authenticated;

-- 3 · Respuestas del equipo: van al visitante que esté en el chat ---------------
create or replace function public.chat_destino_respuesta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.canal = 'chat' and new.direccion = 'saliente' then
    select chat_visitante_id into new.chat_visitante_id from public.conv_conversaciones where id = new.conversacion_id;
    if new.chat_visitante_id is null then
      raise exception 'Este contacto no tiene un chat web abierto.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists conv_mensajes_chat_destino on public.conv_mensajes;
create trigger conv_mensajes_chat_destino before insert on public.conv_mensajes
  for each row execute function public.chat_destino_respuesta();

-- Aviso de mensaje entrante: ahora también «chat».
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
             case new.canal when 'sms' then 'Nuevo SMS' when 'whatsapp' then 'Nuevo WhatsApp'
                            when 'chat' then 'Nuevo mensaje del chat web' else 'Nuevo correo' end
               || ' de ' || coalesce(nullif(trim(v_contacto.nombre || ' ' || v_contacto.apellidos), ''), v_contacto.email, v_contacto.telefono),
             left(new.cuerpo, 200),
             '/subcuenta/' || s.id || '/conversaciones?c=' || c.id
      from public.subcuentas s where s.id = new.subcuenta_id;
    end if;
  end if;
  return null;
end $$;

-- 4 · Funciones públicas del globo (sin sesión) -----------------------------------
create or replace function public.chat_widget_activo(p_clave text)
returns public.chat_widgets language sql stable security definer set search_path = public as $$
  select w.* from public.chat_widgets w join public.subcuentas s on s.id = w.subcuenta_id
  where w.clave = p_clave and w.activo and s.estado = 'activa';
$$;
revoke all on function public.chat_widget_activo(text) from public, anon, authenticated;

-- ¿Puede usarse desde esa web? Lista vacía = cualquier web.
create or replace function public.chat_origen_valido(p_dominios text[], p_origen text)
returns boolean language sql immutable set search_path = public as $$
  select cardinality(p_dominios) = 0 or exists (
    select 1 from unnest(p_dominios) d
    where lower(coalesce(p_origen, '')) = d or lower(coalesce(p_origen, '')) like '%.' || d);
$$;

create or replace function public.chat_config(p_clave text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w public.chat_widgets;
begin
  w := public.chat_widget_activo(p_clave);
  if w.subcuenta_id is null then return null; end if;
  return jsonb_build_object('titulo', w.titulo, 'subtitulo', w.subtitulo, 'saludo', w.saludo, 'color', w.color,
    'posicion', w.posicion, 'pedir_telefono', w.pedir_telefono, 'aviso_legal', w.aviso_legal, 'dominios', to_jsonb(w.dominios),
    'empresa', (select nombre from public.subcuentas where id = w.subcuenta_id));
end $$;

create or replace function public.chat_visitante(p_clave text, p_token text)
returns public.chat_visitantes language sql stable security definer set search_path = public as $$
  select v.* from public.chat_visitantes v
  join public.chat_widgets w on w.subcuenta_id = v.subcuenta_id and w.clave = p_clave and w.activo
  where length(coalesce(p_token, '')) = 64
    and v.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke all on function public.chat_visitante(text, text) from public, anon, authenticated;

create or replace function public.chat_iniciar(p_clave text, p_nombre text, p_email text, p_telefono text default '', p_origen text default '')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  w public.chat_widgets;
  s public.subcuentas;
  v_nombre text := left(trim(coalesce(p_nombre, '')), 100);
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_contacto uuid;
  v_nuevo boolean := false;
  v_conv uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  w := public.chat_widget_activo(p_clave);
  if w.subcuenta_id is null then
    raise exception 'Este chat no está disponible.' using errcode = 'no_data_found';
  end if;
  if not public.chat_origen_valido(w.dominios, p_origen) then
    raise exception 'Este chat no está autorizado en esta web.' using errcode = 'insufficient_privilege';
  end if;
  select * into s from public.subcuentas where id = w.subcuenta_id;
  -- Una sola petición a la vez por subcuenta: así el límite no se salta en paralelo.
  perform pg_advisory_xact_lock(hashtext('chat_iniciar:' || w.subcuenta_id::text));
  if (select count(*) from public.chat_visitantes where subcuenta_id = w.subcuenta_id and creado > now() - interval '1 hour') >= 60 then
    raise exception 'Hay demasiadas conversaciones nuevas ahora mismo. Inténtalo en unos minutos.' using errcode = 'check_violation';
  end if;

  if length(v_nombre) < 1 then raise exception 'Escribe tu nombre.' using errcode = 'check_violation'; end if;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Escribe un correo electrónico válido.' using errcode = 'check_violation';
  end if;
  if v_tel <> '' and left(v_tel, 1) <> '+' then v_tel := s.prefijo || ltrim(v_tel, '0'); end if;
  if v_tel !~ '^(\+[0-9]{6,15})?$' then raise exception 'El teléfono no es válido.' using errcode = 'check_violation'; end if;
  if w.pedir_telefono and v_tel = '' then raise exception 'Escribe tu teléfono.' using errcode = 'check_violation'; end if;

  -- El contacto se reutiliza por correo, pero sin tocar su ficha.
  select id into v_contacto from public.crm_contactos where subcuenta_id = w.subcuenta_id and email = v_email;
  if v_contacto is null then
    insert into public.crm_contactos (subcuenta_id, nombre, email, telefono, fuente)
    values (w.subcuenta_id, v_nombre, v_email, v_tel, 'Chat web')
    returning id into v_contacto;
    v_nuevo := true;
  end if;

  insert into public.chat_visitantes (subcuenta_id, contacto_id, token_hash, nombre, origen)
  values (w.subcuenta_id, v_contacto, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_nombre, left(coalesce(p_origen, ''), 200))
  returning id into v_id;

  insert into public.conv_conversaciones (subcuenta_id, contacto_id, chat_visitante_id)
  values (w.subcuenta_id, v_contacto, v_id)
  on conflict (subcuenta_id, contacto_id) do update set chat_visitante_id = excluded.chat_visitante_id
  returning id into v_conv;

  if not v_nuevo then
    -- Aviso al equipo: el correo no está verificado; podría no ser el titular.
    insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado)
    values (w.subcuenta_id, v_conv, 'saliente', 'nota',
            'Chat web iniciado por «' || v_nombre || '»' || case when v_tel <> '' then ' (' || v_tel || ')' else '' end
            || ' con este correo. El correo no está verificado: no compartas datos privados hasta confirmar su identidad.', 'enviado');
  end if;

  return jsonb_build_object('token', v_token, 'nombre', v_nombre);
end $$;

create or replace function public.chat_enviar(p_clave text, p_token text, p_texto text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v public.chat_visitantes;
  v_conv uuid;
  v_texto text := trim(coalesce(p_texto, ''));
  m public.conv_mensajes;
begin
  v := public.chat_visitante(p_clave, p_token);
  if v.id is null then raise exception 'La conversación ha caducado. Vuelve a empezar.' using errcode = 'no_data_found'; end if;
  if length(v_texto) not between 1 and 2000 then
    raise exception 'El mensaje tiene que tener entre 1 y 2000 caracteres.' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('chat_enviar:' || v.id::text));
  if (select count(*) from public.conv_mensajes where chat_visitante_id = v.id and direccion = 'entrante'
        and creado > now() - interval '5 minutes') >= 20 then
    raise exception 'Estás enviando mensajes muy rápido. Espera un momento.' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.conv_mensajes where subcuenta_id = v.subcuenta_id and canal = 'chat' and direccion = 'entrante'
        and creado > now() - interval '1 hour') >= 1000 then
    raise exception 'El chat está saturado ahora mismo. Inténtalo más tarde.' using errcode = 'check_violation';
  end if;

  insert into public.conv_conversaciones (subcuenta_id, contacto_id, chat_visitante_id)
  values (v.subcuenta_id, v.contacto_id, v.id)
  on conflict (subcuenta_id, contacto_id) do update set chat_visitante_id = excluded.chat_visitante_id
  returning id into v_conv;

  insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, chat_visitante_id)
  values (v.subcuenta_id, v_conv, 'entrante', 'chat', v_texto, 'recibido', v.id)
  returning * into m;
  update public.chat_visitantes set ultimo_visto = now() where id = v.id;
  return jsonb_build_object('id', m.id, 'direccion', m.direccion, 'cuerpo', m.cuerpo, 'creado', m.creado);
end $$;

-- Mensajes del visitante (los suyos y las respuestas que le han enviado).
create or replace function public.chat_mensajes(p_clave text, p_token text, p_desde timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v public.chat_visitantes;
  r jsonb;
begin
  v := public.chat_visitante(p_clave, p_token);
  if v.id is null then raise exception 'La conversación ha caducado. Vuelve a empezar.' using errcode = 'no_data_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'direccion', x.direccion, 'cuerpo', x.cuerpo, 'creado', x.creado,
           'autor', case when x.direccion = 'saliente' then coalesce(nullif(split_part(u.raw_user_meta_data ->> 'nombre', ' ', 1), ''), 'Equipo') end)
           order by x.creado), '[]'::jsonb)
    into r
  from (select * from public.conv_mensajes
        where chat_visitante_id = v.id and canal = 'chat' and (p_desde is null or creado > p_desde)
        order by creado desc limit 200) x
  left join auth.users u on u.id = x.autor_id;
  -- Lo que ya ha visto queda como leído en la bandeja del equipo.
  update public.conv_mensajes set estado = 'leido', actualizado = now()
  where chat_visitante_id = v.id and direccion = 'saliente' and estado in ('pendiente', 'enviado', 'entregado');
  update public.chat_visitantes set ultimo_visto = now() where id = v.id and ultimo_visto < now() - interval '1 minute';
  return r;
end $$;

revoke all on function public.chat_config(text) from public;
revoke all on function public.chat_iniciar(text, text, text, text, text) from public;
revoke all on function public.chat_enviar(text, text, text) from public;
revoke all on function public.chat_mensajes(text, text, timestamptz) from public;
grant execute on function public.chat_config(text) to anon, authenticated;
grant execute on function public.chat_iniciar(text, text, text, text, text) to anon, authenticated;
grant execute on function public.chat_enviar(text, text, text) to anon, authenticated;
grant execute on function public.chat_mensajes(text, text, timestamptz) to anon, authenticated;
