import { subcuentaVisible } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import { ListaEmbudos, type EmbudoResumen } from '@/components/embudos/ListaEmbudos';

export const metadata = { title: 'Embudos' };

export default async function PaginaEmbudos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subcuenta } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [{ data: embudos, error }, { data: pasos }, { data: est }, { data: incluye }] = await Promise.all([
    supabase.from('emb_embudos').select('id, nombre, slug, publicado, creado, actualizado').eq('subcuenta_id', id).order('creado', { ascending: false }),
    supabase.from('emb_pasos').select('id, embudo_id').eq('subcuenta_id', id),
    supabase.from('emb_estadisticas').select('paso_id, visitas, envios').eq('subcuenta_id', id).gte('dia', desde),
    supabase.rpc('plan_incluye', { p_agencia: subcuenta.agencia_id, p_funcion: 'embudos' }),
  ]);
  if (error) throw new Error(error.message);
  const embudoDe = new Map((pasos ?? []).map((p) => [p.id as string, p.embudo_id as string]));
  const tot = new Map<string, { visitas: number; envios: number; pasos: number }>();
  for (const p of pasos ?? []) { const t = tot.get(p.embudo_id as string) ?? { visitas: 0, envios: 0, pasos: 0 }; t.pasos++; tot.set(p.embudo_id as string, t); }
  for (const e of est ?? []) { const eid = embudoDe.get(e.paso_id as string); if (!eid) continue; const t = tot.get(eid)!; t.visitas += e.visitas as number; t.envios += e.envios as number; }
  const lista = (embudos ?? []).map((e) => ({ ...e, ...(tot.get(e.id as string) ?? { visitas: 0, envios: 0, pasos: 0 }) })) as EmbudoResumen[];
  return <ListaEmbudos subId={id} embudos={lista} planIncluye={incluye !== false} />;
}
