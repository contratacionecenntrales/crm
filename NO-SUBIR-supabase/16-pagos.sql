-- =============================================================================
-- 16 · PAGOS DE LA SUBCUENTA: PRODUCTOS, FACTURAS, COBROS Y STRIPE
--
-- Requiere 09, 10 y 13. Idempotente.
--
--   · Cada subcuenta cobra con SU cuenta de Stripe (clave secreta y secreto
--     del webhook en pag_secretos, que solo lee el servidor).
--   · La factura se numera sola (prefijo + contador, sin huecos ni
--     repeticiones) y sus totales los calcula la base de datos a partir de
--     las líneas: nadie puede guardar un total que no cuadre.
--   · El cliente paga desde /factura/<token> (Stripe Checkout). El webhook
--     registra el cobro con pag_registrar_pago_stripe() y la factura pasa sola
--     a «pagada» cuando lo cobrado cubre el total.
-- =============================================================================

create table if not exists public.pag_ajustes (
  subcuenta_id     uuid primary key references public.subcuentas(id) on delete cascade,
  moneda           text not null default 'EUR' check (moneda ~ '^[A-Z]{3}$'),
  prefijo          text not null default 'FAC-' check (length(prefijo) <= 12 and prefijo ~ '^[A-Za-z0-9/_-]*$'),
  siguiente_numero int not null default 1 check (siguiente_numero between 1 and 99999999),
  impuesto_defecto numeric(5,2) not null default 21 check (impuesto_defecto between 0 and 100),
  pie              text not null default '' check (length(pie) <= 2000),
  actualizado      timestamptz not null default now()
);

create table if not exists public.pag_secretos (
  subcuenta_id   uuid primary key references public.subcuentas(id) on delete cascade,
  stripe_secreta text not null default '',
  stripe_webhook text not null default '',
  actualizado    timestamptz not null default now()
);

create table if not exists public.pag_productos (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) between 1 and 200),
  descripcion  text not null default '' check (length(descripcion) <= 2000),
  precio       numeric(12,2) not null check (precio >= 0),
  impuesto     numeric(5,2) not null default 21 check (impuesto between 0 and 100),
  activo       boolean not null default true,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);
create index if not exists pag_productos_sub_idx on public.pag_productos(subcuenta_id, nombre);

create table if not exists public.pag_facturas (
  id                uuid primary key default gen_random_uuid(),
  subcuenta_id      uuid not null references public.subcuentas(id) on delete cascade,
  numero            text not null default '',
  contacto_id       uuid,
  estado            text not null default 'borrador' check (estado in ('borrador', 'enviada', 'pagada', 'anulada')),
  moneda            text not null default 'EUR' check (moneda ~ '^[A-Z]{3}$'),
  emision           date not null default current_date,
  vencimiento       date,
  notas             text not null default '' check (length(notas) <= 5000),
  subtotal          numeric(14,2) not null default 0,
  impuestos         numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  cobrado           numeric(14,2) not null default 0,
  token             uuid not null default gen_random_uuid(),
  enviada_en        timestamptz,
  pagada_en         timestamptz,
  creado_por        uuid default auth.uid() references auth.users(id) on delete set null,
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now(),
  unique (id, subcuenta_id),
  check (vencimiento is null or vencimiento >= emision),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete set null (contacto_id)
);
create unique index if not exists pag_facturas_numero_uidx on public.pag_facturas(subcuenta_id, numero);
create unique index if not exists pag_facturas_token_uidx on public.pag_facturas(token);
create index if not exists pag_facturas_sub_idx on public.pag_facturas(subcuenta_id, emision desc);
create index if not exists pag_facturas_contacto_idx on public.pag_facturas(contacto_id);

