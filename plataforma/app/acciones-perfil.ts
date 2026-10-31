'use server';
import { z } from 'zod';
import { mensajeDeAuth } from '@/lib/errores';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { leerFormulario, primerError } from '@/lib/validacion';
import type { Resultado } from '@/lib/tipos';

const esquemaPerfil = z.object({
  nombre: z.string().trim().min(1, 'Escribe tu nombre').max(60),
  apellidos: z.string().trim().max(80),
  telefono: z.string().trim().max(20).refine((v) => v === '' || /^\+?[0-9 ]{6,20}$/.test(v), 'Teléfono no válido'),
});

export async function guardarPerfil(_: Resultado | null, fd: FormData): Promise<Resultado> {
  await usuarioActual();
  const d = esquemaPerfil.safeParse(leerFormulario(fd, ['nombre', 'apellidos', 'telefono']));
  if (!d.success) return { ok: false, error: primerError(d.error) };
  const supabase = await crearClienteServidor();
  const nombreCompleto = [d.data.nombre, d.data.apellidos].filter(Boolean).join(' ');
  const { error } = await supabase.auth.updateUser({
    data: { nombre: nombreCompleto, nombre_pila: d.data.nombre, apellidos: d.data.apellidos, telefono: d.data.telefono.replace(/\s/g, '') },
  });
  if (error) return { ok: false, error: mensajeDeAuth(error) };
  return { ok: true, mensaje: 'Perfil guardado.' };
}

export async function cambiarCorreo(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const usuario = await usuarioActual();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Correo no válido.' };
  if (email === usuario.email) return { ok: false, error: 'Es el mismo correo que ya tienes.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${siteUrl()}/auth/confirmar` });
  if (error) return { ok: false, error: mensajeDeAuth(error) };
  return { ok: true, mensaje: `Te hemos enviado un enlace a ${email} para confirmar el cambio.` };
}

export async function cambiarContrasena(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const usuario = await usuarioActual();
  const actual = String(fd.get('actual') ?? '');
  const nueva = String(fd.get('nueva') ?? '');
  const repetida = String(fd.get('repetida') ?? '');
  if (nueva.length < 10) return { ok: false, error: 'La nueva contraseña necesita al menos 10 caracteres.' };
  if (nueva !== repetida) return { ok: false, error: 'Las dos contraseñas nuevas no coinciden.' };
  const supabase = await crearClienteServidor();
  // Se comprueba la contraseña actual antes de cambiarla.
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: usuario.email ?? '', password: actual });
  if (e1) return { ok: false, error: 'La contraseña actual no es correcta.' };
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) return { ok: false, error: mensajeDeAuth(error) };
  return { ok: true, mensaje: 'Contraseña cambiada.' };
}
