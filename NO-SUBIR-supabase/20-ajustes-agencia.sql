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
