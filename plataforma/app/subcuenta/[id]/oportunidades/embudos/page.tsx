import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { embudosDe } from '@/lib/crm/datos';
import { GestorEmbudos } from '@/components/crm/GestorEmbudos';

export const metadata = { title: 'Embudos' };

export default async function PaginaEmbudos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ embudo?: string }> }) {
  const { id } = await params;
  const { embudo } = await searchParams;
  const { soyAdmin } = await subcuentaVisible(id);
  const embudos = await embudosDe(id);
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('crm_oportunidades').select('etapa_id').eq('subcuenta_id', id).limit(20000);
  const porEtapa: Record<string, number> = {};
  for (const o of data ?? []) porEtapa[o.etapa_id] = (porEtapa[o.etapa_id] ?? 0) + 1;
  return <GestorEmbudos subId={id} embudos={embudos} porEtapa={porEtapa} inicial={embudo} soyAdmin={soyAdmin} />;
}
