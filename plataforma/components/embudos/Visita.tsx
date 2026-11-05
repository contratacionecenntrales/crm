'use client';
import { useEffect } from 'react';
import { registrarVisitaEmbudo } from '@/app/f/acciones';

// Cuenta la visita una vez por página y pestaña (no en el servidor: así no
// cuentan los robots ni las precargas).
export function Visita({ pasoId }: { pasoId: string }) {
  useEffect(() => {
    try {
      const k = `visita:${pasoId}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch { /* sin almacenamiento: se cuenta igual */ }
    void registrarVisitaEmbudo(pasoId);
  }, [pasoId]);
  return null;
}
