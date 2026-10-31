import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { aUnidadMinima } from './calculo';

export async function secretosStripe(subId: string): Promise<{ secreta: string; webhook: string }> {
  const admin = crearClienteAdmin();
  if (!admin) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  const { data } = await admin.from('pag_secretos').select('stripe_secreta, stripe_webhook').eq('subcuenta_id', subId).maybeSingle();
  return { secreta: (data?.stripe_secreta as string) ?? '', webhook: (data?.stripe_webhook as string) ?? '' };
}

async function llamar(secreta: string, ruta: string, cuerpo?: URLSearchParams) {
  const r = await fetch(`https://api.stripe.com/v1/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${secreta}`, ...(cuerpo ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: cuerpo, signal: AbortSignal.timeout(15_000), cache: 'no-store',
  });
  const json = (await r.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!r.ok) throw new Error(r.status === 401 ? 'Stripe rechaza la clave secreta.' : `Stripe: ${json.error?.message ?? `error ${r.status}`}`);
  return json;
}

export async function comprobarStripe(secreta: string): Promise<string> {
  const c = await llamar(secreta, 'account');
  return `Conectado a «${c.settings?.dashboard?.display_name || c.business_profile?.name || c.email || c.id}»${secreta.includes('_test_') ? ' (modo prueba)' : ''}.`;
}

// Sesión de Stripe Checkout por lo que queda por cobrar de la factura.
export async function crearCheckout(o: {
  secreta: string; subId: string; facturaId: string; numero: string; empresa: string; pendiente: number; moneda: string;
  email: string | null; volver: string;
}): Promise<{ id: string; url: string; expira: string }> {
  const p = new URLSearchParams({
    mode: 'payment',
    // Sesión corta (el mínimo de Stripe): una factura no queda con pagos abiertos días.
    expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
    success_url: `${o.volver}?pagado=1`,
    cancel_url: o.volver,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': o.moneda.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(aUnidadMinima(o.pendiente, o.moneda)),
    'line_items[0][price_data][product_data][name]': `Factura ${o.numero} · ${o.empresa}`.slice(0, 250),
    'metadata[factura_id]': o.facturaId,
    'metadata[subcuenta_id]': o.subId,
    'payment_intent_data[metadata][factura_id]': o.facturaId,
    'payment_intent_data[metadata][subcuenta_id]': o.subId,
    'payment_intent_data[description]': `Factura ${o.numero}`,
  });
  if (o.email) p.set('customer_email', o.email);
  const s = await llamar(o.secreta, 'checkout/sessions', p);
  return { id: String(s.id), url: String(s.url), expira: new Date(Number(s.expires_at) * 1000).toISOString() };
}

// Caduca una sesión anterior para que no se pueda pagar dos veces.
export async function caducarCheckout(secreta: string, id: string): Promise<void> {
  try {
    await llamar(secreta, `checkout/sessions/${encodeURIComponent(id)}/expire`, new URLSearchParams());
  } catch {
    /* ya caducada o completada */
  }
}
