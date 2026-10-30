import { CabeceraModulo } from '@/components/shell/CabeceraModulo';

export default async function LayoutOportunidades({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/subcuenta/${id}/oportunidades`;
  return (
    <>
      <CabeceraModulo
        titulo="Oportunidades"
        pestanas={[
          { href: base, texto: 'Oportunidades', exacto: true },
          { href: `${base}/embudos`, texto: 'Embudos' },
        ]}
      />
      {children}
    </>
  );
}
