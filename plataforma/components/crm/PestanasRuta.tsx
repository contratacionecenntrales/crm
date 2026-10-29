'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function PestanasRuta({ pestanas }: { pestanas: { href: string; texto: string; exacto?: boolean }[] }) {
  const ruta = usePathname();
  return (
    <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Secciones">
      {pestanas.map((p) => {
        const activa = p.exacto ? ruta === p.href : ruta.startsWith(p.href);
        return (
          <Link key={p.href} href={p.href} aria-current={activa ? 'page' : undefined}
            className={`shrink-0 border-b-2 pb-3 text-sm font-medium ${activa ? 'border-primario text-primario' : 'border-transparent text-texto hover:text-primario'}`}>
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
