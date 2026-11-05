'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, ExternalLink, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { actualizarEmbudo, actualizarPaso, borrarPaso, crearPaso, duplicarPaso, moverPaso } from '@/app/subcuenta/[id]/embudos/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estilosBoton, estiloInput, estiloArea } from '@/components/ui/clases';
import { fecha } from '@/lib/formato';
import type { Resultado } from '@/lib/tipos';

export interface PasoResumen {
  id: string; nombre: string; ruta: string; orden: number; publicado_en: string | null; actualizado: string;
  seo_titulo: string; seo_descripcion: string; visitas: number; envios: number;
}
interface Embudo { id: string; nombre: string; slug: string; publicado: boolean; plantilla: string; creado: string; actualizado: string }

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : '—');

export function DetalleEmbudo({ subId, embudo, pasos, sitio }: { subId: string; embudo: Embudo; pasos: PasoResumen[]; sitio: string }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [ajustes, setAjustes] = useState(false);
  const [editando, setEditando] = useState<PasoResumen | null>(null);
  const [nueva, setNueva] = useState(false);
  const [copiado, setCopiado] = useState('');
  const base = `/subcuenta/${subId}/embudos`;
  const url = (ruta?: string) => `${sitio}/f/${embudo.slug}${ruta ? `/${ruta}` : ''}`;
  const totalVisitas = pasos[0]?.visitas ?? 0;
  const totalEnvios = pasos.reduce((s, p) => s + p.envios, 0);

  const ejecutar = (f: () => Promise<Resultado>) => iniciar(async () => { const r = await f(); setAviso(r.ok && !r.mensaje ? null : r); if (r.ok) router.refresh(); });
  const mover = (i: number, d: -1 | 1) => {
    const ids = pasos.map((p) => p.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    ejecutar(() => moverPaso(subId, embudo.id, ids));
  };
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopiado(t); setTimeout(() => setCopiado(''), 1500); } catch { /* sin permiso */ } };

  return (
    <div className="px-4 py-6 font-sans sm:px-6">
      <Link href={base} className="mb-3 inline-flex items-center gap-1 text-sm text-tenue hover:text-texto"><ArrowLeft className="size-4" /> Embudos</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-texto">{embudo.nombre}
            <Insignia tono={embudo.publicado ? 'verde' : 'gris'}>{embudo.publicado ? 'Publicado' : 'Borrador'}</Insignia></h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-tenue">
            <span className="truncate">{url()}</span>
            <button onClick={() => copiar(url())} className="inline-flex items-center gap-1 hover:text-texto" aria-label="Copiar dirección">{copiado === url() ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>
            {embudo.publicado && <a href={`/f/${embudo.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-texto"><ExternalLink className="size-3.5" /> Abrir</a>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAjustes(true)} className={estilosBoton.secundario}><Settings2 className="size-4" /> Ajustes</button>
          <button disabled={pendiente} onClick={() => ejecutar(() => actualizarEmbudo(subId, embudo.id, { publicado: !embudo.publicado }))} className={embudo.publicado ? estilosBoton.secundario : estilosBoton.primario}>
            {embudo.publicado ? 'Despublicar' : 'Publicar embudo'}</button>
        </div>
      </div>
      {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Visitas (30 días)', totalVisitas], ['Envíos de formulario', totalEnvios], ['Conversión', pct(totalEnvios, totalVisitas)], ['Páginas', pasos.length]].map(([t, v]) => (
          <div key={t as string} className="rounded-lg border border-borde bg-superficie p-4"><p className="text-xs text-tenue">{t}</p><p className="mt-1 text-2xl font-semibold text-texto">{v}</p></div>
        ))}
      </div>

      <div className="rounded-lg border border-borde bg-superficie">
        <div className="flex items-center justify-between border-b border-borde px-4 py-3">
          <h2 className="font-semibold text-texto">Páginas del embudo</h2>
          <button onClick={() => setNueva(true)} className={estilosBoton.primario}><Plus className="size-4" /> Añadir página</button>
        </div>
        {pasos.length === 0 && <p className="px-4 py-10 text-center text-sm text-tenue">Este embudo no tiene páginas.</p>}
        <ol className="divide-y divide-borde">
          {pasos.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-xs font-semibold text-texto-2">{i + 1}</span>
              <div className="min-w-48 flex-1">
                <Link href={`${base}/${embudo.id}/${p.id}`} className="font-medium text-texto hover:text-primario-texto hover:underline">{p.nombre}</Link>
                <p className="text-xs text-tenue">/{i === 0 ? '' : p.ruta} {i === 0 && <span>(página de entrada · también /{p.ruta})</span>}</p>
              </div>
              <div className="flex gap-5 text-xs text-texto-2">
                <span><span className="block text-tenue">Visitas</span>{p.visitas}</span>
                <span><span className="block text-tenue">Envíos</span>{p.envios}</span>
                <span><span className="block text-tenue">Conversión</span>{pct(p.envios, p.visitas)}</span>
                <span><span className="block text-tenue">Estado</span>{p.publicado_en ? <span title={fecha(p.publicado_en)}>Publicada</span> : <span className="text-aviso">Sin publicar</span>}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button disabled={pendiente || i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${p.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-texto disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button disabled={pendiente || i === pasos.length - 1} onClick={() => mover(i, 1)} aria-label={`Bajar ${p.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-texto disabled:opacity-30"><ArrowDown className="size-4" /></button>
                <button onClick={() => setEditando(p)} aria-label={`Ajustes de ${p.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-texto"><Settings2 className="size-4" /></button>
                <button disabled={pendiente} onClick={() => ejecutar(() => duplicarPaso(subId, p.id))} aria-label={`Duplicar ${p.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-texto"><Copy className="size-4" /></button>
                <button disabled={pendiente} onClick={() => confirm(`¿Borrar la página «${p.nombre}»?`) && ejecutar(() => borrarPaso(subId, p.id))} aria-label={`Borrar ${p.nombre}`} className="rounded p-1.5 text-texto-2 hover:text-peligro"><Trash2 className="size-4" /></button>
                <Link href={`${base}/${embudo.id}/${p.id}`} className={`${estilosBoton.secundario} ml-1`}><Pencil className="size-4" /> Editar</Link>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-xs text-tenue">Los cambios de cada página se ven en la dirección pública cuando la publicas desde el editor. El embudo entero se puede despublicar en cualquier momento.</p>

      <Modal abierto={ajustes} alCerrar={() => setAjustes(false)} titulo="Ajustes del embudo">
        {ajustes && <FormAjustes subId={subId} embudo={embudo} sitio={sitio} alTerminar={() => { setAjustes(false); router.refresh(); }} />}
      </Modal>
      <Modal abierto={editando !== null} alCerrar={() => setEditando(null)} titulo="Ajustes de la página">
        {editando && <FormPaso subId={subId} p={editando} prefijo={url()} alTerminar={() => { setEditando(null); router.refresh(); }} />}
      </Modal>
      <Modal abierto={nueva} alCerrar={() => setNueva(false)} titulo="Nueva página">
        {nueva && <FormNuevaPagina alCrear={(n) => iniciar(async () => {
          const r = await crearPaso(subId, embudo.id, n);
          if (r.ok && r.id) router.push(`${base}/${embudo.id}/${r.id}`); else { setAviso(r); setNueva(false); }
        })} pendiente={pendiente} alCancelar={() => setNueva(false)} />}
      </Modal>
    </div>
  );
}

function FormNuevaPagina({ alCrear, alCancelar, pendiente }: { alCrear: (n: string) => void; alCancelar: () => void; pendiente: boolean }) {
  const [n, setN] = useState('');
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alCrear(n); }}>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre de la página</span>
        <input value={n} onChange={(e) => setN(e.target.value)} required maxLength={120} placeholder="Ej. Gracias" className={estiloInput} autoFocus /></label>
      <div className="flex justify-end gap-2"><button type="button" onClick={alCancelar} className={estilosBoton.secundario}>Cancelar</button><button disabled={pendiente} className={estilosBoton.primario}>{pendiente ? 'Creando…' : 'Crear y editar'}</button></div>
    </form>
  );
}

function FormAjustes({ subId, embudo, sitio, alTerminar }: { subId: string; embudo: Embudo; sitio: string; alTerminar: () => void }) {
  const [nombre, setNombre] = useState(embudo.nombre);
  const [slug, setSlug] = useState(embudo.slug);
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const x = await actualizarEmbudo(subId, embudo.id, { nombre, slug }); setR(x); if (x.ok) alTerminar(); }); }}>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} className={estiloInput} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Dirección</span>
        <span className="mb-1 block truncate text-xs text-tenue">{sitio}/f/…</span>
        <div className="flex items-center gap-1 text-sm">
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={estiloInput} /></div>
        <span className="mt-1 block text-xs text-tenue">Si la cambias, los enlaces antiguos dejarán de funcionar.</span></label>
      <Aviso estado={r} />
      <div className="flex justify-end gap-2"><button type="button" onClick={alTerminar} className={estilosBoton.secundario}>Cancelar</button><button disabled={pendiente} className={estilosBoton.primario}>Guardar</button></div>
    </form>
  );
}

