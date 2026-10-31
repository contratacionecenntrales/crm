import 'server-only';
import nodemailer from 'nodemailer';
import { resolverPublico } from '@/lib/red/seguro';

const TIEMPO = 15_000;

async function pedir(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(TIEMPO), cache: 'no-store' });
  let json: Record<string, unknown> = {};
  try {
    json = (await r.json()) as Record<string, unknown>;
  } catch {
    /* respuesta sin JSON */
  }
  return { ok: r.ok, status: r.status, json };
}

const basica = (u: string, c: string) => 'Basic ' + Buffer.from(`${u}:${c}`).toString('base64');

export interface Twilio { sid: string; token: string }

export async function enviarTwilio(t: Twilio, m: { desde: string; a: string; cuerpo: string; whatsapp: boolean; avisos?: string }): Promise<string> {
  const p = new URLSearchParams({
    From: m.whatsapp ? `whatsapp:${m.desde}` : m.desde,
    To: m.whatsapp ? `whatsapp:${m.a}` : m.a,
    Body: m.cuerpo,
  });
  if (m.avisos) p.set('StatusCallback', m.avisos);
  const r = await pedir(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(t.sid)}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: basica(t.sid, t.token), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p,
  });
  if (!r.ok) throw new Error(`Twilio: ${String(r.json.message ?? `error ${r.status}`)}${r.json.code ? ` (código ${r.json.code})` : ''}`);
  return String(r.json.sid);
}

export async function comprobarTwilio(t: Twilio): Promise<string> {
  const r = await pedir(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(t.sid)}.json`, {
    headers: { Authorization: basica(t.sid, t.token) },
  });
  if (!r.ok) throw new Error(r.status === 401 ? 'Twilio rechaza el SID o el token.' : `Twilio: ${String(r.json.message ?? r.status)}`);
  return `Conectado a la cuenta «${String(r.json.friendly_name ?? t.sid)}» (${String(r.json.status ?? 'activa')}).`;
}

export interface Mailgun { dominio: string; region: 'us' | 'eu'; clave: string }
const baseMailgun = (r: 'us' | 'eu') => (r === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net');

export interface Correo { de: string; a: string; asunto: string; texto: string; responderA?: string }

export async function enviarMailgun(g: Mailgun, c: Correo): Promise<string> {
  const f = new FormData();
  f.set('from', c.de);
  f.set('to', c.a);
  f.set('subject', c.asunto);
  f.set('text', c.texto);
  if (c.responderA) f.set('h:Reply-To', c.responderA);
  const r = await pedir(`${baseMailgun(g.region)}/v3/${encodeURIComponent(g.dominio)}/messages`, {
    method: 'POST', headers: { Authorization: basica('api', g.clave) }, body: f,
  });
  if (!r.ok) throw new Error(r.status === 401 ? 'Mailgun rechaza la clave de API.' : `Mailgun: ${String(r.json.message ?? `error ${r.status}`)}`);
  return String(r.json.id ?? '');
}

export async function comprobarMailgun(g: Mailgun): Promise<string> {
  const r = await pedir(`${baseMailgun(g.region)}/v3/domains/${encodeURIComponent(g.dominio)}`, { headers: { Authorization: basica('api', g.clave) } });
  if (!r.ok) throw new Error(r.status === 401 ? 'Mailgun rechaza la clave de API (¿región correcta?).' : `Mailgun: ${String(r.json.message ?? r.status)}`);
  const d = r.json.domain as { state?: string } | undefined;
  return `Dominio ${g.dominio} encontrado (${d?.state === 'active' ? 'verificado' : 'pendiente de verificar los DNS'}).`;
}

export interface Smtp { host: string; puerto: number; seguro: boolean; usuario: string; clave: string }

// Se conecta a la IP ya comprobada (no interna) y valida el certificado con el nombre original.
const transporte = async (s: Smtp) => nodemailer.createTransport({
  host: await resolverPublico(s.host), port: s.puerto, secure: s.seguro, tls: { servername: s.host },
  auth: s.usuario ? { user: s.usuario, pass: s.clave } : undefined,
  connectionTimeout: TIEMPO, greetingTimeout: TIEMPO, socketTimeout: TIEMPO,
});

export async function enviarSmtp(s: Smtp, c: Correo): Promise<string> {
  const info = await (await transporte(s)).sendMail({ from: c.de, to: c.a, subject: c.asunto, text: c.texto, replyTo: c.responderA });
  return String(info.messageId ?? '');
}

export async function comprobarSmtp(s: Smtp): Promise<string> {
  await (await transporte(s)).verify();
  return `Conectado a ${s.host}:${s.puerto}.`;
}
