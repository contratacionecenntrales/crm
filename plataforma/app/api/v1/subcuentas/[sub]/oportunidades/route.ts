import type { NextRequest } from 'next/server';
import { COLUMNAS_OPORTUNIDAD_API, conClave, error, errorBd, leerJson, ok, paginacion, UUID } from '@/lib/api/v1';
import { esquemaOportunidadApi, primerProblema } from '@/lib/api/esquemas';

type P = { params: Promise<{ sub: string }> };

// GET ?embudo_id=&estado=&contacto_id=&limite=&pagina=
export async function GET(request: NextRequest, { params }: P) {
  const { sub } = await params;
  return conClave(request, sub, 'oportunidades.leer', async ({ admin }) => {
    const url = new URL(request.url);
    const { limite, pagina, desde, hasta } = paginacion(url);
    let q = admin.from('crm_oportunidades').select(COLUMNAS_OPORTUNIDAD_API, { count: 'exact' }).eq('subcuenta_id', sub);
    for (const k of ['embudo_id', 'contacto_id'] as const) {
      const v = url.searchParams.get(k);
      if (v) { if (!UUID.test(v)) return error(422, 'invalido', `${k}: no válido`); q = q.eq(k, v); }
    }
    const estado = url.searchParams.get('estado');
    if (estado) { if (!['abierta', 'ganada', 'perdida', 'abandonada'].includes(estado)) return error(422, 'invalido', 'estado: no válido'); q = q.eq('estado', estado); }
    const { data, count, error: e } = await q.order('creado', { ascending: false }).order('id').range(desde, hasta);
    if (e) return errorBd(e);
    return ok({ datos: data, total: count ?? 0, pagina, limite });
  });
}

// POST: si no se indica embudo/etapa, va al primer embudo y su primera etapa.
export async function POST(request: NextRequest, { params }: P) {
  const { sub } = await params;
  return conClave(request, sub, 'oportunidades.escribir', async ({ admin }) => {
    const cuerpo = await leerJson(request);
    if (!cuerpo) return error(400, 'json', 'El cuerpo tiene que ser JSON (Content-Type: application/json).');
    const d = esquemaOportunidadApi.safeParse(cuerpo);
    if (!d.success) return error(422, 'invalido', primerProblema(d.error));
    const v = d.data;
    let embudo = v.embudo_id;
    if (!embudo) {
      const { data: e } = await admin.from('crm_embudos').select('id').eq('subcuenta_id', sub).order('orden').limit(1).maybeSingle();
      if (!e) return error(422, 'sin_embudo', 'La subcuenta no tiene ningún embudo.');
      embudo = e.id as string;
    } else {
      const { data: e } = await admin.from('crm_embudos').select('id').eq('subcuenta_id', sub).eq('id', embudo).maybeSingle();
      if (!e) return error(422, 'referencia', 'embudo_id: no existe en esta subcuenta.');
    }
    let etapa = v.etapa_id;
    if (!etapa) {
      const { data: e } = await admin.from('crm_etapas').select('id').eq('embudo_id', embudo).order('orden').limit(1).maybeSingle();
      if (!e) return error(422, 'sin_etapa', 'El embudo no tiene etapas.');
      etapa = e.id as string;
    }
    const { data: c } = await admin.from('crm_contactos').select('id').eq('subcuenta_id', sub).eq('id', v.contacto_id).maybeSingle();
    if (!c) return error(422, 'referencia', 'contacto_id: no existe en esta subcuenta.');
    const { data, error: e } = await admin.from('crm_oportunidades')
      .insert({ subcuenta_id: sub, embudo_id: embudo, etapa_id: etapa, contacto_id: v.contacto_id, nombre: v.nombre,
        valor: v.valor ?? 0, estado: v.estado ?? 'abierta', fuente: v.fuente ?? 'API', creado_por: null, posicion: Date.now() })
      .select(COLUMNAS_OPORTUNIDAD_API).single();
    if (e) return errorBd(e);
    return ok({ datos: data }, 201);
  });
}
