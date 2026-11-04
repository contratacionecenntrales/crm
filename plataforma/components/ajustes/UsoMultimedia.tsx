'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDownUp, Search } from 'lucide-react';
import { Insignia } from '@/components/ui/Insignia';
import { estiloInput } from '@/components/ui/clases';
import { CUPO_MEDIOS, tamanoLegible } from '@/lib/medios';

export interface FilaUso { subcuenta_id: string; nombre: string; direccion: string; archivos: number; bytes: number }

export function UsoMultimedia({ filas }: { filas: FilaUso[] }) {
  const [q, setQ] = useState('');
  const [desc, setDesc] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [tam, setTam] = useState(10);
  const lista = useMemo(() => filas
    .filter((f) => !q || f.nombre.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (desc ? b.bytes - a.bytes : a.bytes - b.bytes) || a.nombre.localeCompare(b.nombre, 'es')), [filas, q, desc]);
  const paginas = Math.max(1, Math.ceil(lista.length / tam));
  const vista = lista.slice((pagina - 1) * tam, pagina * tam);
  const total = filas.reduce((s, f) => s + f.bytes, 0);

  return (
    <div>
      <h1 className="mb-5 text-[28px] font-medium leading-9 text-texto">Uso del almacenamiento de contenido multimedia</h1>
      <div className="rounded-lg border border-borde bg-superficie">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borde p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-medium text-texto">Uso de subcuentas <Insignia>{filas.length} Subcuentas</Insignia></h2>
            <p className="text-sm text-tenue">Almacenamiento de contenido multimedia en todas las subcuentas · total {tamanoLegible(total)}</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} placeholder="Buscar por nombres de subcuentas" className={`${estiloInput} pl-9`} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-borde text-left text-xs font-medium text-tenue">
              <tr>
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Archivos</th>
                <th className="px-3 py-2.5">
                  <button onClick={() => setDesc((d) => !d)} className="inline-flex items-center gap-1 hover:text-texto" aria-label="Ordenar por almacenamiento">
                    Almacenamiento utilizado <ArrowDownUp className="size-3.5" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {vista.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-tenue">No hay subcuentas que coincidan.</td></tr>}
              {vista.map((f) => {
                const pct = Math.min(100, (f.bytes / CUPO_MEDIOS) * 100);
                return (
                  <tr key={f.subcuenta_id}>
                    <td className="px-4 py-3">
                      <Link href={`/subcuenta/${f.subcuenta_id}/medios`} className="font-medium text-texto hover:text-primario-texto hover:underline">{f.nombre}</Link>
                      {f.direccion && <p className="text-tenue">{f.direccion}</p>}
                    </td>
                    <td className="px-3 py-3 text-texto-2">{f.archivos}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-texto">{tamanoLegible(f.bytes)}</p>
                      <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
                        <div className={`h-full rounded-full ${pct > 90 ? 'bg-peligro' : 'bg-primario'}`} style={{ width: `${Math.max(pct, f.bytes ? 1 : 0)}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde px-4 py-3 text-sm">
          <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="h-8 rounded border border-borde-fuerte px-3 disabled:opacity-40">Anterior</button>
          <span className="inline-flex size-8 items-center justify-center rounded border border-texto">{pagina}</span>
          <button disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} className="h-8 rounded border border-borde-fuerte px-3 disabled:opacity-40">Siguiente</button>
          <select value={tam} onChange={(e) => { setTam(Number(e.target.value)); setPagina(1); }} aria-label="Filas por página" className="h-8 rounded border border-borde-fuerte bg-superficie px-2">
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / Página</option>)}
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-tenue">Cada subcuenta dispone de {tamanoLegible(CUPO_MEDIOS)} para sus archivos de Medios.</p>
    </div>
  );
}
