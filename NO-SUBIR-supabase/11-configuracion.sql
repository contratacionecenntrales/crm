-- =============================================================================
-- 11 · CONFIGURACIÓN DE AGENCIA Y SUBCUENTA
--   · Datos de empresa completos, marca blanca (logo, CSS, tema, dominios,
--     políticas) y tiempo de sesión de la agencia
--   · Anuncios de la agencia a sus subcuentas
--   · Etiquetas con descripción y categoría
-- Requiere 09 y 10. Idempotente.
-- =============================================================================

alter table public.agencias
  add column if not exists categoria             text not null default '',
  add column if not exists nicho                 text not null default '',
  add column if not exists uso_principal         text not null default '',
  add column if not exists direccion             text not null default '',
  add column if not exists ciudad                text not null default '',
  add column if not exists codigo_postal         text not null default '',
  add column if not exists provincia             text not null default '',
  add column if not exists pais                  text not null default 'ES',
  add column if not exists dominio_marca         text not null default '',
  add column if not exists dominio_api           text not null default '',
  add column if not exists url_privacidad        text not null default '',
  add column if not exists url_terminos          text not null default '',
  add column if not exists css_personalizado     text not null default '' check (length(css_personalizado) <= 20000),
  add column if not exists tema_defecto          text not null default 'claro' check (tema_defecto in ('claro', 'oscuro')),
  add column if not exists expiracion_sesion_min int check (expiracion_sesion_min is null or expiracion_sesion_min between 5 and 10080);

-- Lo que una subcuenta necesita de su agencia para pintarse con su marca.
-- Sustituye a la versión del guion 10 añadiendo los campos de marca.
create or replace function public.soporte_subcuenta(p_subcuenta uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'agencia', a.nombre, 'email', a.email, 'telefono', a.telefono, 'web', a.web, 'id', a.id,
    'logo_url', a.logo_url, 'css', a.css_personalizado, 'tema', a.tema_defecto,
    'expiracion', a.expiracion_sesion_min)
  from public.subcuentas s join public.agencias a on a.id = s.agencia_id
  where s.id = p_subcuenta and public.puedo_ver_subcuenta(p_subcuenta);
$$;

