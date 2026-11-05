import { redirect } from 'next/navigation';
import { MarcoPanel } from '@/components/shell/MarcoPanel';
import { MenuUsuario } from '@/components/shell/MenuUsuario';
import { crearClienteServidor } from '@/lib/supabase/server';
import { contextoAgencias, esAdminPlataforma, usuarioActual } from '@/lib/sesion';
import type { ElementoNav } from '@/components/shell/iconos';

export const metadata = { title: { default: 'Plataforma', template: '%s · Plataforma' } };

// Panel de la plataforma (Metatok): solo para sus administradores.
export default async function LayoutPlataforma({ children }: { children: React.ReactNode }) {
  if (!(await esAdminPlataforma())) redirect('/');
  const usuario = await usuarioActual();
  const { actual } = await contextoAgencias();
  const supabase = await crearClienteServidor();
  const { data: ajustes } = await supabase.from('plataforma_ajustes').select('nombre').eq('id', true).maybeSingle();
  const nombre = (ajustes?.nombre as string) ?? 'Metatok';
  const principal: ElementoNav[] = [
    { href: '/plataforma', etiqueta: 'Resumen', icono: 'tableroAgencia', exacto: true },
    { href: '/plataforma/agencias', etiqueta: 'Agencias', icono: 'empresas' },
    { href: '/plataforma/planes', etiqueta: 'Planes', icono: 'facturacion' },
  ];
  return (
    <MarcoPanel
      principal={principal}
      ajustes={{ href: '/plataforma/ajustes', etiqueta: 'Ajustes de la plataforma', icono: 'ajustes' }}
      logo={{ url: null, nombre }}
      selector={
        <a href={actual ? '/agencia' : '/plataforma'} className="flex h-11 w-full items-center gap-2 rounded-lg bg-gray-200 px-2 text-left text-[13px] font-medium text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100" title={actual ? 'Ir a mi agencia' : nombre}>
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primario text-xs font-bold text-white">{nombre[0]}</span>
          <span className="truncate">Plataforma {nombre}</span>
        </a>
      }
      herramientas={<span />}
      acciones={<MenuUsuario nombre={String(usuario.user_metadata?.nombre ?? '')} email={usuario.email ?? ''} />}
    >
      {children}
    </MarcoPanel>
  );
}
