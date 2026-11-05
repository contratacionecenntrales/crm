import { notFound } from 'next/navigation';
import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { Valorar } from '@/components/reputacion/Valorar';

export const metadata = { title: 'Tu opinión', robots: { index: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaResena({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const { data } = await crearClienteAnonimo().rpc('rep_pagina', { p_token: token });
  const p = data as { empresa: string; logo: string | null; valorada: boolean; puntuacion: number | null; nombre: string } | null;
  if (!p) notFound();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f2f4f7] px-4 py-10 font-sans text-[#101828]">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.logo && /^https?:\/\//.test(p.logo) && <img src={p.logo} alt="" className="mx-auto mb-4 h-12 w-auto object-contain" />}
        <Valorar token={token} empresa={p.empresa} nombre={p.nombre} yaValorada={p.valorada} />
      </div>
    </main>
  );
}
