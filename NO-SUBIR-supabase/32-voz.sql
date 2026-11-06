-- =============================================================================
-- 32 · ASISTENTE DE VOZ
-- Un asistente puede contestar las llamadas al número de Twilio de la
-- subcuenta: saluda, escucha (voz a texto de Twilio), contesta con la IA y,
-- si hace falta una persona, desvía la llamada a un teléfono del equipo. Cada
-- llamada queda en voz_llamadas y, al colgar, su transcripción se guarda como
-- comentario interno en la conversación del contacto.
-- Requiere el 24. Re-ejecutable.
-- =============================================================================

alter table public.ia_asistentes drop constraint if exists ia_asistentes_canales_check;
alter table public.ia_asistentes add constraint ia_asistentes_canales_check
  check (canales <@ array['chat', 'sms', 'whatsapp', 'email', 'voz']::text[]);
alter table public.ia_asistentes add column if not exists saludo_voz text not null default '';
alter table public.ia_asistentes add column if not exists desvio_voz text not null default '';
alter table public.ia_asistentes drop constraint if exists ia_asistentes_saludo_voz_check;
alter table public.ia_asistentes add constraint ia_asistentes_saludo_voz_check check (length(saludo_voz) <= 500);
alter table public.ia_asistentes drop constraint if exists ia_asistentes_desvio_voz_check;
alter table public.ia_asistentes add constraint ia_asistentes_desvio_voz_check check (desvio_voz = '' or desvio_voz ~ '^\+[0-9]{6,15}$');
grant insert (saludo_voz, desvio_voz), update (saludo_voz, desvio_voz) on public.ia_asistentes to authenticated;

create table if not exists public.voz_llamadas (
  id              uuid primary key default gen_random_uuid(),
  subcuenta_id    uuid not null references public.subcuentas(id) on delete cascade,
  asistente_id    uuid references public.ia_asistentes(id) on delete set null,
  contacto_id     uuid references public.crm_contactos(id) on delete set null,
  conversacion_id uuid references public.conv_conversaciones(id) on delete set null,
  call_sid        text not null unique check (call_sid ~ '^CA[0-9a-fA-F]{32}$'),
  de              text not null default '',
  estado          text not null default 'en_curso' check (estado in ('en_curso', 'terminada', 'desviada', 'sin_respuesta')),
  turnos          jsonb not null default '[]' check (jsonb_typeof(turnos) = 'array'),
  motivo          text not null default '' check (length(motivo) <= 500),
  creado          timestamptz not null default now(),
  terminado       timestamptz
);
create index if not exists voz_llamadas_sub_idx on public.voz_llamadas(subcuenta_id, creado desc);

alter table public.voz_llamadas enable row level security;
revoke all on public.voz_llamadas from anon, authenticated;
grant all on public.voz_llamadas to service_role;
grant select on public.voz_llamadas to authenticated;
drop policy if exists voz_llamadas_lee on public.voz_llamadas;
create policy voz_llamadas_lee on public.voz_llamadas for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));

