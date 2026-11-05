-- =============================================================================
-- Pruebas de 23-embudos.sql. NO se ejecuta en Supabase.
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
delete from public.planes where nombre = 'Emb Sin Embudos';
delete from auth.users where email like '%@emb.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@emb.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ana@emb.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'otro@emb.test', 'authenticated', 'authenticated', now(), now(), '{}');
create temp table ids (clave text primary key, id uuid);
grant select on ids to authenticated, anon, service_role;
insert into ids select split_part(email, '@', 1), id from auth.users where email like '%@emb.test';

set role authenticated;
select pg_temp.entra_como('otro@emb.test');
select public.crear_agencia('Ajena Emb');
insert into public.subcuentas (agencia_id, nombre) select id, 'Sur' from public.agencias where nombre = 'Ajena Emb';
select pg_temp.entra_como('duena@emb.test');
select public.crear_agencia('Agencia Emb');
reset role;
insert into ids select 'ag', id from public.agencias where nombre = 'Agencia Emb';
insert into ids select 'ajena', id from public.agencias where nombre = 'Ajena Emb';
insert into ids select 'sur', id from public.subcuentas where nombre = 'Sur';
set role authenticated;
select pg_temp.entra_como('duena@emb.test');
insert into public.subcuentas (agencia_id, nombre) select id, 'Norte' from ids where clave = 'ag';
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Norte'), 'ana@emb.test', 'usuario');
reset role;
insert into ids select 'norte', id from public.subcuentas where nombre = 'Norte';

-- Crear embudo y pasos ---------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('ana@emb.test');
select pg_temp.prueba('Ana (usuaria de la subcuenta) crea un embudo',
  $q$ insert into public.emb_embudos (subcuenta_id, nombre, slug) select id, 'Captación', 'captacion-emb' from ids where clave = 'norte' $q$, false);
reset role;
insert into ids select 'emb', id from public.emb_embudos where slug = 'captacion-emb';
set role authenticated;
select pg_temp.entra_como('ana@emb.test');
select pg_temp.prueba('Ana crea dos pasos',
  $q$ insert into public.emb_pasos (embudo_id, subcuenta_id, nombre, ruta, orden, contenido) values
      ((select id from ids where clave = 'emb'), (select id from ids where clave = 'norte'), 'Inicio', 'inicio', 0,
       '{"estilo":{"color_primario":"#155eef","fondo":"#ffffff","fuente":"sans"},"secciones":[{"id":"s1","fondo":"#ffffff","relleno":"normal","ancho":"normal","bloques":[
         {"id":"f1","tipo":"formulario","campos":[{"clave":"nombre","etiqueta":"Nombre","tipo":"texto","obligatorio":true},{"clave":"email","etiqueta":"Correo","tipo":"email","obligatorio":true},{"clave":"empresa","etiqueta":"Empresa","tipo":"texto","obligatorio":false}],
          "boton":"Enviar","etiquetas":["lead-web","ebook"],"despues":"siguiente","url":"","mensaje":"","aviso_legal":""}]}]}'),
      ((select id from ids where clave = 'emb'), (select id from ids where clave = 'norte'), 'Gracias', 'gracias', 1, '{"secciones":[]}') $q$, false);
reset role;
insert into ids select 'p1', id from public.emb_pasos where ruta = 'inicio' and embudo_id = (select id from ids where clave = 'emb');
insert into ids select 'p2', id from public.emb_pasos where ruta = 'gracias' and embudo_id = (select id from ids where clave = 'emb');
set role authenticated;
select pg_temp.entra_como('ana@emb.test');
select pg_temp.prueba('Ruta repetida en el mismo embudo → error',
  $q$ insert into public.emb_pasos (embudo_id, subcuenta_id, nombre, ruta) values ((select id from ids where clave = 'emb'), (select id from ids where clave = 'norte'), 'Otra', 'inicio') $q$, true);
select pg_temp.prueba('Ruta con mayúsculas o barras → error',
  $q$ insert into public.emb_pasos (embudo_id, subcuenta_id, nombre, ruta) values ((select id from ids where clave = 'emb'), (select id from ids where clave = 'norte'), 'Mala', '../Admin') $q$, true);
