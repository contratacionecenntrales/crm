'use server';
import { revalidatePath } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/server';
import { esAdminPlataforma } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { invitarPorCorreo } from '@/lib/invitar';
import { numeroEs } from '@/lib/formato';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const leer = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

async function exigir() {
  if (!(await esAdminPlataforma())) throw new Error('Solo los administradores de la plataforma pueden hacer esto.');
  return crearClienteServidor();
}
const refrescar = () => revalidatePath('/plataforma', 'layout');

// Da de alta una agencia con su dueño: si el correo no tiene cuenta, se le invita.
export async function crearAgenciaPlataforma(_: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const supabase = await exigir();
    const nombre = leer(fd, 'nombre');
    const email = leer(fd, 'email').toLowerCase();
    const plan = leer(fd, 'plan_id');
    const dias = Number(leer(fd, 'dias_prueba') || 0);
    if (nombre.length < 2 || nombre.length > 120) return { ok: false, error: 'El nombre de la agencia tiene que tener entre 2 y 120 caracteres.' };
    if (!EMAIL.test(email)) return { ok: false, error: 'Escribe el correo del dueño de la agencia.' };
    if (plan && !UUID.test(plan)) return { ok: false, error: 'Plan no válido.' };
    if (!Number.isInteger(dias) || dias < 0 || dias > 365) return { ok: false, error: 'Días de prueba entre 0 y 365.' };
    let { data: dueno } = await supabase.rpc('plataforma_usuario_por_email', { p_email: email });
    let invitado = false;
    if (!dueno) {
      const inv = await invitarPorCorreo(email);
      if (!inv.ok) return inv;
      invitado = true;
      ({ data: dueno } = await supabase.rpc('plataforma_usuario_por_email', { p_email: email }));
      if (!dueno) return { ok: false, error: 'Se envió la invitación pero no se encontró el usuario. Inténtalo de nuevo.' };
    }
    const { error } = await supabase.rpc('plataforma_crear_agencia', {
      p_nombre: nombre, p_dueno: dueno, p_plan: plan || null, p_dias_prueba: dias,
      p_moneda: leer(fd, 'moneda') || 'EUR', p_zona: leer(fd, 'zona_horaria') || 'Europe/Madrid',
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar();
    return { ok: true, mensaje: invitado ? `Agencia creada. Hemos invitado a ${email} por correo.` : `Agencia creada para ${email}.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function actualizarAgenciaPlataforma(agenciaId: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const supabase = await exigir();
    if (!UUID.test(agenciaId)) return { ok: false, error: 'Agencia no válida.' };
    const plan = leer(fd, 'plan_id');
    const estado = leer(fd, 'estado');
    const prueba = leer(fd, 'prueba_hasta');
    if (plan && !UUID.test(plan)) return { ok: false, error: 'Plan no válido.' };
    if (!['activa', 'prueba', 'suspendida'].includes(estado)) return { ok: false, error: 'Estado no válido.' };
    if (prueba && !/^\d{4}-\d{2}-\d{2}$/.test(prueba)) return { ok: false, error: 'Fecha de fin de prueba no válida.' };
    if (estado === 'prueba' && !prueba) return { ok: false, error: 'Indica hasta cuándo dura la prueba.' };
    const { error } = await supabase.rpc('plataforma_actualizar_agencia', {
      p_agencia: agenciaId, p_plan: plan || null, p_estado: estado, p_prueba_hasta: estado === 'prueba' ? prueba : null,
      p_motivo: estado === 'suspendida' ? leer(fd, 'motivo') : '', p_notas: leer(fd, 'notas'),
    });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar();
    return { ok: true, mensaje: 'Agencia actualizada.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function guardarPlan(planId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const supabase = await exigir();
    const nombre = leer(fd, 'nombre');
    const precio = numeroEs(leer(fd, 'precio_mensual') || '0');
    const maxS = leer(fd, 'max_subcuentas');
    const maxU = leer(fd, 'max_usuarios');
    if (!nombre || nombre.length > 60) return { ok: false, error: 'El nombre es obligatorio (máximo 60 caracteres).' };
    if (!Number.isFinite(precio) || precio < 0) return { ok: false, error: 'Precio no válido.' };
    for (const [v, t] of [[maxS, 'subcuentas'], [maxU, 'usuarios']]) {
      if (v && (!/^\d+$/.test(v) || Number(v) > 100000)) return { ok: false, error: `Máximo de ${t}: un número entero o vacío (sin límite).` };
    }
    const funciones = Object.fromEntries(['ia', 'embudos', 'whatsapp', 'api', 'marca_blanca'].map((f) => [f, fd.get(`f_${f}`) === 'on']));
    const fila = {
      nombre, descripcion: leer(fd, 'descripcion').slice(0, 300), precio_mensual: precio, moneda: (leer(fd, 'moneda') || 'EUR').toUpperCase(),
      max_subcuentas: maxS ? Number(maxS) : null, max_usuarios: maxU ? Math.max(1, Number(maxU)) : null, funciones, activo: fd.get('activo') === 'on',
    };
    const r = planId
      ? (UUID.test(planId) ? await supabase.from('planes').update(fila).eq('id', planId).select('id') : { data: null, error: { message: 'Plan no válido.' } })
      : await supabase.from('planes').insert(fila).select('id');
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    if (!r.data?.length) return { ok: false, error: 'Solo un superadministrador puede cambiar los planes.' };
    refrescar();
    return { ok: true, mensaje: 'Plan guardado.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function borrarPlan(planId: string): Promise<Resultado> {
  try {
    const supabase = await exigir();
    if (!UUID.test(planId)) return { ok: false, error: 'Plan no válido.' };
    const { count } = await supabase.rpc('plataforma_agencias', {}, { count: 'exact', head: false }).eq('plan_id', planId);
    if (count) return { ok: false, error: `Hay ${count} agencia(s) con este plan: cámbialas antes o desactiva el plan.` };
    const { data, error } = await supabase.from('planes').delete().eq('id', planId).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'Solo un superadministrador puede borrar planes.' };
    refrescar();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function guardarAjustesPlataforma(_: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const supabase = await exigir();
    const nombre = leer(fd, 'nombre');
    const plan = leer(fd, 'plan_defecto');
    const dias = Number(leer(fd, 'dias_prueba') || 0);
    if (!nombre || nombre.length > 60) return { ok: false, error: 'El nombre de la plataforma es obligatorio.' };
    if (plan && !UUID.test(plan)) return { ok: false, error: 'Plan no válido.' };
    if (!Number.isInteger(dias) || dias < 0 || dias > 365) return { ok: false, error: 'Días de prueba entre 0 y 365.' };
    const { data, error } = await supabase.from('plataforma_ajustes')
      .update({ nombre, registro_abierto: fd.get('registro_abierto') === 'on', plan_defecto: plan || null, dias_prueba: dias, actualizado: new Date().toISOString() })
      .eq('id', true).select('id');
    if (error) return { ok: false, error: mensajeDeError(error) };
    if (!data?.length) return { ok: false, error: 'Solo un superadministrador puede cambiar los ajustes.' };
    refrescar();
    return { ok: true, mensaje: 'Ajustes guardados.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function altaAdminPlataforma(_: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const supabase = await exigir();
    const email = leer(fd, 'email').toLowerCase();
    const rol = leer(fd, 'rol') === 'soporte' ? 'soporte' : 'superadmin';
    if (!EMAIL.test(email)) return { ok: false, error: 'Correo no válido.' };
    const { error } = await supabase.rpc('plataforma_alta_admin', { p_email: email, p_rol: rol });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar();
    return { ok: true, mensaje: `${email} ya es administrador de la plataforma.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function bajaAdminPlataforma(usuarioId: string): Promise<Resultado> {
  try {
    const supabase = await exigir();
    if (!UUID.test(usuarioId)) return { ok: false, error: 'Usuario no válido.' };
    const { error } = await supabase.rpc('plataforma_baja_admin', { p_usuario: usuarioId });
    if (error) return { ok: false, error: mensajeDeError(error) };
    refrescar();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
