import { Panel } from '@/components/shell/Panel';
import { subcuentaVisible } from '@/lib/sesion';
import { direccionCompleta } from '@/lib/formato';
import type { ElementoNav } from '@/components/shell/iconos';

export default async function LayoutSubcuenta({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subcuenta } = await subcuentaVisible(id);
  const base = `/subcuenta/${id}`;
  // Cada módulo se añade aquí cuando está construido de verdad.
  const principal: ElementoNav[] = [
    { href: `${base}/launchpad`, etiqueta: 'Launchpad', icono: 'launchpad' },
    { href: base, etiqueta: 'Tablero', icono: 'tablero', exacto: true },
    { href: `${base}/conversaciones`, etiqueta: 'Conversaciones', icono: 'conversaciones' },
    { href: `${base}/calendarios`, etiqueta: 'Calendarios', icono: 'calendarios' },
    { href: `${base}/contactos`, etiqueta: 'Contactos', icono: 'contactos', tambien: [`${base}/contacto/`] },
    { href: `${base}/oportunidades`, etiqueta: 'Clientes Potenciales', icono: 'oportunidades' },
    { href: `${base}/pagos`, etiqueta: 'Pagos', icono: 'facturacion' },
  ];
  const ajustes: ElementoNav = { href: `${base}/configuracion`, etiqueta: 'Configuración', icono: 'ajustes' };
  const c = `${base}/configuracion`;
  const menuAjustes = {
    volver: base,
    prefijo: c,
    secciones: [
      { titulo: 'Mi empresa', elementos: [
        { href: c, etiqueta: 'Perfil de empresa', exacto: true },
        { href: `${c}/usuarios`, etiqueta: 'Usuarios' },
        { href: `${c}/embudos`, etiqueta: 'Clientes Potenciales & Pipelines' },
      ] },
      { titulo: 'Servicios empresariales', elementos: [
        { href: `${c}/telefonia`, etiqueta: 'Integración telefónica' },
        { href: `${c}/correo`, etiqueta: 'Servicios de correo' },
      ] },
      { titulo: 'Otros ajustes', elementos: [
        { href: `${c}/campos`, etiqueta: 'Campos personalizados' },
        { href: `${c}/etiquetas`, etiqueta: 'Etiquetas' },
        { href: `${c}/perfil`, etiqueta: 'Mi perfil' },
      ] },
    ],
  };

  return (
    <Panel
      principal={principal}
      ajustes={ajustes}
      menuAjustes={menuAjustes}
      subcuentaActual={{
        id,
        nombre: subcuenta.nombre,
        detalle: direccionCompleta(subcuenta) || 'Subcuenta',
        logo_url: subcuenta.logo_url,
      }}
    >
      {children}
    </Panel>
  );
}
