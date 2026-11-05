-- =============================================================================
-- 24 · ASISTENTES CON IA
-- Asistentes por subcuenta que contestan solos en Conversaciones (chat web,
-- SMS, WhatsApp y correo) con sus instrucciones y su base de conocimiento.
-- Cada mensaje entrante que le toca a un asistente entra en una cola; el
-- servidor genera la respuesta y la envía por el mismo canal. Cuando una
-- persona contesta, el asistente se pausa en esa conversación.
-- Ligado a la función «ia» del plan. Requiere el 23. Re-ejecutable.
-- =============================================================================

create table if not exists public.ia_asistentes (
  id               uuid primary key default gen_random_uuid(),
  subcuenta_id     uuid not null references public.subcuentas(id) on delete cascade,
  nombre           text not null check (length(trim(nombre)) between 1 and 80),
  instrucciones    text not null default '' check (length(instrucciones) <= 8000),
  conocimiento     text not null default '' check (length(conocimiento) <= 60000),
  canales          text[] not null default '{chat}' check (canales <@ array['chat', 'sms', 'whatsapp', 'email']::text[]),
  activo           boolean not null default false,
  max_respuestas   int not null default 30 check (max_respuestas between 1 and 200),
  traspaso_palabras text[] not null default '{}' check (cardinality(traspaso_palabras) <= 30),
  mensaje_traspaso text not null default '' check (length(mensaje_traspaso) <= 500),
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now(),
  unique (id, subcuenta_id)
);
create index if not exists ia_asistentes_sub_idx on public.ia_asistentes(subcuenta_id);

alter table public.conv_conversaciones add column if not exists ia_pausada boolean not null default false;
alter table public.conv_mensajes add column if not exists ia boolean not null default false;

-- Cola de mensajes entrantes que tiene que contestar un asistente.
create table if not exists public.ia_cola (
  id              uuid primary key default gen_random_uuid(),
  subcuenta_id    uuid not null references public.subcuentas(id) on delete cascade,
  conversacion_id uuid not null references public.conv_conversaciones(id) on delete cascade,
  mensaje_id      uuid not null unique references public.conv_mensajes(id) on delete cascade,
  asistente_id    uuid not null references public.ia_asistentes(id) on delete cascade,
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'procesando', 'hecho', 'omitido', 'error')),
  intentos        int not null default 0,
  detalle         text not null default '' check (length(detalle) <= 1000),
  creado          timestamptz not null default now(),
  tomado_en       timestamptz
);
create index if not exists ia_cola_pendiente_idx on public.ia_cola(estado, creado) where estado in ('pendiente', 'procesando');
create index if not exists ia_cola_conv_idx on public.ia_cola(conversacion_id, creado desc);

-- Uso por día (respuestas y tokens), para el límite diario y la facturación.
create table if not exists public.ia_uso (
  subcuenta_id   uuid not null references public.subcuentas(id) on delete cascade,
  dia            date not null,
  respuestas     int not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_salida  bigint not null default 0,
  primary key (subcuenta_id, dia)
);

alter table public.ia_asistentes enable row level security;
alter table public.ia_cola enable row level security;
alter table public.ia_uso enable row level security;
revoke all on public.ia_asistentes, public.ia_cola, public.ia_uso from anon, authenticated;
grant all on public.ia_asistentes, public.ia_cola, public.ia_uso to service_role;

drop policy if exists ia_asistentes_lee on public.ia_asistentes;
create policy ia_asistentes_lee on public.ia_asistentes for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists ia_asistentes_escribe on public.ia_asistentes;
create policy ia_asistentes_escribe on public.ia_asistentes for all to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
grant select, delete on public.ia_asistentes to authenticated;
grant insert (subcuenta_id, nombre, instrucciones, conocimiento, canales, activo, max_respuestas, traspaso_palabras, mensaje_traspaso) on public.ia_asistentes to authenticated;
grant update (nombre, instrucciones, conocimiento, canales, activo, max_respuestas, traspaso_palabras, mensaje_traspaso, actualizado) on public.ia_asistentes to authenticated;

drop policy if exists ia_uso_lee on public.ia_uso;
create policy ia_uso_lee on public.ia_uso for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
grant select on public.ia_uso to authenticated;

drop policy if exists ia_cola_lee on public.ia_cola;
create policy ia_cola_lee on public.ia_cola for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
grant select on public.ia_cola to authenticated;

-- El equipo puede pausar o reanudar el asistente en una conversación.
grant update (ia_pausada) on public.conv_conversaciones to authenticated;

