'use server';
import { redirect } from 'next/navigation';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/env';
import { caducarCheckout, crearCheckout, secretosStripe } from '@/lib/pagos/stripe';
import type { Resultado } from '@/lib/tipos';

// Lleva al cliente a Stripe Checkout por lo que queda por cobrar.
export async function pagarFactura(token: string, _: Resultado | null): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: 'Enlace no válido.' };
  const admin = crearClienteAdmin();
  if (!admin) return { ok: false, error: 'El pago online no está disponible ahora mismo.' };
  const { data: f } = await admin.from('pag_facturas')
    .select('id, subcuenta_id, numero, estado, total, cobrado, moneda, checkout_id, checkout_url, checkout_expira, contacto:crm_contactos(email), subcuenta:subcuentas(nombre)')
    .eq('token', token).maybeSingle();
  if (!f || f.estado === 'borrador') return { ok: false, error: 'Esta factura no existe.' };
  if (f.estado !== 'enviada') return { ok: false, error: f.estado === 'pagada' ? 'Esta factura ya está pagada.' : 'Esta factura está anulada.' };
  const pendiente = Math.round((Number(f.total) - Number(f.cobrado)) * 100) / 100;
  if (pendiente <= 0) return { ok: false, error: 'No queda nada por pagar.' };
  let url: string;
  try {
    const { secreta } = await secretosStripe(f.subcuenta_id as string);
    if (!secreta) return { ok: false, error: 'Esta empresa no tiene activado el pago online. Contacta con ella para pagar.' };
    // Sesión abierta y vigente: se reutiliza (dos pestañas no generan dos cobros).
    if (f.checkout_url && f.checkout_expira && Date.parse(f.checkout_expira as string) > Date.now() + 5 * 60_000) {
      url = f.checkout_url as string;
    } else {
      if (f.checkout_id) await caducarCheckout(secreta, f.checkout_id as string);
      const s = await crearCheckout({
      secreta, subId: f.subcuenta_id as string, facturaId: f.id as string, numero: f.numero as string,
      empresa: (f.subcuenta as unknown as { nombre: string }).nombre, pendiente, moneda: f.moneda as string,
      email: (f.contacto as unknown as { email: string | null } | null)?.email ?? null, volver: `${siteUrl()}/factura/${token}`,
      });
      url = s.url;
      await admin.from('pag_facturas').update({ checkout_id: s.id, checkout_url: s.url, checkout_expira: s.expira }).eq('id', f.id as string);
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  redirect(url);
}
