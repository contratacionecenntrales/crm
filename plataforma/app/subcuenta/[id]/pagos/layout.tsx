import { CabeceraModulo } from '@/components/shell/CabeceraModulo';

export default async function LayoutPagos({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/subcuenta/${id}/pagos`;
  return (
    <>
      <CabeceraModulo
        titulo="Pagos"
        pestanas={[
          { href: base, texto: 'Facturas', exacto: true },
          { href: `${base}/productos`, texto: 'Productos' },
          { href: `${base}/transacciones`, texto: 'Transacciones' },
          { href: `${base}/configuracion`, texto: 'Configuración', separada: true, engranaje: true },
        ]}
      />
      {children}
    </>
  );
}
