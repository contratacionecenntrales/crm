import { crearClienteServidor } from '@/lib/supabase/server';
import { esAdminAgencia, exigirAgencia } from '@/lib/sesion';
import { Equipo } from '@/components/ui/Equipo';
import { agregarMiembroAgencia, cambiarRolAgencia, quitarMiembroAgencia } from '../acciones';
import type { Miembro, RolAgencia } from '@/lib/tipos';

export const metadata = { title: 'Equipo de la agencia' };

const ROLES: { valor: RolAgencia; texto: string }[] = [
  { valor: 'propietario', texto: 'Propietario' },
  { valor: 'admin', texto: 'Administrador' },
  { valor: 'usuario', texto: 'Usuario' },
];

export default async function PaginaEquipo() {
  const { actual, usuario } = await exigirAgencia();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc('miembros_agencia', { p_agencia: actual.agencia.id });
  if (error) throw new Error(error.message);
  const admin = esAdminAgencia(actual.rol);
  // Solo un propietario ofrece el rol de propietario.
  const roles = actual.rol === 'propietario' ? ROLES : ROLES.filter((r) => r.valor !== 'propietario');

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold">Equipo de la agencia</h1>
      <p className="mt-1 text-sm text-tenue">
        Propietarios y administradores ven todas las subcuentas. Los usuarios solo ven las subcuentas a las que se les da acceso.
      </p>
      <div className="mt-5">
        <Equipo
          miembros={(data ?? []) as Miembro<RolAgencia>[]}
          roles={roles}
          yo={usuario.id}
          puedeGestionar={admin}
          agregar={agregarMiembroAgencia}
          cambiarRol={cambiarRolAgencia}
          quitar={quitarMiembroAgencia}
        />
      </div>
    </div>
  );
}
