'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validar(...ids: (string | null)[]) { for (const i of ids) if (i !== null && !UUID.test(i)) throw new Error('Identificador no válido.'); }
const refrescar = (sub: string) => revalidatePath(`/subcuenta/${sub}/marketing`);
const etiquetas = z.array(z.string().trim().min(1).max(60)).max(20);
const esquema = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre').max(120),
  canal: z.enum(['email', 'sms', 'whatsapp']),
  asunto: z.string().max(300),
  cuerpo: z.string().max(20000),
  etiquetas, modo: z.enum(['alguna', 'todas']), excluir: etiquetas,
});
export type DatosCampana = z.infer<typeof esquema>;

async function ctx(sub: string) { validar(sub); await usuarioActual(); return crearClienteServidor(); }
const error = (e: unknown): Resultado => ({ ok: false, error: (e as Error).message || 'No se pudo completar.' });

export async function guardarCampana(sub: string, id: string | null, datos: DatosCampana): Promise<Resultado & { id?: string }> {
  try {
    validar(id);
    const v = esquema.safeParse(datos);
    if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? 'Datos no válidos.' };
    const supabase = await ctx(sub);
    const r = id
      ? await supabase.from('mkt_campanas').update({ ...v.data, actualizado: new Date().toISOString() }).eq('id', id).eq('subcuenta_id', sub).select('id')
      : await supabase.from('mkt_campanas').insert({ ...v.data, subcuenta_id: sub }).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un administrador de la subcuenta puede cambiar campañas.' };
    refrescar(sub);
    return { ok: true, mensaje: 'Borrador guardado.', id: r.data[0].id as string };
  } catch (e) { return error(e); }
}

export async function audienciaCampana(sub: string, d: Pick<DatosCampana, 'canal' | 'etiquetas' | 'modo' | 'excluir'>): Promise<number> {
  try {
    const supabase = await ctx(sub);
    const { data } = await supabase.rpc('mkt_audiencia', { p_subcuenta: sub, p_canal: d.canal, p_etiquetas: d.etiquetas, p_modo: d.modo, p_excluir: d.excluir });
    return Number(data ?? 0);
  } catch { return 0; }
}

export async function lanzarCampana(sub: string, id: string, cuando: string | null): Promise<Resultado> {
  try {
    validar(id);
    const fecha = cuando ? new Date(cuando) : null;
    if (fecha && Number.isNaN(fecha.getTime())) return { ok: false, error: 'Fecha no válida.' };
    const supabase = await ctx(sub);
    const { data, error: e } = await supabase.rpc('mkt_lanzar', { p_campana: id, p_cuando: fecha?.toISOString() ?? null });
    if (e) return { ok: false, error: mensajeDeError(e) };
    refrescar(sub);
    return { ok: true, mensaje: fecha && fecha > new Date() ? `Programada para ${data} contacto(s).` : `Enviándose a ${data} contacto(s). Se envía por tandas en los próximos minutos.` };
  } catch (e) { return error(e); }
}

export async function cancelarCampana(sub: string, id: string): Promise<Resultado> {
  try {
    validar(id);
    const supabase = await ctx(sub);
    const { error: e } = await supabase.rpc('mkt_cancelar', { p_campana: id });
    if (e) return { ok: false, error: mensajeDeError(e) };
    refrescar(sub);
    return { ok: true, mensaje: 'Campaña cancelada. Lo ya enviado no se puede deshacer.' };
  } catch (e) { return error(e); }
}

export async function borrarCampana(sub: string, id: string): Promise<Resultado> {
  try {
    validar(id);
    const supabase = await ctx(sub);
    const { data, error: e } = await supabase.from('mkt_campanas').delete().eq('id', id).eq('subcuenta_id', sub).select('id');
    if (e) return { ok: false, error: mensajeDeError(e) };
    if (!data?.length) return { ok: false, error: 'Solo un administrador de la subcuenta puede borrar campañas.' };
    refrescar(sub);
    return { ok: true, mensaje: 'Campaña borrada.' };
  } catch (e) { return error(e); }
}

export async function duplicarCampana(sub: string, id: string): Promise<Resultado & { id?: string }> {
  try {
    validar(id);
    const supabase = await ctx(sub);
    const { data: c } = await supabase.from('mkt_campanas').select('nombre, canal, asunto, cuerpo, etiquetas, modo, excluir').eq('id', id).eq('subcuenta_id', sub).maybeSingle();
    if (!c) return { ok: false, error: 'No se encontró la campaña.' };
    return guardarCampana(sub, null, { ...(c as DatosCampana), nombre: `${c.nombre} (copia)`.slice(0, 120) });
  } catch (e) { return error(e); }
}

// --- Biblioteca: usar una plantilla de envío o activar una campaña automática ---
export async function usarPlantillaEnvio(sub: string, plantillaId: string): Promise<Resultado & { id?: string }> {
  const { PLANTILLAS_ENVIO } = await import('@/lib/marketing/plantillas');
  const p = PLANTILLAS_ENVIO.find((x) => x.id === plantillaId);
  if (!p) return { ok: false, error: 'Plantilla no encontrada.' };
  return guardarCampana(sub, null, { nombre: p.nombre, canal: p.canal, asunto: p.asunto, cuerpo: p.cuerpo, etiquetas: p.etiquetas_sugeridas, modo: 'alguna', excluir: [] });
}

export async function activarReceta(sub: string, recetaId: string): Promise<Resultado & { id?: string }> {
  try {
    const [{ RECETAS }, { esquemaPasos }] = await Promise.all([import('@/lib/marketing/plantillas'), import('@/lib/automatizacion/tipos')]);
    const r = RECETAS.find((x) => x.id === recetaId);
    if (!r) return { ok: false, error: 'Campaña no encontrada.' };
    const pasos = esquemaPasos.safeParse(r.pasos);
    if (!pasos.success) return { ok: false, error: 'La campaña no es válida.' };
    const supabase = await ctx(sub);
    const { data, error: e } = await supabase.from('aut_flujos').insert({ subcuenta_id: sub, nombre: r.nombre, disparador: r.disparador, filtro: r.filtro, pasos: pasos.data, activo: true }).select('id');
    if (e) return { ok: false, error: mensajeDeError(e) };
    if (!data?.length) return { ok: false, error: 'Solo un administrador de la subcuenta puede activar campañas automáticas.' };
    revalidatePath(`/subcuenta/${sub}/automatizacion`);
    return { ok: true, mensaje: `«${r.nombre}» activada. Ya funciona sola; puedes ajustarla en Automatización.`, id: data[0].id as string };
  } catch (e) { return error(e); }
}
