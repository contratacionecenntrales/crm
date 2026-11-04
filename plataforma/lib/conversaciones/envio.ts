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

const CAMPOS_CORREO = ['correo_proveedor', 'correo_remitente', 'correo_nombre', 'mailgun_dominio', 'mailgun_region', 'smtp_host', 'smtp_puerto', 'smtp_seguro', 'smtp_usuario'] as const;

// Credenciales de la subcuenta; lo que no tenga propio lo toma de la agencia
// (correo por defecto y cuenta de Twilio de la agencia).
export async function credenciales(subId: string): Promise<{ ajustes: Ajustes; secretos: Secretos; origen: { correo: '' | 'subcuenta' | 'agencia'; twilio: '' | 'subcuenta' | 'agencia' } }> {
  const admin = adminObligatorio();
  const [a, s, sub] = await Promise.all([
    admin.from('conv_ajustes').select('*').eq('subcuenta_id', subId).maybeSingle(),
    admin.from('conv_secretos').select('twilio_token, mailgun_clave, mailgun_firma, smtp_clave').eq('subcuenta_id', subId).maybeSingle(),
    admin.from('subcuentas').select('agencia_id').eq('id', subId).maybeSingle(),
  ]);
  const ajustes: Ajustes = { ...AJUSTES_VACIOS, ...((a.data ?? {}) as Partial<Ajustes>) };
  const secretos: Secretos = { twilio_token: '', mailgun_clave: '', mailgun_firma: '', smtp_clave: '', ...((s.data ?? {}) as Partial<Secretos>) };
  type Origen = '' | 'subcuenta' | 'agencia';
  const origen: { correo: Origen; twilio: Origen } = { correo: ajustes.correo_proveedor ? 'subcuenta' : '', twilio: ajustes.twilio_sid ? 'subcuenta' : '' };
  if ((!ajustes.correo_proveedor || !ajustes.twilio_sid) && sub.data?.agencia_id) {
    const [ag, agk] = await Promise.all([
      admin.from('agencia_servicios').select('*').eq('agencia_id', sub.data.agencia_id).maybeSingle(),
      admin.from('agencia_secretos').select('twilio_token, mailgun_clave, mailgun_firma, smtp_clave').eq('agencia_id', sub.data.agencia_id).maybeSingle(),
    ]);
    const g = (ag.data ?? null) as (Partial<Ajustes> & { twilio_sid?: string }) | null;
    const gk = (agk.data ?? {}) as Partial<Secretos>;
    if (g && !ajustes.correo_proveedor && g.correo_proveedor) {
      for (const k of CAMPOS_CORREO) (ajustes as unknown as Record<string, unknown>)[k] = g[k];
      secretos.mailgun_clave = gk.mailgun_clave ?? '';
      secretos.mailgun_firma = gk.mailgun_firma ?? '';
      secretos.smtp_clave = gk.smtp_clave ?? '';
      origen.correo = 'agencia';
    }
    if (g && !ajustes.twilio_sid && g.twilio_sid) {
      ajustes.twilio_sid = g.twilio_sid;
      secretos.twilio_token = gk.twilio_token ?? '';
      origen.twilio = 'agencia';
    }
  }
  return { ajustes, secretos, origen };
}

// ¿El dominio del destinatario recibe correo? (registros MX; si no hay, el
// registro A también vale según el estándar). Solo se bloquea si no existe.
const cacheMx = new Map<string, { ok: boolean; hasta: number }>();
export async function dominioRecibeCorreo(email: string): Promise<boolean> {
  const dominio = email.split('@')[1]?.toLowerCase() ?? '';
  if (!dominio) return false;
  const c = cacheMx.get(dominio);
  if (c && c.hasta > Date.now()) return c.ok;
  const { resolveMx, resolve4 } = await import('node:dns/promises');
  const conTiempo = <T,>(p: Promise<T>) => Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('timeout')), 4000))]);
  let ok = true;
  try {
    const mx = await conTiempo(resolveMx(dominio));
    ok = mx.some((m) => m.exchange && m.exchange !== '.');
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo === 'ENOTFOUND' || codigo === 'ENODATA') {
      try { ok = (await conTiempo(resolve4(dominio))).length > 0; } catch { ok = false; }
      // Si tampoco resuelve un dominio que seguro existe, el fallo es del DNS del servidor: no se bloquea.
      if (!ok) {
        try { await conTiempo(resolveMx('gmail.com')); } catch { ok = true; }
      }
    } // otros errores (sin red, tiempo agotado): no se bloquea el envío
  }
  cacheMx.set(dominio, { ok, hasta: Date.now() + 3600_000 });
  return ok;
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
  // Reserva atómica: si dos personas (o un doble clic) intentan enviarlo a la
  // vez, solo uno lo envía. «error = enviando» marca el que está en curso.
  const { data: tomado, error: eReclamo } = await admin.rpc('conv_reclamar_envio', { p_mensaje: mensajeId, p_subcuenta: subId });
  if (eReclamo) return `No se pudo preparar el envío: ${eReclamo.message}`;
  if (!tomado) return null; // otro proceso ya lo está enviando

  // Chat web: no hay proveedor; el visitante lo recoge desde el globo.
  if (m.canal === 'chat') {
    await admin.from('conv_mensajes').update({ estado: 'enviado', error: '' }).eq('id', mensajeId).eq('estado', 'pendiente');
    return null;
  }

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
        return fallar('Twilio no está configurado. Ve a Configuración → Integración telefónica (o conecta la cuenta de Twilio de la agencia y pon aquí los números).');
      }
      if (!/^\+[0-9]{6,15}$/.test(contacto.telefono)) return fallar('El contacto no tiene un teléfono válido con prefijo (+34…).');
      id = await enviarTwilio({ sid: ajustes.twilio_sid, token: secretos.twilio_token }, {
        desde, a: contacto.telefono, cuerpo: m.cuerpo as string, whatsapp: m.canal === 'whatsapp',
        avisos: siteUrl().startsWith('https://') ? `${siteUrl()}/api/webhooks/twilio/${subId}` : undefined,
      });
    } else {
      if (!contacto.email) return fallar('El contacto no tiene correo electrónico.');
      if (ajustes.verificar_correos && !(await dominioRecibeCorreo(contacto.email))) {
        return fallar(`El dominio de ${contacto.email} no existe o no recibe correo (verificación de correos activada).`);
      }
      if (!ajustes.correo_proveedor || !ajustes.correo_remitente) {
        return fallar('El correo no está configurado ni en la subcuenta ni en la agencia. Ve a Configuración → Servicios de correo.');
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
    if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return fallar(`No se encontró el servidor del proveedor (${msg.split(' ').pop()}). Revisa el nombre del servidor en Servicios de correo.`);
    if (/ECONNREFUSED/.test(msg)) return fallar('El servidor del proveedor rechazó la conexión. Revisa el servidor y el puerto.');
    return fallar(msg.includes('timeout') || msg.includes('aborted') ? 'El proveedor no respondió a tiempo.' : msg);
  }
}
