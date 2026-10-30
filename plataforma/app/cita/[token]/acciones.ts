'use server';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Resultado } from '@/lib/tipos';

export async function cancelarCitaPublica(token: string, _: Resultado | null, fd: FormData): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: 'Enlace no válido.' };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('cal_cancelar_publico', { p_token: token, p_motivo: String(fd.get('motivo') ?? '').slice(0, 500) });
  if (error) return { ok: false, error: error.message };
  return data ? { ok: true, mensaje: 'Tu cita ha sido cancelada. Te hemos enviado la confirmación.' } : { ok: false, error: 'Esta cita ya no se puede cancelar.' };
}
