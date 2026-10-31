'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { DISPARADORES, esquemaPasos, type Disparador, type Paso } from '@/lib/automatizacion/tipos';
import { procesarAutomatizaciones } from '@/lib/automatizacion/motor';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ResultadoId = Resultado & { id?: string };

function validar(...ids: (string | null | undefined)[]) {
  if (ids.some((i) => i != null && !UUID.test(i))) throw new Error('Identificador no válido.');
}
async function contexto(subId: string) {
  validar(subId);
  await usuarioActual();
  return crearClienteServidor();
}
const refrescar = (subId: string) => revalidatePath(`/subcuenta/${subId}/automatizacion`, 'layout');

// Plantillas de partida (como las «recetas» del original).
const PLANTILLAS: Record<string, { disparador: Disparador; filtro: Record<string, unknown>; pasos: Paso[] }> = {
  vacio: { disparador: 'contacto_creado', filtro: {}, pasos: [] },
  bienvenida: {
    disparador: 'contacto_creado', filtro: {},
    pasos: [
      { tipo: 'enviar_email', asunto: '¡Bienvenido/a a {{empresa.nombre}}!', texto: 'Hola {{contacto.nombre}},\n\nGracias por contactar con {{empresa.nombre}}. En breve te escribimos.\n\nUn saludo.' },
      { tipo: 'esperar', cantidad: 1, unidad: 'dias' },
      { tipo: 'crear_tarea', titulo: 'Llamar a {{contacto.nombre_completo}}', descripcion: 'Contacto nuevo: hacer primera llamada.', dias: 0, asignado_id: '' },
    ],
  },
  no_presentado: {
    disparador: 'cita_estado', filtro: { estado: 'no_presentado' },
    pasos: [
      { tipo: 'enviar_sms', texto: 'Hola {{contacto.nombre}}, te echamos de menos en tu cita. ¿Quieres que te busquemos otra hora? Responde a este mensaje.' },
      { tipo: 'anadir_etiqueta', etiqueta: 'no-show' },
    ],
  },
  respuesta: {
    disparador: 'mensaje_recibido', filtro: {},
    pasos: [
      { tipo: 'notificar', usuario_id: '', titulo: 'Nuevo mensaje de {{contacto.nombre_completo}}', texto: '{{mensaje.texto}}' },
    ],
  },
  pago: {
    disparador: 'factura_pagada', filtro: {},
    pasos: [
      { tipo: 'enviar_email', asunto: 'Gracias por tu pago', texto: 'Hola {{contacto.nombre}},\n\nHemos recibido el pago de la factura {{factura.numero}} ({{factura.total}}). ¡Gracias!' },
      { tipo: 'anadir_etiqueta', etiqueta: 'cliente' },
    ],
  },
};

