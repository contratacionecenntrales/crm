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

  const { nombre, email } = separarRemitente(campo('from') || campo('sender'));
  const cuerpo = campo('stripped-text') || campo('body-plain') || '(correo sin texto)';
  const { error } = await adminObligatorio().rpc('conv_registrar_entrante', {
    p_subcuenta: subId, p_canal: 'email', p_de: email || campo('sender'), p_cuerpo: cuerpo.slice(0, 20000),
    p_asunto: campo('subject').slice(0, 300), p_proveedor_id: campo('Message-Id') || null, p_nombre: nombre,
  });
  if (error) return new NextResponse(error.message, { status: 406 });
  return NextResponse.json({ ok: true });
}
