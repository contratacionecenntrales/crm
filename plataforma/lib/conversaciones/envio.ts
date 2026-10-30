import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/env';
import { enviarMailgun, enviarSmtp, enviarTwilio } from './proveedores';
import { AJUSTES_VACIOS, type Ajustes } from './tipos';
export { AJUSTES_VACIOS, type Ajustes };

interface Secretos { twilio_token: string; mailgun_clave: string; mailgun_firma: string; smtp_clave: string }

export function adminObligatorio() {
  const admin = crearClienteAdmin();
  if (!admin) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor: sin ella no se pueden enviar mensajes.');
  return admin;
}

export async function credenciales(subId: string): Promise<{ ajustes: Ajustes; secretos: Secretos }> {
  const admin = adminObligatorio();
  const [a, s] = await Promise.all([
    admin.from('conv_ajustes').select('*').eq('subcuenta_id', subId).maybeSingle(),
    admin.from('conv_secretos').select('twilio_token, mailgun_clave, mailgun_firma, smtp_clave').eq('subcuenta_id', subId).maybeSingle(),
  ]);
  return {
    ajustes: { ...AJUSTES_VACIOS, ...((a.data ?? {}) as Partial<Ajustes>) },
    secretos: { twilio_token: '', mailgun_clave: '', mailgun_firma: '', smtp_clave: '', ...((s.data ?? {}) as Partial<Secretos>) },
  };
}

// Envía un mensaje saliente ya guardado como «pendiente» (o «fallido», al
// reintentar) y deja anotado el resultado. Devuelve el error, si lo hay.
export async function enviarGuardado(subId: string, mensajeId: string): Promise<string | null> {
  const admin = adminObligatorio();
  const { data: m } = await admin.from('conv_mensajes')
    .select('id, canal, asunto, cuerpo, estado, direccion, conversacion:conv_conversaciones(contacto:crm_contactos(nombre, apellidos, email, telefono, dnd, dnd_canales))')
    .eq('id', mensajeId).eq('subcuenta_id', subId).maybeSingle();
  if (!m) return 'El mensaje ya no existe.';
  if (m.direccion !== 'saliente' || m.canal === 'nota' || !['pendiente', 'fallido'].includes(m.estado as string)) return null;

  const contacto = (m.conversacion as unknown as { contacto: { nombre: string; apellidos: string; email: string | null; telefono: string; dnd: boolean; dnd_canales: string[] } }).contacto;
  const anotar = (cambios: Record<string, unknown>) => admin.from('conv_mensajes').update(cambios).eq('id', mensajeId);
  const fallar = async (error: string) => {
    await anotar({ estado: 'fallido', error: error.slice(0, 1000) });
    return error;
  };

  const canalDnd = m.canal === 'email' ? 'email' : m.canal === 'whatsapp' ? 'whatsapp' : 'sms';
  if (contacto.dnd || contacto.dnd_canales.includes(canalDnd)) return fallar('El contacto tiene activado «No molestar» para este canal.');

  let ajustes: Ajustes;
  let secretos: Secretos;
  try {
    ({ ajustes, secretos } = await credenciales(subId));
  } catch (e) {
    return fallar((e as Error).message);
  }

  try {
    let id = '';
    if (m.canal === 'sms' || m.canal === 'whatsapp') {
      const desde = m.canal === 'sms' ? ajustes.twilio_numero_sms : ajustes.twilio_numero_wa || ajustes.twilio_numero_sms;
      if (!ajustes.twilio_sid || !secretos.twilio_token || !desde) {
        return fallar('Twilio no está configurado. Ve a Configuración → Integración telefónica.');
      }
      if (!/^\+[0-9]{6,15}$/.test(contacto.telefono)) return fallar('El contacto no tiene un teléfono válido con prefijo (+34…).');
      id = await enviarTwilio({ sid: ajustes.twilio_sid, token: secretos.twilio_token }, {
        desde, a: contacto.telefono, cuerpo: m.cuerpo as string, whatsapp: m.canal === 'whatsapp',
        avisos: siteUrl().startsWith('https://') ? `${siteUrl()}/api/webhooks/twilio/${subId}` : undefined,
      });
    } else {
      if (!contacto.email) return fallar('El contacto no tiene correo electrónico.');
      if (!ajustes.correo_proveedor || !ajustes.correo_remitente) {
        return fallar('El correo no está configurado. Ve a Configuración → Servicios de correo.');
      }
      const de = ajustes.correo_nombre ? `"${ajustes.correo_nombre.replace(/"/g, '')}" <${ajustes.correo_remitente}>` : ajustes.correo_remitente;
      const nombre = `${contacto.nombre} ${contacto.apellidos}`.trim().replace(/[<>"]/g, '');
      const correo = { de, a: nombre ? `"${nombre}" <${contacto.email}>` : contacto.email, asunto: (m.asunto as string) || '(sin asunto)', texto: m.cuerpo as string };
      if (ajustes.correo_proveedor === 'mailgun') {
        if (!ajustes.mailgun_dominio || !secretos.mailgun_clave) return fallar('Falta el dominio o la clave de Mailgun.');
        id = await enviarMailgun({ dominio: ajustes.mailgun_dominio, region: ajustes.mailgun_region, clave: secretos.mailgun_clave }, correo);
      } else {
        if (!ajustes.smtp_host) return fallar('Falta el servidor SMTP.');
        id = await enviarSmtp({ host: ajustes.smtp_host, puerto: ajustes.smtp_puerto, seguro: ajustes.smtp_seguro, usuario: ajustes.smtp_usuario, clave: secretos.smtp_clave }, correo);
      }
    }
    // Mailgun devuelve el Message-Id entre <>; se guarda tal cual para casar respuestas.
    await anotar({ estado: 'enviado', error: '', proveedor_id: id || null });
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fallar(msg.includes('timeout') || msg.includes('aborted') ? 'El proveedor no respondió a tiempo.' : msg);
  }
}
