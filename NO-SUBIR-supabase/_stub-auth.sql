-- =============================================================================
-- IMITACIÓN DE `auth` PARA PROBAR EL ESQUEMA EN UN POSTGRES NORMAL
--
-- Supabase trae un esquema `auth` con la tabla de usuarios y las funciones
-- auth.uid() / auth.role(). Un Postgres recién instalado no lo tiene, así que
-- esto lo imita lo justo para poder ejecutar los ficheros 01 a 05 y comprobar
-- que las políticas, los disparadores y las funciones hacen lo que dicen.
--
-- ESTO NO SE EJECUTA NUNCA EN SUPABASE. Solo sirve para las pruebas locales.
-- =============================================================================
-- Supabase deja pgcrypto en el esquema `extensions`, y ahi lo busca
-- 02-cuenta-raiz.sql (extensions.crypt, extensions.gen_salt). gen_random_uuid()
-- viene de serie en PostgreSQL 13 en adelante, asi que no hace falta en public.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;

-- Las mismas columnas que usa 02-cuenta-raiz.sql contra el auth.users real de
-- Supabase. Si aqui falta una, el guion falla en local y parece un fallo suyo
-- cuando en realidad lo es de esta imitacion.
create table if not exists auth.users (
  instance_id             uuid,
  id                      uuid primary key default gen_random_uuid(),
  aud                     text default 'authenticated',
  role                    text default 'authenticated',
  email                   text unique,
  encrypted_password      text,
  email_confirmed_at      timestamptz,
  raw_app_meta_data       jsonb,
  raw_user_meta_data      jsonb,
  confirmation_token      text default '',
  recovery_token          text default '',
  email_change            text default '',
  email_change_token_new  text default '',
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create table if not exists auth.identities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  provider_id     text,
  identity_data   jsonb,
  provider        text,
  last_sign_in_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);



-- Quién ha «iniciado sesión» en esta conexión. En Supabase esto sale del JWT.
create table if not exists auth._sesion (uid uuid);

-- SECURITY DEFINER, no solo el GRANT de esquema de abajo: en el Supabase real
-- auth.uid() no exige que "anon"/"authenticated" tengan acceso a ninguna
-- tabla (lee un ajuste de sesión, no una fila). Sin esto, entrar como esos
-- roles para probar RLS falla con "permission denied for table _sesion" antes
-- de llegar siquiera a la política que se quiere probar.
create or replace function auth.uid() returns uuid
language sql stable security definer set search_path = auth as $$ select uid from auth._sesion limit 1 $$;

create or replace function auth.role() returns text
language sql stable security definer set search_path = auth as $$
  select case when exists (select 1 from auth._sesion where uid is not null)
              then 'authenticated' else 'anon' end
$$;

-- Roles que Supabase crea de serie.
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;
-- auth.uid()/auth.role() viven en el esquema "auth": sin USAGE aquí, cualquier
-- política que los llame falla con "permission denied for schema auth" en
-- cuanto se prueba como anon/authenticated (no como el superusuario que carga
-- este guion). En Supabase real esto ya viene concedido; aquí hay que darlo.
grant usage on schema auth to anon, authenticated, service_role;
