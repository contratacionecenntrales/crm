import type { NextRequest } from 'next/server';
import { conClave, errorBd, ok } from '@/lib/api/v1';

export async function GET(request: NextRequest, { params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  return conClave(request, sub, 'calendarios.leer', async ({ admin }) => {
    const { data, error: e } = await admin.from('cal_calendarios').select('id, nombre, slug, tipo, duracion_min, zona_horaria, activo')
      .eq('subcuenta_id', sub).order('nombre');
    if (e) return errorBd(e);
    return ok({ datos: data });
  });
}
