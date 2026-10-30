import { CabeceraModulo } from '@/components/shell/CabeceraModulo';

export default async function LayoutCalendarios({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/subcuenta/${id}/calendarios`;
  return (
    <>
      <CabeceraModulo
        titulo="Calendarios"
        pestanas={[
          { href: base, texto: 'Vista de calendario', exacto: true },
          { href: `${base}/citas`, texto: 'Vista de lista de citas' },
          { href: `${base}/configuracion`, texto: 'Configuración del calendario', separada: true, engranaje: true },
        ]}
      />
      {children}
    </>
  );
}
