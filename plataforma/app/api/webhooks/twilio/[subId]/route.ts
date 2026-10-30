import { NextResponse, type NextRequest } from 'next/server';
import { siteUrl } from '@/lib/env';
import { credenciales, adminObligatorio } from '@/lib/conversaciones/envio';
import { estadoTwilio, firmaTwilioValida } from '@/lib/conversaciones/firmas';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vacia = () => new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });

// Twilio llama aquí con los SMS/WhatsApp entrantes y con los cambios de estado
// de los enviados. URL para la consola de Twilio: <web>/api/webhooks/twilio/<id de la subcuenta>
export async function POST(req: NextRequest, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  if (!UUID.test(subId)) return new NextResponse('No encontrado', { status: 404 });
  const form = await req.formData();
  const datos: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') datos[k] = v;

  let token = '';
  try {
    token = (await credenciales(subId)).secretos.twilio_token;
  } catch {
    return new NextResponse('Servidor sin configurar', { status: 503 });
  }
  // Twilio firma la URL exacta configurada en su consola.
  const url = `${siteUrl()}/api/webhooks/twilio/${subId}${req.nextUrl.search}`;
  if (!firmaTwilioValida(url, datos, req.headers.get('x-twilio-signature'), token)) {
    return new NextResponse('Firma no válida', { status: 403 });
  }

  const admin = adminObligatorio();
  const sid = datos.MessageSid || datos.SmsSid;
  if (datos.MessageStatus && datos.Body === undefined) {
    const estado = estadoTwilio(datos.MessageStatus);
    if (estado && sid) {
      await admin.from('conv_mensajes').update({
        estado,
        ...(estado === 'fallido' ? { error: `Twilio: ${datos.ErrorMessage || 'no entregado'}${datos.ErrorCode ? ` (código ${datos.ErrorCode})` : ''}` } : {}),
      }).eq('subcuenta_id', subId).eq('proveedor_id', sid).neq('estado', 'leido');
    }
    return vacia();
  }

  if (!datos.From) return vacia();
  const whatsapp = datos.From.startsWith('whatsapp:');
  const adjuntos = Number(datos.NumMedia || 0);
  const cuerpo = [datos.Body ?? '', ...Array.from({ length: Math.min(adjuntos, 10) }, (_, i) => datos[`MediaUrl${i}`]).filter(Boolean)].join('\n').trim();
  const { error } = await admin.rpc('conv_registrar_entrante', {
    p_subcuenta: subId, p_canal: whatsapp ? 'whatsapp' : 'sms', p_de: datos.From, p_cuerpo: cuerpo,
    p_asunto: '', p_proveedor_id: sid || null, p_nombre: datos.ProfileName ?? '',
  });
  if (error) return new NextResponse(error.message, { status: 400 });
  return vacia();
}
