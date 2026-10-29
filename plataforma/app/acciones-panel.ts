'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { COOKIE_AGENCIA, contextoAgencias, usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function alternarFijada(subcuentaId: string, fijar: boolean): Promise<Resultado> {
  if (!UUID.test(subcuentaId)) return { ok: false, error: 'Subcuenta no válida.' };
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  const { error } = fijar
    ? await supabase.from('subcuenta_fijadas').upsert({ usuario_id: usuario.id, subcuenta_id: subcuentaId })
    : await supabase.from('subcuenta_fijadas').delete().eq('usuario_id', usuario.id).eq('subcuenta_id', subcuentaId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function entrarEnSubcuenta(subcuentaId: string) {
  if (!UUID.test(subcuentaId)) return;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('registrar_acceso_subcuenta', { p_subcuenta: subcuentaId });
  if (error) redirect('/?error=sin-acceso');
  redirect(`/subcuenta/${subcuentaId}`);
}

export async function cambiarAgencia(agenciaId: string) {
  const { membresias } = await contextoAgencias();
  if (!membresias.some((m) => m.agencia.id === agenciaId)) return;
  (await cookies()).set(COOKIE_AGENCIA, agenciaId, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/agencia');
}

export async function marcarNotificacion(id: string): Promise<Resultado> {
  if (!UUID.test(id)) return { ok: false, error: 'Notificación no válida.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('notificaciones').update({ leida: new Date().toISOString() }).eq('id', id).is('leida', null);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function marcarTodasLeidas(): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('marcar_notificaciones_leidas');
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function borrarNotificacion(id: string): Promise<Resultado> {
  if (!UUID.test(id)) return { ok: false, error: 'Notificación no válida.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('notificaciones').delete().eq('id', id);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath('/', 'layout');
  return { ok: true };
}
