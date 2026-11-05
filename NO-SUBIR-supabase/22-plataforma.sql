-- =============================================================================
-- 22 · PLATAFORMA (Metatok, la «agencia madre»)
-- Metatok da de alta agencias, les asigna un plan con límites y puede
-- suspenderlas. Cada agencia gestiona sus subcuentas como hasta ahora.
-- Requiere el 21. Se puede volver a ejecutar.
--
-- Primer administrador de la plataforma (SQL Editor, una vez):
--   select public.plataforma_alta_admin('tu-correo@dominio.com');
-- =============================================================================

create table if not exists public.plataforma_admins (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol        text not null default 'superadmin' check (rol in ('superadmin', 'soporte')),
  creado     timestamptz not null default now()
);
alter table public.plataforma_admins enable row level security;
revoke all on public.plataforma_admins from anon, authenticated;
grant all on public.plataforma_admins to service_role;

create or replace function public.es_admin_plataforma()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plataforma_admins where usuario_id = auth.uid());
$$;
create or replace function public.es_superadmin_plataforma()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plataforma_admins where usuario_id = auth.uid() and rol = 'superadmin');
$$;
revoke all on function public.es_admin_plataforma() from public, anon;
revoke all on function public.es_superadmin_plataforma() from public, anon;
grant execute on function public.es_admin_plataforma() to authenticated;
grant execute on function public.es_superadmin_plataforma() to authenticated;

-- Solo desde el SQL Editor (postgres) o con la clave de servicio.
create or replace function public.plataforma_alta_admin(p_email text, p_rol text default 'superadmin')
returns uuid language plpgsql volatile security definer set search_path = public, auth as $$
declare v uuid;
begin
  if auth.uid() is not null and not public.es_superadmin_plataforma() then
    raise exception 'Solo un superadministrador de la plataforma puede dar de alta administradores.' using errcode = 'insufficient_privilege';
  end if;
  select id into v from auth.users where lower(email) = lower(trim(p_email));
  if v is null then raise exception 'No existe ningún usuario con ese correo: créalo primero en Authentication → Users.' using errcode = 'no_data_found'; end if;
  insert into public.plataforma_admins (usuario_id, rol) values (v, p_rol)
  on conflict (usuario_id) do update set rol = excluded.rol;
  return v;
end $$;
revoke all on function public.plataforma_alta_admin(text, text) from public, anon;
grant execute on function public.plataforma_alta_admin(text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Planes y ajustes de la plataforma
-- -----------------------------------------------------------------------------
create table if not exists public.planes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null unique check (length(trim(nombre)) between 1 and 60),
  descripcion     text not null default '' check (length(descripcion) <= 300),
  precio_mensual  numeric(10,2) not null default 0 check (precio_mensual >= 0),
  moneda          text not null default 'EUR' check (moneda ~ '^[A-Z]{3}$'),
  max_subcuentas  int check (max_subcuentas is null or max_subcuentas >= 0),  -- null = sin límite
  max_usuarios    int check (max_usuarios is null or max_usuarios >= 1),
  funciones       jsonb not null default '{"ia": true, "embudos": true, "whatsapp": true, "api": true, "marca_blanca": true}'::jsonb,
  activo          boolean not null default true,
  orden           int not null default 0,
  creado          timestamptz not null default now()
);
alter table public.planes enable row level security;
revoke all on public.planes from anon, authenticated;
grant all on public.planes to service_role;
drop policy if exists planes_lee on public.planes;
create policy planes_lee on public.planes for select to authenticated using (true);
drop policy if exists planes_admin on public.planes;
create policy planes_admin on public.planes for all to authenticated
  using (public.es_superadmin_plataforma()) with check (public.es_superadmin_plataforma());
grant select, insert, update, delete on public.planes to authenticated;

insert into public.planes (nombre, descripcion, precio_mensual, max_subcuentas, max_usuarios, orden) values
  ('Starter', 'Para empezar: 3 subcuentas y todas las funciones.', 97, 3, 10, 1),
  ('Unlimited', 'Subcuentas ilimitadas.', 297, null, null, 2)
on conflict (nombre) do nothing;

