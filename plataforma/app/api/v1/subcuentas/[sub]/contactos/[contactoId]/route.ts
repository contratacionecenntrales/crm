import type { NextRequest } from 'next/server';
import { COLUMNAS_CONTACTO_API, conClave, error, errorBd, leerJson, ok, UUID } from '@/lib/api/v1';
import { esquemaContactoApi, primerProblema } from '@/lib/api/esquemas';
import { normalizarTelefono } from '@/lib/crm/csv';

type P = { params: Promise<{ sub: string; contactoId: string }> };
const noEncontrado = () => error(404, 'no_encontrado', 'No existe ese contacto en esta subcuenta.');

export async function GET(request: NextRequest, { params }: P) {
  const { sub, contactoId } = await params;
  return conClave(request, sub, 'contactos.leer', async ({ admin }) => {
    if (!UUID.test(contactoId)) return noEncontrado();
    const { data, error: e } = await admin.from('crm_contactos').select(COLUMNAS_CONTACTO_API).eq('subcuenta_id', sub).eq('id', contactoId).maybeSingle();
    if (e) return errorBd(e);
    return data ? ok({ datos: data }) : noEncontrado();
  });
}

export async function PATCH(request: NextRequest, { params }: P) {
  const { sub, contactoId } = await params;
  return conClave(request, sub, 'contactos.escribir', async ({ admin }) => {
    if (!UUID.test(contactoId)) return noEncontrado();
    const cuerpo = await leerJson(request);
    if (!cuerpo) return error(400, 'json', 'El cuerpo tiene que ser JSON (Content-Type: application/json).');
    const d = esquemaContactoApi.safeParse(cuerpo);
    if (!d.success) return error(422, 'invalido', primerProblema(d.error));
    const cambios: Record<string, unknown> = { ...d.data };
    if (typeof d.data.telefono === 'string') {
      const { data: s } = await admin.from('subcuentas').select('prefijo').eq('id', sub).single();
      cambios.telefono = d.data.telefono ? normalizarTelefono(d.data.telefono, (s?.prefijo as string) ?? '+34') : '';
      if (cambios.telefono && !/^\+[0-9]{6,15}$/.test(String(cambios.telefono))) return error(422, 'invalido', 'telefono: no válido');
    }
    if (!Object.keys(cambios).length) return error(422, 'invalido', 'No hay nada que cambiar.');
    const { data, error: e } = await admin.from('crm_contactos').update(cambios).eq('subcuenta_id', sub).eq('id', contactoId).select(COLUMNAS_CONTACTO_API).maybeSingle();
    if (e) return errorBd(e);
    return data ? ok({ datos: data }) : noEncontrado();
  });
}

export async function DELETE(request: NextRequest, { params }: P) {
  const { sub, contactoId } = await params;
  return conClave(request, sub, 'contactos.escribir', async ({ admin }) => {
    if (!UUID.test(contactoId)) return noEncontrado();
    const { data, error: e } = await admin.from('crm_contactos').delete().eq('subcuenta_id', sub).eq('id', contactoId).select('id');
    if (e) return errorBd(e);
    return data?.length ? ok({ borrado: true }) : noEncontrado();
  });
}
