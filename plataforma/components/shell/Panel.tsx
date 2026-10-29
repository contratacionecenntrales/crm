import 'server-only';
import { crearClienteServidor } from '@/lib/supabase/server';
import { contextoAgencias, esAdminAgencia, subcuentasVisibles, usuarioActual } from '@/lib/sesion';
import { direccionCompleta } from '@/lib/formato';
import { MarcoPanel } from './MarcoPanel';
import { SelectorSubcuenta } from './SelectorSubcuenta';
import { Campana } from './Campana';
import { MenuUsuario } from './MenuUsuario';
import type { ElementoNav } from './iconos';

interface Props {
  navegacion: ElementoNav[];
  // Subcuenta en la que se está, o null en la vista de agencia.
  subcuentaActual: { id: string; nombre: string; detalle: string; logo_url: string | null } | null;
  children: React.ReactNode;
}

export async function Panel({ navegacion, subcuentaActual, children }: Props) {
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  const [{ actual }, subs, avisos] = await Promise.all([
    contextoAgencias(),
    subcuentasVisibles(),
    supabase
      .from('notificaciones')
      .select('id, subcuenta_id, tipo, categoria, titulo, cuerpo, enlace, leida, creado, subcuentas(nombre)')
      .order('creado', { ascending: false })
      .limit(50),
  ]);

  const opciones = subs
    .filter((s) => !actual || s.agencia_id === actual.agencia.id || !esAdminAgencia(actual.rol))
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      direccion: direccionCompleta(s),
      logo_url: s.logo_url,
      fijada: s.fijada,
      suspendida: s.estado === 'suspendida',
    }));

  const cabecera = subcuentaActual ?? {
    nombre: actual?.agencia.nombre ?? 'Mi cuenta',
    detalle: 'Vista de agencia',
    logo_url: actual?.agencia.logo_url ?? null,
  };

  const nombre = String(usuario.user_metadata?.nombre ?? usuario.user_metadata?.full_name ?? '');

  return (
    <MarcoPanel
      navegacion={navegacion}
      selector={
        <SelectorSubcuenta
          subcuentas={opciones}
          actual={cabecera}
          vistaAgencia={Boolean(actual)}
          enAgencia={!subcuentaActual}
        />
      }
      acciones={
        <>
          <Campana usuarioId={usuario.id} iniciales={(avisos.data ?? []) as never} />
          <MenuUsuario nombre={nombre} email={usuario.email ?? ''} />
        </>
      }
    >
      {children}
    </MarcoPanel>
  );
}
