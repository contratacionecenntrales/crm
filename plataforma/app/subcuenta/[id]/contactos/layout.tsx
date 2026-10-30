import { CabeceraModulo } from '@/components/shell/CabeceraModulo';

export default async function LayoutContactos({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/subcuenta/${id}/contactos`;
  return (
    <>
      <CabeceraModulo
        titulo="Contactos"
        pestanas={[
          { href: base, texto: 'Listas inteligentes', exacto: true },
          { href: `${base}/acciones-lote`, texto: 'Acciones en lote' },
          { href: `${base}/campos`, texto: 'Campos personalizados' },
          { href: `${base}/tareas`, texto: 'Tareas' },
          { href: `${base}/empresas`, texto: 'Empresas' },
        ]}
      />
      {children}
    </>
  );
}
