import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { Reserva, type InfoCalendario } from '@/components/calendario/Reserva';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ incrustado?: string }> };

async function info(slug: string): Promise<InfoCalendario | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('cal_publico', { p_slug: slug });
  return (data as InfoCalendario | null) ?? null;
}

export async function generateMetadata({ params }: Params) {
  const c = await info((await params).slug);
  return { title: c ? `${c.nombre} · ${c.empresa}` : 'Reservar cita', robots: { index: false } };
}

export default async function PaginaReserva({ params, searchParams }: Params) {
  const { slug } = await params;
  const { incrustado } = await searchParams;
  const c = await info(slug);
  if (!c) notFound();
  return (
    <main className={`flex min-h-dvh justify-center font-sans ${incrustado ? 'bg-transparent p-0' : 'bg-fondo px-4 py-8 md:py-14'}`}>
      <Reserva slug={slug} info={c} />
    </main>
  );
}
