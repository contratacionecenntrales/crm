-- =============================================================================
-- 25 · CORRECCIONES DEL EXAMEN FINAL
-- Arreglos de la auditoría independiente. Requiere el 24. Re-ejecutable.
-- =============================================================================

-- Reescribe el cuerpo de una función existente sustituyendo un trozo de texto.
-- Falla si el trozo no está (para no dejar una corrección a medias).
create or replace function pg_temp.parchear(p_firma text, p_buscar text, p_poner text)
returns void language plpgsql as $$
declare v text := pg_get_functiondef(p_firma::regprocedure);
begin
  if position(p_poner in v) > 0 then return; end if; -- ya aplicado
  if position(p_buscar in v) = 0 then raise exception 'No se encontró el texto a corregir en %', p_firma; end if;
  execute replace(v, p_buscar, p_poner);
end $$;

-- 1 · Agencia suspendida = sin servicio público (chat ya abierto, facturas, citas)
select pg_temp.parchear('public.chat_visitante(text, text)', 'and w.clave = p_clave and w.activo',
  'and w.clave = p_clave and w.activo and public.subcuenta_operativa(w.subcuenta_id)');
select pg_temp.parchear('public.pag_factura_publica(uuid)', 'where f.token = p_token and f.estado <> ''borrador''',
  'where f.token = p_token and f.estado <> ''borrador'' and public.subcuenta_operativa(f.subcuenta_id)');
select pg_temp.parchear('public.cal_cita_publica(uuid)', 'where x.token = p_token;',
  'where x.token = p_token and public.subcuenta_operativa(x.subcuenta_id);');
select pg_temp.parchear('public.cal_cancelar_publico(uuid, text)', 'where x.token = p_token and c.permitir_cancelar for update of x',
  'where x.token = p_token and c.permitir_cancelar and public.subcuenta_operativa(x.subcuenta_id) for update of x');

-- 2 · Embudos: formularios y visitas solo con el embudo realmente servido
select pg_temp.parchear('public.emb_enviar_formulario(uuid, text, jsonb)',
  'or not public.subcuenta_operativa(p.subcuenta_id) then',
  'or not public.subcuenta_operativa(p.subcuenta_id)
     or not public.plan_incluye((select agencia_id from public.subcuentas where id = p.subcuenta_id), ''embudos'') then');
select pg_temp.parchear('public.emb_registrar_visita(uuid)',
  'where p.id = p_paso and e.publicado and p.publicado is not null;',
  'where p.id = p_paso and e.publicado and p.publicado is not null and public.subcuenta_operativa(p.subcuenta_id)
    and public.plan_incluye((select agencia_id from public.subcuentas where id = p.subcuenta_id), ''embudos'');');

-- 3 · Embudos: nada de pedir contraseñas o tarjetas en formularios públicos,
-- ni direcciones que suplanten a la plataforma.
create or replace function public.emb_publicar(p_paso uuid)
returns timestamptz language plpgsql volatile security definer set search_path = public as $$
declare v_sub uuid; v_ts timestamptz := now(); v_contenido jsonb;
begin
  select subcuenta_id, contenido into v_sub, v_contenido from public.emb_pasos where id = p_paso;
  if v_sub is null or not public.puedo_ver_subcuenta(v_sub) then
    raise exception 'No tienes acceso a esta página.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from jsonb_path_query(v_contenido, 'lax $.secciones[*].bloques[*].campos[*]') c
             where (c ->> 'etiqueta') || ' ' || (c ->> 'clave') ~* '(contrase|password|passwd|clave de acceso|\mpin\M|cvv|cvc|tarjeta|iban|cuenta bancaria|seguridad social)') then
    raise exception 'Los formularios públicos no pueden pedir contraseñas, PIN ni datos de tarjeta o banco.' using errcode = 'check_violation';
  end if;
  update public.emb_pasos set publicado = contenido, publicado_en = v_ts where id = p_paso;
  return v_ts;
end $$;
revoke all on function public.emb_publicar(uuid) from public, anon;
grant execute on function public.emb_publicar(uuid) to authenticated;

create or replace function public.emb_slug_reservado()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.slug ~ '^(login|logout|admin|auth|api|cuenta|mi-cuenta|seguro|seguridad|verifica|verificar|verificacion|banco|pago|pagos|paypal|stripe|soporte|plataforma|metatok|password|contrasena|sesion|iniciar-sesion|recuperar|oauth|sso)(-|$)' then
    raise exception 'Esa dirección está reservada. Elige otra.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists emb_embudos_slug_reservado on public.emb_embudos;
create trigger emb_embudos_slug_reservado before insert or update of slug on public.emb_embudos for each row execute function public.emb_slug_reservado();

-- 4 · El límite de 3 agencias por cuenta no se puede reiniciar
create table if not exists public.agencias_altas (
  usuario_id uuid not null,
  agencia_id uuid not null,
  creado     timestamptz not null default now()
);
create index if not exists agencias_altas_usuario_idx on public.agencias_altas(usuario_id);
alter table public.agencias_altas enable row level security;
revoke all on public.agencias_altas from anon, authenticated;
grant all on public.agencias_altas to service_role;
insert into public.agencias_altas (usuario_id, agencia_id, creado)
select creado_por, id, creado from public.agencias a
where creado_por is not null and not exists (select 1 from public.agencias_altas x where x.agencia_id = a.id);

create or replace function public.agencias_registra_alta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.creado_por is not null and auth.uid() = new.creado_por and not public.es_admin_plataforma() then
    if (select count(*) from public.agencias_altas where usuario_id = new.creado_por) >= 3 then
      raise exception 'Ya has creado varias agencias con esta cuenta.' using errcode = 'check_violation';
    end if;
  end if;
  if new.creado_por is not null then
    insert into public.agencias_altas (usuario_id, agencia_id) values (new.creado_por, new.id);
  end if;
  return new;
end $$;
drop trigger if exists agencias_registra_alta on public.agencias;
create trigger agencias_registra_alta before insert on public.agencias for each row execute function public.agencias_registra_alta();

create or replace function public.agencias_protege_plataforma()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.plan_id is distinct from old.plan_id or new.estado is distinct from old.estado
      or new.prueba_hasta is distinct from old.prueba_hasta or new.motivo_suspension is distinct from old.motivo_suspension
      or new.creado_por is distinct from old.creado_por)
     and auth.uid() is not null and not public.es_admin_plataforma() then
    raise exception 'El plan y el estado de la agencia los gestiona la plataforma.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