create table if not exists public.plataforma_ajustes (
  id               boolean primary key default true check (id),
  nombre           text not null default 'Metatok' check (length(trim(nombre)) between 1 and 60),
  registro_abierto boolean not null default false, -- ¿cualquiera con cuenta puede crear su agencia?
  plan_defecto     uuid references public.planes(id) on delete set null,
  dias_prueba      int not null default 14 check (dias_prueba between 0 and 365),
  actualizado      timestamptz not null default now()
);
insert into public.plataforma_ajustes (id, plan_defecto) select true, (select id from public.planes where nombre = 'Starter')
on conflict (id) do nothing;
alter table public.plataforma_ajustes enable row level security;
revoke all on public.plataforma_ajustes from anon, authenticated;
grant all on public.plataforma_ajustes to service_role;
drop policy if exists plataforma_ajustes_lee on public.plataforma_ajustes;
create policy plataforma_ajustes_lee on public.plataforma_ajustes for select to authenticated using (true);
drop policy if exists plataforma_ajustes_admin on public.plataforma_ajustes;
create policy plataforma_ajustes_admin on public.plataforma_ajustes for update to authenticated
  using (public.es_superadmin_plataforma()) with check (public.es_superadmin_plataforma());
grant select, update on public.plataforma_ajustes to authenticated;

-- -----------------------------------------------------------------------------
-- Estado y plan de cada agencia (solo los toca la plataforma)
-- -----------------------------------------------------------------------------
alter table public.agencias add column if not exists plan_id uuid references public.planes(id) on delete set null;
alter table public.agencias add column if not exists estado text not null default 'activa' check (estado in ('activa', 'prueba', 'suspendida'));
alter table public.agencias add column if not exists prueba_hasta date;
alter table public.agencias add column if not exists motivo_suspension text not null default '' check (length(motivo_suspension) <= 300);
create table if not exists public.agencia_notas_plataforma (
  agencia_id uuid primary key references public.agencias(id) on delete cascade,
  notas      text not null default '' check (length(notas) <= 2000),
  actualizado timestamptz not null default now()
);
alter table public.agencia_notas_plataforma enable row level security;
revoke all on public.agencia_notas_plataforma from anon, authenticated;
grant all on public.agencia_notas_plataforma to service_role;

create or replace function public.agencias_protege_plataforma()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.plan_id is distinct from old.plan_id or new.estado is distinct from old.estado
      or new.prueba_hasta is distinct from old.prueba_hasta or new.motivo_suspension is distinct from old.motivo_suspension)
     and auth.uid() is not null and not public.es_admin_plataforma() then
    raise exception 'El plan y el estado de la agencia los gestiona la plataforma.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
drop trigger if exists agencias_protege_plataforma on public.agencias;
create trigger agencias_protege_plataforma before update on public.agencias
  for each row execute function public.agencias_protege_plataforma();

-- ¿La agencia está operativa? (prueba vencida = como suspendida)
create or replace function public.agencia_operativa(p_agencia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agencias a where a.id = p_agencia
                 and (a.estado = 'activa' or (a.estado = 'prueba' and (a.prueba_hasta is null or a.prueba_hasta >= current_date))));
$$;
revoke all on function public.agencia_operativa(uuid) from public, anon;
grant execute on function public.agencia_operativa(uuid) to authenticated, service_role;

