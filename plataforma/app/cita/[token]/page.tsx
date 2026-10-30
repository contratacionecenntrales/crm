import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { CancelarCita, type CitaPublica } from './CancelarCita';

export const metadata = { title: 'Tu cita', robots: { index: false } };

export default async function PaginaCita({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) notFound();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('cal_cita_publica', { p_token: token });
  if (!data) notFound();
  return (
    <main className="flex min-h-dvh justify-center bg-fondo px-4 py-10 font-sans md:py-16">
      <CancelarCita token={token} cita={data as CitaPublica} />
    </main>
  );
}
