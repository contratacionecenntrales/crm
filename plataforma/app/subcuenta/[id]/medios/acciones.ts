'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { mensajeDeError } from '@/lib/errores';
import { carpetaValida } from '@/lib/medios';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refrescar = (subId: string) => revalidatePath(`/subcuenta/${subId}/medios`);

// Tras subir a Storage desde el navegador: se registra con el tamaño real.
export async function registrarMedio(subId: string, ruta: string, nombre: string, carpeta: string): Promise<Resultado> {
  try {
    if (!UUID.test(subId) || !ruta.startsWith(subId + '/')) return { ok: false, error: 'Ruta no válida.' };
    if (!carpetaValida(carpeta)) return { ok: false, error: 'Nombre de carpeta no válido.' };
    const supabase = await crearClienteServidor();
    const { error } = await supabase.rpc('medios_registrar', { p_ruta: ruta, p_nombre: nombre.slice(0, 200), p_carpeta: carpeta });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function renombrarMedio(subId: string, id: string, nombre: string): Promise<Resultado> {
  try {
    const n = nombre.trim();
    if (!UUID.test(subId) || !UUID.test(id)) return { ok: false, error: 'Archivo no válido.' };
    if (!n || n.length > 200) return { ok: false, error: 'El nombre tiene que tener entre 1 y 200 caracteres.' };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('medios').update({ nombre: n }).eq('id', id).eq('subcuenta_id', subId).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró el archivo.' };
    refrescar(subId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function moverMedios(subId: string, ids: string[], carpeta: string): Promise<Resultado> {
  try {
    const c = carpeta.trim();
    if (!UUID.test(subId) || !ids.length || ids.length > 500 || !ids.every((x) => UUID.test(x))) return { ok: false, error: 'Selección no válida.' };
    if (!carpetaValida(c)) return { ok: false, error: 'La carpeta no puede tener / \\ < > ni más de 60 caracteres.' };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('medios').update({ carpeta: c }).in('id', ids).eq('subcuenta_id', subId).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar(subId);
    return { ok: true, mensaje: `${data?.length ?? 0} archivo(s) movido(s).` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Borra de Storage (con los permisos de quien lo pide) y después el registro.
export async function borrarMedios(subId: string, ids: string[]): Promise<Resultado> {
  try {
    if (!UUID.test(subId) || !ids.length || ids.length > 500 || !ids.every((x) => UUID.test(x))) return { ok: false, error: 'Selección no válida.' };
    const supabase = await crearClienteServidor();
    const { data: filas, error: e1 } = await supabase.from('medios').select('id, ruta').in('id', ids).eq('subcuenta_id', subId);
    if (e1) return { ok: false, error: mensajeDeError(e1) };
    if (!filas?.length) return { ok: false, error: 'No se encontraron los archivos.' };
    const { error: e2 } = await supabase.storage.from('medios').remove(filas.map((f) => f.ruta as string));
    if (e2) return { ok: false, error: `No se pudieron borrar de Storage: ${e2.message}` };
    const { error: e3 } = await supabase.from('medios').delete().in('id', filas.map((f) => f.id as string));
    if (e3) return { ok: false, error: mensajeDeError(e3) };
    refrescar(subId);
    return { ok: true, mensaje: `${filas.length} archivo(s) borrado(s).` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
