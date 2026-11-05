import { subcuentaVisible } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import { iaConfigurada } from '@/lib/ia/claude';
import { GestorAsistentes, type FilaAsistente } from '@/components/ia/GestorAsistentes';

export const metadata = { title: 'Asistentes IA' };

export default async function PaginaAsistentes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [{ data: asistentes, error }, { data: uso }, { data: incluye }, { data: cola }] = await Promise.all([
    supabase.from('ia_asistentes').select('id, nombre, instrucciones, conocimiento, canales, activo, max_respuestas, traspaso_palabras, mensaje_traspaso, actualizado').eq('subcuenta_id', id).order('creado'),
    supabase.from('ia_uso').select('dia, respuestas, tokens_entrada, tokens_salida').eq('subcuenta_id', id).gte('dia', desde),
    supabase.rpc('plan_incluye', { p_agencia: subcuenta.agencia_id, p_funcion: 'ia' }),
    supabase.from('ia_cola').select('estado, detalle, creado').eq('subcuenta_id', id).order('creado', { ascending: false }).limit(20),
  ]);
  if (error) throw new Error(error.message);
  const hoy = new Date().toISOString().slice(0, 10);
  const total = (uso ?? []).reduce((t, u) => ({ respuestas: t.respuestas + Number(u.respuestas), tokens: t.tokens + Number(u.tokens_entrada) + Number(u.tokens_salida) }), { respuestas: 0, tokens: 0 });
  return (
    <GestorAsistentes subId={id} asistentes={(asistentes ?? []) as FilaAsistente[]} soyAdmin={soyAdmin} planIncluye={incluye !== false} configurada={iaConfigurada()}
      uso={{ hoy: Number((uso ?? []).find((u) => u.dia === hoy)?.respuestas ?? 0), mes: total.respuestas, tokens: total.tokens }}
      actividad={(cola ?? []) as { estado: string; detalle: string; creado: string }[]} />
  );
}
