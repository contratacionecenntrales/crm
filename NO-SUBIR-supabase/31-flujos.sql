-- =============================================================================
-- 31 · AUTOMATIZACIONES AVANZADAS
-- Disparador «Webhook entrante»: cada flujo puede tener su propia URL secreta
-- para recibir datos de otras herramientas (formularios externos, tiendas,
-- Zapier/Make/n8n…). Los datos recibidos quedan disponibles en los pasos como
-- {{webhook.campo}}. Las ramas, peticiones HTTP y variables viven en los pasos
-- (validados en la aplicación). Requiere el 30. Re-ejecutable.
-- =============================================================================

alter table public.aut_flujos add column if not exists webhook_token text;
alter table public.aut_flujos drop constraint if exists aut_flujos_webhook_token_check;
alter table public.aut_flujos add constraint aut_flujos_webhook_token_check check (webhook_token is null or webhook_token ~ '^[0-9a-f]{40}$');
create unique index if not exists aut_flujos_webhook_token_uidx on public.aut_flujos(webhook_token) where webhook_token is not null;

alter table public.aut_flujos drop constraint if exists aut_flujos_disparador_check;
alter table public.aut_flujos add constraint aut_flujos_disparador_check check (disparador in (
  'contacto_creado', 'etiqueta_anadida', 'cita_reservada', 'cita_cancelada', 'cita_estado',
  'mensaje_recibido', 'oportunidad_etapa', 'factura_pagada', 'manual', 'formulario_enviado', 'webhook'));

-- Genera (o renueva) la URL secreta del flujo. Solo administradores.
create or replace function public.aut_webhook_token(p_flujo uuid, p_renovar boolean default false)
returns text language plpgsql volatile security definer set search_path = public as $$
declare f public.aut_flujos; v text;
begin
  select * into f from public.aut_flujos where id = p_flujo;
  if f.id is null or not public.soy_admin_subcuenta(f.subcuenta_id) then
    raise exception 'Solo un administrador de la subcuenta puede gestionar el webhook.' using errcode = 'insufficient_privilege';
  end if;
  if f.webhook_token is not null and not coalesce(p_renovar, false) then return f.webhook_token; end if;
  v := encode(extensions.gen_random_bytes(20), 'hex');
  update public.aut_flujos set webhook_token = v where id = p_flujo;
  return v;
end $$;
revoke all on function public.aut_webhook_token(uuid, boolean) from public, anon;
grant execute on function public.aut_webhook_token(uuid, boolean) to authenticated;

-- Llega un webhook: busca o crea el contacto y mete una ejecución del flujo.
-- Devuelve el id de la ejecución (o null si el contacto ya estaba dentro).
create or replace function public.aut_webhook_entrante(p_token text, p_datos jsonb, p_email text, p_telefono text, p_nombre text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare f public.aut_flujos; s public.subcuentas; v_email text; v_tel text; v_contacto uuid; v_id uuid;
begin
  if p_token !~ '^[0-9a-f]{40}$' then raise exception 'Webhook no encontrado.' using errcode = 'no_data_found'; end if;
  select * into f from public.aut_flujos where webhook_token = p_token and disparador = 'webhook' and activo;
  if f.id is null or not public.subcuenta_operativa(f.subcuenta_id) then
    raise exception 'Webhook no encontrado o flujo desactivado.' using errcode = 'no_data_found';
  end if;
  if jsonb_typeof(p_datos) <> 'object' or pg_column_size(p_datos) > 65536 then
    raise exception 'Los datos tienen que ser un objeto JSON de como mucho 64 KB.' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('webhook:' || f.id::text));
  if (select count(*) from public.aut_ejecuciones where flujo_id = f.id and creado > now() - interval '1 hour') >= 1000 then
    raise exception 'Demasiadas llamadas a este webhook en la última hora.' using errcode = 'check_violation';
  end if;
  select * into s from public.subcuentas where id = f.subcuenta_id;
  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  if v_email is not null and (v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200) then v_email := null; end if;
  v_tel := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  if v_tel <> '' and left(v_tel, 1) <> '+' then v_tel := s.prefijo || ltrim(v_tel, '0'); end if;
  if v_tel <> '' and v_tel !~ '^\+[0-9]{6,15}$' then v_tel := ''; end if;
  if v_email is null and v_tel = '' then
    raise exception 'Los datos no traen un correo ni un teléfono válidos para identificar al contacto.' using errcode = 'check_violation';
  end if;
  select id into v_contacto from public.crm_contactos
  where subcuenta_id = f.subcuenta_id and ((v_email is not null and email = v_email) or (v_email is null and telefono = v_tel)) limit 1;
  if v_contacto is null then
    insert into public.crm_contactos (subcuenta_id, nombre, email, telefono, fuente)
    values (f.subcuenta_id, left(trim(coalesce(p_nombre, '')), 100), v_email, v_tel, left('Webhook: ' || f.nombre, 100))
    returning id into v_contacto;
  end if;
  if not f.permitir_reentrada and exists (select 1 from public.aut_ejecuciones e where e.flujo_id = f.id and e.contacto_id = v_contacto
       and e.estado in ('pendiente', 'procesando', 'esperando')) then
    return null;
  end if;
  insert into public.aut_ejecuciones (subcuenta_id, flujo_id, contacto_id, pasos, datos)
  values (f.subcuenta_id, f.id, v_contacto, f.pasos, jsonb_build_object('webhook', p_datos, 'evento', 'webhook'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.aut_webhook_entrante(text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.aut_webhook_entrante(text, jsonb, text, text, text) to service_role;

-- Datos de la ejecución (variables de los pasos HTTP / variable): solo el servidor.
grant update (datos) on public.aut_ejecuciones to service_role;