-- Acceso a subcuentas: además, la agencia tiene que estar operativa.
create or replace function public.puedo_ver_subcuenta(p_subcuenta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (exists (
    select 1 from public.subcuentas s
    join public.agencia_miembros am on am.agencia_id = s.agencia_id
    where s.id = p_subcuenta and am.usuario_id = auth.uid() and am.rol in ('propietario', 'admin')
  ) or exists (
    select 1 from public.subcuenta_miembros sm
    join public.subcuentas s on s.id = sm.subcuenta_id
    where sm.subcuenta_id = p_subcuenta and sm.usuario_id = auth.uid() and s.estado = 'activa'
  )) and public.agencia_operativa((select agencia_id from public.subcuentas where id = p_subcuenta));
$$;

create or replace function public.soy_admin_subcuenta(p_subcuenta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (exists (
    select 1 from public.subcuentas s
    join public.agencia_miembros am on am.agencia_id = s.agencia_id
    where s.id = p_subcuenta and am.usuario_id = auth.uid() and am.rol in ('propietario', 'admin')
  ) or exists (
    select 1 from public.subcuenta_miembros sm
    join public.subcuentas s on s.id = sm.subcuenta_id
    where sm.subcuenta_id = p_subcuenta and sm.usuario_id = auth.uid()
      and sm.rol = 'admin' and s.estado = 'activa'
  )) and public.agencia_operativa((select agencia_id from public.subcuentas where id = p_subcuenta));
$$;

-- Lo público (reservas, chat web, facturas, API) tampoco funciona con la agencia suspendida.
create or replace function public.subcuenta_operativa(p_subcuenta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subcuentas s where s.id = p_subcuenta and s.estado = 'activa')
     and public.agencia_operativa((select agencia_id from public.subcuentas where id = p_subcuenta));
$$;
revoke all on function public.subcuenta_operativa(uuid) from public, anon;
grant execute on function public.subcuenta_operativa(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Límites del plan
-- -----------------------------------------------------------------------------
create or replace function public.limite_subcuentas()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int;
begin
  select p.max_subcuentas into v_max from public.agencias a left join public.planes p on p.id = a.plan_id where a.id = new.agencia_id;
  perform pg_advisory_xact_lock(hashtext('subcuentas:' || new.agencia_id::text));
  if v_max is not null and (select count(*) from public.subcuentas where agencia_id = new.agencia_id) >= v_max then
    raise exception 'Tu plan permite % subcuenta(s). Mejora el plan para crear más.', v_max using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists subcuentas_limite_plan on public.subcuentas;
create trigger subcuentas_limite_plan before insert on public.subcuentas
  for each row execute function public.limite_subcuentas();

create or replace function public.usuarios_de_agencia_total(p_agencia uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct u)::int from (
    select usuario_id u from public.agencia_miembros where agencia_id = p_agencia
    union select sm.usuario_id from public.subcuenta_miembros sm join public.subcuentas s on s.id = sm.subcuenta_id where s.agencia_id = p_agencia
  ) x;
$$;

create or replace function public.limite_usuarios()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agencia uuid; v_max int;
begin
  if tg_table_name = 'agencia_miembros' then
    v_agencia := (to_jsonb(new) ->> 'agencia_id')::uuid;
  else
    select agencia_id into v_agencia from public.subcuentas where id = (to_jsonb(new) ->> 'subcuenta_id')::uuid;
  end if;
  select p.max_usuarios into v_max from public.agencias a left join public.planes p on p.id = a.plan_id where a.id = v_agencia;
  if v_max is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('usuarios:' || v_agencia::text));
  -- Alguien que ya está en la agencia no cuenta dos veces.
  if exists (select 1 from public.agencia_miembros where agencia_id = v_agencia and usuario_id = new.usuario_id)
     or exists (select 1 from public.subcuenta_miembros sm join public.subcuentas s on s.id = sm.subcuenta_id
                where s.agencia_id = v_agencia and sm.usuario_id = new.usuario_id) then
    return new;
  end if;
  if public.usuarios_de_agencia_total(v_agencia) >= v_max then
    raise exception 'Tu plan permite % usuario(s). Mejora el plan para añadir más.', v_max using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists agencia_miembros_limite_plan on public.agencia_miembros;
create trigger agencia_miembros_limite_plan before insert on public.agencia_miembros
  for each row execute function public.limite_usuarios();
drop trigger if exists subcuenta_miembros_limite_plan on public.subcuenta_miembros;
create trigger subcuenta_miembros_limite_plan before insert on public.subcuenta_miembros
  for each row execute function public.limite_usuarios();

-- -----------------------------------------------------------------------------
-- Alta de agencias
-- -----------------------------------------------------------------------------
-- Autoservicio: solo si la plataforma tiene el registro abierto (o eres admin).
create or replace function public.crear_agencia(p_nombre text, p_moneda text default 'EUR',
                                                p_zona_horaria text default 'Europe/Madrid')
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; a public.plataforma_ajustes;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;
  select * into a from public.plataforma_ajustes where id;
  if not coalesce(a.registro_abierto, false) and not public.es_admin_plataforma() then
    raise exception 'El alta de agencias está cerrada. Pide acceso a %.', coalesce(a.nombre, 'la plataforma') using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.agencias where creado_por = auth.uid()) >= 3 and not public.es_admin_plataforma() then
    raise exception 'Ya has creado varias agencias con esta cuenta.' using errcode = 'check_violation';
  end if;
  insert into public.banderas_internas values (txid_current(), 'creando_agencia') on conflict do nothing;
  insert into public.agencias (nombre, moneda, zona_horaria, creado_por, plan_id, estado, prueba_hasta)
  values (trim(p_nombre), upper(coalesce(nullif(trim(p_moneda), ''), 'EUR')),
          coalesce(nullif(trim(p_zona_horaria), ''), 'Europe/Madrid'), auth.uid(),
          a.plan_defecto, case when coalesce(a.dias_prueba, 0) > 0 then 'prueba' else 'activa' end,
          case when coalesce(a.dias_prueba, 0) > 0 then current_date + a.dias_prueba end)
  returning id into v_id;
  insert into public.agencia_miembros (agencia_id, usuario_id, rol) values (v_id, auth.uid(), 'propietario');
  delete from public.banderas_internas where txid = txid_current() and nombre = 'creando_agencia';
  return v_id;
end $$;

-- Desde el panel de la plataforma: agencia para un usuario (ya creado o invitado).
create or replace function public.plataforma_crear_agencia(p_nombre text, p_dueno uuid, p_plan uuid,
                                                           p_dias_prueba int default 0, p_moneda text default 'EUR',
                                                           p_zona text default 'Europe/Madrid')
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo la plataforma puede dar de alta agencias así.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from auth.users where id = p_dueno) then
    raise exception 'El dueño no existe.' using errcode = 'no_data_found';
  end if;
  if p_plan is not null and not exists (select 1 from public.planes where id = p_plan) then
    raise exception 'Plan no válido.' using errcode = 'no_data_found';
  end if;
  insert into public.banderas_internas values (txid_current(), 'creando_agencia') on conflict do nothing;
  insert into public.agencias (nombre, moneda, zona_horaria, creado_por, plan_id, estado, prueba_hasta)
  values (trim(p_nombre), upper(coalesce(nullif(trim(p_moneda), ''), 'EUR')), coalesce(nullif(trim(p_zona), ''), 'Europe/Madrid'),
          p_dueno, p_plan, case when coalesce(p_dias_prueba, 0) > 0 then 'prueba' else 'activa' end,
          case when coalesce(p_dias_prueba, 0) > 0 then current_date + least(p_dias_prueba, 365) end)
  returning id into v_id;
  insert into public.agencia_miembros (agencia_id, usuario_id, rol) values (v_id, p_dueno, 'propietario');
  delete from public.banderas_internas where txid = txid_current() and nombre = 'creando_agencia';
  return v_id;
