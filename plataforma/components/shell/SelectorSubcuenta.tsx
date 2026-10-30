'use client';
import Link from 'next/link';
import { useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import { ChevronsUpDown, CornerUpLeft, Pin, Search, UserRound } from 'lucide-react';
import { alternarFijada, entrarEnSubcuenta } from '@/app/acciones-panel';
import { Avatar } from '@/components/ui/Avatar';
import { useFueraDe } from './useFueraDe';
import { useMenuExpandido } from './MarcoPanel';

export interface OpcionSubcuenta {
  id: string;
  nombre: string;
  direccion: string;
  logo_url: string | null;
  fijada: boolean;
  suspendida: boolean;
}

interface Props {
  subcuentas: OpcionSubcuenta[];
  actual: { nombre: string; detalle: string; logo_url: string | null };
  vistaAgencia: boolean; // ¿puede volver a la vista de agencia?
  enAgencia: boolean;
}

export function SelectorSubcuenta({ subcuentas, actual, vistaAgencia, enAgencia }: Props) {
  const [abierto, setAbierto] = useState(false);
  const expandido = useMenuExpandido();
  const [busqueda, setBusqueda] = useState('');
  const [pendiente, iniciar] = useTransition();
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useFueraDe(caja, abierto, () => setAbierto(false));

  // El panel va en posición fija: dentro de la barra lateral (que tiene
  // scroll propio) un desplegable absoluto quedaría recortado.
  const alternar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top - 4, left: Math.min(r.right + 36, Math.max(8, window.innerWidth - 8 - Math.min(448, window.innerWidth - 16))) });
    setAbierto((v) => !v);
  };

  const [lista, fijarOptimista] = useOptimistic(subcuentas, (estado, { id, fijar }: { id: string; fijar: boolean }) =>
    estado.map((s) => (s.id === id ? { ...s, fijada: fijar } : s)),
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista
      .filter((s) => !q || s.nombre.toLowerCase().includes(q) || s.direccion.toLowerCase().includes(q) || s.id.startsWith(q))
      .sort((a, b) => Number(b.fijada) - Number(a.fijada) || a.nombre.localeCompare(b.nombre, 'es'));
  }, [lista, busqueda]);

  const fijar = (id: string, fijada: boolean) =>
    iniciar(async () => {
      fijarOptimista({ id, fijar: !fijada });
      await alternarFijada(id, !fijada);
    });

  return (
    <div ref={caja} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-label={`Cuenta actual: ${actual.nombre}. Cambiar de cuenta`}
        title={actual.nombre}
        className={`flex items-center rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 ${expandido ? 'h-11 w-full gap-2 px-2 text-left' : 'h-[42px] w-12 justify-center p-1'}`}
      >
        {actual.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actual.logo_url} alt="" className={`${expandido ? 'size-6' : 'size-8'} shrink-0 rounded-full object-cover`} />
        ) : (
          <span className={`inline-flex ${expandido ? 'size-6' : 'size-8'} shrink-0 items-center justify-center rounded-full bg-gray-400 text-white dark:bg-gray-500`}>
            <UserRound className={expandido ? 'size-4' : 'size-5'} strokeWidth={2} />
          </span>
        )}
        {expandido && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{enAgencia ? 'Haga clic aquí para cambiar' : actual.nombre}</span>
              {!enAgencia && actual.detalle && <span className="block truncate text-xs text-gray-500">{actual.detalle}</span>}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-gray-500" />
          </>
        )}
      </button>

      {abierto && (
        <div style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-[min(28rem,calc(100vw-1rem))] rounded-md border bg-superficie p-3 font-sans shadow-xl">
          <p className="mb-2 truncate px-1 text-xs text-tenue">Ahora en: <span className="font-medium text-texto">{actual.nombre}</span></p>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar una subcuenta"
              className="h-10 w-full rounded-md border-2 border-[#84adff] bg-superficie pl-9 pr-3 text-sm focus:border-primario focus:outline-none"
            />
          </label>

          {vistaAgencia && !enAgencia && (
            <Link href="/agencia" onClick={() => setAbierto(false)} className="mt-3 flex items-center gap-2 px-1 text-sm font-medium text-[#2e90fa]">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#2e90fa] text-white">
                <CornerUpLeft className="size-3.5" />
              </span>
              Cambiar a la vista de agencia
            </Link>
          )}

          <p className="mt-4 border-t px-1 pt-3 text-xs font-semibold uppercase tracking-wide text-tenue">Todas las cuentas</p>
          <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
            {filtradas.length === 0 && <li className="px-1 py-4 text-center text-sm text-tenue">No hay subcuentas que coincidan.</li>}
            {filtradas.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded border border-borde-fuerte px-3 py-2 hover:border-[#84adff]">
                <button
                  type="button"
                  disabled={pendiente || s.suspendida}
                  onClick={() => iniciar(() => entrarEnSubcuenta(s.id))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
                >
                  <Avatar nombre={s.nombre} url={s.logo_url} tam="size-8" suave />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-texto">
                      {s.nombre}
                      {s.suspendida && <span className="ml-2 text-xs font-normal text-peligro">Suspendida</span>}
                    </span>
                    <span className="block truncate text-xs text-tenue">{s.direccion || 'Sin dirección'}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fijar(s.id, s.fijada)}
                  aria-label={s.fijada ? 'Desfijar' : 'Fijar'}
                  aria-pressed={s.fijada}
                  className={`rounded p-1.5 ${s.fijada ? 'text-[#2e90fa]' : 'text-gray-300 hover:text-tenue'}`}
                >
                  <Pin className={`size-4 ${s.fijada ? 'fill-current' : ''}`} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
