'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { enviarGuardado } from '@/lib/conversaciones/envio';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import type { Canal } from '@/lib/conversaciones/tipos';
const CANALES: Canal[] = ['sms', 'whatsapp', 'email', 'nota'];

function validar(...ids: (string | null | undefined)[]) {
  if (ids.some((i) => i != null && !UUID.test(i))) throw new Error('Identificador no válido.');
}

async function contexto(subId: string) {
  validar(subId);
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  return { usuario, supabase };
}

const refrescar = (subId: string) => revalidatePath(`/subcuenta/${subId}/conversaciones`, 'layout');

// Escribe un mensaje a un contacto: abre la conversación si no existía,
// guarda el mensaje (RLS: a nombre de quien escribe) y lo envía.
export async function enviarMensaje(subId: string, contactoId: string, canal: Canal, cuerpo: string, asunto = ''):
  Promise<Resultado & { conversacionId?: string }> {
  try {
    validar(contactoId);
    if (!CANALES.includes(canal)) return { ok: false, error: 'Canal no válido.' };
    const texto = cuerpo.trim();
    if (!texto) return { ok: false, error: 'Escribe un mensaje.' };
    if (texto.length > (canal === 'email' ? 20000 : 1600)) return { ok: false, error: 'El mensaje es demasiado largo.' };
    if (canal === 'email' && !asunto.trim()) return { ok: false, error: 'Pon un asunto al correo.' };
    const { supabase, usuario } = await contexto(subId);

    let { data: conv } = await supabase.from('conv_conversaciones').select('id').eq('subcuenta_id', subId).eq('contacto_id', contactoId).maybeSingle();
    if (!conv) {
      const ins = await supabase.from('conv_conversaciones').insert({ subcuenta_id: subId, contacto_id: contactoId }).select('id').single();
      if (ins.error && ins.error.code !== '23505') return { ok: false, error: mensajeDeError(ins.error) };
      conv = ins.data ?? (await supabase.from('conv_conversaciones').select('id').eq('subcuenta_id', subId).eq('contacto_id', contactoId).single()).data;
    }
    if (!conv) return { ok: false, error: 'No se pudo abrir la conversación.' };

    const m = await supabase.from('conv_mensajes').insert({
      subcuenta_id: subId, conversacion_id: conv.id, direccion: 'saliente', canal,
      asunto: canal === 'email' ? asunto.trim().slice(0, 300) : '', cuerpo: texto,
      estado: canal === 'nota' ? 'enviado' : 'pendiente', autor_id: usuario.id,
    }).select('id').single();
    if (m.error) return { ok: false, error: mensajeDeError(m.error) };

    const error = canal === 'nota' ? null : await enviarGuardado(subId, m.data.id as string);
    refrescar(subId);
    return error ? { ok: false, error, conversacionId: conv.id as string } : { ok: true, conversacionId: conv.id as string };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reintentarMensaje(subId: string, mensajeId: string): Promise<Resultado> {
  validar(mensajeId);
  const { supabase } = await contexto(subId);
  // Comprueba con los permisos de la persona que el mensaje es de su subcuenta.
  const { data } = await supabase.from('conv_mensajes').select('id, estado').eq('id', mensajeId).eq('subcuenta_id', subId).maybeSingle();
  if (!data) return { ok: false, error: 'El mensaje ya no existe.' };
  if (data.estado !== 'fallido') return { ok: true };
  const error = await enviarGuardado(subId, mensajeId);
  refrescar(subId);
  return error ? { ok: false, error } : { ok: true };
}

async function cambiarConversacion(subId: string, convId: string, cambios: Record<string, unknown>): Promise<Resultado> {
  validar(convId);
  const { supabase } = await contexto(subId);
  const { error } = await supabase.from('conv_conversaciones').update(cambios).eq('id', convId).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export const marcarLeida = async (subId: string, convId: string, leida: boolean) =>
  cambiarConversacion(subId, convId, { no_leidos: leida ? 0 : 1 });
export const destacar = async (subId: string, convId: string, destacada: boolean) =>
  cambiarConversacion(subId, convId, { destacada });
export const cerrarConversacion = async (subId: string, convId: string, cerrada: boolean) =>
  cambiarConversacion(subId, convId, { estado: cerrada ? 'cerrada' : 'abierta' });
export async function asignarConversacion(subId: string, convId: string, usuarioId: string | null) {
  validar(usuarioId);
  return cambiarConversacion(subId, convId, { asignado_id: usuarioId });
}

// Acciones sobre varias conversaciones marcadas en la lista.
export async function conversacionesLote(subId: string, ids: string[], accion: 'leidas' | 'no_leidas' | 'cerrar' | 'abrir'): Promise<Resultado> {
  if (!ids.length || ids.length > 500) return { ok: false, error: 'Selección no válida.' };
  validar(...ids);
  const cambios = { leidas: { no_leidos: 0 }, no_leidas: { no_leidos: 1 }, cerrar: { estado: 'cerrada' }, abrir: { estado: 'abierta' } }[accion];
  if (!cambios) return { ok: false, error: 'Acción no válida.' };
  const { supabase } = await contexto(subId);
  const { error } = await supabase.from('conv_conversaciones').update(cambios).in('id', ids).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function borrarConversacion(subId: string, convId: string): Promise<Resultado> {
  validar(convId);
  const { supabase } = await contexto(subId);
  const r = await supabase.from('conv_conversaciones').delete().eq('id', convId).eq('subcuenta_id', subId).select('id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede borrar conversaciones.' };
  refrescar(subId);
  return { ok: true };
}

// --- Fragmentos (respuestas guardadas) ------------------------------------------

export async function guardarFragmento(subId: string, fragId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  validar(fragId);
  const nombre = String(fd.get('nombre') ?? '').trim();
  const cuerpo = String(fd.get('cuerpo') ?? '').trim();
  if (!nombre || nombre.length > 120) return { ok: false, error: 'El nombre tiene que tener entre 1 y 120 caracteres.' };
  if (!cuerpo || cuerpo.length > 5000) return { ok: false, error: 'El texto tiene que tener entre 1 y 5000 caracteres.' };
  const { supabase } = await contexto(subId);
  const r = fragId
    ? await supabase.from('conv_fragmentos').update({ nombre, cuerpo }).eq('id', fragId).eq('subcuenta_id', subId)
    : await supabase.from('conv_fragmentos').insert({ subcuenta_id: subId, nombre, cuerpo });
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  refrescar(subId);
  return { ok: true, mensaje: 'Fragmento guardado.' };
}

export async function borrarFragmento(subId: string, fragId: string): Promise<Resultado> {
  validar(fragId);
  const { supabase } = await contexto(subId);
  const { error } = await supabase.from('conv_fragmentos').delete().eq('id', fragId).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}
