// Lectura y validación de los formularios de Twilio y correo (subcuenta y agencia).
type R<T> = { ok: true; ajustes: T; secretos: Record<string, string | null> } | { ok: false; error: string };
const leer = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const telefono = (v: string) => v.replace(/[^\d+]/g, '');

export function leerTwilio(fd: FormData, conNumeros = true): R<Record<string, string>> {
  const sid = leer(fd, 'twilio_sid');
  if (sid && !/^AC[0-9a-fA-F]{32}$/.test(sid)) return { ok: false, error: 'El Account SID empieza por «AC» y tiene 34 caracteres.' };
  const ajustes: Record<string, string> = { twilio_sid: sid };
  if (conNumeros) {
    const sms = telefono(leer(fd, 'twilio_numero_sms'));
    const wa = telefono(leer(fd, 'twilio_numero_wa'));
    for (const n of [sms, wa]) if (n && !/^\+[0-9]{6,15}$/.test(n)) return { ok: false, error: `El número ${n} tiene que ir con prefijo internacional (+34…).` };
    ajustes.twilio_numero_sms = sms;
    ajustes.twilio_numero_wa = wa;
  }
  return { ok: true, ajustes, secretos: fd.get('borrar_token') === 'on' ? { twilio_token: null } : { twilio_token: leer(fd, 'twilio_token') } };
}

export function leerCorreo(fd: FormData): R<Record<string, string | number | boolean>> {
  const proveedor = leer(fd, 'correo_proveedor');
  if (!['', 'mailgun', 'smtp'].includes(proveedor)) return { ok: false, error: 'Proveedor no válido.' };
  const remitente = leer(fd, 'correo_remitente').toLowerCase();
  if (proveedor && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(remitente)) return { ok: false, error: 'Escribe la dirección de correo remitente.' };
  const puerto = Number(leer(fd, 'smtp_puerto') || 587);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) return { ok: false, error: 'Puerto SMTP no válido.' };
  return {
    ok: true,
    ajustes: {
      correo_proveedor: proveedor, correo_remitente: remitente, correo_nombre: leer(fd, 'correo_nombre').slice(0, 120),
      mailgun_dominio: leer(fd, 'mailgun_dominio').toLowerCase(), mailgun_region: leer(fd, 'mailgun_region') === 'us' ? 'us' : 'eu',
      smtp_host: leer(fd, 'smtp_host'), smtp_puerto: puerto, smtp_seguro: fd.get('smtp_seguro') === 'on', smtp_usuario: leer(fd, 'smtp_usuario'),
    },
    secretos: { mailgun_clave: leer(fd, 'mailgun_clave'), mailgun_firma: leer(fd, 'mailgun_firma'), smtp_clave: leer(fd, 'smtp_clave') },
  };
}