-- Plan, límite de asistentes y canales sin solapes entre asistentes activos.
create or replace function public.ia_valida_asistente()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_choque text;
begin
  if tg_op = 'INSERT' then
    if not public.plan_incluye((select agencia_id from public.subcuentas where id = new.subcuenta_id), 'ia') then
      raise exception 'Tu plan no incluye asistentes con IA.' using errcode = 'check_violation';
    end if;
    if (select count(*) from public.ia_asistentes where subcuenta_id = new.subcuenta_id) >= 20 then
      raise exception 'Como mucho 20 asistentes por subcuenta.' using errcode = 'check_violation';
    end if;
  end if;
  new.canales := (select coalesce(array_agg(distinct c order by c), '{}') from unnest(new.canales) c);
  new.traspaso_palabras := (select coalesce(array_agg(distinct left(lower(trim(p)), 60)), '{}') from unnest(new.traspaso_palabras) p where trim(p) <> '');
  if new.activo then
    select c into v_choque from public.ia_asistentes a, unnest(a.canales) c
    where a.subcuenta_id = new.subcuenta_id and a.activo and a.id <> new.id and c = any(new.canales) limit 1;
    if v_choque is not null then
      raise exception 'Ya hay otro asistente activo en el canal «%». Desactívalo o quítale ese canal.', v_choque using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ia_asistentes_valida on public.ia_asistentes;
create trigger ia_asistentes_valida before insert or update on public.ia_asistentes for each row execute function public.ia_valida_asistente();

-- Al guardar un mensaje: los entrantes que le tocan a un asistente van a la
-- cola; una respuesta escrita por una persona pausa el asistente.
create or replace function public.ia_al_insertar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_asistente uuid; v_pausada boolean; v_agencia uuid;
begin
  if new.direccion = 'saliente' then
    if new.autor_id is not null and new.canal <> 'nota' and not new.ia then
      update public.conv_conversaciones set ia_pausada = true where id = new.conversacion_id and not ia_pausada;
    end if;
    return null;
  end if;
  select ia_pausada into v_pausada from public.conv_conversaciones where id = new.conversacion_id;
  if coalesce(v_pausada, true) then return null; end if;
  select a.id into v_asistente from public.ia_asistentes a
  where a.subcuenta_id = new.subcuenta_id and a.activo and new.canal = any(a.canales) limit 1;
  if v_asistente is null then return null; end if;
  select agencia_id into v_agencia from public.subcuentas where id = new.subcuenta_id;
  if not public.subcuenta_operativa(new.subcuenta_id) or not public.plan_incluye(v_agencia, 'ia') then return null; end if;
  insert into public.ia_cola (subcuenta_id, conversacion_id, mensaje_id, asistente_id)
  values (new.subcuenta_id, new.conversacion_id, new.id, v_asistente) on conflict (mensaje_id) do nothing;
  return null;
end $$;
drop trigger if exists conv_mensajes_ia on public.conv_mensajes;
create trigger conv_mensajes_ia after insert on public.conv_mensajes for each row execute function public.ia_al_insertar_mensaje();

-- Toma trabajo de la cola (lo usa el servidor). Lo que lleva 5 minutos
-- «procesando» se da por perdido y se reintenta (máximo 3 veces).
create or replace function public.ia_tomar(p_limite int default 10)
returns setof public.ia_cola language plpgsql volatile security definer set search_path = public as $$
begin
  update public.ia_cola set estado = 'error', detalle = 'Demasiados intentos.'
  where estado in ('pendiente', 'procesando') and intentos >= 3 and (estado = 'pendiente' or tomado_en < now() - interval '5 minutes');
  return query
  update public.ia_cola q set estado = 'procesando', tomado_en = now(), intentos = q.intentos + 1
  where q.id in (
    select id from public.ia_cola
    where (estado = 'pendiente' or (estado = 'procesando' and tomado_en < now() - interval '5 minutes')) and intentos < 3
    order by creado limit greatest(1, least(coalesce(p_limite, 10), 50))
    for update skip locked)
  returning q.*;
end $$;
revoke all on function public.ia_tomar(int) from public, anon, authenticated;
grant execute on function public.ia_tomar(int) to service_role;

