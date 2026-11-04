'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { borrarEnlace, guardarEnlace, ordenarEnlaces } from '@/app/agencia/configuracion/acciones-enlaces';
import { Modal } from '@/components/ui/Modal';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import { ICONOS } from '@/components/shell/iconos';
import { ICONOS_ENLACE, type EnlaceMenu } from '@/lib/menu/enlaces';
import type { Resultado } from '@/lib/tipos';

export function GestorEnlaces({ enlaces, subcuentas }: { enlaces: EnlaceMenu[]; subcuentas: { id: string; nombre: string }[] }) {
  const [dialogo, setDialogo] = useState<null | 'nuevo' | EnlaceMenu>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const nombreSub = (id: string) => subcuentas.find((s) => s.id === id)?.nombre ?? 'Subcuenta';

  const mover = (i: number, d: -1 | 1) => {
    const ids = enlaces.map((e) => e.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    iniciar(async () => setAviso(await ordenarEnlaces(ids)));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Enlaces de menú personalizados</h1>
          <p className="text-xs text-tenue">Añade enlaces a la barra lateral de la agencia y de tus subcuentas: tus herramientas, formación, soporte…</p>
        </div>
        <button onClick={() => setDialogo('nuevo')} className={`${estilosBoton.primario} inline-flex items-center gap-1.5`}>
          <Plus className="size-4" /> Añadir enlace
        </button>
      </div>
      {aviso && !aviso.ok && <div className="mb-3"><Aviso estado={aviso} /></div>}

      <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-borde bg-superficie-2 text-left text-xs font-medium text-tenue">
            <tr><th className="px-4 py-2.5">Nombre</th><th className="px-3 py-2.5">URL</th><th className="px-3 py-2.5">Se abre</th><th className="px-3 py-2.5">Visible en</th><th className="px-3 py-2.5 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {enlaces.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-tenue">Aún no hay enlaces. Pulsa «Añadir enlace» para crear el primero.</td></tr>
            )}
            {enlaces.map((e, i) => {
              const Icono = ICONOS[e.icono] ?? ICONOS.enlace;
              const donde = [e.en_agencia && 'Agencia', e.en_subcuentas && (e.subcuentas.length ? e.subcuentas.map(nombreSub).join(', ') : 'Todas las subcuentas')].filter(Boolean).join(' · ');
              return (
                <tr key={e.id}>
                  <td className="px-4 py-2.5"><span className="flex items-center gap-2 font-medium text-texto"><Icono className="size-4 text-tenue" />{e.nombre}</span></td>
                  <td className="max-w-64 px-3 py-2.5"><a href={e.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-primario-texto hover:underline"><span className="truncate">{e.url}</span><ExternalLink className="size-3 shrink-0" /></a></td>
                  <td className="px-3 py-2.5 text-texto-2">{e.modo === 'iframe' ? 'Dentro de la app' : 'En otra pestaña'}</td>
                  <td className="max-w-56 truncate px-3 py-2.5 text-texto-2" title={donde}>{donde}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button disabled={pendiente || i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${e.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-primario disabled:opacity-30"><ArrowUp className="size-4" /></button>
                    <button disabled={pendiente || i === enlaces.length - 1} onClick={() => mover(i, 1)} aria-label={`Bajar ${e.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-primario disabled:opacity-30"><ArrowDown className="size-4" /></button>
                    <button onClick={() => setDialogo(e)} aria-label={`Editar ${e.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-primario"><Pencil className="size-4" /></button>
                    <button disabled={pendiente} aria-label={`Borrar ${e.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-peligro"
                      onClick={() => confirm(`¿Borrar el enlace «${e.nombre}»?`) && iniciar(async () => setAviso(await borrarEnlace(e.id)))}>
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-tenue">En la URL puedes usar <code className="rounded bg-superficie-2 px-1">{'{{subcuenta.id}}'}</code> y <code className="rounded bg-superficie-2 px-1">{'{{agencia.id}}'}</code>: se sustituyen por los de quien lo abre.</p>

      <Modal abierto={dialogo !== null} alCerrar={() => setDialogo(null)} titulo={dialogo === 'nuevo' ? 'Añadir enlace' : 'Editar enlace'}>
        {dialogo !== null && (
          <FormEnlace key={dialogo === 'nuevo' ? 'nuevo' : dialogo.id} enlace={dialogo === 'nuevo' ? undefined : dialogo} subcuentas={subcuentas} alTerminar={() => setDialogo(null)} />
        )}
      </Modal>
    </div>
  );
}

function FormEnlace({ enlace: e, subcuentas, alTerminar }: { enlace?: EnlaceMenu; subcuentas: { id: string; nombre: string }[]; alTerminar: () => void }) {
  const [estado, accion] = useActionState(guardarEnlace.bind(null, e?.id ?? null), null);
  const [enSubs, setEnSubs] = useState(e?.en_subcuentas ?? true);
  const [todas, setTodas] = useState(!e || e.subcuentas.length === 0);
  const [icono, setIcono] = useState(e?.icono ?? 'enlace');
  useEffect(() => {
    if (estado?.ok) alTerminar();
  }, [estado]); // solo al cambiar el resultado

  return (
    <form action={accion} className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre</span>
        <input name="nombre" required maxLength={40} defaultValue={e?.nombre} placeholder="Ej. Formación" className={estiloInput} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">URL</span>
        <input name="url" type="url" required maxLength={1000} defaultValue={e?.url} placeholder="https://…" className={estiloInput} /></label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Icono</legend>
        <input type="hidden" name="icono" value={icono} />
        <div className="flex flex-wrap gap-1.5">
          {ICONOS_ENLACE.map(([v, texto]) => {
            const I = ICONOS[v];
            return (
              <button key={v} type="button" onClick={() => setIcono(v)} aria-pressed={icono === v} title={texto} aria-label={texto}
                className={`flex size-9 items-center justify-center rounded-md border ${icono === v ? 'border-primario bg-primario-suave text-primario' : 'border-borde-fuerte text-texto-2 hover:bg-superficie-2'}`}>
                <I className="size-4" />
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Cómo se abre</span>
        <select name="modo" defaultValue={e?.modo ?? 'pestana'} className={estiloInput}>
          <option value="pestana">En otra pestaña</option>
          <option value="iframe">Dentro de la app (si la web lo permite)</option>
        </select></label>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">Dónde se muestra</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="en_agencia" defaultChecked={e?.en_agencia ?? true} className="size-4" /> En la vista de agencia</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="en_subcuentas" checked={enSubs} onChange={(x) => setEnSubs(x.target.checked)} className="size-4" /> En las subcuentas</label>
        {enSubs && (
          <div className="ml-6 space-y-2">
            <input type="hidden" name="destino" value={todas ? 'todas' : 'algunas'} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todas} onChange={(x) => setTodas(x.target.checked)} className="size-4" /> Todas las subcuentas</label>
            {!todas && (
              <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded border border-borde p-2 sm:grid-cols-2">
                {subcuentas.length === 0 && <p className="text-xs text-tenue">No hay subcuentas.</p>}
                {subcuentas.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="subcuentas" value={s.id} defaultChecked={e?.subcuentas.includes(s.id)} className="size-4" />{s.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </fieldset>
      <Aviso estado={estado} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={alTerminar} className={estilosBoton.secundario}>Cancelar</button>
        <BotonEnvio>Guardar</BotonEnvio>
      </div>
    </form>
  );
}
