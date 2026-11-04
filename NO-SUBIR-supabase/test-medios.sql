-- =============================================================================
-- Pruebas de 21-medios.sql. NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@med.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@med.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'admin@med.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@med.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@med.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@med.test';

set role authenticated;
select pg_temp.entra_como('otro@med.test');
select public.crear_agencia('Ajena');
select pg_temp.entra_como('duena@med.test');
select public.crear_agencia('Agencia Med');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Med';
insert into public.agencia_miembros (agencia_id, usuario_id, rol) select (select id from ids where clave = 'ag'), (select id from ids where clave = 'admin'), 'admin';
set role authenticated;
select pg_temp.entra_como('duena@med.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas), 'ana@med.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';

select pg_temp.igual('Ruta válida → su subcuenta', public.medios_subcuenta_de('11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png')::text, '11111111-1111-4111-8111-111111111111');
select pg_temp.igual('Ruta con ../ → no válida', coalesce(public.medios_subcuenta_de('11111111-1111-4111-8111-111111111111/../x.png')::text, '∅'), '∅');
select pg_temp.igual('Ruta sin carpeta de subcuenta → no válida', coalesce(public.medios_subcuenta_de('foto.png')::text, '∅'), '∅');
insert into public.medios (subcuenta_id, ruta, nombre, tipo, tamano)
  select id, id || '/22222222-2222-4222-8222-222222222222.png', 'logo.png', 'image/png', 1000 from ids where clave = 'norte';
set role authenticated;
select pg_temp.entra_como('ana@med.test');
select pg_temp.igual('Ana ve los medios de su subcuenta', (select count(*)::text from public.medios), '1');
select pg_temp.prueba('Ana no puede insertar medios a mano (tamaño falso)',
  $q$ insert into public.medios (subcuenta_id, ruta, nombre, tamano) select id, id || '/33333333-3333-4333-8333-333333333333.png', 'x', 0 from ids where clave = 'norte' $q$, true);
select pg_temp.prueba('…ni cambiar el tamaño registrado', $q$ update public.medios set tamano = 0 $q$, true);
select pg_temp.prueba('…pero sí renombrar', $q$ update public.medios set nombre = 'Logo nuevo.png' $q$, false);
select pg_temp.prueba('Carpeta con «/» se rechaza', $q$ update public.medios set carpeta = 'a/b' $q$, true);
select pg_temp.prueba('Registrar sin el archivo subido se rechaza',
  $q$ select public.medios_registrar((select id from ids where clave = 'norte') || '/44444444-4444-4444-8444-444444444444.png', 'x.png') $q$, true);
select pg_temp.entra_como('otro@med.test');
select pg_temp.igual('Otra agencia no ve esos medios', (select count(*)::text from public.medios), '0');
select pg_temp.prueba('Otra agencia no ve el uso', $q$ select * from public.uso_medios_agencia((select id from ids where clave = 'ag')) $q$, true);
select pg_temp.prueba('…ni puede registrar en esa subcuenta',
  $q$ select public.medios_registrar((select id from ids where clave = 'norte') || '/55555555-5555-4555-8555-555555555555.png', 'x.png') $q$, true);
select pg_temp.entra_como('duena@med.test');
select pg_temp.igual('La dueña ve el uso de sus subcuentas', (select count(*)::text from public.uso_medios_agencia((select id from ids where clave = 'ag'))), '1');
reset role;
delete from public.agencias where nombre in ('Agencia Med', 'Ajena');
delete from auth.users where email like '%@med.test';
