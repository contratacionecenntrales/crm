import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { escaparLike } from '@/lib/crm/filtros';
import { ListaEmpresas } from '@/components/crm/ListaEmpresas';
import type { Empresa } from '@/lib/crm/tipos';

export const metadata = { title: 'Empresas' };

export default async function PaginaEmpresas({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  const { q = '' } = await searchParams;
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  let consulta = supabase.from('crm_empresas').select('*, contactos:crm_contactos(count)').eq('subcuenta_id', id).order('nombre').limit(500);
  if (q.trim()) consulta = consulta.ilike('nombre', `%${escaparLike(q.trim())}%`);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const empresas = (data ?? []).map((e) => ({ ...(e as Empresa), n: (e.contactos as { count: number }[])?.[0]?.count ?? 0 }));
  return <ListaEmpresas subId={id} empresas={empresas} soyAdmin={soyAdmin} busqueda={q} />;
}
