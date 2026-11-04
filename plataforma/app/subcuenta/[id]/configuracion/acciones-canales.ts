'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { mensajeDeError } from '@/lib/errores';
import { credenciales } from '@/lib/conversaciones/envio';
import { comprobarMailgun, comprobarSmtp, comprobarTwilio } from '@/lib/conversaciones/proveedores';
import { leerCorreo, leerTwilio } from '@/lib/conversaciones/formularios';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin(subId: string) {
  if (!UUID.test(subId)) throw new Error('Identificador no válido.');
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('soy_admin_subcuenta', { p_subcuenta: subId });
  if (!data) throw new Error('Solo un administrador puede cambiar esto.');
  return supabase;
}

async function guardar(subId: string, ajustes: Record<string, unknown>, secretos: Record<string, string | null>): Promise<Resultado> {
  try {
    const supabase = await admin(subId);
    const a = await supabase.from('conv_ajustes').upsert({ subcuenta_id: subId, ...ajustes }, { onConflict: 'subcuenta_id' });
    if (a.error) {
      if (a.error.code === '23514') return { ok: false, error: 'Revisa el formato de los datos (SID, números con +prefijo, correo, dominio).' };
      return { ok: false, error: mensajeDeError(a.error) };
    }
    const s = await supabase.rpc('conv_guardar_secretos', { p_subcuenta: subId, p_datos: secretos });
    if (s.error) return { ok: false, error: mensajeDeError(s.error) };
    revalidatePath(`/subcuenta/${subId}`, 'layout');
    return { ok: true, mensaje: 'Guardado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function guardarTwilio(subId: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const d = leerTwilio(fd);
  return d.ok ? guardar(subId, d.ajustes, d.secretos) : d;
}

export async function guardarCorreo(subId: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const d = leerCorreo(fd);
  return d.ok ? guardar(subId, d.ajustes, d.secretos) : d;
}

// Prueba la conexión con las credenciales guardadas.
export async function comprobarCanal(subId: string, que: 'twilio' | 'correo'): Promise<Resultado> {
  try {
    await admin(subId);
    const { ajustes: a, secretos: s } = await credenciales(subId);
    if (que === 'twilio') {
      if (!a.twilio_sid || !s.twilio_token) return { ok: false, error: 'Guarda antes el SID y el token.' };
      return { ok: true, mensaje: await comprobarTwilio({ sid: a.twilio_sid, token: s.twilio_token }) };
    }
    if (a.correo_proveedor === 'mailgun') {
      if (!a.mailgun_dominio || !s.mailgun_clave) return { ok: false, error: 'Guarda antes el dominio y la clave de Mailgun.' };
      return { ok: true, mensaje: await comprobarMailgun({ dominio: a.mailgun_dominio, region: a.mailgun_region, clave: s.mailgun_clave }) };
    }
    if (a.correo_proveedor === 'smtp') {
      if (!a.smtp_host) return { ok: false, error: 'Guarda antes el servidor SMTP.' };
      return { ok: true, mensaje: await comprobarSmtp({ host: a.smtp_host, puerto: a.smtp_puerto, seguro: a.smtp_seguro, usuario: a.smtp_usuario, clave: s.smtp_clave }) };
    }
    return { ok: false, error: 'Elige y guarda un proveedor de correo.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
