'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';

export interface Pestana {
  href: string;
  texto: string;
  exacto?: boolean;
  activa?: boolean; // para pestañas que dependen de la query (?pestana=)
  separada?: boolean; // raya vertical antes (p. ej. «Configuración del calendario»)
  engranaje?: boolean;
}

// Segunda fila de la cabecera: título del módulo y sus pestañas
// (18 px/500 #1F2937 y 14 px/500 #4B5563; la activa en #38A0DB con 2 px).
export function CabeceraModulo({ titulo, pestanas = [], derecha }: { titulo: string; pestanas?: Pestana[]; derecha?: React.ReactNode }) {
  const ruta = usePathname();
  return (
    <div className="cabecera-modulo sticky top-0 z-20 -mt-px flex min-h-10 items-end gap-2 overflow-x-auto bg-superficie pl-2 pr-4 font-menu shadow-cabecera">
      <h1 className="shrink-0 px-2 pb-3 text-lg font-medium leading-7 text-gray-800 dark:text-gray-100">{titulo}</h1>
      <nav className="flex items-end" aria-label={`Secciones de ${titulo}`}>
        {pestanas.map((p) => {
          const activa = p.activa ?? (p.exacto ? ruta === p.href : ruta === p.href || ruta.startsWith(p.href + '/'));
          return (
            <span key={p.href} className="flex items-end">
            {p.separada && <span aria-hidden className="mx-2 mb-2.5 h-7 w-px self-end bg-borde-fuerte md:mb-3" />}
            <Link
              href={p.href}
              aria-current={activa ? 'page' : undefined}
              className={`mx-1 shrink-0 whitespace-nowrap px-2 pb-2 text-sm font-medium leading-[25.6px] md:pb-3 ${
                activa ? 'border-b-2 border-pestana text-pestana' : 'text-[var(--menu)] hover:text-pestana'
              }`}
            >
              {p.engranaje && <Settings className="mr-2 inline size-[18px] -translate-y-px" strokeWidth={1.75} />}
              {p.texto}
            </Link>
            </span>
          );
        })}
      </nav>
      {derecha && <div className="ml-auto flex shrink-0 items-center gap-2 pb-2">{derecha}</div>}
    </div>
  );
}