-- Reserva una respuesta: comprueba que sigue tocando contestar y los límites
-- (diario de la subcuenta y por conversación del asistente). Devuelve null si
-- se puede contestar o el motivo por el que no.
create or replace function public.ia_reservar(p_cola uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare q public.ia_cola; a public.ia_asistentes; v_hoy int; v_conv int;
begin
  select * into q from public.ia_cola where id = p_cola;
  if q.id is null then return 'No existe.'; end if;
  perform pg_advisory_xact_lock(hashtext('ia:' || q.subcuenta_id::text));
  select * into a from public.ia_asistentes where id = q.asistente_id;
  if a.id is null or not a.activo then return 'El asistente está desactivado.'; end if;
  if (select ia_pausada from public.conv_conversaciones where id = q.conversacion_id) then return 'El asistente está pausado en esta conversación.'; end if;
  if not public.subcuenta_operativa(q.subcuenta_id)
     or not public.plan_incluye((select agencia_id from public.subcuentas where id = q.subcuenta_id), 'ia') then
    return 'La subcuenta no tiene la IA disponible.';
  end if;
  -- Si llegaron más mensajes después, se contesta solo al último.
  if exists (select 1 from public.conv_mensajes m, public.conv_mensajes n
             where n.id = q.mensaje_id and m.conversacion_id = q.conversacion_id and m.direccion = 'entrante'
               and m.creado > n.creado) then
    return 'Llegaron más mensajes: se contesta al último.';
  end if;
  -- Si alguien ya contestó después del mensaje, no hace falta.
  if exists (select 1 from public.conv_mensajes m, public.conv_mensajes n
             where n.id = q.mensaje_id and m.conversacion_id = q.conversacion_id and m.direccion = 'saliente'
               and m.canal <> 'nota' and m.creado > n.creado) then
    return 'Ya se contestó.';
  end if;
  select coalesce(respuestas, 0) into v_hoy from public.ia_uso where subcuenta_id = q.subcuenta_id and dia = current_date;
  if coalesce(v_hoy, 0) >= 500 then return 'Límite diario de respuestas con IA alcanzado (500).'; end if;
  select count(*) into v_conv from public.conv_mensajes
  where conversacion_id = q.conversacion_id and ia and creado > now() - interval '24 hours';
  if v_conv >= a.max_respuestas then return 'El asistente ya contestó el máximo de veces en esta conversación hoy.'; end if;
  insert into public.ia_uso (subcuenta_id, dia, respuestas) values (q.subcuenta_id, current_date, 1)
  on conflict (subcuenta_id, dia) do update set respuestas = public.ia_uso.respuestas + 1;
  return null;
end $$;
revoke all on function public.ia_reservar(uuid) from public, anon, authenticated;
grant execute on function public.ia_reservar(uuid) to service_role;

-- Uso fuera de la cola (paso «Mensaje con IA» y pruebas del editor): cuenta
-- una respuesta si queda cupo hoy. Devuelve false si no queda.
create or replace function public.ia_reservar_uso(p_subcuenta uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.plan_incluye((select agencia_id from public.subcuentas where id = p_subcuenta), 'ia')
     or not public.subcuenta_operativa(p_subcuenta) then return false; end if;
  -- Desde el panel solo vale para quien ve la subcuenta.
  if auth.uid() is not null and not public.puedo_ver_subcuenta(p_subcuenta) then return false; end if;
  perform pg_advisory_xact_lock(hashtext('ia:' || p_subcuenta::text));
  if coalesce((select respuestas from public.ia_uso where subcuenta_id = p_subcuenta and dia = current_date), 0) >= 500 then return false; end if;
  insert into public.ia_uso (subcuenta_id, dia, respuestas) values (p_subcuenta, current_date, 1)
  on conflict (subcuenta_id, dia) do update set respuestas = public.ia_uso.respuestas + 1;
  return true;
end $$;
revoke all on function public.ia_reservar_uso(uuid) from public, anon;
grant execute on function public.ia_reservar_uso(uuid) to authenticated, service_role;

create or replace function public.ia_sumar_tokens(p_subcuenta uuid, p_entrada bigint, p_salida bigint)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.ia_uso (subcuenta_id, dia, tokens_entrada, tokens_salida)
  values (p_subcuenta, current_date, greatest(p_entrada, 0), greatest(p_salida, 0))
  on conflict (subcuenta_id, dia) do update set
    tokens_entrada = public.ia_uso.tokens_entrada + greatest(p_entrada, 0),
    tokens_salida = public.ia_uso.tokens_salida + greatest(p_salida, 0);
$$;
revoke all on function public.ia_sumar_tokens(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ia_sumar_tokens(uuid, bigint, bigint) to service_role;

-- El globo del chat muestra «Asistente» en las respuestas de la IA.
create or replace function public.chat_mensajes(p_clave text, p_token text, p_desde timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v public.chat_visitantes;
  r jsonb;
begin
  v := public.chat_visitante(p_clave, p_token);
  if v.id is null then raise exception 'La conversación ha caducado. Vuelve a empezar.' using errcode = 'no_data_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'direccion', x.direccion, 'cuerpo', x.cuerpo, 'creado', x.creado,
           'autor', case when x.direccion = 'saliente' and x.ia then 'Asistente' when x.direccion = 'saliente' then coalesce(nullif(split_part(u.raw_user_meta_data ->> 'nombre', ' ', 1), ''), 'Equipo') end)
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
revoke all on function public.chat_mensajes(text, text, timestamptz) from public;
grant execute on function public.chat_mensajes(text, text, timestamptz) to anon, authenticated;
