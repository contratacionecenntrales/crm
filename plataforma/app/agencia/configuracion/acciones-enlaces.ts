'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { ICONOS_ENLACE, urlEnlaceValida } from '@/lib/menu/enlaces';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ICONOS = new Set<string>(ICONOS_ENLACE.map(([v]) => v));
const refrescar = () => revalidatePath('/', 'layout');

export async function guardarEnlace(enlaceId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    const nombre = String(fd.get('nombre') ?? '').trim();
    const url = String(fd.get('url') ?? '').trim();
    const icono = String(fd.get('icono') ?? 'enlace');
    const modo = fd.get('modo') === 'iframe' ? 'iframe' : 'pestana';
    const en_agencia = fd.get('en_agencia') === 'on';
    const en_subcuentas = fd.get('en_subcuentas') === 'on';
    const todas = fd.get('destino') !== 'algunas';
    const subcuentas = todas ? [] : [...new Set(fd.getAll('subcuentas').map(String).filter((x) => UUID.test(x)))];
    if (!nombre || nombre.length > 40) return { ok: false, error: 'El nombre es obligatorio (máximo 40 caracteres).' };
    if (!urlEnlaceValida(url)) return { ok: false, error: 'La URL tiene que empezar por https:// (máximo 1000 caracteres).' };
    if (!ICONOS.has(icono)) return { ok: false, error: 'Icono no válido.' };
    if (!en_agencia && !en_subcuentas) return { ok: false, error: 'Elige dónde se muestra: en la agencia, en las subcuentas o en ambas.' };
    if (en_subcuentas && !todas && !subcuentas.length) return { ok: false, error: 'Elige al menos una subcuenta o marca «Todas las subcuentas».' };
    const fila = { nombre, url, icono, modo, en_agencia, en_subcuentas, subcuentas };
    const supabase = await crearClienteServidor();
    let r;
    if (enlaceId) {
      if (!UUID.test(enlaceId)) return { ok: false, error: 'Enlace no válido.' };
      r = await supabase.from('menu_enlaces').update(fila).eq('id', enlaceId).eq('agencia_id', actual.agencia.id).select('id');
    } else {
      const { count } = await supabase.from('menu_enlaces').select('id', { count: 'exact', head: true }).eq('agencia_id', actual.agencia.id);
      if ((count ?? 0) >= 30) return { ok: false, error: 'Como mucho 30 enlaces por agencia.' };
      r = await supabase.from('menu_enlaces').insert({ ...fila, agencia_id: actual.agencia.id, orden: count ?? 0 }).select('id');
    }
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'No se encontró el enlace o no tienes permiso.' };
    refrescar();
    return { ok: true, mensaje: 'Enlace guardado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function borrarEnlace(enlaceId: string): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    if (!UUID.test(enlaceId)) return { ok: false, error: 'Enlace no válido.' };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('menu_enlaces').delete().eq('id', enlaceId).eq('agencia_id', actual.agencia.id).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró el enlace.' };
    refrescar();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Guarda el orden completo (lista de ids en el orden nuevo).
export async function ordenarEnlaces(ids: string[]): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    if (!Array.isArray(ids) || ids.length > 30 || !ids.every((x) => UUID.test(x))) return { ok: false, error: 'Orden no válido.' };
    const supabase = await crearClienteServidor();
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase.from('menu_enlaces').update({ orden: i }).eq('id', ids[i]).eq('agencia_id', actual.agencia.id);
      if (error) return { ok: false, error: mensajeDeError(error) };
    }
    refrescar();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