select pg_temp.prueba('Slug con caracteres raros → error',
  $q$ insert into public.emb_embudos (subcuenta_id, nombre, slug) select id, 'X', 'Hola Mundo' from ids where clave = 'norte' $q$, true);
select pg_temp.prueba('Paso colgado de un embudo de otra subcuenta → error',
  $q$ insert into public.emb_pasos (embudo_id, subcuenta_id, nombre, ruta) values ((select id from ids where clave = 'emb'), (select id from ids where clave = 'sur'), 'X', 'x') $q$, true);
select pg_temp.prueba('Ana no puede escribir la versión publicada a mano',
  $q$ update public.emb_pasos set publicado = '{"secciones":[]}' where id = (select id from ids where clave = 'p1') $q$, true);
select pg_temp.prueba('Ana no puede mover un paso a otra subcuenta',
  $q$ update public.emb_pasos set subcuenta_id = (select id from ids where clave = 'sur') where id = (select id from ids where clave = 'p1') $q$, true);
select pg_temp.prueba('Ana no puede inflar estadísticas',
  $q$ insert into public.emb_estadisticas (paso_id, subcuenta_id, dia, visitas) values ((select id from ids where clave = 'p1'), (select id from ids where clave = 'norte'), current_date, 999) $q$, true);

-- Aislamiento ---------------------------------------------------------------------
select pg_temp.entra_como('otro@emb.test');
select pg_temp.igual('Otra agencia no ve el embudo', (select count(*)::text from public.emb_embudos where slug = 'captacion-emb'), '0');
select pg_temp.igual('…ni sus pasos', (select count(*)::text from public.emb_pasos where embudo_id = (select id from ids where clave = 'emb')), '0');
select pg_temp.prueba('…ni puede publicarlo', $q$ select public.emb_publicar((select id from ids where clave = 'p1')) $q$, true);
update public.emb_embudos set nombre = 'Hackeado' where id = (select id from ids where clave = 'emb');
select pg_temp.prueba('…ni crear embudos en una subcuenta ajena',
  $q$ insert into public.emb_embudos (subcuenta_id, nombre, slug) select id, 'Intruso', 'intruso-emb' from ids where clave = 'norte' $q$, true);
reset role;
select pg_temp.igual('El intento de renombrar desde otra agencia no cambia nada', (select nombre from public.emb_embudos where id = (select id from ids where clave = 'emb')), 'Captación');

-- Público: antes de publicar no hay nada -------------------------------------------
delete from auth._sesion;
set role anon;
select pg_temp.igual('Sin publicar → la página pública no existe', coalesce(public.emb_pagina_publica('captacion-emb', '')::text, '∅'), '∅');
select pg_temp.prueba('Sin publicar → el formulario no acepta envíos',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '{"nombre":"Eva","email":"eva@x.com"}') $q$, true);
select pg_temp.prueba('Anónimo no lee las tablas', $q$ select count(*) from public.emb_pasos $q$, true);
select pg_temp.prueba('Anónimo no puede publicar', $q$ select public.emb_publicar((select id from ids where clave = 'p1')) $q$, true);
reset role;

-- Publicar ------------------------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('ana@emb.test');
select pg_temp.prueba('Ana publica los dos pasos',
  $q$ select public.emb_publicar((select id from ids where clave = 'p1')), public.emb_publicar((select id from ids where clave = 'p2')) $q$, false);
select pg_temp.igual('…pero el embudo sigue en borrador', coalesce(public.emb_pagina_publica('captacion-emb', '')::text, '∅'), '∅');
update public.emb_embudos set publicado = true where id = (select id from ids where clave = 'emb');
-- El borrador cambia después de publicar: lo público sigue igual.
update public.emb_pasos set contenido = '{"secciones":[],"borrador":true}' where id = (select id from ids where clave = 'p2');
reset role;

