'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Columns3, List, Plus, Search, Settings2, User } from 'lucide-react';
import { moverOportunidad } from '@/app/subcuenta/[id]/oportunidades/acciones';
import { Modal } from '@/components/ui/Modal';
import { Aviso } from '@/components/ui/Aviso';
import { Insignia } from '@/components/ui/Insignia';
import { estilosBoton, estiloInput, estiloInputBase } from '@/components/ui/clases';
import { FormularioOportunidad } from './FormularioOportunidad';
import { dinero, haceCuanto } from '@/lib/formato';
import { nombreContacto, type Embudo, type Oportunidad, type Usuario } from '@/lib/crm/tipos';
import type { Resultado } from '@/lib/tipos';

interface Props {
  subId: string;
  embudos: Embudo[];
  embudoId: string;
  oportunidades: Oportunidad[];
  asignables: Usuario[];
  moneda: string;
  estado: string;
  busqueda: string;
  vista: 'tablero' | 'lista';
  soyAdmin: boolean;
}

const TONO = { abierta: 'azul', ganada: 'verde', perdida: 'rojo', abandonada: 'gris' } as const;

export function TableroOportunidades(p: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const [dialogo, setDialogo] = useState<null | { o?: Oportunidad; etapa?: string }>(null);
  useEffect(() => {
    if (sp.get('nueva') === '1') setDialogo({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cerrar = useCallback(() => setDialogo(null), []);
  const embudo = p.embudos.find((e) => e.id === p.embudoId)!;

  // Estado local por columna para poder mover tarjetas antes de que responda el servidor.
  const agrupar = useCallback(
    (lista: Oportunidad[]) =>
      Object.fromEntries(embudo.etapas.map((e) => [e.id, lista.filter((o) => o.etapa_id === e.id).sort((a, b) => a.posicion - b.posicion)])),
    [embudo],
  );
  const [columnas, setColumnas] = useState<Record<string, Oportunidad[]>>(() => agrupar(p.oportunidades));
  useEffect(() => setColumnas(agrupar(p.oportunidades)), [p.oportunidades, agrupar]);
  const [arrastrando, setArrastrando] = useState<Oportunidad | null>(null);
  const [origen, setOrigen] = useState<Record<string, Oportunidad[]> | null>(null);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnaDe = (id: string) => (id in columnas ? id : Object.keys(columnas).find((k) => columnas[k].some((o) => o.id === id)));

  const alEmpezar = (e: DragStartEvent) => {
    const col = columnaDe(String(e.active.id));
    setArrastrando(col ? columnas[col].find((o) => o.id === e.active.id) ?? null : null);
    setOrigen(columnas);
  };

  const alPasar = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const de = columnaDe(String(active.id));
    const a = columnaDe(String(over.id));
    if (!de || !a || de === a) return;
    setColumnas((c) => {
      const mov = c[de].find((o) => o.id === active.id)!;
      const destino = c[a].filter((o) => o.id !== active.id);
      const i = over.id in c ? destino.length : Math.max(0, destino.findIndex((o) => o.id === over.id));
      destino.splice(i, 0, { ...mov, etapa_id: a });
      return { ...c, [de]: c[de].filter((o) => o.id !== active.id), [a]: destino };
    });
  };

  const alSoltar = (e: DragEndEvent) => {
    const { active, over } = e;
    setArrastrando(null);
    if (!over) {
      if (origen) setColumnas(origen);
      return;
    }
    const col = columnaDe(String(active.id));
    if (!col) return;
    let lista = columnas[col];
    const desde = lista.findIndex((o) => o.id === active.id);
    const hasta = over.id in columnas ? lista.length - 1 : lista.findIndex((o) => o.id === over.id);
    if (hasta >= 0 && desde !== hasta) {
      lista = [...lista];
      const [x] = lista.splice(desde, 1);
      lista.splice(hasta, 0, x);
    }
    const i = lista.findIndex((o) => o.id === active.id);
    // Posición = punto medio entre vecinos: no hay que renumerar la columna.
    const antes = lista[i - 1]?.posicion;
    const despues = lista[i + 1]?.posicion;
    const posicion = antes === undefined && despues === undefined ? 1000 : antes === undefined ? despues! - 1000 : despues === undefined ? antes + 1000 : (antes + despues) / 2;
    const original = origen?.[col]?.find((o) => o.id === active.id);
    const nueva = { ...lista[i], posicion, etapa_id: col };
    lista = lista.map((o) => (o.id === active.id ? nueva : o));
    setColumnas((c) => ({ ...c, [col]: lista }));
    if (original && original.etapa_id === col && original.posicion === posicion) return;
    const copia = origen;
    iniciar(async () => {
      const r = await moverOportunidad(p.subId, String(active.id), col, posicion);
      if (!r.ok) {
        setAviso(r);
        if (copia) setColumnas(copia);
      }
    });
  };

  const navegar = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.push(`${ruta}?${n.toString()}`);
  };
  const [texto, setTexto] = useState(p.busqueda);
  useEffect(() => {
    if (texto === p.busqueda) return;
    const t = setTimeout(() => navegar('q', texto), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const totalValor = useMemo(() => p.oportunidades.reduce((s, o) => s + Number(o.valor), 0), [p.oportunidades]);

  return (
    <div className="flex h-[calc(100dvh-90px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <select value={p.embudoId} onChange={(e) => navegar('embudo', e.target.value)} className={`${estiloInputBase} w-auto font-medium`} aria-label="Embudo">
          {p.embudos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select value={p.estado} onChange={(e) => navegar('estado', e.target.value === 'abierta' ? '' : e.target.value)} className={`${estiloInputBase} w-auto`} aria-label="Estado">
          <option value="abierta">Abiertas</option>
          <option value="ganada">Ganadas</option>
          <option value="perdida">Perdidas</option>
          <option value="abandonada">Abandonadas</option>
          <option value="todas">Todas</option>
        </select>
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar oportunidades" className={`${estiloInput} pl-9`} />
        </label>
        <span className="text-sm text-tenue">{p.oportunidades.length} oportunidades · {dinero(totalValor, p.moneda)}</span>
        <div className="flex-1" />
        <div className="flex rounded-lg border p-0.5">
          <button onClick={() => navegar('vista', '')} aria-pressed={p.vista === 'tablero'} aria-label="Vista de tablero"
            className={`rounded-md p-1.5 ${p.vista === 'tablero' ? 'bg-primario text-white' : 'text-tenue'}`}><Columns3 className="size-4" /></button>
          <button onClick={() => navegar('vista', 'lista')} aria-pressed={p.vista === 'lista'} aria-label="Vista de lista"
            className={`rounded-md p-1.5 ${p.vista === 'lista' ? 'bg-primario text-white' : 'text-tenue'}`}><List className="size-4" /></button>
        </div>
        {p.soyAdmin && (
          <Link href={`/subcuenta/${p.subId}/oportunidades/embudos?embudo=${p.embudoId}`} className={estilosBoton.secundario} aria-label="Configurar embudo">
            <Settings2 className="size-4" />
          </Link>
        )}
        <button className={estilosBoton.primario} onClick={() => setDialogo({})}><Plus className="size-4" /> Añadir oportunidad</button>
      </div>
      {aviso && !aviso.ok && <div className="px-4 pb-2 sm:px-6"><Aviso estado={aviso} /></div>}

      {p.vista === 'lista' ? (
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 sm:px-6">
          <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b border-borde-fuerte bg-superficie text-left text-texto">
                <tr>{['Oportunidad', 'Contacto', 'Etapa', 'Estado', 'Valor', 'Propietario', 'En la etapa desde'].map((h) => <th key={h} className="px-4 py-2.5 text-sm font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {p.oportunidades.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-tenue">No hay oportunidades en esta vista.</td></tr>}
                {p.oportunidades.map((o) => (
                  <tr key={o.id} onClick={() => setDialogo({ o })} className="cursor-pointer hover:bg-superficie-2">
                    <td className="px-4 py-3 font-medium">{o.nombre}</td>
                    <td className="px-4 py-3">{o.contacto ? nombreContacto(o.contacto) : '—'}</td>
                    <td className="px-4 py-3">{embudo.etapas.find((e) => e.id === o.etapa_id)?.nombre}</td>
                    <td className="px-4 py-3"><Insignia tono={TONO[o.estado]}>{o.estado}</Insignia></td>
                    <td className="px-4 py-3">{dinero(o.valor, p.moneda)}</td>
                    <td className="px-4 py-3">{p.asignables.find((u) => u.usuario_id === o.propietario_id)?.email ?? 'Sin asignar'}</td>
                    <td className="px-4 py-3 text-tenue" suppressHydrationWarning>{haceCuanto(o.etapa_desde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <DndContext id="tablero-oportunidades" sensors={sensores} collisionDetection={closestCorners} onDragStart={alEmpezar} onDragOver={alPasar} onDragEnd={alSoltar}
          onDragCancel={() => { setArrastrando(null); if (origen) setColumnas(origen); }}>
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 sm:px-6">
            {embudo.etapas.map((etapa) => (
              <ColumnaEtapa key={etapa.id} id={etapa.id} titulo={etapa.nombre} oportunidades={columnas[etapa.id] ?? []} moneda={p.moneda}
                asignables={p.asignables} alAbrir={(o) => setDialogo({ o })} alNueva={() => setDialogo({ etapa: etapa.id })} />
            ))}
          </div>
          <DragOverlay>{arrastrando && <Tarjeta o={arrastrando} moneda={p.moneda} asignables={p.asignables} flotando />}</DragOverlay>
        </DndContext>
      )}

      <Modal abierto={dialogo !== null} alCerrar={cerrar} titulo={dialogo?.o ? 'Editar oportunidad' : 'Nueva oportunidad'} ancho="max-w-2xl">
        {dialogo !== null && (
          <FormularioOportunidad subId={p.subId} embudos={p.embudos} asignables={p.asignables} oportunidad={dialogo.o}
            embudoInicial={p.embudoId} etapaInicial={dialogo.etapa} moneda={p.moneda} alGuardar={cerrar} />
        )}
      </Modal>
    </div>
  );
}

function ColumnaEtapa({ id, titulo, oportunidades, moneda, asignables, alAbrir, alNueva }: {
  id: string; titulo: string; oportunidades: Oportunidad[]; moneda: string; asignables: Usuario[]; alAbrir: (o: Oportunidad) => void; alNueva: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const total = oportunidades.reduce((s, o) => s + Number(o.valor), 0);
  return (
    <section className={`flex w-72 shrink-0 flex-col rounded-lg border border-borde bg-superficie-2 ${isOver ? 'ring-2 ring-primario/40' : ''}`}>
      <header className="border-b px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold">{titulo}</h2>
          <button onClick={alNueva} aria-label={`Añadir en ${titulo}`} className="rounded p-1 text-tenue hover:bg-superficie hover:text-primario"><Plus className="size-4" /></button>
        </div>
        <p className="text-xs text-tenue">{oportunidades.length} oportunidades · {dinero(total, moneda)}</p>
      </header>
      <SortableContext id={id} items={oportunidades.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {oportunidades.map((o) => <TarjetaArrastrable key={o.id} o={o} moneda={moneda} asignables={asignables} alAbrir={alAbrir} />)}
        </ul>
      </SortableContext>
    </section>
  );
}

function TarjetaArrastrable({ o, moneda, asignables, alAbrir }: { o: Oportunidad; moneda: string; asignables: Usuario[]; alAbrir: (o: Oportunidad) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: o.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}
      className={`touch-manipulation ${isDragging ? 'opacity-30' : ''}`}>
      <div role="button" tabIndex={-1} onClick={() => alAbrir(o)}>
        <Tarjeta o={o} moneda={moneda} asignables={asignables} />
      </div>
    </li>
  );
}

function Tarjeta({ o, moneda, asignables, flotando }: { o: Oportunidad; moneda: string; asignables: Usuario[]; flotando?: boolean }) {
  const propietario = asignables.find((u) => u.usuario_id === o.propietario_id);
  return (
    <article className={`cursor-grab rounded-lg border bg-superficie p-3 text-sm shadow-sm active:cursor-grabbing ${flotando ? 'rotate-2 shadow-xl' : 'hover:border-primario/50'}`}>
      <p className="font-medium">{o.nombre}</p>
      {o.contacto && <p className="mt-0.5 truncate text-xs text-tenue">{nombreContacto(o.contacto)}</p>}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{dinero(o.valor, moneda)}</span>
        {o.estado !== 'abierta' && <Insignia tono={TONO[o.estado]}>{o.estado}</Insignia>}
        <span className="flex items-center gap-1 truncate text-tenue"><User className="size-3.5" />{propietario ? propietario.nombre || propietario.email.split('@')[0] : 'Sin asignar'}</span>
      </div>
    </article>
  );
}
