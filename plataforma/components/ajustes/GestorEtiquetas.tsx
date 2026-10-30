'use client';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { borrarEtiquetas, guardarEtiqueta } from '@/app/subcuenta/[id]/contactos/acciones';
import { Modal } from '@/components/ui/Modal';
import { Campo } from '@/components/ui/Campo';
import { BotonEnvio } from '@/components/ui/BotonEnvio';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import type { Resultado } from '@/lib/tipos';

export interface FilaEtiqueta { nombre: string; descripcion: string; categoria: string; contactos: number }

export function GestorEtiquetas({ subId, etiquetas, soyAdmin, pestana }: { subId: string; etiquetas: FilaEtiqueta[]; soyAdmin: boolean; pestana: 'etiquetas' | 'categorias' }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<null | 'nueva' | FilaEtiqueta>(null);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const lista = useMemo(() => etiquetas.filter((e) => !q || e.nombre.toLowerCase().includes(q.toLowerCase()) || e.descripcion.toLowerCase().includes(q.toLowerCase())), [etiquetas, q]);
  const categorias = useMemo(() => {
    const m = new Map<string, { n: number; contactos: number }>();
    for (const e of etiquetas) {
      const k = e.categoria || 'Sin categoría';
      const v = m.get(k) ?? { n: 0, contactos: 0 };
      m.set(k, { n: v.n + 1, contactos: v.contactos + e.contactos });
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [etiquetas]);
  const th = 'border-l border-borde px-3 py-2.5 text-left font-semibold text-texto first:border-l-0';

  return (
    <div>
      <h1 className="text-lg font-semibold text-texto">Etiquetas</h1>
      <p className="text-xs text-tenue">Cree y gestione etiquetas para los contactos para facilitar la organización de los datos y la ejecución de automatizaciones</p>
      <nav className="mt-4 flex gap-6 border-b border-borde text-sm">
        {(['etiquetas', 'categorias'] as const).map((p) => (
          <Link key={p} href={`?tab=${p}`} className={`-mb-px border-b-2 pb-2 font-medium ${pestana === p ? 'border-primario text-primario' : 'border-transparent text-texto'}`}>
            {p === 'etiquetas' ? 'Etiquetas' : 'Categorías'}
          </Link>
        ))}
      </nav>
      {aviso && <div className="mt-3"><Aviso estado={aviso} /></div>}

      {pestana === 'etiquetas' ? (
        <>
          <div className="my-3 flex flex-wrap items-center gap-2">
            <label className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar etiquetas" className={`${estiloInput} w-64 pl-8`} /></label>
            {sel.size > 0 && soyAdmin && (
              <button disabled={pendiente} className={`${estilosBoton.secundario} h-8 text-peligro`}
                onClick={() => confirm(`¿Borrar ${sel.size} etiquetas? Se quitarán de todos los contactos.`) &&
                  iniciar(async () => { setAviso(await borrarEtiquetas(subId, [...sel])); setSel(new Set()); })}>
                <Trash2 className="size-4" /> Borrar {sel.size}
              </button>
            )}
            <div className="flex-1" />
            {soyAdmin && <button className={`${estilosBoton.primario} h-8`} onClick={() => setDialogo('nueva')}><Plus className="size-4" /> Nueva etiqueta</button>}
          </div>
          <div className="overflow-x-auto rounded border border-borde bg-superficie">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-borde">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" aria-label="Seleccionar todas" className="size-4" checked={lista.length > 0 && lista.every((e) => sel.has(e.nombre))}
                      onChange={(e) => setSel(e.target.checked ? new Set(lista.map((x) => x.nombre)) : new Set())} />
                  </th>
                  <th className={th}>Nombre de la etiqueta</th><th className={th}>Descripción</th><th className={th}>Categoría</th>
                  <th className={`${th} w-28`}>Contactos</th><th className={`${th} w-24 text-center`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-tenue">Sin etiquetas. Se crean solas al etiquetar contactos, o desde aquí.</td></tr>}
                {lista.map((e) => (
                  <tr key={e.nombre} className="border-b border-borde last:border-0">
                    <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Seleccionar ${e.nombre}`} className="size-4" checked={sel.has(e.nombre)}
                      onChange={() => setSel((s) => { const n = new Set(s); if (n.has(e.nombre)) n.delete(e.nombre); else n.add(e.nombre); return n; })} /></td>
                    <td className="px-3 py-2.5 font-medium text-texto">{e.nombre}</td>
                    <td className="px-3 py-2.5 text-texto-2">{e.descripcion || '—'}</td>
                    <td className="px-3 py-2.5 text-texto-2">{e.categoria || '—'}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/subcuenta/${subId}/contactos?f=${encodeURIComponent(JSON.stringify([{ campo: 'etiquetas', op: 'incluye', valor: e.nombre }]))}`} className="text-primario hover:underline">{e.contactos}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {soyAdmin && <button onClick={() => setDialogo(e)} aria-label={`Editar ${e.nombre}`} className="rounded p-1 text-texto-2 hover:text-primario"><Pencil className="size-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-3 overflow-x-auto rounded border border-borde bg-superficie">
          <table className="w-full text-sm">
            <thead className="border-b border-borde"><tr><th className={th}>Categoría</th><th className={th}>Etiquetas</th><th className={th}>Contactos etiquetados</th></tr></thead>
            <tbody>
              {categorias.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-tenue">Sin categorías. Asigna una categoría al editar una etiqueta.</td></tr>}
              {categorias.map(([c, v]) => (
                <tr key={c} className="border-b border-borde last:border-0"><td className="px-3 py-2.5 font-medium">{c}</td><td className="px-3 py-2.5">{v.n}</td><td className="px-3 py-2.5">{v.contactos}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal abierto={dialogo !== null} alCerrar={() => setDialogo(null)} titulo={dialogo === 'nueva' ? 'Nueva etiqueta' : 'Editar etiqueta'}>
        {dialogo !== null && (
          <FormEtiqueta subId={subId} etiqueta={dialogo === 'nueva' ? undefined : dialogo} categorias={categorias.map(([c]) => c).filter((c) => c !== 'Sin categoría')} alTerminar={() => setDialogo(null)} />
        )}
      </Modal>
    </div>
  );
}

function FormEtiqueta({ subId, etiqueta: e, categorias, alTerminar }: { subId: string; etiqueta?: FilaEtiqueta; categorias: string[]; alTerminar: () => void }) {
  const [estado, accion] = useActionState(guardarEtiqueta.bind(null, subId, e?.nombre ?? null), null);
  useEffect(() => { if (estado?.ok) alTerminar(); }, [estado, alTerminar]);
  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Nombre" name="nombre" defaultValue={e?.nombre} required maxLength={60} ayuda={e ? `Al renombrarla se cambia en sus ${e.contactos} contactos.` : undefined} />
      <Campo etiqueta="Descripción" name="descripcion" defaultValue={e?.descripcion} maxLength={300} />
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Categoría</span>
        <input name="categoria" list="cats" defaultValue={e?.categoria} maxLength={60} className={estiloInput} />
        <datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist></label>
      <Aviso estado={estado} />
      <div className="flex justify-end"><BotonEnvio>Guardar</BotonEnvio></div>
    </form>
  );
}
