import { crearClienteServidor } from '@/lib/supabase/server';
import { AjustesPlataforma } from '@/components/plataforma/Ajustes';
import { iaConfigurada } from '@/lib/ia/claude';

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
      <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${iaConfigurada() ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}`}>
        {iaConfigurada() ? 'IA conectada: los asistentes y el paso «Mensaje con IA» funcionan en las agencias cuyo plan incluye IA.' : 'IA sin conectar: añade ANTHROPIC_API_KEY en las variables del servidor para activar los asistentes con IA.'}
      </p>
      <AjustesPlataforma ajustes={a as never} planes={(planes.data ?? []) as { id: string; nombre: string }[]}
        admins={(admins.data ?? []) as { usuario_id: string; email: string; rol: string; creado: string }[]} yo={yo.data.user?.id ?? ''} />
    </div>
  );
}
