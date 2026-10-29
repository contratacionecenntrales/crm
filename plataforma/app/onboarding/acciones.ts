'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { COOKIE_AGENCIA } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { esquemaAgencia, leerFormulario, primerError } from '@/lib/validacion';
import type { Resultado } from '@/lib/tipos';

export async function crearAgencia(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const datos = esquemaAgencia.pick({ nombre: true, moneda: true, zona_horaria: true })
    .safeParse(leerFormulario(fd, ['nombre', 'moneda', 'zona_horaria']));
  if (!datos.success) return { ok: false, error: primerError(datos.error) };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('crear_agencia', {
    p_nombre: datos.data.nombre,
    p_moneda: datos.data.moneda,
    p_zona_horaria: datos.data.zona_horaria,
  });
  if (error) return { ok: false, error: mensajeDeError(error) };
  (await cookies()).set(COOKIE_AGENCIA, String(data), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/agencia');
}
