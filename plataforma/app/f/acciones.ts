'use server';
import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { dentroDelLimite } from '@/lib/red/limite';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Formulario de una página pública de embudo (sin sesión).
export async function enviarFormularioEmbudo(pasoId: string, bloqueId: string, datos: Record<string, string>, trampa = ''): Promise<{ ok: boolean; error?: string }> {
  try {
    if (trampa) return { ok: true }; // campo oculto relleno: es un bot (no se le avisa)
    if (!(await dentroDelLimite('form', 5, 600))) return { ok: false, error: 'Has enviado varios formularios seguidos. Espera unos minutos.' };
    if (!UUID.test(pasoId) || !/^[a-z0-9_-]{1,40}$/i.test(bloqueId)) return { ok: false, error: 'Formulario no válido.' };
    const limpio = Object.fromEntries(Object.entries(datos ?? {}).slice(0, 15)
      .filter(([k]) => /^[a-z][a-z0-9_]{0,39}$/.test(k)).map(([k, v]) => [k, String(v ?? '').slice(0, 2000)]));
    const { error } = await crearClienteAnonimo().rpc('emb_enviar_formulario', { p_paso: pasoId, p_bloque: bloqueId, p_datos: limpio });
    if (error) return { ok: false, error: ['23514', 'P0002'].includes(error.code ?? '') ? error.message : 'No se pudo enviar. Inténtalo de nuevo.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo enviar. Inténtalo de nuevo.' };
  }
}

export async function registrarVisitaEmbudo(pasoId: string): Promise<void> {
  if (!UUID.test(pasoId) || !(await dentroDelLimite('visita', 60, 600))) return;
  try { await crearClienteAnonimo().rpc('emb_registrar_visita', { p_paso: pasoId }); } catch { /* no bloquea la página */ }
}
