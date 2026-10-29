'use client';
import Link from 'next/link';
import { useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import { ChevronsUpDown, CornerUpLeft, Pin, Search } from 'lucide-react';
import { alternarFijada, entrarEnSubcuenta } from '@/app/acciones-panel';
import { Avatar } from '@/components/ui/Avatar';
import { useFueraDe } from './useFueraDe';

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
    if (r) setPos({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - 16 - Math.min(448, window.innerWidth - 32))) });
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
        className="flex w-full items-center gap-2 rounded-lg border bg-superficie px-2 py-2 text-left hover:bg-superficie-2"
      >
        <Avatar nombre={actual.nombre} url={actual.logo_url} tam="size-8" suave />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{actual.nombre}</span>
          <span className="block truncate text-xs text-tenue">{actual.detalle}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-tenue" />
      </button>

      {abierto && (
        <div style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-[min(28rem,calc(100vw-2rem))] rounded-xl border bg-superficie p-3 shadow-xl">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar una subcuenta"
              className="w-full rounded-lg border-2 border-primario/40 bg-superficie py-2 pl-9 pr-3 text-sm focus:border-primario focus:outline-none"
            />
          </label>

          {vistaAgencia && !enAgencia && (
            <Link href="/agencia" onClick={() => setAbierto(false)} className="mt-3 flex items-center gap-2 px-1 text-sm font-medium text-primario">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primario text-white">
                <CornerUpLeft className="size-3.5" />
              </span>
              Cambiar a la vista de agencia
            </Link>
          )}

          <p className="mt-4 border-t px-1 pt-3 text-xs font-semibold uppercase tracking-wide text-tenue">Todas las cuentas</p>
          <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
            {filtradas.length === 0 && <li className="px-1 py-4 text-center text-sm text-tenue">No hay subcuentas que coincidan.</li>}
            {filtradas.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:border-primario/50">
                <button
                  type="button"
                  disabled={pendiente || s.suspendida}
                  onClick={() => iniciar(() => entrarEnSubcuenta(s.id))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
                >
                  <Avatar nombre={s.nombre} url={s.logo_url} tam="size-8" suave />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
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
                  className={`rounded p-1.5 ${s.fijada ? 'text-primario' : 'text-tenue/50 hover:text-tenue'}`}
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
