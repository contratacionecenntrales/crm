import type { NextRequest } from 'next/server';
import { COLUMNAS_OPORTUNIDAD_API, conClave, error, errorBd, leerJson, ok, UUID } from '@/lib/api/v1';
import { esquemaCambioOportunidadApi, primerProblema } from '@/lib/api/esquemas';

type P = { params: Promise<{ sub: string; oportunidadId: string }> };
const noEncontrada = () => error(404, 'no_encontrado', 'No existe esa oportunidad en esta subcuenta.');

export async function GET(request: NextRequest, { params }: P) {
  const { sub, oportunidadId } = await params;
  return conClave(request, sub, 'oportunidades.leer', async ({ admin }) => {
    if (!UUID.test(oportunidadId)) return noEncontrada();
    const { data, error: e } = await admin.from('crm_oportunidades').select(COLUMNAS_OPORTUNIDAD_API).eq('subcuenta_id', sub).eq('id', oportunidadId).maybeSingle();
    if (e) return errorBd(e);
    return data ? ok({ datos: data }) : noEncontrada();
  });
}

// PATCH: mover de etapa (del mismo embudo), cambiar estado, valor o nombre.
export async function PATCH(request: NextRequest, { params }: P) {
  const { sub, oportunidadId } = await params;
  return conClave(request, sub, 'oportunidades.escribir', async ({ admin }) => {
    if (!UUID.test(oportunidadId)) return noEncontrada();
    const cuerpo = await leerJson(request);
    if (!cuerpo) return error(400, 'json', 'El cuerpo tiene que ser JSON (Content-Type: application/json).');
    const d = esquemaCambioOportunidadApi.safeParse(cuerpo);
    if (!d.success) return error(422, 'invalido', primerProblema(d.error));
    if (!Object.keys(d.data).length) return error(422, 'invalido', 'No hay nada que cambiar.');
    const { data, error: e } = await admin.from('crm_oportunidades').update(d.data).eq('subcuenta_id', sub).eq('id', oportunidadId).select(COLUMNAS_OPORTUNIDAD_API).maybeSingle();
    if (e) return errorBd(e);
    return data ? ok({ datos: data }) : noEncontrada();
  });
}