delete from auth._sesion;
set role anon;
select pg_temp.igual('Publicado → la entrada muestra el primer paso', public.emb_pagina_publica('captacion-emb', '') ->> 'ruta', 'inicio');
select pg_temp.igual('…con el paso siguiente', public.emb_pagina_publica('captacion-emb', '') ->> 'siguiente', 'gracias');
select pg_temp.igual('…y el nombre de la empresa', public.emb_pagina_publica('captacion-emb', '') ->> 'empresa', 'Norte');
select pg_temp.igual('El último paso no tiene siguiente', coalesce(public.emb_pagina_publica('captacion-emb', 'gracias') ->> 'siguiente', '∅'), '∅');
select pg_temp.igual('Lo público es la versión publicada, no el borrador', coalesce(public.emb_pagina_publica('captacion-emb', 'gracias') -> 'contenido' ->> 'borrador', '∅'), '∅');
select pg_temp.igual('Ruta inexistente → nada', coalesce(public.emb_pagina_publica('captacion-emb', 'nada')::text, '∅'), '∅');
select pg_temp.igual('Mayúsculas en la dirección también valen', public.emb_pagina_publica('CAPTACION-EMB', 'Gracias') ->> 'ruta', 'gracias');

-- Visitas -------------------------------------------------------------------------
select public.emb_registrar_visita((select id from ids where clave = 'p1'));
select public.emb_registrar_visita((select id from ids where clave = 'p1'));
select public.emb_registrar_visita(gen_random_uuid());
reset role;
select pg_temp.igual('Se cuentan las visitas del paso', (select visitas::text from public.emb_estadisticas where paso_id = (select id from ids where clave = 'p1') and dia = current_date), '2');

-- Formularios ---------------------------------------------------------------------
insert into public.aut_flujos (subcuenta_id, nombre, disparador, filtro, activo, pasos) values
  ((select id from ids where clave = 'norte'), 'Lead web', 'formulario_enviado', jsonb_build_object('embudo_web_id', (select id from ids where clave = 'emb')), true, '[{"tipo":"nota","texto":"Lead del embudo"}]'),
  ((select id from ids where clave = 'norte'), 'Otro embudo', 'formulario_enviado', jsonb_build_object('embudo_web_id', gen_random_uuid()), true, '[{"tipo":"nota","texto":"x"}]');
delete from auth._sesion;
set role anon;
select pg_temp.prueba('Bloque que no existe en lo publicado → error',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'inventado', '{"email":"eva@x.com"}') $q$, true);
select pg_temp.prueba('Falta un campo obligatorio → error',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '{"email":"eva@x.com"}') $q$, true);
select pg_temp.prueba('Correo no válido → error',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '{"nombre":"Eva","email":"no-es-correo"}') $q$, true);
select pg_temp.prueba('Datos que no son un objeto → error',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '["x"]') $q$, true);
select pg_temp.prueba('Envío correcto',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '{"nombre":"Eva","email":"Eva@X.com","empresa":"Luz SL","es_admin":"true"}') $q$, false);
reset role;
select pg_temp.igual('Se crea el contacto con su correo en minúsculas', (select nombre || ' ' || email from public.crm_contactos where subcuenta_id = (select id from ids where clave = 'norte')), 'Eva eva@x.com');
select pg_temp.igual('…etiquetas', (select string_agg(e, ',' order by e) from public.crm_contactos c, unnest(c.etiquetas) e where c.email = 'eva@x.com'), 'ebook,lead-web');
select pg_temp.igual('…y la fuente del embudo', (select fuente from public.crm_contactos where email = 'eva@x.com'), 'Embudo: Captación');
select pg_temp.igual('Queda el evento con la respuesta extra (y no la clave inventada)', (select detalle ->> 'datos' from public.crm_eventos where tipo = 'formulario_enviado'), E'Empresa: Luz SL\n');
select pg_temp.igual('Cuenta el envío', (select envios::text from public.emb_estadisticas where paso_id = (select id from ids where clave = 'p1') and dia = current_date), '1');
select pg_temp.igual('Dispara solo el flujo de este embudo', (select string_agg(f.nombre, ',') from public.aut_ejecuciones e join public.aut_flujos f on f.id = e.flujo_id where f.subcuenta_id = (select id from ids where clave = 'norte')), 'Lead web');

delete from auth._sesion;
set role anon;
select pg_temp.prueba('Segundo envío con el mismo correo y otro nombre',
  $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '{"nombre":"Atacante","email":"eva@x.com"}') $q$, false);
