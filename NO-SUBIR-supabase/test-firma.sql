-- =============================================================================
-- Pruebas del circuito de firma (05-firma-contratos.sql) contra un Postgres
-- local con el stub de auth. Comprueban lo que de verdad importa: que sin
-- token no hay nada que ver, que el enlace solo sirve una vez, y que un
-- cliente sin cuenta no puede tocar la tabla de contratos.
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

create or replace function pg_temp.sal() returns void
language plpgsql as $$ begin delete from auth._sesion; end $$;

create or replace function pg_temp.dice(etiqueta text, condicion boolean, detalle text default '')
returns void language plpgsql as $$
begin
  raise notice '%  %', case when condicion then '[OK]  ' else '[FALLO]' end,
    rpad(etiqueta, 44) || detalle;
end $$;

create or replace function pg_temp.falla(etiqueta text, sentencia text)
returns void language plpgsql as $$
declare fallo text := null;
begin
  begin execute sentencia; exception when others then fallo := SQLERRM; end;
  raise notice '%  %', case when fallo is not null then '[OK]  ' else '[FALLO]' end,
    rpad(etiqueta, 44) || coalesce(split_part(fallo, E'\n', 1), '(no dio error)');
end $$;

-- --- personajes --------------------------------------------------------------
insert into auth.users (id, email) values
  (gen_random_uuid(), 'carlos.gestor@labs24k.com'),
  (gen_random_uuid(), 'ana.jefa@labs24k.com'),
  (gen_random_uuid(), 'luis.otro@labs24k.com')
on conflict (email) do nothing;

insert into public.perfiles (id, nombre, apellidos, email, rol, rel, permisos)
select u.id, 'Carlos', 'Ruiz', u.email, 'commercial', '0-100-001',
       public.permisos_de_rol('commercial')
from auth.users u where u.email = 'carlos.gestor@labs24k.com' on conflict (id) do nothing;

insert into public.perfiles (id, nombre, apellidos, email, rol, rel, permisos)
select u.id, 'Ana', 'Serra', u.email, 'admin', '0-100-002',
       public.permisos_de_rol('admin')
from auth.users u where u.email = 'ana.jefa@labs24k.com' on conflict (id) do nothing;

insert into public.perfiles (id, nombre, apellidos, email, rol, rel, permisos)
select u.id, 'Luis', 'Vega', u.email, 'commercial', '0-100-003',
       public.permisos_de_rol('commercial')
from auth.users u where u.email = 'luis.otro@labs24k.com' on conflict (id) do nothing;

-- --- un contrato de Carlos ---------------------------------------------------
insert into public.contratos (codigo, cliente, cif, servicio, setup, iva, gestor_id)
select 'C-TEST-001', 'Inmobiliaria de Prueba SL', 'B99999999',
       'Embudo 24/7', 4200, 21, p.id
from public.perfiles p where p.email = 'carlos.gestor@labs24k.com'
on conflict (codigo) do nothing;

\echo ''
\echo '=== 1 · QUIÉN PUEDE EMITIR EL ENLACE ==='

select pg_temp.sal();
select pg_temp.falla('Sin sesión no se emite enlace',
  $$select public.nuevo_enlace_firma('C-TEST-001')$$);

select pg_temp.entra_como('luis.otro@labs24k.com');
select pg_temp.falla('Otro comercial no puede emitirlo',
  $$select public.nuevo_enlace_firma('C-TEST-001')$$);

select pg_temp.entra_como('carlos.gestor@labs24k.com');
select pg_temp.dice('El gestor del contrato sí puede',
  (select count(*) = 1 from public.nuevo_enlace_firma('C-TEST-001')));

select pg_temp.entra_como('ana.jefa@labs24k.com');
select pg_temp.dice('La dirección también',
  (select count(*) = 1 from public.nuevo_enlace_firma('C-TEST-001')));

select pg_temp.falla('Un contrato que no existe da error',
  $$select public.nuevo_enlace_firma('C-NO-EXISTE')$$);

select pg_temp.dice('El contrato pasa a «Enviado»',
  (select estado = 'Enviado' from public.contratos where codigo = 'C-TEST-001'),
  (select estado::text from public.contratos where codigo = 'C-TEST-001'));

select pg_temp.dice('Queda registrado quién lo emitió',
  (select count(*) >= 1 from public.firma_eventos e
    join public.contratos c on c.id = e.contrato_id
   where c.codigo = 'C-TEST-001' and e.evento = 'emitido'));

\echo ''
\echo '=== 2 · LO QUE VE EL CLIENTE (sin cuenta) ==='

-- Guardamos el token vigente para usarlo como lo haría el cliente.
create temp table tk as select token from public.contratos where codigo = 'C-TEST-001';

select pg_temp.sal();   -- el cliente NO ha iniciado sesión

select pg_temp.dice('Token inventado: no revela nada',
  (public.contrato_para_firma('00000000-0000-4000-8000-000000000000') ->> 'error') = 'no-existe');

select pg_temp.dice('Sin token: tampoco',
  (public.contrato_para_firma(null) ->> 'error') = 'sin-token');

select pg_temp.dice('Con su token ve su contrato',
  (select public.contrato_para_firma(token) ->> 'cliente' from tk) = 'Inmobiliaria de Prueba SL');

select pg_temp.dice('Y el importe base',
  (select (public.contrato_para_firma(token) ->> 'base')::numeric from tk) = 4200);

select pg_temp.dice('No se le cuela el gestor ni el expediente',
  (select not (public.contrato_para_firma(token) ? 'gestor_id')
          and not (public.contrato_para_firma(token) ? 'expediente_id') from tk));

