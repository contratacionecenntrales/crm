'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { supabaseUrl } from '@/lib/env';
import { mensajeDeError } from '@/lib/errores';
import { invitarPorCorreo } from '@/lib/invitar';
import { esquemaAgencia, leerFormulario, primerError } from '@/lib/validacion';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const url = z.string().trim().max(300).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Las URL tienen que empezar por http:// o https://');
const dominio = z.string().trim().toLowerCase().max(253).refine((v) => v === '' || /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v), 'Dominio no válido (ej. app.tudominio.com)');

async function actualizar(cambios: Record<string, unknown>, mensaje: string): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('agencias').update(cambios).eq('id', actual.agencia.id).select('id');
  if (error) return { ok: false, error: mensajeDeError(error) };
  if (!data?.length) return { ok: false, error: 'No tienes permiso para editar la agencia.' };
  revalidatePath('/', 'layout');
  return { ok: true, mensaje };
}

// --- Empresa: detalles básicos ------------------------------------------------------

const esquemaBasicos = esquemaAgencia.extend({
  categoria: z.string().trim().max(80),
  nicho: z.string().trim().max(80),
  uso_principal: z.string().trim().max(200),
  direccion: z.string().trim().max(200),
  ciudad: z.string().trim().max(100),
  codigo_postal: z.string().trim().max(12),
  provincia: z.string().trim().max(100),
  pais: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'País no válido'),
});

export async function guardarBasicos(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const d = esquemaBasicos.safeParse(leerFormulario(fd, [
    'nombre', 'email', 'telefono', 'web', 'moneda', 'zona_horaria', 'categoria', 'nicho', 'uso_principal',
    'direccion', 'ciudad', 'codigo_postal', 'provincia', 'pais',
  ]));
  if (!d.success) return { ok: false, error: primerError(d.error) };
  return actualizar(d.data, 'Datos de la empresa guardados.');
}

// --- Marca blanca ------------------------------------------------------------------

export async function guardarLogo(urlPublica: string | null): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  // Solo se acepta una URL de nuestro propio depósito y de la carpeta de la agencia.
  const base = `${supabaseUrl()}/storage/v1/object/public/marcas/${actual.agencia.id}/`;
  if (urlPublica !== null && !urlPublica.startsWith(base)) return { ok: false, error: 'Logo no válido.' };
  const supabase = await crearClienteServidor();
  const previo = actual.agencia.logo_url;
  const r = await actualizar({ logo_url: urlPublica }, urlPublica ? 'Logo actualizado.' : 'Logo eliminado.');
  if (r.ok && previo?.startsWith(base) && previo !== urlPublica) {
    await supabase.storage.from('marcas').remove([previo.slice(base.length - actual.agencia.id.length - 1)]);
  }
  return r;
}

export async function guardarDominios(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const d = z.object({ dominio_marca: dominio, dominio_api: dominio }).safeParse(leerFormulario(fd, ['dominio_marca', 'dominio_api']));
  if (!d.success) return { ok: false, error: primerError(d.error) };
  return actualizar(d.data, 'Dominios guardados. Recuerda apuntar el DNS (CNAME) al servidor de la plataforma.');
}

export async function guardarPoliticas(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const d = z.object({ url_privacidad: url, url_terminos: url }).safeParse(leerFormulario(fd, ['url_privacidad', 'url_terminos']));
  if (!d.success) return { ok: false, error: primerError(d.error) };
  return actualizar(d.data, 'Políticas guardadas.');
}