reset role;
select pg_temp.igual('No se duplica el contacto', (select count(*)::text from public.crm_contactos where email = 'eva@x.com'), '1');
select pg_temp.igual('…ni se sobrescribe su nombre desde la web', (select nombre from public.crm_contactos where email = 'eva@x.com'), 'Eva');

-- Despublicar / suspender / plan ----------------------------------------------------
update public.emb_embudos set publicado = false where id = (select id from ids where clave = 'emb');
delete from auth._sesion;
set role anon;
select pg_temp.igual('Embudo despublicado → no hay página', coalesce(public.emb_pagina_publica('captacion-emb', '')::text, '∅'), '∅');
select pg_temp.prueba('…ni formulario', $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '{"nombre":"Leo","email":"leo@x.com"}') $q$, true);
reset role;
update public.emb_embudos set publicado = true where id = (select id from ids where clave = 'emb');
delete from auth._sesion;
update public.agencias set estado = 'suspendida' where id = (select id from ids where clave = 'ag');
set role anon;
select pg_temp.igual('Agencia suspendida → no hay página', coalesce(public.emb_pagina_publica('captacion-emb', '')::text, '∅'), '∅');
select pg_temp.prueba('…ni formulario', $q$ select public.emb_enviar_formulario((select id from ids where clave = 'p1'), 'f1', '{"nombre":"Leo","email":"leo@x.com"}') $q$, true);
reset role;
set role authenticated;
select pg_temp.entra_como('ana@emb.test');
select pg_temp.igual('…y su equipo deja de ver los embudos', (select count(*)::text from public.emb_embudos), '0');
reset role;
delete from auth._sesion;
update public.agencias set estado = 'activa' where id = (select id from ids where clave = 'ag');

delete from auth._sesion;
insert into public.planes (nombre, funciones) values ('Emb Sin Embudos', '{"ia":false,"embudos":false,"whatsapp":true,"api":true,"marca_blanca":false}');
update public.agencias set plan_id = (select id from public.planes where nombre = 'Emb Sin Embudos') where id = (select id from ids where clave = 'ag');
set role anon;
select pg_temp.igual('Plan sin embudos → la página deja de servirse', coalesce(public.emb_pagina_publica('captacion-emb', '')::text, '∅'), '∅');
reset role;
set role authenticated;
select pg_temp.entra_como('ana@emb.test');
select pg_temp.prueba('Plan sin embudos → no se pueden crear',
  $q$ insert into public.emb_embudos (subcuenta_id, nombre, slug) select id, 'Nuevo', 'nuevo-emb' from ids where clave = 'norte' $q$, true);
reset role;
delete from auth._sesion;
update public.agencias set plan_id = null where id = (select id from ids where clave = 'ag');

-- Disparador en automatizaciones ----------------------------------------------------
select pg_temp.prueba('El disparador «formulario_enviado» es válido en flujos',
  $q$ insert into public.aut_flujos (subcuenta_id, nombre, disparador) values ((select id from ids where clave = 'norte'), 'Vale', 'formulario_enviado') $q$, false);
select pg_temp.igual('Filtro por embudo: coincide', public.aut_coincide('formulario_enviado', jsonb_build_object('embudo_web_id', 'a'), '{"embudo_web_id":"a"}')::text, 'true');
select pg_temp.igual('Filtro por embudo: otro embudo no', public.aut_coincide('formulario_enviado', jsonb_build_object('embudo_web_id', 'a'), '{"embudo_web_id":"b"}')::text, 'false');

-- Borrar en cascada -------------------------------------------------------------------
set role authenticated;
select pg_temp.entra_como('ana@emb.test');
delete from public.emb_embudos where id = (select id from ids where clave = 'emb');
reset role;
select pg_temp.igual('Borrar el embudo borra pasos y estadísticas', (select count(*)::text from public.emb_pasos where embudo_id = (select id from ids where clave = 'emb')) || '/' || (select count(*)::text from public.emb_estadisticas where paso_id in ((select id from ids where clave = 'p1'), (select id from ids where clave = 'p2'))), '0/0');
