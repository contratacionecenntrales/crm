import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Agencia, RolAgencia, Subcuenta } from '@/lib/tipos';

export const COOKIE_AGENCIA = 'agencia_actual';

export const usuarioActual = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  return data.user;
});

export interface MembresiaAgencia {
  agencia: Agencia;
  rol: RolAgencia;
}

// Agencias del usuario y cuál está activa (cookie, o la primera).
export const contextoAgencias = cache(async () => {
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('agencia_miembros')
    .select('rol, agencias(*)')
    .eq('usuario_id', usuario.id)
    .order('creado');
  if (error) throw new Error(error.message);

  const membresias: MembresiaAgencia[] = (data ?? [])
    .filter((m) => m.agencias)
    .map((m) => ({ rol: m.rol as RolAgencia, agencia: m.agencias as unknown as Agencia }));

  const elegida = (await cookies()).get(COOKIE_AGENCIA)?.value;
  const actual = membresias.find((m) => m.agencia.id === elegida) ?? membresias[0] ?? null;
  return { usuario, membresias, actual };
});

// Exige agencia activa; con `admin` exige además propietario o admin.
export async function exigirAgencia(opciones: { admin?: boolean } = {}) {
  const ctx = await contextoAgencias();
  if (!ctx.actual) redirect('/');
  if (opciones.admin && ctx.actual.rol === 'usuario') redirect('/agencia/subcuentas');
  return { ...ctx, actual: ctx.actual };
}

export const esAdminAgencia = (rol: RolAgencia | undefined) => rol === 'propietario' || rol === 'admin';

// Subcuentas que el usuario puede ver (RLS) y las que tiene fijadas.
export const subcuentasVisibles = cache(async () => {
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  const [subs, fijadas] = await Promise.all([
    supabase
      .from('subcuentas')
      .select('id, agencia_id, nombre, direccion, ciudad, provincia, codigo_postal, logo_url, estado')
      .order('nombre'),
    supabase.from('subcuenta_fijadas').select('subcuenta_id').eq('usuario_id', usuario.id),
  ]);
  if (subs.error) throw new Error(subs.error.message);
  const setFijadas = new Set((fijadas.data ?? []).map((f) => f.subcuenta_id as string));
  return (subs.data ?? []).map((s) => ({ ...(s as Subcuenta), fijada: setFijadas.has(s.id) }));
});

// Subcuenta por id, o 404 si no existe o no es visible para este usuario.
export const subcuentaVisible = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('subcuentas').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const { data: soyAdmin } = await supabase.rpc('soy_admin_subcuenta', { p_subcuenta: id });
  const { data: soyAdminAgencia } = await supabase.rpc('soy_admin_agencia', { p_agencia: data.agencia_id });
  return { subcuenta: data as Subcuenta, soyAdmin: Boolean(soyAdmin), soyAdminAgencia: Boolean(soyAdminAgencia) };
});
