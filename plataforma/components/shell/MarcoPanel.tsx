'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { ICONOS, type ElementoNav } from './iconos';

export interface SeccionAjustes {
  titulo?: string; // «MI EMPRESA», «SERVICIOS EMPRESARIALES»…
  elementos: { href: string; etiqueta: string; exacto?: boolean; nueva?: boolean }[];
}

interface Props {
  principal: ElementoNav[];
  secundario?: ElementoNav[];
  ajustes?: ElementoNav;
  // Menú de Configuración: sustituye al menú principal dentro de los ajustes.
  menuAjustes?: { volver: string; secciones: SeccionAjustes[]; prefijo: string };
  logo: { url: string | null; nombre: string };
  selector: React.ReactNode;
  herramientas: React.ReactNode; // buscador y acciones rápidas
  acciones: React.ReactNode; // botones redondos de la barra superior
  children: React.ReactNode;
}

const CLAVE = 'menu:expandido';

const ContextoMenu = createContext(true);
// ¿Está el menú lateral desplegado? (lo leen el selector y el buscador)
export const useMenuExpandido = () => useContext(ContextoMenu);

// Barra lateral (expandida 240 px o plegada 56 px) y cabecera de 50 px,
// con las medidas del original.
export function MarcoPanel({ principal, secundario, ajustes, menuAjustes, logo, selector, herramientas, acciones, children }: Props) {
  const ruta = usePathname();
  const [expandido, setExpandido] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(CLAVE);
      setExpandido(v === null ? window.innerWidth >= 1024 : v === '1');
    } catch {
      setExpandido(window.innerWidth >= 1024);
    }
  }, []);
  const alternar = () =>
    setExpandido((v) => {
      try {
        localStorage.setItem(CLAVE, v ? '0' : '1');
      } catch {
        /* sin almacenamiento */
      }
      return !v;
    });

  const activo = (e: { href: string; exacto?: boolean; tambien?: string[] }) =>
    (e.exacto ? ruta === e.href : ruta === e.href || ruta.startsWith(e.href + '/')) ||
    Boolean(e.tambien?.some((t) => ruta.startsWith(t)));
  const enAjustes = Boolean(menuAjustes && ruta.startsWith(menuAjustes.prefijo));
  const ancho = expandido ? 'w-60' : 'w-14';

  const [tip, setTip] = useState<{ texto: string; top: number } | null>(null);
  const mostrar = (texto: string) => (ev: React.SyntheticEvent<HTMLElement>) => {
    if (expandido) return;
    const r = ev.currentTarget.getBoundingClientRect();
    setTip({ texto, top: r.top + r.height / 2 });
  };

  const item = (e: ElementoNav) => {
    const Icono = ICONOS[e.icono];
    const on = activo(e);
    return (
      <li key={e.href} className={expandido ? 'px-2' : ''}>
        <Link
          href={e.href}
          aria-label={expandido ? undefined : e.etiqueta}
          aria-current={on ? 'page' : undefined}
          onMouseEnter={mostrar(e.etiqueta)}
          onFocus={mostrar(e.etiqueta)}
          onMouseLeave={() => setTip(null)}
          onBlur={() => setTip(null)}
          className={`flex h-9 items-center rounded-md text-sm font-medium text-gray-900 dark:text-gray-200 ${
            expandido ? 'w-full gap-3 px-3' : 'w-14 justify-center px-4'
          } ${on ? 'bg-[var(--hover-menu)]' : 'hover:bg-[var(--hover-menu)]'}`}
        >
          <Icono className="size-5 shrink-0" strokeWidth={1.75} />
          {expandido && <span className="truncate">{e.etiqueta}</span>}
        </Link>
      </li>
    );
  };

  const separador = (
    <li aria-hidden className={`flex h-[33px] items-center ${expandido ? 'px-4' : 'px-4'}`}>
      <span className="h-px w-full bg-borde-fuerte" />
    </li>
  );

  return (
    <ContextoMenu.Provider value={expandido}>
    <div className="marco flex h-dvh overflow-hidden font-menu">
      <aside className={`relative z-40 flex h-dvh ${ancho} shrink-0 flex-col bg-superficie pb-2 pt-4 transition-[width] duration-200`}>
        <div className={`mb-3 flex h-10 shrink-0 items-center ${expandido ? 'justify-center px-4' : 'justify-center px-1'}`}>
          {logo.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.url} alt={logo.nombre} className={`max-h-10 object-contain ${expandido ? 'max-w-[140px]' : 'max-w-[38px]'}`} />
          ) : expandido ? (
            <span className="truncate text-lg font-bold tracking-tight text-primario">{logo.nombre}</span>
          ) : (
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-primario text-sm font-bold text-white" title={logo.nombre}>
              {logo.nombre.trim().slice(0, 1).toUpperCase() || 'M'}
            </span>
          )}
        </div>
        <div className={`mb-3 shrink-0 ${expandido ? 'mx-2' : 'mx-1'}`}>{selector}</div>
        <div className={`mb-4 flex shrink-0 ${expandido ? 'items-center gap-2 px-2' : 'flex-col items-center gap-2'}`}>{herramientas}</div>

        {enAjustes && menuAjustes ? (
          <nav className="flex min-h-0 flex-1 flex-col" aria-label="Configuración">
            <Link href={menuAjustes.volver} className={`mb-3 flex items-center gap-2 rounded-md bg-gray-200 text-sm text-texto-2 hover:bg-gray-300 dark:bg-gray-700 ${expandido ? 'mx-2 w-fit px-3 py-2' : 'mx-auto size-9 justify-center'}`}
              aria-label="Volver atrás">
              <ArrowLeft className="size-4" />{expandido && 'Volver atrás'}
            </Link>
            {expandido && <p className="mb-2 px-4 text-lg text-gray-800 dark:text-gray-100">Configuración</p>}
            <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
              {menuAjustes.secciones.map((s, i) => (
                <li key={s.titulo ?? i}>
                  {s.titulo && expandido && (
                    <p className="mb-1 mt-3 flex items-center gap-2 px-4 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      {s.titulo}<span className="h-px flex-1 bg-borde" />
                    </p>
                  )}
                  <ul>
                    {s.elementos.map((e) => {
                      const on = activo(e);
                      return (
                        <li key={e.href} className="px-2">
                          <Link href={e.href} aria-current={on ? 'page' : undefined} title={e.etiqueta}
                            className={`flex h-9 items-center gap-2 rounded-md px-2 text-sm text-[#344054] dark:text-texto-2 ${on ? 'bg-[var(--hover-menu)] font-medium' : 'hover:bg-[var(--hover-menu)]'}`}>
                            <span className="truncate">{expandido ? e.etiqueta : e.etiqueta.slice(0, 2)}</span>
                            {e.nueva && expandido && <span className="ml-auto rounded bg-[#fdb022] px-1.5 text-[10px] font-medium text-[#7a2e0e]">Nueva</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <nav className="flex min-h-0 flex-1 flex-col" aria-label="Navegación principal">
            <ul className="flex-1 overflow-y-auto">
              {principal.map(item)}
              {secundario && secundario.length > 0 && (
                <>
                  {separador}
                  {secundario.map(item)}
                </>
              )}
            </ul>
            {ajustes && <ul className="pt-2">{item(ajustes)}</ul>}
          </nav>
        )}

        <button
          onClick={alternar}
          aria-label={expandido ? 'Plegar menú' : 'Desplegar menú'}
          title={expandido ? 'Plegar menú' : 'Desplegar menú'}
          className="absolute -right-2.5 bottom-6 inline-flex size-5 items-center justify-center rounded-full bg-[#12b76a] text-white shadow"
        >
          {expandido ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      </aside>

      {tip && (
        <span
          role="tooltip"
          style={{ top: tip.top, left: 60 }}
          className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded bg-gray-800 px-3 py-1.5 text-sm text-white shadow-lg before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-[6px] before:border-transparent before:border-r-gray-800"
        >
          {tip.texto}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="barra-superior relative z-30 flex h-[50px] shrink-0 items-center justify-end gap-2.5 bg-superficie px-[15px] shadow-cabecera">
          {acciones}
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto font-sans">{children}</main>
      </div>
    </div>
    </ContextoMenu.Provider>
  );
}
