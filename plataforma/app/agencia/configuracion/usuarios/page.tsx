import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { TablaUsuarios, type FilaUsuario } from '@/components/ajustes/TablaUsuarios';

export const metadata = { title: 'Usuarios' };

export default async function PaginaUsuarios() {
  const { actual, usuario } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const [{ data, error }, subs] = await Promise.all([
    supabase.rpc('usuarios_de_agencia', { p_agencia: actual.agencia.id }),
    supabase.from('subcuentas').select('id, nombre').eq('agencia_id', actual.agencia.id).order('nombre'),
  ]);
  if (error) throw new Error(error.message);
  return (
    <div className="px-4 py-6 sm:px-6">
      <TablaUsuarios filas={(data ?? []) as FilaUsuario[]} subcuentas={(subs.data ?? []) as { id: string; nombre: string }[]}
        yo={usuario.id} soyPropietario={actual.rol === 'propietario'} />
    </div>
  );
}
