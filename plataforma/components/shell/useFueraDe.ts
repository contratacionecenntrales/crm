'use client';
import { useEffect } from 'react';

// Cierra un desplegable al pulsar fuera o al pulsar Esc.
export function useFueraDe(ref: React.RefObject<HTMLElement | null>, activo: boolean, cerrar: () => void) {
  useEffect(() => {
    if (!activo) return;
    const alPulsar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('mousedown', alPulsar);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alPulsar);
      document.removeEventListener('keydown', alTecla);
    };
  }, [ref, activo, cerrar]);
}