-- Empieza (o retoma) una llamada. Devuelve null si nadie la atiende por voz.
create or replace function public.voz_iniciar(p_subcuenta uuid, p_call_sid text, p_de text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.ia_asistentes; l public.voz_llamadas; v_de text; v_contacto uuid; v_conv uuid;
begin
  select * into l from public.voz_llamadas where call_sid = p_call_sid;
  if l.id is not null then
    if l.subcuenta_id <> p_subcuenta then return null; end if;
    select * into a from public.ia_asistentes where id = l.asistente_id;
  else
    if not public.subcuenta_operativa(p_subcuenta)
       or not public.plan_incluye((select agencia_id from public.subcuentas where id = p_subcuenta), 'ia') then return null; end if;
    select * into a from public.ia_asistentes where subcuenta_id = p_subcuenta and activo and 'voz' = any(canales) limit 1;
    if a.id is null then return null; end if;
    if (select count(*) from public.voz_llamadas where subcuenta_id = p_subcuenta and creado > now() - interval '1 hour') >= 200 then
      return null;
    end if;
    v_de := regexp_replace(coalesce(p_de, ''), '[^0-9+]', '', 'g');
    if v_de ~ '^\+[0-9]{6,15}$' then
      select id into v_contacto from public.crm_contactos where subcuenta_id = p_subcuenta and telefono = v_de order by creado limit 1;
      if v_contacto is null then
        insert into public.crm_contactos (subcuenta_id, nombre, telefono, fuente)
        values (p_subcuenta, '', v_de, 'Llamada entrante') returning id into v_contacto;
      end if;
      insert into public.conv_conversaciones (subcuenta_id, contacto_id) values (p_subcuenta, v_contacto)
      on conflict (subcuenta_id, contacto_id) do update set estado = 'abierta'
      returning id into v_conv;
    else
      v_de := '';
    end if;
    insert into public.voz_llamadas (subcuenta_id, asistente_id, contacto_id, conversacion_id, call_sid, de)
    values (p_subcuenta, a.id, v_contacto, v_conv, p_call_sid, v_de)
    on conflict (call_sid) do nothing
    returning * into l;
    if l.id is null then select * into l from public.voz_llamadas where call_sid = p_call_sid; end if;
  end if;
  if a.id is null or not a.activo then return null; end if;
  return jsonb_build_object('llamada', l.id, 'estado', l.estado, 'turnos', l.turnos, 'contacto', l.contacto_id,
    'asistente', jsonb_build_object('id', a.id, 'nombre', a.nombre, 'instrucciones', a.instrucciones, 'conocimiento', a.conocimiento,
      'traspaso_palabras', to_jsonb(a.traspaso_palabras), 'mensaje_traspaso', a.mensaje_traspaso, 'saludo', a.saludo_voz, 'desvio', a.desvio_voz));
end $$;
revoke all on function public.voz_iniciar(uuid, text, text) from public, anon, authenticated;
grant execute on function public.voz_iniciar(uuid, text, text) to service_role;

-- Añade una intervención («cliente» o «asistente») a una llamada en curso.
create or replace function public.voz_anadir(p_llamada uuid, p_de text, p_texto text)
returns int language plpgsql volatile security definer set search_path = public as $$
declare v int;
begin
  if p_de not in ('cliente', 'asistente') then raise exception 'Turno no válido.' using errcode = 'check_violation'; end if;
  update public.voz_llamadas
  set turnos = turnos || jsonb_build_array(jsonb_build_object('de', p_de, 'texto', left(coalesce(p_texto, ''), 2000), 'en', now()))
  where id = p_llamada and estado = 'en_curso' and jsonb_array_length(turnos) < 80
  returning jsonb_array_length(turnos) into v;
  return coalesce(v, -1);
end $$;
revoke all on function public.voz_anadir(uuid, text, text) from public, anon, authenticated;
grant execute on function public.voz_anadir(uuid, text, text) to service_role;

-- Cierra la llamada y deja la transcripción en la conversación (una sola vez).
create or replace function public.voz_terminar(p_call_sid text, p_estado text, p_motivo text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare l public.voz_llamadas; a public.ia_asistentes; v_texto text; v_dest uuid; v_agencia uuid;
begin
  if p_estado not in ('terminada', 'desviada', 'sin_respuesta') then raise exception 'Estado no válido.' using errcode = 'check_violation'; end if;
  update public.voz_llamadas set estado = p_estado, motivo = left(coalesce(p_motivo, ''), 500), terminado = now()
  where call_sid = p_call_sid and estado = 'en_curso'
  returning * into l;
  if l.id is null or l.conversacion_id is null then return; end if;
  select * into a from public.ia_asistentes where id = l.asistente_id;
  select string_agg(case t->>'de' when 'cliente' then 'Cliente: ' else coalesce(a.nombre, 'Asistente') || ': ' end || (t->>'texto'), E'\n' order by n)
  into v_texto from jsonb_array_elements(l.turnos) with ordinality as x(t, n);
  insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, ia)
  values (l.subcuenta_id, l.conversacion_id, 'saliente', 'nota', left(
    '📞 Llamada atendida por ' || coalesce(a.nombre, 'el asistente de voz')
    || case p_estado when 'desviada' then ' · desviada a una persona' when 'sin_respuesta' then ' · el cliente no habló' else '' end
    || case when coalesce(p_motivo, '') <> '' then E'\nMotivo: ' || p_motivo else '' end
    || E'\n\n' || coalesce(v_texto, '(sin conversación)'), 20000), 'enviado', true);
  -- Si pidió una persona y no se pudo desviar, se avisa a quien lleva el contacto.
  if p_estado = 'terminada' and coalesce(p_motivo, '') <> '' then
    select coalesce(c.asignado_id, k.propietario_id) into v_dest
    from public.conv_conversaciones c join public.crm_contactos k on k.id = c.contacto_id where c.id = l.conversacion_id;
    select agencia_id into v_agencia from public.subcuentas where id = l.subcuenta_id;
    if v_dest is not null then
      insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
      values (v_dest, v_agencia, l.subcuenta_id, 'alerta', 'Conversaciones', 'Llamada para devolver', left(p_motivo, 200),
              '/subcuenta/' || l.subcuenta_id || '/conversaciones?c=' || l.conversacion_id);
    end if;
  end if;
end $$;
revoke all on function public.voz_terminar(text, text, text) from public, anon, authenticated;
grant execute on function public.voz_terminar(text, text, text) to service_role;
