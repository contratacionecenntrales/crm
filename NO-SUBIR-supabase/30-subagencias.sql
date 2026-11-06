-- =============================================================================
-- 30 · SUBAGENCIAS (reventa)
-- Una agencia puede crear agencias propias («subagencias»): cada una es una
-- agencia completa, con su dueño, sus subcuentas, su marca y sus clientes. La
-- agencia madre las ve, puede suspenderlas, limitar sus subcuentas y (si lo
-- elige al crearlas) conservar acceso de soporte. Hasta 3 niveles.
-- Requiere el 29. Re-ejecutable.
-- =============================================================================

alter table public.agencias add column if not exists agencia_padre_id uuid references public.agencias(id) on delete set null;
alter table public.agencias add column if not exists suspendida_por_padre boolean not null default false;
alter table public.agencias add column if not exists limite_subcuentas_padre int;
alter table public.agencias drop constraint if exists agencias_limite_padre_check;
alter table public.agencias add constraint agencias_limite_padre_check check (limite_subcuentas_padre is null or limite_subcuentas_padre between 0 and 1000);
alter table public.agencias drop constraint if exists agencias_no_es_su_padre;
alter table public.agencias add constraint agencias_no_es_su_padre check (agencia_padre_id is distinct from id);
create index if not exists agencias_padre_idx on public.agencias(agencia_padre_id) where agencia_padre_id is not null;

-- Nivel de una agencia en la cadena (1 = sin madre).
create or replace function public.agencia_nivel(p_agencia uuid)
returns int language sql stable security definer set search_path = public as $$
  with recursive c(id, padre, n) as (
    select id, agencia_padre_id, 1 from public.agencias where id = p_agencia
    union all select a.id, a.agencia_padre_id, c.n + 1 from public.agencias a join c on a.id = c.padre where c.n < 10)
  select coalesce(max(n), 0) from c;
$$;
revoke all on function public.agencia_nivel(uuid) from public, anon;
grant execute on function public.agencia_nivel(uuid) to authenticated, service_role;

