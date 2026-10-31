'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { borrarBloqueo, guardarBloqueo } from '@/app/subcuenta/[id]/calendarios/acciones';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estiloInput, estilosBoton } from '@/components/ui/clases';
import { diaEn, horaEn, sumarDias, type Dia } from '@/lib/calendario/tiempo';
import { nombrePersona, type Bloqueo, type Calendario } from '@/lib/calendario/tipos';
import type { Usuario } from '@/lib/crm/tipos';

const etiqueta = 'mb-1.5 block text-sm font-medium text-[#344054] dark:text-texto-2';

export function FormularioBloqueo({ subId, zona, bloqueo, preset, calendarios, usuarios, alGuardar, alBorrar }: {
  subId: string;
  zona: string;
  bloqueo?: Bloqueo | null;
  preset?: { fecha: Dia; hora?: string };
  calendarios: Calendario[];
  usuarios: Usuario[];
  alGuardar: () => void;
  alBorrar?: () => void;
}) {
  const [estado, accion] = useActionState(guardarBloqueo.bind(null, subId, bloqueo?.id ?? null), null);
  const [todoElDia, setTodoElDia] = useState(bloqueo?.todo_el_dia ?? false);
  const [borrando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (estado?.ok) alGuardar();
  }, [estado]); // solo al cambiar el resultado: el callback puede cambiar en cada render

  const ini = bloqueo ? new Date(bloqueo.inicio) : null;
  const fin = bloqueo ? new Date(bloqueo.fin) : null;
  const fecha = ini ? diaEn(ini, zona) : preset?.fecha ?? diaEn(new Date(), zona);
  // En los de todo el día, el fin guardado es la medianoche siguiente.
  const fechaFin = bloqueo?.todo_el_dia && fin ? sumarDias(diaEn(fin, zona), -1) : '';

  return (
    <form action={accion} className="space-y-4">
      <label className="block">
        <span className={etiqueta}>Título</span>
        <input name="titulo" defaultValue={bloqueo?.titulo ?? ''} maxLength={200} placeholder="Bloqueado" className={estiloInput} />
      </label>
      <label className="flex items-center gap-2 text-sm text-[#344054] dark:text-texto-2">
        <input type="checkbox" name="todo_el_dia" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} className="size-4" />
        Todo el día
      </label>
      {todoElDia ? (
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={etiqueta}>Desde el día</span>
            <input type="date" name="fecha" defaultValue={fecha} required className={estiloInput} />
          </label>
          <label className="block">
            <span className={etiqueta}>Hasta el día</span>
            <input type="date" name="fecha_fin" defaultValue={fechaFin} className={estiloInput} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className={etiqueta}>Fecha</span>
            <input type="date" name="fecha" defaultValue={fecha} required className={estiloInput} />
          </label>
          <label className="block">
            <span className={etiqueta}>Desde</span>
            <input type="time" name="hora_inicio" defaultValue={ini ? horaEn(ini, zona) : preset?.hora ?? '09:00'} required className={estiloInput} />
          </label>
          <label className="block">
            <span className={etiqueta}>Hasta</span>
            <input type="time" name="hora_fin" defaultValue={fin ? horaEn(fin, zona) : preset?.hora ? `${String(Math.min(23, Number(preset.hora.slice(0, 2)) + 1)).padStart(2, '0')}:${preset.hora.slice(3)}` : '10:00'} required className={estiloInput} />
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Calendario</span>
          <select name="calendario_id" defaultValue={bloqueo?.calendario_id ?? ''} className={estiloInput}>
            <option value="">Todos los calendarios</option>
            {calendarios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={etiqueta}>Persona</span>
          <select name="usuario_id" defaultValue={bloqueo?.usuario_id ?? ''} className={estiloInput}>
            <option value="">Todo el equipo</option>
            {usuarios.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{nombrePersona(u)}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-tenue">Mientras dure la franja, nadie podrá reservar en la página pública en esos calendarios o con esa persona.</p>
      <Aviso estado={estado} />
      {error && <Aviso estado={{ ok: false, error }} />}
      <div className="flex items-center justify-between gap-2 border-t pt-4">
        {bloqueo && alBorrar ? (
          <button type="button" disabled={borrando} className={`${estilosBoton.fantasma} text-peligro hover:text-peligro`}
            onClick={() => confirm('¿Quitar esta franja bloqueada?') && iniciar(async () => {
              const r = await borrarBloqueo(subId, bloqueo.id);
              if (r.ok) alBorrar(); else setError(r.error ?? 'No se pudo borrar.');
            })}>
            <Trash2 className="size-4" /> Quitar
          </button>
        ) : <span />}
        <BotonEnvio>{bloqueo ? 'Guardar' : 'Bloquear franja'}</BotonEnvio>
      </div>
    </form>
  );
}
