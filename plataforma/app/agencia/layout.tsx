import { Panel } from '@/components/shell/Panel';
import { esAdminAgencia, exigirAgencia } from '@/lib/sesion';
import type { ElementoNav } from '@/components/shell/iconos';

export default async function LayoutAgencia({ children }: { children: React.ReactNode }) {
  const { actual } = await exigirAgencia();
  const admin = esAdminAgencia(actual.rol);
  const navegacion: ElementoNav[] = [
    ...(admin ? [{ href: '/agencia', etiqueta: 'Tablero de la agencia', icono: 'tablero', exacto: true } as const] : []),
    { href: '/agencia/subcuentas', etiqueta: 'Subcuentas', icono: 'subcuentas' },
    { href: '/agencia/equipo', etiqueta: 'Equipo', icono: 'equipo' },
    ...(admin ? [{ href: '/agencia/configuracion', etiqueta: 'Configuración', icono: 'ajustes' } as const] : []),
  ];
  return (
    <Panel navegacion={navegacion} subcuentaActual={null}>
      {children}
    </Panel>
  );
}