-- 5 · Funciones internas que no debía poder llamar nadie desde fuera
revoke all on function public.usuarios_de_agencia_total(uuid) from public, anon, authenticated;
grant execute on function public.usuarios_de_agencia_total(uuid) to service_role;

-- 6 · IA: un visitante del chat que se identifica con el correo de un contacto
-- que ya tenía historial NO recibe respuestas automáticas (podría no ser él).
create or replace function public.ia_al_insertar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_asistente uuid; v_pausada boolean; v_agencia uuid;
begin
  if new.direccion = 'saliente' then
    if new.autor_id is not null and new.canal <> 'nota' and not new.ia then
      update public.conv_conversaciones set ia_pausada = true where id = new.conversacion_id and not ia_pausada;
    end if;
    return null;
  end if;
  select ia_pausada into v_pausada from public.conv_conversaciones where id = new.conversacion_id;
  if coalesce(v_pausada, true) then return null; end if;
  if new.canal = 'chat' and exists (
      select 1 from public.conv_mensajes m
      where m.conversacion_id = new.conversacion_id and m.canal <> 'nota' and m.id <> new.id
        and (m.canal <> 'chat' or m.chat_visitante_id is distinct from new.chat_visitante_id)) then
    update public.conv_conversaciones set ia_pausada = true where id = new.conversacion_id;
    insert into public.conv_mensajes (subcuenta_id, conversacion_id, direccion, canal, cuerpo, estado, ia)
    values (new.subcuenta_id, new.conversacion_id, 'saliente', 'nota',
            'El asistente IA no contesta a este chat: el visitante usa los datos de un contacto con historial previo y no está verificado. Contesta una persona.', 'enviado', true);
    return null;
  end if;
  select a.id into v_asistente from public.ia_asistentes a
  where a.subcuenta_id = new.subcuenta_id and a.activo and new.canal = any(a.canales) limit 1;
  if v_asistente is null then return null; end if;
  select agencia_id into v_agencia from public.subcuentas where id = new.subcuenta_id;
  if not public.subcuenta_operativa(new.subcuenta_id) or not public.plan_incluye(v_agencia, 'ia') then return null; end if;
  insert into public.ia_cola (subcuenta_id, conversacion_id, mensaje_id, asistente_id)
  values (new.subcuenta_id, new.conversacion_id, new.id, v_asistente) on conflict (mensaje_id) do nothing;
  return null;
end $$;

-- 7 · IA: topes extra contra el abuso (chat anónimo y gasto por agencia)
select pg_temp.parchear('public.ia_reservar(uuid)',
  '  select coalesce(respuestas, 0) into v_hoy from public.ia_uso',
  '  if (select canal from public.conv_mensajes where id = q.mensaje_id) = ''chat''
     and (select count(*) from public.conv_mensajes where subcuenta_id = q.subcuenta_id and canal = ''chat'' and ia
          and creado > now() - interval ''1 hour'') >= 100 then
    return ''Demasiadas respuestas de IA en el chat web en la última hora (100).'';
  end if;
  if (select coalesce(sum(u.respuestas), 0) from public.ia_uso u join public.subcuentas s on s.id = u.subcuenta_id
      where u.dia = current_date and s.agencia_id = (select agencia_id from public.subcuentas where id = q.subcuenta_id)) >= 3000 then
    return ''Límite diario de respuestas con IA de la agencia alcanzado (3000).'';
  end if;
  select coalesce(respuestas, 0) into v_hoy from public.ia_uso');

-- 8 · Webhooks: un aviso firmado no se puede reenviar (anti-repetición)
create table if not exists public.webhook_tokens (
  token  text primary key check (length(token) between 10 and 200),
  creado timestamptz not null default now()
);
alter table public.webhook_tokens enable row level security;
revoke all on public.webhook_tokens from anon, authenticated;
grant all on public.webhook_tokens to service_role;
create or replace function public.webhook_token_nuevo(p_token text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v int;
begin
  delete from public.webhook_tokens where creado < now() - interval '1 day';
  insert into public.webhook_tokens (token) values (p_token) on conflict do nothing;
  get diagnostics v = row_count;
  return v = 1;
end $$;
revoke all on function public.webhook_token_nuevo(text) from public, anon, authenticated;
grant execute on function public.webhook_token_nuevo(text) to service_role;
