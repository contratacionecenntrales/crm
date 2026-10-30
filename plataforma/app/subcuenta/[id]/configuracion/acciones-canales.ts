'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { mensajeDeError } from '@/lib/errores';
import { credenciales } from '@/lib/conversaciones/envio';
import { comprobarMailgun, comprobarSmtp, comprobarTwilio } from '@/lib/conversaciones/proveedores';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const leer = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const telefono = (v: string) => v.replace(/[^\d+]/g, '');

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
  const sid = leer(fd, 'twilio_sid');
  if (sid && !/^AC[0-9a-fA-F]{32}$/.test(sid)) return { ok: false, error: 'El Account SID empieza por «AC» y tiene 34 caracteres.' };
  const sms = telefono(leer(fd, 'twilio_numero_sms'));
  const wa = telefono(leer(fd, 'twilio_numero_wa'));
  for (const n of [sms, wa]) if (n && !/^\+[0-9]{6,15}$/.test(n)) return { ok: false, error: `El número ${n} tiene que ir con prefijo internacional (+34…).` };
  return guardar(subId, { twilio_sid: sid, twilio_numero_sms: sms, twilio_numero_wa: wa },
    fd.get('borrar_token') === 'on' ? { twilio_token: null } : { twilio_token: leer(fd, 'twilio_token') });
}

export async function guardarCorreo(subId: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const proveedor = leer(fd, 'correo_proveedor');
  if (!['', 'mailgun', 'smtp'].includes(proveedor)) return { ok: false, error: 'Proveedor no válido.' };
  const remitente = leer(fd, 'correo_remitente').toLowerCase();
  if (proveedor && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(remitente)) return { ok: false, error: 'Escribe la dirección de correo remitente.' };
  const puerto = Number(leer(fd, 'smtp_puerto') || 587);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) return { ok: false, error: 'Puerto SMTP no válido.' };
  const region = leer(fd, 'mailgun_region') === 'us' ? 'us' : 'eu';
  return guardar(subId, {
    correo_proveedor: proveedor, correo_remitente: remitente, correo_nombre: leer(fd, 'correo_nombre').slice(0, 120),
    mailgun_dominio: leer(fd, 'mailgun_dominio').toLowerCase(), mailgun_region: region,
    smtp_host: leer(fd, 'smtp_host'), smtp_puerto: puerto, smtp_seguro: fd.get('smtp_seguro') === 'on', smtp_usuario: leer(fd, 'smtp_usuario'),
  }, { mailgun_clave: leer(fd, 'mailgun_clave'), mailgun_firma: leer(fd, 'mailgun_firma'), smtp_clave: leer(fd, 'smtp_clave') });
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
