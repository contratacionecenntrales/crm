import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { GestorProductos } from '@/components/pagos/Productos';
import type { Producto } from '@/lib/pagos/tipos';

export const metadata = { title: 'Productos' };

export default async function PaginaProductos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [p, a] = await Promise.all([
    supabase.from('pag_productos').select('id, nombre, descripcion, precio, impuesto, activo').eq('subcuenta_id', id).order('nombre').limit(1000),
    supabase.from('pag_ajustes').select('moneda, impuesto_defecto').eq('subcuenta_id', id).maybeSingle(),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 font-sans">
      <GestorProductos subId={id} productos={(p.data ?? []) as Producto[]} moneda={(a.data?.moneda as string) || 'EUR'} impuesto={Number(a.data?.impuesto_defecto ?? 21)} />
    </div>
  );
}
