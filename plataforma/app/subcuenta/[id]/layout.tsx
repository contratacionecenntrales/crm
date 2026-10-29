import { Panel } from '@/components/shell/Panel';
import { subcuentaVisible } from '@/lib/sesion';
import { direccionCompleta } from '@/lib/formato';
import type { ElementoNav } from '@/components/shell/iconos';

export default async function LayoutSubcuenta({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subcuenta } = await subcuentaVisible(id);
  const base = `/subcuenta/${id}`;
  // Cada módulo se añade aquí cuando está construido de verdad.
  const navegacion: ElementoNav[] = [
    { href: base, etiqueta: 'Tablero', icono: 'tablero', exacto: true },
    { href: `${base}/contactos`, etiqueta: 'Contactos', icono: 'contactos' },
    { href: `${base}/oportunidades`, etiqueta: 'Clientes Potenciales', icono: 'oportunidades' },
    { href: `${base}/configuracion`, etiqueta: 'Configuración', icono: 'ajustes' },
  ];
  return (
    <Panel
      navegacion={navegacion}
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
