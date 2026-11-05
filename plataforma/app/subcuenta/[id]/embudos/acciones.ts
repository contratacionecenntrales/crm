'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { mensajeDeError } from '@/lib/errores';
import { PAGINA_EN_BLANCO, PLANTILLAS } from '@/lib/embudos/plantillas';
import { esquemaContenido, rutaPaso, slugEmbudo, type Contenido } from '@/lib/embudos/tipos';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const sufijo = () => Math.random().toString(36).slice(2, 6);
function validar(...ids: string[]) { for (const i of ids) if (!UUID.test(i)) throw new Error('Identificador no válido.'); }
const refrescar = (sub: string, eid?: string) => revalidatePath(eid ? `/subcuenta/${sub}/embudos/${eid}` : `/subcuenta/${sub}/embudos`, 'layout');
const fallo = (e: unknown): Resultado => ({ ok: false, error: (e as Error).message });

export async function crearEmbudo(sub: string, nombre: string, plantilla: string): Promise<Resultado & { id?: string }> {
  try {
    validar(sub);
    const n = nombre.trim();
    if (!n || n.length > 120) return { ok: false, error: 'Ponle un nombre (máximo 120 caracteres).' };
    const p = plantilla ? PLANTILLAS.find((x) => x.id === plantilla) : null;
    if (plantilla && !p) return { ok: false, error: 'Plantilla no válida.' };
    const supabase = await crearClienteServidor();
    const { data: e, error } = await supabase.from('emb_embudos')
      .insert({ subcuenta_id: sub, nombre: n, slug: slugEmbudo(n, sufijo()), plantilla: p?.id ?? '' }).select('id').single();
    if (error) return { ok: false, error: mensajeDeError(error) };
    const pasos = p ? p.pasos() : [{ nombre: 'Inicio', ruta: 'inicio', contenido: PAGINA_EN_BLANCO() }];
    const { error: e2 } = await supabase.from('emb_pasos').insert(pasos.map((x, i) => ({
      embudo_id: e.id, subcuenta_id: sub, nombre: x.nombre, ruta: x.ruta, orden: i, contenido: x.contenido,
    })));
    if (e2) {
      await supabase.from('emb_embudos').delete().eq('id', e.id);
      return { ok: false, error: mensajeDeError(e2) };
    }
    refrescar(sub);
    return { ok: true, id: e.id as string };
  } catch (e) { return fallo(e); }
}

