'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EllipsisVertical, ExternalLink, Filter, Plus, Search, Settings, X } from 'lucide-react';
import { crearCalendarioRapido, moverCita } from '@/app/subcuenta/[id]/calendarios/acciones';
import { useFueraDe } from '@/components/shell/useFueraDe';
import { Modal } from '@/components/ui/Modal';
import { estiloInput, estilosBoton } from '@/components/ui/clases';
import {
  DIAS_CORTOS, columnas, desplazar, diaEn, diasDeVista, etiquetaGmt, horaEn, instante, minutosDelDia, sumarDias,
  tituloRango, type Dia, type Vista,
} from '@/lib/calendario/tiempo';
import { fondoSuave, nombrePersona, type Bloqueo, type Calendario, type Cita } from '@/lib/calendario/tipos';
import { nombreContacto, type Usuario } from '@/lib/crm/tipos';
import { FormularioCita, type PresetCita } from './FormularioCita';
import { FormularioBloqueo } from './FormularioBloqueo';
import { MiniMes } from './MiniMes';

// Medidas del original (FullCalendar): 36 px por media hora, canal de horas de 61 px.
const PX_HORA = 72;
const PX_MIN = PX_HORA / 60;
const CANAL = 61;
const LINEA = '#dddddd';
const NOMBRE_VISTA: Record<Vista, string> = { dia: 'Vista diaria', semana: 'Vista semanal', mes: 'Vista mensual' };

type Dialogo =
  | { tipo: 'cita'; cita: Cita | null; preset?: PresetCita }
  | { tipo: 'bloqueo'; bloqueo: Bloqueo | null; preset?: { fecha: Dia; hora?: string } }
  | null;

interface Filtros { tipo: 'todo' | 'citas' | 'bloqueos'; usuarios: string[]; calendarios: string[] }
const SIN_FILTROS: Filtros = { tipo: 'todo', usuarios: [], calendarios: [] };

interface Props {
  subId: string;
  zona: string;
  vista: Vista;
  dia: Dia;
  hoy: Dia;
  calendarios: Calendario[];
  usuarios: Usuario[];
  citas: Cita[];
  bloqueos: Bloqueo[];
  yo: string;
  soyAdmin: boolean;
  abrirCita: Cita | null;
  abrirNueva: boolean;
  contactoNuevo?: Cita['contacto'];
}

function leer<T>(clave: string, defecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : defecto;
  } catch {
    return defecto;
  }
}
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento */
  }
}

