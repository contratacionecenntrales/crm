'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownUp, ChevronsUpDown, Columns3, Download, Filter, Mail, MessageSquare, MoreVertical, Phone, Plus, Search, Tag, Trash2, Upload, UserPlus, UserRound, X,
} from 'lucide-react';
import { accionLote, borrarLista, crearContacto, guardarLista } from '@/app/subcuenta/[id]/contactos/acciones';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Aviso } from '@/components/ui/Aviso';
import { estilosBoton, estiloInput, estiloInputBase } from '@/components/ui/clases';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { FormularioContacto } from './FormularioContacto';
import { Importador } from './Importador';
import { mostrarValor } from './CampoPersonalizado';
import { COLUMNAS_POR_DEFECTO, OPERADORES, todasLasColumnas, type Columna } from '@/lib/crm/columnas';
import { haceCuanto } from '@/lib/formato';
import type { Campo, Contacto, Filtro, ListaInteligente, Usuario } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

interface Props {
  subId: string;
  contactos: Contacto[];
  total: number;
  pagina: number;
  tam: number;
  filtros: Filtro[];
  busqueda: string;
  orden: string;
  listas: ListaInteligente[];
  listaActual: ListaInteligente | null;
  campos: Campo[];
  asignables: Usuario[];
  etiquetas: string[];
  zona: string;
  yo: string;
  soyAdmin: boolean;
}

// Formato del original: «Oct 29, 2026» y debajo «06:59 PM».
const fechaHora = (v: string, zona: string) => {
  const d = new Date(v);
  const fecha = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: zona }).format(d);
  const hora = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: zona }).format(d);
  return <>{fecha}<br />{hora}</>;
};

