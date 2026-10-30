import { createHmac, timingSafeEqual } from 'node:crypto';

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Firma de Twilio (X-Twilio-Signature): HMAC-SHA1 de la URL completa seguida de
// cada parámetro POST (nombre + valor) en orden alfabético, en base64.
export function firmaTwilio(url: string, params: Record<string, string>, token: string): string {
  const datos = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHmac('sha1', token).update(datos, 'utf8').digest('base64');
}

export function firmaTwilioValida(url: string, params: Record<string, string>, firma: string | null, token: string): boolean {
  if (!firma || !token) return false;
  return iguales(firmaTwilio(url, params, token), firma);
}

// Firma de Mailgun: HMAC-SHA256(clave de firma, timestamp + token) en hex.
// Se rechazan las firmas de más de 15 minutos para evitar reenvíos.
export function firmaMailgunValida(clave: string, timestamp: string, token: string, firma: string, ahora = Date.now()): boolean {
  if (!clave || !timestamp || !token || !firma) return false;
  const t = Number(timestamp);
  if (!Number.isFinite(t) || Math.abs(ahora / 1000 - t) > 15 * 60) return false;
  const esperada = createHmac('sha256', clave).update(timestamp + token).digest('hex');
  return iguales(esperada, firma);
}

// "Eva Ruiz <eva@mail.com>" → { nombre: "Eva Ruiz", email: "eva@mail.com" }
export function separarRemitente(cabecera: string): { nombre: string; email: string } {
  const m = cabecera.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { nombre: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { nombre: '', email: cabecera.trim().toLowerCase() };
}

// Estado de Twilio → estado del mensaje.
export function estadoTwilio(s: string): 'enviado' | 'entregado' | 'leido' | 'fallido' | null {
  switch (s) {
    case 'queued': case 'accepted': case 'sending': case 'sent': return 'enviado';
    case 'delivered': return 'entregado';
    case 'read': return 'leido';
    case 'failed': case 'undelivered': case 'canceled': return 'fallido';
    default: return null;
  }
}
