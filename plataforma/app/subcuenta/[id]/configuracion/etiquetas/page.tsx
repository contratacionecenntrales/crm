import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { GestorEtiquetas, type FilaEtiqueta } from '@/components/ajustes/GestorEtiquetas';
import { ContenedorAjustes } from '@/components/ajustes/Piezas';

export const metadata = { title: 'Etiquetas' };

export default async function Etiquetas({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = 'etiquetas' } = await searchParams;
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [{ data, error }, uso] = await Promise.all([
    supabase.from('crm_etiquetas').select('nombre, descripcion, categoria, creado').eq('subcuenta_id', id).order('nombre'),
    supabase.from('crm_contactos').select('etiquetas').eq('subcuenta_id', id).neq('etiquetas', '{}').limit(50000),
  ]);
  if (error) throw new Error(error.message);
  const cuenta = new Map<string, number>();
  for (const c of uso.data ?? []) for (const e of c.etiquetas as string[]) cuenta.set(e, (cuenta.get(e) ?? 0) + 1);
  const filas = ((data ?? []) as Omit<FilaEtiqueta, 'contactos'>[]).map((e) => ({ ...e, contactos: cuenta.get(e.nombre) ?? 0 }));
  return (
    <ContenedorAjustes ancho="max-w-6xl">
      <GestorEtiquetas subId={id} etiquetas={filas} soyAdmin={soyAdmin} pestana={tab === 'categorias' ? 'categorias' : 'etiquetas'} />
    </ContenedorAjustes>
  );
}
