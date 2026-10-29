import { NextResponse, type NextRequest } from 'next/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { estadoDesdeStripe, importeMensualDesdeItems, verificarFirmaStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Webhook de Stripe: mantiene suscripciones y pagos al día sin intervención.
// La subcuenta se identifica por metadata.subcuenta_id (suscripción, factura o
// cliente) o por el id de suscripción/cliente que ya tengamos guardado.
export async function POST(request: NextRequest) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = crearClienteAdmin();
  if (!secreto || !admin) {
    return NextResponse.json({ error: 'Webhook de Stripe sin configurar' }, { status: 503 });
  }

  const cuerpo = await request.text();
  if (!verificarFirmaStripe(cuerpo, request.headers.get('stripe-signature'), secreto)) {
    return NextResponse.json({ error: 'Firma no válida' }, { status: 400 });
  }

  let evento: Obj;
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: 'JSON no válido' }, { status: 400 });
  }
  const o: Obj = evento.data?.object ?? {};

  // Busca la subcuenta a la que pertenece el objeto.
  async function subcuentaDe(obj: Obj): Promise<string | null> {
    const candidatas = [
      obj.metadata?.subcuenta_id,
      obj.subscription_details?.metadata?.subcuenta_id,
      obj.parent?.subscription_details?.metadata?.subcuenta_id,
      obj.lines?.data?.[0]?.metadata?.subcuenta_id,
    ];
    const directa = candidatas.find((c) => typeof c === 'string' && UUID.test(c));
    if (directa) return directa;

    const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.object === 'subscription' ? obj.id : null;
    const cliente = typeof obj.customer === 'string' ? obj.customer : null;
    if (subId) {
      const { data } = await admin!.from('suscripciones').select('subcuenta_id').eq('stripe_subscription_id', subId).maybeSingle();
      if (data) return data.subcuenta_id;
    }
    if (cliente) {
      const { data } = await admin!.from('suscripciones').select('subcuenta_id').eq('stripe_customer_id', cliente).maybeSingle();
      if (data) return data.subcuenta_id;
    }
    return null;
  }

  async function avisarAdmins(subcuentaId: string, titulo: string, cuerpoAviso: string) {
    const { data: sub } = await admin!.from('subcuentas').select('agencia_id, nombre').eq('id', subcuentaId).maybeSingle();
    if (!sub) return;
    const { data: admins } = await admin!
      .from('agencia_miembros')
      .select('usuario_id')
      .eq('agencia_id', sub.agencia_id)
      .in('rol', ['propietario', 'admin']);
    if (!admins?.length) return;
    await admin!.from('notificaciones').insert(
      admins.map((a) => ({
        usuario_id: a.usuario_id, agencia_id: sub.agencia_id, subcuenta_id: subcuentaId,
        tipo: 'alerta', categoria: 'Pagos', titulo, cuerpo: cuerpoAviso, enlace: '/agencia/subcuentas',
      })),
    );
  }

  try {
    switch (evento.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subcuentaId = await subcuentaDe(o);
        if (!subcuentaId) return NextResponse.json({ ignorado: 'sin subcuenta' });
        const estado = evento.type === 'customer.subscription.deleted' ? 'cancelada' : estadoDesdeStripe(o.status);
        const items = o.items?.data ?? [];
        const plan = items[0]?.price?.nickname || items[0]?.plan?.nickname || o.metadata?.plan || 'Suscripción Stripe';
        const { error } = await admin.from('suscripciones').upsert(
          {
            subcuenta_id: subcuentaId,
            agencia_id: '00000000-0000-0000-0000-000000000000', // el disparador la toma de la subcuenta
            plan: String(plan).slice(0, 80),
            importe_mensual: importeMensualDesdeItems(items),
            estado,
            inicio: new Date((o.start_date ?? o.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
            cancelada_en: o.canceled_at ? new Date(o.canceled_at * 1000).toISOString().slice(0, 10) : null,
            stripe_customer_id: typeof o.customer === 'string' ? o.customer : null,
            stripe_subscription_id: o.id,
          },
          { onConflict: 'subcuenta_id' },
        );
        if (error) throw error;
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const subcuentaId = await subcuentaDe(o);
        if (!subcuentaId) return NextResponse.json({ ignorado: 'sin subcuenta' });
        const importe = (o.amount_paid ?? 0) / 100;
        if (importe === 0) break;
        const concepto = o.lines?.data?.[0]?.description || o.description || 'Suscripción';
        // referencia_externa es única: el mismo evento repetido no duplica el cobro.
        const { error } = await admin.from('pagos').upsert(
          {
            agencia_id: '00000000-0000-0000-0000-000000000000',
            subcuenta_id: subcuentaId,
            importe,
            concepto: String(concepto).slice(0, 120),
            fecha: new Date((o.status_transitions?.paid_at ?? o.created) * 1000).toISOString(),
            origen: 'stripe',
            referencia_externa: o.id,
          },
          { onConflict: 'referencia_externa', ignoreDuplicates: true },
        );
        if (error) throw error;
        break;
      }

      case 'invoice.payment_failed': {
        const subcuentaId = await subcuentaDe(o);
        if (!subcuentaId) return NextResponse.json({ ignorado: 'sin subcuenta' });
        await admin.from('suscripciones').update({ estado: 'impagada' }).eq('subcuenta_id', subcuentaId);
        await avisarAdmins(subcuentaId, 'Pago fallido', `Stripe no ha podido cobrar ${((o.amount_due ?? 0) / 100).toFixed(2)} ${String(o.currency ?? '').toUpperCase()}.`);
        break;
      }

      default:
        return NextResponse.json({ ignorado: evento.type });
    }
  } catch (e) {
    console.error('webhook stripe', evento.type, e);
    // 500 hace que Stripe reintente más tarde.
    return NextResponse.json({ error: 'No se pudo procesar' }, { status: 500 });
  }

  return NextResponse.json({ recibido: true });
}
