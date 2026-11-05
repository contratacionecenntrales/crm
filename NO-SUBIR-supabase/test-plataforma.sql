-- =============================================================================
-- Pruebas de 22-plataforma.sql. NO se ejecuta en Supabase.
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
delete from public.agencias where nombre like 'Plat %';
delete from auth.users where email like '%@plat.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'meta@plat.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'cliente@plat.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'listo@plat.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'u1@plat.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'u2@plat.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant all on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@plat.test';
insert into public.planes (nombre, max_subcuentas, max_usuarios) values ('Plat Mini', 1, 2) on conflict (nombre) do update set max_subcuentas = 1, max_usuarios = 2;
insert into ids select 'mini', id from public.planes where nombre = 'Plat Mini';
delete from auth._sesion;
select public.plataforma_alta_admin('meta@plat.test');
update public.plataforma_ajustes set registro_abierto = false;

set role authenticated;
select pg_temp.entra_como('listo@plat.test');
select pg_temp.prueba('Con el registro cerrado, nadie crea su agencia', $q$ select public.crear_agencia('Plat Por libre') $q$, true);
select pg_temp.prueba('Un usuario normal no se hace admin de la plataforma', $q$ select public.plataforma_alta_admin('listo@plat.test') $q$, true);
select pg_temp.prueba('…ni ve el listado de agencias', $q$ select * from public.plataforma_agencias() $q$, true);
select pg_temp.prueba('…ni crea planes', $q$ insert into public.planes (nombre) values ('Plat Gratis') $q$, true);
select pg_temp.prueba('…ni abre el registro', $q$ update public.plataforma_ajustes set registro_abierto = true $q$, false);
reset role;
select pg_temp.igual('(el registro sigue cerrado)', (select registro_abierto::text from public.plataforma_ajustes), 'false');

set role authenticated;
select pg_temp.entra_como('meta@plat.test');
insert into ids select 'ag', public.plataforma_crear_agencia('Plat Cliente', (select id from ids where clave = 'cliente'), (select id from ids where clave = 'mini'), 14);
select pg_temp.igual('La plataforma crea una agencia en prueba de 14 días',
  (select estado || ' ' || (prueba_hasta - current_date) from public.plataforma_agencias() where nombre = 'Plat Cliente'), 'prueba 14');
select pg_temp.entra_como('cliente@plat.test');
select pg_temp.igual('…y el cliente es su propietario',
  (select rol::text from public.agencia_miembros where agencia_id = (select id from ids where clave = 'ag') and usuario_id = (select id from ids where clave = 'cliente')), 'propietario');
select pg_temp.entra_como('meta@plat.test');
select pg_temp.igual('El listado de la plataforma la muestra con su dueño', (select dueno_email from public.plataforma_agencias() where nombre = 'Plat Cliente'), 'cliente@plat.test');

select pg_temp.entra_como('cliente@plat.test');
select pg_temp.prueba('La agencia no puede cambiarse el plan', $q$ update public.agencias set plan_id = null where nombre = 'Plat Cliente' $q$, true);
select pg_temp.prueba('…ni salir del estado de prueba', $q$ update public.agencias set estado = 'activa' where nombre = 'Plat Cliente' $q$, true);
select pg_temp.prueba('…pero sí su nombre', $q$ update public.agencias set telefono = '600' where nombre = 'Plat Cliente' $q$, false);
select pg_temp.prueba('Crea su primera subcuenta (plan: 1)', $q$ insert into public.subcuentas (agencia_id, nombre) select id, 'Plat Sub 1' from ids where clave = 'ag' $q$, false);
select pg_temp.prueba('La segunda supera el plan', $q$ insert into public.subcuentas (agencia_id, nombre) select id, 'Plat Sub 2' from ids where clave = 'ag' $q$, true);
select pg_temp.prueba('Añade un usuario (plan: 2 usuarios)', $q$ select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Plat Sub 1'), 'u1@plat.test', 'usuario') $q$, false);
select pg_temp.prueba('El tercero supera el plan', $q$ select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Plat Sub 1'), 'u2@plat.test', 'usuario') $q$, true);
select pg_temp.igual('Ve su plan y su uso', (select (r ->> 'subcuentas') || '/' || (r -> 'plan' ->> 'max_subcuentas') from (select public.mi_plan((select id from ids where clave = 'ag')) r) x), '1/1');
select pg_temp.prueba('No ve las notas internas de la plataforma', $q$ select * from public.agencia_notas_plataforma $q$, true);
reset role;

-- Suspensión
set role authenticated;
select pg_temp.entra_como('meta@plat.test');
select public.plataforma_actualizar_agencia((select id from ids where clave = 'ag'), (select id from ids where clave = 'mini'), 'suspendida', null, 'Impago', 'Llamar al cliente');
select pg_temp.entra_como('u1@plat.test');
select pg_temp.igual('Con la agencia suspendida, sus usuarios no entran en la subcuenta',
  (select public.puedo_ver_subcuenta((select id from public.subcuentas where nombre = 'Plat Sub 1'))::text), 'false');
select pg_temp.entra_como('cliente@plat.test');
select pg_temp.igual('…ni la propia agencia', (select public.puedo_ver_subcuenta((select id from public.subcuentas where nombre = 'Plat Sub 1'))::text), 'false');
select pg_temp.igual('…pero ve el motivo', (select public.mi_plan((select id from ids where clave = 'ag')) ->> 'motivo'), 'Impago');
reset role;
select pg_temp.igual('Lo público también se corta', (select public.subcuenta_operativa((select id from public.subcuentas where nombre = 'Plat Sub 1'))::text), 'false');
-- Prueba vencida = como suspendida
set role authenticated;
select pg_temp.entra_como('meta@plat.test');
select public.plataforma_actualizar_agencia((select id from ids where clave = 'ag'), null, 'prueba', current_date - 1, '', '');
select pg_temp.igual('Una prueba vencida no está operativa', (select public.agencia_operativa((select id from ids where clave = 'ag'))::text), 'false');
select public.plataforma_actualizar_agencia((select id from ids where clave = 'ag'), null, 'activa', null, '', '');
select pg_temp.entra_como('u1@plat.test');
select pg_temp.igual('Reactivada, vuelve a entrar', (select public.puedo_ver_subcuenta((select id from public.subcuentas where nombre = 'Plat Sub 1'))::text), 'true');
reset role;

delete from public.agencias where nombre like 'Plat %';
delete from public.planes where nombre like 'Plat %';
delete from public.plataforma_admins where usuario_id in (select id from ids);
delete from auth.users where email like '%@plat.test';
update public.plataforma_ajustes set registro_abierto = true;