-- Operativa = su estado lo permite, su madre no la ha suspendido y su madre
-- (si tiene) también está operativa.
create or replace function public.agencia_operativa(p_agencia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive c(id, padre, ok, n) as (
    select a.id, a.agencia_padre_id,
           (a.estado = 'activa' or (a.estado = 'prueba' and (a.prueba_hasta is null or a.prueba_hasta >= current_date))) and not a.suspendida_por_padre, 1
    from public.agencias a where a.id = p_agencia
    union all
    select a.id, a.agencia_padre_id,
           (a.estado = 'activa' or (a.estado = 'prueba' and (a.prueba_hasta is null or a.prueba_hasta >= current_date))) and not a.suspendida_por_padre, c.n + 1
    from public.agencias a join c on a.id = c.padre where c.n < 10)
  select exists (select 1 from c) and bool_and(ok) from c;
$$;
revoke all on function public.agencia_operativa(uuid) from public, anon;
grant execute on function public.agencia_operativa(uuid) to authenticated, service_role;

-- Campos que solo cambia la plataforma (plan, estado…) o la agencia madre
-- (suspensión y límite de su subagencia). La cadena de madres solo la plataforma.
create or replace function public.agencias_protege_plataforma()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.es_admin_plataforma() then return new; end if;
  if new.plan_id is distinct from old.plan_id or new.estado is distinct from old.estado
     or new.prueba_hasta is distinct from old.prueba_hasta or new.motivo_suspension is distinct from old.motivo_suspension
     or new.creado_por is distinct from old.creado_por or new.agencia_padre_id is distinct from old.agencia_padre_id then
    raise exception 'El plan y el estado de la agencia los gestiona la plataforma.' using errcode = 'insufficient_privilege';
  end if;
  if (new.suspendida_por_padre is distinct from old.suspendida_por_padre or new.limite_subcuentas_padre is distinct from old.limite_subcuentas_padre)
     and (old.agencia_padre_id is null or not public.soy_admin_agencia(old.agencia_padre_id)) then
    raise exception 'Solo la agencia madre puede suspender o limitar esta agencia.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

-- Límite de subcuentas que fija la agencia madre.
create or replace function public.subagencia_limite_subcuentas()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limite int;
begin
  select limite_subcuentas_padre into v_limite from public.agencias where id = new.agencia_id;
  if v_limite is not null and (select count(*) from public.subcuentas where agencia_id = new.agencia_id) >= v_limite then
    raise exception 'Tu agencia ha llegado al máximo de % subcuentas acordado con tu proveedor.', v_limite using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists subcuentas_limite_padre on public.subcuentas;
create trigger subcuentas_limite_padre before insert on public.subcuentas for each row execute function public.subagencia_limite_subcuentas();

-- El alta como subagencia no cuenta en el límite de 3 agencias por cuenta.
create or replace function public.agencias_registra_alta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.bandera_activa('creando_subagencia') then return new; end if;
  if new.creado_por is not null and auth.uid() = new.creado_por and not public.es_admin_plataforma() then
    if (select count(*) from public.agencias_altas where usuario_id = new.creado_por) >= 3 then
      raise exception 'Ya has creado varias agencias con esta cuenta.' using errcode = 'check_violation';
    end if;
  end if;
  if new.creado_por is not null then
    insert into public.agencias_altas (usuario_id, agencia_id) values (new.creado_por, new.id);
  end if;
  return new;
end $$;

-- Crea una subagencia. p_dueno: usuario que será su propietario (ya creado o
-- invitado). p_soporte: quien la crea queda como administrador para ayudar.
create or replace function public.agencia_crear_subagencia(p_padre uuid, p_nombre text, p_dueno uuid, p_moneda text default 'EUR',
                                                           p_zona text default 'Europe/Madrid', p_soporte boolean default true)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare p public.agencias; v_id uuid;
begin
  select * into p from public.agencias where id = p_padre;
  if p.id is null or not public.soy_admin_agencia(p_padre) then
    raise exception 'Solo un administrador de la agencia puede crear subagencias.' using errcode = 'insufficient_privilege';
  end if;
  if not public.agencia_operativa(p_padre) then raise exception 'Tu agencia no está activa.' using errcode = 'insufficient_privilege'; end if;
  if not public.plan_incluye(p_padre, 'subagencias') then raise exception 'Tu plan no incluye subagencias.' using errcode = 'check_violation'; end if;
  if public.agencia_nivel(p_padre) >= 3 then raise exception 'Como mucho 3 niveles de agencias.' using errcode = 'check_violation'; end if;
  if length(trim(coalesce(p_nombre, ''))) not between 2 and 120 then raise exception 'Nombre no válido.' using errcode = 'check_violation'; end if;
  if p_dueno is null or not exists (select 1 from auth.users where id = p_dueno) then raise exception 'No se encontró al dueño.' using errcode = 'no_data_found'; end if;
  perform pg_advisory_xact_lock(hashtext('subagencias:' || p_padre::text));
  if (select count(*) from public.agencias where agencia_padre_id = p_padre) >= 50 then
    raise exception 'Como mucho 50 subagencias por agencia.' using errcode = 'check_violation';
  end if;
  insert into public.banderas_internas values (txid_current(), 'creando_agencia') on conflict do nothing;
  insert into public.banderas_internas values (txid_current(), 'creando_subagencia') on conflict do nothing;
  insert into public.agencias (nombre, moneda, zona_horaria, creado_por, plan_id, estado, agencia_padre_id)
  values (trim(p_nombre), upper(coalesce(nullif(trim(p_moneda), ''), 'EUR')), coalesce(nullif(trim(p_zona), ''), 'Europe/Madrid'),
          null, p.plan_id, 'activa', p_padre) -- sin «creado por»: no cuenta en el límite de agencias propias
  returning id into v_id;
  insert into public.agencia_miembros (agencia_id, usuario_id, rol) values (v_id, p_dueno, 'propietario');
  if p_soporte and auth.uid() is not null and auth.uid() <> p_dueno then
    insert into public.agencia_miembros (agencia_id, usuario_id, rol) values (v_id, auth.uid(), 'admin') on conflict do nothing;
  end if;
  delete from public.banderas_internas where txid = txid_current() and nombre in ('creando_agencia', 'creando_subagencia');
  return v_id;
end $$;
revoke all on function public.agencia_crear_subagencia(uuid, text, uuid, text, text, boolean) from public, anon;
grant execute on function public.agencia_crear_subagencia(uuid, text, uuid, text, text, boolean) to authenticated;

-- Lista de subagencias para la agencia madre.
create or replace function public.agencia_subagencias(p_padre uuid)
returns table (id uuid, nombre text, suspendida boolean, operativa boolean, limite int, subcuentas int, usuarios int, nietas int, dueno_email text, creado timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.nombre, a.suspendida_por_padre, public.agencia_operativa(a.id), a.limite_subcuentas_padre,
         (select count(*)::int from public.subcuentas s where s.agencia_id = a.id),
         (select count(*)::int from public.agencia_miembros m where m.agencia_id = a.id),
         (select count(*)::int from public.agencias h where h.agencia_padre_id = a.id),
         (select u.email::text from public.agencia_miembros m join auth.users u on u.id = m.usuario_id where m.agencia_id = a.id and m.rol = 'propietario' order by m.creado limit 1),
         a.creado
  from public.agencias a
  where a.agencia_padre_id = p_padre and public.soy_admin_agencia(p_padre)
  order by a.creado desc;
$$;
revoke all on function public.agencia_subagencias(uuid) from public, anon;
grant execute on function public.agencia_subagencias(uuid) to authenticated;

-- Suspender / reactivar y limitar una subagencia (solo su madre).
create or replace function public.agencia_gestionar_subagencia(p_padre uuid, p_hija uuid, p_suspendida boolean, p_limite int)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.soy_admin_agencia(p_padre) then
    raise exception 'Solo un administrador de la agencia madre puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  if p_limite is not null and p_limite not between 0 and 1000 then raise exception 'Límite no válido.' using errcode = 'check_violation'; end if;
  update public.agencias set suspendida_por_padre = coalesce(p_suspendida, false), limite_subcuentas_padre = p_limite
  where id = p_hija and agencia_padre_id = p_padre;
  if not found then raise exception 'No es una subagencia tuya.' using errcode = 'no_data_found'; end if;
end $$;
revoke all on function public.agencia_gestionar_subagencia(uuid, uuid, boolean, int) from public, anon;
grant execute on function public.agencia_gestionar_subagencia(uuid, uuid, boolean, int) to authenticated;

-- Usuario por correo, para nombrar al dueño de una subagencia (solo
-- administradores de una agencia activa que pueda tener subagencias).
create or replace function public.agencia_usuario_por_email(p_agencia uuid, p_email text)
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_admin_agencia(p_agencia) or not public.agencia_operativa(p_agencia) or not public.plan_incluye(p_agencia, 'subagencias') then
    raise exception 'No autorizado.' using errcode = 'insufficient_privilege';
  end if;
  return (select id from auth.users where lower(email) = lower(trim(p_email)) limit 1);
end $$;
revoke all on function public.agencia_usuario_por_email(uuid, text) from public, anon;
grant execute on function public.agencia_usuario_por_email(uuid, text) to authenticated;