end $$;
revoke all on function public.plataforma_crear_agencia(text, uuid, uuid, int, text, text) from public, anon;
grant execute on function public.plataforma_crear_agencia(text, uuid, uuid, int, text, text) to authenticated;

create or replace function public.plataforma_usuario_por_email(p_email text)
returns uuid language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo la plataforma.' using errcode = 'insufficient_privilege';
  end if;
  return (select id from auth.users where lower(email) = lower(trim(p_email)));
end $$;
revoke all on function public.plataforma_usuario_por_email(text) from public, anon;
grant execute on function public.plataforma_usuario_por_email(text) to authenticated;

-- Listado y resumen para el panel de la plataforma.
create or replace function public.plataforma_agencias()
returns table (id uuid, nombre text, estado text, prueba_hasta date, plan_id uuid, plan text, precio numeric, moneda text,
               subcuentas bigint, usuarios int, dueno_email text, creado timestamptz, ultimo_acceso timestamptz, notas text, motivo text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo la plataforma.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.nombre, a.estado, a.prueba_hasta, a.plan_id, p.nombre, p.precio_mensual, coalesce(p.moneda, 'EUR'),
         (select count(*) from public.subcuentas s where s.agencia_id = a.id),
         public.usuarios_de_agencia_total(a.id),
         (select u.email::text from public.agencia_miembros am join auth.users u on u.id = am.usuario_id
          where am.agencia_id = a.id and am.rol = 'propietario' order by am.creado limit 1),
         a.creado,
         (select max(s.ultimo_acceso) from public.subcuentas s where s.agencia_id = a.id),
         coalesce((select n.notas from public.agencia_notas_plataforma n where n.agencia_id = a.id), ''), a.motivo_suspension
  from public.agencias a left join public.planes p on p.id = a.plan_id
  order by a.creado desc;
end $$;
revoke all on function public.plataforma_agencias() from public, anon;
grant execute on function public.plataforma_agencias() to authenticated;

create or replace function public.plataforma_resumen()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo la plataforma.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'agencias', (select count(*) from public.agencias),
    'activas', (select count(*) from public.agencias a where public.agencia_operativa(a.id)),
    'en_prueba', (select count(*) from public.agencias where estado = 'prueba'),
    'suspendidas', (select count(*) from public.agencias a where not public.agencia_operativa(a.id)),
    'subcuentas', (select count(*) from public.subcuentas),
    'contactos', (select count(*) from public.crm_contactos),
    'mrr', (select coalesce(sum(p.precio_mensual), 0) from public.agencias a join public.planes p on p.id = a.plan_id where a.estado = 'activa'),
    'nuevas_30d', (select count(*) from public.agencias where creado > now() - interval '30 days'));
