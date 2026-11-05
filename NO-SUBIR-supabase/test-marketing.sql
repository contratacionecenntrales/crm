-- =============================================================================
-- Pruebas de 26-marketing.sql. NO se ejecuta en Supabase.
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
delete from auth.users where email like '%@mkt.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@mkt.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@mkt.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@mkt.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@mkt.test';
set role authenticated;
select pg_temp.entra_como('otro@mkt.test');
select public.crear_agencia('Ajena Mkt');
select pg_temp.entra_como('duena@mkt.test');
select public.crear_agencia('Agencia Mkt');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Mkt';
set role authenticated;
select pg_temp.entra_como('duena@mkt.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Norte'), 'ana@mkt.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';
insert into public.crm_contactos (subcuenta_id, nombre, email, telefono, etiquetas, dnd, dnd_canales)
select (select id from ids where clave = 'norte'), n, e, t, et::text[], d, dc::text[] from (values
  ('Ana', 'a@x.com', '+34600000001', '{vip,clientes}', false, '{}'),
  ('Beto', 'b@x.com', '', '{clientes}', false, '{}'),
  ('Caro', 'c@x.com', '+34600000003', '{vip}', false, '{email}'),
  ('Dani', null, '+34600000004', '{vip}', false, '{}'),
  ('Eva', 'e@x.com', '', '{vip,baja-manual}', false, '{}'),
  ('Fran', 'f@x.com', '', '{vip}', true, '{}')) v(n, e, t, et, d, dc);

set role authenticated;
select pg_temp.entra_como('ana@mkt.test');
select pg_temp.prueba('Una usuaria no puede crear campañas',
  $q$ insert into public.mkt_campanas (subcuenta_id, nombre, canal) select id, 'X', 'email' from ids where clave = 'norte' $q$, true);
select pg_temp.entra_como('duena@mkt.test');
select pg_temp.prueba('La dueña crea una campaña de correo a VIP sin «baja-manual»',
  $q$ insert into public.mkt_campanas (subcuenta_id, nombre, canal, asunto, cuerpo, etiquetas, excluir) select id, 'Promo', 'email', 'Oferta', 'Hola {{contacto.nombre}}', '{vip}', '{baja-manual}' from ids where clave = 'norte' $q$, false);
select pg_temp.igual('Audiencia: con correo, sin «No molestar», sin la excluida', public.mkt_audiencia((select id from ids where clave = 'norte'), 'email', '{vip}', 'alguna', '{baja-manual}')::text, '1');
select pg_temp.igual('Audiencia SMS de VIP', public.mkt_audiencia((select id from ids where clave = 'norte'), 'sms', '{vip}', 'alguna', '{}')::text, '3');
select pg_temp.igual('Con todas las etiquetas', public.mkt_audiencia((select id from ids where clave = 'norte'), 'email', '{vip,clientes}', 'todas', '{}')::text, '1');
select pg_temp.igual('Sin etiquetas = todos los que tienen correo', public.mkt_audiencia((select id from ids where clave = 'norte'), 'email', '{}', 'alguna', '{}')::text, '3');
select pg_temp.entra_como('otro@mkt.test');
select pg_temp.igual('Otra agencia no ve la audiencia', public.mkt_audiencia((select id from ids where clave = 'norte'), 'email', '{}', 'alguna', '{}')::text, '0');
select pg_temp.igual('…ni la campaña', (select count(*)::text from public.mkt_campanas), '0');
select pg_temp.prueba('…ni la lanza', $q$ select public.mkt_lanzar((select id from public.mkt_campanas limit 1)) $q$, true);
select pg_temp.entra_como('duena@mkt.test');
select pg_temp.igual('Lanzar crea los envíos', public.mkt_lanzar((select id from public.mkt_campanas where nombre = 'Promo'))::text, '1');
select pg_temp.prueba('No se lanza dos veces', $q$ select public.mkt_lanzar((select id from public.mkt_campanas where nombre = 'Promo')) $q$, true);
select pg_temp.prueba('Lanzada ya no se edita', $q$ update public.mkt_campanas set cuerpo = 'otro' where nombre = 'Promo' $q$, true);
select pg_temp.prueba('…ni se borra en curso', $q$ delete from public.mkt_campanas where nombre = 'Promo' $q$, true);
select pg_temp.prueba('El equipo no puede leer los tokens de baja', $q$ select token from public.mkt_envios $q$, true);
select pg_temp.prueba('Una campaña sin destinatarios no se lanza',
  $q$ with c as (insert into public.mkt_campanas (subcuenta_id, nombre, canal, cuerpo, etiquetas) select id, 'Vacía', 'sms', 'Hola', '{nadie}' from ids where clave = 'norte' returning id) select public.mkt_lanzar((select id from c)) $q$, true);
