import { Panel } from '@/components/shell/Panel';
import { esAdminAgencia, exigirAgencia } from '@/lib/sesion';
import type { ElementoNav } from '@/components/shell/iconos';

export default async function LayoutAgencia({ children }: { children: React.ReactNode }) {
  const { actual } = await exigirAgencia();
  const admin = esAdminAgencia(actual.rol);
  const principal: ElementoNav[] = [
    ...(admin ? [{ href: '/agencia', etiqueta: 'Tablero de la agencia', icono: 'tableroAgencia', exacto: true } as const] : []),
    { href: '/agencia/subcuentas', etiqueta: 'Subcuentas', icono: 'subcuentas' },
  ];
  const c = '/agencia/configuracion';
  const menuAjustes = {
    volver: '/agencia',
    prefijo: c,
    secciones: [{
      elementos: [
        { href: `${c}/perfil`, etiqueta: 'Mi perfil' },
        { href: `${c}/empresa`, etiqueta: 'Empresa' },
        { href: `${c}/usuarios`, etiqueta: 'Usuarios' },
        { href: `${c}/anuncios`, etiqueta: 'Anuncios', nueva: true },
        { href: `${c}/stripe`, etiqueta: 'Stripe' },
        { href: `${c}/auditoria`, etiqueta: 'Registros de auditoría' },
      ],
    }],
  };
  const ajustes: ElementoNav | undefined = admin ? { href: '/agencia/configuracion/empresa', etiqueta: 'Configuración', icono: 'ajustes', tambien: ['/agencia/configuracion'] } : undefined;

  return (
    <Panel principal={principal} ajustes={ajustes} menuAjustes={admin ? menuAjustes : undefined} subcuentaActual={null}>
      {children}
    </Panel>
  );
}
