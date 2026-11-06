import { notFound } from 'next/navigation';
import { subcuentaVisible } from '@/lib/sesion';
import { siteUrl } from '@/lib/env';
import { crearClienteServidor } from '@/lib/supabase/server';
import { DetalleEmbudo, type PasoResumen } from '@/components/embudos/DetalleEmbudo';

export const metadata = { title: 'Embudo' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEmbudo({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const { id, eid } = await params;
  if (!UUID.test(eid)) notFound();
  await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const { data: embudo } = await supabase.from('emb_embudos').select('id, nombre, slug, publicado, plantilla, creado, actualizado, tipo, config').eq('id', eid).eq('subcuenta_id', id).maybeSingle();
  if (!embudo) notFound();
  const [{ data: pasos }, { data: est }] = await Promise.all([
    supabase.from('emb_pasos').select('id, nombre, ruta, orden, publicado_en, actualizado, seo_titulo, seo_descripcion').eq('embudo_id', eid).order('orden'),
    supabase.from('emb_estadisticas').select('paso_id, visitas, envios').eq('subcuenta_id', id).gte('dia', desde),
  ]);
  const tot = new Map<string, { visitas: number; envios: number }>();
  for (const e of est ?? []) {
    const t = tot.get(e.paso_id as string) ?? { visitas: 0, envios: 0 };
    t.visitas += e.visitas as number; t.envios += e.envios as number;
    tot.set(e.paso_id as string, t);
  }
  const lista = (pasos ?? []).map((p) => ({ ...p, ...(tot.get(p.id as string) ?? { visitas: 0, envios: 0 }) })) as PasoResumen[];
  return <DetalleEmbudo subId={id} embudo={embudo as never} pasos={lista} sitio={siteUrl()} />;
}
