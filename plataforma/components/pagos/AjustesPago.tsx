'use client';
import { useActionState, useState, useTransition } from 'react';
import { CheckCircle2, Loader2, PlugZap } from 'lucide-react';
import { comprobarConexionStripe, guardarAjustesPago } from '@/app/subcuenta/[id]/pagos/acciones';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import { BotonCopiar } from '@/components/calendario/TablaCalendarios';
import { SeccionAjuste } from '@/components/ajustes/Piezas';
import type { Resultado } from '@/lib/tipos';

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';

export function AjustesPago({ subId, ajustes: a, estado: s, soyAdmin, web }: {
  subId: string; ajustes: { moneda: string; prefijo: string; siguiente_numero: number; impuesto_defecto: number; pie: string };
  estado: { stripe_secreta: boolean; stripe_webhook: boolean; modo?: string }; soyAdmin: boolean; web: string;
}) {
  const [estado, accion] = useActionState(guardarAjustesPago.bind(null, subId), null);
  const [prueba, setPrueba] = useState<Resultado | null>(null);
  const [comprobando, iniciar] = useTransition();
  const off = !soyAdmin;
  const puesta = (x: boolean) => x && <span className="mt-1 flex items-center gap-1 text-xs text-[#067647]"><CheckCircle2 className="size-3.5" /> Guardada en el servidor; nadie del equipo puede leerla.</span>;
  return (
    <form action={accion}>
      <SeccionAjuste titulo="Facturas" descripcion="Numeración, moneda e impuesto que se proponen al crear facturas.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={etiqueta}>Moneda</span><input name="moneda" defaultValue={a.moneda} maxLength={3} disabled={off} className={`${estiloInput} uppercase`} /></label>
          <label className="block"><span className={etiqueta}>Impuesto por defecto %</span><input name="impuesto_defecto" inputMode="decimal" defaultValue={a.impuesto_defecto} disabled={off} className={estiloInput} /></label>
          <label className="block"><span className={etiqueta}>Prefijo</span><input name="prefijo" defaultValue={a.prefijo} maxLength={12} disabled={off} placeholder="FAC-" className={estiloInput} /></label>
          <label className="block"><span className={etiqueta}>Siguiente número</span><input name="siguiente_numero" type="number" min={1} defaultValue={a.siguiente_numero} disabled={off} className={estiloInput} />
            <span className="mt-1 block text-xs text-tenue">La próxima será {a.prefijo}{String(a.siguiente_numero).padStart(4, '0')}.</span></label>
          <label className="block sm:col-span-2"><span className={etiqueta}>Pie de factura</span>
            <textarea name="pie" rows={3} maxLength={2000} defaultValue={a.pie} disabled={off} placeholder="Razón social, NIF, registro mercantil, IBAN…" className={estiloArea} /></label>
        </div>
      </SeccionAjuste>
      <SeccionAjuste titulo="Stripe" descripcion="Para que tus clientes paguen las facturas con tarjeta. El dinero va directo a tu cuenta de Stripe.">
        <div className="space-y-4">
          {s.modo && <p className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.modo === 'prueba' ? 'bg-[#fef0c7] text-[#93370d]' : 'bg-[#dcfae6] text-[#067647]'}`}>{s.modo === 'prueba' ? 'Modo prueba' : 'Modo real'}</p>}
          <label className="block"><span className={etiqueta}>Clave secreta</span>
            <input type="password" name="stripe_secreta" autoComplete="new-password" disabled={off} placeholder={s.stripe_secreta ? '•••••••• guardada (escribe para cambiarla)' : 'sk_live_… o rk_live_…'} className={estiloInput} />
            {puesta(s.stripe_secreta)}
            <span className="mt-1 block text-xs text-tenue">Stripe → Desarrolladores → Claves de API. Mejor una clave restringida con permiso de escritura en Checkout Sessions.</span></label>
          <div>
            <span className={etiqueta}>URL del webhook</span>
            <div className="flex items-center gap-1"><input readOnly value={`${web}/api/webhooks/stripe-pagos/${subId}`} onFocus={(e) => e.target.select()} className={`${estiloInput} font-mono text-xs`} />
              <BotonCopiar texto={`${web}/api/webhooks/stripe-pagos/${subId}`} etiqueta="Copiar URL" /></div>
            <span className="mt-1 block text-xs text-tenue">En Stripe → Desarrolladores → Webhooks, crea un destino con esta URL y los eventos «checkout.session.completed», «checkout.session.async_payment_succeeded» y «charge.refunded».</span>
          </div>
          <label className="block"><span className={etiqueta}>Secreto de firma del webhook</span>
            <input type="password" name="stripe_webhook" autoComplete="new-password" disabled={off} placeholder={s.stripe_webhook ? '•••••••• guardado' : 'whsec_…'} className={estiloInput} />
            {puesta(s.stripe_webhook)}</label>
          {soyAdmin && s.stripe_secreta && <label className="flex items-center gap-2 text-sm text-tenue"><input type="checkbox" name="borrar_stripe" className="size-4" /> Desconectar Stripe (borrar las claves)</label>}
          {soyAdmin && (
            <div className="space-y-2">
              <button type="button" disabled={comprobando} onClick={() => iniciar(async () => setPrueba(await comprobarConexionStripe(subId)))} className={estilosBoton.secundario}>
                {comprobando ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />} Comprobar conexión
              </button>
              <Aviso estado={prueba} />
            </div>
          )}
        </div>
      </SeccionAjuste>
      <Aviso estado={estado} />
      {soyAdmin && <div className="flex justify-end pt-3"><BotonEnvio>Guardar</BotonEnvio></div>}
    </form>
  );
}
