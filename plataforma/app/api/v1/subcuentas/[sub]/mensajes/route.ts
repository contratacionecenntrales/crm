import type { NextRequest } from 'next/server';
import { conClave, error, errorBd, leerJson, ok } from '@/lib/api/v1';
import { esquemaMensajeApi, primerProblema } from '@/lib/api/esquemas';
import { enviarGuardado } from '@/lib/conversaciones/envio';

type P = { params: Promise<{ sub: string }> };

// POST: envía un SMS, WhatsApp o correo a un contacto (con la configuración de la subcuenta).
export async function POST(request: NextRequest, { params }: P) {
  const { sub } = await params;
  return conClave(request, sub, 'conversaciones.escribir', async ({ admin }) => {
    const cuerpo = await leerJson(request);
    if (!cuerpo) return error(400, 'json', 'El cuerpo tiene que ser JSON (Content-Type: application/json).');
    const d = esquemaMensajeApi.safeParse(cuerpo);
    if (!d.success) return error(422, 'invalido', primerProblema(d.error));
    const v = d.data;
    const { data: c } = await admin.from('crm_contactos').select('id').eq('subcuenta_id', sub).eq('id', v.contacto_id).maybeSingle();
    if (!c) return error(422, 'referencia', 'contacto_id: no existe en esta subcuenta.');
    const conv = await admin.from('conv_conversaciones').upsert({ subcuenta_id: sub, contacto_id: v.contacto_id }, { onConflict: 'subcuenta_id,contacto_id' }).select('id').single();
    if (conv.error) return errorBd(conv.error);
    const m = await admin.from('conv_mensajes').insert({
      subcuenta_id: sub, conversacion_id: conv.data.id, direccion: 'saliente', canal: v.canal,
      asunto: v.canal === 'email' ? v.asunto ?? '' : '', cuerpo: v.cuerpo, estado: 'pendiente', autor_id: null,
    }).select('id').single();
    if (m.error) return errorBd(m.error);
    const fallo = await enviarGuardado(sub, m.data.id as string);
    return ok({ datos: { id: m.data.id, estado: fallo ? 'fallido' : 'enviado', error: fallo ?? null } }, fallo ? 502 : 201);
  });
}
