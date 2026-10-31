'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { estilosBoton, estiloInput, estiloInputBase } from '@/components/ui/clases';
import { FilaTarea, FormularioTarea } from './Tareas';
import type { Tarea, Usuario } from '@/lib/crm/tipos';

export function ListaTareas({ subId, tareas, asignables, zona, yo, estado }: { subId: string; tareas: Tarea[]; asignables: Usuario[]; zona: string; yo: string; estado: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [editar, setEditar] = useState<Tarea | 'nueva' | null>(null);
  const cerrar = useCallback(() => setEditar(null), []);
  useEffect(() => {
    if (sp.get('nueva') === '1') setEditar('nueva');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const poner = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.push(`${ruta}?${n.toString()}`);
  };
  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-lg border border-borde bg-superficie">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <div className="flex rounded-lg border p-0.5 text-sm">
            {[['pendientes', 'Pendiente'], ['completadas', 'Completadas'], ['todas', 'Todas']].map(([k, t]) => (
              <button key={k} onClick={() => poner('estado', k === 'pendientes' ? '' : k)}
                className={`rounded-md px-3 py-1.5 ${estado === k ? 'bg-primario text-white' : 'text-tenue'}`}>{t}</button>
            ))}
          </div>
          <select value={sp.get('asignado') ?? ''} onChange={(e) => poner('asignado', e.target.value)} className={`${estiloInputBase} w-auto`} aria-label="Asignado">
            <option value="">Todos los usuarios</option>
            <option value="yo">Asignadas a mí</option>
            {asignables.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
          </select>
          <span className="text-sm text-tenue">Ordenadas por fecha de vencimiento</span>
          <div className="flex-1" />
          <button className={estilosBoton.primario} onClick={() => setEditar('nueva')}><Plus className="size-4" /> Nueva tarea</button>
        </div>
        <ul className="divide-y">
          {tareas.length === 0 && <li className="px-4 py-12 text-center text-sm text-tenue">No hay tareas en esta vista.</li>}
          {tareas.map((t) => <FilaTarea key={t.id} subId={subId} t={t} asignables={asignables} zona={zona} conContacto alEditar={setEditar} />)}
        </ul>
      </div>
      <Modal abierto={editar !== null} alCerrar={cerrar} titulo={editar === 'nueva' ? 'Nueva tarea' : 'Editar tarea'}>
        {editar !== null && <FormularioTarea subId={subId} tarea={editar === 'nueva' ? undefined : editar} asignables={asignables} yo={yo} zona={zona} alGuardar={cerrar} />}
      </Modal>
    </div>
  );
}
