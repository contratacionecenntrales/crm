-- =============================================================================
-- Pruebas de 20-ajustes-agencia.sql. NO se ejecuta en Supabase.
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

delete from public.agencias;
delete from auth.users where email like '%@aj.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@aj.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'admin@aj.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@aj.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@aj.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@aj.test';

set role authenticated;
select pg_temp.entra_como('otro@aj.test');
select public.crear_agencia('Ajena');
select pg_temp.entra_como('duena@aj.test');
select public.crear_agencia('Agencia Aj');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Aj';
insert into public.agencia_miembros (agencia_id, usuario_id, rol) select (select id from ids where clave = 'ag'), (select id from ids where clave = 'admin'), 'admin';
set role authenticated;
select pg_temp.entra_como('duena@aj.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@aj.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';
insert into ids select 'ajena', id from public.agencias where nombre = 'Ajena';
set role authenticated;
select pg_temp.entra_como('duena@aj.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Sur' from ids where clave = 'ag';
reset role;
insert into ids select 'sur', id from public.subcuentas where nombre = 'Sur';

-- 1 · Enlaces de menú
set role authenticated;
select pg_temp.entra_como('ana@aj.test');
select pg_temp.prueba('Un usuario de subcuenta no puede crear enlaces',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url) values ((select id from ids where clave = 'ag'), 'X', 'https://x.com') $q$, true);
select pg_temp.entra_como('duena@aj.test');
select pg_temp.prueba('La agencia crea un enlace para todas sus subcuentas',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, en_agencia) values ((select id from ids where clave = 'ag'), 'Formación', 'https://formacion.com/{{subcuenta.id}}', false) $q$, false);
select pg_temp.prueba('…y uno solo para la subcuenta Sur',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, subcuentas) values ((select id from ids where clave = 'ag'), 'Solo Sur', 'https://sur.com', array[(select id from ids where clave = 'sur')]) $q$, false);
select pg_temp.prueba('Una URL sin https se rechaza',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url) values ((select id from ids where clave = 'ag'), 'Malo', 'javascript:alert(1)') $q$, true);
select pg_temp.prueba('No se puede apuntar a una subcuenta de otra agencia',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, subcuentas) values ((select id from ids where clave = 'ag'), 'X', 'https://x.com', array[gen_random_uuid()]) $q$, true);
select pg_temp.prueba('Sin agencia ni subcuentas no tiene sentido',
  $q$ insert into public.menu_enlaces (agencia_id, nombre, url, en_agencia, en_subcuentas) values ((select id from ids where clave = 'ag'), 'X', 'https://x.com', false, false) $q$, true);
select pg_temp.igual('En la vista de agencia sale solo «Solo Sur» (el otro es solo de subcuentas)',
  (select string_agg(nombre, ',') from public.enlaces_menu((select id from ids where clave = 'ag'), null)), 'Solo Sur');
select pg_temp.entra_como('ana@aj.test');
select pg_temp.igual('Ana (en Norte) ve solo «Formación»',
  (select string_agg(nombre, ',') from public.enlaces_menu(null, (select id from ids where clave = 'norte'))), 'Formación');
select pg_temp.igual('Ana no ve los enlaces de Sur (no tiene acceso)',
  (select count(*)::text from public.enlaces_menu(null, (select id from ids where clave = 'sur'))), '0');
select pg_temp.igual('Ana no lee la tabla directamente', (select count(*)::text from public.menu_enlaces), '0');
select pg_temp.entra_como('otro@aj.test');
select pg_temp.igual('Otra agencia no ve los enlaces de esta', (select count(*)::text from public.enlaces_menu((select id from ids where clave = 'ag'), null)), '0');
reset role;
