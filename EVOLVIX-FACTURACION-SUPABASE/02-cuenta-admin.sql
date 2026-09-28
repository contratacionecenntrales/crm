-- =============================================================================
-- EVOLVIX GLOBAL · Facturación de Grupo — Primera cuenta de administrador
-- Ejecutar DESPUÉS de 01-esquema.sql
--
-- ⚠ ANTES DE EJECUTAR: cambia v_email y v_clave por los que quieras usar de
--   verdad. La contraseña debe tener al menos 10 caracteres, con mayúscula,
--   minúscula, número y símbolo.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_id    uuid;
  v_email text := 'PON-AQUI-EL-CORREO-REAL@evolvixglobal.com';
  v_clave text := 'PON-AQUI-TU-CONTRASEÑA-REAL';
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_clave, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      format('{"sub":"%s","email":"%s","email_verified":true}', v_id, v_email)::jsonb,
      'email', now(), now(), now()
    ) on conflict do nothing;

    raise notice 'Identidad creada: % (%)', v_email, v_id;
  else
    raise notice 'Ya existía una identidad con ese correo: % (%)', v_email, v_id;
  end if;
end $$;

insert into public.perfiles (id, nombre, apellidos, email, rol, estado)
select u.id, 'Administración', 'Evolvix Global', u.email, 'admin', 'Activo'
from auth.users u
where u.email = 'PON-AQUI-EL-CORREO-REAL@evolvixglobal.com'
on conflict (id) do update
  set rol = 'admin', estado = 'Activo';

-- --- comprobación -----------------------------------------------------------
select
  u.email,
  (u.encrypted_password is not null) as tiene_hash_en_auth_users,
  exists (select 1 from auth.identities i where i.user_id = u.id) as tiene_identity,
  p.id is not null as tiene_ficha_en_perfiles,
  p.rol, p.estado
from auth.users u
left join public.perfiles p on p.id = u.id
where u.email = 'PON-AQUI-EL-CORREO-REAL@evolvixglobal.com';
-- Fila esperada: tiene_hash_en_auth_users = true, tiene_identity = true,
-- tiene_ficha_en_perfiles = true, rol = admin, estado = Activo.
