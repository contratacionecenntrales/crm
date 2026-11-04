import { exigirAgencia } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import { UsoMultimedia, type FilaUso } from '@/components/ajustes/UsoMultimedia';

export const metadata = { title: 'Uso del almacenamiento de contenido multimedia' };

export default async function PaginaUsoMultimedia() {
  const { actual } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('uso_medios_agencia', { p_agencia: actual.agencia.id });
  if (error) throw new Error(error.message);
  const filas = ((data ?? []) as FilaUso[]).map((f) => ({ ...f, bytes: Number(f.bytes), archivos: Number(f.archivos) }));
  return <div className="px-4 py-6 sm:px-6"><UsoMultimedia filas={filas} /></div>;
}
