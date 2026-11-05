import { subcuentaVisible } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import { etiquetasDe } from '@/lib/crm/datos';
import { Campanas, type FilaCampana } from '@/components/marketing/Campanas';

export const metadata = { title: 'Marketing' };

export default async function PaginaMarketing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [{ data, error }, { data: resumen }, etiquetas] = await Promise.all([
    supabase.from('mkt_campanas').select('id, nombre, canal, asunto, cuerpo, etiquetas, modo, excluir, estado, programada_en, lanzada_en, terminada_en, creado').eq('subcuenta_id', id).order('creado', { ascending: false }).limit(200),
    supabase.rpc('mkt_resumen', { p_subcuenta: id }),
    etiquetasDe(id),
  ]);
  if (error) throw new Error(error.message);
  const porCampana = new Map(((resumen ?? []) as { campana_id: string }[]).map((r) => [r.campana_id, r]));
  const filas = (data ?? []).map((c) => ({ ...c, stats: porCampana.get(c.id as string) ?? null })) as FilaCampana[];
  return <Campanas subId={id} campanas={filas} etiquetas={etiquetas} soyAdmin={soyAdmin} />;
}