select pg_temp.dice('Se anota que ha abierto el enlace',
  (select count(*) >= 1 from public.firma_eventos where evento = 'abierto'));

\echo ''
\echo '=== 3 · LA FIRMA ==='

select pg_temp.dice('Nombre demasiado corto: rechazado',
  (select public.firma_contrato(token, 'Al', '10998877Z',
     'data:image/png;base64,iVBORw0KGgo=') ->> 'error' from tk) = 'falta-nombre');

select pg_temp.dice('DNI incompleto: rechazado',
  (select public.firma_contrato(token, 'Alberto G. Morán', '109',
     'data:image/png;base64,iVBORw0KGgo=') ->> 'error' from tk) = 'falta-dni');

select pg_temp.dice('Firma que no es un PNG: rechazada',
  (select public.firma_contrato(token, 'Alberto G. Morán', '10998877Z',
     'javascript:alert(1)') ->> 'error' from tk) = 'falta-firma');

select pg_temp.dice('Firma enorme: rechazada',
  (select public.firma_contrato(token, 'Alberto G. Morán', '10998877Z',
     'data:image/png;base64,' || repeat('A', 400001)) ->> 'error' from tk)
  = 'firma-demasiado-grande');

select pg_temp.dice('Firma correcta: aceptada',
  (select (public.firma_contrato(token, 'Alberto G. Morán', '10998877z',
     'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', 'abc123'))
     ->> 'ok' from tk) = 'true');

select pg_temp.dice('El contrato queda «Firmado»',
  (select estado = 'Firmado' from public.contratos where codigo = 'C-TEST-001'));

select pg_temp.dice('Se guarda la fecha y hora',
  (select firmado_ts is not null and firmado_el is not null
     from public.contratos where codigo = 'C-TEST-001'));

select pg_temp.dice('El DNI se guarda en mayúsculas',
  (select firma_dni = '10998877Z' from public.contratos where codigo = 'C-TEST-001'),
  (select coalesce(firma_dni,'(nulo)') from public.contratos where codigo = 'C-TEST-001'));

select pg_temp.dice('Se guarda la huella del texto firmado',
  (select firma_huella = 'abc123' from public.contratos where codigo = 'C-TEST-001'));

select pg_temp.dice('El enlace es de un solo uso',
  (select public.firma_contrato(token, 'Otra Persona Distinta', '99887766K',
     'data:image/png;base64,iVBORw0KGgo=') ->> 'error' from tk) = 'ya-firmado');

select pg_temp.dice('Y al reabrirlo lo dice',
  (select public.contrato_para_firma(token) ->> 'error' from tk) = 'ya-firmado');

\echo ''
\echo '=== 4 · CADUCIDAD ==='

insert into public.contratos (codigo, cliente, servicio, setup, gestor_id)
select 'C-TEST-002', 'Cliente Caducado SL', 'Embudo 24/7', 1000, p.id
from public.perfiles p where p.email = 'carlos.gestor@labs24k.com'
on conflict (codigo) do nothing;

select pg_temp.entra_como('carlos.gestor@labs24k.com');
select public.nuevo_enlace_firma('C-TEST-002');
update public.contratos set token_expira = now() - interval '1 day' where codigo = 'C-TEST-002';
select pg_temp.sal();

select pg_temp.dice('Un enlace caducado no deja ver',
  (select public.contrato_para_firma(token) ->> 'error'
     from public.contratos where codigo = 'C-TEST-002') = 'caducado');
select pg_temp.dice('Ni firmar',
  (select public.firma_contrato(token, 'Alberto G. Morán', '10998877Z',
     'data:image/png;base64,iVBORw0KGgo=') ->> 'error'
     from public.contratos where codigo = 'C-TEST-002') = 'caducado');

\echo ''
\echo '=== 5 · LO QUE «anon» NO PUEDE HACER ==='

select pg_temp.dice('anon no tiene permisos sobre contratos',
  not has_table_privilege('anon', 'public.contratos', 'select'));
select pg_temp.dice('anon no puede leer el rastro de firmas',
  not has_table_privilege('anon', 'public.firma_eventos', 'select'));
select pg_temp.dice('anon no puede emitir enlaces',
  not has_function_privilege('anon', 'public.nuevo_enlace_firma(text,int)', 'execute'));
select pg_temp.dice('anon sí puede leer con su token',
  has_function_privilege('anon', 'public.contrato_para_firma(uuid)', 'execute'));
select pg_temp.dice('anon sí puede firmar',
  has_function_privilege('anon', 'public.firma_contrato(uuid,text,text,text,text,jsonb)', 'execute'));
select pg_temp.dice('firma_eventos no se puede editar desde el panel',
  (select count(*) = 1 from pg_policies
    where schemaname='public' and tablename='firma_eventos'),
  (select string_agg(cmd, ', ') from pg_policies
    where schemaname='public' and tablename='firma_eventos'));
select pg_temp.dice('Las tres funciones fijan search_path',
  (select count(*) = 3 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('nuevo_enlace_firma','contrato_para_firma','firma_contrato')
      and array_to_string(p.proconfig, ',') like '%search_path%'));

\echo ''
\echo '=== 6 · EL RANKING SIGUE CUADRANDO ==='
select pg_temp.dice('El contrato firmado suma en el ranking',
  (select volumen from public.ranking_red
    where distribuidor_id = (select id from public.perfiles
                              where email='carlos.gestor@labs24k.com')) = 4200,
  (select coalesce(volumen::text,'(nada)') from public.ranking_red
    where distribuidor_id = (select id from public.perfiles
                              where email='carlos.gestor@labs24k.com')));
