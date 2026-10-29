'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { leerFormulario, primerError } from '@/lib/validacion';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (m: string) => z.string().trim().regex(UUID, m);

function validar(...ids: string[]) {
  if (ids.some((i) => !UUID.test(i))) throw new Error('Identificador no válido.');
}
async function ctx(subId: string) {
  validar(subId);
  await usuarioActual();
  return crearClienteServidor();
}
const refrescar = (subId: string) => revalidatePath(`/subcuenta/${subId}`, 'layout');

const esquemaOportunidad = z.object({
  nombre: z.string().trim().min(1, 'Pon un nombre a la oportunidad').max(160),
  contacto_id: uuid('Elige un contacto'),
  embudo_id: uuid('Elige un embudo'),
  etapa_id: uuid('Elige una etapa'),
  valor: z.string().trim().transform((v) => (v === '' ? 0 : Number(v.replace(',', '.')))).refine((v) => Number.isFinite(v) && v >= 0, 'Importe no válido'),
  estado: z.enum(['abierta', 'ganada', 'perdida', 'abandonada']),
  propietario_id: z.string().trim().refine((v) => v === '' || UUID.test(v), 'Propietario no válido').transform((v) => v || null),
  fuente: z.string().trim().max(100),
  motivo_perdida: z.string().trim().max(300),
});

export async function guardarOportunidad(subId: string, oportunidadId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const datos = esquemaOportunidad.safeParse(
    leerFormulario(fd, ['nombre', 'contacto_id', 'embudo_id', 'etapa_id', 'valor', 'estado', 'propietario_id', 'fuente', 'motivo_perdida']),
  );
  if (!datos.success) return { ok: false, error: primerError(datos.error) };
  const supabase = await ctx(subId);
  const d = { ...datos.data, motivo_perdida: datos.data.estado === 'perdida' ? datos.data.motivo_perdida : '' };
  let r;
  if (oportunidadId) {
    validar(oportunidadId);
    r = await supabase.from('crm_oportunidades').update(d).eq('id', oportunidadId).eq('subcuenta_id', subId).select('id');
  } else {
    // Las nuevas van al final de su columna.
    const { data: ultima } = await supabase
      .from('crm_oportunidades').select('posicion').eq('etapa_id', d.etapa_id).order('posicion', { ascending: false }).limit(1).maybeSingle();
    r = await supabase.from('crm_oportunidades').insert({ ...d, subcuenta_id: subId, posicion: (ultima?.posicion ?? 0) + 1000 }).select('id');
  }
  if (r.error) {
    return { ok: false, error: /foreign key/i.test(r.error.message) ? 'La etapa no pertenece al embudo elegido o el contacto no existe.' : mensajeDeError(r.error) };
  }
  if (!r.data?.length) return { ok: false, error: 'No se encontró la oportunidad.' };
  refrescar(subId);
  return { ok: true, mensaje: oportunidadId ? 'Oportunidad guardada.' : 'Oportunidad creada.' };
}

