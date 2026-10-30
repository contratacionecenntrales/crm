'use server';
import { crearClienteServidor } from '@/lib/supabase/server';
import { esDia } from '@/lib/calendario/tiempo';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Horas libres (instantes ISO) de la página pública entre dos fechas del calendario.
export async function huecosPublicos(slug: string, desde: string, hasta: string): Promise<string[]> {
  if (!SLUG.test(slug) || !esDia(desde) || !esDia(hasta)) return [];
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('cal_huecos', { p_slug: slug, p_desde: desde, p_hasta: hasta });
  if (error) return [];
  return ((data ?? []) as string[]).map((t) => new Date(t).toISOString());
}

export type ResultadoReserva =
  | { ok: true; inicio: string; fin: string; confirmacion: string; ubicacion: string }
  | { ok: false; error: string; ocupado?: boolean };

export async function reservar(slug: string, inicio: string, _: ResultadoReserva | null, fd: FormData): Promise<ResultadoReserva> {
  if (!SLUG.test(slug)) return { ok: false, error: 'Calendario no válido.' };
  const t = new Date(inicio);
  if (Number.isNaN(t.getTime())) return { ok: false, error: 'Elige una hora.' };
  // Campo trampa: las personas no lo ven; los robots lo rellenan.
  if (String(fd.get('web') ?? '') !== '') return { ok: false, error: 'No se pudo completar la reserva.' };
  const campo = (k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
  if (fd.get('acepto') !== 'on') return { ok: false, error: 'Tienes que aceptar el tratamiento de tus datos para reservar.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('cal_reservar', {
    p_slug: slug,
    p_inicio: t.toISOString(),
    p_nombre: campo('nombre', 100),
    p_apellidos: campo('apellidos', 100),
    p_email: campo('email', 200),
    p_telefono: campo('telefono', 30),
    p_notas: campo('notas', 2000),
  });
  if (error) {
    const ocupado = error.hint === 'HUECO_OCUPADO' || error.code === '23P01';
    return { ok: false, ocupado, error: ocupado ? 'Esa hora se acaba de ocupar. Elige otra.' : error.message || 'No se pudo completar la reserva.' };
  }
  const r = data as { inicio: string; fin: string; confirmacion: string; ubicacion: string };
  return { ok: true, inicio: new Date(r.inicio).toISOString(), fin: new Date(r.fin).toISOString(), confirmacion: r.confirmacion, ubicacion: r.ubicacion };
}
