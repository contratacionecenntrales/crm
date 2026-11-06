'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { ErrorIA, iaConfigurada, responderConversacion, type Turno } from '@/lib/ia/claude';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validar(...ids: (string | null)[]) { for (const i of ids) if (i !== null && !UUID.test(i)) throw new Error('Identificador no válido.'); }
const refrescar = (sub: string) => revalidatePath(`/subcuenta/${sub}/ia`);

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre').max(80),
  instrucciones: z.string().max(8000, 'Las instrucciones son demasiado largas (máximo 8000 caracteres).'),
  conocimiento: z.string().max(60000, 'La base de conocimiento es demasiado larga (máximo 60 000 caracteres).'),
  canales: z.array(z.enum(['chat', 'sms', 'whatsapp', 'email', 'voz'])).max(5),
  activo: z.boolean(),
  max_respuestas: z.number().int().min(1).max(200),
  traspaso_palabras: z.array(z.string().trim().max(60)).max(30),
  mensaje_traspaso: z.string().max(500),
  saludo_voz: z.string().max(500, 'El saludo es demasiado largo (máximo 500 caracteres).'),
  desvio_voz: z.string().trim().transform((s) => s.replace(/[\s().-]/g, '')).refine((s) => s === '' || /^\+[0-9]{6,15}$/.test(s), 'El teléfono de desvío tiene que ir en formato internacional, p. ej. +34600111222.'),
});
export type DatosAsistente = z.infer<typeof esquema>;

export async function guardarAsistente(sub: string, id: string | null, datos: DatosAsistente): Promise<Resultado & { id?: string }> {
  try {
    validar(sub, id);
    await usuarioActual();
    const v = esquema.safeParse(datos);
    if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? 'Datos no válidos.' };
    if (v.data.activo && !v.data.canales.length) return { ok: false, error: 'Elige al menos un canal para activarlo.' };
    const supabase = await crearClienteServidor();
    const fila = { ...v.data, traspaso_palabras: v.data.traspaso_palabras.filter(Boolean) };
    const r = id
      ? await supabase.from('ia_asistentes').update({ ...fila, actualizado: new Date().toISOString() }).eq('id', id).eq('subcuenta_id', sub).select('id')
      : await supabase.from('ia_asistentes').insert({ ...fila, subcuenta_id: sub }).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un administrador de la subcuenta puede cambiar asistentes.' };
    refrescar(sub);
    return { ok: true, mensaje: v.data.activo ? 'Guardado. El asistente ya contesta en sus canales.' : 'Guardado (desactivado).', id: r.data[0].id as string };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function borrarAsistente(sub: string, id: string): Promise<Resultado> {
  try {
    validar(sub, id);
    await usuarioActual();
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('ia_asistentes').delete().eq('id', id).eq('subcuenta_id', sub).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'Solo un administrador de la subcuenta puede borrar asistentes.' };
    refrescar(sub);
    return { ok: true, mensaje: 'Asistente borrado.' };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

// Prueba en el editor: contesta como lo haría en el chat web, sin enviar nada.
export async function probarAsistente(sub: string, datos: Pick<DatosAsistente, 'nombre' | 'instrucciones' | 'conocimiento'>, historial: Turno[]):
  Promise<Resultado & { respuesta?: string; traspaso?: boolean; motivo?: string }> {
  try {
    validar(sub);
    await usuarioActual();
    if (!iaConfigurada()) return { ok: false, error: 'La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).' };
    const v = esquema.pick({ nombre: true, instrucciones: true, conocimiento: true }).safeParse(datos);
    if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? 'Datos no válidos.' };
    const turnos = z.array(z.object({ de: z.enum(['cliente', 'negocio']), texto: z.string().max(4000) })).max(40).safeParse(historial);
    if (!turnos.success) return { ok: false, error: 'Conversación de prueba no válida.' };
    const supabase = await crearClienteServidor();
    const { data: admin } = await supabase.rpc('soy_admin_subcuenta', { p_subcuenta: sub });
    if (!admin) return { ok: false, error: 'Solo un administrador de la subcuenta puede probar asistentes.' };
    const [{ data: cupo }, { data: s }] = await Promise.all([
      supabase.rpc('ia_reservar_uso', { p_subcuenta: sub }),
      supabase.from('subcuentas').select('nombre, zona_horaria').eq('id', sub).maybeSingle(),
    ]);
    if (!cupo || !s) return { ok: false, error: 'Sin IA disponible: el plan no la incluye o se alcanzó el límite diario.' };
    const r = await responderConversacion({ asistente: v.data, empresa: String(s.nombre), canal: 'chat', contacto: '', zona: String(s.zona_horaria || ''), historial: turnos.data });
    await crearClienteAdmin()?.rpc('ia_sumar_tokens', { p_subcuenta: sub, p_entrada: r.uso.entrada, p_salida: r.uso.salida });
    return { ok: true, respuesta: r.respuesta, traspaso: r.pasarAHumano, motivo: r.motivo };
  } catch (e) { return { ok: false, error: e instanceof ErrorIA ? e.message : 'No se pudo probar el asistente.' }; }
}
