import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminObligatorio, enviarGuardado } from '@/lib/conversaciones/envio';
import { ErrorIA, iaConfigurada, responderConversacion, type Canal, type Turno } from './claude';

// Contesta los mensajes de la cola de los asistentes (ver script 24).
interface Cola { id: string; subcuenta_id: string; conversacion_id: string; mensaje_id: string; asistente_id: string; intentos: number }
interface Asistente { id: string; nombre: string; instrucciones: string; conocimiento: string; traspaso_palabras: string[]; mensaje_traspaso: string }

export async function procesarColaIA(limite = 10, hasta = Date.now() + 45_000) {
  const admin = adminObligatorio();
  const resumen = { tomadas: 0, respondidas: 0, traspasos: 0, omitidas: 0, errores: 0 };
  const { data, error } = await admin.rpc('ia_tomar', { p_limite: limite });
  if (error) throw new Error(error.message);
  const fin = hasta;
  for (const q of (data ?? []) as Cola[]) {
    if (Date.now() > fin) { await marcar(admin, q.id, 'pendiente', ''); continue; }
    resumen.tomadas++;
    try {
      const r = await contestar(admin, q);
      resumen[r]++;
    } catch (e) {
      const err = e instanceof ErrorIA ? e : new ErrorIA((e as Error).message || 'Error', false);
      resumen.errores++;
      // Reintentable y con intentos libres: vuelve a la cola.
      await marcar(admin, q.id, err.reintentable && q.intentos < 3 ? 'pendiente' : 'error', err.message);
    }
  }
  return resumen;
}

const marcar = (admin: SupabaseClient, id: string, estado: string, detalle: string) =>
  admin.from('ia_cola').update({ estado, detalle: detalle.slice(0, 1000), ...(estado === 'pendiente' ? { tomado_en: null } : {}) }).eq('id', id);

async function contestar(admin: SupabaseClient, q: Cola): Promise<'respondidas' | 'traspasos' | 'omitidas'> {
  if (!iaConfigurada()) { await marcar(admin, q.id, 'omitido', 'La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).'); return 'omitidas'; }
  const { data: motivo, error: eRes } = await admin.rpc('ia_reservar', { p_cola: q.id });
  if (eRes) throw new Error(eRes.message);
  if (motivo) { await marcar(admin, q.id, 'omitido', motivo as string); return 'omitidas'; }

  const [{ data: a }, { data: entrante }, { data: conv }, { data: sub }] = await Promise.all([
    admin.from('ia_asistentes').select('id, nombre, instrucciones, conocimiento, traspaso_palabras, mensaje_traspaso').eq('id', q.asistente_id).single(),
    admin.from('conv_mensajes').select('canal, asunto, cuerpo, chat_visitante_id').eq('id', q.mensaje_id).single(),
    admin.from('conv_conversaciones').select('asignado_id, contacto:crm_contactos(nombre, apellidos, propietario_id)').eq('id', q.conversacion_id).single(),
    admin.from('subcuentas').select('nombre, zona_horaria, agencia_id').eq('id', q.subcuenta_id).single(),
  ]);
  if (!a || !entrante || !conv || !sub) { await marcar(admin, q.id, 'omitido', 'Faltan datos de la conversación.'); return 'omitidas'; }
  const asistente = a as Asistente;
  const canal = entrante.canal as Canal;
  const contacto = conv.contacto as unknown as { nombre: string; apellidos: string; propietario_id: string | null };

  // Palabras de traspaso: pasan directamente a una persona, sin usar la IA.
  const texto = String(entrante.cuerpo).toLowerCase();
  const palabra = asistente.traspaso_palabras.find((p) => p && texto.includes(p));
  if (palabra) {
    await traspasar(admin, q, asistente, canal, String(entrante.asunto), `El cliente escribió «${palabra}».`, conv.asignado_id ?? contacto.propietario_id, sub);
    await marcar(admin, q.id, 'hecho', `Traspaso por la palabra «${palabra}».`);
    return 'traspasos';
  }

  // En el chat web solo cuenta lo hablado con este visitante (no el historial de otros canales).
  let consulta = admin.from('conv_mensajes').select('direccion, canal, cuerpo, creado')
    .eq('conversacion_id', q.conversacion_id).neq('canal', 'nota');
  if (canal === 'chat') consulta = consulta.eq('canal', 'chat').eq('chat_visitante_id', entrante.chat_visitante_id as string);
  const { data: hist } = await consulta.order('creado', { ascending: false }).limit(30);
  const historial: Turno[] = (hist ?? []).reverse().map((m) => ({ de: m.direccion === 'entrante' ? 'cliente' : 'negocio', texto: String(m.cuerpo) }));
  const r = await responderConversacion({
    asistente, empresa: String(sub.nombre), canal, contacto: `${contacto.nombre} ${contacto.apellidos}`.trim(), zona: String(sub.zona_horaria || ''), historial,
  });
  await admin.rpc('ia_sumar_tokens', { p_subcuenta: q.subcuenta_id, p_entrada: r.uso.entrada, p_salida: r.uso.salida });

  if (r.respuesta) {
    const fallo = await enviar(admin, q, canal, String(entrante.asunto), r.respuesta);
    if (fallo) throw new ErrorIA(`No se pudo enviar la respuesta: ${fallo}`, false);
  }
  if (r.pasarAHumano) {
    await traspasar(admin, q, asistente, canal, String(entrante.asunto), r.motivo || 'El asistente necesita ayuda.', conv.asignado_id ?? contacto.propietario_id, sub, Boolean(r.respuesta));
    await marcar(admin, q.id, 'hecho', `Traspaso: ${r.motivo}`);
    return 'traspasos';
  }
  await marcar(admin, q.id, 'hecho', '');
  return 'respondidas';
}

