import { PestanasRuta } from '@/components/crm/PestanasRuta';

export default async function LayoutContactos({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/subcuenta/${id}/contactos`;
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 border-b bg-superficie px-4 pt-4 sm:px-6">
        <h1 className="pb-3 text-2xl font-semibold">Contactos</h1>
        <PestanasRuta
          pestanas={[
            { href: base, texto: 'Listas inteligentes', exacto: true },
            { href: `${base}/acciones-lote`, texto: 'Acciones en lote' },
            { href: `${base}/campos`, texto: 'Campos personalizados' },
            { href: `${base}/tareas`, texto: 'Tareas' },
            { href: `${base}/empresas`, texto: 'Empresas' },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
