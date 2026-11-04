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
