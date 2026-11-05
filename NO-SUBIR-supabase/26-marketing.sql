-- =============================================================================
-- 26 · MARKETING (campañas masivas)
-- Campañas de correo, SMS o WhatsApp a un grupo de contactos (por etiquetas),
-- para enviar ya o a una hora. Respetan «No molestar», llevan enlace de baja
-- (correo) o «BAJA» por respuesta (SMS/WhatsApp) y se envían por tandas desde
-- el servidor. Requiere el 25. Re-ejecutable.
-- =============================================================================

create table if not exists public.mkt_campanas (
  id            uuid primary key default gen_random_uuid(),
  subcuenta_id  uuid not null references public.subcuentas(id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) between 1 and 120),
  canal         text not null check (canal in ('email', 'sms', 'whatsapp')),
  asunto        text not null default '' check (length(asunto) <= 300),
  cuerpo        text not null default '' check (length(cuerpo) <= 20000),
  etiquetas     text[] not null default '{}' check (cardinality(etiquetas) <= 20),
  modo          text not null default 'alguna' check (modo in ('alguna', 'todas')),
  excluir       text[] not null default '{}' check (cardinality(excluir) <= 20),
  estado        text not null default 'borrador' check (estado in ('borrador', 'programada', 'enviando', 'enviada', 'cancelada')),
  programada_en timestamptz,
  lanzada_en    timestamptz,
  terminada_en  timestamptz,
  creado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now(),
  unique (id, subcuenta_id)
);
create index if not exists mkt_campanas_sub_idx on public.mkt_campanas(subcuenta_id, creado desc);

create table if not exists public.mkt_envios (
  id            uuid primary key default gen_random_uuid(),
  campana_id    uuid not null,
  subcuenta_id  uuid not null,
  contacto_id   uuid not null,
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'procesando', 'enviado', 'fallido', 'omitido')),
  error         text not null default '' check (length(error) <= 1000),
  mensaje_id    uuid references public.conv_mensajes(id) on delete set null,
  token         uuid not null default gen_random_uuid() unique, -- enlace de baja
  baja          boolean not null default false,
  tomado_en     timestamptz,
  enviado_en    timestamptz,
  unique (campana_id, contacto_id),
  foreign key (campana_id, subcuenta_id) references public.mkt_campanas(id, subcuenta_id) on delete cascade,
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists mkt_envios_pend_idx on public.mkt_envios(estado, campana_id) where estado in ('pendiente', 'procesando');

alter table public.mkt_campanas enable row level security;
alter table public.mkt_envios enable row level security;
revoke all on public.mkt_campanas, public.mkt_envios from anon, authenticated;
grant all on public.mkt_campanas, public.mkt_envios to service_role;
drop policy if exists mkt_campanas_lee on public.mkt_campanas;
create policy mkt_campanas_lee on public.mkt_campanas for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists mkt_campanas_escribe on public.mkt_campanas;
create policy mkt_campanas_escribe on public.mkt_campanas for all to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
grant select, delete on public.mkt_campanas to authenticated;
grant insert (subcuenta_id, nombre, canal, asunto, cuerpo, etiquetas, modo, excluir) on public.mkt_campanas to authenticated;
grant update (nombre, canal, asunto, cuerpo, etiquetas, modo, excluir, actualizado) on public.mkt_campanas to authenticated;
drop policy if exists mkt_envios_lee on public.mkt_envios;
create policy mkt_envios_lee on public.mkt_envios for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
grant select (id, campana_id, subcuenta_id, contacto_id, estado, error, mensaje_id, baja, enviado_en) on public.mkt_envios to authenticated;

-- Solo se edita (o borra) lo que aún no se ha lanzado.
create or replace function public.mkt_protege()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.estado in ('enviando', 'programada') and auth.uid() is not null then
      raise exception 'Cancela la campaña antes de borrarla.' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if old.estado <> 'borrador' and auth.uid() is not null
     and (new.canal, new.asunto, new.cuerpo, new.etiquetas, new.modo, new.excluir) is distinct from (old.canal, old.asunto, old.cuerpo, old.etiquetas, old.modo, old.excluir) then
    raise exception 'Una campaña lanzada ya no se puede editar. Duplícala para hacer otra.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists mkt_campanas_protege on public.mkt_campanas;
create trigger mkt_campanas_protege before update or delete on public.mkt_campanas for each row execute function public.mkt_protege();

