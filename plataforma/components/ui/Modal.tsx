'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: string;
}

// Diálogo nativo <dialog>: foco atrapado, Esc para cerrar y fondo modal gratis.
export function Modal({ abierto, alCerrar, titulo, children, ancho = 'max-w-xl' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && alCerrar()}
      className={`m-auto w-[calc(100%-2rem)] ${ancho} rounded-lg border border-borde bg-superficie p-0 text-texto shadow-xl backdrop:bg-black/40`}
    >
      {abierto && (
        <div>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
            <button type="button" onClick={alCerrar} className="rounded p-1 text-tenue hover:bg-superficie-2" aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </div>
          <div className="max-h-[75dvh] overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
