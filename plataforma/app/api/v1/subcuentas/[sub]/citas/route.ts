import type { NextRequest } from 'next/server';
import { conClave, error, errorBd, ok, UUID } from '@/lib/api/v1';

// GET ?desde=ISO&hasta=ISO&calendario_id= (máximo 62 días; por defecto, los próximos 30)
export async function GET(request: NextRequest, { params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  return conClave(request, sub, 'calendarios.leer', async ({ admin }) => {
    const url = new URL(request.url);
    const desde = url.searchParams.get('desde') ? new Date(url.searchParams.get('desde')!) : new Date();
    const hasta = url.searchParams.get('hasta') ? new Date(url.searchParams.get('hasta')!) : new Date(desde.getTime() + 30 * 864e5);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta <= desde) return error(422, 'invalido', 'desde/hasta: fechas no válidas.');
    if (hasta.getTime() - desde.getTime() > 62 * 864e5) return error(422, 'invalido', 'El rango máximo es de 62 días.');
    let q = admin.from('cal_citas').select('id, calendario_id, contacto_id, asignado_id, titulo, inicio, fin, estado, ubicacion, origen, creado')
      .eq('subcuenta_id', sub).gte('inicio', desde.toISOString()).lt('inicio', hasta.toISOString());
    const cal = url.searchParams.get('calendario_id');
    if (cal) { if (!UUID.test(cal)) return error(422, 'invalido', 'calendario_id: no válido'); q = q.eq('calendario_id', cal); }
    const { data, error: e } = await q.order('inicio').limit(500);
    if (e) return errorBd(e);
    return ok({ datos: data });
  });
}
