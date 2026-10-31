import { CabeceraModulo } from '@/components/shell/CabeceraModulo';

export default async function LayoutAutomatizacion({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <CabeceraModulo titulo="Automatización" pestanas={[{ href: `/subcuenta/${id}/automatizacion`, texto: 'Flujos de trabajo' }]} />
      {children}
    </>
  );
}
