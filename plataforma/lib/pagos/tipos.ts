export type EstadoFactura = 'borrador' | 'enviada' | 'pagada' | 'anulada';
export type Metodo = 'stripe' | 'efectivo' | 'transferencia' | 'tarjeta' | 'bizum' | 'otro';

export const METODOS: { valor: Metodo; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' }, { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'tarjeta', texto: 'Tarjeta (TPV)' }, { valor: 'bizum', texto: 'Bizum' }, { valor: 'otro', texto: 'Otro' },
];
export const NOMBRE_METODO: Record<Metodo, string> = { stripe: 'Stripe (online)', efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta (TPV)', bizum: 'Bizum', otro: 'Otro' };

export interface Producto { id: string; nombre: string; descripcion: string; precio: number; impuesto: number; activo: boolean }
export interface Linea { id?: string; producto_id: string | null; descripcion: string; cantidad: number; precio: number; impuesto: number }
export interface ContactoFactura { id: string; nombre: string; apellidos: string; email: string | null; telefono: string }

export interface Factura {
  id: string;
  numero: string;
  contacto_id: string | null;
  estado: EstadoFactura;
  moneda: string;
  emision: string;
  vencimiento: string | null;
  notas: string;
  subtotal: number;
  impuestos: number;
  total: number;
  cobrado: number;
  token: string;
  enviada_en: string | null;
  pagada_en: string | null;
  creado: string;
  contacto: ContactoFactura | null;
}

export const COLUMNAS_FACTURA =
  'id, numero, contacto_id, estado, moneda, emision, vencimiento, notas, subtotal, impuestos, total, cobrado, token, enviada_en, pagada_en, creado, contacto:crm_contactos(id, nombre, apellidos, email, telefono)';

export interface Transaccion {
  id: string; factura_id: string | null; contacto_id: string | null; importe: number; moneda: string; metodo: Metodo;
  referencia: string; estado: 'completada' | 'reembolsada'; notas: string; fecha: string;
  factura: { numero: string } | null; contacto: ContactoFactura | null;
}

// Estado que se muestra: una enviada con el vencimiento pasado sale «Vencida».
export function estadoVisible(f: Pick<Factura, 'estado' | 'vencimiento' | 'cobrado'>, hoy: string) {
  if (f.estado === 'enviada' && f.vencimiento && f.vencimiento < hoy) return 'vencida' as const;
  if (f.estado === 'enviada' && Number(f.cobrado) > 0) return 'parcial' as const;
  return f.estado;
}

export const ESTILO_ESTADO: Record<string, [string, string]> = {
  borrador: ['Borrador', 'bg-[#f2f4f7] text-[#344054]'],
  enviada: ['Enviada', 'bg-[#eff8ff] text-[#175cd3]'],
  parcial: ['Pago parcial', 'bg-[#fef0c7] text-[#93370d]'],
  vencida: ['Vencida', 'bg-[#fee4e2] text-[#b42318]'],
  pagada: ['Pagada', 'bg-[#dcfae6] text-[#067647]'],
  anulada: ['Anulada', 'bg-[#f2f4f7] text-[#667085] line-through'],
};
