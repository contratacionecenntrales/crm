'use server';
import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { CLAVE_CHAT, type MensajeChat } from '@/lib/chat/tipos';

type R<T> = { ok: true; datos: T } | { ok: false; error: string; caducado?: boolean };

// Los errores de las funciones del chat ya vienen redactados para el visitante.
function error(e: { message?: string; code?: string } | null): { ok: false; error: string; caducado?: boolean } {
  const conocido = e && ['23514', 'P0002', '42501'].includes(e.code ?? '');
  return { ok: false, error: conocido ? e!.message! : 'No se pudo conectar con el chat. Inténtalo de nuevo.', caducado: e?.code === 'P0002' };
}

const token = (t: unknown) => (typeof t === 'string' && /^[0-9a-f]{64}$/.test(t) ? t : '');

export async function iniciarChat(clave: string, datos: { nombre: string; email: string; telefono: string; origen: string }): Promise<R<{ token: string; nombre: string }>> {
  try {
    if (!CLAVE_CHAT.test(clave)) return { ok: false, error: 'Este chat no está disponible.' };
    const { data, error: e } = await crearClienteAnonimo().rpc('chat_iniciar', {
      p_clave: clave, p_nombre: String(datos.nombre ?? '').slice(0, 100), p_email: String(datos.email ?? '').slice(0, 200),
      p_telefono: String(datos.telefono ?? '').slice(0, 30), p_origen: String(datos.origen ?? '').slice(0, 200),
    });
    if (e) return error(e);
    return { ok: true, datos: data as { token: string; nombre: string } };
  } catch {
    return error(null);
  }
}

export async function enviarChat(clave: string, t: string, texto: string): Promise<R<MensajeChat>> {
  try {
    if (!CLAVE_CHAT.test(clave) || !token(t)) return { ok: false, error: 'La conversación ha caducado. Vuelve a empezar.', caducado: true };
    const { data, error: e } = await crearClienteAnonimo().rpc('chat_enviar', { p_clave: clave, p_token: t, p_texto: String(texto ?? '').slice(0, 2000) });
    if (e) return error(e);
    return { ok: true, datos: data as MensajeChat };
  } catch {
    return error(null);
  }
}

export async function leerChat(clave: string, t: string, desde: string | null): Promise<R<MensajeChat[]>> {
  try {
    if (!CLAVE_CHAT.test(clave) || !token(t)) return { ok: false, error: 'La conversación ha caducado. Vuelve a empezar.', caducado: true };
    const valido = desde && !Number.isNaN(Date.parse(desde)) ? desde : null;
    const { data, error: e } = await crearClienteAnonimo().rpc('chat_mensajes', { p_clave: clave, p_token: t, p_desde: valido });
    if (e) return error(e);
    return { ok: true, datos: (data ?? []) as MensajeChat[] };
  } catch {
    return error(null);
  }
}
