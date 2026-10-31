import { NextResponse, type NextRequest } from 'next/server';
import { credenciales, adminObligatorio } from '@/lib/conversaciones/envio';
import { firmaMailgunValida, separarRemitente } from '@/lib/conversaciones/firmas';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Correo entrante: una «Route» de Mailgun con forward("<web>/api/webhooks/mailgun/<id de la subcuenta>").
export async function POST(req: NextRequest, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  if (!UUID.test(subId)) return new NextResponse('No encontrado', { status: 404 });
  const form = await req.formData();
  const campo = (k: string) => { const v = form.get(k); return typeof v === 'string' ? v : ''; };

  let clave = '';
  try {
    clave = (await credenciales(subId)).secretos.mailgun_firma;
  } catch {
    return new NextResponse('Servidor sin configurar', { status: 503 });
  }
  if (!firmaMailgunValida(clave, campo('timestamp'), campo('token'), campo('signature'))) {
    return new NextResponse('Firma no válida', { status: 406 }); // 406: Mailgun no reintenta
  }

  // Respuestas automáticas (vacaciones, «no-reply»…): no se registran, así un
  // flujo que contesta correos no entra en bucle con un autorespondedor.
  let cabeceras: [string, string][] = [];
  try { cabeceras = JSON.parse(campo('message-headers') || '[]'); } catch { /* sin cabeceras */ }
  const automatico = cabeceras.some(([k, v]) => (/^auto-submitted$/i.test(k) && !/^no$/i.test(String(v).trim()))
    || (/^precedence$/i.test(k) && /bulk|junk|list|auto_reply/i.test(String(v))) || /^x-auto(reply|-response-suppress)$/i.test(k));
  if (automatico) return NextResponse.json({ ignorado: 'respuesta automática' });

  const { nombre, email } = separarRemitente(campo('from') || campo('sender'));
  const cuerpo = campo('stripped-text') || campo('body-plain') || '(correo sin texto)';
  const { error } = await adminObligatorio().rpc('conv_registrar_entrante', {
    p_subcuenta: subId, p_canal: 'email', p_de: email || campo('sender'), p_cuerpo: cuerpo.slice(0, 20000),
    p_asunto: campo('subject').slice(0, 300), p_proveedor_id: campo('Message-Id') || null, p_nombre: nombre,
  });
  // Datos no válidos: 406 (Mailgun no reintenta). Fallo del servidor: 500 (reintenta).
  if (error) return new NextResponse(error.message, { status: error.code === '23514' || error.code === '22P02' ? 406 : 500 });
  return NextResponse.json({ ok: true });
}
