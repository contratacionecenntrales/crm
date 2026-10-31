'use client';
import { useActionState, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { borrarPago, guardarSuscripcion, registrarPago } from '@/app/agencia/acciones';
import { Campo, Selector } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { dinero, fecha } from '@/lib/formato';
import type { Pago, Suscripcion } from '@/lib/tipos';

const hoy = () => new Date().toISOString().slice(0, 10);
const ETIQUETA_ESTADO = { activa: 'Activa', prueba: 'En prueba', impagada: 'Impagada', cancelada: 'Cancelada' };

export function Facturacion({ subcuentaId, suscripcion, pagos, moneda }: {
  subcuentaId: string; suscripcion: Suscripcion | null; pagos: Pago[]; moneda: string;
}) {
  const [estadoPlan, accionPlan] = useActionState(guardarSuscripcion, null);
  const [estadoPago, accionPago] = useActionState(registrarPago, null);
  const [pendiente, iniciar] = useTransition();
  const [errorBorrar, setErrorBorrar] = useState('');
  const deStripe = Boolean(suscripcion?.stripe_subscription_id);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 font-semibold">Plan mensual</h3>
        {deStripe && (
          <p className="mb-3 text-xs text-tenue">Este plan está enlazado con Stripe: los cambios que hagas allí sobrescriben estos datos.</p>
        )}
        <form action={accionPlan} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="subcuenta_id" value={subcuentaId} />
          <Campo etiqueta="Nombre del plan" name="plan" defaultValue={suscripcion?.plan ?? 'Plan mensual'} required maxLength={80} />
          <Campo etiqueta={`Importe mensual (${moneda})`} name="importe_mensual" inputMode="decimal"
            defaultValue={suscripcion ? String(suscripcion.importe_mensual) : '0'} required />
          <Selector etiqueta="Estado" name="estado" defaultValue={suscripcion?.estado ?? 'activa'}
            opciones={Object.entries(ETIQUETA_ESTADO).map(([valor, texto]) => ({ valor, texto }))} />
          <Campo etiqueta="Fecha de alta" name="inicio" type="date" defaultValue={suscripcion?.inicio ?? hoy()} required />
          <div className="sm:col-span-2"><Aviso estado={estadoPlan} /></div>
          <div className="flex justify-end sm:col-span-2"><BotonEnvio>Guardar plan</BotonEnvio></div>
        </form>
      </section>

      <section className="border-t pt-5">
        <h3 className="mb-3 font-semibold">Registrar un pago</h3>
        <form action={accionPago} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="hidden" name="subcuenta_id" value={subcuentaId} />
          <Campo etiqueta={`Importe (${moneda})`} name="importe" inputMode="decimal" required />
          <Campo etiqueta="Concepto" name="concepto" defaultValue="Suscripción" required maxLength={120} />
          <Campo etiqueta="Fecha" name="fecha" type="date" defaultValue={hoy()} required />
          <div className="sm:col-span-3"><Aviso estado={estadoPago} /></div>
          <div className="flex justify-end sm:col-span-3"><BotonEnvio variante="secundario">Añadir pago</BotonEnvio></div>
        </form>
      </section>

      <section className="border-t pt-5">
        <h3 className="mb-3 font-semibold">Últimos pagos</h3>
        {errorBorrar && <p role="alert" className="mb-2 text-sm text-peligro">{errorBorrar}</p>}
        {pagos.length === 0 ? (
          <p className="text-sm text-tenue">Sin pagos registrados.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {pagos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-tenue">{fecha(p.fecha)}</span>
                <span className="min-w-0 flex-1 truncate">{p.concepto}</span>
                {p.origen === 'stripe' && <Insignia tono="gris">Stripe</Insignia>}
                <span className="font-medium">{dinero(p.importe, moneda)}</span>
                {p.origen === 'manual' && (
                  <button disabled={pendiente} onClick={() => iniciar(async () => {
                    const r = await borrarPago(p.id);
                    setErrorBorrar(r.ok ? '' : r.error ?? 'No se pudo borrar el pago.');
                  })}
                    aria-label="Borrar pago" className="rounded p-1 text-tenue hover:text-peligro">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
