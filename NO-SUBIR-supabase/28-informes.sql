-- =============================================================================
-- 28 · INFORMES
-- Cifras de una subcuenta para un periodo, en una sola llamada: contactos,
-- oportunidades, citas, facturación, conversaciones, embudos, marketing,
-- reseñas e IA. Requiere el 27. Re-ejecutable.
-- =============================================================================

create or replace function public.inf_resumen(p_subcuenta uuid, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_zona text; d0 timestamptz; d1 timestamptz; r jsonb;
begin
  if not public.puedo_ver_subcuenta(p_subcuenta) then
    raise exception 'No tienes acceso a esta subcuenta.' using errcode = 'insufficient_privilege';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 366 then
    raise exception 'Elige un periodo de como mucho un año.' using errcode = 'check_violation';
  end if;
  select coalesce(nullif(zona_horaria, ''), 'Europe/Madrid') into v_zona from public.subcuentas where id = p_subcuenta;
  d0 := (p_desde::timestamp) at time zone v_zona;
  d1 := ((p_hasta + 1)::timestamp) at time zone v_zona;

  select jsonb_build_object(
    'contactos', jsonb_build_object(
      'nuevos', (select count(*) from crm_contactos where subcuenta_id = p_subcuenta and creado >= d0 and creado < d1),
      'total', (select count(*) from crm_contactos where subcuenta_id = p_subcuenta),
      'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'n', n) order by dia) from (
          select (creado at time zone v_zona)::date dia, count(*) n from crm_contactos
          where subcuenta_id = p_subcuenta and creado >= d0 and creado < d1 group by 1) x), '[]'),
      'por_fuente', coalesce((select jsonb_agg(jsonb_build_object('fuente', fuente, 'n', n) order by n desc) from (
          select coalesce(nullif(fuente, ''), 'Sin indicar') fuente, count(*) n from crm_contactos
          where subcuenta_id = p_subcuenta and creado >= d0 and creado < d1 group by 1 order by 2 desc limit 8) x), '[]')),
    'oportunidades', (select jsonb_build_object(
        'creadas', count(*) filter (where creado >= d0 and creado < d1),
        'valor_creado', coalesce(sum(valor) filter (where creado >= d0 and creado < d1), 0),
        'ganadas', count(*) filter (where estado = 'ganada' and cerrada_en >= d0 and cerrada_en < d1),
        'valor_ganado', coalesce(sum(valor) filter (where estado = 'ganada' and cerrada_en >= d0 and cerrada_en < d1), 0),
        'perdidas', count(*) filter (where estado in ('perdida', 'abandonada') and cerrada_en >= d0 and cerrada_en < d1),
        'abiertas', count(*) filter (where estado = 'abierta'),
        'valor_abierto', coalesce(sum(valor) filter (where estado = 'abierta'), 0))
      from crm_oportunidades where subcuenta_id = p_subcuenta),
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('embudo', e.nombre, 'etapa', t.nombre, 'n', x.n, 'valor', x.valor) order by e.orden, t.orden) from (
        select etapa_id, count(*) n, sum(valor) valor from crm_oportunidades where subcuenta_id = p_subcuenta and estado = 'abierta' group by 1) x
        join crm_etapas t on t.id = x.etapa_id join crm_embudos e on e.id = t.embudo_id), '[]'),
    'citas', (select jsonb_build_object(
        'total', count(*), 'online', count(*) filter (where origen = 'reserva'),
        'presentado', count(*) filter (where estado = 'presentado'), 'no_presentado', count(*) filter (where estado = 'no_presentado'),
        'canceladas', count(*) filter (where estado = 'cancelada'), 'pendientes', count(*) filter (where estado in ('nueva', 'confirmada')))
      from cal_citas where subcuenta_id = p_subcuenta and inicio >= d0 and inicio < d1),
    'facturacion', (select jsonb_build_object(
        'emitidas', count(*) filter (where estado <> 'borrador' and estado <> 'anulada' and emision between p_desde and p_hasta),
        'facturado', coalesce(sum(total) filter (where estado in ('enviada', 'pagada') and emision between p_desde and p_hasta), 0),
        'cobrado', coalesce(sum(cobrado) filter (where pagada_en >= d0 and pagada_en < d1), 0),
        'pendiente', coalesce(sum(total - cobrado) filter (where estado = 'enviada'), 0),
        'moneda', coalesce((select moneda from pag_facturas where subcuenta_id = p_subcuenta order by creado desc limit 1), 'EUR'))
      from pag_facturas where subcuenta_id = p_subcuenta),
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object('canal', canal, 'entrantes', e, 'salientes', s, 'ia', ia) order by canal) from (
        select canal, count(*) filter (where direccion = 'entrante') e, count(*) filter (where direccion = 'saliente') s,
               count(*) filter (where direccion = 'saliente' and ia) ia
        from conv_mensajes where subcuenta_id = p_subcuenta and canal <> 'nota' and creado >= d0 and creado < d1 group by 1) x), '[]'),
    'embudos', coalesce((select jsonb_agg(jsonb_build_object('nombre', nombre, 'visitas', v, 'envios', en) order by v desc) from (
        select e.nombre, sum(s.visitas) v, sum(s.envios) en from emb_estadisticas s join emb_pasos p on p.id = s.paso_id join emb_embudos e on e.id = p.embudo_id
        where s.subcuenta_id = p_subcuenta and s.dia between p_desde and p_hasta group by e.id, e.nombre limit 10) x), '[]'),
    'marketing', (select jsonb_build_object('enviados', count(*) filter (where e.estado = 'enviado'), 'fallidos', count(*) filter (where e.estado = 'fallido'), 'bajas', count(*) filter (where e.baja))
      from mkt_envios e where e.subcuenta_id = p_subcuenta and e.enviado_en >= d0 and e.enviado_en < d1),
    'resenas', (select jsonb_build_object('pedidas', count(*), 'valoradas', count(puntuacion), 'media', round(avg(puntuacion)::numeric, 2))
      from rep_solicitudes where subcuenta_id = p_subcuenta and creado >= d0 and creado < d1),
    'ia', (select jsonb_build_object('respuestas', coalesce(sum(respuestas), 0), 'tokens', coalesce(sum(tokens_entrada + tokens_salida), 0))
      from ia_uso where subcuenta_id = p_subcuenta and dia between p_desde and p_hasta)
  ) into r;
  return r;
end $$;
revoke all on function public.inf_resumen(uuid, date, date) from public, anon;
grant execute on function public.inf_resumen(uuid, date, date) to authenticated;
