'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ICONOS, type ElementoNav } from './iconos';

interface Props {
  navegacion: ElementoNav[];
  selector: React.ReactNode;
  acciones: React.ReactNode;
  children: React.ReactNode;
}

export function MarcoPanel({ navegacion, selector, acciones, children }: Props) {
  const ruta = usePathname();
  const [movil, setMovil] = useState(false);
  useEffect(() => setMovil(false), [ruta]);

  const activo = (e: ElementoNav) => (e.exacto ? ruta === e.href : ruta === e.href || ruta.startsWith(e.href + '/'));

  const lateral = (
    <nav className="flex h-full flex-col gap-4 p-3" aria-label="Navegación principal">
      <div className="px-1 pt-1 text-lg font-bold tracking-tight text-primario">METATOK</div>
      {selector}
      <ul className="space-y-1">
        {navegacion.map((e) => {
          const Icono = ICONOS[e.icono];
          const on = activo(e);
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  on ? 'bg-primario-suave text-primario' : 'text-tenue hover:bg-superficie-2 hover:text-texto'
                }`}
              >
                <Icono className="size-5 shrink-0" />
                {e.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r bg-superficie lg:block">{lateral}</aside>

      {movil && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMovil(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="h-full w-72 max-w-[85vw] overflow-y-auto bg-superficie shadow-xl">
            <div className="flex justify-end p-2">
              <button onClick={() => setMovil(false)} aria-label="Cerrar menú" className="rounded p-2 text-tenue">
                <X className="size-5" />
              </button>
            </div>
            {lateral}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-superficie px-4">
          <button onClick={() => setMovil(true)} aria-label="Abrir menú" className="rounded p-2 text-tenue hover:bg-superficie-2 lg:hidden">
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          {acciones}
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
