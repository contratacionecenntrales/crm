'use client';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, CalendarDays, CircleArrowDown, MoreVertical, Search } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { estilosBoton } from '@/components/ui/clases';
import type { AccionLote, Filtro, Usuario } from '@/lib/crm/tipos';

const OPERACION: Record<string, string> = {
  exportar: 'Export', importar: 'Import', 'añadir_etiqueta': 'Añadir etiqueta', quitar_etiqueta: 'Quitar etiqueta',
  asignar_propietario: 'Asignar', borrar: 'Borrar',
};
const ESTADO = {
  completada: ['Completar', 'bg-green-100 text-green-800'],
  en_curso: ['En curso', 'bg-blue-100 text-blue-800'],
  error: ['Error', 'bg-red-100 text-red-800'],
} as const;

type Lote = AccionLote & { detalle: Record<string, unknown> };

export function TablaLotes({ subId, lotes, haySiguiente, pagina, usuarios, zona, desde, hasta }: {
  subId: string; lotes: Lote[]; haySiguiente: boolean; pagina: number; usuarios: Usuario[]; zona: string; desde: string; hasta: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [detalle, setDetalle] = useState<Lote | null>(null);
  const poner = (cambios: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) (v ? n.set(k, v) : n.delete(k));
    if (!('p' in cambios)) n.delete('p');
    router.push(`${ruta}?${n.toString()}`);
  };
  const f = (v: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return (
      <>
        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: zona }).format(d)}
        <span className="text-[11px]">{new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: zona }).format(d)}</span>
      </>
    );
  };
  const urlRepetir = (l: Lote) => {
    const filtros = (l.detalle?.filtros as Filtro[] | undefined) ?? [];
    const q = new URLSearchParams();
    if (filtros.length) q.set('f', JSON.stringify(filtros));
    if (l.detalle?.busqueda) q.set('q', String(l.detalle.busqueda));
    return `/subcuenta/${subId}/contactos/exportar?${q.toString()}`;
  };
  const sel = 'h-7 w-[200px] appearance-none rounded border border-borde-fuerte bg-superficie py-1 pl-7 pr-7 text-sm text-texto shadow-xs';
  const th = 'border-l border-borde-fuerte px-3 py-2 text-left text-sm font-semibold text-texto first:border-l-0';
  const td = 'border-l border-borde-fuerte px-3 py-2 text-[13px] leading-[19.5px] text-[#475467] first:border-l-0 dark:text-texto-2';

  return (
    <div className="mt-4 rounded-lg border border-borde bg-superficie p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-3 pl-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-tenue">Filtros</span>
          <div className="flex h-7 items-center rounded border border-borde-fuerte bg-superficie shadow-xs">
            <label className="flex items-center gap-1 px-1.5"><CalendarDays className="size-3.5 text-tenue" />
              <input type="date" value={desde} max={hasta} onChange={(e) => poner({ desde: e.target.value })} aria-label="Desde" className="bg-transparent text-sm text-texto outline-none" /></label>
            <span className="h-full w-px bg-borde-fuerte" />
            <label className="flex items-center gap-1 px-1.5"><CalendarDays className="size-3.5 text-tenue" />
              <input type="date" value={hasta} min={desde} onChange={(e) => poner({ hasta: e.target.value })} aria-label="Hasta" className="bg-transparent text-sm text-texto outline-none" /></label>
          </div>
        </div>
        {([
          ['estado', 'Todos los estados', [['completada', 'Completada'], ['en_curso', 'En curso'], ['error', 'Error']]],
          ['operacion', 'Todas las acciones', Object.entries(OPERACION)],
          ['usuario', 'Todos los usuarios', usuarios.map((u) => [u.usuario_id, u.nombre || u.email])],
        ] as [string, string, string[][]][]).map(([k, t, ops]) => (
          <label key={k} className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-tenue" />
            <select aria-label={t} value={sp.get(k) ?? ''} onChange={(e) => poner({ [k]: e.target.value })} className={sel}>
              <option value="">{t}</option>
              {ops.map(([v, x]) => <option key={v} value={v}>{x}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-borde-fuerte">
        <table className="w-full min-w-[60rem] border-collapse">
          <thead>
            <tr className="border-b border-borde-fuerte">
              {['Etiqueta de acción', 'Operación', 'Estado', 'Usuario', `Creado (${abreviaturaZona(zona)})`, `Completado (${abreviaturaZona(zona)})`, 'Estadísticas', 'Acciones']
                .map((h) => <th key={h} className={th}><span className="block truncate">{h}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {lotes.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-tenue">No hay acciones en lote en estas fechas.</td></tr>}
            {lotes.map((l) => {
              const u = usuarios.find((x) => x.usuario_id === l.usuario_id);
              const [texto, color] = ESTADO[l.estado];
              return (
                <tr key={l.id} className="border-b border-borde-fuerte last:border-b-0 hover:bg-superficie-2">
                  <td className={`${td} max-w-56`}><span className="line-clamp-1 break-all text-xs">{l.etiqueta}</span></td>
                  <td className={td}><span className="text-xs">{OPERACION[l.operacion] ?? l.operacion}</span></td>
                  <td className={td}><span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium leading-4 ${color}`}>{texto}</span></td>
                  <td className={td}>
                    <span className="flex items-center gap-2 text-xs"><Avatar nombre={u?.nombre || u?.email || '?'} tam="size-6 text-[11px]" pastel />{u ? u.nombre || u.email : '—'}</span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-xs`} suppressHydrationWarning>{f(l.creado)}</td>
                  <td className={`${td} whitespace-nowrap text-xs`} suppressHydrationWarning>{f(l.completado) ?? '—'}</td>
                  <td className={`${td} text-center`}>
                    {l.operacion === 'exportar' ? (
                      <a href={urlRepetir(l)} title="Descargar de nuevo (datos actuales)" aria-label="Descargar de nuevo" className="inline-flex text-[#475467] hover:text-primario">
                        <CircleArrowDown className="size-4" />
                      </a>
                    ) : (
                      <button onClick={() => setDetalle(l)} title="Ver estadísticas" aria-label="Ver estadísticas" className="inline-flex text-[#475467] hover:text-primario">
                        <BarChart3 className="size-4" />
                      </button>
                    )}
                  </td>
                  <td className={`${td} text-center`}>
                    <button onClick={() => setDetalle(l)} aria-label="Más detalles" className="inline-flex text-texto hover:text-primario"><MoreVertical className="size-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-tenue">Página {pagina}</span>
        <div className="flex gap-2">
          <button disabled={pagina <= 1} onClick={() => poner({ p: String(pagina - 1) })} className="h-6 rounded border border-borde-fuerte px-1.5 text-[11px] font-semibold text-[#475467] shadow-xs disabled:opacity-40">Anterior</button>
          <button disabled={!haySiguiente} onClick={() => poner({ p: String(pagina + 1) })} className="h-6 rounded border border-borde-fuerte px-1.5 text-[11px] font-semibold text-[#475467] shadow-xs disabled:opacity-40">Siguiente</button>
        </div>
      </div>

      <Modal abierto={detalle !== null} alCerrar={() => setDetalle(null)} titulo={detalle ? `Estadísticas · ${detalle.etiqueta}` : ''}>
        {detalle && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[['Total', detalle.total, 'text-texto'], ['Correctos', detalle.correctos, 'text-exito'], ['Con error', detalle.errores, 'text-peligro']].map(([t, n, c]) => (
                <div key={String(t)} className="rounded-lg border p-3"><p className={`text-2xl font-semibold ${c}`}>{String(n)}</p><p className="text-xs text-tenue">{t}</p></div>
              ))}
            </div>
            {Array.isArray(detalle.detalle?.muestra_errores) && (detalle.detalle.muestra_errores as { fila: number; motivo: string }[]).length > 0 && (
              <div>
                <p className="mb-1 font-medium">Errores (muestra)</p>
                <ul className="max-h-60 overflow-y-auto rounded border text-xs">
                  {(detalle.detalle.muestra_errores as { fila: number; motivo: string }[]).map((e, i) => <li key={i} className="border-b px-3 py-1.5 last:border-0">Fila {e.fila}: {e.motivo}</li>)}
                </ul>
              </div>
            )}
            {detalle.detalle?.valor != null && <p>Valor aplicado: <strong>{String(detalle.detalle.valor)}</strong></p>}
            <div className="flex justify-end"><button className={estilosBoton.secundario} onClick={() => setDetalle(null)}>Cerrar</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function abreviaturaZona(zona: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value?.replace(/GMT\+1|GMT\+2/, 'CET') ?? zona;
  } catch {
    return zona;
  }
}
