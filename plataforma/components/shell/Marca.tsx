'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AlertTriangle, Info, X, XOctagon } from 'lucide-react';
import { cerrarAnuncio } from '@/app/acciones-panel';

// Tema por defecto de la agencia, solo si el usuario no ha elegido uno.
export function TemaPorDefecto({ tema }: { tema: 'claro' | 'oscuro' }) {
  useEffect(() => {
    try {
      if (!localStorage.getItem('tema')) document.documentElement.classList.toggle('dark', tema === 'oscuro');
    } catch {
      /* sin almacenamiento */
    }
  }, [tema]);
  return null;
}

// Cierra la sesión tras N minutos sin actividad (compartido entre pestañas).
export function CierreInactividad({ minutos }: { minutos: number }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const CLAVE = 'ultima-actividad';
    const marcar = () => {
      try { localStorage.setItem(CLAVE, String(Date.now())); } catch { /* nada */ }
    };
    marcar();
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    let ultimo = 0;
    const alMover = () => { if (Date.now() - ultimo > 15_000) { ultimo = Date.now(); marcar(); } };
    eventos.forEach((e) => window.addEventListener(e, alMover, { passive: true }));
    const t = setInterval(() => {
      let ult = Date.now();
      try { ult = Number(localStorage.getItem(CLAVE)) || Date.now(); } catch { /* nada */ }
      if (Date.now() - ult > minutos * 60_000) form.current?.submit();
    }, 30_000);
    return () => { clearInterval(t); eventos.forEach((e) => window.removeEventListener(e, alMover)); };
  }, [minutos]);
  return <form ref={form} action="/auth/salir" method="post" className="hidden" aria-hidden />;
}

export interface AnuncioVisible { id: string; titulo: string; cuerpo: string; enlace: string; prioridad: 'general' | 'advertencia' | 'critico'; frecuencia: string }

const ESTILO = {
  general: ['border-[#84adff] bg-[#eff4ff] text-[#004eeb]', Info],
  advertencia: ['border-[#fec84b] bg-[#fffaeb] text-[#b54708]', AlertTriangle],
  critico: ['border-[#fda29b] bg-[#fef3f2] text-[#b42318]', XOctagon],
} as const;

export function Anuncios({ anuncios }: { anuncios: AnuncioVisible[] }) {
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [, iniciar] = useTransition();
  const visibles = anuncios.filter((a) => !ocultos.has(a.id));
  if (!visibles.length) return null;
  return (
    <div className="space-y-2 px-4 pt-3">
      {visibles.map((a) => {
        const [clase, Icono] = ESTILO[a.prioridad];
        return (
          <div key={a.id} role={a.prioridad === 'critico' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 text-sm ${clase}`}>
            <Icono className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.titulo}</p>
              {a.cuerpo && <p className="mt-0.5 whitespace-pre-line opacity-90">{a.cuerpo}</p>}
              {a.enlace && <a href={a.enlace} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium underline">Más información</a>}
            </div>
            <button aria-label="Cerrar aviso" onClick={() => { setOcultos((s) => new Set(s).add(a.id)); iniciar(async () => void (await cerrarAnuncio(a.id))); }}>
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
