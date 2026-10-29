'use server';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import type { Resultado } from '@/lib/tipos';

function destinoSeguro(valor: FormDataEntryValue | null): string {
  const v = typeof valor === 'string' ? valor : '';
  // Solo rutas internas: evita redirecciones abiertas a otro dominio.
  return v.startsWith('/') && !v.startsWith('//') ? v : '/';
}

export async function iniciarSesion(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const clave = String(fd.get('clave') ?? '');
  if (!email || !clave) return { ok: false, error: 'Escribe tu correo y tu contraseña.' };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
  if (error) {
    return {
      ok: false,
      error: /invalid login/i.test(error.message)
        ? 'Correo o contraseña incorrectos.'
        : /email not confirmed/i.test(error.message)
          ? 'Tienes que confirmar tu correo antes de entrar.'
          : error.message,
    };
  }
  redirect(destinoSeguro(fd.get('siguiente')));
}

export async function enviarRecuperacion(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Correo no válido.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirmar?siguiente=/auth/nueva-clave`,
  });
  if (error && !/rate limit/i.test(error.message)) return { ok: false, error: error.message };
  if (error) return { ok: false, error: 'Has pedido demasiados correos. Espera unos minutos.' };
  // Mismo mensaje exista o no la cuenta: no revela qué correos están dados de alta.
  return { ok: true, mensaje: 'Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.' };
}

export async function cambiarClave(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const clave = String(fd.get('clave') ?? '');
  const repetida = String(fd.get('repetida') ?? '');
  if (clave.length < 10) return { ok: false, error: 'La contraseña necesita al menos 10 caracteres.' };
  if (clave !== repetida) return { ok: false, error: 'Las dos contraseñas no coinciden.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) return { ok: false, error: error.message };
  redirect('/');
}