export async function crearFlujo(subId: string, nombre: string, plantilla: string): Promise<ResultadoId> {
  try {
    const n = nombre.trim().slice(0, 120);
    if (!n) return { ok: false, error: 'Ponle un nombre al flujo.' };
    const p = PLANTILLAS[plantilla] ?? PLANTILLAS.vacio;
    const supabase = await contexto(subId);
    const r = await supabase.from('aut_flujos').insert({ subcuenta_id: subId, nombre: n, disparador: p.disparador, filtro: p.filtro, pasos: p.pasos }).select('id').single();
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    refrescar(subId);
    return { ok: true, id: r.data.id as string };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

export async function guardarFlujo(subId: string, flujoId: string, d: {
  nombre: string; disparador: Disparador; filtro: Record<string, unknown>; pasos: unknown[]; permitir_reentrada: boolean; activo: boolean;
}): Promise<Resultado> {
  try {
    validar(flujoId);
    const nombre = d.nombre.trim().slice(0, 120);
    if (!nombre) return { ok: false, error: 'Ponle un nombre al flujo.' };
    if (!DISPARADORES.some((x) => x.valor === d.disparador)) return { ok: false, error: 'Disparador no válido.' };
    const pasos = esquemaPasos.safeParse(d.pasos);
    if (!pasos.success) {
      const i = pasos.error.issues[0];
      return { ok: false, error: `${typeof i.path[0] === 'number' ? `Paso ${i.path[0] + 1}: ` : ''}${i.message}` };
    }
    if (d.activo && pasos.data.length === 0) return { ok: false, error: 'Añade al menos un paso antes de publicar.' };
    // Filtro: solo claves conocidas y de texto/booleano.
    const filtro: Record<string, string | boolean> = {};
    for (const k of ['etiqueta', 'calendario_id', 'estado', 'canal', 'palabra', 'embudo_id', 'etapa_id', 'solo_online']) {
      const v = d.filtro[k];
      if (typeof v === 'boolean') filtro[k] = v;
      else if (typeof v === 'string' && v.trim()) filtro[k] = v.trim().slice(0, 200);
    }
    const supabase = await contexto(subId);
    const r = await supabase.from('aut_flujos').update({
      nombre, disparador: d.disparador, filtro, pasos: pasos.data, permitir_reentrada: d.permitir_reentrada, activo: d.activo,
    }).eq('id', flujoId).eq('subcuenta_id', subId).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede cambiar flujos.' };
    refrescar(subId);
    return { ok: true, mensaje: d.activo ? 'Flujo guardado y publicado.' : 'Flujo guardado como borrador.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function publicarFlujo(subId: string, flujoId: string, activo: boolean): Promise<Resultado> {
  try {
    validar(flujoId);
    const supabase = await contexto(subId);
    if (activo) {
      const { data } = await supabase.from('aut_flujos').select('pasos').eq('id', flujoId).single();
      if (!data || !(data.pasos as unknown[]).length) return { ok: false, error: 'Añade al menos un paso antes de publicar.' };
    }
    const r = await supabase.from('aut_flujos').update({ activo }).eq('id', flujoId).eq('subcuenta_id', subId).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede publicar flujos.' };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

export async function duplicarFlujo(subId: string, flujoId: string): Promise<ResultadoId> {
  try {
    validar(flujoId);
    const supabase = await contexto(subId);
    const { data: f } = await supabase.from('aut_flujos').select('nombre, disparador, filtro, pasos, permitir_reentrada').eq('id', flujoId).single();
    if (!f) return { ok: false, error: 'El flujo ya no existe.' };
    const r = await supabase.from('aut_flujos').insert({ ...f, subcuenta_id: subId, nombre: `${f.nombre} (copia)`.slice(0, 120), activo: false }).select('id').single();
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    refrescar(subId);
    return { ok: true, id: r.data.id as string };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

export async function borrarFlujo(subId: string, flujoId: string): Promise<Resultado> {
  try {
    validar(flujoId);
    const supabase = await contexto(subId);
    const r = await supabase.from('aut_flujos').delete().eq('id', flujoId).eq('subcuenta_id', subId).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede borrar flujos.' };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}

// «Probar»: mete al contacto en el flujo y ejecuta ya los pasos hasta la
// primera espera (las esperas siguen su curso real).
export async function probarFlujo(subId: string, flujoId: string, contactoId: string): Promise<Resultado> {
  try {
    validar(flujoId, contactoId);
    const supabase = await contexto(subId);
    const { data, error } = await supabase.rpc('aut_inscribir', { p_flujo: flujoId, p_contacto: contactoId });
    if (error) return { ok: false, error: mensajeDeError(error) };
    const r = await procesarAutomatizaciones(1, data as string);
    refrescar(subId);
    return { ok: true, mensaje: `Prueba lanzada: ${r.pasos} ${r.pasos === 1 ? 'paso ejecutado' : 'pasos ejecutados'}${r.completadas ? ' y flujo completado' : ''}. Mira el historial.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function pararEjecucion(subId: string, ejecId: string): Promise<Resultado> {
  try {
    validar(ejecId);
    const supabase = await contexto(subId);
    const r = await supabase.from('aut_ejecuciones').update({ estado: 'terminada', motivo: 'Parada a mano', terminado: new Date().toISOString() })
      .eq('id', ejecId).eq('subcuenta_id', subId).in('estado', ['pendiente', 'esperando', 'procesando']).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Esta ejecución ya no está en marcha.' };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'No se pudo completar la operación.' };
  }
}
