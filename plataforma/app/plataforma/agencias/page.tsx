import { crearClienteServidor } from '@/lib/supabase/server';
import { AgenciasPlataforma, type FilaAgenciaPlataforma } from '@/components/plataforma/Agencias';

export const metadata = { title: 'Agencias' };

export default async function PaginaAgencias() {
  const supabase = await crearClienteServidor();
  const [{ data, error }, planes] = await Promise.all([
    supabase.rpc('plataforma_agencias'),
    supabase.from('planes').select('id, nombre, precio_mensual, moneda, activo').order('orden'),
  ]);
  if (error) throw new Error(error.message);
  return (
    <div className="px-4 py-6 sm:px-6">
      <AgenciasPlataforma agencias={(data ?? []) as FilaAgenciaPlataforma[]} planes={(planes.data ?? []) as { id: string; nombre: string; precio_mensual: number; moneda: string; activo: boolean }[]} />
    </div>
  );
}
