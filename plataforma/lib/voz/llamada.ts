import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { siteUrl } from '@/lib/env';
import { adminObligatorio, credenciales } from '@/lib/conversaciones/envio';
import { firmaTwilioValida } from '@/lib/conversaciones/firmas';
import { ErrorIA, iaConfigurada, responderConversacion, type Turno } from '@/lib/ia/claude';

// Asistente de voz (script 32). Twilio llama a /api/voz/<subcuenta> al entrar
// una llamada y a /api/voz/<subcuenta>/turno cada vez que el cliente habla.
// Contestamos con TwiML: <Say> para hablar y <Gather input="speech"> para escuchar.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALL_SID = /^CA[0-9a-fA-F]{32}$/;
const VOZ = 'language="es-ES" voice="Polly.Lucia-Neural"';
const MAX_TURNOS = 40; // intervenciones (cliente + asistente) por llamada

export interface AsistenteVoz {
  id: string; nombre: string; instrucciones: string; conocimiento: string;
  traspaso_palabras: string[]; mensaje_traspaso: string; saludo: string; desvio: string;
}
interface Llamada { llamada: string; estado: string; turnos: { de: 'cliente' | 'asistente'; texto: string }[]; asistente: AsistenteVoz }

export const escapar = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
export const decir = (texto: string) => (texto.trim() ? `<Say ${VOZ}>${escapar(texto.trim())}</Say>` : '');
export const twiml = (cuerpo: string) =>
  new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${cuerpo}</Response>`, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } });

export function escuchar(subId: string, silencios = 0) {
  const accion = `${siteUrl()}/api/voz/${subId}/turno${silencios ? `?s=${silencios}` : ''}`;
  return `<Gather input="speech" language="es-ES" speechTimeout="auto" actionOnEmptyResult="true" method="POST" action="${escapar(accion)}"/>`;
}

const despedida = 'Gracias por llamar. ¡Hasta pronto!';
export const desviar = (numero: string) => `<Dial timeout="25">${escapar(numero)}</Dial>${decir('Ahora mismo no hay nadie disponible. Te devolveremos la llamada lo antes posible.')}<Hangup/>`;

// Lee el formulario de Twilio y comprueba su firma sobre la URL exacta.
export async function peticionTwilio(req: NextRequest, subId: string, ruta: string): Promise<{ datos: Record<string, string> } | NextResponse> {
  if (!UUID.test(subId)) return new NextResponse('No encontrado', { status: 404 });
  const form = await req.formData();
  const datos: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') datos[k] = v;
  let token = '';
  try { token = (await credenciales(subId)).secretos.twilio_token; } catch { return new NextResponse('Servidor sin configurar', { status: 503 }); }
  const url = `${siteUrl()}/api/voz/${subId}${ruta}${req.nextUrl.search}`;
  if (!token || !firmaTwilioValida(url, datos, req.headers.get('x-twilio-signature'), token)) return new NextResponse('Firma no válida', { status: 403 });
  if (!CALL_SID.test(datos.CallSid ?? '')) return new NextResponse('Llamada no válida', { status: 400 });
  return { datos };
}

export async function iniciar(subId: string, sid: string, de: string): Promise<Llamada | null> {
  const { data, error } = await adminObligatorio().rpc('voz_iniciar', { p_subcuenta: subId, p_call_sid: sid, p_de: de });
  if (error) throw new Error(error.message);
  return (data as Llamada | null) ?? null;
}

export const terminar = (sid: string, estado: 'terminada' | 'desviada' | 'sin_respuesta', motivo = '') =>
  adminObligatorio().rpc('voz_terminar', { p_call_sid: sid, p_estado: estado, p_motivo: motivo.slice(0, 500) });

const anadir = (llamada: string, de: 'cliente' | 'asistente', texto: string) =>
  adminObligatorio().rpc('voz_anadir', { p_llamada: llamada, p_de: de, p_texto: texto });

// Primera respuesta al entrar la llamada.
export async function contestarLlamada(subId: string, datos: Record<string, string>) {
  const sid = datos.CallSid;
  if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(datos.CallStatus ?? '')) {
    // Aviso de fin de llamada (si se configura como «status callback»).
    await terminar(sid, 'terminada');
    return twiml('');
  }
  const l = await iniciar(subId, sid, datos.From ?? '');
  if (!l || !iaConfigurada()) return twiml(`${decir('Gracias por llamar. Ahora mismo no podemos atenderte. Por favor, inténtalo más tarde.')}<Hangup/>`);
  if (l.estado !== 'en_curso') return twiml('<Hangup/>');
  const { data: sub } = await adminObligatorio().from('subcuentas').select('nombre').eq('id', subId).single();
  const saludo = l.asistente.saludo.trim() || `Hola, has llamado a ${sub?.nombre ?? 'nosotros'}. Soy ${l.asistente.nombre}, el asistente virtual. ¿En qué puedo ayudarte?`;
  if (!l.turnos.length) await anadir(l.llamada, 'asistente', saludo);
  return twiml(`${decir(saludo)}${escuchar(subId)}${decir('¿Sigues ahí? Si necesitas algo, vuelve a llamarnos cuando quieras.')}<Hangup/>`);
}

// Cada vez que el cliente habla (o se queda callado).
export async function contestarTurno(subId: string, datos: Record<string, string>, silencios: number) {
  const sid = datos.CallSid;
  const l = await iniciar(subId, sid, datos.From ?? '');
  if (!l || l.estado !== 'en_curso') return twiml('<Hangup/>');
  const a = l.asistente;
  const dicho = (datos.SpeechResult ?? '').trim().slice(0, 1000);

  if (!dicho) {
    if (silencios >= 1) {
      await terminar(sid, l.turnos.some((t) => t.de === 'cliente') ? 'terminada' : 'sin_respuesta');
      return twiml(`${decir('No te escucho bien. Gracias por llamar, ¡hasta pronto!')}<Hangup/>`);
    }
    return twiml(`${decir('Perdona, no te he oído. ¿Puedes repetirlo?')}${escuchar(subId, silencios + 1)}`);
  }
  await anadir(l.llamada, 'cliente', dicho);

  const pasarAPersona = async (motivo: string, frase: string) => {
    if (a.desvio) {
      await anadir(l.llamada, 'asistente', frase || 'Te paso con una persona del equipo.');
      await terminar(sid, 'desviada', motivo);
      return twiml(`${decir(frase || 'Te paso con una persona del equipo, un momento por favor.')}${desviar(a.desvio)}`);
    }
    const fin = `${frase ? `${frase} ` : ''}${a.mensaje_traspaso.trim() || 'Una persona del equipo te devolverá la llamada lo antes posible.'} ${despedida}`;
    await anadir(l.llamada, 'asistente', fin);
    await terminar(sid, 'terminada', motivo);
    return twiml(`${decir(fin)}<Hangup/>`);
  };

  const palabra = a.traspaso_palabras.find((p) => p && dicho.toLowerCase().includes(p));
  if (palabra) return pasarAPersona(`El cliente dijo «${palabra}».`, '');
  if (l.turnos.length + 1 >= MAX_TURNOS) return pasarAPersona('La llamada se alargó demasiado para el asistente.', 'Para no hacerte esperar más,');

  const admin = adminObligatorio();
  const { data: cupo } = await admin.rpc('ia_reservar_uso', { p_subcuenta: subId });
  if (!cupo) return pasarAPersona('Sin cupo de IA hoy (límite diario o plan).', '');

  const [{ data: sub }, { data: contacto }] = await Promise.all([
    admin.from('subcuentas').select('nombre, zona_horaria').eq('id', subId).single(),
    admin.from('voz_llamadas').select('contacto:crm_contactos(nombre, apellidos)').eq('id', l.llamada).single(),
  ]);
  const c = (contacto?.contacto ?? null) as unknown as { nombre: string; apellidos: string } | null;
  const historial: Turno[] = [...l.turnos, { de: 'cliente' as const, texto: dicho }].map((t) => ({ de: t.de === 'cliente' ? 'cliente' : 'negocio', texto: t.texto }));
  try {
    // Twilio espera unos 15 s: si la IA tarda más, mejor pasar a una persona.
    const r = await responderConversacion({
      asistente: a, empresa: String(sub?.nombre ?? ''), canal: 'voz', contacto: c ? `${c.nombre} ${c.apellidos}`.trim() : '',
      zona: String(sub?.zona_horaria ?? ''), historial, ms: 11_000,
    });
    await admin.rpc('ia_sumar_tokens', { p_subcuenta: subId, p_entrada: r.uso.entrada, p_salida: r.uso.salida });
    if (r.pasarAHumano) return pasarAPersona(r.motivo || 'El asistente necesita ayuda.', r.respuesta);
    await anadir(l.llamada, 'asistente', r.respuesta);
    return twiml(`${decir(r.respuesta)}${escuchar(subId)}${decir('¿Sigues ahí? Gracias por llamar.')}<Hangup/>`);
  } catch (e) {
    const motivo = e instanceof ErrorIA ? e.message : 'Error al generar la respuesta.';
    return pasarAPersona(`El asistente no pudo contestar: ${motivo}`, 'Perdona, estoy teniendo un problema técnico.');
  }
}
