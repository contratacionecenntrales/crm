-- =============================================================================
-- Pruebas de 15-sso.sql. NO se ejecuta en Supabase.
-- =============================================================================
\set ON_ERROR_STOP off
\pset pager off

create or replace function pg_temp.entra_como(p_email text) returns void
language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  delete from auth._sesion; if v is not null then insert into auth._sesion values (v); end if;
end $$;
create or replace function pg_temp.prueba(etiqueta text, sentencia text, espera_error boolean)
returns void language plpgsql as $$
declare fallo text := null;
begin
  begin execute sentencia; exception when others then fallo := SQLERRM; end;
  if espera_error then
    raise notice '%  %', case when fallo is not null then '[OK]  ' else '[FALLO]' end,
      etiqueta || case when fallo is not null then ' → ' || split_part(fallo, E'\n', 1) else ' (no dio error)' end;
  else
    raise notice '%  %', case when fallo is null then '[OK]  ' else '[FALLO]' end,
      etiqueta || case when fallo is not null then ' → ' || fallo else '' end;
  end if;
end $$;
create or replace function pg_temp.igual(etiqueta text, obtenido text, esperado text)
returns void language plpgsql as $$
begin
  raise notice '%  % (obtenido: %, esperado: %)',
    case when obtenido is not distinct from esperado then '[OK]  ' else '[FALLO]' end, etiqueta, obtenido, esperado;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- auth.jwt() de Supabase: aquí sale de una tabla temporal para simular el «amr».
create table if not exists auth._jwt (claims jsonb);
create or replace function auth.jwt() returns jsonb language sql stable security definer set search_path = auth as $$
  select coalesce((select claims from auth._jwt limit 1), '{}'::jsonb) $$;
grant execute on function auth.jwt() to authenticated, anon;

delete from public.agencias;
delete from auth.users where email like '%@sso.test' or email like '%@empresa-sso.com' or email like '%@otra-sso.com';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@sso.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otra@sso.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'pepa@empresa-sso.com', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%sso%';

set role authenticated;
select pg_temp.entra_como('duena@sso.test');
select public.crear_agencia('Agencia SSO');
select pg_temp.entra_como('otra@sso.test');
select public.crear_agencia('Otra agencia');
select pg_temp.entra_como('duena@sso.test');
reset role;
insert into ids select 'ag1', id from public.agencias where nombre = 'Agencia SSO';
insert into ids select 'ag2', id from public.agencias where nombre = 'Otra agencia';
set role authenticated;

select pg_temp.prueba('Activar sin dominios se rechaza',
  $q$ select public.sso_guardar((select id from ids where clave = 'ag1'), true, 'saml', '{}', false, false) $q$, true);
select pg_temp.prueba('Dominio mal escrito se rechaza',
  $q$ select public.sso_guardar((select id from ids where clave = 'ag1'), true, 'saml', '{"no es dominio"}', false, false) $q$, true);
select pg_temp.prueba('La dueña activa SAML para empresa-sso.com (obligatorio y alta automática)',
  $q$ select public.sso_guardar((select id from ids where clave = 'ag1'), true, 'saml', '{" Empresa-SSO.com ",empresa-sso.com}', true, true) $q$, false);
select pg_temp.igual('El dominio se guarda una vez y en minúsculas', (select string_agg(dominio, ',') from public.sso_dominios), 'empresa-sso.com');
select pg_temp.prueba('gmail.com no se puede usar',
  $q$ select public.sso_guardar((select id from ids where clave = 'ag1'), true, 'saml', '{empresa-sso.com,gmail.com}', true, true) $q$, true);
reset role;
select pg_temp.igual('Sin verificar, el dominio no cuenta', (select public.sso_para_email('pepa@empresa-sso.com')::text), null);
update public.sso_dominios set verificado = true;
set role authenticated;
select pg_temp.entra_como('duena@sso.test');
select pg_temp.prueba('La dueña no puede marcar su dominio como verificado', $q$ update public.sso_dominios set verificado = true $q$, true);
select pg_temp.prueba('La dueña no puede tocar el SSO de otra agencia',
  $q$ select public.sso_guardar((select id from ids where clave = 'ag2'), false, 'saml', '{}', false, false) $q$, true);
select pg_temp.entra_como('otra@sso.test');
select pg_temp.prueba('Otra agencia no puede quedarse el mismo dominio',
  $q$ select public.sso_guardar((select id from ids where clave = 'ag2'), true, 'google', '{empresa-sso.com}', false, false) $q$, true);
select pg_temp.igual('…ni ve los dominios ajenos', (select count(*)::text from public.sso_dominios), '0');

reset role;
delete from auth._sesion;
set role anon;
select pg_temp.igual('La página de acceso sabe que el correo va por SAML',
  (select public.sso_para_email('Pepa@Empresa-SSO.com') ->> 'proveedor'), 'saml');
select pg_temp.igual('…y que es obligatorio', (select public.sso_para_email('pepa@empresa-sso.com') ->> 'obligatorio'), 'true');
select pg_temp.igual('Un dominio cualquiera no tiene SSO', (select public.sso_para_email('x@gmail.com')::text), null);
select pg_temp.prueba('Anónimo no puede usar el hook', $q$ select public.sso_hook_token('{}') $q$, true);
reset role;

select pg_temp.igual('Hook: contraseña bloqueada para empresa-sso.com',
  (select public.sso_hook_token(jsonb_build_object('user_id', (select id from ids where clave = 'pepa'), 'authentication_method', 'password', 'claims', '{"amr":[{"method":"password"}]}'::jsonb)) -> 'error' ->> 'http_code'), '403');
select pg_temp.igual('Hook: entrar por SAML sí deja',
  (select public.sso_hook_token(jsonb_build_object('user_id', (select id from ids where clave = 'pepa'), 'authentication_method', 'sso/saml', 'claims', '{"a":1,"amr":[{"method":"sso/saml"}]}'::jsonb)) -> 'claims' ->> 'a'), '1');
select pg_temp.igual('Hook: otros dominios entran con contraseña',
  (select (public.sso_hook_token(jsonb_build_object('user_id', (select id from ids where clave = 'duena'), 'authentication_method', 'password', 'claims', '{}'::jsonb)) ? 'error')::text), 'false');

set role authenticated;
select pg_temp.entra_como('pepa@empresa-sso.com');
select pg_temp.igual('Con contraseña no hay alta automática', (select public.sso_unirse()::text), null);
reset role;
update auth.users set email_confirmed_at = now() where email = 'pepa@empresa-sso.com';
insert into auth._jwt values ('{"amr":[{"method":"sso/saml","timestamp":1}]}');
set role authenticated;
select pg_temp.igual('Entrando por SAML se une a la agencia',
  (select (public.sso_unirse() = (select id from ids where clave = 'ag1'))::text), 'true');
select pg_temp.igual('…como usuaria', (select rol::text from public.agencia_miembros where usuario_id = auth.uid()), 'usuario');
select pg_temp.igual('Repetir no duplica', (select (public.sso_unirse() is not null)::text), 'true');
select pg_temp.entra_como('duena@sso.test');
select pg_temp.prueba('Desactivar el SSO', $q$ select public.sso_guardar((select id from ids where clave = 'ag1'), false, 'saml', '{empresa-sso.com}', true, true) $q$, false);
reset role;
select pg_temp.igual('Desactivado, el hook deja entrar con contraseña',
  (select (public.sso_hook_token(jsonb_build_object('user_id', (select id from ids where clave = 'pepa'), 'authentication_method', 'password', 'claims', '{}'::jsonb)) ? 'error')::text), 'false');
delete from auth._jwt;
delete from public.agencias;
