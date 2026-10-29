export function dinero(valor: number | string, moneda = 'EUR'): string {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fecha(valor: string | Date | null | undefined, zona = 'Europe/Madrid'): string {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: zona })
    .format(new Date(valor));
}

export function fechaHora(valor: string | Date | null | undefined, zona = 'Europe/Madrid'): string {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: zona,
  }).format(new Date(valor));
}

export function haceCuanto(valor: string | Date, ahora: Date = new Date()): string {
  const seg = Math.round((ahora.getTime() - new Date(valor).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const tramos: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year'],
  ];
  let v = seg;
  for (const [tope, unidad] of tramos) {
    if (Math.abs(v) < tope) return rtf.format(-Math.round(v), unidad);
    v /= tope;
  }
  return '';
}

export function iniciales(nombre: string): string {
  const partes = nombre.split('@')[0].replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function mesCorto(aaaamm: string): string {
  const [a, m] = aaaamm.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(Date.UTC(a, m - 1, 15)));
}

export function direccionCompleta(s: { direccion: string; ciudad: string; provincia: string; codigo_postal: string }): string {
  return [s.direccion, [s.codigo_postal, s.ciudad].filter(Boolean).join(' '), s.provincia]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(', ');
}
