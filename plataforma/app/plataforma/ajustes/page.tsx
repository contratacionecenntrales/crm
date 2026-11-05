import { crearClienteServidor } from '@/lib/supabase/server';
import { AjustesPlataforma } from '@/components/plataforma/Ajustes';

export const metadata = { title: 'Ajustes' };

export default async function PaginaAjustesPlataforma() {
  const supabase = await crearClienteServidor();
  const [{ data: a }, planes, admins, yo] = await Promise.all([
    supabase.from('plataforma_ajustes').select('*').eq('id', true).maybeSingle(),
    supabase.from('planes').select('id, nombre').order('orden'),
    supabase.rpc('plataforma_admins_lista'),
    supabase.auth.getUser(),
  ]);
  return (
    <div className="px-4 py-6 sm:px-6">
      <AjustesPlataforma ajustes={a as never} planes={(planes.data ?? []) as { id: string; nombre: string }[]}
        admins={(admins.data ?? []) as { usuario_id: string; email: string; rol: string; creado: string }[]} yo={yo.data.user?.id ?? ''} />
    </div>
  );
}
