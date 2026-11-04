-- =============================================================================
-- 21 · BIBLIOTECA DE MEDIOS
-- Archivos de cada subcuenta (imágenes, PDF, vídeos…) en Supabase Storage,
-- bucket «medios», ruta <subcuenta_id>/<uuid>.<ext>. El navegador sube el
-- archivo directamente a Storage (las políticas comprueban acceso y cupo) y
-- después se registra aquí con su tamaño REAL, leído de Storage.
-- Requiere el 20. Se puede volver a ejecutar.
-- =============================================================================

-- Cupo por subcuenta (bytes) y límites del bucket.
create or replace function public.medios_cupo() returns bigint language sql immutable as $$ select 5368709120::bigint $$; -- 5 GB

do $do$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('medios', 'medios', true, 26214400, array[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
      'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4',
      'text/plain', 'text/csv', 'application/zip',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $do$;

create table if not exists public.medios (
  id            uuid primary key default gen_random_uuid(),
  subcuenta_id  uuid not null references public.subcuentas(id) on delete cascade,
  ruta          text not null unique,
  nombre        text not null check (length(trim(nombre)) between 1 and 200),
  carpeta       text not null default '' check (length(carpeta) <= 60 and carpeta !~ '[/\\<>]'),
  tipo          text not null default '',
  tamano        bigint not null default 0 check (tamano >= 0),
  subido_por    uuid references auth.users(id) on delete set null,
  creado        timestamptz not null default now(),
  check (split_part(ruta, '/', 1) = subcuenta_id::text)
);
create index if not exists medios_sub_idx on public.medios(subcuenta_id, carpeta, creado desc);

alter table public.medios enable row level security;
revoke all on public.medios from anon, authenticated;
grant all on public.medios to service_role;
drop policy if exists medios_lee on public.medios;
create policy medios_lee on public.medios for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists medios_cambia on public.medios;
create policy medios_cambia on public.medios for update to authenticated
  using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id));
drop policy if exists medios_borra on public.medios;
create policy medios_borra on public.medios for delete to authenticated using (public.puedo_ver_subcuenta(subcuenta_id));
grant select, delete on public.medios to authenticated;
grant update (nombre, carpeta) on public.medios to authenticated;

-- Subcuenta de una ruta de Storage («<uuid>/…»); null si no es válida.
create or replace function public.medios_subcuenta_de(p_ruta text)
returns uuid language sql immutable as $$
  select case when split_part(p_ruta, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and p_ruta ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,8}$'
         then split_part(p_ruta, '/', 1)::uuid end;
$$;

-- Bytes usados por una subcuenta (lo que hay de verdad en Storage).
create or replace function public.medios_usado(p_subcuenta uuid)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare v bigint := 0;
begin
  if to_regclass('storage.objects') is not null then
    execute $q$select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects
               where bucket_id = 'medios' and name like $1 || '/%'$q$ into v using p_subcuenta::text;
  end if;
  return v;
end $$;
revoke all on function public.medios_usado(uuid) from public, anon;
grant execute on function public.medios_usado(uuid) to authenticated, service_role;

-- ¿Puede subir aquí? (lo usa la política de Storage)
create or replace function public.medios_puede_subir(p_ruta text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_sub uuid := public.medios_subcuenta_de(p_ruta);
begin
  return v_sub is not null and public.puedo_ver_subcuenta(v_sub) and public.medios_usado(v_sub) < public.medios_cupo();
end $$;
revoke all on function public.medios_puede_subir(text) from public, anon;
grant execute on function public.medios_puede_subir(text) to authenticated;

do $do$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute $p$drop policy if exists medios_lee on storage.objects$p$;
    execute $p$create policy medios_lee on storage.objects for select to anon, authenticated using (bucket_id = 'medios')$p$;
    execute $p$drop policy if exists medios_sube on storage.objects$p$;
    execute $p$create policy medios_sube on storage.objects for insert to authenticated
      with check (bucket_id = 'medios' and public.medios_puede_subir(name))$p$;
    execute $p$drop policy if exists medios_borra on storage.objects$p$;
    execute $p$create policy medios_borra on storage.objects for delete to authenticated
      using (bucket_id = 'medios' and public.puedo_ver_subcuenta(public.medios_subcuenta_de(name)))$p$;
  end if;
end $do$;

-- Registra un archivo ya subido: el tamaño y el tipo salen de Storage, no del navegador.
create or replace function public.medios_registrar(p_ruta text, p_nombre text, p_carpeta text default '')
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_sub uuid := public.medios_subcuenta_de(p_ruta);
  v_tamano bigint;
  v_tipo text;
  v_id uuid;
begin
  if v_sub is null or not public.puedo_ver_subcuenta(v_sub) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  if to_regclass('storage.objects') is null then
    raise exception 'Storage no está disponible.' using errcode = 'feature_not_supported';
  end if;
  execute $q$select (metadata ->> 'size')::bigint, coalesce(metadata ->> 'mimetype', '') from storage.objects
             where bucket_id = 'medios' and name = $1$q$ into v_tamano, v_tipo using p_ruta;
  if v_tamano is null then
    raise exception 'El archivo no se ha subido.' using errcode = 'no_data_found';
  end if;
  insert into public.medios (subcuenta_id, ruta, nombre, carpeta, tipo, tamano, subido_por)
  values (v_sub, p_ruta, left(trim(coalesce(nullif(trim(p_nombre), ''), 'archivo')), 200), left(trim(coalesce(p_carpeta, '')), 60), v_tipo, v_tamano, auth.uid())
  on conflict (ruta) do nothing
  returning id into v_id;
  if v_id is null then raise exception 'Ese archivo ya estaba registrado.' using errcode = 'unique_violation'; end if;
  return v_id;
end $$;
revoke all on function public.medios_registrar(text, text, text) from public, anon;
grant execute on function public.medios_registrar(text, text, text) to authenticated;

-- Uso por subcuenta para la pantalla de agencia «Uso de contenido multimedia».
create or replace function public.uso_medios_agencia(p_agencia uuid)
returns table (subcuenta_id uuid, nombre text, direccion text, archivos bigint, bytes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_admin_agencia(p_agencia) then
    raise exception 'Solo un administrador de la agencia puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select s.id, s.nombre, concat_ws(', ', nullif(s.direccion, ''), nullif(s.ciudad, '')),
         (select count(*) from public.medios m where m.subcuenta_id = s.id), public.medios_usado(s.id)
  from public.subcuentas s where s.agencia_id = p_agencia order by s.nombre;
end $$;
revoke all on function public.uso_medios_agencia(uuid) from public, anon;
grant execute on function public.uso_medios_agencia(uuid) to authenticated;

-- Archivos subidos que nunca se registraron (pestaña cerrada a mitad, etc.):
-- la tarea programada los borra de Storage pasada una hora.
create or replace function public.medios_huerfanos(p_limite int default 200)
returns setof text language plpgsql stable security definer set search_path = public as $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  return query execute $q$
    select o.name::text from storage.objects o
    where o.bucket_id = 'medios' and o.created_at < now() - interval '1 hour'
      and not exists (select 1 from public.medios m where m.ruta = o.name)
    limit $1$q$ using least(greatest(p_limite, 1), 1000);
end $$;
revoke all on function public.medios_huerfanos(int) from public, anon, authenticated;
grant execute on function public.medios_huerfanos(int) to service_role;
