import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { GestorAnuncios, type Anuncio } from '@/components/ajustes/GestorAnuncios';

export const metadata = { title: 'Avisos' };

export default async function PaginaAnuncios() {
  const { actual } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const [{ data, error }, subs] = await Promise.all([
    supabase.from('anuncios').select('*').eq('agencia_id', actual.agencia.id).order('creado', { ascending: false }),
    supabase.from('subcuentas').select('id, nombre').eq('agencia_id', actual.agencia.id).order('nombre'),
  ]);
  if (error) throw new Error(error.message);
  return (
    <div className="px-4 py-6 sm:px-6">
      <GestorAnuncios anuncios={(data ?? []) as Anuncio[]} subcuentas={(subs.data ?? []) as { id: string; nombre: string }[]} />
    </div>
  );
}
