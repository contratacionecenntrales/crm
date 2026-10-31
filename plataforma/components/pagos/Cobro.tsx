'use client';
import { useActionState, useEffect } from 'react';
import { registrarCobro } from '@/app/subcuenta/[id]/pagos/acciones';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloInput } from '@/components/ui/clases';
import { SelectorContacto } from '@/components/crm/SelectorContacto';
import { METODOS } from '@/lib/pagos/tipos';

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';

export function FormularioCobro({ subId, facturaId, pendiente, alGuardar }: { subId: string; facturaId: string | null; pendiente?: number; alGuardar: () => void }) {
  const [estado, accion] = useActionState(registrarCobro.bind(null, subId, facturaId), null);
  useEffect(() => { if (estado?.ok) alGuardar(); }, [estado, alGuardar]);
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <form action={accion} className="space-y-4">
      {!facturaId && (
        <div><span className={etiqueta}>Contacto (opcional)</span><SelectorContacto subId={subId} name="contacto_id" /></div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <label className="block"><span className={etiqueta}>Importe</span>
          <input name="importe" inputMode="decimal" required defaultValue={pendiente ? pendiente.toFixed(2) : ''} className={estiloInput} /></label>
        <label className="block"><span className={etiqueta}>Fecha</span>
          <input type="date" name="fecha" defaultValue={hoy} max={hoy} className={estiloInput} /></label>
      </div>
      <label className="block"><span className={etiqueta}>Método</span>
        <select name="metodo" required defaultValue="transferencia" className={estiloInput}>
          {METODOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
        </select></label>
      <label className="block"><span className={etiqueta}>Referencia</span>
        <input name="referencia" maxLength={200} placeholder="Nº de transferencia, recibo…" className={estiloInput} /></label>
      <label className="block"><span className={etiqueta}>Notas</span>
        <input name="notas" maxLength={1000} className={estiloInput} /></label>
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>Registrar cobro</BotonEnvio></div>
    </form>
  );
}
