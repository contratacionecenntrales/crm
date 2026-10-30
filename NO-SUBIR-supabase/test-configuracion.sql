-- =============================================================================
-- Pruebas de 11-configuracion.sql. NO se ejecuta en Supabase.
-- _stub-auth.sql → 09 → 10 → 11 → este fichero.
-- =============================================================================
\set ON_ERROR_STOP off
\pset pager off

create or replace function pg_temp.entra_como(p_email text) returns void
language plpgsql security definer as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  delete from auth._sesion; insert into auth._sesion values (v);
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
grant execute on all functions in schema pg_temp to authenticated;

delete from public.agencias;
delete from auth.users where email like '%@conf.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@conf.test', 'authenticated', 'authenticated', now(), now(), '{"nombre":"Dueña","telefono":"+34600000000"}'),
  (gen_random_uuid(), 'cliente@conf.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@conf.test', 'authenticated', 'authenticated', now(), now(), '{}');

set role authenticated;
select pg_temp.entra_como('duena@conf.test');
select public.crear_agencia('Agencia Conf');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from public.agencias;
insert into public.subcuentas (agencia_id, nombre) select id, 'Sur' from public.agencias;
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Norte'), 'cliente@conf.test', 'admin');

select pg_temp.prueba('La dueña guarda marca blanca y tiempo de sesión',
  $q$ update public.agencias set css_personalizado = ':root{--x:1}', tema_defecto = 'oscuro', expiracion_sesion_min = 30, ciudad = 'Gijón' $q$, false);
select pg_temp.prueba('Tiempo de sesión fuera de rango se rechaza',
  $q$ update public.agencias set expiracion_sesion_min = 1 $q$, true);
select pg_temp.igual('Usuarios de la agencia: dueña + cliente = 2',
  (select count(*)::text from public.usuarios_de_agencia((select id from public.agencias))), '2');
select pg_temp.igual('El teléfono del perfil sale en la lista',
  (select telefono from public.usuarios_de_agencia((select id from public.agencias)) where tipo = 'agencia'), '+34600000000');
select pg_temp.prueba('Anuncio para todas las subcuentas',
  $q$ insert into public.anuncios (agencia_id, titulo, prioridad, frecuencia) select id, 'Mantenimiento el domingo', 'advertencia', 'una_vez' from public.agencias $q$, false);
select pg_temp.prueba('Anuncio solo para Sur',
  $q$ insert into public.anuncios (agencia_id, titulo, subcuentas) select a.id, 'Solo Sur', array[(select id from public.subcuentas where nombre = 'Sur')] from public.agencias a $q$, false);
select pg_temp.prueba('Enlace que no es http se rechaza',
  $q$ insert into public.anuncios (agencia_id, titulo, enlace) select id, 'x', 'javascript:alert(1)' from public.agencias $q$, true);

select pg_temp.entra_como('cliente@conf.test');
select pg_temp.igual('El cliente de Norte ve 1 anuncio (el de todas)',
  (select count(*)::text from public.anuncios_pendientes((select id from public.subcuentas))), '1');
select pg_temp.igual('El cliente no puede leer la tabla de anuncios directamente',
  (select count(*)::text from public.anuncios), '0');
select pg_temp.prueba('El cliente no puede crear anuncios',
  $q$ insert into public.anuncios (agencia_id, titulo) values ('00000000-0000-0000-0000-000000000000', 'x') $q$, true);
select pg_temp.prueba('Cierra el anuncio', $q$ select public.cerrar_anuncio((select id from public.anuncios_pendientes((select id from public.subcuentas)))) $q$, false);
select pg_temp.igual('«Una vez»: ya no vuelve a salir',
  (select count(*)::text from public.anuncios_pendientes((select id from public.subcuentas))), '0');
select pg_temp.igual('El cliente recibe la marca de su agencia',
  (select (public.soporte_subcuenta((select id from public.subcuentas)) ->> 'tema')), 'oscuro');
select pg_temp.prueba('El cliente no ve usuarios de la agencia',
  $q$ select * from public.usuarios_de_agencia('00000000-0000-0000-0000-000000000000') $q$, true);

insert into public.crm_contactos (subcuenta_id, nombre, etiquetas) select id, 'Ana', array['vip', 'nuevo'] from public.subcuentas;
insert into public.crm_contactos (subcuenta_id, nombre, etiquetas) select id, 'Luis', array['vip'] from public.subcuentas;
select pg_temp.prueba('El admin de subcuenta describe una etiqueta',
  $q$ update public.crm_etiquetas set descripcion = 'Clientes top', categoria = 'Segmento' where nombre = 'vip' $q$, false);
select pg_temp.igual('Renombrar vip → premium cambia 2 contactos',
  (select public.crm_renombrar_etiqueta((select id from public.subcuentas), 'vip', 'premium')::text), '2');
select pg_temp.igual('…y conserva la descripción',
  (select descripcion from public.crm_etiquetas where nombre = 'premium'), 'Clientes top');
select pg_temp.igual('…y ya no existe vip', (select count(*)::text from public.crm_etiquetas where nombre = 'vip'), '0');
select pg_temp.igual('Borrar «nuevo» la quita de 1 contacto',
  (select public.crm_borrar_etiqueta((select id from public.subcuentas), 'nuevo')::text), '1');
select pg_temp.igual('Ana se queda solo con premium',
  (select array_to_string(etiquetas, ',') from public.crm_contactos where nombre = 'Ana'), 'premium');

select pg_temp.entra_como('otro@conf.test');
select pg_temp.igual('Una persona ajena no ve anuncios',
  (select count(*)::text from public.anuncios_pendientes((select s.id from public.agencias a, public.subcuentas s limit 1))), '0');
reset role;
create temp table s_ajena as select id from public.subcuentas where nombre = 'Norte';
grant select on s_ajena to authenticated;
set role authenticated;
select pg_temp.prueba('Una persona ajena no renombra etiquetas',
  $q$ select public.crm_renombrar_etiqueta((select id from s_ajena), 'premium', 'x') $q$, true);
select pg_temp.igual('Una persona ajena no recibe la marca',
  (select public.soporte_subcuenta((select id from s_ajena))::text), null);
reset role;
delete from public.agencias;
