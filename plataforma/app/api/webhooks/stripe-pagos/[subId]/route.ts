import { NextResponse, type NextRequest } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { verificarFirmaStripe } from '@/lib/stripe';
import { secretosStripe } from '@/lib/pagos/stripe';
import { desdeUnidadMinima } from '@/lib/pagos/calculo';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Webhook de la cuenta de Stripe de cada subcuenta: registra el cobro de las
// facturas pagadas por Checkout. URL: <web>/api/webhooks/stripe-pagos/<id de la subcuenta>
export async function POST(req: NextRequest, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  if (!UUID.test(subId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const admin = crearClienteAdmin();
  if (!admin) return NextResponse.json({ error: 'Servidor sin configurar' }, { status: 503 });
  const { webhook } = await secretosStripe(subId);
  const cuerpo = await req.text();
  if (!verificarFirmaStripe(cuerpo, req.headers.get('stripe-signature'), webhook)) {
    return NextResponse.json({ error: 'Firma no válida' }, { status: 400 });
  }
  let evento: { type?: string; data?: { object?: Record<string, any> } }; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: 'JSON no válido' }, { status: 400 });
  }
  const s = evento.data?.object ?? {};
  if ((evento.type === 'checkout.session.completed' || evento.type === 'checkout.session.async_payment_succeeded') && s.payment_status === 'paid') {
    const facturaId = s.metadata?.factura_id;
    if (s.metadata?.subcuenta_id !== subId || !UUID.test(facturaId ?? '')) return NextResponse.json({ ignorado: true });
    const moneda = String(s.currency ?? 'eur').toUpperCase();
    const { error } = await admin.rpc('pag_registrar_pago_stripe', {
      p_subcuenta: subId, p_factura: facturaId, p_importe: desdeUnidadMinima(Number(s.amount_total ?? 0), moneda),
      p_moneda: moneda, p_referencia: String(s.payment_intent ?? s.id),
    });
    // Factura borrada: no tiene sentido que Stripe reintente durante días.
    if (error && error.code === 'P0002') return NextResponse.json({ ignorado: 'factura no encontrada' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Reembolso completo hecho en el panel de Stripe.
  if (evento.type === 'charge.refunded' && s.refunded === true && typeof s.payment_intent === 'string') {
    const { error } = await admin.rpc('pag_reembolso_stripe', { p_subcuenta: subId, p_referencia: s.payment_intent });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recibido: true });
}
