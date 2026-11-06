'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Copy, ExternalLink, FileText, LayoutTemplate, Lock, MoreVertical, Plus, Search, Trash2 } from 'lucide-react';
import { borrarEmbudo, crearEmbudo, duplicarEmbudo } from '@/app/subcuenta/[id]/embudos/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import { PLANTILLAS } from '@/lib/embudos/plantillas';
import { PLANTILLAS_SITIO } from '@/lib/embudos/sitios';
import type { Contenido } from '@/lib/embudos/tipos';
import { PaginaEmbudo } from './Renderizado';
import { fecha } from '@/lib/formato';
import type { Resultado } from '@/lib/tipos';

export interface EmbudoResumen { id: string; nombre: string; slug: string; publicado: boolean; creado: string; actualizado: string; visitas: number; envios: number; pasos: number }

// Miniatura real de una página (renderizada y reducida).
export function Miniatura({ plantilla, tipo = 'embudo' }: { plantilla: string; tipo?: 'embudo' | 'sitio' }) {
  const contenido: Contenido | undefined = useMemo(() => (tipo === 'sitio' ? PLANTILLAS_SITIO.find((p) => p.id === plantilla)?.paginas()[0]?.contenido : PLANTILLAS.find((p) => p.id === plantilla)?.pasos()[0]?.contenido), [plantilla, tipo]);
  if (!contenido) return <div className="flex h-full items-center justify-center bg-superficie-2"><FileText className="size-8 text-tenue" /></div>;
  return (
    <div className="pointer-events-none h-full overflow-hidden bg-white" aria-hidden inert>
      <div className="w-[400%] origin-top-left scale-[0.25]"><PaginaEmbudo contenido={contenido} ctx={{ pasoId: '', siguiente: null, vistaPrevia: true }} /></div>
    </div>
  );
}

