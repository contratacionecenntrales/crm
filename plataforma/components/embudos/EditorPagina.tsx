'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Copy, ExternalLink, Eye, LayoutList, Monitor, Palette, Plus, Redo2, Smartphone, Trash2, Undo2,
} from 'lucide-react';
import { guardarPaso } from '@/app/subcuenta/[id]/embudos/acciones';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton } from '@/components/ui/clases';
import { esquemaContenido, type Bloque, type Contenido, type Seccion } from '@/lib/embudos/tipos';
import { BloqueVista, fuenteDe, SeccionVista } from './Renderizado';
import {
  bloqueNuevo, CATALOGO, conIdsNuevos, PropiedadesBloque, PropiedadesEstilo, PropiedadesSeccion, seccionNueva,
  type Calendario, type Imagen, type TipoBloque,
} from './Propiedades';
import type { Resultado } from '@/lib/tipos';

type Sel = null | { tipo: 'seccion'; id: string } | { tipo: 'bloque'; id: string };
interface Props {
  subId: string;
  embudo: { id: string; nombre: string; slug: string; publicado: boolean };
  paso: { id: string; nombre: string; ruta: string; publicado_en: string | null; primero: boolean };
  pasos: { id: string; nombre: string }[];
  inicial: Contenido; imagenes: Imagen[]; calendarios: Calendario[];
}

const mover = <T,>(a: T[], i: number, d: number): T[] => {
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n;
};

