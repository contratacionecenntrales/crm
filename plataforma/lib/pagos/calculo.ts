// Mismo redondeo que la base de datos (pag_recalcular): impuesto por línea
// redondeado a céntimos y luego sumado.
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function totales(lineas: { cantidad: number; precio: number; impuesto: number }[]) {
  let subtotal = 0;
  let impuestos = 0;
  for (const l of lineas) {
    const base = (Number(l.cantidad) || 0) * (Number(l.precio) || 0);
    subtotal += base;
    impuestos += r2((base * (Number(l.impuesto) || 0)) / 100);
  }
  subtotal = r2(subtotal);
  impuestos = r2(impuestos);
  return { subtotal, impuestos, total: r2(subtotal + impuestos) };
}

// Importe en la unidad mínima de Stripe (céntimos; sin decimales para JPY, KRW…).
const SIN_DECIMALES = new Set(['JPY', 'KRW', 'CLP', 'VND', 'PYG', 'ISK', 'HUF', 'XOF', 'XAF', 'UGX']);
export function aUnidadMinima(importe: number, moneda: string): number {
  return SIN_DECIMALES.has(moneda.toUpperCase()) ? Math.round(importe) : Math.round(importe * 100);
}
export function desdeUnidadMinima(n: number, moneda: string): number {
  return SIN_DECIMALES.has(moneda.toUpperCase()) ? n : n / 100;
}