end $$;
revoke all on function public.plataforma_resumen() from public, anon;
grant execute on function public.plataforma_resumen() to authenticated;

-- Cambiar plan / estado / prueba / notas de una agencia.
create or replace function public.plataforma_actualizar_agencia(p_agencia uuid, p_plan uuid, p_estado text,
                                                                p_prueba_hasta date, p_motivo text, p_notas text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'Solo la plataforma.' using errcode = 'insufficient_privilege';
  end if;
  update public.agencias set plan_id = p_plan, estado = p_estado, prueba_hasta = p_prueba_hasta,
         motivo_suspension = left(coalesce(p_motivo, ''), 300)
  where id = p_agencia;
  if not found then raise exception 'La agencia no existe.' using errcode = 'no_data_found'; end if;
  insert into public.agencia_notas_plataforma (agencia_id, notas) values (p_agencia, left(coalesce(p_notas, ''), 2000))
  on conflict (agencia_id) do update set notas = excluded.notas, actualizado = now();
end $$;
revoke all on function public.plataforma_actualizar_agencia(uuid, uuid, text, date, text, text) from public, anon;
grant execute on function public.plataforma_actualizar_agencia(uuid, uuid, text, date, text, text) to authenticated;

-- Para la agencia: su plan, su estado y su uso.
create or replace function public.mi_plan(p_agencia uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.agencias; p public.planes;
begin
  if not public.es_miembro_agencia(p_agencia) then
    raise exception 'No perteneces a esta agencia.' using errcode = 'insufficient_privilege';
  end if;
  select * into a from public.agencias where id = p_agencia;
  select * into p from public.planes where id = a.plan_id;
  return jsonb_build_object('estado', a.estado, 'prueba_hasta', a.prueba_hasta, 'motivo', a.motivo_suspension,
    'operativa', public.agencia_operativa(p_agencia),
    'plan', case when p.id is null then null else jsonb_build_object('nombre', p.nombre, 'precio', p.precio_mensual, 'moneda', p.moneda,
      'max_subcuentas', p.max_subcuentas, 'max_usuarios', p.max_usuarios, 'funciones', p.funciones, 'descripcion', p.descripcion) end,
    'subcuentas', (select count(*) from public.subcuentas where agencia_id = p_agencia),
    'usuarios', public.usuarios_de_agencia_total(p_agencia),
    'plataforma', (select nombre from public.plataforma_ajustes where id));
end $$;
revoke all on function public.mi_plan(uuid) from public, anon;
grant execute on function public.mi_plan(uuid) to authenticated;

-- Las agencias que ya existían pasan al plan por defecto (sin cambiar su estado).
update public.agencias set plan_id = (select plan_defecto from public.plataforma_ajustes where id) where plan_id is null;

-- El chat web público tampoco responde si la agencia está suspendida.
create or replace function public.chat_widget_activo(p_clave text)
returns public.chat_widgets language sql stable security definer set search_path = public as $$
  select w.* from public.chat_widgets w
  where w.clave = p_clave and w.activo and public.subcuenta_operativa(w.subcuenta_id);
$$;
revoke all on function public.chat_widget_activo(text) from public, anon, authenticated;

create or replace function public.plataforma_admins_lista()
returns table (usuario_id uuid, email text, rol text, creado timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.es_admin_plataforma() then raise exception 'Solo la plataforma.' using errcode = 'insufficient_privilege'; end if;
  return query select a.usuario_id, u.email::text, a.rol, a.creado from public.plataforma_admins a join auth.users u on u.id = a.usuario_id order by a.creado;
end $$;
revoke all on function public.plataforma_admins_lista() from public, anon;
grant execute on function public.plataforma_admins_lista() to authenticated;

create or replace function public.plataforma_baja_admin(p_usuario uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.es_superadmin_plataforma() then raise exception 'Solo un superadministrador.' using errcode = 'insufficient_privilege'; end if;
  if p_usuario = auth.uid() then raise exception 'No puedes quitarte a ti mismo.' using errcode = 'check_violation'; end if;
  if (select count(*) from public.plataforma_admins where rol = 'superadmin' and usuario_id <> p_usuario) = 0 then
    raise exception 'Tiene que quedar al menos un superadministrador.' using errcode = 'check_violation';
  end if;
  delete from public.plataforma_admins where usuario_id = p_usuario;
end $$;
revoke all on function public.plataforma_baja_admin(uuid) from public, anon;
grant execute on function public.plataforma_baja_admin(uuid) to authenticated;

-- Para explicar por qué no se puede entrar: solo a quien es miembro.
create or replace function public.bloqueo_subcuenta(p_subcuenta uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ag uuid; a public.agencias;
begin
  select agencia_id into v_ag from public.subcuentas where id = p_subcuenta;
  if v_ag is null or public.agencia_operativa(v_ag) then return null; end if;
  if not exists (select 1 from public.agencia_miembros where agencia_id = v_ag and usuario_id = auth.uid())
     and not exists (select 1 from public.subcuenta_miembros where subcuenta_id = p_subcuenta and usuario_id = auth.uid()) then
    return null;
  end if;
  select * into a from public.agencias where id = v_ag;
  return jsonb_build_object('estado', a.estado, 'prueba_hasta', a.prueba_hasta, 'motivo', a.motivo_suspension,
    'agencia', a.nombre, 'soy_agencia', exists (select 1 from public.agencia_miembros where agencia_id = v_ag and usuario_id = auth.uid()),
    'plataforma', (select nombre from public.plataforma_ajustes where id));
end $$;
revoke all on function public.bloqueo_subcuenta(uuid) from public, anon;
grant execute on function public.bloqueo_subcuenta(uuid) to authenticated;

-- Reservas públicas: además de la subcuenta activa, la agencia operativa.
-- (Se reescriben las funciones existentes cambiando solo esa condición.)
do $do$
declare f text; d text;
begin
  foreach f in array array['public.cal_publico(text)', 'public.cal_huecos(text,date,date)',
                           'public.cal_reservar(text,timestamptz,text,text,text,text,text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    d := replace(d, 'and s.estado = ''activa''', 'and public.subcuenta_operativa(s.id)');
    d := replace(d, 'and ss.estado = ''activa''', 'and public.subcuenta_operativa(ss.id)');
    execute d;
  end loop;
end $do$;

-- API: la agencia operativa y con la API incluida en su plan.
create or replace function public.api_subcuenta_permitida(p_subcuenta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.subcuenta_operativa(p_subcuenta) and coalesce((
    select (p.funciones ->> 'api')::boolean from public.subcuentas s join public.agencias a on a.id = s.agencia_id
    left join public.planes p on p.id = a.plan_id where s.id = p_subcuenta), true);
$$;
revoke all on function public.api_subcuenta_permitida(uuid) from public, anon, authenticated;
grant execute on function public.api_subcuenta_permitida(uuid) to service_role;

-- ¿Incluye el plan de la agencia esta función? (sin plan = todo incluido)
create or replace function public.plan_incluye(p_agencia uuid, p_funcion text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (p.funciones ->> p_funcion)::boolean from public.agencias a join public.planes p on p.id = a.plan_id where a.id = p_agencia), true);
$$;
revoke all on function public.plan_incluye(uuid, text) from public, anon;
grant execute on function public.plan_incluye(uuid, text) to authenticated, service_role;
