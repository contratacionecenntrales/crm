import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { CheckCircle2 } from 'lucide-react';

export const metadata = { title: 'Baja', robots: { index: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Página del enlace «darse de baja» de los correos de campaña.
export default async function PaginaBaja({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { token } = await params;
  const { ok } = await searchParams;
  const valido = UUID.test(token);
  async function confirmar() {
    'use server';
    if (!UUID.test(token)) return;
    await crearClienteAnonimo().rpc('mkt_baja', { p_token: token });
    const { redirect } = await import('next/navigation');
    redirect(`/baja/${token}?ok=1`);
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f2f4f7] px-4 font-sans text-[#101828]">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
        {!valido ? <p>Este enlace no es válido.</p> : ok ? (
          <>
            <CheckCircle2 className="mx-auto size-12 text-[#12b76a]" />
            <h1 className="mt-4 text-xl font-semibold">Listo, te hemos dado de baja</h1>
            <p className="mt-2 text-sm text-[#475467]">No volverás a recibir estos correos de promoción.</p>
          </>
        ) : (
          <form action={confirmar}>
            <h1 className="text-xl font-semibold">¿Quieres dejar de recibir estos correos?</h1>
            <p className="mt-2 text-sm text-[#475467]">Seguirás recibiendo los mensajes sobre tus citas o facturas.</p>
            <button className="mt-6 w-full rounded-lg bg-[#101828] px-5 py-3 font-semibold text-white">Darme de baja</button>
          </form>
        )}
      </div>
    </main>
  );
}