export function EditorPagina({ subId, embudo, paso, pasos, inicial, imagenes, calendarios }: Props) {
  const router = useRouter();
  const [c, setC] = useState<Contenido>(inicial);
  const [pasado, setPasado] = useState<Contenido[]>([]);
  const [futuro, setFuturo] = useState<Contenido[]>([]);
  const ultimoCambio = useRef(0);
  const [sel, setSel] = useState<Sel>(null);
  const [panel, setPanel] = useState<'anadir' | 'capas' | 'estilo'>('anadir');
  const [movil, setMovil] = useState(false);
  const [hoja, setHoja] = useState<null | 'izq' | 'der'>(null);
  const [sucio, setSucio] = useState(false);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [publicadoEn, setPublicadoEn] = useState(paso.publicado_en);
  const [pendiente, iniciar] = useTransition();
  const base = `/subcuenta/${subId}/embudos/${embudo.id}`;

  // Cada cambio entra en el historial (los cambios seguidos al escribir se agrupan).
  const cambiar = useCallback((f: (x: Contenido) => Contenido) => {
    setC((prev) => {
      const sig = f(prev);
      if (sig === prev) return prev;
      const ahora = Date.now();
      if (ahora - ultimoCambio.current > 700) setPasado((p) => [...p.slice(-79), prev]);
      ultimoCambio.current = ahora;
      setFuturo([]);
      setSucio(true);
      return sig;
    });
  }, []);
  const deshacer = useCallback(() => {
    if (!pasado.length) return;
    setFuturo((f) => [c, ...f]); setC(pasado[pasado.length - 1]); setPasado((p) => p.slice(0, -1)); setSucio(true); ultimoCambio.current = 0;
  }, [pasado, c]);
  const rehacer = useCallback(() => {
    if (!futuro.length) return;
    setPasado((p) => [...p, c]); setC(futuro[0]); setFuturo((f) => f.slice(1)); setSucio(true); ultimoCambio.current = 0;
  }, [futuro, c]);

  // Búsqueda de la selección actual.
  const donde = useMemo(() => {
    if (!sel) return null;
    for (let si = 0; si < c.secciones.length; si++) {
      const s = c.secciones[si];
      if (sel.tipo === 'seccion' && s.id === sel.id) return { si, s, bi: -1, b: null as Bloque | null };
      if (sel.tipo === 'bloque') { const bi = s.bloques.findIndex((b) => b.id === sel.id); if (bi >= 0) return { si, s, bi, b: s.bloques[bi] }; }
    }
    return null;
  }, [sel, c]);
  const anclas = useMemo(() => c.secciones.map((s) => s.ancla).filter((a): a is string => Boolean(a)), [c]);

  const editarSeccion = (id: string, f: (s: Seccion) => Seccion) => cambiar((x) => ({ ...x, secciones: x.secciones.map((s) => (s.id === id ? f(s) : s)) }));
  const editarBloque = (b: Bloque) => cambiar((x) => ({ ...x, secciones: x.secciones.map((s) => ({ ...s, bloques: s.bloques.map((y) => (y.id === b.id ? b : y)) })) }));

  const anadirBloque = (tipo: TipoBloque) => {
    const b = bloqueNuevo(tipo);
    cambiar((x) => {
      if (!x.secciones.length) return { ...x, secciones: [{ ...seccionNueva(), bloques: [b] }] };
      const si = donde ? donde.si : x.secciones.length - 1;
      const pos = donde && donde.bi >= 0 ? donde.bi + 1 : x.secciones[si].bloques.length;
      return { ...x, secciones: x.secciones.map((s, i) => (i === si ? { ...s, bloques: [...s.bloques.slice(0, pos), b, ...s.bloques.slice(pos)] } : s)) };
    });
    setSel({ tipo: 'bloque', id: b.id });
    setHoja(null);
    requestAnimationFrame(() => document.getElementById(`ed-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const anadirSeccion = (despuesDe?: number) => {
    const s = seccionNueva();
    cambiar((x) => { const i = despuesDe ?? x.secciones.length - 1; return { ...x, secciones: [...x.secciones.slice(0, i + 1), s, ...x.secciones.slice(i + 1)] }; });
    setSel({ tipo: 'seccion', id: s.id });
  };
  const accionBloque = (id: string, a: 'subir' | 'bajar' | 'duplicar' | 'borrar') => cambiar((x) => {
    const secciones = x.secciones.map((s) => {
      const i = s.bloques.findIndex((b) => b.id === id);
      if (i < 0) return s;
      if (a === 'subir') return { ...s, bloques: mover(s.bloques, i, -1) };
      if (a === 'bajar') return { ...s, bloques: mover(s.bloques, i, 1) };
      if (a === 'duplicar') return { ...s, bloques: [...s.bloques.slice(0, i + 1), conIdsNuevos(s.bloques[i]), ...s.bloques.slice(i + 1)] };
      return { ...s, bloques: s.bloques.filter((b) => b.id !== id) };
    });
    // Subir/bajar en el borde de una sección pasa el bloque a la sección vecina.
    if (a === 'subir' || a === 'bajar') {
      const si = x.secciones.findIndex((s) => s.bloques[a === 'subir' ? 0 : s.bloques.length - 1]?.id === id);
      const sj = si + (a === 'subir' ? -1 : 1);
      if (si >= 0 && sj >= 0 && sj < x.secciones.length) {
        const b = x.secciones[si].bloques.find((y) => y.id === id)!;
        return { ...x, secciones: x.secciones.map((s, k) => k === si ? { ...s, bloques: s.bloques.filter((y) => y.id !== id) }
          : k === sj ? { ...s, bloques: a === 'subir' ? [...s.bloques, b] : [b, ...s.bloques] } : s) };
      }
    }
    return { ...x, secciones };
  });
  const accionSeccion = (id: string, a: 'subir' | 'bajar' | 'duplicar' | 'borrar') => cambiar((x) => {
    const i = x.secciones.findIndex((s) => s.id === id);
    if (i < 0) return x;
    if (a === 'subir') return { ...x, secciones: mover(x.secciones, i, -1) };
    if (a === 'bajar') return { ...x, secciones: mover(x.secciones, i, 1) };
    if (a === 'duplicar') { const n = conIdsNuevos(x.secciones[i]); delete n.ancla; return { ...x, secciones: [...x.secciones.slice(0, i + 1), n, ...x.secciones.slice(i + 1)] }; }
    return { ...x, secciones: x.secciones.filter((s) => s.id !== id) };
  });
  const borrarSeleccion = useCallback(() => {
    if (!sel) return;
    if (sel.tipo === 'bloque') accionBloque(sel.id, 'borrar');
    else if (confirm('¿Borrar la sección con todos sus bloques?')) accionSeccion(sel.id, 'borrar');
    setSel(null);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = (publicar: boolean) => {
    const v = esquemaContenido.safeParse(c);
    if (!v.success) { setAviso({ ok: false, error: `Revisa la página: ${v.error.issues[0]?.message ?? 'hay un dato no válido'}${v.error.issues[0]?.path?.length ? ` (${v.error.issues[0].path.slice(-2).join(' › ')})` : ''}` }); return; }
    iniciar(async () => {
      const r = await guardarPaso(subId, paso.id, c, publicar);
      setAviso(r);
      if (r.ok) { setSucio(false); if (r.publicado_en) setPublicadoEn(r.publicado_en); router.refresh(); }
    });
  };

  // Atajos: deshacer/rehacer, guardar, borrar la selección.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const enCampo = (e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]');
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); guardar(false); return; }
      if (enCampo) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); borrarSeleccion(); }
      else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }); // se vuelve a enganchar en cada render para ver el estado actual

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [sucio]);

  const salir = (href: string) => { if (!sucio || confirm('Hay cambios sin guardar. ¿Salir igualmente?')) router.push(href); };
  const ctx = { pasoId: paso.id, siguiente: null, vistaPrevia: true };
  const color = c.estilo.color_primario;
  const urlPublica = `/f/${embudo.slug}${paso.primero ? '' : `/${paso.ruta}`}`;

  const Herr = ({ children, alto }: { children: React.ReactNode; alto?: boolean }) => (
    <div className={`absolute right-1 z-20 flex rounded-md bg-primario text-white shadow-lg ${alto ? '-top-8' : 'top-1'}`} onClick={(e) => e.stopPropagation()}>{children}</div>
  );
  const BtnH = ({ t, on, children, off }: { t: string; on: () => void; children: React.ReactNode; off?: boolean }) => (
    <button type="button" title={t} aria-label={t} disabled={off} onClick={on} className="p-1.5 hover:bg-white/20 disabled:opacity-40">{children}</button>
  );

  const panelIzq = (<>
          <div className="flex border-b border-borde text-xs font-medium" role="tablist">
            {([['anadir', 'Añadir', Plus], ['capas', 'Capas', LayoutList], ['estilo', 'Estilo', Palette]] as const).map(([k, t, I]) => (
              <button key={k} role="tab" aria-selected={panel === k} onClick={() => setPanel(k)} className={`flex flex-1 items-center justify-center gap-1 py-2.5 ${panel === k ? 'border-b-2 border-primario text-primario-texto' : 'text-tenue hover:text-texto'}`}><I className="size-3.5" />{t}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === 'anadir' && (
              <div className="space-y-4">
                <button onClick={() => anadirSeccion(donde?.si)} className={`${estilosBoton.secundario} w-full`}><Plus className="size-4" /> Nueva sección</button>
                {(['Texto', 'Medios', 'Conversión', 'Diseño'] as const).map((g) => (
                  <div key={g}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">{g}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CATALOGO.filter((x) => x.grupo === g).map((x) => (
                        <button key={x.tipo} onClick={() => anadirBloque(x.tipo)} className="rounded-md border border-borde px-2 py-2 text-left text-xs font-medium text-texto-2 hover:border-primario hover:text-primario-texto">{x.nombre}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-tenue">El bloque se añade después del elemento seleccionado.</p>
              </div>
            )}
            {panel === 'capas' && (
              <ol className="space-y-2 text-sm">
                {c.secciones.map((s, i) => (
                  <li key={s.id}>
                    <button onClick={() => setSel({ tipo: 'seccion', id: s.id })} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left font-medium ${sel?.id === s.id ? 'bg-primario-suave text-primario-texto' : 'hover:bg-superficie-2'}`}>
                      <span className="size-3 shrink-0 rounded-sm border border-borde-fuerte" style={{ background: s.fondo }} /> Sección {i + 1}{s.ancla && <span className="text-xs text-tenue">#{s.ancla}</span>}
                    </button>
                    <ol className="ml-5 border-l border-borde">
                      {s.bloques.map((b) => (
                        <li key={b.id}><button onClick={() => { setSel({ tipo: 'bloque', id: b.id }); document.getElementById(`ed-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                          className={`w-full truncate px-2 py-0.5 text-left text-xs ${sel?.id === b.id ? 'text-primario-texto' : 'text-texto-2 hover:text-texto'}`}>{CATALOGO.find((x) => x.tipo === b.tipo)?.nombre}{'texto' in b && b.texto ? `: ${b.texto}` : ''}</button></li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            )}
            {panel === 'estilo' && <div className="space-y-3"><PropiedadesEstilo e={c.estilo} on={(estilo) => cambiar((x) => ({ ...x, estilo }))} /></div>}
          </div>
  </>);
  const panelDer = (<>
          <div className="flex items-center justify-between border-b border-borde px-3 py-2.5">
            <p className="text-sm font-semibold text-texto">{donde?.b ? CATALOGO.find((x) => x.tipo === donde.b!.tipo)?.nombre : donde ? `Sección ${donde.si + 1}` : 'Estilo de la página'}</p>
            {donde && <button onClick={borrarSeleccion} className="rounded p-1 text-tenue hover:text-peligro" aria-label="Borrar selección"><Trash2 className="size-4" /></button>}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {donde?.b ? <PropiedadesBloque key={donde.b.id} b={donde.b} on={editarBloque} imagenes={imagenes} calendarios={calendarios} anclas={anclas} subId={subId} />
              : donde ? <PropiedadesSeccion s={donde.s} on={(s) => editarSeccion(s.id, () => s)} />
              : (<>
                <PropiedadesEstilo e={c.estilo} on={(estilo) => cambiar((x) => ({ ...x, estilo }))} />
                <p className="flex items-start gap-1.5 rounded bg-superficie-2 p-2 text-xs text-tenue"><Eye className="mt-0.5 size-3.5 shrink-0" /> Haz clic en una sección o un bloque del lienzo para editarlo.</p>
              </>)}
          </div>
  </>);

  return (
    <div className="flex h-[calc(100dvh-93px)] min-h-[560px] flex-col bg-fondo font-sans">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-2 border-b border-borde bg-superficie px-3 py-2">
        <button onClick={() => salir(base)} className={estilosBoton.fantasma} aria-label="Volver al embudo"><ArrowLeft className="size-4" /></button>
        <div className="min-w-0">
          <p className="truncate text-xs text-tenue">{embudo.nombre}</p>
          <select value={paso.id} onChange={(e) => salir(`${base}/${e.target.value}`)} aria-label="Página" className="max-w-56 truncate bg-transparent text-sm font-semibold text-texto focus:outline-none">
            {pasos.map((p, i) => <option key={p.id} value={p.id}>{i + 1}. {p.nombre}</option>)}
          </select>
        </div>
        <span className={`ml-1 text-xs ${sucio ? 'text-aviso' : 'text-tenue'}`}>{sucio ? 'Cambios sin guardar' : publicadoEn ? 'Guardado' : 'Guardado · sin publicar'}</span>
        <div className="mx-auto flex items-center gap-1">
          <button onClick={deshacer} disabled={!pasado.length} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className={estilosBoton.fantasma + ' disabled:opacity-30'}><Undo2 className="size-4" /></button>
          <button onClick={rehacer} disabled={!futuro.length} title="Rehacer (Ctrl+Mayús+Z)" aria-label="Rehacer" className={estilosBoton.fantasma + ' disabled:opacity-30'}><Redo2 className="size-4" /></button>
          <span className="mx-1 h-5 w-px bg-borde" />
          <button onClick={() => setMovil(false)} aria-pressed={!movil} title="Escritorio" aria-label="Vista escritorio" className={`${estilosBoton.fantasma} ${!movil ? 'bg-superficie-2 text-texto' : ''}`}><Monitor className="size-4" /></button>
          <button onClick={() => setMovil(true)} aria-pressed={movil} title="Móvil" aria-label="Vista móvil" className={`${estilosBoton.fantasma} ${movil ? 'bg-superficie-2 text-texto' : ''}`}><Smartphone className="size-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          {publicadoEn && embudo.publicado && <a href={urlPublica} target="_blank" rel="noopener noreferrer" className={estilosBoton.secundario}><ExternalLink className="size-4" /> Ver publicada</a>}
          <button disabled={pendiente} onClick={() => guardar(false)} className={estilosBoton.secundario}>{pendiente ? 'Guardando…' : 'Guardar'}</button>
          <button disabled={pendiente} onClick={() => guardar(true)} className={estilosBoton.primario}>Publicar</button>
        </div>
      </div>
      {aviso && <div className="border-b border-borde bg-superficie px-3 py-2" onClick={() => setAviso(null)}><Aviso estado={aviso} /></div>}

      <div className="flex min-h-0 flex-1">
        {/* Panel izquierdo */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-borde bg-superficie md:flex">{panelIzq}</aside>

        {/* Lienzo */}
        <div className="min-w-0 flex-1 overflow-y-auto bg-superficie-2 p-3 sm:p-6" onClick={() => setSel(null)}>
          <div className={`mx-auto overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-black/5 transition-all ${movil ? 'max-w-[390px]' : 'max-w-[1200px]'}`}
            style={{ fontFamily: fuenteDe(c.estilo.fuente), background: c.estilo.fondo }}>
            {c.secciones.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-24 text-center text-[#667085]">
                <p>La página está vacía.</p>
                <button onClick={(e) => { e.stopPropagation(); anadirSeccion(); }} className={estilosBoton.primario}><Plus className="size-4" /> Añadir sección</button>
              </div>
            )}
            {c.secciones.map((s, si) => {
              const elegida = sel?.tipo === 'seccion' && sel.id === s.id;
              return (
                <div key={s.id} className={`group/sec relative outline-offset-[-2px] ${elegida ? 'outline-2 outline-primario' : 'hover:outline-1 hover:outline-dashed hover:outline-primario/60'}`}
                  onClick={(e) => { e.stopPropagation(); setSel({ tipo: 'seccion', id: s.id }); }}>
                  <span className={`absolute left-1 top-1 z-20 rounded bg-primario px-1.5 py-0.5 text-[10px] font-semibold text-white ${elegida ? '' : 'hidden group-hover/sec:block'}`}>Sección {si + 1}</span>
                  {elegida && (
                    <Herr>
                      <BtnH t="Subir sección" off={si === 0} on={() => accionSeccion(s.id, 'subir')}><ArrowUp className="size-3.5" /></BtnH>
                      <BtnH t="Bajar sección" off={si === c.secciones.length - 1} on={() => accionSeccion(s.id, 'bajar')}><ArrowDown className="size-3.5" /></BtnH>
                      <BtnH t="Duplicar sección" on={() => accionSeccion(s.id, 'duplicar')}><Copy className="size-3.5" /></BtnH>
                      <BtnH t="Borrar sección" on={() => borrarSeleccion()}><Trash2 className="size-3.5" /></BtnH>
                    </Herr>
                  )}
                  <SeccionVista s={s} ctx={ctx} color={color}>
                    {s.bloques.length === 0 && <p className="rounded-lg border-2 border-dashed border-current/30 py-8 text-center text-sm opacity-60">Sección vacía: elige un bloque en «Añadir».</p>}
                    {s.bloques.map((b) => {
                      const activo = sel?.tipo === 'bloque' && sel.id === b.id;
                      return (
                        <div key={b.id} id={`ed-${b.id}`} className="relative" onClick={(e) => { e.stopPropagation(); setSel({ tipo: 'bloque', id: b.id }); }}>
                          <BloqueVista b={b} ctx={ctx} color={color} texto="" />
                          {/* Capa que recoge los clics (vídeos, calendarios y formularios no reaccionan en el editor). */}
                          <div className={`absolute -inset-1.5 z-10 cursor-pointer rounded ${activo ? 'ring-2 ring-primario' : 'hover:ring-1 hover:ring-primario/60'}`} />
                          {activo && (
                            <Herr alto>
                              <BtnH t="Subir" on={() => accionBloque(b.id, 'subir')}><ArrowUp className="size-3.5" /></BtnH>
                              <BtnH t="Bajar" on={() => accionBloque(b.id, 'bajar')}><ArrowDown className="size-3.5" /></BtnH>
                              <BtnH t="Duplicar" on={() => accionBloque(b.id, 'duplicar')}><Copy className="size-3.5" /></BtnH>
                              <BtnH t="Borrar" on={() => borrarSeleccion()}><Trash2 className="size-3.5" /></BtnH>
                            </Herr>
                          )}
                        </div>
                      );
                    })}
                  </SeccionVista>
                  {elegida && (
                    <button onClick={(e) => { e.stopPropagation(); anadirSeccion(si); }} className="absolute -bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primario px-3 py-1 text-xs font-semibold text-white shadow-lg">
                      <Plus className="size-3.5" /> Sección</button>
                  )}
                </div>
              );
            })}
          </div>
          {c.secciones.length > 0 && (
            <div className="mx-auto mt-4 flex max-w-[1200px] justify-center">
              <button onClick={(e) => { e.stopPropagation(); anadirSeccion(); }} className={estilosBoton.secundario}><Plus className="size-4" /> Añadir sección al final</button>
            </div>
          )}
        </div>

        {/* Panel derecho: propiedades */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-borde bg-superficie lg:flex">{panelDer}</aside>
      </div>
      {/* Pantallas pequeñas: los paneles se abren como hoja inferior */}
      <div className="flex gap-2 border-t border-borde bg-superficie px-3 py-2 lg:hidden">
        <button onClick={() => setHoja(hoja === 'izq' ? null : 'izq')} className={`${estilosBoton.secundario} flex-1 md:hidden`}><Plus className="size-4" /> Añadir</button>
        <button onClick={() => setHoja(hoja === 'der' ? null : 'der')} className={`${estilosBoton.secundario} flex-1`}><Palette className="size-4" /> {donde ? 'Editar selección' : 'Estilo'}</button>
      </div>
      {hoja && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70dvh] flex-col rounded-t-2xl border-t border-borde bg-superficie shadow-2xl lg:hidden" role="dialog" aria-label={hoja === 'izq' ? 'Añadir' : 'Propiedades'}>
          <div className="flex justify-end px-2 pt-2"><button onClick={() => setHoja(null)} className={estilosBoton.fantasma}>Cerrar</button></div>
          <div className="flex min-h-0 flex-1 flex-col">{hoja === 'izq' ? panelIzq : panelDer}</div>
        </div>
      )}
    </div>
  );
}