-- Contactos a los que llegaría una campaña (con su canal y sin «No molestar»).
create or replace function public.mkt_destinatarios(p_subcuenta uuid, p_canal text, p_etiquetas text[], p_modo text, p_excluir text[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from public.crm_contactos c
  where c.subcuenta_id = p_subcuenta
    and (case when p_canal = 'email' then c.email is not null else c.telefono ~ '^\+[0-9]{6,15}$' end)
    and not c.dnd and not (p_canal = any(c.dnd_canales))
    and (cardinality(coalesce(p_etiquetas, '{}')) = 0
         or (p_modo = 'todas' and c.etiquetas @> p_etiquetas)
         or (p_modo <> 'todas' and c.etiquetas && p_etiquetas))
    and not (c.etiquetas && coalesce(p_excluir, '{}'))
  limit 20000;
$$;
revoke all on function public.mkt_destinatarios(uuid, text, text[], text, text[]) from public, anon, authenticated;

create or replace function public.mkt_audiencia(p_subcuenta uuid, p_canal text, p_etiquetas text[], p_modo text, p_excluir text[])
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then return 0; end if;
  return (select count(*) from public.mkt_destinatarios(p_subcuenta, p_canal, p_etiquetas, p_modo, p_excluir));
end $$;
revoke all on function public.mkt_audiencia(uuid, text, text[], text, text[]) from public, anon;
grant execute on function public.mkt_audiencia(uuid, text, text[], text, text[]) to authenticated;

-- Lanza la campaña: fija la lista de destinatarios y la deja en cola.
create or replace function public.mkt_lanzar(p_campana uuid, p_cuando timestamptz default null)
returns int language plpgsql volatile security definer set search_path = public as $$
declare c public.mkt_campanas; v_n int;
begin
  select * into c from public.mkt_campanas where id = p_campana for update;
  if c.id is null or not public.soy_admin_subcuenta(c.subcuenta_id) then
    raise exception 'Solo un administrador de la subcuenta puede lanzar campañas.' using errcode = 'insufficient_privilege';
  end if;
  if not public.subcuenta_operativa(c.subcuenta_id) then
    raise exception 'La cuenta está suspendida.' using errcode = 'insufficient_privilege';
  end if;
  if c.estado <> 'borrador' then raise exception 'Esta campaña ya se lanzó.' using errcode = 'check_violation'; end if;
  if length(trim(c.cuerpo)) = 0 or (c.canal = 'email' and length(trim(c.asunto)) = 0) then
    raise exception 'Escribe el mensaje%.', case when c.canal = 'email' then ' y el asunto' else '' end using errcode = 'check_violation';
  end if;
  if p_cuando is not null and (p_cuando < now() - interval '5 minutes' or p_cuando > now() + interval '1 year') then
    raise exception 'Elige una fecha futura (como mucho dentro de un año).' using errcode = 'check_violation';
  end if;
  -- Una cuenta no lanza más de 50 000 envíos al día.
  if (select count(*) from public.mkt_envios e join public.mkt_campanas x on x.id = e.campana_id
      where e.subcuenta_id = c.subcuenta_id and x.lanzada_en > now() - interval '1 day') >= 50000 then
    raise exception 'Límite diario de envíos de campañas alcanzado (50 000).' using errcode = 'check_violation';
  end if;
  insert into public.mkt_envios (campana_id, subcuenta_id, contacto_id)
  select c.id, c.subcuenta_id, d from public.mkt_destinatarios(c.subcuenta_id, c.canal, c.etiquetas, c.modo, c.excluir) d
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'La campaña no llega a ningún contacto (revisa las etiquetas y el canal).' using errcode = 'check_violation'; end if;
  update public.mkt_campanas set estado = case when p_cuando is not null and p_cuando > now() then 'programada' else 'enviando' end,
    programada_en = coalesce(p_cuando, now()), lanzada_en = now(), actualizado = now()
  where id = c.id;
  return v_n;
end $$;
revoke all on function public.mkt_lanzar(uuid, timestamptz) from public, anon;
grant execute on function public.mkt_lanzar(uuid, timestamptz) to authenticated;

create or replace function public.mkt_cancelar(p_campana uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare c public.mkt_campanas;
begin
  select * into c from public.mkt_campanas where id = p_campana for update;
  if c.id is null or not public.soy_admin_subcuenta(c.subcuenta_id) then
    raise exception 'Solo un administrador de la subcuenta puede cancelar campañas.' using errcode = 'insufficient_privilege';
  end if;
  if c.estado not in ('programada', 'enviando') then return; end if;
  update public.mkt_envios set estado = 'omitido', error = 'Campaña cancelada.' where campana_id = c.id and estado = 'pendiente';
  update public.mkt_campanas set estado = 'cancelada', terminada_en = now(), actualizado = now() where id = c.id;
end $$;
revoke all on function public.mkt_cancelar(uuid) from public, anon;
grant execute on function public.mkt_cancelar(uuid) to authenticated;

-- El servidor toma una tanda de envíos de campañas ya en hora.
create or replace function public.mkt_tomar(p_limite int default 100)
returns table (id uuid, campana_id uuid, subcuenta_id uuid, contacto_id uuid, token uuid)
language plpgsql volatile security definer set search_path = public as $$
begin
  update public.mkt_campanas set estado = 'enviando', actualizado = now()
  where estado = 'programada' and programada_en <= now();
  -- Cierra las que ya no tienen nada pendiente.
  update public.mkt_campanas x set estado = 'enviada', terminada_en = now(), actualizado = now()
  where x.estado = 'enviando' and not exists (select 1 from public.mkt_envios e where e.campana_id = x.id and e.estado in ('pendiente', 'procesando'));
  return query
  update public.mkt_envios e set estado = 'procesando', tomado_en = now()
  where e.id in (
    select z.id from public.mkt_envios z join public.mkt_campanas x on x.id = z.campana_id
    where x.estado = 'enviando' and public.subcuenta_operativa(z.subcuenta_id)
      and (z.estado = 'pendiente' or (z.estado = 'procesando' and z.tomado_en < now() - interval '10 minutes'))
    order by z.campana_id, z.id
    limit greatest(1, least(coalesce(p_limite, 100), 500))
    for update of z skip locked)
  returning e.id, e.campana_id, e.subcuenta_id, e.contacto_id, e.token;
end $$;
revoke all on function public.mkt_tomar(int) from public, anon, authenticated;
grant execute on function public.mkt_tomar(int) to service_role;

-- Enlace de baja de un correo de campaña (sin sesión).
create or replace function public.mkt_baja(p_token uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e public.mkt_envios; c public.mkt_campanas;
begin
  select * into e from public.mkt_envios where token = p_token;
  if e.id is null then return null; end if;
  select * into c from public.mkt_campanas where id = e.campana_id;
  update public.crm_contactos set dnd_canales = (select array_agg(distinct x) from unnest(dnd_canales || c.canal) x)
  where id = e.contacto_id;
  if not e.baja then
    update public.mkt_envios set baja = true where id = e.id;
    insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle)
    values (e.subcuenta_id, e.contacto_id, 'baja', jsonb_build_object('canal', c.canal, 'campana', c.nombre));
  end if;
  return jsonb_build_object('empresa', (select nombre from public.subcuentas where id = e.subcuenta_id), 'canal', c.canal);
end $$;
revoke all on function public.mkt_baja(uuid) from public;
grant execute on function public.mkt_baja(uuid) to anon, authenticated;

-- «BAJA» / «STOP» por SMS o WhatsApp: el contacto deja de recibir por ese canal.
create or replace function public.mkt_baja_por_respuesta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.direccion = 'entrante' and new.canal in ('sms', 'whatsapp')
     and lower(regexp_replace(trim(new.cuerpo), '[^[:alpha:]]', '', 'g')) in ('baja', 'stop', 'darmedebaja', 'unsubscribe', 'cancelar') then
    update public.crm_contactos k set dnd_canales = (select array_agg(distinct x) from unnest(k.dnd_canales || new.canal) x)
    from public.conv_conversaciones c where c.id = new.conversacion_id and k.id = c.contacto_id;
    insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle)
    select new.subcuenta_id, c.contacto_id, 'baja', jsonb_build_object('canal', new.canal, 'campana', 'respuesta «' || left(trim(new.cuerpo), 20) || '»')
    from public.conv_conversaciones c where c.id = new.conversacion_id;
    update public.conv_conversaciones set ia_pausada = true where id = new.conversacion_id;
  end if;
  return null;
end $$;
drop trigger if exists conv_mensajes_baja on public.conv_mensajes;
create trigger conv_mensajes_baja after insert on public.conv_mensajes for each row execute function public.mkt_baja_por_respuesta();

-- Resumen por campaña para la lista.
create or replace function public.mkt_resumen(p_subcuenta uuid)
returns table (campana_id uuid, total int, enviados int, fallidos int, omitidos int, pendientes int, bajas int)
language sql stable security definer set search_path = public as $$
  select e.campana_id, count(*)::int,
    count(*) filter (where e.estado = 'enviado')::int, count(*) filter (where e.estado = 'fallido')::int,
    count(*) filter (where e.estado = 'omitido')::int, count(*) filter (where e.estado in ('pendiente', 'procesando'))::int,
    count(*) filter (where e.baja)::int
  from public.mkt_envios e where e.subcuenta_id = p_subcuenta and public.puedo_ver_subcuenta(p_subcuenta)
  group by e.campana_id;
$$;
revoke all on function public.mkt_resumen(uuid) from public, anon;
grant execute on function public.mkt_resumen(uuid) to authenticated;