create table if not exists public.pag_lineas (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null,
  factura_id   uuid not null,
  producto_id  uuid references public.pag_productos(id) on delete set null,
  descripcion  text not null check (length(trim(descripcion)) between 1 and 500),
  cantidad     numeric(12,2) not null check (cantidad > 0 and cantidad <= 1000000),
  precio       numeric(12,2) not null check (precio >= 0),
  impuesto     numeric(5,2) not null default 0 check (impuesto between 0 and 100),
  orden        int not null default 0,
  foreign key (factura_id, subcuenta_id) references public.pag_facturas(id, subcuenta_id) on delete cascade
);
create index if not exists pag_lineas_factura_idx on public.pag_lineas(factura_id, orden);

create table if not exists public.pag_transacciones (
  id           uuid primary key default gen_random_uuid(),
  subcuenta_id uuid not null references public.subcuentas(id) on delete cascade,
  factura_id   uuid,
  contacto_id  uuid,
  importe      numeric(14,2) not null check (importe > 0),
  moneda       text not null check (moneda ~ '^[A-Z]{3}$'),
  metodo       text not null check (metodo in ('stripe', 'efectivo', 'transferencia', 'tarjeta', 'bizum', 'otro')),
  referencia   text not null default '' check (length(referencia) <= 200),
  estado       text not null default 'completada' check (estado in ('completada', 'reembolsada')),
  notas        text not null default '' check (length(notas) <= 1000),
  fecha        timestamptz not null default now(),
  creado_por   uuid default auth.uid() references auth.users(id) on delete set null,
  foreign key (factura_id, subcuenta_id) references public.pag_facturas(id, subcuenta_id) on delete set null (factura_id),
  foreign key (contacto_id, subcuenta_id) references public.crm_contactos(id, subcuenta_id) on delete set null (contacto_id)
);
create index if not exists pag_transacciones_sub_idx on public.pag_transacciones(subcuenta_id, fecha desc);
create unique index if not exists pag_transacciones_ref_uidx on public.pag_transacciones(subcuenta_id, referencia) where metodo = 'stripe' and referencia <> '';

-- =============================================================================
-- DISPARADORES
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['pag_ajustes', 'pag_productos', 'pag_facturas'] loop
    execute format('drop trigger if exists %1$s_actualizado on public.%1$s', t);
    execute format('create trigger %1$s_actualizado before update on public.%1$s for each row execute function public.toca_actualizado()', t);
  end loop;
end $$;

-- Número de factura al crearla: prefijo + contador de la subcuenta.
-- El UPDATE … RETURNING bloquea la fila de ajustes: dos facturas a la vez
-- nunca reciben el mismo número.
create or replace function public.pag_numerar_factura()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.pag_ajustes;
begin
  insert into public.pag_ajustes (subcuenta_id) values (new.subcuenta_id) on conflict do nothing;
  update public.pag_ajustes set siguiente_numero = siguiente_numero + 1
  where subcuenta_id = new.subcuenta_id returning * into a;
  new.numero := a.prefijo || lpad((a.siguiente_numero - 1)::text, 4, '0');
  new.moneda := a.moneda;
  new.subtotal := 0; new.impuestos := 0; new.total := 0; new.cobrado := 0;
  new.pagada_en := null; new.enviada_en := null;
  if new.estado not in ('borrador', 'enviada') then new.estado := 'borrador'; end if;
  return new;
end $$;
drop trigger if exists pag_facturas_numero on public.pag_facturas;
create trigger pag_facturas_numero before insert on public.pag_facturas
  for each row execute function public.pag_numerar_factura();

-- Cambios de estado permitidos y sellos de fecha.
create or replace function public.pag_estado_factura()
returns trigger language plpgsql as $$
begin
  if new.estado is distinct from old.estado then
    if old.estado = 'anulada' then
      raise exception 'Una factura anulada no se puede reabrir.' using errcode = 'check_violation';
    end if;
    if old.estado = 'pagada' and new.estado <> 'anulada' and new.cobrado >= new.total and new.total > 0 then
      raise exception 'La factura ya está pagada.' using errcode = 'check_violation';
    end if;
    if new.estado = 'pagada' and (new.total <= 0 or new.cobrado < new.total) then
      raise exception 'Registra el cobro para marcar la factura como pagada.' using errcode = 'check_violation';
    end if;
    if new.estado = 'enviada' and new.enviada_en is null then new.enviada_en := now(); end if;
    if new.estado = 'pagada' and new.pagada_en is null then new.pagada_en := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists pag_facturas_estado on public.pag_facturas;