insert into public.mkt_campanas (subcuenta_id, nombre, canal, cuerpo, etiquetas) select id, 'Futura', 'sms', 'Hola', '{vip}' from ids where clave = 'norte';
select pg_temp.igual('Programar para mañana', public.mkt_lanzar((select id from public.mkt_campanas where nombre = 'Futura'), now() + interval '1 day')::text, '3');
select pg_temp.igual('…queda programada', (select estado from public.mkt_campanas where nombre = 'Futura'), 'programada');
select pg_temp.prueba('Nadie del panel toma envíos', $q$ select public.mkt_tomar(10) $q$, true);
reset role;

set role service_role;
select pg_temp.igual('El servidor toma solo lo que está en hora', (select count(*)::text from public.mkt_tomar(50)), '1');
reset role;
update public.mkt_campanas set programada_en = now() - interval '1 minute' where nombre = 'Futura';
set role service_role;
select pg_temp.igual('…y la programada cuando llega su hora', (select count(*)::text from public.mkt_tomar(50)), '3');
reset role;
update public.mkt_envios set estado = 'enviado' where estado = 'procesando';
set role service_role;
select count(*) from public.mkt_tomar(50);
reset role;
select pg_temp.igual('Sin pendientes, la campaña queda enviada', (select string_agg(estado, ',' order by nombre) from public.mkt_campanas where nombre in ('Promo', 'Futura')), 'enviada,enviada');

-- Bajas -------------------------------------------------------------------------------
create temp table tk as select token from public.mkt_envios e join public.crm_contactos c on c.id = e.contacto_id join public.mkt_campanas x on x.id = e.campana_id where c.nombre = 'Ana' and x.nombre = 'Promo';
grant select on tk to anon;
delete from auth._sesion;
set role anon;
select pg_temp.igual('El enlace de baja funciona sin sesión', public.mkt_baja((select token from tk)) ->> 'empresa', 'Norte');
select pg_temp.igual('Token inventado → nada', coalesce(public.mkt_baja(gen_random_uuid())::text, '∅'), '∅');
reset role;
select pg_temp.igual('Ana queda sin correos de campaña', (select array_to_string(dnd_canales, ',') from public.crm_contactos where nombre = 'Ana'), 'email');
select pg_temp.igual('…y deja un evento en su ficha', (select count(*)::text from public.crm_eventos where tipo = 'baja'), '1');
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34600000004', ' Baja. ', '', 'B1');
select pg_temp.igual('Responder BAJA por SMS da de baja ese canal', (select array_to_string(dnd_canales, ',') from public.crm_contactos where nombre = 'Dani'), 'sms');
select public.conv_registrar_entrante((select id from ids where clave = 'norte'), 'sms', '+34600000003', 'Bajaré mañana a verte', '', 'B2');
select pg_temp.igual('Una frase que contiene «baja» no cuenta', (select array_to_string(dnd_canales, ',') from public.crm_contactos where nombre = 'Caro'), 'email');

-- Cancelar ------------------------------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('duena@mkt.test');
insert into public.mkt_campanas (subcuenta_id, nombre, canal, asunto, cuerpo) select id, 'Boletín', 'email', 'Novedades', 'Hola' from ids where clave = 'norte';
select public.mkt_lanzar((select id from public.mkt_campanas where nombre = 'Boletín'), now() + interval '2 hours');
select pg_temp.prueba('Cancelar una programada', $q$ select public.mkt_cancelar((select id from public.mkt_campanas where nombre = 'Boletín')) $q$, false);
select pg_temp.igual('…sus envíos quedan omitidos', (select string_agg(distinct e.estado, ',') from public.mkt_envios e join public.mkt_campanas c on c.id = e.campana_id where c.nombre = 'Boletín'), 'omitido');
select pg_temp.prueba('…y ya se puede borrar', $q$ delete from public.mkt_campanas where nombre = 'Boletín' $q$, false);
reset role;
