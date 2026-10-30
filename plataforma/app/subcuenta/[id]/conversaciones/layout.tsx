import { CabeceraModulo } from '@/components/shell/CabeceraModulo';

export default async function LayoutConversaciones({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/subcuenta/${id}/conversaciones`;
  return (
    <>
      <CabeceraModulo
        titulo="Conversaciones"
        pestanas={[
          { href: base, texto: 'Conversaciones', exacto: true },
          { href: `${base}/fragmentos`, texto: 'Fragmentos' },
          { href: `${base}/analitica`, texto: 'Analítica' },
          { href: `/subcuenta/${id}/configuracion/telefonia`, texto: 'Configuración' },
        ]}
      />
      {children}
    </>
  );
}
