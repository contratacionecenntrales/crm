'use client';
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check, Copy, Download, File, FileText, Film, Folder, FolderInput, FolderPlus, Image as ImageIcon, Loader2, Music, Pencil, Search, Trash2, Upload, X,
} from 'lucide-react';
import { borrarMedios, moverMedios, registrarMedio, renombrarMedio } from '@/app/subcuenta/[id]/medios/acciones';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput } from '@/components/ui/clases';
import { CUPO_MEDIOS, MAX_ARCHIVO, TIPOS_MEDIOS, carpetaValida, tamanoLegible, type Medio } from '@/lib/medios';
import type { Resultado } from '@/lib/tipos';

interface Subida { id: string; nombre: string; estado: 'subiendo' | 'ok' | 'error'; error?: string }

const icono = (tipo: string) => tipo.startsWith('image/') ? ImageIcon : tipo.startsWith('video/') ? Film : tipo.startsWith('audio/') ? Music
  : tipo === 'application/pdf' || tipo.startsWith('text/') ? FileText : File;

export function GestorMedios({ subId, medios, usado }: { subId: string; medios: Medio[]; usado: number }) {
  const router = useRouter();
  const [carpeta, setCarpeta] = useState<string | null>(null); // null = todas
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [dialogo, setDialogo] = useState<null | { tipo: 'carpeta' } | { tipo: 'mover' } | { tipo: 'renombrar'; m: Medio } | { tipo: 'ver'; m: Medio }>(null);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const [carpetasNuevas, setCarpetasNuevas] = useState<string[]>([]);

  const carpetas = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of medios) if (x.carpeta) m.set(x.carpeta, (m.get(x.carpeta) ?? 0) + 1);
    for (const c of carpetasNuevas) if (!m.has(c)) m.set(c, 0);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [medios, carpetasNuevas]);

  const lista = useMemo(() => medios.filter((m) =>
    (carpeta === null || m.carpeta === carpeta) && (!q || m.nombre.toLowerCase().includes(q.toLowerCase()))), [medios, carpeta, q]);

  const pct = Math.min(100, (usado / CUPO_MEDIOS) * 100);

  const subir = async (archivos: FileList | File[]) => {
    const supabase = crearClienteNavegador();
    const destino = carpeta ?? '';
    for (const f of Array.from(archivos)) {
      const id = crypto.randomUUID();
      const poner = (x: Partial<Subida>) => setSubidas((l) => l.map((s) => (s.id === id ? { ...s, ...x } : s)));
      setSubidas((l) => [{ id, nombre: f.name, estado: 'subiendo' as const }, ...l].slice(0, 20));
      const ext = TIPOS_MEDIOS[f.type];
      if (!ext) { poner({ estado: 'error', error: 'Tipo de archivo no admitido' }); continue; }
      if (f.size > MAX_ARCHIVO) { poner({ estado: 'error', error: 'Supera 25 MB' }); continue; }
      const ruta = `${subId}/${id}.${ext}`;
      const { error } = await supabase.storage.from('medios').upload(ruta, f, { contentType: f.type, upsert: false, cacheControl: '31536000' });
      if (error) {
        poner({ estado: 'error', error: /security|policy/i.test(error.message) ? 'Sin permiso o sin espacio (cupo de 5 GB)' : error.message });
        continue;
      }
      const r = await registrarMedio(subId, ruta, f.name, destino);
      poner(r.ok ? { estado: 'ok' } : { estado: 'error', error: r.error });
    }
    router.refresh();
  };

  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const accion = (fn: () => Promise<Resultado>) => iniciar(async () => { const r = await fn(); setAviso(r); if (r.ok) setSel(new Set()); });

  return (
    <div className="flex h-[calc(100dvh-93px)] flex-col font-sans"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastrando(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastrando(false); }}
      onDrop={(e) => { e.preventDefault(); setArrastrando(false); if (e.dataTransfer.files.length) void subir(e.dataTransfer.files); }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde bg-superficie px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold text-texto">Medios</h1>
          <p className="text-xs text-tenue">Imágenes, documentos y vídeos para tus correos, mensajes y páginas. Arrastra archivos aquí para subirlos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar archivos" aria-label="Buscar archivos" className={`${estiloInput} w-56 pl-9`} />
          </label>
          <button onClick={() => setDialogo({ tipo: 'carpeta' })} className={`${estilosBoton.secundario} inline-flex items-center gap-1.5`}><FolderPlus className="size-4" /> Nueva carpeta</button>
          <button onClick={() => entrada.current?.click()} className={`${estilosBoton.primario} inline-flex items-center gap-1.5`}><Upload className="size-4" /> Subir</button>
          <input ref={entrada} type="file" multiple className="sr-only" accept={Object.keys(TIPOS_MEDIOS).join(',')}
            onChange={(e) => { if (e.target.files?.length) void subir(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-borde bg-superficie p-3 md:flex">
          <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Carpetas">
            {[[null, 'Todos los archivos', medios.length] as const, ['', 'Sin carpeta', medios.filter((m) => !m.carpeta).length] as const,
              ...carpetas.map(([c, n]) => [c, c, n] as const)].map(([valor, texto, n]) => (
              <button key={String(valor) + texto} onClick={() => { setCarpeta(valor); setSel(new Set()); }}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${carpeta === valor ? 'bg-primario-suave font-medium text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>
                <Folder className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{texto}</span><span className="text-xs text-tenue">{n}</span>
              </button>
            ))}
          </nav>
          <div className="mt-3 border-t border-borde pt-3">
            <p className="text-xs text-tenue">{tamanoLegible(usado)} de {tamanoLegible(CUPO_MEDIOS)}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Espacio usado">
              <div className={`h-full rounded-full ${pct > 90 ? 'bg-peligro' : 'bg-primario'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 overflow-y-auto bg-fondo p-4 sm:p-6">
          {arrastrando && (
            <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primario bg-primario-suave/80 text-sm font-medium text-primario-texto">
              Suelta los archivos para subirlos{carpeta ? ` a «${carpeta}»` : ''}
            </div>
          )}
          {aviso && <div className="mb-3"><Aviso estado={aviso} /></div>}
          {subidas.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-lg border border-borde bg-superficie p-3 text-sm">
              {subidas.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  {s.estado === 'subiendo' ? <Loader2 className="size-4 animate-spin text-primario" /> : s.estado === 'ok' ? <Check className="size-4 text-exito" /> : <X className="size-4 text-peligro" />}
                  <span className="min-w-0 flex-1 truncate text-texto">{s.nombre}</span>
                  {s.error && <span className="text-xs text-peligro">{s.error}</span>}
                </li>
              ))}
              {!subidas.some((s) => s.estado === 'subiendo') && (
                <li><button onClick={() => setSubidas([])} className="text-xs font-medium text-primario-texto hover:underline">Ocultar</button></li>
              )}
            </ul>
          )}

          {sel.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-borde bg-superficie px-3 py-2 text-sm">
              <span className="font-medium text-texto">{sel.size} seleccionado(s)</span>
              <button disabled={pendiente} onClick={() => setDialogo({ tipo: 'mover' })} className="inline-flex items-center gap-1 rounded px-2 py-1 text-texto-2 hover:bg-superficie-2"><FolderInput className="size-4" /> Mover</button>
              <button disabled={pendiente} onClick={() => confirm(`¿Borrar ${sel.size} archivo(s)? Los enlaces que ya hayas usado dejarán de funcionar.`) && accion(() => borrarMedios(subId, [...sel]))}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-peligro hover:bg-superficie-2"><Trash2 className="size-4" /> Borrar</button>
              <button onClick={() => setSel(new Set())} className="ml-auto text-xs text-tenue hover:text-texto">Quitar selección</button>
            </div>
          )}

          {lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-borde-fuerte bg-superficie px-6 py-20 text-center">
              <Upload className="size-8 text-tenue" />
              <p className="mt-3 font-medium text-texto">{medios.length ? 'No hay archivos aquí' : 'Aún no has subido archivos'}</p>
              <p className="mt-1 text-sm text-tenue">Arrastra archivos o pulsa «Subir». Imágenes, PDF, vídeo, audio y documentos de hasta 25 MB.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {lista.map((m) => {
                const I = icono(m.tipo);
                const marcado = sel.has(m.id);
                return (
                  <li key={m.id} className={`group overflow-hidden rounded-lg border bg-superficie ${marcado ? 'border-primario ring-2 ring-primario/30' : 'border-borde'}`}>
                    <div className="relative aspect-[4/3] bg-superficie-2">
                      <button type="button" onClick={() => setDialogo({ tipo: 'ver', m })} className="flex size-full items-center justify-center" aria-label={`Ver ${m.nombre}`}>
                        {m.tipo.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt="" loading="lazy" className="size-full object-cover" />
                        ) : <I className="size-10 text-tenue" />}
                      </button>
                      <label className={`absolute left-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded bg-white/90 shadow ${marcado ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                        <input type="checkbox" checked={marcado} onChange={() => alternar(m.id)} aria-label={`Seleccionar ${m.nombre}`} className="size-4" />
                      </label>
                    </div>
                    <div className="flex items-start gap-1 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-texto" title={m.nombre}>{m.nombre}</p>
                        <p className="text-xs text-tenue">{tamanoLegible(m.tamano)}{m.carpeta && carpeta === null ? ` · ${m.carpeta}` : ''}</p>
                      </div>
                      <BotonCopiarUrl url={m.url} />
                      <button onClick={() => setDialogo({ tipo: 'renombrar', m })} aria-label={`Renombrar ${m.nombre}`} className="rounded p-1 text-tenue hover:text-texto"><Pencil className="size-3.5" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Modal abierto={dialogo !== null} alCerrar={() => setDialogo(null)} ancho={dialogo?.tipo === 'ver' ? 'max-w-3xl' : 'max-w-md'}
        titulo={dialogo?.tipo === 'carpeta' ? 'Nueva carpeta' : dialogo?.tipo === 'mover' ? 'Mover a carpeta' : dialogo?.tipo === 'renombrar' ? 'Renombrar' : dialogo?.tipo === 'ver' ? dialogo.m.nombre : ''}>
        {dialogo?.tipo === 'carpeta' && (
          <FormTexto etiqueta="Nombre de la carpeta" boton="Crear" validar={(c) => (!c ? 'Escribe un nombre.' : !carpetaValida(c) ? 'Sin / \\ < > y como mucho 60 caracteres.' : null)}
            alGuardar={(c) => { setCarpetasNuevas((l) => [...l, c]); setCarpeta(c); setDialogo(null); }} />
        )}
        {dialogo?.tipo === 'mover' && (
          <FormTexto etiqueta="Carpeta (vacío = sin carpeta)" boton="Mover" opciones={carpetas.map(([c]) => c)} permitirVacio
            validar={(c) => (!carpetaValida(c) ? 'Sin / \\ < > y como mucho 60 caracteres.' : null)}
            alGuardar={(c) => { setDialogo(null); accion(() => moverMedios(subId, [...sel], c)); }} />
        )}
        {dialogo?.tipo === 'renombrar' && (
          <FormTexto etiqueta="Nombre" boton="Guardar" inicial={dialogo.m.nombre} validar={(c) => (!c ? 'Escribe un nombre.' : null)}
            alGuardar={(c) => { const m = dialogo.m; setDialogo(null); accion(() => renombrarMedio(subId, m.id, c)); }} />
        )}
        {dialogo?.tipo === 'ver' && <Vista m={dialogo.m} alBorrar={() => { const m = dialogo.m; setDialogo(null); if (confirm(`¿Borrar «${m.nombre}»?`)) accion(() => borrarMedios(subId, [m.id])); }} />}
      </Modal>
    </div>
  );
}

function BotonCopiarUrl({ url }: { url: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button type="button" aria-label="Copiar enlace" title="Copiar enlace" className="rounded p-1 text-tenue hover:text-texto"
      onClick={async () => { try { await navigator.clipboard.writeText(url); setHecho(true); setTimeout(() => setHecho(false), 1500); } catch { prompt('Copia el enlace:', url); } }}>
      {hecho ? <Check className="size-3.5 text-exito" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Vista({ m, alBorrar }: { m: Medio; alBorrar: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-lg bg-superficie-2">
        {m.tipo.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt={m.nombre} className="max-h-[60vh] object-contain" />
        ) : m.tipo.startsWith('video/') ? <video src={m.url} controls className="max-h-[60vh] w-full" />
          : m.tipo.startsWith('audio/') ? <audio src={m.url} controls className="m-8 w-full" />
          : m.tipo === 'application/pdf' ? <iframe src={m.url} title={m.nombre} className="h-[60vh] w-full" />
          : <p className="p-10 text-sm text-tenue">Vista previa no disponible para este tipo de archivo.</p>}
      </div>
      <div className="flex items-center gap-1 rounded-md border border-borde bg-superficie-2 p-2">
        <input readOnly value={m.url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-texto-2 outline-none" aria-label="Enlace público" />
        <BotonCopiarUrl url={m.url} />
      </div>
      <p className="text-xs text-tenue">{tamanoLegible(m.tamano)} · {m.tipo} · cualquiera con el enlace puede verlo.</p>
      <div className="flex justify-between gap-2">
        <button onClick={alBorrar} className={`${estilosBoton.secundario} inline-flex items-center gap-1.5 text-peligro`}><Trash2 className="size-4" /> Borrar</button>
        <a href={m.url} download={m.nombre} target="_blank" rel="noopener noreferrer" className={`${estilosBoton.primario} inline-flex items-center gap-1.5`}><Download className="size-4" /> Descargar</a>
      </div>
    </div>
  );
}

function FormTexto({ etiqueta, boton, inicial = '', opciones, permitirVacio, validar, alGuardar }: {
  etiqueta: string; boton: string; inicial?: string; opciones?: string[]; permitirVacio?: boolean;
  validar: (v: string) => string | null; alGuardar: (v: string) => void;
}) {
  const [v, setV] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const t = v.trim();
      const err = !t && !permitirVacio ? 'Escribe un nombre.' : validar(t);
      if (err) return setError(err);
      alGuardar(t);
    }}>
      <label className="block"><span className="mb-1.5 block text-sm font-medium">{etiqueta}</span>
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={200} list={opciones ? 'carpetas-medios' : undefined} className={estiloInput} />
        {opciones && <datalist id="carpetas-medios">{opciones.map((o) => <option key={o} value={o} />)}</datalist>}
      </label>
      {error && <Aviso estado={{ ok: false, error }} />}
      <div className="flex justify-end"><button className={estilosBoton.primario}>{boton}</button></div>
    </form>
  );
}
