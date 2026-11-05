'use server';
import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { dentroDelLimite } from '@/lib/red/limite';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function valorarResena(token: string, puntuacion: number, comentario: string): Promise<{ ok: boolean; error?: string; enlace?: string | null; buena?: boolean }> {
  try {
    if (!UUID.test(token)) return { ok: false, error: 'Este enlace no es válido.' };
    if (!(await dentroDelLimite('resena', 10, 600))) return { ok: false, error: 'Demasiados intentos. Espera unos minutos.' };
    const { data, error } = await crearClienteAnonimo().rpc('rep_valorar', { p_token: token, p_puntuacion: Math.round(Number(puntuacion)), p_comentario: String(comentario ?? '').slice(0, 2000) });
    if (error) return { ok: false, error: ['23514', 'P0002'].includes(error.code ?? '') ? error.message : 'No se pudo guardar. Inténtalo de nuevo.' };
    const r = data as { buena: boolean; enlace: string | null };
    return { ok: true, buena: r.buena, enlace: r.enlace && /^https:\/\//.test(r.enlace) ? r.enlace : null };
  } catch {
    return { ok: false, error: 'No se pudo guardar. Inténtalo de nuevo.' };
  }
}
