'use client';
import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { CalendarClock, Pencil, Trash2 } from 'lucide-react';
import { alternarTarea, borrarTarea, guardarTarea } from '@/app/subcuenta/[id]/contactos/acciones';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloInput, estiloArea } from '@/components/ui/clases';
import { SelectorContacto } from './SelectorContacto';
import { nombreContacto, type Tarea, type Usuario } from '@/lib/crm/tipos';
import { diaEn, horaEn } from '@/lib/calendario/tiempo';

// "AAAA-MM-DDTHH:MM" en la zona de la subcuenta, para <input type="datetime-local">.
function aLocal(iso: string | null, zona: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${diaEn(d, zona)}T${horaEn(d, zona)}`;
}

export function FormularioTarea({ subId, tarea, contactoFijo, asignables, yo, zona, alGuardar }: {
  subId: string; tarea?: Tarea; contactoFijo?: string; asignables: Usuario[]; yo: string; zona: string; alGuardar: () => void;
}) {
  const [estado, accion] = useActionState(guardarTarea.bind(null, subId, tarea?.id ?? null), null);
  useEffect(() => {
    if (estado?.ok) alGuardar();
  }, [estado]); // solo al cambiar el resultado: el callback puede cambiar en cada render
  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Título" name="titulo" defaultValue={tarea?.titulo} required maxLength={200} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Descripción</span>
        <textarea name="descripcion" defaultValue={tarea?.descripcion} rows={3} maxLength={5000} className={estiloArea} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Vence" name="vence" type="datetime-local" defaultValue={aLocal(tarea?.vence ?? null, zona)} ayuda={`Hora de ${zona.replace(/_/g, ' ')}`} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Asignado a</span>
          <select name="asignado_id" defaultValue={tarea ? tarea.asignado_id ?? '' : yo} className={estiloInput}>
            <option value="">Sin asignar</option>
            {asignables.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
          </select>
        </label>
      </div>
      {contactoFijo ? (
        <input type="hidden" name="contacto_id" value={contactoFijo} />
      ) : (
        <div>
          <span className="mb-1 block text-sm font-medium">Contacto (opcional)</span>
          <SelectorContacto subId={subId} name="contacto_id" inicial={tarea?.contacto ?? null} />
        </div>
      )}
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>{tarea ? 'Guardar' : 'Crear tarea'}</BotonEnvio></div>
    </form>
  );
}

export function FilaTarea({ subId, t, asignables, zona, conContacto, alEditar }: {
  subId: string; t: Tarea; asignables: Usuario[]; zona: string; conContacto?: boolean; alEditar: (t: Tarea) => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [hecha, setHecha] = useState(Boolean(t.completada));
  useEffect(() => setHecha(Boolean(t.completada)), [t.completada]);
  const atrasada = !hecha && t.vence && new Date(t.vence) < new Date();
  const asignado = asignables.find((u) => u.usuario_id === t.asignado_id);
  const fecha = t.vence
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: zona }).format(new Date(t.vence))
    : null;
  return (
    <li className={`flex gap-3 px-4 py-3 ${pendiente ? 'opacity-60' : ''}`}>
      <input type="checkbox" checked={hecha} aria-label="Completada" className="mt-1 size-4 shrink-0"
        onChange={(e) => { const v = e.target.checked; setHecha(v); iniciar(async () => void (await alternarTarea(subId, t.id, v))); }} />
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${hecha ? 'text-tenue line-through' : ''}`}>{t.titulo}</p>
        {t.descripcion && <p className="mt-0.5 line-clamp-2 text-sm text-tenue">{t.descripcion}</p>}
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
          {fecha && <span className={`flex items-center gap-1 ${atrasada ? 'font-medium text-peligro' : ''}`}><CalendarClock className="size-3.5" />{atrasada ? 'Atrasado - ' : 'Vence '}{fecha}</span>}
          <span>Asignado a: {asignado ? asignado.nombre || asignado.email : 'Sin asignar'}</span>
          {conContacto && t.contacto && (
            <Link href={`/subcuenta/${subId}/contacto/${t.contacto.id}`} className="text-primario hover:underline">{nombreContacto(t.contacto)}</Link>
          )}
        </p>
      </div>
      <button onClick={() => alEditar(t)} aria-label="Editar tarea" className="self-start rounded p-1 text-tenue hover:text-texto"><Pencil className="size-4" /></button>
      <button onClick={() => confirm('¿Borrar esta tarea?') && iniciar(async () => void (await borrarTarea(subId, t.id)))}
        aria-label="Borrar tarea" className="self-start rounded p-1 text-tenue hover:text-peligro"><Trash2 className="size-4" /></button>
    </li>
  );
}
