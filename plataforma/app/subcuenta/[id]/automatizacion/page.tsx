import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { ListaFlujos, type FilaFlujo } from '@/components/automatizacion/ListaFlujos';

export const metadata = { title: 'Automatización' };

export default async function PaginaAutomatizacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [f, e] = await Promise.all([
    supabase.from('aut_flujos').select('id, nombre, activo, disparador, pasos, actualizado').eq('subcuenta_id', id).order('actualizado', { ascending: false }),
    supabase.from('aut_ejecuciones').select('flujo_id, estado, creado').eq('subcuenta_id', id).order('creado', { ascending: false }).limit(10000),
  ]);
  if (f.error) throw new Error(f.error.message);
  const stats = new Map<string, { total: number; activos: number; completados: number; ultima: string | null }>();
  for (const x of e.data ?? []) {
    const s = stats.get(x.flujo_id as string) ?? { total: 0, activos: 0, completados: 0, ultima: null };
    s.total++;
    if (['pendiente', 'esperando', 'procesando'].includes(x.estado as string)) s.activos++;
    if (x.estado === 'completada') s.completados++;
    s.ultima ??= x.creado as string;
    stats.set(x.flujo_id as string, s);
  }
  const filas: FilaFlujo[] = (f.data ?? []).map((x) => ({
    id: x.id as string, nombre: x.nombre as string, activo: x.activo as boolean, disparador: x.disparador as string,
    pasos: (x.pasos as unknown[]).length, actualizado: x.actualizado as string, ...(stats.get(x.id as string) ?? { total: 0, activos: 0, completados: 0, ultima: null }),
  }));
  return <ListaFlujos subId={id} flujos={filas} soyAdmin={soyAdmin} />;
}
