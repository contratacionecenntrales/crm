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

// Importe en la unidad mínima de Stripe: sin decimales (JPY, KRW…), con tres
// (KWD, BHD…) o con dos (el resto, incluidos ISK y HUF, que Stripe trata así).
const CERO = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const TRES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);
export function aUnidadMinima(importe: number, moneda: string): number {
  const m = moneda.toUpperCase();
  return CERO.has(m) ? Math.round(importe) : TRES.has(m) ? Math.round(importe * 100) * 10 : Math.round(importe * 100);
}
export function desdeUnidadMinima(n: number, moneda: string): number {
  const m = moneda.toUpperCase();
  return CERO.has(m) ? n : TRES.has(m) ? n / 1000 : n / 100;
}
