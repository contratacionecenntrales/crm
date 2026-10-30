import { exigirAgencia } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { ContenedorAjustes, SeccionAjuste, TituloAjustes } from '@/components/ajustes/Piezas';
import { Insignia } from '@/components/ui/Insignia';

export const metadata = { title: 'Stripe' };

export default async function PaginaStripe() {
  await exigirAgencia({ admin: true });
  const configurado = Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Stripe" subtitulo="Cobros y suscripciones de tus subcuentas sincronizados con el tablero de la agencia." />
      <SeccionAjuste titulo="Estado" descripcion="Si el servidor tiene configurado el secreto del webhook.">
        {configurado ? <Insignia tono="verde">Webhook configurado</Insignia> : <Insignia tono="ambar">Falta STRIPE_WEBHOOK_SECRET o SUPABASE_SERVICE_ROLE_KEY en el servidor</Insignia>}
      </SeccionAjuste>
      <SeccionAjuste titulo="Webhook" descripcion="Stripe → Developers → Webhooks → Add endpoint.">
        <code className="block overflow-x-auto rounded bg-superficie-2 px-3 py-2 text-sm">{siteUrl()}/api/webhooks/stripe</code>
        <p className="mt-3 text-sm text-tenue">Eventos: invoice.paid, invoice.payment_failed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.</p>
        <p className="mt-2 text-sm text-tenue">En cada suscripción de Stripe, añade en metadatos <code className="rounded bg-superficie-2 px-1">subcuenta_id</code> con el ID de la subcuenta (lo copias desde el buscador de subcuentas).</p>
      </SeccionAjuste>
    </ContenedorAjustes>
  );
}
