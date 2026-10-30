-- =============================================================================
-- 14 · AVISOS DE CITAS: CONFIRMACIÓN, RECORDATORIOS, CAMBIOS, CANCELACIONES
--      Y CANCELACIÓN POR EL CLIENTE
--
-- Requiere 12 y 13. Idempotente.
--
-- CÓMO FUNCIONA
--   · Cada calendario decide por qué canales avisa (correo, SMS, WhatsApp),
--     si manda confirmación y con cuánta antelación recuerda la cita.
--   · Al crear, mover o cancelar una cita, un disparador rehace su cola de
--     avisos (cal_avisos). Nadie del equipo escribe en la cola a mano.
--   · Un proceso del servidor (/api/cron/recordatorios, cada 5 minutos)
--     recoge los avisos vencidos con cal_tomar_avisos() y los envía como
--     mensajes de Conversaciones, así quedan en el historial del contacto.
--   · Cada cita tiene un token secreto para el enlace «cancelar mi cita».
-- =============================================================================

alter table public.cal_calendarios
  add column if not exists aviso_confirmacion boolean not null default true,
  add column if not exists avisos_canales text[] not null default '{email}',
  add column if not exists recordatorios int[] not null default '{1440}',
  add column if not exists plantilla_confirmacion text not null default '',
  add column if not exists plantilla_recordatorio text not null default '',
  add column if not exists permitir_cancelar boolean not null default true;

create or replace function public.cal_minutos_validos(p int[]) returns boolean
language sql immutable as $$ select coalesce(bool_and(m between 5 and 43200), true) from unnest(p) m $$;

do $$ begin
  alter table public.cal_calendarios add constraint cal_calendarios_avisos_check check (
    avisos_canales <@ array['email', 'sms', 'whatsapp']::text[]
    and cardinality(recordatorios) <= 5
    and public.cal_minutos_validos(recordatorios)
    and length(plantilla_confirmacion) <= 1600 and length(plantilla_recordatorio) <= 1600);
exception when duplicate_object then null; end $$;

alter table public.cal_citas
  add column if not exists avisar boolean not null default true,
  add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists cal_citas_token_uidx on public.cal_citas(token);
grant insert (avisar), update (avisar) on public.cal_citas to authenticated;

create table if not exists public.cal_avisos (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  cita_id      uuid not null references public.cal_citas(id) on delete cascade,
  tipo         text not null check (tipo in ('confirmacion', 'recordatorio', 'cambio', 'cancelacion')),
  canal        text not null check (canal in ('email', 'sms', 'whatsapp')),
  enviar_en    timestamptz not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'procesando', 'enviado', 'fallido', 'omitido')),
  intentos     int not null default 0,
  error        text not null default '',
  mensaje_id   uuid references public.conv_mensajes(id) on delete set null,
  tomado_en    timestamptz,
  enviado_en   timestamptz,
  creado       timestamptz not null default now()
);
create index if not exists cal_avisos_cola_idx on public.cal_avisos(enviar_en) where estado in ('pendiente', 'procesando');
create index if not exists cal_avisos_cita_idx on public.cal_avisos(cita_id);

alter table public.cal_avisos enable row level security;
revoke all on public.cal_avisos from anon, authenticated;
grant all on public.cal_avisos to service_role;
grant select on public.cal_avisos to authenticated;
drop policy if exists cal_avisos_lee on public.cal_avisos;
create policy cal_avisos_lee on public.cal_avisos for select to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id));

-- Rehace la cola de avisos de una cita.
create or replace function public.cal_programar_avisos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.cal_calendarios;
  v_tipo text;
  v_canal text;
  v_min int;
