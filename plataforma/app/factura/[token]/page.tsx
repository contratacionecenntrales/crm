import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { VistaFactura, type FacturaPublica } from './VistaFactura';

export const metadata = { title: 'Factura', robots: { index: false } };

export default async function PaginaFactura({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ pagado?: string }> }) {
  const { token } = await params;
  const { pagado } = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) notFound();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('pag_factura_publica', { p_token: token });
  if (!data) notFound();
  return (
    <main className="flex min-h-dvh justify-center bg-fondo px-4 py-8 font-sans print:bg-white print:p-0 md:py-12">
      <VistaFactura token={token} f={data as FacturaPublica} vuelveDePagar={pagado === '1'} />
    </main>
  );
}