function FormPaso({ subId, p, prefijo, alTerminar }: { subId: string; p: PasoResumen; prefijo: string; alTerminar: () => void }) {
  const [f, setF] = useState({ nombre: p.nombre, ruta: p.ruta, seo_titulo: p.seo_titulo, seo_descripcion: p.seo_descripcion });
  const [r, setR] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cambiar = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const x = await actualizarPaso(subId, p.id, f); setR(x); if (x.ok) alTerminar(); }); }}>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre</span><input value={f.nombre} onChange={cambiar('nombre')} required maxLength={120} className={estiloInput} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Ruta</span>
        <span className="mb-1 block truncate text-xs text-tenue">{prefijo}/…</span>
        <div className="flex items-center gap-1 text-sm">
          <input value={f.ruta} onChange={(e) => setF({ ...f, ruta: e.target.value.toLowerCase() })} required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={estiloInput} /></div></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Título para buscadores (SEO)</span><input value={f.seo_titulo} onChange={cambiar('seo_titulo')} maxLength={120} className={estiloInput} placeholder={p.nombre} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Descripción para buscadores</span><textarea value={f.seo_descripcion} onChange={cambiar('seo_descripcion')} maxLength={300} rows={3} className={estiloArea} /></label>
      <Aviso estado={r} />
      <div className="flex justify-end gap-2"><button type="button" onClick={alTerminar} className={estilosBoton.secundario}>Cancelar</button><button disabled={pendiente} className={estilosBoton.primario}>Guardar</button></div>
    </form>
  );
}
