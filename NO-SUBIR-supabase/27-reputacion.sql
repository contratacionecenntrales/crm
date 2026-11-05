-- =============================================================================
-- 27 · REPUTACIÓN (reseñas)
-- Solicitudes de reseña por SMS, WhatsApp o correo con un enlace propio. El
-- cliente puntúa de 1 a 5: si llega al umbral, se le lleva a la ficha de
-- Google (u otra web de reseñas); si no, deja su comentario en privado y el
-- equipo recibe un aviso. Requiere el 26. Re-ejecutable.
-- =============================================================================

create table if not exists public.rep_ajustes (
  subcuenta_id  uuid primary key references public.subcuentas(id) on delete cascade,
  enlace_resena text not null default '' check (enlace_resena = '' or (enlace_resena ~ '^https://[^\s<>"]+$' and length(enlace_resena) <= 500)),
  umbral        int not null default 4 check (umbral between 1 and 5),
  mensaje       text not null default 'Hola {{contacto.nombre}}, gracias por confiar en {{empresa.nombre}}. ¿Nos dices qué tal te atendimos? Solo te llevará un momento: {{enlace}}'
                check (length(mensaje) between 1 and 1000),
  asunto        text not null default '¿Qué tal fue tu experiencia con {{empresa.nombre}}?' check (length(asunto) <= 300),
  actualizado   timestamptz not null default now()
);

create table if not exists public.rep_solicitudes (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null,
  contacto_id  uuid not null,
  canal        text not null check (canal in ('email', 'sms', 'whatsapp')),
  token        uuid not null default gen_random_uuid() unique,
  estado       text not null default 'enviada' check (estado in ('enviada', 'abierta', 'valorada')),
  puntuacion   int check (puntuacion between 1 and 5),
  comentario   text not null default '' check (length(comentario) <= 2000),
  creado_por   uuid default auth.uid() references auth.users(id) on delete set null,
  creado       timestamptz not null default now(),
  abierta_en   timestamptz,
  valorada_en  timestamptz,
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete cascade
);
create index if not exists rep_solicitudes_sub_idx on public.rep_solicitudes(subcuenta_id, creado desc);
create index if not exists rep_solicitudes_contacto_idx on public.rep_solicitudes(contacto_id, creado desc);

alter table public.rep_ajustes enable row level security;
alter table public.rep_solicitudes enable row level security;
revoke all on public.rep_ajustes, public.rep_solicitudes from anon, authenticated;
grant all on public.rep_ajustes, public.rep_solicitudes to service_role;
drop policy if exists rep_ajustes_lee on public.rep_ajustes;
create policy rep_ajustes_lee on public.rep_ajustes for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists rep_ajustes_escribe on public.rep_ajustes;
create policy rep_ajustes_escribe on public.rep_ajustes for all to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
grant select, insert, update on public.rep_ajustes to authenticated;
drop policy if exists rep_solicitudes_lee on public.rep_solicitudes;
create policy rep_solicitudes_lee on public.rep_solicitudes for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
-- El token (el enlace del cliente) no lo lee el panel: solo quien lo crea.
grant select (id, subcuenta_id, contacto_id, canal, estado, puntuacion, comentario, creado_por, creado, abierta_en, valorada_en) on public.rep_solicitudes to authenticated;

-- Crea una solicitud (equipo de la subcuenta o servidor). Devuelve el token.
-- Como mucho una cada 7 días por contacto, y 500 al día por subcuenta.
create or replace function public.rep_crear(p_subcuenta uuid, p_contacto uuid, p_canal text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_token uuid; k public.crm_contactos;
begin
  if auth.uid() is not null and not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  if not public.subcuenta_operativa(p_subcuenta) then
    raise exception 'La cuenta está suspendida.' using errcode = 'insufficient_privilege';
  end if;
  select * into k from public.crm_contactos where id = p_contacto and subcuenta_id = p_subcuenta;
  if k.id is null then raise exception 'No se encontró el contacto.' using errcode = 'no_data_found'; end if;
  if p_canal not in ('email', 'sms', 'whatsapp') then raise exception 'Canal no válido.' using errcode = 'check_violation'; end if;
  if (p_canal = 'email' and k.email is null) or (p_canal <> 'email' and k.telefono !~ '^\+[0-9]{6,15}$') then
    raise exception 'El contacto no tiene %.', case when p_canal = 'email' then 'correo' else 'teléfono' end using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('rep:' || p_subcuenta::text));
  if exists (select 1 from public.rep_solicitudes where contacto_id = p_contacto and creado > now() - interval '7 days') then
    raise exception 'A este contacto ya se le pidió una reseña esta semana.' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.rep_solicitudes where subcuenta_id = p_subcuenta and creado > now() - interval '1 day') >= 500 then
    raise exception 'Límite diario de solicitudes de reseña alcanzado (500).' using errcode = 'check_violation';
  end if;
  insert into public.rep_solicitudes (subcuenta_id, contacto_id, canal) values (p_subcuenta, p_contacto, p_canal)
  returning token into v_token;
  return v_token;
