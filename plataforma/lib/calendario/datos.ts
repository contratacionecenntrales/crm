import 'server-only';
import { cache } from 'react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { COLUMNAS_CALENDARIO, type Calendario, type Franja } from './tipos';

export const calendariosDe = cache(async (subcuentaId: string): Promise<Calendario[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('cal_calendarios').select(COLUMNAS_CALENDARIO)
    .eq('subcuenta_id', subcuentaId).order('nombre');
  if (error) throw new Error(error.message);
  return (data ?? []) as Calendario[];
});

export async function horarioDe(calId: string): Promise<Franja[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('cal_horarios').select('dia, inicio, fin').eq('calendario_id', calId).order('dia').order('inicio');
  if (error) throw new Error(error.message);
  // Postgres devuelve "09:00:00" y "24:00:00".
  return (data ?? []).map((f) => ({ dia: f.dia as number, inicio: String(f.inicio).slice(0, 5), fin: String(f.fin).slice(0, 5) }));
}