export function ListaEmbudos({ subId, embudos, planIncluye, tipo = 'embudo' }: { subId: string; embudos: EmbudoResumen[]; planIncluye: boolean; tipo?: 'embudo' | 'sitio' }) {
  const sitio = tipo === 'sitio';
  const galeriaItems = sitio
    ? PLANTILLAS_SITIO.map((p) => ({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, categoria: p.categoria, paginas: p.paginas().length }))
    : PLANTILLAS.map((p) => ({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, categoria: p.categoria, paginas: p.pasos().length }));
  const router = useRouter();
  const [q, setQ] = useState('');
  const [galeria, setGaleria] = useState(false);
  const [elegida, setElegida] = useState<string>('');
  const [nombre, setNombre] = useState('');
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const lista = embudos.filter((e) => !q || e.nombre.toLowerCase().includes(q.toLowerCase()));

  if (!planIncluye) return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center font-sans">
      <Lock className="mx-auto size-10 text-tenue" />
      <h1 className="mt-4 text-xl font-semibold text-texto">Tu plan no incluye embudos</h1>
      <p className="mt-2 text-sm text-tenue">Pide a tu agencia que active «Embudos y páginas» en su plan.</p>
    </div>
  );

  return (
    <div className="px-4 py-6 font-sans sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Sitios y embudos</h1>
          <div className="mt-2 flex gap-1" role="tablist">
            <Link role="tab" aria-selected={!sitio} href={`/subcuenta/${subId}/embudos`} className={`rounded-md px-3 py-1.5 text-sm ${!sitio ? 'bg-primario-suave font-medium text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>Embudos</Link>
            <Link role="tab" aria-selected={sitio} href={`/subcuenta/${subId}/embudos?tipo=sitio`} className={`rounded-md px-3 py-1.5 text-sm ${sitio ? 'bg-primario-suave font-medium text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>Sitios web</Link>
          </div>
          <p className="mt-2 text-xs text-tenue">{sitio ? 'Webs de varias páginas con menú, pie y formularios conectados a tus contactos.' : 'Páginas de captación, venta y reserva conectadas a tus contactos y automatizaciones.'}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="relative block w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={sitio ? 'Buscar sitios' : 'Buscar embudos'} className={`${estiloInput} w-full pl-9 sm:w-56`} />
          </label>
          <button onClick={() => { setGaleria(true); setElegida(''); setNombre(''); }} className={`${estilosBoton.primario} inline-flex items-center gap-1.5`}><Plus className="size-4" /> {sitio ? 'Nuevo sitio web' : 'Nuevo embudo'}</button>
        </div>
      </div>
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}

      {lista.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-borde bg-superficie px-6 py-16 text-center">
          <LayoutTemplate className="size-10 text-tenue" />
          <p className="mt-3 font-medium text-texto">{embudos.length ? 'Nada coincide con la búsqueda' : sitio ? 'Crea tu primer sitio web' : 'Crea tu primer embudo'}</p>
          <p className="mt-1 text-sm text-tenue">{sitio ? 'Elige una plantilla por sector (agencia, clínica, restaurante, despacho…) y personalízala.' : 'Empieza desde una plantilla (captación, webinar, citas, venta…) o desde cero.'}</p>
          <button onClick={() => setGaleria(true)} className={`${estilosBoton.primario} mt-4`}>Ver plantillas</button>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-lg border border-borde bg-superficie ${menu && lista.length <= 2 ? 'pb-32' : ''}`}>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-borde text-left text-xs font-medium text-tenue">
              <tr><th className="px-4 py-2.5">Nombre</th><th className="px-3 py-2.5">Páginas</th><th className="px-3 py-2.5">Visitas (30 días)</th><th className="px-3 py-2.5">Envíos</th><th className="px-3 py-2.5">Conversión</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Actualizado</th><th className="px-3 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.map((e, i) => (
                <tr key={e.id} className="hover:bg-superficie-2">
                  <td className="px-4 py-3"><Link href={`/subcuenta/${subId}/embudos/${e.id}`} className="font-medium text-texto hover:text-primario-texto hover:underline">{e.nombre}</Link><p className="text-xs text-tenue">/f/{e.slug}</p></td>
                  <td className="px-3 py-3 text-texto-2">{e.pasos}</td>
                  <td className="px-3 py-3 text-texto-2">{e.visitas}</td>
                  <td className="px-3 py-3 text-texto-2">{e.envios}</td>
                  <td className="px-3 py-3 text-texto-2">{e.visitas ? `${((e.envios / e.visitas) * 100).toFixed(1)} %` : '—'}</td>
                  <td className="px-3 py-3"><Insignia tono={e.publicado ? 'verde' : 'gris'}>{e.publicado ? 'Publicado' : 'Borrador'}</Insignia></td>
                  <td className="px-3 py-3 text-xs text-texto-2">{fecha(e.actualizado)}</td>
                  <td className="relative px-3 py-3 text-right">
                    <button onClick={() => setMenu(menu === e.id ? null : e.id)} aria-label={`Más acciones de ${e.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-texto"><MoreVertical className="size-4" /></button>
                    {menu === e.id && (
                      <div className={`absolute right-3 z-20 w-48 ${i >= lista.length - 2 && lista.length > 2 ? 'bottom-10' : 'top-10'} rounded-lg border border-borde bg-superficie p-1 text-left shadow-xl`}>
                        {e.publicado && <a href={`/f/${e.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded px-3 py-2 hover:bg-superficie-2"><ExternalLink className="size-4" /> Ver publicado</a>}
                        <button onClick={() => { setMenu(null); iniciar(async () => setAviso(await duplicarEmbudo(subId, e.id))); }} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-superficie-2"><Copy className="size-4" /> Duplicar</button>
                        <button onClick={() => { setMenu(null); if (confirm(`¿Borrar «${e.nombre}» y sus páginas? Las estadísticas también se borran.`)) iniciar(async () => setAviso(await borrarEmbudo(subId, e.id))); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-peligro hover:bg-superficie-2"><Trash2 className="size-4" /> Borrar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal abierto={galeria} alCerrar={() => setGaleria(false)} titulo={sitio ? 'Nuevo sitio web' : 'Nuevo embudo'} ancho="max-w-5xl">
        <div className="space-y-4">
          <div className="grid max-h-[55vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" onClick={() => { setElegida('blanco'); setNombre((n) => n || (sitio ? 'Mi web' : 'Mi embudo')); }}
              className={`overflow-hidden rounded-lg border-2 text-left ${elegida === 'blanco' ? 'border-primario' : 'border-borde hover:border-borde-fuerte'}`}>
              <div className="flex h-36 items-center justify-center bg-superficie-2"><Plus className="size-8 text-tenue" /></div>
              <div className="p-3"><p className="font-medium text-texto">Desde cero</p><p className="text-xs text-tenue">Una página en blanco</p></div>
            </button>
            {galeriaItems.map((p) => (
              <div key={p.id} role="button" tabIndex={0} aria-pressed={elegida === p.id} onClick={() => { setElegida(p.id); setNombre(p.nombre); }}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setElegida(p.id); setNombre(p.nombre); } }}
                className={`cursor-pointer overflow-hidden rounded-lg border-2 text-left ${elegida === p.id ? 'border-primario' : 'border-borde hover:border-borde-fuerte'}`}>
                <div className="h-36 border-b border-borde"><Miniatura plantilla={p.id} tipo={tipo} /></div>
                <div className="p-3">
                  <p className="font-medium text-texto">{p.nombre}</p>
                  <p className="line-clamp-2 text-xs text-tenue">{p.descripcion}</p>
                  <p className="mt-1 flex items-center justify-between text-xs text-tenue">{p.categoria} · {p.paginas} página(s)
                    <a href={`/plantilla/${p.id}${sitio ? '?tipo=sitio' : ''}`} target="_blank" rel="noopener" onClick={(ev) => ev.stopPropagation()} className="font-medium text-primario-texto hover:underline">Vista previa</a></p>
                </div>
              </div>
            ))}
          </div>
          <form className="flex flex-wrap items-end gap-3 border-t border-borde pt-4" onSubmit={(ev) => {
            ev.preventDefault();
            if (!elegida) return setAviso({ ok: false, error: 'Elige una plantilla o «Desde cero».' });
            iniciar(async () => {
              const r = await crearEmbudo(subId, nombre, elegida === 'blanco' ? '' : elegida, tipo);
              if (r.ok && r.id) router.push(`/subcuenta/${subId}/embudos/${r.id}`);
              else setAviso(r);
            });
          }}>
            <label className="block min-w-60 flex-1"><span className="mb-1.5 block text-sm font-medium">{sitio ? 'Nombre del sitio' : 'Nombre del embudo'}</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} className={estiloInput} /></label>
            <button type="button" onClick={() => setGaleria(false)} className={estilosBoton.secundario}>Cancelar</button>
            <button disabled={pendiente || !elegida} className={estilosBoton.primario}>{pendiente ? 'Creando…' : sitio ? 'Crear sitio' : 'Crear embudo'}</button>
          </form>
        </div>
      </Modal>
    </div>
  );
}