end $$;
revoke all on function public.rep_crear(uuid, uuid, text) from public, anon;
grant execute on function public.rep_crear(uuid, uuid, text) to authenticated, service_role;

-- Página pública de la solicitud (sin sesión). La primera visita la marca como abierta.
create or replace function public.rep_pagina(p_token uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.rep_solicitudes; s public.subcuentas;
begin
  select * into r from public.rep_solicitudes where token = p_token;
  if r.id is null or not public.subcuenta_operativa(r.subcuenta_id) then return null; end if;
  if r.estado = 'enviada' then update public.rep_solicitudes set estado = 'abierta', abierta_en = now() where id = r.id; end if;
  select * into s from public.subcuentas where id = r.subcuenta_id;
  return jsonb_build_object('empresa', s.nombre, 'logo', s.logo_url, 'valorada', r.estado = 'valorada', 'puntuacion', r.puntuacion,
    'nombre', (select nombre from public.crm_contactos where id = r.contacto_id));
end $$;
revoke all on function public.rep_pagina(uuid) from public;
grant execute on function public.rep_pagina(uuid) to anon, authenticated;

-- El cliente valora. Devuelve adónde llevarle (la web de reseñas si es buena).
create or replace function public.rep_valorar(p_token uuid, p_puntuacion int, p_comentario text default '')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.rep_solicitudes; a public.rep_ajustes; v_buena boolean; v_destino uuid; k public.crm_contactos;
begin
  select * into r from public.rep_solicitudes where token = p_token for update;
  if r.id is null or not public.subcuenta_operativa(r.subcuenta_id) then
    raise exception 'Este enlace no es válido.' using errcode = 'no_data_found';
  end if;
  if r.estado = 'valorada' then raise exception 'Ya nos dejaste tu valoración. ¡Gracias!' using errcode = 'check_violation'; end if;
  if p_puntuacion is null or p_puntuacion not between 1 and 5 then raise exception 'Elige de 1 a 5 estrellas.' using errcode = 'check_violation'; end if;
  select * into a from public.rep_ajustes where subcuenta_id = r.subcuenta_id;
  v_buena := p_puntuacion >= coalesce(a.umbral, 4);
  update public.rep_solicitudes set estado = 'valorada', puntuacion = p_puntuacion, comentario = left(trim(coalesce(p_comentario, '')), 2000),
    valorada_en = now(), abierta_en = coalesce(abierta_en, now()) where id = r.id;
  insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle)
  values (r.subcuenta_id, r.contacto_id, 'resena', jsonb_build_object('puntuacion', p_puntuacion, 'comentario', left(trim(coalesce(p_comentario, '')), 300)));
  if not v_buena then
    select * into k from public.crm_contactos where id = r.contacto_id;
    v_destino := coalesce(k.propietario_id, r.creado_por);
    if v_destino is not null then
      insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
      select v_destino, s.agencia_id, s.id, 'alerta', 'Reputación',
             'Valoración baja (' || p_puntuacion || '/5) de ' || coalesce(nullif(trim(k.nombre || ' ' || k.apellidos), ''), k.email, k.telefono),
             left(coalesce(nullif(trim(p_comentario), ''), 'Sin comentario.'), 200), '/subcuenta/' || s.id || '/reputacion'
      from public.subcuentas s where s.id = r.subcuenta_id;
    end if;
  end if;
  return jsonb_build_object('buena', v_buena, 'enlace', case when v_buena and coalesce(a.enlace_resena, '') <> '' then a.enlace_resena end);
end $$;
revoke all on function public.rep_valorar(uuid, int, text) from public;
grant execute on function public.rep_valorar(uuid, int, text) to anon, authenticated;
