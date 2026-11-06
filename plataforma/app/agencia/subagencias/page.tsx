import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { Subagencias, type FilaSubagencia } from '@/components/agencia/Subagencias';

export const metadata = { title: 'Subagencias' };

export default async function PaginaSubagencias() {
  const { actual, membresias } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const [{ data, error }, { data: nivel }, { data: incluye }] = await Promise.all([
    supabase.rpc('agencia_subagencias', { p_padre: actual.agencia.id }),
    supabase.rpc('agencia_nivel', { p_agencia: actual.agencia.id }),
    supabase.rpc('plan_incluye', { p_agencia: actual.agencia.id, p_funcion: 'subagencias' }),
  ]);
  if (error) throw new Error(error.message);
  const miembroDe = new Set(membresias.map((m) => m.agencia.id));
  const filas = ((data ?? []) as Omit<FilaSubagencia, 'acceso'>[]).map((f) => ({ ...f, acceso: miembroDe.has(f.id) }));
  return <Subagencias filas={filas} puedeCrear={incluye !== false && Number(nivel ?? 1) < 3} agencia={actual.agencia.nombre} />;
}
