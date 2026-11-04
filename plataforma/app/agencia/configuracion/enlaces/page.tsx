import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { GestorEnlaces } from '@/components/ajustes/GestorEnlaces';
import type { EnlaceMenu } from '@/lib/menu/enlaces';

export const metadata = { title: 'Enlaces de menú personalizados' };

export default async function PaginaEnlaces() {
  const { actual } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const [{ data, error }, subs] = await Promise.all([
    supabase.from('menu_enlaces').select('id, nombre, url, icono, modo, en_agencia, en_subcuentas, subcuentas, orden')
      .eq('agencia_id', actual.agencia.id).order('orden').order('creado'),
    supabase.from('subcuentas').select('id, nombre').eq('agencia_id', actual.agencia.id).order('nombre'),
  ]);
  if (error) throw new Error(error.message);
  return (
    <div className="px-4 py-6 sm:px-6">
      <GestorEnlaces enlaces={(data ?? []) as EnlaceMenu[]} subcuentas={(subs.data ?? []) as { id: string; nombre: string }[]} />
    </div>
  );
}