create trigger pag_facturas_estado before update on public.pag_facturas
  for each row execute function public.pag_estado_factura();

-- Las líneas solo se tocan en facturas sin pagar ni anular; los totales se
-- recalculan siempre aquí.
create or replace function public.pag_recalcular()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_factura uuid := coalesce(new.factura_id, old.factura_id);
  v_estado text;
begin
  -- Borrado en cascada (se borra la factura o la subcuenta): nada que comprobar.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return null; end if;
  select estado into v_estado from public.pag_facturas where id = v_factura;
  if v_estado in ('pagada', 'anulada') then
    raise exception 'No se pueden cambiar las líneas de una factura %.', v_estado using errcode = 'check_violation';
  end if;
  update public.pag_facturas f set
    subtotal = coalesce(s.sub, 0), impuestos = coalesce(s.imp, 0), total = coalesce(s.sub, 0) + coalesce(s.imp, 0)
  from (select round(sum(cantidad * precio), 2) as sub, round(sum(round(cantidad * precio * impuesto / 100, 2)), 2) as imp
        from public.pag_lineas where factura_id = v_factura) s
  where f.id = v_factura;
  return null;
end $$;
drop trigger if exists pag_lineas_recalcula on public.pag_lineas;
create trigger pag_lineas_recalcula after insert or update or delete on public.pag_lineas
  for each row execute function public.pag_recalcular();

-- Un cobro suma a lo cobrado de su factura; si la cubre, la marca pagada y
-- lo anota en la ficha del contacto.
create or replace function public.pag_aplicar_cobro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f public.pag_facturas;
  v_factura uuid := coalesce(new.factura_id, old.factura_id);
begin
  if v_factura is null then return null; end if;
  update public.pag_facturas x set cobrado = coalesce((select sum(importe) from public.pag_transacciones
                                                       where factura_id = v_factura and estado = 'completada'), 0)
  where x.id = v_factura returning * into f;
  if f.estado in ('borrador', 'enviada') and f.total > 0 and f.cobrado >= f.total then
    update public.pag_facturas set estado = 'pagada' where id = f.id;
    if f.contacto_id is not null then
      insert into public.crm_eventos (subcuenta_id, contacto_id, tipo, detalle, actor_id)
      values (f.subcuenta_id, f.contacto_id, 'factura_pagada',
              jsonb_build_object('factura_id', f.id, 'numero', f.numero, 'total', f.total, 'moneda', f.moneda), auth.uid());
    end if;
    if f.creado_por is not null and f.creado_por is distinct from auth.uid() then
      insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
      select f.creado_por, s.agencia_id, s.id, 'alerta', 'Pagos', 'Factura pagada: ' || f.numero,
             to_char(f.total, 'FM999G999G990D00') || ' ' || f.moneda, '/subcuenta/' || s.id || '/pagos/facturas/' || f.id
      from public.subcuentas s where s.id = f.subcuenta_id;
    end if;
  elsif f.estado = 'pagada' and f.cobrado < f.total then
    -- Un reembolso deja la factura otra vez pendiente.
    update public.pag_facturas set estado = 'enviada', pagada_en = null where id = f.id;
  end if;
  return null;
end $$;
drop trigger if exists pag_transacciones_aplica on public.pag_transacciones;
create trigger pag_transacciones_aplica after insert or update of estado, importe, factura_id or delete on public.pag_transacciones
  for each row execute function public.pag_aplicar_cobro();