async function enviar(admin: SupabaseClient, q: Cola, canal: Canal, asuntoEntrante: string, cuerpo: string): Promise<string | null> {
  const asunto = canal === 'email' ? (asuntoEntrante ? (/^re:/i.test(asuntoEntrante) ? asuntoEntrante : `Re: ${asuntoEntrante}`) : 'Re: tu mensaje').slice(0, 300) : '';
  const m = await admin.from('conv_mensajes').insert({
    subcuenta_id: q.subcuenta_id, conversacion_id: q.conversacion_id, direccion: 'saliente', canal, asunto, cuerpo, estado: 'pendiente', ia: true,
  }).select('id').single();
  if (m.error) return m.error.message;
  return enviarGuardado(q.subcuenta_id, m.data.id as string);
}

// Pausa el asistente en la conversación, deja una nota y avisa a quien la lleva.
async function traspasar(admin: SupabaseClient, q: Cola, a: Asistente, canal: Canal, asunto: string, motivo: string,
  destino: string | null, sub: { agencia_id: unknown }, yaRespondio = false) {
  await admin.from('conv_conversaciones').update({ ia_pausada: true }).eq('id', q.conversacion_id);
  await admin.from('conv_mensajes').insert({
    subcuenta_id: q.subcuenta_id, conversacion_id: q.conversacion_id, direccion: 'saliente', canal: 'nota', estado: 'enviado', ia: true,
    cuerpo: `${a.nombre} pasa la conversación a una persona. Motivo: ${motivo}`.slice(0, 2000),
  });
  if (!yaRespondio && a.mensaje_traspaso.trim()) await enviar(admin, q, canal, asunto, a.mensaje_traspaso.trim());
  if (destino) {
    await admin.from('notificaciones').insert({
      usuario_id: destino, agencia_id: sub.agencia_id, subcuenta_id: q.subcuenta_id, tipo: 'alerta', categoria: 'Conversaciones',
      titulo: `${a.nombre} necesita a una persona`, cuerpo: motivo.slice(0, 200),
      enlace: `/subcuenta/${q.subcuenta_id}/conversaciones?c=${q.conversacion_id}`,
    });
  }
}
