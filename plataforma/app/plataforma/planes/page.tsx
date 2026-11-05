import { crearClienteServidor } from '@/lib/supabase/server';
import { PlanesPlataforma, type Plan } from '@/components/plataforma/Planes';

export const metadata = { title: 'Planes' };

export default async function PaginaPlanes() {
  const supabase = await crearClienteServidor();
  const [{ data, error }, ags] = await Promise.all([
    supabase.from('planes').select('*').order('orden').order('precio_mensual'),
    supabase.rpc('plataforma_agencias'),
  ]);
  if (error) throw new Error(error.message);
  const uso = new Map<string, number>();
  for (const a of (ags.data ?? []) as { plan_id: string | null }[]) if (a.plan_id) uso.set(a.plan_id, (uso.get(a.plan_id) ?? 0) + 1);
  return <div className="px-4 py-6 sm:px-6"><PlanesPlataforma planes={((data ?? []) as Plan[]).map((p) => ({ ...p, precio_mensual: Number(p.precio_mensual), agencias: uso.get(p.id) ?? 0 }))} /></div>;
}