export async function actualizarEmbudo(sub: string, eid: string, cambios: { nombre?: string; slug?: string; publicado?: boolean }): Promise<Resultado> {
  try {
    validar(sub, eid);
    const fila: Record<string, unknown> = { actualizado: new Date().toISOString() };
    if (cambios.nombre !== undefined) { const n = cambios.nombre.trim(); if (!n || n.length > 120) return { ok: false, error: 'Nombre no válido.' }; fila.nombre = n; }
    if (cambios.slug !== undefined) { const s = cambios.slug.trim().toLowerCase(); if (!SLUG.test(s) || s.length < 3 || s.length > 60) return { ok: false, error: 'La dirección solo admite minúsculas, números y guiones (3 a 60).' }; fila.slug = s; }
    if (cambios.publicado !== undefined) fila.publicado = Boolean(cambios.publicado);
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('emb_embudos').update(fila).eq('id', eid).eq('subcuenta_id', sub).select('id');
    if (error) return { ok: false, error: error.code === '23505' ? 'Esa dirección ya la usa otro embudo.' : mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró el embudo.' };
    refrescar(sub, eid);
    return { ok: true, mensaje: 'Guardado.' };
  } catch (e) { return fallo(e); }
}

export async function borrarEmbudo(sub: string, eid: string): Promise<Resultado> {
  try {
    validar(sub, eid);
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('emb_embudos').delete().eq('id', eid).eq('subcuenta_id', sub).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró el embudo.' };
    refrescar(sub);
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function duplicarEmbudo(sub: string, eid: string): Promise<Resultado> {
  try {
    validar(sub, eid);
    const supabase = await crearClienteServidor();
    const { data: e } = await supabase.from('emb_embudos').select('nombre, plantilla').eq('id', eid).eq('subcuenta_id', sub).maybeSingle();
    if (!e) return { ok: false, error: 'No se encontró el embudo.' };
    const { data: pasos } = await supabase.from('emb_pasos').select('nombre, ruta, orden, contenido, seo_titulo, seo_descripcion').eq('embudo_id', eid).order('orden');
    const nombre = `${e.nombre} (copia)`.slice(0, 120);
    const { data: n, error } = await supabase.from('emb_embudos').insert({ subcuenta_id: sub, nombre, slug: slugEmbudo(nombre, sufijo()), plantilla: e.plantilla }).select('id').single();
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (pasos?.length) await supabase.from('emb_pasos').insert(pasos.map((x) => ({ ...x, embudo_id: n.id, subcuenta_id: sub })));
    refrescar(sub);
    return { ok: true, mensaje: 'Embudo duplicado.' };
  } catch (e) { return fallo(e); }
}

async function rutaLibre(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, eid: string, base: string, excepto?: string) {
  const { data } = await supabase.from('emb_pasos').select('id, ruta').eq('embudo_id', eid);
  const usadas = new Set((data ?? []).filter((x) => x.id !== excepto).map((x) => x.ruta as string));
  let r = base; let i = 2;
  while (usadas.has(r)) r = `${base}-${i++}`.slice(0, 60);
  return r;
}

export async function crearPaso(sub: string, eid: string, nombre: string): Promise<Resultado & { id?: string }> {
  try {
    validar(sub, eid);
    const n = nombre.trim();
    if (!n || n.length > 120) return { ok: false, error: 'Ponle un nombre a la página.' };
    const supabase = await crearClienteServidor();
    const { count } = await supabase.from('emb_pasos').select('id', { count: 'exact', head: true }).eq('embudo_id', eid);
    const ruta = await rutaLibre(supabase, eid, rutaPaso(n));
    const { data, error } = await supabase.from('emb_pasos').insert({ embudo_id: eid, subcuenta_id: sub, nombre: n, ruta, orden: count ?? 0, contenido: PAGINA_EN_BLANCO() }).select('id').single();
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar(sub, eid);
    return { ok: true, id: data.id as string };
  } catch (e) { return fallo(e); }
}

export async function actualizarPaso(sub: string, pid: string, cambios: { nombre: string; ruta: string; seo_titulo: string; seo_descripcion: string }): Promise<Resultado> {
  try {
    validar(sub, pid);
    const nombre = cambios.nombre.trim(); const ruta = cambios.ruta.trim().toLowerCase();
    if (!nombre || nombre.length > 120) return { ok: false, error: 'Nombre no válido.' };
    if (!SLUG.test(ruta) || ruta.length > 60) return { ok: false, error: 'La ruta solo admite minúsculas, números y guiones.' };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('emb_pasos').update({
      nombre, ruta, seo_titulo: cambios.seo_titulo.trim().slice(0, 120), seo_descripcion: cambios.seo_descripcion.trim().slice(0, 300), actualizado: new Date().toISOString(),
    }).eq('id', pid).eq('subcuenta_id', sub).select('embudo_id');
    if (error) return { ok: false, error: error.code === '23505' ? 'Ya hay otra página con esa ruta en este embudo.' : mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró la página.' };
    refrescar(sub, data[0].embudo_id as string);
    return { ok: true, mensaje: 'Guardado.' };
  } catch (e) { return fallo(e); }
}

export async function moverPaso(sub: string, eid: string, ids: string[]): Promise<Resultado> {
  try {
    validar(sub, eid, ...ids);
    const supabase = await crearClienteServidor();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase.from('emb_pasos').update({ orden: i }).eq('id', ids[i]).eq('embudo_id', eid).eq('subcuenta_id', sub);
      if (error) return { ok: false, error: mensajeDeError(error) };
    }
    refrescar(sub, eid);
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function duplicarPaso(sub: string, pid: string): Promise<Resultado> {
  try {
    validar(sub, pid);
    const supabase = await crearClienteServidor();
    const { data: p } = await supabase.from('emb_pasos').select('embudo_id, nombre, ruta, contenido, seo_titulo, seo_descripcion').eq('id', pid).eq('subcuenta_id', sub).maybeSingle();
    if (!p) return { ok: false, error: 'No se encontró la página.' };
    const { count } = await supabase.from('emb_pasos').select('id', { count: 'exact', head: true }).eq('embudo_id', p.embudo_id);
    const ruta = await rutaLibre(supabase, p.embudo_id as string, `${p.ruta}-copia`.slice(0, 55));
    const { error } = await supabase.from('emb_pasos').insert({ ...p, nombre: `${p.nombre} (copia)`.slice(0, 120), ruta, orden: count ?? 0, subcuenta_id: sub });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar(sub, p.embudo_id as string);
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function borrarPaso(sub: string, pid: string): Promise<Resultado> {
  try {
    validar(sub, pid);
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('emb_pasos').delete().eq('id', pid).eq('subcuenta_id', sub).select('embudo_id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró la página.' };
    refrescar(sub, data[0].embudo_id as string);
    return { ok: true };
  } catch (e) { return fallo(e); }
}

// Guarda el borrador (validado). Con «publicar», además lo publica y publica el embudo.
export async function guardarPaso(sub: string, pid: string, contenido: Contenido, publicar: boolean): Promise<Resultado & { publicado_en?: string }> {
  try {
    validar(sub, pid);
    const v = esquemaContenido.safeParse(contenido);
    if (!v.success) return { ok: false, error: `El contenido no es válido: ${v.error.issues[0]?.message ?? ''}` };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('emb_pasos').update({ contenido: v.data, actualizado: new Date().toISOString() })
      .eq('id', pid).eq('subcuenta_id', sub).select('embudo_id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró la página.' };
    let publicado_en: string | undefined;
    if (publicar) {
      const { data: ts, error: e2 } = await supabase.rpc('emb_publicar', { p_paso: pid });
      if (e2) return { ok: false, error: mensajeDeError(e2) };
      publicado_en = ts as string;
      await supabase.from('emb_embudos').update({ publicado: true, actualizado: new Date().toISOString() }).eq('id', data[0].embudo_id).eq('subcuenta_id', sub);
    }
    refrescar(sub, data[0].embudo_id as string);
    return { ok: true, mensaje: publicar ? 'Publicado.' : 'Borrador guardado.', publicado_en };
  } catch (e) { return fallo(e); }
}
