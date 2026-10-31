'use server';
import { redirect } from 'next/navigation';
import { mensajeDeAuth } from '@/lib/errores';
import { rutaInterna } from '@/lib/red/ruta';
import { crearClienteServidor } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import type { Resultado } from '@/lib/tipos';

const destinoSeguro = (valor: FormDataEntryValue | null) => rutaInterna(valor);

export async function iniciarSesion(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const clave = String(fd.get('clave') ?? '');
  if (!email || !clave) return { ok: false, error: 'Escribe tu correo y tu contraseña.' };

  const supabase = await crearClienteServidor();
  const { data: sso } = await supabase.rpc('sso_para_email', { p_email: email });
  if ((sso as { obligatorio?: boolean } | null)?.obligatorio) {
    return { ok: false, error: 'Tu empresa usa inicio de sesión único. Pulsa «Continuar con SSO».' };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
  if (error) {
    return {
      ok: false,
      error: /invalid login/i.test(error.message)
        ? 'Correo o contraseña incorrectos.'
        : /email not confirmed/i.test(error.message)
          ? 'Tienes que confirmar tu correo antes de entrar.'
          : mensajeDeAuth(error),
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
  if (error && !/rate limit/i.test(error.message)) return { ok: false, error: mensajeDeAuth(error) };
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
  if (error) return { ok: false, error: mensajeDeAuth(error) };
  redirect('/');
}

// Inicio de sesión único: según el dominio del correo, SAML (signInWithSSO)
// o OAuth de Google / Microsoft. Supabase devuelve la URL del proveedor.
export async function entrarConSso(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Escribe tu correo de empresa.' };
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('sso_para_email', { p_email: email });
  const sso = data as { dominio: string; proveedor: 'saml' | 'google' | 'azure' } | null;
  if (!sso) return { ok: false, error: 'Tu empresa no tiene configurado el inicio de sesión único. Entra con tu contraseña.' };
  const vuelta = `${siteUrl()}/auth/confirmar?siguiente=${encodeURIComponent(destinoSeguro(fd.get('siguiente')))}`;
  let url: string | undefined;
  if (sso.proveedor === 'saml') {
    const r = await supabase.auth.signInWithSSO({ domain: sso.dominio, options: { redirectTo: vuelta } });
    if (r.error) return { ok: false, error: /not found|no sso provider/i.test(r.error.message) ? 'El proveedor SAML de tu empresa aún no está registrado en el servidor.' : mensajeDeAuth(r.error) };
    url = r.data?.url;
  } else {
    const r = await supabase.auth.signInWithOAuth({
      provider: sso.proveedor,
      options: {
        redirectTo: vuelta,
        scopes: sso.proveedor === 'azure' ? 'email' : undefined,
        queryParams: sso.proveedor === 'google' ? { hd: sso.dominio, login_hint: email } : { login_hint: email },
      },
    });
    if (r.error) return { ok: false, error: mensajeDeAuth(r.error) };
    url = r.data?.url;
  }
  if (!url) return { ok: false, error: 'No se pudo iniciar el acceso con tu proveedor.' };
  redirect(url);
}
