'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { PERMISOS } from '@/lib/api/permisos';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALIDOS = new Set<string>(PERMISOS.map((p) => p.valor));
const refrescar = () => revalidatePath('/agencia/configuracion/claves-api');

export async function crearClaveApi(_: (Resultado & { token?: string }) | null, fd: FormData): Promise<Resultado & { token?: string }> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    const nombre = String(fd.get('nombre') ?? '').trim();
    const permisos = [...new Set(fd.getAll('permisos').map(String))].filter((p) => VALIDOS.has(p));
    const todas = fd.get('destino') !== 'algunas';
    const subcuentas = todas ? [] : [...new Set(fd.getAll('subcuentas').map(String).filter((x) => UUID.test(x)))];
    const dias = String(fd.get('caduca') ?? '');
    if (!nombre || nombre.length > 60) return { ok: false, error: 'Ponle un nombre (máximo 60 caracteres), por ejemplo «Zapier».' };
    if (!permisos.length) return { ok: false, error: 'Marca al menos un permiso.' };
    if (!todas && !subcuentas.length) return { ok: false, error: 'Elige al menos una subcuenta o marca «Todas las subcuentas».' };
    if (!['', '30', '90', '365'].includes(dias)) return { ok: false, error: 'Caducidad no válida.' };
    const caduca = dias ? new Date(Date.now() + Number(dias) * 864e5).toISOString() : null;
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.rpc('api_crear_clave', {
      p_agencia: actual.agencia.id, p_nombre: nombre, p_permisos: permisos, p_subcuentas: subcuentas, p_caduca: caduca,
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar();
    return { ok: true, mensaje: 'Clave creada.', token: (data as { token: string }).token };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function revocarClaveApi(id: string): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    if (!UUID.test(id)) return { ok: false, error: 'Clave no válida.' };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('api_claves').update({ revocada_en: new Date().toISOString() })
      .eq('id', id).eq('agencia_id', actual.agencia.id).is('revocada_en', null).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró la clave o ya estaba revocada.' };
    refrescar();
    return { ok: true, mensaje: 'Clave revocada: deja de funcionar al instante.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function borrarClaveApi(id: string): Promise<Resultado> {
  try {
    const { actual } = await exigirAgencia({ admin: true });
    if (!UUID.test(id)) return { ok: false, error: 'Clave no válida.' };
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.from('api_claves').delete().eq('id', id).eq('agencia_id', actual.agencia.id).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'No se encontró la clave.' };
    refrescar();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
