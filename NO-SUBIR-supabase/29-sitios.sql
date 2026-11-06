-- =============================================================================
-- 29 · SITIOS WEB
-- Un «sitio» es un embudo con menú y pie de página: varias páginas enlazadas
-- entre sí, con la marca, los datos de contacto y las redes del negocio.
-- Requiere el 28. Re-ejecutable.
-- =============================================================================

alter table public.emb_embudos add column if not exists tipo text not null default 'embudo';
alter table public.emb_embudos drop constraint if exists emb_embudos_tipo_check;
alter table public.emb_embudos add constraint emb_embudos_tipo_check check (tipo in ('embudo', 'sitio'));
alter table public.emb_embudos add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.emb_embudos drop constraint if exists emb_embudos_config_check;
alter table public.emb_embudos add constraint emb_embudos_config_check check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 20000);
grant insert (tipo, config) on public.emb_embudos to authenticated;
grant update (config) on public.emb_embudos to authenticated;

-- Página pública: además devuelve el tipo, los ajustes del sitio y el menú.
create or replace function public.emb_pagina_publica(p_slug text, p_ruta text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.emb_embudos; p public.emb_pasos; v_sig text; s public.subcuentas; v_menu jsonb;
begin
  select * into e from public.emb_embudos where slug = lower(p_slug) and publicado;
  if e.id is null or not public.subcuenta_operativa(e.subcuenta_id)
     or not public.plan_incluye((select agencia_id from public.subcuentas where id = e.subcuenta_id), 'embudos') then
    return null;
  end if;
  if coalesce(p_ruta, '') = '' then
    select * into p from public.emb_pasos where embudo_id = e.id and publicado is not null order by orden, creado limit 1;
  else
    select * into p from public.emb_pasos where embudo_id = e.id and ruta = lower(p_ruta) and publicado is not null;
  end if;
  if p.id is null then return null; end if;
  select ruta into v_sig from public.emb_pasos
  where embudo_id = e.id and publicado is not null and (orden, creado) > (p.orden, p.creado) order by orden, creado limit 1;
  if e.tipo = 'sitio' then
    select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'ruta', ruta) order by orden, creado), '[]') into v_menu
    from public.emb_pasos where embudo_id = e.id and publicado is not null;
  end if;
  select * into s from public.subcuentas where id = e.subcuenta_id;
  return jsonb_build_object('paso_id', p.id, 'embudo', e.nombre, 'slug', e.slug, 'ruta', p.ruta, 'nombre', p.nombre,
    'contenido', p.publicado, 'siguiente', v_sig, 'seo_titulo', p.seo_titulo, 'seo_descripcion', p.seo_descripcion,
    'empresa', s.nombre, 'logo', s.logo_url, 'tipo', e.tipo, 'config', case when e.tipo = 'sitio' then e.config else '{}'::jsonb end,
    'menu', coalesce(v_menu, '[]'::jsonb));
end $$;
revoke all on function public.emb_pagina_publica(text, text) from public;
grant execute on function public.emb_pagina_publica(text, text) to anon, authenticated;
