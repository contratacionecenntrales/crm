'use client';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { estilosBoton } from './clases';

export function BotonEnvio({ children, variante = 'primario', className = '' }: { children: React.ReactNode; variante?: keyof typeof estilosBoton; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${estilosBoton[variante]} ${className}`}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
