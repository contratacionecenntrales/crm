'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { invitarPorCorreo } from '@/lib/invitar';
import {
  esquemaAgencia, esquemaMiembro, esquemaPago, esquemaSubcuenta, esquemaSuscripcion, leerFormulario, primerError,
} from '@/lib/validacion';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS_SUBCUENTA = [
  'nombre', 'email', 'prefijo', 'telefono', 'direccion', 'ciudad', 'provincia', 'codigo_postal', 'pais', 'web', 'zona_horaria', 'etapa',
];

function refrescar() {
  revalidatePath('/agencia', 'layout');
}

// --- Subcuentas ----------------------------------------------------------------

export async function crearSubcuenta(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual, usuario } = await exigirAgencia({ admin: true });
  const datos = esquemaSubcuenta.safeParse(leerFormulario(fd, CAMPOS_SUBCUENTA));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('subcuentas')
    .insert({ ...datos.data, etapa: datos.data.etapa ?? 'Cerrado (Ganado)', agencia_id: actual.agencia.id, creado_por: usuario.id });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: `Subcuenta «${datos.data.nombre}» creada.` };
}

export async function actualizarSubcuenta(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await exigirAgencia({ admin: true });
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) return { ok: false, error: 'Subcuenta no válida.' };
  const datos = esquemaSubcuenta.safeParse(leerFormulario(fd, CAMPOS_SUBCUENTA));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('subcuentas').update(datos.data).eq('id', id).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No tienes permiso sobre esta subcuenta.' };
  refrescar();
  return { ok: true, mensaje: 'Cambios guardados.' };
}

export async function cambiarEstadoSubcuenta(id: string, estado: 'activa' | 'suspendida'): Promise<Resultado> {
  await exigirAgencia({ admin: true });
  if (!UUID.test(id) || !['activa', 'suspendida'].includes(estado)) return { ok: false, error: 'Datos no válidos.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('subcuentas').update({ estado }).eq('id', id).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No tienes permiso sobre esta subcuenta.' };
  refrescar();
  return { ok: true, mensaje: estado === 'suspendida' ? 'Subcuenta suspendida: sus usuarios ya no pueden entrar.' : 'Subcuenta reactivada.' };
}

export async function eliminarSubcuenta(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await exigirAgencia({ admin: true });
  const id = String(fd.get('id') ?? '');
  const confirmacion = String(fd.get('confirmacion') ?? '').trim();
  if (!UUID.test(id)) return { ok: false, error: 'Subcuenta no válida.' };

  const supabase = await crearClienteServidor();
  const { data: sub } = await supabase.from('subcuentas').select('nombre').eq('id', id).maybeSingle();
  if (!sub) return { ok: false, error: 'La subcuenta no existe.' };
  if (confirmacion !== sub.nombre) return { ok: false, error: 'Escribe el nombre exacto de la subcuenta para confirmar.' };

  const { data, error } = await supabase.from('subcuentas').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No tienes permiso para eliminarla.' };
  refrescar();
  return { ok: true, mensaje: 'Subcuenta eliminada.' };
}

// --- Plan y facturación ----------------------------------------------------------

export async function guardarSuscripcion(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  const subcuentaId = String(fd.get('subcuenta_id') ?? '');
  if (!UUID.test(subcuentaId)) return { ok: false, error: 'Subcuenta no válida.' };
  const datos = esquemaSuscripcion.safeParse(leerFormulario(fd, ['plan', 'importe_mensual', 'estado', 'inicio']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('suscripciones')
    .upsert({ ...datos.data, subcuenta_id: subcuentaId, agencia_id: actual.agencia.id }, { onConflict: 'subcuenta_id' });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Plan guardado.' };
}

export async function registrarPago(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual, usuario } = await exigirAgencia({ admin: true });
  const subcuentaId = String(fd.get('subcuenta_id') ?? '');
  if (!UUID.test(subcuentaId)) return { ok: false, error: 'Subcuenta no válida.' };
  const datos = esquemaPago.safeParse(leerFormulario(fd, ['importe', 'concepto', 'fecha']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('pagos').insert({
    agencia_id: actual.agencia.id,
    subcuenta_id: subcuentaId,
    importe: datos.data.importe,
    concepto: datos.data.concepto,
    fecha: new Date(`${datos.data.fecha}T12:00:00Z`).toISOString(),
    origen: 'manual',
    creado_por: usuario.id,
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Pago registrado.' };
}

export async function borrarPago(id: string): Promise<Resultado> {
  await exigirAgencia({ admin: true });
  if (!UUID.test(id)) return { ok: false, error: 'Pago no válido.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('pagos').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'Los pagos de Stripe no se borran a mano.' };
  refrescar();
  return { ok: true };
}

// --- Equipo de la agencia ------------------------------------------------------------

export async function agregarMiembroAgencia(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  const datos = esquemaMiembro.safeParse(leerFormulario(fd, ['email', 'rol']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };

  const supabase = await crearClienteServidor();
  const llamar = () =>
    supabase.rpc('agregar_miembro_agencia', { p_agencia: actual.agencia.id, p_email: datos.data.email, p_rol: datos.data.rol });

  let { data, error } = await llamar();
  if (error) return { ok: false, error: mensajeDeError(error) };
  let invitado = false;
  if (!data) {
    const inv = await invitarPorCorreo(datos.data.email);
    if (!inv.ok) return inv;
    invitado = true;
    ({ data, error } = await llamar());
    if (error || !data) return { ok: false, error: error ? mensajeDeError(error) : 'La invitación se envió pero no se pudo dar acceso.' };
  }
  revalidatePath('/agencia/equipo');
  return { ok: true, mensaje: invitado ? `Invitación enviada a ${datos.data.email}.` : `${datos.data.email} ya forma parte del equipo.` };
}

export async function cambiarRolAgencia(usuarioId: string, rol: string): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  if (!UUID.test(usuarioId) || !['propietario', 'admin', 'usuario'].includes(rol)) return { ok: false, error: 'Datos no válidos.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('agencia_miembros')
    .update({ rol })
    .eq('agencia_id', actual.agencia.id)
    .eq('usuario_id', usuarioId)
    .select('usuario_id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No se pudo cambiar el rol.' };
  revalidatePath('/agencia/equipo');
  return { ok: true };
}

export async function quitarMiembroAgencia(usuarioId: string): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  if (!UUID.test(usuarioId)) return { ok: false, error: 'Usuario no válido.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('agencia_miembros')
    .delete()
    .eq('agencia_id', actual.agencia.id)
    .eq('usuario_id', usuarioId)
    .select('usuario_id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No se pudo quitar a este usuario.' };
  revalidatePath('/agencia/equipo');
  return { ok: true };
}

// --- Datos de la agencia --------------------------------------------------------------

export async function actualizarAgencia(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  const datos = esquemaAgencia.safeParse(leerFormulario(fd, ['nombre', 'email', 'telefono', 'web', 'moneda', 'zona_horaria']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('agencias').update(datos.data).eq('id', actual.agencia.id).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No tienes permiso para editar la agencia.' };
  revalidatePath('/', 'layout');
  return { ok: true, mensaje: 'Datos de la agencia guardados.' };
}
