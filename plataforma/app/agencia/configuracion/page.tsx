import { exigirAgencia } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { FormularioAgencia } from './Formulario';

export const metadata = { title: 'Configuración de la agencia' };

export default async function PaginaConfiguracion() {
  const { actual } = await exigirAgencia({ admin: true });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración de la agencia</h1>
        <p className="mt-1 text-sm text-tenue">La moneda y la zona horaria se usan en el tablero y en los informes.</p>
      </div>
      <FormularioAgencia agencia={actual.agencia} />
      <section className="rounded-xl border bg-superficie p-5 shadow-sm">
        <h2 className="font-semibold">Stripe</h2>
        <p className="mt-1 text-sm text-tenue">
          Para que los cobros y suscripciones de Stripe lleguen solos al tablero, crea en Stripe un webhook hacia esta dirección y añade
          <code className="mx-1 rounded bg-superficie-2 px-1">subcuenta_id</code> en los metadatos del cliente o de la suscripción.
        </p>
        <code className="mt-3 block overflow-x-auto rounded-lg bg-superficie-2 px-3 py-2 text-sm">{siteUrl()}/api/webhooks/stripe</code>
        <p className="mt-2 text-xs text-tenue">
          Eventos: invoice.paid, invoice.payment_failed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
        </p>
      </section>
    </div>
  );
}
