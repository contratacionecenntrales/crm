import Link from 'next/link';
import { Building2, CircleDollarSign, PauseCircle, Sparkles, UserPlus, Users } from 'lucide-react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { dinero, fecha } from '@/lib/formato';
import { Insignia } from '@/components/ui/Insignia';
import type { FilaAgenciaPlataforma } from '@/components/plataforma/Agencias';

export const metadata = { title: 'Resumen' };

export default async function ResumenPlataforma() {
  const supabase = await crearClienteServidor();
  const [{ data: r }, { data: ags }] = await Promise.all([supabase.rpc('plataforma_resumen'), supabase.rpc('plataforma_agencias')]);
  const m = (r ?? {}) as Record<string, number>;
  const ultimas = ((ags ?? []) as FilaAgenciaPlataforma[]).slice(0, 8);
  const kpis = [
    [Building2, 'Agencias', m.agencias, `${m.activas ?? 0} operativas`],
    [Sparkles, 'En prueba', m.en_prueba, 'con fecha de fin'],
    [PauseCircle, 'Suspendidas o vencidas', m.suspendidas, 'sin acceso a sus subcuentas'],
    [Users, 'Subcuentas', m.subcuentas, `${m.contactos ?? 0} contactos en total`],
    [CircleDollarSign, 'MRR (agencias activas)', dinero(m.mrr ?? 0, 'EUR'), 'según el precio de su plan'],
    [UserPlus, 'Nuevas (30 días)', m.nuevas_30d, 'agencias dadas de alta'],
  ] as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 font-sans sm:px-6">
      <h1 className="text-[28px] font-medium leading-9 text-texto">Resumen de la plataforma</h1>
      <p className="mb-6 text-sm text-tenue">Todas las agencias que usan la plataforma, sus planes y su estado.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map(([I, t, v, s]) => (
          <div key={t} className="rounded-lg border border-borde bg-superficie p-5">
            <span className="flex size-10 items-center justify-center rounded-full bg-primario-suave text-primario"><I className="size-5" /></span>
            <p className="mt-3 text-sm text-tenue">{t}</p>
            <p className="text-2xl font-semibold text-texto">{v ?? 0}</p>
            <p className="text-xs text-tenue">{s}</p>
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-lg border border-borde bg-superficie">
        <header className="flex items-center justify-between border-b border-borde px-5 py-3">
          <h2 className="font-medium text-texto">Últimas agencias</h2>
          <Link href="/plataforma/agencias" className="text-sm font-medium text-primario-texto hover:underline">Ver todas</Link>
        </header>
        <ul className="divide-y divide-borde">
          {ultimas.length === 0 && <li className="px-5 py-8 text-center text-sm text-tenue">Aún no hay agencias. <Link href="/plataforma/agencias" className="text-primario-texto underline">Crea la primera</Link>.</li>}
          {ultimas.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span className="min-w-0 flex-1"><span className="font-medium text-texto">{a.nombre}</span> <span className="text-tenue">· {a.dueno_email ?? 'sin dueño'}</span></span>
              <span className="text-texto-2">{a.plan ?? 'Sin plan'}</span>
              <Insignia tono={a.estado === 'activa' ? 'verde' : a.estado === 'prueba' ? 'azul' : 'rojo'}>{a.estado}</Insignia>
              <span className="w-24 text-right text-xs text-tenue">{fecha(a.creado)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