export function VistaCalendario(p: Props) {
  const { subId, zona, vista, dia, hoy, calendarios, usuarios, yo } = p;
  const router = useRouter();
  const base = `/subcuenta/${subId}/calendarios`;
  const [citas, setCitas] = useState(p.citas);
  useEffect(() => setCitas(p.citas), [p.citas]);
  const [dialogo, setDialogo] = useState<Dialogo>(
    p.abrirCita ? { tipo: 'cita', cita: p.abrirCita } : p.abrirNueva && calendarios.length ? { tipo: 'cita', cita: null, preset: { fecha: dia, contacto: p.contactoNuevo ?? null } } : null,
  );
  const [panel, setPanel] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const claveFiltros = `cal:filtros:${subId}`;
  useEffect(() => {
    setPanel(leer('cal:panel', window.innerWidth >= 1280));
    setFiltros({ ...SIN_FILTROS, ...leer<Partial<Filtros>>(claveFiltros, {}) });
  }, [claveFiltros]);
  const cambiarPanel = (v: boolean) => { setPanel(v); guardar('cal:panel', v); };
  const cambiarFiltros = (f: Filtros) => { setFiltros(f); guardar(claveFiltros, f); };

  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const url = (v: Vista, d: Dia) => `${base}?vista=${v}&fecha=${d}`;
  const ir = (v: Vista, d: Dia) => router.push(url(v, d));
  const cerrar = useCallback(() => {
    setDialogo(null);
    // Quita ?cita= y ?nuevo= para que no se vuelva a abrir al refrescar.
    if (typeof window !== 'undefined' && /[?&](cita|nuevo)=/.test(window.location.search)) {
      router.replace(`${base}?vista=${vista}&fecha=${dia}`, { scroll: false });
    }
  }, [router, base, vista, dia]);

  const porCal = useMemo(() => new Map(calendarios.map((c) => [c.id, c])), [calendarios]);
  const verCitas = filtros.tipo !== 'bloqueos';
  const verBloqueos = filtros.tipo !== 'citas';
  const citasVisibles = useMemo(() => !verCitas ? [] : citas.filter((c) =>
    (!filtros.usuarios.length || (c.asignado_id && filtros.usuarios.includes(c.asignado_id)))
    && (!filtros.calendarios.length || filtros.calendarios.includes(c.calendario_id))), [citas, filtros, verCitas]);
  const bloqueosVisibles = useMemo(() => !verBloqueos ? [] : p.bloqueos.filter((b) =>
    (!filtros.usuarios.length || !b.usuario_id || filtros.usuarios.includes(b.usuario_id))
    && (!filtros.calendarios.length || !b.calendario_id || filtros.calendarios.includes(b.calendario_id))), [p.bloqueos, filtros, verBloqueos]);

  const nuevaCita = (preset?: PresetCita) => calendarios.length && setDialogo({ tipo: 'cita', cita: null, preset: preset ?? { fecha: dia === hoy || vista !== 'dia' ? hoy : dia } });

  const mover = async (cita: Cita, inicio: Date) => {
    const dur = Date.parse(cita.fin) - Date.parse(cita.inicio);
    const antes = citas;
    setCitas((l) => l.map((c) => c.id === cita.id ? { ...c, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + dur).toISOString() } : c));
    const r = await moverCita(subId, cita.id, inicio.toISOString());
    if (!r.ok) {
      setCitas(antes);
      alert(r.error);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-93px)] min-h-[480px] flex-col bg-superficie">
      <Barra
        {...{ vista, dia, hoy, calendarios, panel, soyAdmin: p.soyAdmin, subId, base }}
        url={url}
        ir={ir}
        alPanel={() => cambiarPanel(!panel)}
        alNuevaCita={() => nuevaCita()}
        alNuevoBloqueo={() => setDialogo({ tipo: 'bloqueo', bloqueo: null, preset: { fecha: vista === 'dia' ? dia : hoy } })}
      />
      <div className="flex min-h-0 flex-1 border-t border-[#e5e7eb]">
        <div className="flex min-w-0 flex-1 flex-col">
          {calendarios.length === 0 && <SinCalendarios subId={subId} soyAdmin={p.soyAdmin} base={base} />}
          {vista === 'mes' ? (
            <RejillaMes
              dia={dia} hoy={hoy} zona={zona} citas={citasVisibles} bloqueos={bloqueosVisibles} porCal={porCal}
              alDia={(d) => ir('dia', d)}
              alVacio={(d) => nuevaCita({ fecha: d, hora: '09:00' })}
              alCita={(c) => setDialogo({ tipo: 'cita', cita: c })}
              alBloqueo={(b) => setDialogo({ tipo: 'bloqueo', bloqueo: b })}
            />
          ) : (
            <RejillaHoras
              dias={diasDeVista(vista, dia)} hoy={hoy} zona={zona} ahora={ahora} citas={citasVisibles} bloqueos={bloqueosVisibles}
              porCal={porCal} usuarios={usuarios}
              alVacio={(d, hora) => nuevaCita({ fecha: d, hora })}
              alCita={(c) => setDialogo({ tipo: 'cita', cita: c })}
              alBloqueo={(b) => setDialogo({ tipo: 'bloqueo', bloqueo: b })}
              alMover={mover}
              alDia={(d) => ir('dia', d)}
            />
          )}
        </div>
        {panel && (
          <PanelVista filtros={filtros} cambiar={cambiarFiltros} usuarios={usuarios} calendarios={calendarios} alCerrar={() => cambiarPanel(false)} />
        )}
      </div>

      <Modal
        abierto={dialogo !== null}
        alCerrar={cerrar}
        ancho="max-w-2xl"
        titulo={dialogo?.tipo === 'bloqueo' ? (dialogo.bloqueo ? 'Editar franja bloqueada' : 'Bloquear franja horaria')
          : dialogo?.cita ? 'Editar cita' : 'Reservar cita'}
      >
        {dialogo?.tipo === 'cita' && (
          <FormularioCita
            key={dialogo.cita?.id ?? 'nueva'}
            subId={subId} zona={zona} cita={dialogo.cita} preset={dialogo.preset} calendarios={calendarios} usuarios={usuarios} yo={yo}
            alGuardar={cerrar} alBorrar={cerrar}
          />
        )}
        {dialogo?.tipo === 'bloqueo' && (
          <FormularioBloqueo
            key={dialogo.bloqueo?.id ?? 'nuevo'}
            subId={subId} zona={zona} bloqueo={dialogo.bloqueo} preset={dialogo.preset} calendarios={calendarios} usuarios={usuarios}
            alGuardar={cerrar} alBorrar={cerrar}
          />
        )}
      </Modal>
    </div>
  );
}

