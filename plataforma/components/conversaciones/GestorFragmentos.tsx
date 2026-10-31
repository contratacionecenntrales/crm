'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { borrarFragmento, guardarFragmento } from '@/app/subcuenta/[id]/conversaciones/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { estiloArea, estiloInput, estilosBoton } from '@/components/ui/clases';
import type { Fragmento } from '@/lib/conversaciones/tipos';

function Formulario({ subId, f, alGuardar }: { subId: string; f: Fragmento | null; alGuardar: () => void }) {
  const [estado, accion] = useActionState(guardarFragmento.bind(null, subId, f?.id ?? null), null);
  useEffect(() => { if (estado?.ok) alGuardar(); }, [estado]); // solo al cambiar el resultado: el callback puede cambiar en cada render
  return (
    <form action={accion} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2">Nombre</span>
        <input name="nombre" defaultValue={f?.nombre} required maxLength={120} placeholder="Ej. Saludo inicial" className={estiloInput} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2">Texto</span>
        <textarea name="cuerpo" defaultValue={f?.cuerpo} required maxLength={5000} rows={6} className={estiloArea} />
      </label>
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}

export function GestorFragmentos({ subId, fragmentos }: { subId: string; fragmentos: Fragmento[] }) {
  const [editar, setEditar] = useState<Fragmento | null | undefined>(undefined);
  const [busca, setBusca] = useState('');
  const [pendiente, iniciar] = useTransition();
  const t = busca.trim().toLowerCase();
  const lista = fragmentos.filter((f) => !t || f.nombre.toLowerCase().includes(t) || f.cuerpo.toLowerCase().includes(t));
  return (
    <div className="rounded-lg border border-borde-fuerte bg-superficie">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fragmentos" className={`${estiloInput} pl-8`} />
        </div>
        <button type="button" onClick={() => setEditar(null)} className={estilosBoton.primario}><Plus className="size-4" /> Nuevo fragmento</button>
      </div>
      <ul className={`divide-y border-t ${pendiente ? 'opacity-60' : ''}`}>
        {lista.length === 0 && <li className="px-4 py-10 text-center text-sm text-tenue">{fragmentos.length ? 'Ningún fragmento coincide.' : 'Todavía no hay fragmentos.'}</li>}
        {lista.map((f) => (
          <li key={f.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-texto">{f.nombre}</p>
              <p className="line-clamp-2 whitespace-pre-line text-sm text-tenue">{f.cuerpo}</p>
            </div>
            <button type="button" onClick={() => setEditar(f)} aria-label="Editar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-texto"><Pencil className="size-4" /></button>
            <button type="button" aria-label="Borrar" className="rounded p-1.5 text-tenue hover:bg-superficie-2 hover:text-peligro"
              onClick={() => confirm(`¿Borrar «${f.nombre}»?`) && iniciar(async () => { const r = await borrarFragmento(subId, f.id); if (!r.ok) alert(r.error); })}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Modal abierto={editar !== undefined} alCerrar={() => setEditar(undefined)} titulo={editar ? 'Editar fragmento' : 'Nuevo fragmento'}>
        {editar !== undefined && <Formulario key={editar?.id ?? 'nuevo'} subId={subId} f={editar} alGuardar={() => setEditar(undefined)} />}
      </Modal>
    </div>
  );
}
