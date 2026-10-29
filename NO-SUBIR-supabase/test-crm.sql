-- =============================================================================
-- Pruebas de 10-crm-contactos-oportunidades.sql. NO se ejecuta en Supabase.
-- _stub-auth.sql → 09 → 10 → este fichero.
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
delete from auth.users where email like '%@crm.test';
insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data) values
  (gen_random_uuid(), 'duena@crm.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'comercial@crm.test', 'authenticated', 'authenticated', now(), now(), '{}'),
  (gen_random_uuid(), 'ajena@crm.test', 'authenticated', 'authenticated', now(), now(), '{}');

create temp table ids as select email, id from auth.users where email like '%@crm.test';
grant select on ids to authenticated;

set role authenticated;
select pg_temp.entra_como('duena@crm.test');
select public.crear_agencia('Agencia CRM');
insert into public.subcuentas (agencia_id, nombre) select id, 'Clínica Norte' from public.agencias;
insert into public.subcuentas (agencia_id, nombre) select id, 'Hotel Sur' from public.agencias;
select public.agregar_miembro_subcuenta((select id from public.subcuentas where nombre = 'Clínica Norte'), 'comercial@crm.test', 'usuario');

select pg_temp.igual('Cada subcuenta nace con su embudo de 5 etapas',
  (select count(*)::text from public.crm_etapas e join public.subcuentas s on s.id = e.subcuenta_id where s.nombre = 'Clínica Norte'), '5');

-- --- comercial (usuario de subcuenta) -----------------------------------------
select pg_temp.entra_como('comercial@crm.test');
select pg_temp.prueba('El comercial crea un contacto',
  $q$ insert into public.crm_contactos (subcuenta_id, nombre, email, telefono, etiquetas)
      values ((select id from public.subcuentas), 'Fernando', '  Fer@Ejemplo.COM ', '+34613940000', array[' vip ', 'vip', '', 'nuevo']) $q$, false);
select pg_temp.igual('El correo se normaliza', (select email from public.crm_contactos), 'fer@ejemplo.com');
select pg_temp.igual('Las etiquetas se limpian y deduplican', (select array_to_string(etiquetas, ',') from public.crm_contactos), 'nuevo,vip');
select pg_temp.igual('El catálogo de etiquetas se rellena solo', (select count(*)::text from public.crm_etiquetas), '2');
select pg_temp.prueba('Correo duplicado en la misma subcuenta se rechaza',
  $q$ insert into public.crm_contactos (subcuenta_id, email) values ((select id from public.subcuentas), 'FER@ejemplo.com') $q$, true);
select pg_temp.prueba('Un contacto vacío se rechaza',
  $q$ insert into public.crm_contactos (subcuenta_id) values ((select id from public.subcuentas)) $q$, true);
select pg_temp.prueba('Teléfono con letras se rechaza',
  $q$ insert into public.crm_contactos (subcuenta_id, nombre, telefono) values ((select id from public.subcuentas), 'X', '6a3') $q$, true);
select pg_temp.prueba('El comercial no puede crear contactos en otra subcuenta',
  $q$ insert into public.crm_contactos (subcuenta_id, nombre)
      select id, 'Intruso' from public.subcuentas where false
      union all select (select id from public.agencias limit 1), 'Intruso' $q$, true);
select pg_temp.prueba('El comercial no puede tocar ultima_actividad a mano',
  $q$ update public.crm_contactos set ultima_actividad = now() - interval '9 years' $q$, true);
select pg_temp.prueba('El comercial añade una nota',
  $q$ insert into public.crm_notas (subcuenta_id, contacto_id, cuerpo) select subcuenta_id, id, 'Llamar el lunes' from public.crm_contactos $q$, false);
select pg_temp.prueba('No puede firmar una nota en nombre de otro',
  $q$ insert into public.crm_notas (subcuenta_id, contacto_id, cuerpo, autor_id)
      select subcuenta_id, id, 'falsa', (select id from ids where email = 'duena@crm.test') from public.crm_contactos $q$, true);
select pg_temp.prueba('Tarea asignada a sí mismo',
  $q$ insert into public.crm_tareas (subcuenta_id, contacto_id, titulo, asignado_id)
      select subcuenta_id, id, 'Enviar propuesta', auth.uid() from public.crm_contactos $q$, false);
select pg_temp.prueba('No se puede asignar una tarea a alguien sin acceso',
  $q$ insert into public.crm_tareas (subcuenta_id, titulo, asignado_id)
      select id, 'x', (select id from ids where email = 'ajena@crm.test') from public.subcuentas $q$, true);
select pg_temp.prueba('El comercial completa la tarea',
  $q$ update public.crm_tareas set completada = now() $q$, false);
select pg_temp.prueba('El comercial crea una oportunidad en la 1.ª etapa',
  $q$ insert into public.crm_oportunidades (subcuenta_id, embudo_id, etapa_id, contacto_id, nombre, valor)
      select c.subcuenta_id, e.embudo_id, e.id, c.id, 'Implantación', 1500
      from public.crm_contactos c join public.crm_etapas e on e.subcuenta_id = c.subcuenta_id and e.orden = 1 $q$, false);
select pg_temp.prueba('Mover a la etapa 3',
  $q$ select public.crm_mover_oportunidad((select id from public.crm_oportunidades),
        (select id from public.crm_etapas where orden = 3), 1) $q$, false);
select pg_temp.prueba('No se puede mover a una etapa de otro embudo',
  $q$ select public.crm_mover_oportunidad((select id from public.crm_oportunidades), gen_random_uuid(), 1) $q$, true);
select pg_temp.prueba('Marcar como ganada',
  $q$ update public.crm_oportunidades set estado = 'ganada' $q$, false);
select pg_temp.igual('cerrada_en se rellena', (select (cerrada_en is not null)::text from public.crm_oportunidades), 'true');
select pg_temp.igual('La línea de tiempo tiene 6 eventos (alta, nota, tarea x2, oportunidad x3 = 7)',
  (select count(*)::text from public.crm_eventos), '7');
select pg_temp.igual('La última actividad está al día',
  (select (ultima_actividad > now() - interval '1 minute')::text from public.crm_contactos), 'true');
select pg_temp.prueba('El comercial no puede crear etapas',
  $q$ insert into public.crm_etapas (subcuenta_id, embudo_id, nombre) select subcuenta_id, id, 'Pirata' from public.crm_embudos $q$, true);
select pg_temp.prueba('El comercial no puede crear campos personalizados',
  $q$ insert into public.crm_campos (subcuenta_id, clave, nombre, tipo) select id, 'x', 'X', 'texto' from public.subcuentas $q$, true);
select pg_temp.igual('El comercial no puede borrar contactos (0 borrados)',
  (select public.crm_contactos_lote((select id from public.subcuentas), array(select id from public.crm_contactos), 'borrar')::text), '0');
select pg_temp.igual('…pero sí etiquetar en lote',
  (select public.crm_contactos_lote((select id from public.subcuentas), array(select id from public.crm_contactos), 'añadir_etiqueta', 'Cita')::text), '1');
select pg_temp.igual('Las acciones en lote quedan registradas', (select count(*)::text from public.crm_acciones_lote), '2');
select pg_temp.igual('El tablero cuenta 1 ganada',
  (select (public.crm_tablero((select id from public.subcuentas), now() - interval '1 day', now() + interval '1 day') -> 'estado' ->> 'ganada')), '1');
select pg_temp.igual('Ingresos ganados = 1500',
  (select (public.crm_tablero((select id from public.subcuentas), now() - interval '1 day', now() + interval '1 day') -> 'conversion' ->> 'ingresos_ganados')), '1500.00');
select pg_temp.igual('El embudo acumula: etapa 1 cuenta la oportunidad que está en la 3',
  (select (public.crm_tablero((select id from public.subcuentas), now() - interval '1 day', now() + interval '1 day', null,
     (select id from public.crm_embudos)) -> 'embudo' -> 0 ->> 'n')), '1');
select pg_temp.igual('El comercial ve la moneda de la agencia sin ver la agencia',
  (select public.moneda_subcuenta((select id from public.subcuentas))), 'EUR');
select pg_temp.prueba('El comercial guarda una lista privada',
  $q$ insert into public.crm_listas (subcuenta_id, nombre, compartida, filtros) select id, 'Mis VIP', false, '[{"campo":"etiquetas","op":"incluye","valor":"vip"}]' from public.subcuentas $q$, false);

-- --- dueña de la agencia -------------------------------------------------------
select pg_temp.entra_como('duena@crm.test');
select pg_temp.igual('La dueña no ve la lista privada del comercial', (select count(*)::text from public.crm_listas), '0');
select pg_temp.prueba('La dueña no puede editar la nota del comercial… sí, es admin',
  $q$ update public.crm_notas set cuerpo = 'Llamar el martes' $q$, false);
select pg_temp.prueba('La dueña crea un campo personalizado',
  $q$ insert into public.crm_campos (subcuenta_id, clave, nombre, tipo, opciones)
      select id, 'tipo_negocio', 'Tipo de negocio', 'lista', array['Clínica', 'Hotel'] from public.subcuentas where nombre = 'Clínica Norte' $q$, false);
select pg_temp.prueba('Campo de lista sin opciones se rechaza',
  $q$ insert into public.crm_campos (subcuenta_id, clave, nombre, tipo) select id, 'malo', 'Malo', 'lista' from public.subcuentas where nombre = 'Clínica Norte' $q$, true);
select pg_temp.prueba('No se puede colgar una oportunidad de un contacto de otra subcuenta',
  $q$ insert into public.crm_oportunidades (subcuenta_id, embudo_id, etapa_id, contacto_id, nombre)
      select e.subcuenta_id, e.embudo_id, e.id, (select id from public.crm_contactos limit 1), 'Cruzada'
      from public.crm_etapas e join public.subcuentas s on s.id = e.subcuenta_id where s.nombre = 'Hotel Sur' and e.orden = 1 $q$, true);
select pg_temp.prueba('Borrar la etapa 3 sin destino falla (tiene una oportunidad)',
  $q$ select public.crm_borrar_etapa((select e.id from public.crm_etapas e join public.subcuentas s on s.id = e.subcuenta_id
        where s.nombre = 'Clínica Norte' and e.orden = 3), null) $q$, true);
select pg_temp.prueba('Borrar la etapa 3 moviendo sus oportunidades a la 2',
  $q$ select public.crm_borrar_etapa(
        (select e.id from public.crm_etapas e join public.subcuentas s on s.id = e.subcuenta_id where s.nombre = 'Clínica Norte' and e.orden = 3),
        (select e.id from public.crm_etapas e join public.subcuentas s on s.id = e.subcuenta_id where s.nombre = 'Clínica Norte' and e.orden = 2)) $q$, false);
select pg_temp.igual('La oportunidad está ahora en la etapa 2',
  (select e.orden::text from public.crm_oportunidades o join public.crm_etapas e on e.id = o.etapa_id), '2');
select pg_temp.igual('Asignables incluye a la dueña y al comercial',
  (select count(*)::text from public.usuarios_asignables((select id from public.subcuentas where nombre = 'Clínica Norte'))), '2');
select pg_temp.igual('La dueña borra en lote',
  (select public.crm_contactos_lote((select id from public.subcuentas where nombre = 'Clínica Norte'), array(select id from public.crm_contactos), 'borrar')::text), '1');
select pg_temp.igual('Al borrar el contacto caen sus notas, tareas, oportunidades y eventos',
  (select (select count(*) from public.crm_notas) + (select count(*) from public.crm_tareas)
        + (select count(*) from public.crm_oportunidades) + (select count(*) from public.crm_eventos))::text, '0');

-- --- ajena ----------------------------------------------------------------------
select pg_temp.entra_como('ajena@crm.test');
select pg_temp.igual('Una persona ajena no ve embudos', (select count(*)::text from public.crm_embudos), '0');
select pg_temp.igual('Una persona ajena no obtiene la moneda',
  (select public.moneda_subcuenta((select s.id from public.agencias a, public.subcuentas s limit 1))), null);
select pg_temp.prueba('Una persona ajena no ve el tablero',
  $q$ select public.crm_tablero((select s.id from public.agencias a, public.subcuentas s limit 1), now() - interval '1 day', now()) $q$, true);
reset role;
create temp table sub_ajena as select id from public.subcuentas limit 1;
grant select on sub_ajena to authenticated;
set role authenticated;
select pg_temp.prueba('…ni pasándole el id real de la subcuenta',
  $q$ select public.crm_tablero((select id from sub_ajena), now() - interval '1 day', now()) $q$, true);
select pg_temp.prueba('…ni puede crear contactos en ella con el id real',
  $q$ insert into public.crm_contactos (subcuenta_id, nombre) select id, 'Intrusa' from sub_ajena $q$, true);

reset role;
delete from public.agencias;

-- --- borrar campo personalizado -------------------------------------------------
set role authenticated;
select pg_temp.entra_como('duena@crm.test');
select public.crear_agencia('Agencia Campos');
insert into public.subcuentas (agencia_id, nombre) select id, 'Con campos' from public.agencias;
insert into public.crm_campos (subcuenta_id, clave, nombre, tipo) select id, 'color', 'Color', 'texto' from public.subcuentas;
insert into public.crm_contactos (subcuenta_id, nombre, campos) select id, 'Ana', '{"color":"rojo","otro":"x"}' from public.subcuentas;
select pg_temp.prueba('La dueña borra el campo', $q$ select public.crm_borrar_campo((select id from public.crm_campos)) $q$, false);
select pg_temp.igual('El valor desaparece del contacto y el resto se queda',
  (select campos::text from public.crm_contactos), '{"otro": "x"}');
reset role;
delete from public.agencias;
