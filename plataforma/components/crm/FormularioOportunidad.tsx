'use client';
import { useActionState, useEffect, useState } from 'react';
import { guardarOportunidad } from '@/app/subcuenta/[id]/oportunidades/acciones';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloInput } from '@/components/ui/clases';
import { SelectorContacto } from './SelectorContacto';
import { ESTADOS_OPORTUNIDAD, type Embudo, type Oportunidad, type Usuario } from '@/lib/crm/tipos';

interface Props {
  subId: string;
  embudos: Embudo[];
  asignables: Usuario[];
  oportunidad?: Oportunidad;
  contactoFijo?: { id: string; nombre: string; apellidos: string; email: string | null; telefono: string };
  embudoInicial?: string;
  etapaInicial?: string;
  moneda: string;
  alGuardar: () => void;
}

export function FormularioOportunidad({ subId, embudos, asignables, oportunidad: o, contactoFijo, embudoInicial, etapaInicial, moneda, alGuardar }: Props) {
  const [estado, accion] = useActionState(guardarOportunidad.bind(null, subId, o?.id ?? null), null);
  const [embudo, setEmbudo] = useState(o?.embudo_id ?? embudoInicial ?? embudos[0]?.id ?? '');
  const [estadoOp, setEstadoOp] = useState(o?.estado ?? 'abierta');
  const etapas = embudos.find((e) => e.id === embudo)?.etapas ?? [];
  useEffect(() => {
    if (estado?.ok) alGuardar();
  }, [estado, alGuardar]);

  return (
    <form action={accion} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Contacto</span>
        {contactoFijo ? (
          <>
            <input type="hidden" name="contacto_id" value={contactoFijo.id} />
            <p className={estiloInput}>{[contactoFijo.nombre, contactoFijo.apellidos].filter(Boolean).join(' ') || contactoFijo.email}</p>
          </>
        ) : (
          <SelectorContacto subId={subId} name="contacto_id" inicial={o?.contacto ?? null} requerido />
        )}
      </div>
      <Campo className="sm:col-span-2" etiqueta="Nombre de la oportunidad" name="nombre" defaultValue={o?.nombre} required maxLength={160} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Embudo</span>
        <select name="embudo_id" value={embudo} onChange={(e) => setEmbudo(e.target.value)} className={estiloInput}>
          {embudos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Etapa</span>
        <select key={embudo} name="etapa_id" defaultValue={o?.embudo_id === embudo ? o.etapa_id : etapaInicial && etapas.some((x) => x.id === etapaInicial) ? etapaInicial : etapas[0]?.id} className={estiloInput}>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </label>
      <Campo etiqueta={`Valor (${moneda})`} name="valor" inputMode="decimal" defaultValue={o ? String(o.valor) : ''} placeholder="0" />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Estado</span>
        <select name="estado" value={estadoOp} onChange={(e) => setEstadoOp(e.target.value as never)} className={estiloInput}>
          {ESTADOS_OPORTUNIDAD.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Propietario</span>
        <select name="propietario_id" defaultValue={o?.propietario_id ?? ''} className={estiloInput}>
          <option value="">Sin asignar</option>
          {asignables.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
        </select>
      </label>
      <Campo etiqueta="Fuente" name="fuente" defaultValue={o?.fuente} maxLength={100} />
      {estadoOp === 'perdida' && (
        <Campo className="sm:col-span-2" etiqueta="Motivo de la pérdida" name="motivo_perdida" defaultValue={o?.motivo_perdida} maxLength={300} />
      )}
      <div className="sm:col-span-2"><Aviso estado={estado} /></div>
      <div className="flex justify-end sm:col-span-2"><BotonEnvio>{o ? 'Guardar' : 'Crear oportunidad'}</BotonEnvio></div>
    </form>
  );
}
