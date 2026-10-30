import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible, usuarioActual } from '@/lib/sesion';
import { Equipo } from '@/components/ui/Equipo';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';
import { agregarMiembroSubcuenta, cambiarRolSubcuenta, quitarMiembroSubcuenta } from '../../acciones';
import type { Miembro, RolSubcuenta } from '@/lib/tipos';

export const metadata = { title: 'Usuarios' };

export default async function UsuariosSubcuenta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioActual();
  const { soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('miembros_subcuenta', { p_subcuenta: id });
  if (error) throw new Error(error.message);
  return (
    <ContenedorAjustes ancho="max-w-5xl">
      <TituloAjustes titulo="Usuarios" subtitulo="Personas con acceso a esta subcuenta. Los administradores de la agencia tienen acceso siempre." />
      <Equipo miembros={(data ?? []) as Miembro<RolSubcuenta>[]} roles={[{ valor: 'admin', texto: 'Administrador' }, { valor: 'usuario', texto: 'Usuario' }]}
        yo={usuario.id} puedeGestionar={soyAdmin} extra={{ subcuenta_id: id }} agregar={agregarMiembroSubcuenta}
        cambiarRol={cambiarRolSubcuenta.bind(null, id)} quitar={quitarMiembroSubcuenta.bind(null, id)} />
    </ContenedorAjustes>
  );
}