export async function moverOportunidad(subId: string, oportunidadId: string, etapaId: string, posicion: number): Promise<Resultado> {
  validar(oportunidadId, etapaId);
  if (!Number.isFinite(posicion)) return { ok: false, error: 'Posición no válida.' };
  const supabase = await ctx(subId);
  const { error } = await supabase.rpc('crm_mover_oportunidad', { p_oportunidad: oportunidadId, p_etapa: etapaId, p_posicion: posicion });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function cambiarEstadoOportunidad(subId: string, oportunidadId: string, estado: 'abierta' | 'ganada' | 'perdida' | 'abandonada'): Promise<Resultado> {
  validar(oportunidadId);
  if (!['abierta', 'ganada', 'perdida', 'abandonada'].includes(estado)) return { ok: false, error: 'Estado no válido.' };
  const supabase = await ctx(subId);
  const { error } = await supabase.from('crm_oportunidades').update({ estado }).eq('id', oportunidadId).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

export async function borrarOportunidad(subId: string, oportunidadId: string): Promise<Resultado> {
  validar(oportunidadId);
  const supabase = await ctx(subId);
  const { error } = await supabase.from('crm_oportunidades').delete().eq('id', oportunidadId).eq('subcuenta_id', subId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}

// --- Embudos y etapas (solo administradores, lo impone RLS) ------------------------

export async function crearEmbudo(subId: string, nombre: string, etapas: string[]): Promise<Resultado> {
  const n = nombre.trim().slice(0, 80);
  const lista = etapas.map((e) => e.trim().slice(0, 80)).filter(Boolean).slice(0, 30);
  if (!n) return { ok: false, error: 'Pon un nombre al embudo.' };
  if (!lista.length) return { ok: false, error: 'Añade al menos una etapa.' };
  const supabase = await ctx(subId);
  const { count } = await supabase.from('crm_embudos').select('id', { count: 'exact', head: true }).eq('subcuenta_id', subId);
  const { data, error } = await supabase.from('crm_embudos').insert({ subcuenta_id: subId, nombre: n, orden: count ?? 0 }).select('id').single();
  if (error) return { ok: false, error: mensajeDeError(error) };
  const r = await supabase.from('crm_etapas').insert(lista.map((e, i) => ({ subcuenta_id: subId, embudo_id: data.id, nombre: e, orden: i + 1 })));
  if (r.error) {
    await supabase.from('crm_embudos').delete().eq('id', data.id);
    return { ok: false, error: mensajeDeError(r.error) };
  }
  refrescar(subId);
  return { ok: true, mensaje: 'Embudo creado.' };
}

export async function renombrarEmbudo(subId: string, embudoId: string, nombre: string): Promise<Resultado> {
  validar(embudoId);
  const n = nombre.trim().slice(0, 80);
  if (!n) return { ok: false, error: 'El nombre no puede quedar vacío.' };
  const supabase = await ctx(subId);
  const { data, error } = await supabase.from('crm_embudos').update({ nombre: n }).eq('id', embudoId).eq('subcuenta_id', subId).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo un administrador puede cambiar los embudos.' };
  refrescar(subId);
  return { ok: true };
}

export async function borrarEmbudo(subId: string, embudoId: string): Promise<Resultado> {
  validar(embudoId);
  const supabase = await ctx(subId);
  const { count } = await supabase.from('crm_embudos').select('id', { count: 'exact', head: true }).eq('subcuenta_id', subId);
  if ((count ?? 0) <= 1) return { ok: false, error: 'La subcuenta tiene que conservar al menos un embudo.' };
  const { data, error } = await supabase.from('crm_embudos').delete().eq('id', embudoId).eq('subcuenta_id', subId).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo un administrador puede borrar embudos.' };
  refrescar(subId);
  return { ok: true };
}

export async function guardarEtapa(subId: string, embudoId: string, etapaId: string | null, nombre: string): Promise<Resultado> {
  validar(embudoId);
  const n = nombre.trim().slice(0, 80);
  if (!n) return { ok: false, error: 'El nombre no puede quedar vacío.' };
  const supabase = await ctx(subId);
  let r;
  if (etapaId) {
    validar(etapaId);
    r = await supabase.from('crm_etapas').update({ nombre: n }).eq('id', etapaId).eq('embudo_id', embudoId).select('id');
  } else {
    const { data: ult } = await supabase.from('crm_etapas').select('orden').eq('embudo_id', embudoId).order('orden', { ascending: false }).limit(1).maybeSingle();
    r = await supabase.from('crm_etapas').insert({ subcuenta_id: subId, embudo_id: embudoId, nombre: n, orden: (ult?.orden ?? 0) + 1 }).select('id');
  }
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'Solo un administrador puede cambiar las etapas.' };
  refrescar(subId);
  return { ok: true };
}

export async function reordenarEtapas(subId: string, embudoId: string, ids: string[]): Promise<Resultado> {
  validar(embudoId, ...ids);
  const supabase = await ctx(subId);
  for (let i = 0; i < ids.length; i++) {
    const { data, error } = await supabase.from('crm_etapas').update({ orden: i + 1 }).eq('id', ids[i]).eq('embudo_id', embudoId).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'Solo un administrador puede cambiar las etapas.' };
  }
  refrescar(subId);
  return { ok: true };
}

export async function borrarEtapa(subId: string, etapaId: string, destinoId: string | null): Promise<Resultado> {
  validar(etapaId, ...(destinoId ? [destinoId] : []));
  const supabase = await ctx(subId);
  const { error } = await supabase.rpc('crm_borrar_etapa', { p_etapa: etapaId, p_destino: destinoId });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar(subId);
  return { ok: true };
}