export function TablaContactos(p: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<null | 'crear' | 'importar' | 'lista' | 'etiquetar' | 'desetiquetar' | 'asignar' | 'borrar'>(null);
  const [panel, setPanel] = useState<null | 'filtros' | 'orden' | 'columnas'>(null);
  const cerrar = useCallback(() => setDialogo(null), []);
  useEffect(() => {
    if (params.get('nuevo') === '1') setDialogo('crear');
    else if (params.get('importar') === '1') setDialogo('importar');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columnasDisponibles = useMemo(() => todasLasColumnas(p.campos), [p.campos]);
  const claveCols = `cols:${p.subId}`;
  const [columnas, setColumnas] = useState<string[]>(COLUMNAS_POR_DEFECTO);
  useEffect(() => {
    if (p.listaActual?.columnas.length) return setColumnas(p.listaActual.columnas);
    try {
      const guardadas = JSON.parse(localStorage.getItem(claveCols) ?? 'null');
      if (Array.isArray(guardadas) && guardadas.length) setColumnas(guardadas);
    } catch {
      /* sin almacenamiento */
    }
  }, [claveCols, p.listaActual]);
  const cambiarColumnas = (c: string[]) => {
    setColumnas(c);
    try {
      localStorage.setItem(claveCols, JSON.stringify(c));
    } catch {
      /* sin almacenamiento */
    }
  };
  const visibles = columnas.map((c) => columnasDisponibles.find((x) => x.clave === c)).filter(Boolean) as Columna[];

  useEffect(() => setSeleccion(new Set()), [p.contactos]);

  const navegar = (cambios: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      // Con una lista abierta, «q=» vacío anula la búsqueda guardada (si se borrase, volvería la de la lista).
      if (v === '' && k === 'q' && p.listaActual?.busqueda) sp.set(k, '');
      else if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    if (!('p' in cambios)) sp.delete('p');
    iniciar(() => router.push(`${ruta}?${sp.toString()}`));
  };

  // Búsqueda con espera de 350 ms.
  const [texto, setTexto] = useState(p.busqueda);
  useEffect(() => setTexto(p.busqueda), [p.busqueda]);
  useEffect(() => {
    if (texto === p.busqueda) return;
    const t = setTimeout(() => navegar({ q: texto }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const nombreDe = (id: string | null) => {
    const u = p.asignables.find((x) => x.usuario_id === id);
    return u ? u.nombre || u.email.split('@')[0] : '';
  };

  const celda = (c: Contacto, col: Columna): React.ReactNode => {
    switch (col.clave) {
      case 'nombre': {
        const n = [c.nombre, c.apellidos].filter(Boolean).join(' ');
        return (
          <Link href={`/subcuenta/${p.subId}/contacto/${c.id}`} className="flex min-w-0 items-center gap-2 hover:text-primario">
            <Avatar nombre={n || c.email || '?'} tam="size-6 text-[10px]" pastel />
            <span className="truncate">{n || <span className="text-tenue">Sin nombre</span>}</span>
          </Link>
        );
      }
      case 'telefono':
        return c.telefono ? <span className="flex items-center gap-1.5"><Phone className="size-4 shrink-0 text-texto-2" /><span className="truncate">{c.telefono}</span></span> : null;
      case 'email':
        return c.email ? <span className="flex items-center gap-1.5"><Mail className="size-4 shrink-0 text-texto-2" /><span className="truncate">{c.email}</span></span> : null;
      case 'empresa':
        return c.empresa?.nombre ?? '';
      case 'creado':
      case 'actualizado':
        return <span className="block leading-[18px]">{fechaHora(c[col.clave], p.zona)}</span>;
      case 'ultima_actividad':
        return c.ultima_actividad ? <span suppressHydrationWarning className="flex items-center gap-1.5 truncate"><MessageSquare className="size-4 shrink-0 text-texto-2" />{haceCuanto(c.ultima_actividad).replace(/^h/, 'H')}</span> : null;
      case 'etiquetas':
        return (
          <span className="flex gap-1">
            {c.etiquetas.slice(0, 2).map((e) => <span key={e} className="truncate rounded-md border border-borde-fuerte px-2 py-0.5 text-xs font-medium text-texto-2">{e}</span>)}
            {c.etiquetas.length > 2 && <span className="text-xs text-tenue">+{c.etiquetas.length - 2}</span>}
          </span>
        );
      case 'tipo':
        return c.tipo === 'cliente' ? 'Cliente' : 'Lead';
      case 'propietario_id':
        return nombreDe(c.propietario_id);
      case 'dnd':
        return c.dnd ? 'Sí' : '';
      case 'fecha_nacimiento':
        return c.fecha_nacimiento ? mostrarValor({ tipo: 'fecha' }, c.fecha_nacimiento) : '';
      default:
        if (col.clave.startsWith('campo:')) {
          const def = p.campos.find((x) => `campo:${x.clave}` === col.clave);
          return def ? mostrarValor(def, c.campos[def.clave]) : '';
        }
        return String((c as unknown as Record<string, unknown>)[col.clave] ?? '');
    }
  };

  const todosMarcados = p.contactos.length > 0 && p.contactos.every((c) => seleccion.has(c.id));
  const alternarTodos = () => setSeleccion(todosMarcados ? new Set() : new Set(p.contactos.map((c) => c.id)));
  const alternar = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const lote = (operacion: 'añadir_etiqueta' | 'quitar_etiqueta' | 'asignar_propietario' | 'borrar', valor?: string) =>
    iniciar(async () => {
      const r = await accionLote(p.subId, [...seleccion], operacion, valor);
      setAviso(r);
      setDialogo(null);
      if (r.ok) setSeleccion(new Set());
    });

  const urlExportar = (ids?: string[]) => {
    const sp = new URLSearchParams(params.toString());
    sp.delete('p');
    if (ids?.length) sp.set('ids', ids.join(','));
    return `/subcuenta/${p.subId}/contactos/exportar?${sp.toString()}`;
  };

  const hasta = Math.min(p.total, p.pagina * p.tam);
  const desde = p.total === 0 ? 0 : (p.pagina - 1) * p.tam + 1;
  const paginas = Math.max(1, Math.ceil(p.total / p.tam));

  return (
    <div>
      {/* Listas inteligentes */}
      <div className="flex flex-wrap items-center gap-x-1 border-b border-borde-fuerte/60 px-4 sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <Pestana activa={!p.listaActual} onClick={() => navegar({ lista: null, f: null, q: null, o: null })}>Todo</Pestana>
        {p.listas.map((l) => (
          <Pestana key={l.id} activa={p.listaActual?.id === l.id} onClick={() => navegar({ lista: l.id, f: null, q: null, o: null })}>
            {l.nombre}
          </Pestana>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px bg-borde-fuerte" />
        <button onClick={() => setDialogo('lista')} className="flex shrink-0 items-center gap-1 px-2 py-3 text-sm font-medium text-texto-2 hover:text-primario">
          <Plus className="size-4" /> Añadir
        </button>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-2 py-2 sm:w-auto">
          <button onClick={() => setDialogo('crear')} className={estilosBoton.icono} aria-label="Añadir contacto" title="Añadir contacto">
            <UserPlus className="size-5" strokeWidth={1.75} />
          </button>
          <button onClick={() => setDialogo('importar')} className={estilosBoton.primario}>
            <Download className="size-4" /> Importar
          </button>
          <MenuMas
            elementos={[
              { texto: 'Exportar resultado a CSV', icono: <Upload className="size-4" />, href: urlExportar() },
              ...(p.listaActual && (p.listaActual.propietario_id === p.yo || p.soyAdmin)
                ? [
                    { texto: 'Guardar cambios en la lista', icono: <Columns3 className="size-4" />, onClick: () => setDialogo('lista') },
                    {
                      texto: 'Borrar esta lista', icono: <Trash2 className="size-4" />, peligro: true,
                      onClick: () => confirm(`¿Borrar la lista «${p.listaActual!.nombre}»? Los contactos no se borran.`) &&
                        iniciar(async () => {
                          const r = await borrarLista(p.subId, p.listaActual!.id);
                          setAviso(r);
                          if (r.ok) navegar({ lista: null });
                        }),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-lg border border-borde bg-superficie">
          {/* Barra de herramientas */}
          <div className="flex flex-wrap items-center gap-2 p-4">
            <BotonPanel abierto={panel === 'filtros'} onClick={() => setPanel(panel === 'filtros' ? null : 'filtros')}>
              <Filter className="size-4" /> Filtros{p.filtros.length > 0 && <span className="rounded-full bg-primario px-1.5 text-xs text-white">{p.filtros.length}</span>}
            </BotonPanel>
            <BotonPanel abierto={panel === 'orden'} onClick={() => setPanel(panel === 'orden' ? null : 'orden')}>
              <ArrowDownUp className="size-4" /> Ordenar
            </BotonPanel>
            <span className="inline-flex h-8 items-center rounded-full bg-[#eff8ff] px-3 text-sm font-semibold text-[#175cd3] dark:bg-blue-950 dark:text-blue-300">
              {p.total.toLocaleString('es-ES')} Contactos
            </span>
            <BotonPanel abierto={panel === 'columnas'} onClick={() => setPanel(panel === 'columnas' ? null : 'columnas')} sinBorde>
              <Columns3 className="size-4" /> {visibles.length}/{columnasDisponibles.length} columnas
            </BotonPanel>
            <label className="relative ml-auto w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar contactos" className={`${estiloInput} h-9 rounded-md pl-9`} aria-label="Buscar contactos" />
            </label>
          </div>

          {panel === 'filtros' && (
            <PanelFiltros
              inicial={p.filtros}
              columnas={columnasDisponibles}
              asignables={p.asignables}
              etiquetas={p.etiquetas}
              alAplicar={(f) => {
                setPanel(null);
                navegar({ f: f.length ? JSON.stringify(f) : null });
              }}
            />
          )}
          {panel === 'orden' && (
            <div className="flex flex-wrap items-end gap-3 border-t p-4">
              <label className="block">
                <span className="mb-1 block text-sm">Ordenar por</span>
                <select value={p.orden.split('.')[0]} onChange={(e) => navegar({ o: `${e.target.value}.${p.orden.split('.')[1] ?? 'desc'}` })} className={estiloInput}>
                  {columnasDisponibles.filter((c) => c.ordenable).map((c) => <option key={c.clave} value={c.clave}>{c.titulo}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">Dirección</span>
                <select value={p.orden.split('.')[1] ?? 'desc'} onChange={(e) => navegar({ o: `${p.orden.split('.')[0]}.${e.target.value}` })} className={estiloInput}>
                  <option value="asc">Ascendente (A→Z, antiguos primero)</option>
                  <option value="desc">Descendente (Z→A, recientes primero)</option>
                </select>
              </label>
            </div>
          )}
          {panel === 'columnas' && (
            <SelectorColumnas disponibles={columnasDisponibles} elegidas={columnas} alCambiar={cambiarColumnas} />
          )}

          {aviso && <div className="px-4 pb-3"><Aviso estado={aviso} /></div>}

          {seleccion.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t bg-primario-suave px-4 py-2 text-sm">
              <strong>{seleccion.size} seleccionados</strong>
              <button className={estilosBoton.fantasma} onClick={() => setDialogo('etiquetar')}><Tag className="size-4" /> Añadir etiqueta</button>
              <button className={estilosBoton.fantasma} onClick={() => setDialogo('desetiquetar')}><X className="size-4" /> Quitar etiqueta</button>
              <button className={estilosBoton.fantasma} onClick={() => setDialogo('asignar')}><UserRound className="size-4" /> Asignar</button>
              <a className={estilosBoton.fantasma} href={urlExportar([...seleccion])}><Upload className="size-4" /> Exportar</a>
              {p.soyAdmin && <button className={`${estilosBoton.fantasma} text-peligro`} onClick={() => setDialogo('borrar')}><Trash2 className="size-4" /> Eliminar</button>}
            </div>
          )}

          {/* Tabla */}
          <div className={`mx-4 mb-2 overflow-x-auto rounded border border-borde ${pendiente ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[48rem] table-fixed border-collapse text-sm">
              <thead className="text-left">
                <tr className="border-b border-borde">
                  <th className="w-12 px-4 py-2.5">
                    <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} aria-label="Seleccionar todos" className="size-4 rounded accent-[var(--color-primario)]" />
                  </th>
                  {visibles.map((c) => (
                    <th key={c.clave} className={`border-l border-borde px-3 py-2.5 font-semibold text-texto-2 ${c.clave === 'nombre' ? 'w-48' : 'w-40'}`}>
                      {c.ordenable ? (
                        <button
                          className="flex w-full items-center gap-1 truncate hover:text-primario"
                          onClick={() => navegar({ o: `${c.clave}.${p.orden === `${c.clave}.asc` ? 'desc' : 'asc'}` })}
                        >
                          <span className="truncate">{c.titulo}</span>
                          <ChevronsUpDown className={`ml-auto size-3.5 shrink-0 ${p.orden.startsWith(c.clave + '.') ? 'text-primario' : 'text-tenue'}`} />
                        </button>
                      ) : (
                        <span className="block truncate">{c.titulo}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.contactos.length === 0 && (
                  <tr><td colSpan={visibles.length + 1} className="px-4 py-16 text-center text-tenue">
                    {p.filtros.length || p.busqueda ? 'Ningún contacto coincide con los filtros.' : 'Aún no hay contactos. Añade uno o importa un CSV.'}
                  </td></tr>
                )}
                {p.contactos.map((c) => (
                  <tr key={c.id} className={`border-b border-borde last:border-b-0 hover:bg-superficie-2 ${seleccion.has(c.id) ? 'bg-primario-suave/50' : ''}`}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => alternar(c.id)} aria-label="Seleccionar contacto" className="size-4 rounded accent-[var(--color-primario)]" />
                    </td>
                    {visibles.map((col) => <td key={col.clave} className="h-10 truncate border-l border-transparent px-3 py-2 text-texto-2">{celda(c, col)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex flex-wrap items-center justify-end gap-3 px-4 pb-4 pt-2 text-sm text-texto-2">
            <label className="flex items-center gap-2">
              Filas por página
              <select value={p.tam} onChange={(e) => navegar({ n: e.target.value })} className={`${estiloInputBase} w-20 py-1`}>
                {[20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span>{desde}-{hasta} de {p.total.toLocaleString('es-ES')}</span>
            <button disabled={p.pagina <= 1} onClick={() => navegar({ p: String(p.pagina - 1) })} className={`${estilosBoton.secundario} h-8`}>Anterior</button>
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-primario px-2 text-primario">{p.pagina}</span>
            <button disabled={p.pagina >= paginas} onClick={() => navegar({ p: String(p.pagina + 1) })} className={`${estilosBoton.secundario} h-8`}>Siguiente</button>
          </div>
        </div>
      </div>

      {/* Diálogos */}
      <Modal abierto={dialogo === 'crear'} alCerrar={cerrar} titulo="Añadir contacto" ancho="max-w-2xl">
        <FormularioContacto
          accion={crearContacto.bind(null, p.subId)}
          campos={p.campos}
          asignables={p.asignables}
          conEtiquetas
          alGuardar={(r) => {
            cerrar();
            if (r.id) router.push(`/subcuenta/${p.subId}/contacto/${r.id}`);
          }}
        />
      </Modal>
      <Modal abierto={dialogo === 'importar'} alCerrar={cerrar} titulo="Importar contactos" ancho="max-w-3xl">
        <Importador subId={p.subId} campos={p.campos} alTerminar={cerrar} />
      </Modal>
      <Modal abierto={dialogo === 'lista'} alCerrar={cerrar} titulo={p.listaActual ? 'Guardar lista' : 'Nueva lista inteligente'}>
        <GuardarLista
          inicial={p.listaActual}
          alGuardar={(nombre, compartida, nueva) =>
            iniciar(async () => {
              const r = await guardarLista(p.subId, {
                id: nueva ? undefined : p.listaActual?.id, nombre, compartida, filtros: p.filtros, busqueda: p.busqueda, orden: p.orden, columnas,
              });
              setAviso(r);
              setDialogo(null);
              if (r.ok && r.id) navegar({ lista: r.id, f: null, q: null, o: null });
            })
          }
        />
      </Modal>
      <Modal abierto={dialogo === 'etiquetar' || dialogo === 'desetiquetar'} alCerrar={cerrar}
        titulo={dialogo === 'etiquetar' ? `Añadir etiqueta a ${seleccion.size} contactos` : `Quitar etiqueta de ${seleccion.size} contactos`}>
        <PedirEtiqueta etiquetas={p.etiquetas} pendiente={pendiente}
          alAceptar={(e) => lote(dialogo === 'etiquetar' ? 'añadir_etiqueta' : 'quitar_etiqueta', e)} />
      </Modal>
      <Modal abierto={dialogo === 'asignar'} alCerrar={cerrar} titulo={`Asignar ${seleccion.size} contactos`}>
        <form onSubmit={(e) => { e.preventDefault(); lote('asignar_propietario', String(new FormData(e.currentTarget).get('u') ?? '')); }} className="space-y-4">
          <select name="u" className={estiloInput} defaultValue="">
            <option value="">Sin asignar</option>
            {p.asignables.map((u) => <option key={u.usuario_id} value={u.usuario_id}>{u.nombre || u.email}</option>)}
          </select>
          <div className="flex justify-end"><button disabled={pendiente} className={estilosBoton.primario}>Asignar</button></div>
        </form>
      </Modal>
      <Modal abierto={dialogo === 'borrar'} alCerrar={cerrar} titulo="Eliminar contactos">
        <p className="text-sm">Se borrarán <strong>{seleccion.size} contactos</strong> con sus notas, tareas y oportunidades. No se puede deshacer.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className={estilosBoton.secundario} onClick={cerrar}>Cancelar</button>
          <button disabled={pendiente} className={estilosBoton.peligro} onClick={() => lote('borrar')}>Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}

function Pestana({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${activa ? 'border-[#2e90fa] text-[#2e90fa]' : 'border-transparent text-texto-2 hover:text-[#2e90fa]'}`}>
      {children}
    </button>
  );
}

function BotonPanel({ abierto, onClick, children, sinBorde }: { abierto: boolean; onClick: () => void; children: React.ReactNode; sinBorde?: boolean }) {
  return (
    <button onClick={onClick} aria-expanded={abierto}
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium text-[#344054] dark:text-texto-2 ${sinBorde ? '' : 'border border-borde-fuerte shadow-xs'} ${abierto ? 'border-primario text-primario' : 'hover:bg-superficie-2'}`}>
      {children}
    </button>
  );
}

function MenuMas({ elementos }: { elementos: { texto: string; icono: React.ReactNode; href?: string; onClick?: () => void; peligro?: boolean }[] }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useFueraDe(caja, abierto, () => setAbierto(false));
  return (
    <div ref={caja} className="relative">
      <button onClick={() => setAbierto((v) => !v)} aria-label="Más opciones" className={estilosBoton.fantasma}><MoreVertical className="size-5" /></button>
      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-borde bg-superficie p-1 shadow-xl">
          {elementos.map((e) =>
            e.href ? (
              <a key={e.texto} href={e.href} onClick={() => setAbierto(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-superficie-2">{e.icono}{e.texto}</a>
            ) : (
              <button key={e.texto} onClick={() => { setAbierto(false); e.onClick?.(); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-superficie-2 ${e.peligro ? 'text-peligro' : ''}`}>{e.icono}{e.texto}</button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PanelFiltros({ inicial, columnas, asignables, etiquetas, alAplicar }: {
  inicial: Filtro[]; columnas: Columna[]; asignables: Usuario[]; etiquetas: string[]; alAplicar: (f: Filtro[]) => void;
}) {
  const [filtros, setFiltros] = useState<Filtro[]>(inicial.length ? inicial : []);
  const cambiar = (i: number, c: Partial<Filtro>) => setFiltros((f) => f.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const opcionesDe = (col?: Columna) =>
    col?.clave === 'propietario_id' ? asignables.map((u) => ({ valor: u.usuario_id, texto: u.nombre || u.email })) : col?.opciones;

  return (
    <div className="space-y-3 border-t p-4">
      {filtros.length === 0 && <p className="text-sm text-tenue">Sin filtros. Añade una condición.</p>}
      {filtros.map((f, i) => {
        const col = columnas.find((c) => c.clave === f.campo);
        const ops = col ? OPERADORES[col.tipo] : [];
        const op = ops.find((o) => o.op === f.op);
        const opciones = opcionesDe(col);
        return (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
            <select value={f.campo} onChange={(e) => {
              const nueva = columnas.find((c) => c.clave === e.target.value)!;
              cambiar(i, { campo: e.target.value, op: OPERADORES[nueva.tipo][0].op, valor: '' });
            }} className={estiloInput} aria-label="Campo">
              {columnas.map((c) => <option key={c.clave} value={c.clave}>{c.titulo}</option>)}
            </select>
            <select value={f.op} onChange={(e) => cambiar(i, { op: e.target.value })} className={estiloInput} aria-label="Condición">
              {ops.map((o) => <option key={o.op} value={o.op}>{o.texto}</option>)}
            </select>
            {op?.sinValor ? <span /> : opciones ? (
              <select value={f.valor ?? ''} onChange={(e) => cambiar(i, { valor: e.target.value })} className={estiloInput} aria-label="Valor">
                <option value="">Elige…</option>
                {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
              </select>
            ) : col?.tipo === 'etiquetas' ? (
              <>
                <input list="lista-etiquetas" value={f.valor ?? ''} onChange={(e) => cambiar(i, { valor: e.target.value })} className={estiloInput} aria-label="Etiqueta" />
                <datalist id="lista-etiquetas">{etiquetas.map((e) => <option key={e} value={e} />)}</datalist>
              </>
            ) : (
              <input type={col?.tipo === 'fecha' && !op?.numerico ? 'date' : op?.numerico ? 'number' : 'text'} min={op?.numerico ? 1 : undefined}
                value={f.valor ?? ''} onChange={(e) => cambiar(i, { valor: e.target.value })} className={estiloInput} aria-label="Valor" />
            )}
            <button onClick={() => setFiltros((x) => x.filter((_, j) => j !== i))} aria-label="Quitar condición" className={estilosBoton.fantasma}><X className="size-4" /></button>
          </div>
        );
      })}
      <div className="flex flex-wrap justify-between gap-2">
        <button onClick={() => setFiltros((f) => [...f, { campo: 'nombre', op: 'contiene', valor: '' }])} className={estilosBoton.secundario}>
          <Plus className="size-4" /> Añadir condición
        </button>
        <div className="flex gap-2">
          {inicial.length > 0 && <button onClick={() => alAplicar([])} className={estilosBoton.secundario}>Quitar filtros</button>}
          <button onClick={() => alAplicar(filtros)} className={estilosBoton.primario}>Aplicar</button>
        </div>
      </div>
      <p className="text-xs text-tenue">Se muestran los contactos que cumplen todas las condiciones.</p>
    </div>
  );
}

function SelectorColumnas({ disponibles, elegidas, alCambiar }: { disponibles: Columna[]; elegidas: string[]; alCambiar: (c: string[]) => void }) {
  const mover = (i: number, d: number) => {
    const n = [...elegidas];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    alCambiar(n);
  };
  return (
    <div className="grid grid-cols-1 gap-4 border-t p-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium">Columnas visibles (orden)</p>
        <ul className="space-y-1">
          {elegidas.map((c, i) => {
            const col = disponibles.find((x) => x.clave === c);
            if (!col) return null;
            return (
              <li key={c} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                <span className="flex-1 truncate">{col.titulo}</span>
                <button onClick={() => mover(i, -1)} disabled={i === 0} className="px-1 text-tenue disabled:opacity-30" aria-label="Subir">↑</button>
                <button onClick={() => mover(i, 1)} disabled={i === elegidas.length - 1} className="px-1 text-tenue disabled:opacity-30" aria-label="Bajar">↓</button>
                {c !== 'nombre' && <button onClick={() => alCambiar(elegidas.filter((x) => x !== c))} className="px-1 text-tenue hover:text-peligro" aria-label="Ocultar"><X className="size-4" /></button>}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Añadir columnas</p>
        <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
          {disponibles.filter((c) => !elegidas.includes(c.clave)).map((c) => (
            <button key={c.clave} onClick={() => alCambiar([...elegidas, c.clave])} className="rounded-full border px-3 py-1 text-sm hover:border-primario hover:text-primario">
              + {c.titulo}
            </button>
          ))}
        </div>
        <button onClick={() => alCambiar(COLUMNAS_POR_DEFECTO)} className="mt-3 text-sm text-primario hover:underline">Restablecer</button>
      </div>
    </div>
  );
}

function GuardarLista({ inicial, alGuardar }: { inicial: ListaInteligente | null; alGuardar: (nombre: string, compartida: boolean, nueva: boolean) => void }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [compartida, setCompartida] = useState(inicial?.compartida ?? true);
  return (
    <form onSubmit={(e) => { e.preventDefault(); alGuardar(nombre, compartida, !inicial); }} className="space-y-4">
      <p className="text-sm text-tenue">Se guardan los filtros, la búsqueda, el orden y las columnas que tienes ahora.</p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={60} className={estiloInput} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={compartida} onChange={(e) => setCompartida(e.target.checked)} className="size-4" />
        Visible para todo el equipo de la subcuenta
      </label>
      <div className="flex justify-end gap-2">
        {inicial && <button type="button" onClick={() => alGuardar(nombre, compartida, true)} className={estilosBoton.secundario}>Guardar como nueva</button>}
        <button className={estilosBoton.primario}>Guardar</button>
      </div>
    </form>
  );
}

function PedirEtiqueta({ etiquetas, alAceptar, pendiente }: { etiquetas: string[]; alAceptar: (e: string) => void; pendiente: boolean }) {
  const [v, setV] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) alAceptar(v.trim()); }} className="space-y-4">
      <input list="etiquetas-lote" value={v} onChange={(e) => setV(e.target.value)} maxLength={60} required autoFocus className={estiloInput} placeholder="Escribe o elige una etiqueta" />
      <datalist id="etiquetas-lote">{etiquetas.map((e) => <option key={e} value={e} />)}</datalist>
      <div className="flex justify-end"><button disabled={pendiente} className={estilosBoton.primario}>Aceptar</button></div>
    </form>
  );
}
