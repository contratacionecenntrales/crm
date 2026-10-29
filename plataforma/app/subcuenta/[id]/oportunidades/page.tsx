import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe, embudosDe, monedaDe } from '@/lib/crm/datos';
import { escaparLike } from '@/lib/crm/filtros';
import { TableroOportunidades } from '@/components/crm/TableroOportunidades';
import type { Oportunidad } from '@/lib/crm/tipos';

export const metadata = { title: 'Oportunidades' };

export default async function PaginaOportunidades({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ embudo?: string; estado?: string; q?: string; vista?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { soyAdmin } = await subcuentaVisible(id);
  const [embudos, asignables, moneda] = await Promise.all([embudosDe(id), asignablesDe(id), monedaDe(id)]);
  const embudo = embudos.find((e) => e.id === sp.embudo) ?? embudos[0];
  if (!embudo) {
    return <p className="p-6 text-sm text-tenue">Esta subcuenta no tiene embudos. Crea uno en Oportunidades → Embudos.</p>;
  }
  const estado = ['ganada', 'perdida', 'abandonada', 'todas'].includes(sp.estado ?? '') ? sp.estado! : 'abierta';
  const supabase = await crearClienteServidor();
  let q = supabase
    .from('crm_oportunidades')
    .select('*, contacto:crm_contactos(id, nombre, apellidos, email, telefono)')
    .eq('embudo_id', embudo.id)
    .order('posicion')
    .limit(2000);
  if (estado !== 'todas') q = q.eq('estado', estado);
  if (sp.q?.trim()) q = q.ilike('nombre', `%${escaparLike(sp.q.trim())}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (
    <TableroOportunidades
      subId={id}
      embudos={embudos}
      embudoId={embudo.id}
      oportunidades={(data ?? []) as unknown as Oportunidad[]}
      asignables={asignables}
      moneda={moneda}
      estado={estado}
      busqueda={sp.q ?? ''}
      vista={sp.vista === 'lista' ? 'lista' : 'tablero'}
      soyAdmin={soyAdmin}
    />
  );
}
