'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Copy, Plus, Trash2, Workflow } from 'lucide-react';
import { borrarFlujo, crearFlujo, duplicarFlujo, publicarFlujo } from '@/app/subcuenta/[id]/automatizacion/acciones';
import { Interruptor } from '@/components/ajustes/Piezas';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { estiloInput, estilosBoton } from '@/components/ui/clases';
import { DISPARADORES } from '@/lib/automatizacion/tipos';
import type { Resultado } from '@/lib/tipos';

export interface FilaFlujo { id: string; nombre: string; activo: boolean; disparador: string; pasos: number; actualizado: string; total: number; activos: number; completados: number; ultima: string | null }

const PLANTILLAS = [
  ['vacio', 'Empezar desde cero', 'Elige tú el disparador y los pasos.'],
  ['bienvenida', 'Bienvenida a contactos nuevos', 'Correo de bienvenida y tarea de llamada al día siguiente.'],
  ['no_presentado', 'Recuperar citas perdidas', 'SMS cuando alguien no se presenta a su cita.'],
  ['respuesta', 'Aviso de respuestas', 'Avisa al propietario cuando un cliente escribe.'],
  ['pago', 'Gracias por tu pago', 'Correo de agradecimiento al pagar una factura.'],
] as const;

function Fila({ subId, f, soyAdmin }: { subId: string; f: FilaFlujo; soyAdmin: boolean }) {
  const [activo, setActivo] = useState(f.activo);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fecha = (d: string | null) => (d ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '—');
  return (
    <tr className={`border-t border-borde-fuerte ${pendiente ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <Link href={`/subcuenta/${subId}/automatizacion/${f.id}`} className="font-medium text-primario-texto hover:underline">{f.nombre}</Link>
        <span className="block text-xs text-tenue">{DISPARADORES.find((d) => d.valor === f.disparador)?.texto} · {f.pasos} {f.pasos === 1 ? 'paso' : 'pasos'}</span>
        {error && <span className="block text-xs text-peligro">{error}</span>}
      </td>
      <td className="px-4 py-3">
        <Interruptor checked={activo} disabled={!soyAdmin || pendiente} etiqueta={activo ? 'Publicado' : 'Borrador'}
          onChange={(v) => { setActivo(v); setError(null); iniciar(async () => { const r = await publicarFlujo(subId, f.id, v); if (!r.ok) { setActivo(!v); setError(r.error ?? null); } }); }} />
      </td>
      <td className="px-4 py-3 text-right">{f.total}</td>
      <td className="px-4 py-3 text-right">{f.activos}</td>
      <td className="px-4 py-3 text-right">{f.completados}</td>
      <td className="px-4 py-3">{fecha(f.ultima)}</td>
      <td className="px-4 py-3 text-right">
        {soyAdmin && (
          <div className="flex justify-end gap-1">
            <button type="button" aria-label="Duplicar" title="Duplicar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto"
              onClick={() => iniciar(async () => { const r = await duplicarFlujo(subId, f.id); if (r.ok && r.id) router.push(`/subcuenta/${subId}/automatizacion/${r.id}`); else if (!r.ok) setError(r.error); })}>
              <Copy className="size-4" /></button>
            <button type="button" aria-label="Borrar" title="Borrar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-peligro"
              onClick={() => confirm(`¿Borrar «${f.nombre}» y su historial?`) && iniciar(async () => { const r = await borrarFlujo(subId, f.id); if (!r.ok) setError(r.error ?? null); })}>
              <Trash2 className="size-4" /></button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function ListaFlujos({ subId, flujos, soyAdmin }: { subId: string; flujos: FilaFlujo[]; soyAdmin: boolean }) {
  const [crear, setCrear] = useState(false);
  const [nombre, setNombre] = useState('');
  const [plantilla, setPlantilla] = useState('vacio');
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-4 p-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-texto">Flujos de trabajo</h2>
          <p className="text-sm text-tenue">Automatiza tareas repetitivas: «cuando pase esto, haz esto otro».</p>
        </div>
        {soyAdmin && <button type="button" onClick={() => setCrear(true)} className={estilosBoton.primario}><Plus className="size-4" /> Crear flujo</button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-borde-fuerte bg-superficie">
        <table className="w-full min-w-[860px] text-left text-[13px] text-[#475467] dark:text-texto-2">
          <thead className="bg-superficie-2 text-xs"><tr>
            <th className="px-4 py-2.5 font-medium">Nombre</th><th className="px-4 py-2.5 font-medium">Estado</th>
            <th className="px-4 py-2.5 text-right font-medium">Inscritos</th><th className="px-4 py-2.5 text-right font-medium">En curso</th>
            <th className="px-4 py-2.5 text-right font-medium">Completados</th><th className="px-4 py-2.5 font-medium">Última entrada</th><th />
          </tr></thead>
          <tbody>
            {flujos.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-14 text-center">
                <Workflow className="mx-auto mb-2 size-8 text-tenue" />
                <p className="font-medium text-texto">Todavía no hay flujos</p>
                <p className="text-sm text-tenue">{soyAdmin ? 'Crea el primero desde una plantilla.' : 'Un administrador tiene que crearlos.'}</p>
              </td></tr>
            )}
            {flujos.map((f) => <Fila key={f.id} subId={subId} f={f} soyAdmin={soyAdmin} />)}
          </tbody>
        </table>
      </div>
      <Modal abierto={crear} alCerrar={() => setCrear(false)} titulo="Crear flujo de trabajo" ancho="max-w-xl">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await crearFlujo(subId, nombre, plantilla);
            if (r.ok && r.id) router.push(`/subcuenta/${subId}/automatizacion/${r.id}`); else setAviso(r);
          });
        }}>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2">Nombre</span>
            <input autoFocus required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Bienvenida a leads" className={estiloInput} /></label>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium text-[#344054] dark:text-texto-2">Punto de partida</legend>
            {PLANTILLAS.map(([v, t, d]) => (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${plantilla === v ? 'border-primario bg-primario-suave' : 'border-borde-fuerte'}`}>
                <input type="radio" name="plantilla" checked={plantilla === v} onChange={() => { setPlantilla(v); if (!nombre && v !== 'vacio') setNombre(t); }} className="mt-0.5 size-4 accent-primario" />
                <span><span className="block text-sm font-medium text-texto">{t}</span><span className="text-xs text-tenue">{d}</span></span>
              </label>
            ))}
          </fieldset>
          <Aviso estado={aviso} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCrear(false)} className={estilosBoton.secundario}>Cancelar</button>
            <button disabled={pendiente} className={estilosBoton.primario}>Crear y abrir</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
