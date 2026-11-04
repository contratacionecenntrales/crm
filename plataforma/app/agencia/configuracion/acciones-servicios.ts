'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { exigirAgencia } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { leerCorreo, leerTwilio } from '@/lib/conversaciones/formularios';
import { comprobarMailgun, comprobarSmtp, comprobarTwilio } from '@/lib/conversaciones/proveedores';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guardar(ajustes: Record<string, unknown>, secretos: Record<string, string | null>): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    const supabase = await crearClienteServidor();
    const a = await supabase.from('agencia_servicios').upsert({ agencia_id: actual.agencia.id, ...ajustes, actualizado: new Date().toISOString() }, { onConflict: 'agencia_id' });
    if (a.error) {
      if (a.error.code === '23514') return { ok: false, error: 'Revisa el formato de los datos (SID, correo, dominio).' };
      return { ok: false, error: mensajeDeError(a.error) };
    }
    const s = await supabase.rpc('agencia_guardar_secretos', { p_agencia: actual.agencia.id, p_datos: secretos });
    if (s.error) return { ok: false, error: mensajeDeError(s.error) };
    revalidatePath('/agencia/configuracion', 'layout');
    return { ok: true, mensaje: 'Guardado. Las subcuentas sin configuración propia ya usan estos datos.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function guardarTwilioAgencia(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const d = leerTwilio(fd, false);
  return d.ok ? guardar(d.ajustes, d.secretos) : d;
}

export async function guardarCorreoAgencia(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const d = leerCorreo(fd);
  return d.ok ? guardar(d.ajustes, d.secretos) : d;
}

// Prueba la conexión con lo guardado de la agencia (las claves solo las lee el servidor).
export async function comprobarCanalAgencia(que: 'twilio' | 'correo'): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    const admin = crearClienteAdmin();
    if (!admin) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.' };
    const [{ data: a }, { data: s }] = await Promise.all([
      admin.from('agencia_servicios').select('*').eq('agencia_id', actual.agencia.id).maybeSingle(),
      admin.from('agencia_secretos').select('twilio_token, mailgun_clave, smtp_clave').eq('agencia_id', actual.agencia.id).maybeSingle(),
    ]);
    if (!a) return { ok: false, error: 'Guarda antes los datos.' };
    if (que === 'twilio') {
      if (!a.twilio_sid || !s?.twilio_token) return { ok: false, error: 'Guarda antes el SID y el token.' };
      return { ok: true, mensaje: await comprobarTwilio({ sid: a.twilio_sid, token: s.twilio_token }) };
    }
    if (a.correo_proveedor === 'mailgun') {
      if (!a.mailgun_dominio || !s?.mailgun_clave) return { ok: false, error: 'Guarda antes el dominio y la clave de Mailgun.' };
      return { ok: true, mensaje: await comprobarMailgun({ dominio: a.mailgun_dominio, region: a.mailgun_region, clave: s.mailgun_clave }) };
    }
    if (a.correo_proveedor === 'smtp') {
      if (!a.smtp_host) return { ok: false, error: 'Guarda antes el servidor SMTP.' };
      return { ok: true, mensaje: await comprobarSmtp({ host: a.smtp_host, puerto: a.smtp_puerto, seguro: a.smtp_seguro, usuario: a.smtp_usuario, clave: s?.smtp_clave ?? '' }) };
    }
    return { ok: false, error: 'Elige y guarda un proveedor de correo.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cambiarVerificacionCorreo(subId: string, activar: boolean): Promise<Resultado> {
  try {
    await exigirAgencia({ admin: true });
    if (!UUID.test(subId)) return { ok: false, error: 'Subcuenta no válida.' };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('conv_ajustes')
      .upsert({ subcuenta_id: subId, verificar_correos: activar }, { onConflict: 'subcuenta_id' }).select('subcuenta_id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No tienes permiso sobre esa subcuenta.' };
    revalidatePath('/agencia/configuracion/correo');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function verificacionTodas(activar: boolean): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.rpc('agencia_verificacion_correos', { p_agencia: actual.agencia.id, p_activar: activar });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath('/agencia/configuracion/correo');
    return { ok: true, mensaje: `${activar ? 'Activada' : 'Desactivada'} en ${data} subcuentas.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