// --- Barra de herramientas -------------------------------------------------------

function Barra({ vista, dia, hoy, calendarios, panel, soyAdmin, base, url, ir, alPanel, alNuevaCita, alNuevoBloqueo }: {
  vista: Vista; dia: Dia; hoy: Dia; calendarios: Calendario[]; panel: boolean; soyAdmin: boolean; subId: string; base: string;
  url: (v: Vista, d: Dia) => string; ir: (v: Vista, d: Dia) => void;
  alPanel: () => void; alNuevaCita: () => void; alNuevoBloqueo: () => void;
}) {
  const [menu, setMenu] = useState<null | 'fecha' | 'vista' | 'mas' | 'nuevo'>(null);
  const cerrarMenu = useCallback(() => setMenu(null), []);
  const caja = useRef<HTMLDivElement>(null);
  useFueraDe(caja, menu !== null, cerrarMenu);
  const alternar = (m: NonNullable<typeof menu>) => setMenu((x) => (x === m ? null : m));
  const borde = 'border border-[#d1d5db]';
  const opcion = 'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[#344054] hover:bg-superficie-2 dark:text-texto-2';

  return (
    <div ref={caja} className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={url(vista, hoy)} className={estilosBoton.secundario}>Hoy</Link>
        <div className={`relative flex h-[37px] w-[240px] items-center rounded-lg ${borde}`}>
          <Link href={url(vista, desplazar(vista, dia, -1))} aria-label="Anterior" className="flex h-full items-center px-3 text-gray-700 hover:text-primario dark:text-texto-2">
            <ChevronLeft className="size-4" />
          </Link>
          <button type="button" onClick={() => alternar('fecha')} className="h-full flex-1 truncate text-center text-sm font-semibold text-gray-700 dark:text-texto-2">
            {tituloRango(vista, dia)}
          </button>
          <Link href={url(vista, desplazar(vista, dia, 1))} aria-label="Siguiente" className="flex h-full items-center px-3 text-gray-700 hover:text-primario dark:text-texto-2">
            <ChevronRight className="size-4" />
          </Link>
          {menu === 'fecha' && (
            <div className="absolute left-0 top-full z-40 mt-1 w-[280px] rounded-lg border bg-superficie p-3 shadow-lg">
              <MiniMes seleccionado={dia} hoy={hoy} alElegir={(d) => { setMenu(null); ir(vista, d); }} />
            </div>
          )}
        </div>
        <div className="relative">
          <button type="button" onClick={() => alternar('vista')} className={`flex h-[37px] w-[120px] items-center justify-between gap-1 rounded-lg px-3 text-sm font-semibold text-gray-700 dark:text-texto-2 ${borde}`}>
            <span className="truncate">{NOMBRE_VISTA[vista]}</span>
            <ChevronDown className="size-4 shrink-0" />
          </button>
          {menu === 'vista' && (
            <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-lg border bg-superficie p-1 shadow-lg">
              {(['dia', 'semana', 'mes'] as Vista[]).map((v) => (
                <button key={v} type="button" onClick={() => { setMenu(null); ir(v, dia); }}
                  className={`${opcion} ${v === vista ? 'font-semibold text-primario-texto' : ''}`}>{NOMBRE_VISTA[v]}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={alPanel} aria-pressed={panel}
          className={`flex h-[37px] items-center gap-2 rounded-lg border p-2 text-sm font-semibold ${panel ? 'border-[#84adff] text-[#004eeb]' : 'border-[#d1d5db] text-gray-700 dark:text-texto-2'}`}>
          <Filter className="size-4" /> Gestionar la vista
        </button>
        <div className="relative">
          <button type="button" onClick={() => alternar('mas')} aria-label="Más opciones" className={estilosBoton.icono}>
            <EllipsisVertical className="size-4" />
          </button>
          {menu === 'mas' && (
            <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-lg border bg-superficie p-1 shadow-lg">
              <Link href={`${base}/configuracion`} className={opcion} onClick={() => setMenu(null)}>
                <Settings className="size-4" /> Configuración del calendario
              </Link>
              {calendarios.filter((c) => c.activo).length > 0 && (
                <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-tenue">Páginas de reserva</p>
              )}
              {calendarios.filter((c) => c.activo).map((c) => (
                <a key={c.id} href={`/reservar/${c.slug}`} target="_blank" rel="noreferrer" className={opcion} onClick={() => setMenu(null)}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate">{c.nombre}</span>
                  <ExternalLink className="ml-auto size-3.5 shrink-0 text-tenue" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button type="button" onClick={() => alternar('nuevo')} className={estilosBoton.primario}>
            <Plus className="size-4" /> Nuevo
          </button>
          {menu === 'nuevo' && (
            <div className="absolute right-0 top-full z-40 mt-1 w-60 rounded-lg border bg-superficie p-1 shadow-lg">
              <button type="button" disabled={!calendarios.length} className={`${opcion} disabled:opacity-50`}
                title={calendarios.length ? undefined : soyAdmin ? 'Crea antes un calendario' : 'Un administrador tiene que crear un calendario'}
                onClick={() => { setMenu(null); alNuevaCita(); }}>Cita</button>
              <button type="button" className={opcion} onClick={() => { setMenu(null); alNuevoBloqueo(); }}>Franja horaria bloqueada</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SinCalendarios({ subId, soyAdmin, base }: { subId: string; soyAdmin: boolean; base: string }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <div className="mx-4 my-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#b2ccff] bg-[#f5f8ff] px-4 py-3 text-sm">
      <p className="flex-1 text-[#344054]">
        <span className="font-semibold">Todavía no hay calendarios.</span>{' '}
        {soyAdmin ? 'Crea el primero para recibir reservas y organizar citas.' : 'Pide a un administrador que cree uno.'}
      </p>
      {soyAdmin && (
        <form className="flex items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await crearCalendarioRapido(subId, nombre);
            if (!r.ok) setError(r.error ?? 'No se pudo crear.');
            else router.push(`${base}/configuracion/${r.id}`);
          });
        }}>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Consulta inicial" maxLength={120} required className={`${estiloInput} w-52`} />
          <button disabled={pendiente} className={estilosBoton.primario}>Crear calendario</button>
        </form>
      )}
      {error && <p className="w-full text-peligro">{error}</p>}
    </div>
  );
}

// --- Vista de día y de semana ----------------------------------------------------

interface Pieza { ini: number; fin: number; tipo: 'cita' | 'bloqueo'; cita?: Cita; bloqueo?: Bloqueo }

function RejillaHoras({ dias, hoy, zona, ahora, citas, bloqueos, porCal, usuarios, alVacio, alCita, alBloqueo, alMover, alDia }: {
  dias: Dia[]; hoy: Dia; zona: string; ahora: Date | null; citas: Cita[]; bloqueos: Bloqueo[];
  porCal: Map<string, Calendario>; usuarios: Usuario[];
  alVacio: (d: Dia, hora: string) => void; alCita: (c: Cita) => void; alBloqueo: (b: Bloqueo) => void;
  alMover: (c: Cita, inicio: Date) => void; alDia: (d: Dia) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const columnasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 8 * PX_HORA - 8;
  }, []);

  const gmt = etiquetaGmt(instante(dias[0], '12:00', zona), zona);
  const plantilla = { gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` };
  const minAncho = dias.length > 1 ? 'min-w-[720px]' : '';

  // Piezas de cada día (una cita que cruza medianoche sale en los dos días).
  const porDia = useMemo(() => dias.map((d) => {
    const t0 = instante(d, '00:00', zona).getTime();
    const t1 = instante(sumarDias(d, 1), '00:00', zona).getTime();
    const tramo = (a: string, b: string) => {
      const x = Math.max(Date.parse(a), t0);
      const y = Math.min(Date.parse(b), t1);
      return y > x ? { ini: (x - t0) / 60000, fin: (y - t0) / 60000 } : null;
    };
    const piezas: Pieza[] = [];
    for (const c of citas) { const r = tramo(c.inicio, c.fin); if (r) piezas.push({ ...r, tipo: 'cita', cita: c }); }
    for (const b of bloqueos) if (!b.todo_el_dia) { const r = tramo(b.inicio, b.fin); if (r) piezas.push({ ...r, tipo: 'bloqueo', bloqueo: b }); }
    const todoElDia = bloqueos.filter((b) => b.todo_el_dia && tramo(b.inicio, b.fin));
    return { piezas: columnas(piezas), todoElDia };
  }), [dias, zona, citas, bloqueos]);

  // Arrastrar para mover una cita (pasos de 15 minutos).
  const arrastre = useRef<{ cita: Cita; x0: number; y0: number; desfase: number; dur: number; movido: boolean } | null>(null);
  const [fantasma, setFantasma] = useState<{ id: string; idx: number; min: number } | null>(null);
  const posicion = (x: number, y: number) => {
    const caja = columnasRef.current!.getBoundingClientRect();
    const a = arrastre.current!;
    const idx = Math.min(dias.length - 1, Math.max(0, Math.floor(((x - caja.left) / caja.width) * dias.length)));
    const crudo = (y - caja.top) / PX_MIN - a.desfase;
    const min = Math.min(1440 - Math.min(a.dur, 1440), Math.max(0, Math.round(crudo / 15) * 15));
    return { idx, min };
  };

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto font-sans text-[14px] leading-[21px] text-tenue">
      <div className={minAncho}>
        {/* Cabecera de días y fila «Todo el día» (fijas al desplazar) */}
        <div className="sticky top-0 z-20 bg-superficie">
          <div className="flex">
            <div className="relative shrink-0" style={{ width: CANAL }}>
              <div className="absolute top-1 w-[55px] break-words text-center text-[10px] font-medium leading-[15px]">{gmt.replace(' ', '\n')}</div>
            </div>
            <div className="grid flex-1" style={plantilla}>
              {dias.map((d) => {
                const estilo = d === hoy ? 'text-primario' : d < hoy ? 'text-[#98a2b3]' : 'text-[#344054] dark:text-texto-2';
                return (
                  <button key={d} type="button" onClick={() => alDia(d)} className={`flex flex-col items-center py-1.5 text-[18px] font-medium leading-[26px] ${estilo}`}>
                    <span>{DIAS_CORTOS[new Date(d + 'T00:00:00Z').getUTCDay()]}</span>
                    <span>{Number(d.slice(8))}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex border-b" style={{ borderColor: LINEA }}>
            <div className="shrink-0 border-r border-t px-1 py-px text-[14px]" style={{ width: CANAL, borderColor: LINEA, minHeight: 43 }}>Todo el día</div>
            <div className="grid flex-1" style={plantilla}>
              {porDia.map(({ todoElDia }, i) => (
                <div key={dias[i]} className="space-y-0.5 border-r border-t p-0.5" style={{ borderColor: LINEA }}>
                  {todoElDia.map((b) => (
                    <button key={b.id} type="button" onClick={() => alBloqueo(b)}
                      className="block w-full truncate rounded bg-[repeating-linear-gradient(135deg,#f2f4f7,#f2f4f7_6px,#e4e7ec_6px,#e4e7ec_12px)] px-1.5 text-left text-xs font-medium text-[#475467]">
                      {b.titulo}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cuerpo: 24 horas */}
        <div className="flex">
          <div className="shrink-0" style={{ width: CANAL }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="border-r px-1 pt-[7px] text-right" style={{ height: PX_HORA, borderColor: LINEA }}>
                {h > 0 && `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          <div ref={columnasRef} className="relative grid flex-1" style={{ ...plantilla, height: 24 * PX_HORA }}>
            {/* Líneas: hora continua, media hora punteada */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {Array.from({ length: 48 }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t" style={{ top: i * (PX_HORA / 2), borderColor: LINEA, borderTopStyle: i % 2 ? 'dotted' : 'solid' }} />
              ))}
            </div>
            {dias.map((d, idx) => (
              <div
                key={d}
                className="relative border-r"
                style={{ borderColor: LINEA }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const min = Math.floor((e.clientY - r.top) / PX_MIN / 30) * 30;
                  alVacio(d, `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
                }}
              >
                {porDia[idx].piezas.map((pz) => {
                  const enMovimiento = fantasma && pz.cita && fantasma.id === pz.cita.id;
                  if (enMovimiento) return null;
                  const estilo = {
                    top: pz.ini * PX_MIN + 1,
                    height: Math.max(20, (pz.fin - pz.ini) * PX_MIN - 2),
                    left: `calc(${(pz.col / pz.cols) * 100}% + 2px)`,
                    width: `calc(${100 / pz.cols}% - 4px)`,
                  };
                  if (pz.tipo === 'bloqueo' && pz.bloqueo) {
                    const b = pz.bloqueo;
                    return (
                      <button key={'b' + b.id} type="button" onClick={() => alBloqueo(b)} style={estilo}
                        className="absolute z-[1] overflow-hidden rounded border border-[#d0d5dd] bg-[repeating-linear-gradient(135deg,#f9fafb,#f9fafb_6px,#eaecf0_6px,#eaecf0_12px)] px-1.5 py-0.5 text-left text-xs leading-4 text-[#475467]">
                        <span className="block truncate font-semibold">{b.titulo}</span>
                        <span className="block truncate">{horaEn(new Date(b.inicio), zona)} – {horaEn(new Date(b.fin), zona)}</span>
                      </button>
                    );
                  }
                  const c = pz.cita!;
                  const cal = porCal.get(c.calendario_id);
                  return (
                    <button
                      key={'c' + c.id + d}
                      type="button"
                      style={{ ...estilo, background: fondoSuave(cal?.color ?? '#155eef', c.estado === 'cancelada' ? 0.06 : 0.14), borderLeftColor: cal?.color ?? '#155eef' }}
                      className={`absolute z-[2] touch-none overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-left text-xs leading-4 text-[#101828] shadow-xs hover:z-[3] hover:shadow-md dark:text-texto ${c.estado === 'cancelada' ? 'opacity-60' : 'cursor-grab'}`}
                      title={`${c.titulo} · ${horaEn(new Date(c.inicio), zona)} – ${horaEn(new Date(c.fin), zona)}`}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                        arrastre.current = {
                          cita: c, x0: e.clientX, y0: e.clientY,
                          desfase: (e.clientY - r.top) / PX_MIN - pz.ini,
                          dur: (Date.parse(c.fin) - Date.parse(c.inicio)) / 60000, movido: false,
                        };
                        if (c.estado !== 'cancelada') e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        const a = arrastre.current;
                        if (!a || c.estado === 'cancelada') return;
                        if (!a.movido && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 5) return;
                        a.movido = true;
                        setFantasma({ id: c.id, ...posicion(e.clientX, e.clientY) });
                      }}
                      onPointerUp={(e) => {
                        const a = arrastre.current;
                        arrastre.current = null;
                        if (!a) return;
                        if (!a.movido) { alCita(c); return; }
                        const { idx: i, min } = posicion(e.clientX, e.clientY);
                        setFantasma(null);
                        const hhmm = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
                        const nuevo = instante(dias[i], hhmm, zona);
                        if (nuevo.getTime() !== Date.parse(c.inicio)) alMover(c, nuevo);
                      }}
                      onPointerCancel={() => { arrastre.current = null; setFantasma(null); }}
                    >
                      <span className={`block truncate font-semibold ${c.estado === 'cancelada' ? 'line-through' : ''}`}>{c.titulo}</span>
                      <span className="block truncate text-[#475467] dark:text-texto-2">
                        {horaEn(new Date(c.inicio), zona)} – {horaEn(new Date(c.fin), zona)}
                        {c.asignado_id && ` · ${nombrePersona(usuarios.find((u) => u.usuario_id === c.asignado_id))}`}
                      </span>
                      {c.contacto && pz.fin - pz.ini >= 60 && <span className="block truncate text-[#475467]">{nombreContacto(c.contacto)}</span>}
                    </button>
                  );
                })}
                {fantasma && fantasma.idx === idx && (() => {
                  const c = citas.find((x) => x.id === fantasma.id);
                  if (!c) return null;
                  const dur = (Date.parse(c.fin) - Date.parse(c.inicio)) / 60000;
                  const cal = porCal.get(c.calendario_id);
                  const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
                  return (
                    <div className="pointer-events-none absolute inset-x-0.5 z-10 rounded border-l-[3px] px-1.5 py-0.5 text-xs leading-4 shadow-lg ring-2 ring-primario/40"
                      style={{ top: fantasma.min * PX_MIN + 1, height: Math.max(20, dur * PX_MIN - 2), background: fondoSuave(cal?.color ?? '#155eef', 0.3), borderLeftColor: cal?.color }}>
                      <span className="block truncate font-semibold text-[#101828]">{c.titulo}</span>
                      <span className="block text-[#344054]">{hh(fantasma.min)} – {hh(fantasma.min + dur)}</span>
                    </div>
                  );
                })()}
                {ahora && d === diaEn(ahora, zona) && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[4] border-t-2 border-[#f04438]" style={{ top: minutosDelDia(ahora, zona) * PX_MIN }}>
                    <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-[#f04438]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Vista de mes ----------------------------------------------------------------

function RejillaMes({ dia, hoy, zona, citas, bloqueos, porCal, alDia, alVacio, alCita, alBloqueo }: {
  dia: Dia; hoy: Dia; zona: string; citas: Cita[]; bloqueos: Bloqueo[]; porCal: Map<string, Calendario>;
  alDia: (d: Dia) => void; alVacio: (d: Dia) => void; alCita: (c: Cita) => void; alBloqueo: (b: Bloqueo) => void;
}) {
  const dias = diasDeVista('mes', dia);
  const mes = dia.slice(0, 7);
  const porDia = useMemo(() => {
    const m = new Map<Dia, { citas: Cita[]; bloqueos: Bloqueo[] }>();
    for (const d of dias) m.set(d, { citas: [], bloqueos: [] });
    for (const c of citas) m.get(diaEn(new Date(c.inicio), zona))?.citas.push(c);
    for (const b of bloqueos) {
      // Un bloqueo de varios días aparece en cada uno.
      const ultimo = diaEn(new Date(Date.parse(b.fin) - 1), zona);
      for (let d = diaEn(new Date(b.inicio), zona), n = 0; d <= ultimo && n < 62; d = sumarDias(d, 1), n++) m.get(d)?.bloqueos.push(b);
    }
    return m;
  }, [dias, citas, bloqueos, zona]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto font-sans text-tenue">
      <div className="grid grid-cols-7 border-b" style={{ borderColor: LINEA }}>
        {DIAS_CORTOS.map((d) => <div key={d} className="py-2 text-center text-[13px] font-medium">{d}</div>)}
      </div>
      <div className="grid min-h-[620px] flex-1 grid-cols-7 grid-rows-6">
        {dias.map((d) => {
          const x = porDia.get(d)!;
          const items = [
            ...x.bloqueos.map((b) => ({ k: 'b' + b.id, orden: b.todo_el_dia ? '' : b.inicio, nodo: (
              <button type="button" onClick={() => alBloqueo(b)} className="block w-full truncate rounded bg-[#f2f4f7] px-1.5 text-left text-xs text-[#475467]">
                {b.todo_el_dia ? '' : horaEn(new Date(b.inicio), zona) + ' '}{b.titulo}
              </button>) })),
            ...x.citas.map((c) => ({ k: 'c' + c.id, orden: c.inicio, nodo: (
              <button type="button" onClick={() => alCita(c)} className={`flex w-full items-center gap-1 truncate rounded px-1 text-left text-xs text-[#344054] hover:bg-superficie-2 dark:text-texto-2 ${c.estado === 'cancelada' ? 'line-through opacity-60' : ''}`}>
                <span className="size-2 shrink-0 rounded-full" style={{ background: porCal.get(c.calendario_id)?.color ?? '#155eef' }} />
                <span className="shrink-0">{horaEn(new Date(c.inicio), zona)}</span>
                <span className="truncate font-medium">{c.titulo}</span>
              </button>) })),
          ].sort((a, b) => a.orden.localeCompare(b.orden));
          const resto = items.length - 3;
          return (
            <div key={d} className={`flex min-w-0 flex-col border-b border-r p-1 ${d.slice(0, 7) !== mes ? 'bg-superficie-2' : ''}`} style={{ borderColor: LINEA }}
              onClick={(e) => e.target === e.currentTarget && alVacio(d)}>
              <button type="button" onClick={() => alDia(d)} className={`mb-0.5 ml-auto flex size-6 items-center justify-center rounded-full text-[13px] ${
                d === hoy ? 'bg-primario font-semibold text-white' : d.slice(0, 7) !== mes ? 'text-[#98a2b3]' : 'text-[#344054] hover:bg-superficie-2 dark:text-texto-2'}`}>
                {Number(d.slice(8))}
              </button>
              <div className="space-y-0.5" onClick={(e) => e.target === e.currentTarget && alVacio(d)}>
                {items.slice(0, 3).map((i) => <div key={i.k}>{i.nodo}</div>)}
                {resto > 0 && (
                  <button type="button" onClick={() => alDia(d)} className="px-1 text-xs font-medium text-primario-texto hover:underline">+{resto} más</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Panel «Gestionar la vista» -----------------------------------------------------

function PanelVista({ filtros, cambiar, usuarios, calendarios, alCerrar }: {
  filtros: Filtros; cambiar: (f: Filtros) => void; usuarios: Usuario[]; calendarios: Calendario[]; alCerrar: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [abiertos, setAbiertos] = useState({ usuarios: true, calendarios: false });
  const t = busca.trim().toLowerCase();
  const us = usuarios.filter((u) => !t || nombrePersona(u).toLowerCase().includes(t) || u.email.toLowerCase().includes(t));
  const cs = calendarios.filter((c) => !t || c.nombre.toLowerCase().includes(t));
  const marcar = (grupo: 'usuarios' | 'calendarios', id: string) => {
    const set = new Set(filtros[grupo]);
    if (set.has(id)) set.delete(id); else set.add(id);
    cambiar({ ...filtros, [grupo]: [...set] });
  };
  const hayFiltros = filtros.usuarios.length + filtros.calendarios.length > 0 || filtros.tipo !== 'todo';

  const grupo = (clave: 'usuarios' | 'calendarios', titulo: string, children: React.ReactNode) => (
    <div className="border-b border-[#e5e7eb] px-2 py-2">
      <button type="button" onClick={() => setAbiertos((a) => ({ ...a, [clave]: !a[clave] }))}
        className="flex w-full items-center gap-1 py-1 text-left" aria-expanded={abiertos[clave]}>
        {abiertos[clave] ? <ChevronUp className="size-4 text-gray-500" /> : <ChevronDown className="size-4 text-gray-500" />}
        <span className="text-sm font-medium text-gray-900 dark:text-texto">{titulo}</span>
        {filtros[clave].length > 0 && <span className="ml-auto rounded-full bg-primario-suave px-2 text-xs font-medium text-primario-texto">{filtros[clave].length}</span>}
      </button>
      {abiertos[clave] && <div className="mt-1">{children}</div>}
    </div>
  );

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-[#e5e7eb] bg-superficie font-sans" aria-label="Gestionar la vista">
      <div className="mb-2 flex items-center justify-between border-b border-[#e5e7eb] px-2 py-3">
        <h2 className="text-base font-semibold text-[#101828] dark:text-texto">Gestionar la vista</h2>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="rounded p-1 text-gray-500 hover:bg-superficie-2"><X className="size-4" /></button>
      </div>
      <fieldset className="mx-2 flex flex-col gap-3 rounded-lg bg-[#f5f8ff] p-4 dark:bg-primario-suave">
        <legend className="sr-only">Ver por tipo</legend>
        <div>
          <div className="mb-2 text-sm font-medium text-gray-900 dark:text-texto">Ver por tipo</div>
          {([['todo', 'Todo'], ['citas', 'Citas'], ['bloqueos', 'Franjas horarias bloqueadas']] as const).map(([v, texto]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 py-[3px] text-sm text-[#344054] dark:text-texto-2">
              <input type="radio" name="ver-por-tipo" checked={filtros.tipo === v} onChange={() => cambiar({ ...filtros, tipo: v })} className="size-4 accent-primario" />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex flex-col gap-2 px-2 pt-1">
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-medium text-gray-900 dark:text-texto">Filtros</span>
          {hayFiltros && <button type="button" onClick={() => cambiar(SIN_FILTROS)} className="text-xs font-medium text-primario-texto hover:underline">Quitar filtros</button>}
        </div>
        <div className="relative mx-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#667085]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar usuarios, calendarios o grupos"
            className="h-[34px] w-full rounded-lg border border-borde-fuerte bg-superficie pl-9 pr-3 text-sm text-texto shadow-xs placeholder:text-[#667085] focus:border-primario focus:outline-none" />
        </div>
      </div>
      {grupo('usuarios', 'Usuarios', us.length === 0 ? <p className="py-1 text-[13px] text-tenue">Sin resultados</p> : us.map((u) => (
          <label key={u.usuario_id} className="flex cursor-pointer items-center gap-1 py-1 text-gray-600 dark:text-texto-2">
            <input type="checkbox" checked={filtros.usuarios.includes(u.usuario_id)} onChange={() => marcar('usuarios', u.usuario_id)} className="size-4 accent-primario" />
            <span className="truncate text-left text-[13px]">{nombrePersona(u)}</span>
          </label>
        )))}
      {grupo('calendarios', 'Calendarios', cs.length === 0 ? <p className="py-1 text-[13px] text-tenue">Sin resultados</p> : cs.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-1.5 py-1 text-gray-600 dark:text-texto-2">
            <input type="checkbox" checked={filtros.calendarios.includes(c.id)} onChange={() => marcar('calendarios', c.id)} className="size-4 accent-primario" />
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
            <span className="truncate text-left text-[13px]">{c.nombre}{c.activo ? '' : ' (inactivo)'}</span>
          </label>
        )))}
    </aside>
  );
}