-- =============================================================================
-- RLS
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['pag_ajustes', 'pag_secretos', 'pag_productos', 'pag_facturas', 'pag_lineas', 'pag_transacciones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  foreach t in array array['pag_ajustes', 'pag_productos', 'pag_facturas', 'pag_lineas', 'pag_transacciones'] loop
    execute format('drop policy if exists %1$s_lee on public.%1$s', t);
    execute format('create policy %1$s_lee on public.%1$s for select to authenticated using (public.puedo_ver_subcuenta(subcuenta_id))', t);
  end loop;
  -- Trabajo diario: todo el equipo.
  foreach t in array array['pag_productos', 'pag_facturas', 'pag_lineas'] loop
    execute format('drop policy if exists %1$s_escribe on public.%1$s', t);
    execute format('create policy %1$s_escribe on public.%1$s for all to authenticated
                    using (public.puedo_ver_subcuenta(subcuenta_id)) with check (public.puedo_ver_subcuenta(subcuenta_id))', t);
  end loop;
end $$;

drop policy if exists pag_ajustes_admin on public.pag_ajustes;
create policy pag_ajustes_admin on public.pag_ajustes for all to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
-- Cobros manuales: los registra el equipo; anular/borrar, solo administradores.
drop policy if exists pag_transacciones_alta on public.pag_transacciones;
create policy pag_transacciones_alta on public.pag_transacciones for insert to authenticated
  with check (public.puedo_ver_subcuenta(subcuenta_id) and metodo <> 'stripe');
drop policy if exists pag_transacciones_admin on public.pag_transacciones;
create policy pag_transacciones_admin on public.pag_transacciones for update to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id)) with check (public.soy_admin_subcuenta(subcuenta_id));
drop policy if exists pag_transacciones_borra on public.pag_transacciones;
create policy pag_transacciones_borra on public.pag_transacciones for delete to authenticated
  using (public.soy_admin_subcuenta(subcuenta_id) and metodo <> 'stripe');

grant select, insert, update on public.pag_ajustes to authenticated;
grant select, insert, update, delete on public.pag_productos, public.pag_lineas to authenticated;
grant select, delete on public.pag_facturas to authenticated;
grant insert (subcuenta_id, contacto_id, moneda, emision, vencimiento, notas, estado) on public.pag_facturas to authenticated;
grant update (contacto_id, emision, vencimiento, notas, estado) on public.pag_facturas to authenticated;
grant select, delete on public.pag_transacciones to authenticated;
grant insert (subcuenta_id, factura_id, contacto_id, importe, moneda, metodo, referencia, notas, fecha) on public.pag_transacciones to authenticated;
grant update (estado, notas) on public.pag_transacciones to authenticated;

-- Una factura solo se borra en borrador (después se anula).
drop policy if exists pag_facturas_borra on public.pag_facturas;
create policy pag_facturas_borra on public.pag_facturas as restrictive for delete to authenticated using (estado = 'borrador');

