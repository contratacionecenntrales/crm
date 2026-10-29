import { createHmac, timingSafeEqual } from 'node:crypto';

// Verificación de la cabecera Stripe-Signature sin el SDK de Stripe:
// t=<timestamp>,v1=<hmac>[,v1=...]  con  HMAC-SHA256(secreto, `${t}.${cuerpo}`).
export function verificarFirmaStripe(
  cuerpo: string,
  cabecera: string | null,
  secreto: string,
  toleranciaSeg = 300,
  ahoraSeg = Math.floor(Date.now() / 1000),
): boolean {
  if (!cabecera || !secreto) return false;
  const partes = cabecera.split(',').map((p) => p.trim().split('='));
  const t = partes.find(([k]) => k === 't')?.[1];
  const firmas = partes.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || firmas.length === 0 || !/^\d+$/.test(t)) return false;
  if (Math.abs(ahoraSeg - Number(t)) > toleranciaSeg) return false;
  const esperada = Buffer.from(createHmac('sha256', secreto).update(`${t}.${cuerpo}`).digest('hex'), 'utf8');
  return firmas.some((f) => {
    const b = Buffer.from(f, 'utf8');
    return b.length === esperada.length && timingSafeEqual(b, esperada);
  });
}

export type EstadoLocal = 'activa' | 'prueba' | 'impagada' | 'cancelada';

export function estadoDesdeStripe(estado: string): EstadoLocal {
  switch (estado) {
    case 'trialing':
      return 'prueba';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'impagada';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelada';
    default:
      return 'activa';
  }
}

interface ItemStripe {
  quantity?: number | null;
  price?: { unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null } | null;
}

// Importe mensual equivalente (en unidades, no céntimos) de los items de una suscripción.
export function importeMensualDesdeItems(items: ItemStripe[]): number {
  const factor: Record<string, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };
  const total = items.reduce((suma, it) => {
    const centimos = (it.price?.unit_amount ?? 0) * (it.quantity ?? 1);
    const intervalo = it.price?.recurring?.interval ?? 'month';
    const cada = it.price?.recurring?.interval_count || 1;
    return suma + (centimos / 100) * ((factor[intervalo] ?? 1) / cada);
  }, 0);
  return Math.round(total * 100) / 100;
}