export async function guardarCss(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const css = String(fd.get('css') ?? '');
  if (css.length > 20000) return { ok: false, error: 'El CSS no puede superar 20.000 caracteres.' };
  // Sin «<» no se puede cerrar la etiqueta <style> e inyectar HTML.
  if (css.includes('<')) return { ok: false, error: 'El CSS no puede contener el carácter «<».' };
  if (/@import|expression\s*\(|javascript:/i.test(css)) return { ok: false, error: 'El CSS no puede usar @import, expression() ni javascript:.' };
  return actualizar({ css_personalizado: css }, 'CSS guardado. Se aplica a toda la agencia y sus subcuentas.');
}

export async function guardarTema(tema: 'claro' | 'oscuro'): Promise<Resultado> {
  if (!['claro', 'oscuro'].includes(tema)) return { ok: false, error: 'Tema no válido.' };
  return actualizar({ tema_defecto: tema }, 'Tema por defecto guardado.');
}

// --- Configuración avanzada ---------------------------------------------------------

export async function guardarExpiracion(minutos: number | null): Promise<Resultado> {
  if (minutos !== null && (!Number.isInteger(minutos) || minutos < 5 || minutos > 10080)) return { ok: false, error: 'Tiempo no válido.' };
  return actualizar({ expiracion_sesion_min: minutos }, 'Tiempo de sesión guardado.');
}

// --- Anuncios ------------------------------------------------------------------------

const esquemaAnuncio = z.object({
  titulo: z.string().trim().min(1, 'Pon un título').max(160),
  cuerpo: z.string().trim().max(2000),
  enlace: url,
  prioridad: z.enum(['general', 'advertencia', 'critico']),
  frecuencia: z.enum(['una_vez', 'a_diario', 'siempre']),
});

export async function guardarAnuncio(anuncioId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  const d = esquemaAnuncio.safeParse(leerFormulario(fd, ['titulo', 'cuerpo', 'enlace', 'prioridad', 'frecuencia']));
  if (!d.success) return { ok: false, error: primerError(d.error) };
  const subcuentas = fd.getAll('subcuentas').map(String).filter((x) => UUID.test(x));
  const fila = { ...d.data, subcuentas, activo: fd.get('activo') === 'on' };
  const supabase = await crearClienteServidor();
  const r = anuncioId
    ? (UUID.test(anuncioId) ? await supabase.from('anuncios').update(fila).eq('id', anuncioId).select('id') : { data: null, error: { message: 'Anuncio no válido.' } })
    : await supabase.from('anuncios').insert({ ...fila, agencia_id: actual.agencia.id }).select('id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  revalidatePath('/agencia/configuracion/anuncios');
  return { ok: true, mensaje: 'Anuncio guardado.' };
}

export async function alternarAnuncio(anuncioId: string, activo: boolean): Promise<Resultado> {
  await exigirAgencia({ admin: true });
  if (!UUID.test(anuncioId)) return { ok: false, error: 'Anuncio no válido.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('anuncios').update({ activo }).eq('id', anuncioId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath('/agencia/configuracion/anuncios');
  return { ok: true };
}

export async function borrarAnuncio(anuncioId: string): Promise<Resultado> {
  await exigirAgencia({ admin: true });
  if (!UUID.test(anuncioId)) return { ok: false, error: 'Anuncio no válido.' };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('anuncios').delete().eq('id', anuncioId);
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath('/agencia/configuracion/anuncios');
  return { ok: true };
}

// --- Usuarios (agencia y subcuentas) ----------------------------------------------------

export async function anadirUsuario(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const tipo = String(fd.get('tipo') ?? '');
  const rol = String(fd.get('rol') ?? '');
  const subcuenta = String(fd.get('subcuenta_id') ?? '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Correo no válido.' };
  const supabase = await crearClienteServidor();
  let llamar: () => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  if (tipo === 'agencia') {
    if (!['propietario', 'admin', 'usuario'].includes(rol)) return { ok: false, error: 'Rol no válido.' };
    llamar = () => supabase.rpc('agregar_miembro_agencia', { p_agencia: actual.agencia.id, p_email: email, p_rol: rol });
  } else if (tipo === 'subcuenta') {
    if (!UUID.test(subcuenta)) return { ok: false, error: 'Elige la subcuenta.' };
    if (!['admin', 'usuario'].includes(rol)) return { ok: false, error: 'Rol no válido.' };
    llamar = () => supabase.rpc('agregar_miembro_subcuenta', { p_subcuenta: subcuenta, p_email: email, p_rol: rol });
  } else return { ok: false, error: 'Tipo de usuario no válido.' };

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
  revalidatePath('/agencia/configuracion/usuarios');
  return { ok: true, mensaje: invitado ? `Invitación enviada a ${email}.` : `${email} añadido.` };
}

export async function cambiarRolUsuario(tipo: 'agencia' | 'subcuenta', usuarioId: string, subcuentaId: string | null, rol: string): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  if (!UUID.test(usuarioId)) return { ok: false, error: 'Usuario no válido.' };
  const supabase = await crearClienteServidor();
  const r = tipo === 'agencia'
    ? await supabase.from('agencia_miembros').update({ rol }).eq('agencia_id', actual.agencia.id).eq('usuario_id', usuarioId).select('usuario_id')
    : await supabase.from('subcuenta_miembros').update({ rol }).eq('subcuenta_id', subcuentaId ?? '').eq('usuario_id', usuarioId).select('usuario_id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'No se pudo cambiar el rol.' };
  revalidatePath('/agencia/configuracion/usuarios');
  return { ok: true };
}

export async function quitarUsuario(tipo: 'agencia' | 'subcuenta', usuarioId: string, subcuentaId: string | null): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  if (!UUID.test(usuarioId)) return { ok: false, error: 'Usuario no válido.' };
  const supabase = await crearClienteServidor();
  const r = tipo === 'agencia'
    ? await supabase.from('agencia_miembros').delete().eq('agencia_id', actual.agencia.id).eq('usuario_id', usuarioId).select('usuario_id')
    : await supabase.from('subcuenta_miembros').delete().eq('subcuenta_id', subcuentaId ?? '').eq('usuario_id', usuarioId).select('usuario_id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'No se pudo quitar a este usuario.' };
  revalidatePath('/agencia/configuracion/usuarios');
  return { ok: true };
}

// --- Inicio de sesión único (SSO) ---------------------------------------------------

export async function guardarSso(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const { actual } = await exigirAgencia({ admin: true });
  const proveedor = String(fd.get('sso_proveedor') ?? 'saml');
  if (!['saml', 'google', 'azure'].includes(proveedor)) return { ok: false, error: 'Proveedor no válido.' };
  const dominios = String(fd.get('sso_dominios') ?? '').split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  const malo = dominios.find((d) => !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d));
  if (malo) return { ok: false, error: `«${malo}» no es un dominio válido (ej. tuempresa.com).` };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('sso_guardar', {
    p_agencia: actual.agencia.id, p_activo: fd.get('sso_activo') === 'on', p_proveedor: proveedor, p_dominios: dominios,
    p_obligatorio: fd.get('sso_obligatorio') === 'on', p_autoalta: fd.get('sso_autoalta') === 'on',
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  revalidatePath('/agencia/configuracion', 'layout');
  return { ok: true, mensaje: 'Inicio de sesión único guardado.' };
}
