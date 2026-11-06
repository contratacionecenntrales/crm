'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia, esAdminAgencia } from '@/lib/sesion';
import { invitarPorCorreo } from '@/lib/invitar';
import { mensajeDeError } from '@/lib/errores';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function contexto() {
  const { actual } = await exigirAgencia();
  if (!esAdminAgencia(actual.rol)) throw new Error('Solo los administradores de la agencia gestionan subagencias.');
  return { agencia: actual.agencia.id, supabase: await crearClienteServidor() };
}

export async function crearSubagencia(d: { nombre: string; email: string; moneda: string; zona: string; soporte: boolean }): Promise<Resultado> {
  try {
    const { agencia, supabase } = await contexto();
    const nombre = String(d.nombre ?? '').trim();
    const email = String(d.email ?? '').trim().toLowerCase();
    if (nombre.length < 2 || nombre.length > 120) return { ok: false, error: 'El nombre tiene que tener entre 2 y 120 caracteres.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return { ok: false, error: 'Correo del dueño no válido.' };
    // El dueño: si ya tiene cuenta se usa; si no, se le invita a crear su contraseña.
    let { data: dueno } = await supabase.rpc('agencia_usuario_por_email', { p_agencia: agencia, p_email: email });
    let invitado = false;
    if (!dueno) {
      const inv = await invitarPorCorreo(email);
      if (!inv.ok) return inv;
      invitado = true;
      ({ data: dueno } = await supabase.rpc('agencia_usuario_por_email', { p_agencia: agencia, p_email: email }));
      if (!dueno) return { ok: false, error: 'No se pudo preparar la cuenta del dueño. Inténtalo de nuevo.' };
    }
    const { error } = await supabase.rpc('agencia_crear_subagencia', {
      p_padre: agencia, p_nombre: nombre, p_dueno: dueno, p_moneda: String(d.moneda || 'EUR').slice(0, 3), p_zona: String(d.zona || 'Europe/Madrid').slice(0, 60), p_soporte: Boolean(d.soporte),
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath('/agencia/subagencias');
    return { ok: true, mensaje: invitado ? `Subagencia creada. ${email} ha recibido una invitación para entrar.` : `Subagencia creada para ${email}.` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function gestionarSubagencia(hija: string, suspendida: boolean, limite: number | null): Promise<Resultado> {
  try {
    if (!UUID.test(hija)) return { ok: false, error: 'Subagencia no válida.' };
    if (limite !== null && (!Number.isInteger(limite) || limite < 0 || limite > 1000)) return { ok: false, error: 'El límite tiene que estar entre 0 y 1000.' };
    const { agencia, supabase } = await contexto();
    const { error } = await supabase.rpc('agencia_gestionar_subagencia', { p_padre: agencia, p_hija: hija, p_suspendida: suspendida, p_limite: limite });
    if (error) return { ok: false, error: mensajeDeError(error) };
    revalidatePath('/agencia/subagencias');
    return { ok: true, mensaje: suspendida ? 'Subagencia suspendida: ni ella ni sus clientes pueden entrar.' : 'Cambios guardados.' };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