-- Logos de marca: depósito público de lectura; solo los admins de la agencia
-- escriben en su carpeta (<agencia_id>/…). Solo existe en Supabase real.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('marcas', 'marcas', true, 2621440, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    execute $p$drop policy if exists marcas_escribe on storage.objects$p$;
    execute $p$create policy marcas_escribe on storage.objects for insert to authenticated
      with check (bucket_id = 'marcas' and public.soy_admin_agencia(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$drop policy if exists marcas_actualiza on storage.objects$p$;
    execute $p$create policy marcas_actualiza on storage.objects for update to authenticated
      using (bucket_id = 'marcas' and public.soy_admin_agencia(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$drop policy if exists marcas_borra on storage.objects$p$;
    execute $p$create policy marcas_borra on storage.objects for delete to authenticated
      using (bucket_id = 'marcas' and public.soy_admin_agencia(((storage.foldername(name))[1])::uuid))$p$;
  end if;
end $$;

-- =============================================================================
-- USUARIOS DE LA AGENCIA (pantalla Configuración → Usuarios)
-- Todos: equipo de agencia y usuarios de cada subcuenta.
-- =============================================================================
create or replace function public.usuarios_de_agencia(p_agencia uuid)
returns table (usuario_id uuid, email text, nombre text, telefono text, tipo text, rol text,
               subcuenta_id uuid, subcuenta_nombre text, creado timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo los administradores de la agencia ven todos los usuarios.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select u.id, u.email::text,
           coalesce(u.raw_user_meta_data ->> 'nombre', u.raw_user_meta_data ->> 'full_name', '')::text,
           coalesce(u.raw_user_meta_data ->> 'telefono', '')::text,
           'agencia'::text, am.rol::text, null::uuid, null::text, am.creado
    from public.agencia_miembros am join auth.users u on u.id = am.usuario_id
    where am.agencia_id = p_agencia
    union all
    select u.id, u.email::text,
           coalesce(u.raw_user_meta_data ->> 'nombre', u.raw_user_meta_data ->> 'full_name', '')::text,
           coalesce(u.raw_user_meta_data ->> 'telefono', '')::text,
           'subcuenta'::text, sm.rol::text, s.id, s.nombre, sm.creado
    from public.subcuenta_miembros sm
    join public.subcuentas s on s.id = sm.subcuenta_id
    join auth.users u on u.id = sm.usuario_id
    where s.agencia_id = p_agencia
    order by 9;
end $$;
revoke all on function public.usuarios_de_agencia(uuid) from public, anon;
grant execute on function public.usuarios_de_agencia(uuid) to authenticated;

-- =============================================================================
-- ANUNCIOS DE LA AGENCIA A SUS SUBCUENTAS
-- =============================================================================
create table if not exists public.anuncios (
  id          uuid primary key default gen_random_uuid(),
  agencia_id  uuid not null references public.agencias(id) on delete cascade,
  titulo      text not null check (length(trim(titulo)) between 1 and 160),
  cuerpo      text not null default '' check (length(cuerpo) <= 2000),
  enlace      text not null default '' check (enlace = '' or enlace ~* '^https?://'),
  prioridad   text not null default 'general' check (prioridad in ('general', 'advertencia', 'critico')),
  frecuencia  text not null default 'una_vez' check (frecuencia in ('una_vez', 'a_diario', 'siempre')),
  activo      boolean not null default true,
  subcuentas  uuid[] not null default '{}', -- vacío = todas
  creado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists anuncios_agencia_idx on public.anuncios(agencia_id, creado desc);

create table if not exists public.anuncios_vistos (
  anuncio_id uuid not null references public.anuncios(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  visto      timestamptz not null default now(),
  primary key (anuncio_id, usuario_id)
);

drop trigger if exists anuncios_actualizado on public.anuncios;
create trigger anuncios_actualizado before update on public.anuncios
  for each row execute function public.toca_actualizado();

alter table public.anuncios enable row level security;
alter table public.anuncios_vistos enable row level security;
revoke all on public.anuncios, public.anuncios_vistos from anon;
grant select, insert, update, delete on public.anuncios to authenticated;
grant select, insert, update, delete on public.anuncios_vistos to authenticated;
grant all on public.anuncios, public.anuncios_vistos to service_role;

drop policy if exists anuncios_admin on public.anuncios;
create policy anuncios_admin on public.anuncios for all to authenticated
  using (public.soy_admin_agencia(agencia_id)) with check (public.soy_admin_agencia(agencia_id));
drop policy if exists anuncios_vistos_propios on public.anuncios_vistos;
create policy anuncios_vistos_propios on public.anuncios_vistos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Anuncios que tiene que ver ahora el usuario en una subcuenta, según su
-- frecuencia: «una vez» hasta que lo cierra, «a diario» uno por día,
-- «siempre» cada vez (el cierre solo lo oculta en esa visita).
create or replace function public.anuncios_pendientes(p_subcuenta uuid)
returns table (id uuid, titulo text, cuerpo text, enlace text, prioridad text, frecuencia text)
language sql stable security definer set search_path = public as $$
  select a.id, a.titulo, a.cuerpo, a.enlace, a.prioridad, a.frecuencia
  from public.anuncios a
  join public.subcuentas s on s.agencia_id = a.agencia_id
  left join public.anuncios_vistos v on v.anuncio_id = a.id and v.usuario_id = auth.uid()
  where s.id = p_subcuenta and public.puedo_ver_subcuenta(p_subcuenta)
    and a.activo and (cardinality(a.subcuentas) = 0 or p_subcuenta = any(a.subcuentas))
    and (a.frecuencia = 'siempre'
         or (a.frecuencia = 'una_vez' and v.anuncio_id is null)
         or (a.frecuencia = 'a_diario' and (v.visto is null or v.visto < now() - interval '1 day')))
  order by case a.prioridad when 'critico' then 0 when 'advertencia' then 1 else 2 end, a.creado desc
  limit 3;
$$;

create or replace function public.cerrar_anuncio(p_anuncio uuid)
returns void language sql security invoker set search_path = public as $$
  insert into public.anuncios_vistos (anuncio_id, usuario_id) values (p_anuncio, auth.uid())
  on conflict (anuncio_id, usuario_id) do update set visto = now();
$$;
revoke all on function public.anuncios_pendientes(uuid) from public, anon;
revoke all on function public.cerrar_anuncio(uuid) from public, anon;
grant execute on function public.anuncios_pendientes(uuid) to authenticated;
grant execute on function public.cerrar_anuncio(uuid) to authenticated;

-- =============================================================================
-- ETIQUETAS: descripción, categoría y renombrado
-- =============================================================================
alter table public.crm_etiquetas
  add column if not exists descripcion text not null default '' check (length(descripcion) <= 300),
  add column if not exists categoria   text not null default '' check (length(categoria) <= 60);

grant insert, update on public.crm_etiquetas to authenticated;
drop policy if exists crm_etiquetas_alta on public.crm_etiquetas;
create policy crm_etiquetas_alta on public.crm_etiquetas for insert to authenticated
  with check (public.soy_admin_subcuenta(subcuenta_id));
drop policy if exists crm_etiquetas_edita on public.crm_etiquetas;
create policy crm_etiquetas_edita on public.crm_etiquetas for update to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));

-- Renombra una etiqueta en el catálogo y en todos los contactos que la llevan.
create or replace function public.crm_renombrar_etiqueta(p_subcuenta uuid, p_antes text, p_despues text)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int; v_nueva text := left(regexp_replace(trim(p_despues), '\s+', ' ', 'g'), 60);
begin
  if not public.soy_admin_subcuenta(p_subcuenta) then
    raise exception 'Solo un administrador puede renombrar etiquetas.' using errcode = 'insufficient_privilege';
  end if;
  if v_nueva = '' then raise exception 'La etiqueta no puede quedar vacía.' using errcode = 'check_violation'; end if;
  if v_nueva = p_antes then return 0; end if;
  update public.crm_contactos
  set etiquetas = array_append(array_remove(etiquetas, p_antes), v_nueva)
  where subcuenta_id = p_subcuenta and p_antes = any(etiquetas);
  get diagnostics v_n = row_count;
  -- El catálogo: conserva descripción y categoría en la nueva.
  insert into public.crm_etiquetas (subcuenta_id, nombre, descripcion, categoria)
  select subcuenta_id, v_nueva, descripcion, categoria from public.crm_etiquetas
  where subcuenta_id = p_subcuenta and nombre = p_antes
  on conflict (subcuenta_id, nombre) do update set descripcion = excluded.descripcion, categoria = excluded.categoria;
  delete from public.crm_etiquetas where subcuenta_id = p_subcuenta and nombre = p_antes;
  return v_n;
end $$;

-- Borra una etiqueta del catálogo y de todos los contactos.
create or replace function public.crm_borrar_etiqueta(p_subcuenta uuid, p_nombre text)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.soy_admin_subcuenta(p_subcuenta) then
    raise exception 'Solo un administrador puede borrar etiquetas.' using errcode = 'insufficient_privilege';
  end if;
  update public.crm_contactos set etiquetas = array_remove(etiquetas, p_nombre)
  where subcuenta_id = p_subcuenta and p_nombre = any(etiquetas);
  get diagnostics v_n = row_count;
  delete from public.crm_etiquetas where subcuenta_id = p_subcuenta and nombre = p_nombre;
  return v_n;
end $$;
revoke all on function public.crm_renombrar_etiqueta(uuid, text, text) from public, anon;
revoke all on function public.crm_borrar_etiqueta(uuid, text) from public, anon;
grant execute on function public.crm_renombrar_etiqueta(uuid, text, text) to authenticated;
grant execute on function public.crm_borrar_etiqueta(uuid, text) to authenticated;
