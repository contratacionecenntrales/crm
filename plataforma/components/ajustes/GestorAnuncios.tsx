'use client';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { Activity, Bell, Flag, Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { alternarAnuncio, borrarAnuncio, guardarAnuncio } from '@/app/agencia/configuracion/acciones';
import { Modal } from '@/components/ui/Modal';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloArea, estiloInput } from '@/components/ui/clases';
import { Interruptor } from './Piezas';
import type { Resultado } from '@/lib/tipos';

export interface Anuncio {
  id: string; titulo: string; cuerpo: string; enlace: string; prioridad: 'general' | 'advertencia' | 'critico';
  frecuencia: 'una_vez' | 'a_diario' | 'siempre'; activo: boolean; subcuentas: string[];
}
const PRIORIDAD = { general: ['General', 'text-texto'], advertencia: ['Advertencia', 'text-[#b42318]'], critico: ['Crítico', 'text-[#b42318] font-medium'] } as const;
const FRECUENCIA = { una_vez: 'Una vez', a_diario: 'A diario', siempre: 'Siempre' };

export function GestorAnuncios({ anuncios, subcuentas }: { anuncios: Anuncio[]; subcuentas: { id: string; nombre: string }[] }) {
  const [filtro, setFiltro] = useState<'' | Anuncio['prioridad']>('');
  const [q, setQ] = useState('');
  const [dialogo, setDialogo] = useState<null | 'nuevo' | Anuncio>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [, iniciar] = useTransition();
  const lista = useMemo(() => anuncios.filter((a) => (!filtro || a.prioridad === filtro) && (!q || a.titulo.toLowerCase().includes(q.toLowerCase()))), [anuncios, filtro, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-texto">Avisos</h1>
          <p className="text-xs text-tenue">Gestione y controle fácilmente los avisos enviados a las subcuentas.</p>
        </div>
        <button className={`${estilosBoton.primario} h-8`} onClick={() => setDialogo('nuevo')}><Plus className="size-4" /> Añadir anuncio personalizado</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md bg-superficie-2 p-0.5 text-sm">
          {([['', 'Todo'], ['critico', 'Crítico'], ['advertencia', 'Advertencia'], ['general', 'General']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setFiltro(k)} className={`rounded px-3 py-1 ${filtro === k ? 'bg-superficie font-medium shadow-xs' : 'text-texto-2'}`}>{t}</button>
          ))}
        </div>
        <div className="flex-1" />
        <label className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${estiloInput} h-7 w-48 pl-7`} /></label>
      </div>
      {aviso && !aviso.ok && <div className="mb-3"><Aviso estado={aviso} /></div>}
      <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="border-b border-borde text-left text-texto">
            <tr>
              <th className="px-3 py-2.5 font-semibold"><span className="flex items-center gap-2"><Bell className="size-4" />Avisos</span></th>
              <th className="w-36 border-l border-borde px-3 py-2.5 font-semibold"><span className="flex items-center gap-2"><Flag className="size-4" />Prioridad</span></th>
              <th className="w-36 border-l border-borde px-3 py-2.5 font-semibold"><span className="flex items-center gap-2"><Layers className="size-4" />Destino</span></th>
              <th className="w-36 border-l border-borde px-3 py-2.5 font-semibold"><span className="flex items-center gap-2"><Activity className="size-4" />Frecuencia</span></th>
              <th className="w-24 border-l border-borde px-3 py-2.5 font-semibold">Estado</th>
              <th className="w-24 border-l border-borde px-3 py-2.5 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-tenue">Aún no hay avisos. Los avisos aparecen como banner en las subcuentas elegidas.</td></tr>}
            {lista.map((a) => (
              <tr key={a.id} className="border-b border-borde last:border-0">
                <td className="px-3 py-2.5 text-texto">{a.titulo}</td>
                <td className={`px-3 py-2.5 ${PRIORIDAD[a.prioridad][1]}`}>{PRIORIDAD[a.prioridad][0]}</td>
                <td className="px-3 py-2.5 text-texto-2">{a.subcuentas.length ? `${a.subcuentas.length} subcuentas` : 'Todas'}</td>
                <td className="px-3 py-2.5 text-texto-2">{FRECUENCIA[a.frecuencia]}</td>
                <td className="px-3 py-2.5"><Interruptor defaultChecked={a.activo} onChange={(v) => iniciar(async () => setAviso(await alternarAnuncio(a.id, v)))} /></td>
                <td className="px-3 py-2.5 text-center">
                  <button onClick={() => setDialogo(a)} aria-label="Editar aviso" className="rounded p-1 text-texto-2 hover:text-primario"><Pencil className="size-4" /></button>
                  <button aria-label="Borrar aviso" className="rounded p-1 text-texto-2 hover:text-peligro"
                    onClick={() => confirm('¿Borrar este aviso?') && iniciar(async () => setAviso(await borrarAnuncio(a.id)))}><Trash2 className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal abierto={dialogo !== null} alCerrar={() => setDialogo(null)} titulo={dialogo === 'nuevo' ? 'Nuevo aviso' : 'Editar aviso'} ancho="max-w-2xl">
        {dialogo !== null && <FormAnuncio anuncio={dialogo === 'nuevo' ? undefined : dialogo} subcuentas={subcuentas} alTerminar={() => setDialogo(null)} />}
      </Modal>
    </div>
  );
}

function FormAnuncio({ anuncio: a, subcuentas, alTerminar }: { anuncio?: Anuncio; subcuentas: { id: string; nombre: string }[]; alTerminar: () => void }) {
  const [estado, accion] = useActionState(guardarAnuncio.bind(null, a?.id ?? null), null);
  const [todas, setTodas] = useState(!a || a.subcuentas.length === 0);
  useEffect(() => { if (estado?.ok) alTerminar(); }, [estado]); // solo al cambiar el resultado: el callback puede cambiar en cada render
  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Título" name="titulo" defaultValue={a?.titulo} required maxLength={160} />
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Mensaje</span>
        <textarea name="cuerpo" defaultValue={a?.cuerpo} rows={3} maxLength={2000} className={estiloArea} /></label>
      <Campo etiqueta="Enlace (opcional)" name="enlace" type="url" placeholder="https://" defaultValue={a?.enlace} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-medium">Prioridad</span>
          <select name="prioridad" defaultValue={a?.prioridad ?? 'general'} className={estiloInput}>
            <option value="general">General</option><option value="advertencia">Advertencia</option><option value="critico">Crítico</option>
          </select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium">Frecuencia</span>
          <select name="frecuencia" defaultValue={a?.frecuencia ?? 'una_vez'} className={estiloInput}>
            <option value="una_vez">Una vez (hasta que lo cierren)</option><option value="a_diario">A diario</option><option value="siempre">Siempre</option>
          </select></label>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Destino</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="size-4" /> Todas las subcuentas</label>
        {!todas && (
          <div className="mt-2 grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded border p-2 sm:grid-cols-2">
            {subcuentas.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="subcuentas" value={s.id} defaultChecked={a?.subcuentas.includes(s.id)} className="size-4" />{s.nombre}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <Interruptor name="activo" defaultChecked={a?.activo ?? true} etiqueta="Activo" />
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}
