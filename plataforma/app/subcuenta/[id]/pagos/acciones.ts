'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { mensajeDeError } from '@/lib/errores';
import { dinero } from '@/lib/formato';
import { comprobarStripe, secretosStripe } from '@/lib/pagos/stripe';
import { enviarMensaje } from '@/app/subcuenta/[id]/conversaciones/acciones';
import type { Linea, Metodo } from '@/lib/pagos/tipos';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
type ResultadoId = Resultado & { id?: string };

function validar(...ids: (string | null | undefined)[]) {
  if (ids.some((i) => i != null && !UUID.test(i))) throw new Error('Identificador no válido.');
}
async function contexto(subId: string) {
  validar(subId);
  await usuarioActual();
  return crearClienteServidor();
}
const refrescar = (subId: string) => revalidatePath(`/subcuenta/${subId}`, 'layout');

// --- Facturas -----------------------------------------------------------------

export async function crearFactura(subId: string, contactoId: string | null = null): Promise<ResultadoId> {
  try {
    validar(contactoId);
    const supabase = await contexto(subId);
    const venc = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const r = await supabase.from('pag_facturas').insert({ subcuenta_id: subId, contacto_id: contactoId, vencimiento: venc }).select('id').single();
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    refrescar(subId);
    return { ok: true, id: r.data.id as string };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const esquemaLinea = z.object({
  producto_id: z.string().regex(UUID).nullable(),
  descripcion: z.string().trim().min(1, 'Cada línea necesita una descripción').max(500),
  cantidad: z.number().positive('La cantidad tiene que ser mayor que 0').max(1_000_000),
  precio: z.number().min(0, 'El precio no puede ser negativo').max(1e10),
  impuesto: z.number().min(0).max(100, 'El impuesto va de 0 a 100 %'),
});
const esquemaFactura = z.object({
  contacto_id: z.string().regex(UUID).nullable(),
  emision: z.string().regex(DIA, 'Fecha de emisión no válida'),
  vencimiento: z.string().regex(DIA).nullable(),
  notas: z.string().trim().max(5000),
  lineas: z.array(esquemaLinea).max(200, 'Máximo 200 líneas'),
}).refine((f) => !f.vencimiento || f.vencimiento >= f.emision, { message: 'El vencimiento no puede ser anterior a la emisión' });

export async function guardarFactura(subId: string, facturaId: string, datos: { contacto_id: string | null; emision: string; vencimiento: string | null; notas: string; lineas: Linea[] }): Promise<Resultado> {
  try {
    validar(facturaId);
    const d = esquemaFactura.safeParse(datos);
    if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? 'Datos no válidos' };
    const supabase = await contexto(subId);
    const { lineas, ...cabecera } = d.data;
    const a = await supabase.from('pag_facturas').update(cabecera).eq('id', facturaId).eq('subcuenta_id', subId).select('estado').single();
    if (a.error) return { ok: false, error: mensajeDeError(a.error) };
    if (a.data.estado === 'borrador' || a.data.estado === 'enviada') {
      const l = await supabase.rpc('pag_guardar_lineas', { p_factura: facturaId, p_lineas: lineas });
      if (l.error) return { ok: false, error: mensajeDeError(l.error) };
    }
    refrescar(subId);
    return { ok: true, mensaje: 'Factura guardada.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Marca la factura como enviada y, si se pide, manda el enlace por Conversaciones.
export async function enviarFactura(subId: string, facturaId: string, canal: 'email' | 'sms' | 'whatsapp' | 'ninguno'): Promise<Resultado> {
  try {
    validar(facturaId);
    const supabase = await contexto(subId);
    const { data: f } = await supabase.from('pag_facturas')
      .select('id, numero, estado, total, moneda, token, contacto_id, contacto:crm_contactos(nombre), subcuenta:subcuentas(nombre)')
      .eq('id', facturaId).eq('subcuenta_id', subId).single();
    if (!f) return { ok: false, error: 'La factura ya no existe.' };
    if (Number(f.total) <= 0) return { ok: false, error: 'Añade al menos una línea con importe antes de enviarla.' };
    if (f.estado === 'anulada') return { ok: false, error: 'La factura está anulada.' };
    if (f.estado === 'borrador') {
      const u = await supabase.from('pag_facturas').update({ estado: 'enviada' }).eq('id', facturaId);
      if (u.error) return { ok: false, error: mensajeDeError(u.error) };
    }
    if (canal !== 'ninguno') {
      if (!f.contacto_id) return { ok: false, error: 'La factura no tiene contacto al que enviarla.' };
      const empresa = (f.subcuenta as unknown as { nombre: string }).nombre;
      const nombre = (f.contacto as unknown as { nombre: string } | null)?.nombre || 'hola';
      const enlace = `${siteUrl()}/factura/${f.token}`;
      const cuerpo = `Hola ${nombre}, aquí tienes tu factura ${f.numero} de ${empresa} por ${dinero(Number(f.total), f.moneda as string)}. Puedes verla${f.estado === 'pagada' ? '' : ' y pagarla'} aquí: ${enlace}`;
      const r = await enviarMensaje(subId, f.contacto_id as string, canal, cuerpo, `Factura ${f.numero} de ${empresa}`);
      if (!r.ok) { refrescar(subId); return { ok: false, error: `La factura quedó como enviada, pero el mensaje falló: ${r.error}` }; }
    }
    refrescar(subId);
    return { ok: true, mensaje: canal === 'ninguno' ? 'Factura marcada como enviada.' : 'Factura enviada.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cambiarEstadoFactura(subId: string, facturaId: string, estado: 'anulada'): Promise<Resultado> {
  try {
    validar(facturaId);
    if (estado !== 'anulada') return { ok: false, error: 'Una factura emitida solo se puede anular.' };
    const supabase = await contexto(subId);
    const { error } = await supabase.from('pag_facturas').update({ estado }).eq('id', facturaId).eq('subcuenta_id', subId);
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

export async function borrarFactura(subId: string, facturaId: string): Promise<Resultado> {
  try {
    validar(facturaId);
    const supabase = await contexto(subId);
    const r = await supabase.from('pag_facturas').delete().eq('id', facturaId).eq('subcuenta_id', subId).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo se pueden borrar borradores. Las facturas emitidas se anulan.' };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

// --- Cobros -----------------------------------------------------------------------

export async function registrarCobro(subId: string, facturaId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    validar(facturaId);
    const importe = Number(String(fd.get('importe') ?? '').replace(',', '.'));
    if (!(importe > 0) || importe > 1e10) return { ok: false, error: 'Importe no válido.' };
    const metodo = String(fd.get('metodo') ?? '') as Metodo;
    if (!['efectivo', 'transferencia', 'tarjeta', 'bizum', 'otro'].includes(metodo)) return { ok: false, error: 'Elige el método de pago.' };
    const fecha = String(fd.get('fecha') ?? '');
    const supabase = await contexto(subId);
    let moneda = 'EUR';
    let contacto: string | null = String(fd.get('contacto_id') ?? '') || null;
    validar(contacto);
    if (facturaId) {
      const { data: f } = await supabase.from('pag_facturas').select('moneda, contacto_id, estado, total, cobrado').eq('id', facturaId).single();
      if (!f) return { ok: false, error: 'La factura ya no existe.' };
      if (f.estado === 'anulada') return { ok: false, error: 'No se cobra una factura anulada.' };
      if (f.estado === 'pagada') return { ok: false, error: 'La factura ya está pagada.' };
      const pendiente = Math.round((Number(f.total) - Number(f.cobrado)) * 100) / 100;
      if (importe > pendiente + 0.005) return { ok: false, error: `El importe supera lo pendiente (${pendiente.toFixed(2)}).` };
      moneda = f.moneda as string;
      contacto = (f.contacto_id as string) ?? contacto;
    } else {
      const { data: a } = await supabase.from('pag_ajustes').select('moneda').eq('subcuenta_id', subId).maybeSingle();
      moneda = (a?.moneda as string) || 'EUR';
    }
    const { error } = await supabase.from('pag_transacciones').insert({
      subcuenta_id: subId, factura_id: facturaId, contacto_id: contacto, importe: Math.round(importe * 100) / 100, moneda, metodo,
      referencia: String(fd.get('referencia') ?? '').trim().slice(0, 200), notas: String(fd.get('notas') ?? '').trim().slice(0, 1000),
      ...(DIA.test(fecha) ? { fecha: `${fecha}T12:00:00Z` } : {}),
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar(subId);
    return { ok: true, mensaje: 'Cobro registrado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reembolsarCobro(subId: string, txId: string): Promise<Resultado> {
  try {
    validar(txId);
    const supabase = await contexto(subId);
    const r = await supabase.from('pag_transacciones').update({ estado: 'reembolsada' }).eq('id', txId).eq('subcuenta_id', subId).select('id, metodo');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede marcar reembolsos.' };
    refrescar(subId);
    return { ok: true, mensaje: r.data[0].metodo === 'stripe' ? 'Marcado como reembolsado. Recuerda hacer el reembolso también en Stripe.' : 'Marcado como reembolsado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

// --- Productos ----------------------------------------------------------------------

export async function guardarProducto(subId: string, prodId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    validar(prodId);
    const nombre = String(fd.get('nombre') ?? '').trim();
    const precio = Number(String(fd.get('precio') ?? '').replace(',', '.'));
    const impuesto = Number(String(fd.get('impuesto') ?? '0').replace(',', '.'));
    if (!nombre || nombre.length > 200) return { ok: false, error: 'Ponle un nombre al producto.' };
    if (!(precio >= 0) || precio > 1e10) return { ok: false, error: 'Precio no válido.' };
    if (!(impuesto >= 0 && impuesto <= 100)) return { ok: false, error: 'El impuesto va de 0 a 100 %.' };
    const fila = { nombre, precio: Math.round(precio * 100) / 100, impuesto, descripcion: String(fd.get('descripcion') ?? '').trim().slice(0, 2000), activo: fd.getAll('activo').includes('on') };
    const supabase = await contexto(subId);
    const r = prodId
      ? await supabase.from('pag_productos').update(fila).eq('id', prodId).eq('subcuenta_id', subId)
      : await supabase.from('pag_productos').insert({ ...fila, subcuenta_id: subId });
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    refrescar(subId);
    return { ok: true, mensaje: 'Producto guardado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

export async function borrarProducto(subId: string, prodId: string): Promise<Resultado> {
  try {
    validar(prodId);
    const supabase = await contexto(subId);
    const { error } = await supabase.from('pag_productos').delete().eq('id', prodId).eq('subcuenta_id', subId);
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

// --- Configuración ----------------------------------------------------------------------

export async function guardarAjustesPago(subId: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const moneda = String(fd.get('moneda') ?? 'EUR').trim().toUpperCase();
    const prefijo = String(fd.get('prefijo') ?? '').trim();
    const siguiente = Number(fd.get('siguiente_numero'));
    const impuesto = Number(String(fd.get('impuesto_defecto') ?? '0').replace(',', '.'));
    if (!/^[A-Z]{3}$/.test(moneda)) return { ok: false, error: 'Moneda en formato ISO de 3 letras (EUR, USD…).' };
    if (!/^[A-Za-z0-9/_-]{0,12}$/.test(prefijo)) return { ok: false, error: 'El prefijo admite letras, números, guiones y barras (máx. 12).' };
    if (!Number.isInteger(siguiente) || siguiente < 1) return { ok: false, error: 'El siguiente número tiene que ser un entero mayor que 0.' };
    if (!(impuesto >= 0 && impuesto <= 100)) return { ok: false, error: 'El impuesto va de 0 a 100 %.' };
    const supabase = await contexto(subId);
    const a = await supabase.from('pag_ajustes').upsert({
      subcuenta_id: subId, moneda, prefijo, siguiente_numero: siguiente, impuesto_defecto: impuesto, pie: String(fd.get('pie') ?? '').trim().slice(0, 2000),
    }, { onConflict: 'subcuenta_id' });
    if (a.error) return { ok: false, error: mensajeDeError(a.error) };
    const s = await supabase.rpc('pag_guardar_secretos', {
      p_subcuenta: subId,
      p_secreta: fd.get('borrar_stripe') === 'on' ? null : String(fd.get('stripe_secreta') ?? '').trim(),
      p_webhook: fd.get('borrar_stripe') === 'on' ? null : String(fd.get('stripe_webhook') ?? '').trim(),
    });
    if (s.error) return { ok: false, error: mensajeDeError(s.error) };
    refrescar(subId);
    return { ok: true, mensaje: 'Configuración de pagos guardada.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

export async function comprobarConexionStripe(subId: string): Promise<Resultado> {
  try {
    const supabase = await contexto(subId);
    const { data: admin } = await supabase.rpc('soy_admin_subcuenta', { p_subcuenta: subId });
    if (!admin) return { ok: false, error: 'Solo un administrador puede comprobarlo.' };
    const { secreta } = await secretosStripe(subId);
    if (!secreta) return { ok: false, error: 'Guarda antes la clave secreta.' };
    return { ok: true, mensaje: await comprobarStripe(secreta) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
