'use client';
import { useEffect, useState } from 'react';

export function CuentaAtras({ hasta, textoFin, color }: { hasta: string; textoFin: string; color: string }) {
  const fin = Date.parse(hasta);
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => { setAhora(Date.now()); const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (Number.isNaN(fin)) return null;
  if (ahora === null) return <div className="h-20" aria-hidden />;
  const resto = Math.max(0, fin - ahora);
  if (resto === 0) return <p className="text-center text-lg font-semibold" style={{ color }}>{textoFin || '¡Ya ha empezado!'}</p>;
  const partes = [[Math.floor(resto / 864e5), 'días'], [Math.floor(resto / 36e5) % 24, 'horas'], [Math.floor(resto / 6e4) % 60, 'min'], [Math.floor(resto / 1e3) % 60, 'seg']] as const;
  return (
    <div className="flex justify-center gap-3" role="timer" aria-live="off">
      {partes.map(([n, t]) => (
        <div key={t} className="min-w-16 rounded-lg px-3 py-2 text-center text-white" style={{ background: color }}>
          <div className="text-2xl font-bold tabular-nums">{String(n).padStart(2, '0')}</div><div className="text-xs opacity-90">{t}</div>
        </div>
      ))}
    </div>
  );
}