-- =============================================================================
-- FUNCIONES
-- =============================================================================
create or replace function public.pag_guardar_secretos(p_subcuenta uuid, p_secreta text, p_webhook text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.soy_admin_subcuenta(p_subcuenta) then
    raise exception 'Solo un administrador puede cambiar las claves.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_secreta, '') <> '' and p_secreta !~ '^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$' then
    raise exception 'La clave de Stripe empieza por sk_live_, sk_test_ o rk_….' using errcode = 'check_violation';
  end if;
  if coalesce(p_webhook, '') <> '' and p_webhook !~ '^whsec_[A-Za-z0-9]{10,}$' then
    raise exception 'El secreto del webhook empieza por whsec_….' using errcode = 'check_violation';
  end if;
  insert into public.pag_secretos (subcuenta_id) values (p_subcuenta) on conflict do nothing;
  update public.pag_secretos set
    stripe_secreta = case when p_secreta is null then '' when p_secreta = '' then stripe_secreta else p_secreta end,
    stripe_webhook = case when p_webhook is null then '' when p_webhook = '' then stripe_webhook else p_webhook end,
    actualizado = now()
  where subcuenta_id = p_subcuenta;
end $$;

create or replace function public.pag_estado_secretos(p_subcuenta uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object('stripe_secreta', stripe_secreta <> '', 'stripe_webhook', stripe_webhook <> '',
                            'modo', case when stripe_secreta like '%\_test\_%' then 'prueba' when stripe_secreta <> '' then 'real' end)
  into r from public.pag_secretos where subcuenta_id = p_subcuenta;
  return coalesce(r, '{"stripe_secreta":false,"stripe_webhook":false}'::jsonb);
end $$;

-- Página pública de la factura (enlace con token).
create or replace function public.pag_factura_publica(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'numero', f.numero, 'estado', f.estado, 'moneda', f.moneda, 'emision', f.emision, 'vencimiento', f.vencimiento,
    'notas', f.notas, 'subtotal', f.subtotal, 'impuestos', f.impuestos, 'total', f.total, 'cobrado', f.cobrado,
    'pagada_en', f.pagada_en,
    'empresa', jsonb_build_object('nombre', s.nombre, 'email', s.email, 'telefono', case when s.telefono <> '' then s.prefijo || ' ' || s.telefono end,
                                  'direccion', concat_ws(', ', nullif(s.direccion, ''), nullif(s.codigo_postal, ''), nullif(s.ciudad, ''), nullif(s.provincia, '')),
                                  'logo_url', s.logo_url),
    'cliente', case when c.id is null then null else jsonb_build_object('nombre', trim(c.nombre || ' ' || c.apellidos), 'email', c.email,
                    'direccion', concat_ws(', ', nullif(c.direccion, ''), nullif(c.codigo_postal, ''), nullif(c.ciudad, ''))) end,
    'pie', coalesce(a.pie, ''),
    'lineas', coalesce((select jsonb_agg(jsonb_build_object('descripcion', l.descripcion, 'cantidad', l.cantidad, 'precio', l.precio, 'impuesto', l.impuesto) order by l.orden)
                        from public.pag_lineas l where l.factura_id = f.id), '[]'::jsonb),
    'cobro_online', exists (select 1 from public.pag_secretos x where x.subcuenta_id = f.subcuenta_id and x.stripe_secreta <> ''))
  from public.pag_facturas f
  join public.subcuentas s on s.id = f.subcuenta_id
  left join public.crm_contactos c on c.id = f.contacto_id
  left join public.pag_ajustes a on a.subcuenta_id = f.subcuenta_id
  where f.token = p_token and f.estado <> 'borrador';
$$;

-- Cobro confirmado por Stripe (lo llama el webhook con la clave de servicio).
-- Idempotente por la referencia del pago.
create or replace function public.pag_registrar_pago_stripe(p_subcuenta uuid, p_factura uuid, p_importe numeric, p_moneda text, p_referencia text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  f public.pag_facturas;
  v uuid;
begin
  select id into v from public.pag_transacciones where subcuenta_id = p_subcuenta and metodo = 'stripe' and referencia = p_referencia;
  if v is not null then return v; end if;
  select * into f from public.pag_facturas where id = p_factura and subcuenta_id = p_subcuenta;
  if not found then raise exception 'Factura no encontrada.' using errcode = 'no_data_found'; end if;
  insert into public.pag_transacciones (subcuenta_id, factura_id, contacto_id, importe, moneda, metodo, referencia, creado_por)
  values (p_subcuenta, f.id, f.contacto_id, p_importe, upper(p_moneda), 'stripe', p_referencia, null)
  returning id into v;
  return v;
end $$;

revoke all on function public.pag_guardar_secretos(uuid, text, text) from public, anon;
revoke all on function public.pag_estado_secretos(uuid) from public, anon;
revoke all on function public.pag_factura_publica(uuid) from public;
revoke all on function public.pag_registrar_pago_stripe(uuid, uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.pag_guardar_secretos(uuid, text, text) to authenticated;
grant execute on function public.pag_estado_secretos(uuid) to authenticated;
grant execute on function public.pag_factura_publica(uuid) to anon, authenticated;
grant execute on function public.pag_registrar_pago_stripe(uuid, uuid, numeric, text, text) to service_role;

-- Sustituye todas las líneas de una factura en una sola transacción
-- (permisos de quien llama: RLS manda).
create or replace function public.pag_guardar_lineas(p_factura uuid, p_lineas jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_sub uuid;
  v_n int;
begin
  select subcuenta_id into v_sub from public.pag_facturas where id = p_factura;
  if v_sub is null then raise exception 'Factura no encontrada.' using errcode = 'no_data_found'; end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) > 200 then
    raise exception 'Líneas no válidas (máximo 200).' using errcode = 'check_violation';
  end if;
  delete from public.pag_lineas where factura_id = p_factura;
  insert into public.pag_lineas (subcuenta_id, factura_id, producto_id, descripcion, cantidad, precio, impuesto, orden)
  select v_sub, p_factura, nullif(e ->> 'producto_id', '')::uuid, e ->> 'descripcion', (e ->> 'cantidad')::numeric,
         (e ->> 'precio')::numeric, coalesce((e ->> 'impuesto')::numeric, 0), o::int
  from jsonb_array_elements(p_lineas) with ordinality as t(e, o);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.pag_guardar_lineas(uuid, jsonb) from public, anon;
grant execute on function public.pag_guardar_lineas(uuid, jsonb) to authenticated;

-- =============================================================================
-- CORRECCIONES DE LA AUDITORÍA
-- =============================================================================
alter table public.pag_facturas
  add column if not exists checkout_id text,
  add column if not exists checkout_url text,
  add column if not exists checkout_expira timestamptz;

-- Una factura emitida no vuelve a borrador (se anula), y no se marca pagada sin cobro.
create or replace function public.pag_estado_factura()
returns trigger language plpgsql as $$
begin
  if new.estado is distinct from old.estado then
    if old.estado = 'anulada' then
      raise exception 'Una factura anulada no se puede reabrir.' using errcode = 'check_violation';
    end if;
    if new.estado = 'borrador' then
      raise exception 'Una factura emitida no vuelve a borrador; anúlala y crea otra.' using errcode = 'check_violation';
    end if;
    if old.estado = 'pagada' and new.estado <> 'anulada' and new.cobrado >= new.total and new.total > 0 then
      raise exception 'La factura ya está pagada.' using errcode = 'check_violation';
    end if;
    if new.estado = 'pagada' and (new.total <= 0 or new.cobrado < new.total) then
      raise exception 'Registra el cobro para marcar la factura como pagada.' using errcode = 'check_violation';
    end if;
    if new.estado = 'enviada' and new.enviada_en is null then new.enviada_en := now(); end if;
    if new.estado = 'pagada' and new.pagada_en is null then new.pagada_en := now(); end if;
  end if;
  return new;
end $$;

-- Al cambiar las líneas, si lo cobrado ya cubre el nuevo total, queda pagada.
create or replace function public.pag_recalcular()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_factura uuid := coalesce(new.factura_id, old.factura_id);
  v_estado text;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return null; end if;
  select estado into v_estado from public.pag_facturas where id = v_factura;
  if v_estado in ('pagada', 'anulada') then
    raise exception 'No se pueden cambiar las líneas de una factura %.', v_estado using errcode = 'check_violation';
  end if;
  update public.pag_facturas f set
    subtotal = coalesce(s.sub, 0), impuestos = coalesce(s.imp, 0), total = coalesce(s.sub, 0) + coalesce(s.imp, 0)
  from (select round(sum(cantidad * precio), 2) as sub, round(sum(round(cantidad * precio * impuesto / 100, 2)), 2) as imp
        from public.pag_lineas where factura_id = v_factura) s
  where f.id = v_factura;
  update public.pag_facturas set estado = 'pagada'
  where id = v_factura and estado = 'enviada' and total > 0 and cobrado >= total;
  return null;
end $$;

-- El contador de facturas no retrocede (evita números repetidos).
create or replace function public.pag_contador_no_retrocede()
returns trigger language plpgsql as $$
begin
  if new.siguiente_numero < old.siguiente_numero then
    raise exception 'El siguiente número no puede ser menor que el actual (%).', old.siguiente_numero using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists pag_ajustes_contador on public.pag_ajustes;
create trigger pag_ajustes_contador before update of siguiente_numero on public.pag_ajustes
  for each row execute function public.pag_contador_no_retrocede();

-- Cobro de Stripe: se registra siempre (el dinero ya está cobrado), pero si
-- la factura estaba anulada o ya pagada, o el importe excede lo pendiente,
-- se avisa a quien la creó y a los administradores para revisarlo.
create or replace function public.pag_registrar_pago_stripe(p_subcuenta uuid, p_factura uuid, p_importe numeric, p_moneda text, p_referencia text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  f public.pag_facturas;
  v uuid;
  v_raro boolean;
begin
  select id into v from public.pag_transacciones where subcuenta_id = p_subcuenta and metodo = 'stripe' and referencia = p_referencia;
  if v is not null then return v; end if;
  select * into f from public.pag_facturas where id = p_factura and subcuenta_id = p_subcuenta for update;
  if not found then raise exception 'Factura no encontrada.' using errcode = 'no_data_found'; end if;
  v_raro := f.estado in ('pagada', 'anulada') or p_importe > f.total - f.cobrado + 0.005;
  insert into public.pag_transacciones (subcuenta_id, factura_id, contacto_id, importe, moneda, metodo, referencia, creado_por, notas)
  values (p_subcuenta, f.id, f.contacto_id, p_importe, upper(p_moneda), 'stripe', p_referencia, null,
          case when v_raro then 'Revisar: cobro sobre una factura ' || f.estado || ' o por encima de lo pendiente.' else '' end)
  returning id into v;
  update public.pag_facturas set checkout_id = null, checkout_url = null, checkout_expira = null where id = f.id;
  if v_raro then
    insert into public.notificaciones (usuario_id, agencia_id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace)
    select distinct u, s.agencia_id, s.id, 'alerta', 'Pagos', 'Revisar cobro de la factura ' || f.numero,
           'Stripe cobró ' || p_importe || ' ' || upper(p_moneda) || ' con la factura en estado «' || f.estado || '». Puede que haya que reembolsarlo.',
           '/subcuenta/' || s.id || '/pagos/facturas/' || f.id
    from public.subcuentas s,
         lateral (select f.creado_por as u union select sm.usuario_id from public.subcuenta_miembros sm where sm.subcuenta_id = s.id and sm.rol = 'admin') x
    where s.id = f.subcuenta_id and u is not null;
  end if;
  return v;
end $$;

-- Reembolso hecho en el panel de Stripe (lo llama el webhook).
create or replace function public.pag_reembolso_stripe(p_subcuenta uuid, p_referencia text)
returns int language plpgsql volatile security definer set search_path = public as $$
declare v_n int;
begin
  update public.pag_transacciones set estado = 'reembolsada'
  where subcuenta_id = p_subcuenta and metodo = 'stripe' and referencia = p_referencia and estado = 'completada';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.pag_reembolso_stripe(uuid, text) from public, anon, authenticated;
grant execute on function public.pag_reembolso_stripe(uuid, text) to service_role;

-- Las columnas de la sesión de pago solo las escribe el servidor.
revoke update (checkout_id, checkout_url, checkout_expira) on public.pag_facturas from authenticated;
