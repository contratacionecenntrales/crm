import { subcuentaVisible } from '@/lib/sesion';
import { supabaseUrl } from '@/lib/env';
import { crearClienteServidor } from '@/lib/supabase/server';
import { GestorMedios } from '@/components/medios/GestorMedios';
import { urlPublicaMedio, type Medio } from '@/lib/medios';

export const metadata = { title: 'Medios' };

export default async function PaginaMedios({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [{ data, error }, usado] = await Promise.all([
    supabase.from('medios').select('id, ruta, nombre, carpeta, tipo, tamano, creado').eq('subcuenta_id', id).order('creado', { ascending: false }).limit(2000),
    supabase.rpc('medios_usado', { p_subcuenta: id }),
  ]);
  if (error) throw new Error(error.message);
  const base = supabaseUrl();
  const medios = (data ?? []).map((m) => ({ ...m, tamano: Number(m.tamano), url: urlPublicaMedio(base, m.ruta as string) })) as Medio[];
  return <GestorMedios subId={id} medios={medios} usado={Number(usado.data ?? 0)} />;
}
