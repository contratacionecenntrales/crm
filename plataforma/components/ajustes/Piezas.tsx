import Link from 'next/link';

// Título grande de las páginas de configuración (32 px, como el original).
export function TituloAjustes({ titulo, subtitulo, derecha }: { titulo: string; subtitulo?: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-normal leading-9 text-texto sm:text-[32px]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-tenue">{subtitulo}</p>}
      </div>
      {derecha}
    </div>
  );
}

export function PestanasAjustes({ pestanas, actual }: { pestanas: { clave: string; texto: string; href: string }[]; actual: string }) {
  return (
    <nav className="mb-6 flex gap-8 overflow-x-auto border-b border-borde" aria-label="Secciones">
      {pestanas.map((p) => (
        <Link key={p.clave} href={p.href} aria-current={actual === p.clave ? 'page' : undefined}
          className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-semibold ${actual === p.clave ? 'border-primario text-primario' : 'border-transparent text-texto hover:text-primario'}`}>
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}

// Fila de ajuste: explicación a la izquierda, tarjeta a la derecha.
export function SeccionAjuste({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-b border-borde py-6 first:pt-0 last:border-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-texto">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-sm text-tenue">{descripcion}</p>}
      </div>
      <div className="min-w-0 rounded-lg border border-borde bg-superficie p-5">{children}</div>
    </section>
  );
}

export function ContenedorAjustes({ children, ancho = 'max-w-6xl' }: { children: React.ReactNode; ancho?: string }) {
  return <div className={`mx-auto ${ancho} px-4 py-6 sm:px-6`}>{children}</div>;
}

export function Interruptor({ name, defaultChecked, etiqueta, descripcion, onChange, checked, disabled, ariaLabel }: {
  name?: string; defaultChecked?: boolean; etiqueta?: string; descripcion?: string; onChange?: (v: boolean) => void; checked?: boolean; disabled?: boolean;
  ariaLabel?: string; // cuando no hay etiqueta visible
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" aria-label={etiqueta ? undefined : ariaLabel} name={name} defaultChecked={defaultChecked} checked={checked} disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-gray-200 transition peer-checked:bg-primario peer-disabled:opacity-50 dark:bg-gray-700" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
      {(etiqueta || descripcion) && (
        <span>
          {etiqueta && <span className="block text-sm font-medium text-texto">{etiqueta}</span>}
          {descripcion && <span className="block text-sm text-tenue">{descripcion}</span>}
        </span>
      )}
    </label>
  );
}
