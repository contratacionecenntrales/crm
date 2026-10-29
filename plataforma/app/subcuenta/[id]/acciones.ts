'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { invitarPorCorreo } from '@/lib/invitar';
import { esquemaSubcuenta, leerFormulario, primerError } from '@/lib/validacion';
import type { Resultado, RolSubcuenta } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: RolSubcuenta[] = ['admin', 'usuario'];

// El admin de la subcuenta edita los datos del negocio (no la etapa ni el estado).
export async function guardarPerfil(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await usuarioActual();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) return { ok: false, error: 'Subcuenta no válida.' };
  const datos = esquemaSubcuenta.omit({ etapa: true }).safeParse(
    leerFormulario(fd, ['nombre', 'email', 'prefijo', 'telefono', 'direccion', 'ciudad', 'provincia', 'codigo_postal', 'pais', 'web', 'zona_horaria']),
  );
  if (!datos.success) return { ok: false, error: primerError(datos.error) };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('subcuentas').update(datos.data).eq('id', id).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Solo los administradores pueden editar el perfil.' };
  revalidatePath(`/subcuenta/${id}`, 'layout');
  return { ok: true, mensaje: 'Perfil guardado.' };
}

export async function agregarMiembroSubcuenta(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await usuarioActual();
  const id = String(fd.get('subcuenta_id') ?? '');
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const rol = String(fd.get('rol') ?? 'usuario') as RolSubcuenta;
  if (!UUID.test(id)) return { ok: false, error: 'Subcuenta no válida.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Correo no válido.' };
  if (!ROLES.includes(rol)) return { ok: false, error: 'Rol no válido.' };

  const supabase = await crearClienteServidor();
  const llamar = () => supabase.rpc('agregar_miembro_subcuenta', { p_subcuenta: id, p_email: email, p_rol: rol });
  let { data, error } = await llamar();
  if (error) return { ok: false, error: mensajeDeError(error) };
  let invitado = false;
  if (!data) {
    const inv = await invitarPorCorreo(email);
    if (!inv.ok) return inv;
    invitado = true;
    ({ data, error } = await llamar());
    if (error || !data) return { ok: false, error: error ? mensajeDeError(error) : 'La invitación se envió pero no se pudo dar acceso.' };
  }
  revalidatePath(`/subcuenta/${id}/configuracion`);
  return { ok: true, mensaje: invitado ? `Invitación enviada a ${email}.` : `${email} ya tiene acceso.` };
}

export async function cambiarRolSubcuenta(subcuentaId: string, usuarioId: string, rol: RolSubcuenta): Promise<Resultado> {
  if (!UUID.test(subcuentaId) || !UUID.test(usuarioId) || !ROLES.includes(rol)) return { ok: false, error: 'Datos no válidos.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('subcuenta_miembros')
    .update({ rol })
    .eq('subcuenta_id', subcuentaId)
    .eq('usuario_id', usuarioId)
    .select('usuario_id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No tienes permiso para cambiar este rol.' };
  revalidatePath(`/subcuenta/${subcuentaId}/configuracion`);
  return { ok: true };
}

export async function quitarMiembroSubcuenta(subcuentaId: string, usuarioId: string): Promise<Resultado> {
  if (!UUID.test(subcuentaId) || !UUID.test(usuarioId)) return { ok: false, error: 'Datos no válidos.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('subcuenta_miembros')
    .delete()
    .eq('subcuenta_id', subcuentaId)
    .eq('usuario_id', usuarioId)
    .select('usuario_id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No tienes permiso para quitar a este usuario.' };
  revalidatePath(`/subcuenta/${subcuentaId}/configuracion`);
  return { ok: true };
}