begin
  -- Lo que estaba pendiente de esta cita deja de valer.
  delete from public.cal_avisos where cita_id = new.id and estado in ('pendiente', 'procesando');
  if new.contacto_id is null or not new.avisar then return null; end if;
  select * into c from public.cal_calendarios where id = new.calendario_id;

  if tg_op = 'INSERT' then
    v_tipo := case when new.estado <> 'cancelada' and c.aviso_confirmacion then 'confirmacion' end;
  elsif new.estado = 'cancelada' and old.estado <> 'cancelada' then
    v_tipo := 'cancelacion';
  elsif new.estado <> 'cancelada' and new.inicio is distinct from old.inicio then
    v_tipo := 'cambio';
  end if;

  if new.inicio <= now() then return null; end if;

  foreach v_canal in array c.avisos_canales loop
    if v_tipo is not null then
      insert into public.cal_avisos (subcuenta_id, cita_id, tipo, canal, enviar_en)
      values (new.subcuenta_id, new.id, v_tipo, v_canal, now());
    end if;
    if new.estado in ('nueva', 'confirmada') then
      foreach v_min in array c.recordatorios loop
        -- Solo los que aún están por llegar (y no pegados a la confirmación).
        if new.inicio - make_interval(mins => v_min) > now() + interval '5 minutes' then
          insert into public.cal_avisos (subcuenta_id, cita_id, tipo, canal, enviar_en)
          values (new.subcuenta_id, new.id, 'recordatorio', v_canal, new.inicio - make_interval(mins => v_min));
        end if;
      end loop;
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists cal_citas_avisos on public.cal_citas;
create trigger cal_citas_avisos after insert or update of inicio, estado, contacto_id, calendario_id, avisar on public.cal_citas
  for each row execute function public.cal_programar_avisos();

-- El servidor toma los avisos vencidos (o atascados más de 10 minutos) y los
-- marca como «procesando». SKIP LOCKED: dos procesos a la vez no se pisan.
create or replace function public.cal_tomar_avisos(p_limite int default 50)
returns table (aviso_id uuid, subcuenta_id uuid, cita_id uuid, tipo text, canal text)
language plpgsql volatile security definer set search_path = public as $$
begin
  return query
  with elegidos as (
    select a.id from public.cal_avisos a
    where (a.estado = 'pendiente' and a.enviar_en <= now())
       or (a.estado = 'procesando' and a.tomado_en < now() - interval '10 minutes' and a.intentos < 3)
    order by a.enviar_en
    limit least(greatest(p_limite, 1), 200)
    for update skip locked
  )
  update public.cal_avisos a set estado = 'procesando', tomado_en = now(), intentos = a.intentos + 1
  from elegidos e where a.id = e.id
  returning a.id, a.subcuenta_id, a.cita_id, a.tipo, a.canal;
end $$;
revoke all on function public.cal_tomar_avisos(int) from public, anon, authenticated;
grant execute on function public.cal_tomar_avisos(int) to service_role;

-- --- Cancelación por el cliente (enlace con token, sin sesión) ------------------
create or replace function public.cal_cita_publica(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'titulo', c.nombre, 'inicio', x.inicio, 'fin', x.fin, 'estado', x.estado, 'zona_horaria', c.zona_horaria,
    'ubicacion', coalesce(nullif(x.ubicacion, ''), c.ubicacion), 'empresa', s.nombre, 'logo_url', s.logo_url,
    'slug', case when c.activo then c.slug end,
    'puede_cancelar', c.permitir_cancelar and x.estado in ('nueva', 'confirmada') and x.inicio > now())
  from public.cal_citas x
  join public.cal_calendarios c on c.id = x.calendario_id
  join public.subcuentas s on s.id = x.subcuenta_id
  where x.token = p_token;
$$;

create or replace function public.cal_cancelar_publico(p_token uuid, p_motivo text default '')
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v public.cal_citas;
begin
  select x.* into v from public.cal_citas x join public.cal_calendarios c on c.id = x.calendario_id
  where x.token = p_token and c.permitir_cancelar for update of x;
  if not found then
    raise exception 'Esta cita no existe o no se puede cancelar desde aquí.' using errcode = 'no_data_found';
  end if;
  if v.estado not in ('nueva', 'confirmada') or v.inicio <= now() then return false; end if;
  update public.cal_citas set estado = 'cancelada',
    notas = left(trim(both from notas || case when trim(coalesce(p_motivo, '')) <> ''
      then E'\n\nCancelada por el cliente: ' || left(trim(p_motivo), 500) else E'\n\nCancelada por el cliente.' end), 5000)
  where id = v.id;
  return true;
end $$;

revoke all on function public.cal_cita_publica(uuid) from public;
revoke all on function public.cal_cancelar_publico(uuid, text) from public;
grant execute on function public.cal_cita_publica(uuid) to anon, authenticated;
grant execute on function public.cal_cancelar_publico(uuid, text) to anon, authenticated;

-- El aviso al equipo de una cita cancelada por el cliente lo da el disparador
-- cal_anota_cita (12): avisa a la persona asignada cuando pasa a «cancelada».
