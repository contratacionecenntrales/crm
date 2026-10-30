import Link from 'next/link';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { GraficoMensajes } from '@/components/conversaciones/GraficoMensajes';

export const metadata = { title: 'Analítica de conversaciones' };

const PERIODOS = [7, 30, 90] as const;

export default async function PaginaAnalitica({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dias?: string }> }) {
  const { id } = await params;
  const { dias: d } = await searchParams;
  const dias = PERIODOS.find((p) => String(p) === d) ?? 30;
  await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();
  const [serie, abiertas, sinLeer, sinAsignar] = await Promise.all([
    supabase.rpc('conv_analitica', { p_subcuenta: id, p_dias: dias }),
    supabase.from('conv_conversaciones').select('id', { count: 'exact', head: true }).eq('subcuenta_id', id).eq('estado', 'abierta'),
    supabase.from('conv_conversaciones').select('id', { count: 'exact', head: true }).eq('subcuenta_id', id).gt('no_leidos', 0),
    supabase.from('conv_conversaciones').select('id', { count: 'exact', head: true }).eq('subcuenta_id', id).eq('estado', 'abierta').is('asignado_id', null),
  ]);
  if (serie.error) throw new Error(serie.error.message);
  const filas = (serie.data ?? []) as { dia: string; entrantes: number; salientes: number; fallidos: number }[];
  const suma = (k: 'entrantes' | 'salientes' | 'fallidos') => filas.reduce((a, f) => a + Number(f[k]), 0);
  const nuevas = await supabase.from('conv_conversaciones').select('id', { count: 'exact', head: true }).eq('subcuenta_id', id).gte('creado', desde);
  const kpis: [string, number][] = [
    ['Mensajes recibidos', suma('entrantes')], ['Mensajes enviados', suma('salientes')], ['Envíos fallidos', suma('fallidos')],
    ['Conversaciones nuevas', nuevas.count ?? 0], ['Abiertas', abiertas.count ?? 0], ['Sin leer', sinLeer.count ?? 0], ['Abiertas sin asignar', sinAsignar.count ?? 0],
  ];
  return (
    <div className="space-y-4 p-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-texto">Analítica</h2>
        <nav className="inline-flex rounded-lg border border-borde-fuerte bg-superficie p-0.5 shadow-xs" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <Link key={p} href={`?dias=${p}`} aria-current={p === dias ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${p === dias ? 'bg-primario-suave text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>
              Últimos {p} días
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {kpis.map(([t, n]) => (
          <div key={t} className="rounded-lg border border-borde bg-superficie p-4">
            <p className="text-sm text-tenue">{t}</p>
            <p className="mt-1 text-2xl font-semibold text-texto">{n.toLocaleString('es-ES')}</p>
          </div>
        ))}
      </div>
      <section className="rounded-lg border border-borde bg-superficie p-4">
        <h3 className="mb-4 text-base font-semibold text-texto">Mensajes por día</h3>
        <GraficoMensajes datos={filas.map((f) => ({ dia: f.dia, entrantes: Number(f.entrantes), salientes: Number(f.salientes), fallidos: Number(f.fallidos) }))} />
      </section>
    </div>
  );
}
