import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe, embudosDe, monedaDe } from '@/lib/crm/datos';
import { Embudo, Rosco, SelectorUrl } from '@/components/crm/GraficosTablero';
import { dinero } from '@/lib/formato';
import { nombreContacto, type Tarea } from '@/lib/crm/tipos';

export const metadata = { title: 'Tablero' };

const RANGOS = [
  { valor: '7', texto: 'Últimos 7 días' }, { valor: '30', texto: 'Últimos 30 días' }, { valor: '90', texto: 'Últimos 90 días' },
  { valor: 'mes', texto: 'Este mes' }, { valor: 'mes_pasado', texto: 'Mes pasado' }, { valor: 'anio', texto: 'Este año' },
  { valor: 'todo', texto: 'Todo' },
];

function rango(r: string): [Date, Date] {
  const ahora = new Date();
  const fin = new Date(ahora.getTime() + 60_000);
  switch (r) {
    case '7': case '90': return [new Date(ahora.getTime() - Number(r) * 86_400_000), fin];
    case 'mes': return [new Date(ahora.getFullYear(), ahora.getMonth(), 1), fin];
    case 'mes_pasado': return [new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1), new Date(ahora.getFullYear(), ahora.getMonth(), 1)];
    case 'anio': return [new Date(ahora.getFullYear(), 0, 1), fin];
    case 'todo': return [new Date('2000-01-01'), fin];
    default: return [new Date(ahora.getTime() - 30 * 86_400_000), fin];
  }
}

interface Datos {
  estado: Record<'abierta' | 'ganada' | 'perdida' | 'abandonada', number>;
  valor: Record<'total' | 'abierta' | 'ganada' | 'perdida' | 'abandonada', number>;
  conversion: { total: number; ganadas: number; ingresos_ganados: number };
  embudo: { etapa: string; n: number; valor: number }[];
  etapas: { etapa: string; n: number; valor: number }[];
}

function Tarjeta({ titulo, control, children, pie }: { titulo: string; control?: React.ReactNode; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border bg-superficie shadow-sm">
      <header className="border-b px-5 py-4">
        <h2 className="text-lg">{titulo}</h2>
        <p className="text-sm text-tenue">(Actualizado el {new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())})</p>
      </header>
      {control && <div className="px-5 pt-4">{control}</div>}
      <div className="flex-1 p-5">{children}</div>
      {pie && <div className="px-5 pb-5 text-center">{pie}</div>}
    </section>
  );
}

export default async function TableroSubcuenta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string; ee?: string; eg?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { subcuenta } = await subcuentaVisible(id);
  const [embudos, asignables, moneda] = await Promise.all([embudosDe(id), asignablesDe(id), monedaDe(id)]);
  const r = RANGOS.some((x) => x.valor === sp.r) ? sp.r! : '30';
  const [desde, hasta] = rango(r);
  const embEstado = embudos.find((e) => e.id === sp.ee)?.id ?? '';
  const embEtapas = embudos.find((e) => e.id === sp.eg)?.id ?? embudos[0]?.id ?? '';

  const supabase = await crearClienteServidor();
  const [{ data, error }, tareas] = await Promise.all([
    supabase.rpc('crm_tablero', {
      p_subcuenta: id, p_desde: desde.toISOString(), p_hasta: hasta.toISOString(),
      p_embudo_estado: embEstado || null, p_embudo_etapas: embEtapas || null,
    }),
    supabase.from('crm_tareas')
      .select('id, titulo, vence, asignado_id, completada, contacto_id, descripcion, creado, contacto:crm_contactos(id, nombre, apellidos, email, telefono)')
      .eq('subcuenta_id', id).is('completada', null).order('vence', { ascending: true, nullsFirst: false }).limit(8),
  ]);
  if (error) throw new Error(error.message);
  const d = data as Datos;
  const tasa = d.conversion.total ? Math.round((d.conversion.ganadas / d.conversion.total) * 100) : 0;
  const opcionesEmbudo = embudos.map((e) => ({ valor: e.id, texto: e.nombre }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-semibold">Dashboard</h1>
        <SelectorUrl param="r" valor={r} opciones={RANGOS} etiqueta="Periodo" ancho="w-auto" />
        <Link href={`/subcuenta/${id}?${new URLSearchParams(sp as Record<string, string>).toString()}`} aria-label="Actualizar"
          className="rounded-lg border bg-superficie p-2 text-tenue hover:text-texto"><RefreshCw className="size-4" /></Link>
        <span className="text-sm text-tenue">Oportunidades creadas en el periodo · {subcuenta.nombre}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Estado de Oportunidad"
          control={<SelectorUrl param="ee" valor={embEstado} etiqueta="Embudo" opciones={[{ valor: '', texto: 'Todas las secuencias' }, ...opcionesEmbudo]} />}>
          <Rosco datos={[
            { nombre: 'Abiertas', n: d.estado.abierta, color: '#2e90fa' }, { nombre: 'Ganadas', n: d.estado.ganada, color: '#12b76a' },
            { nombre: 'Perdidas', n: d.estado.perdida, color: '#f04438' }, { nombre: 'Abandonadas', n: d.estado.abandonada, color: '#667085' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Valor de Oportunidad"
          pie={<><p className="text-sm text-tenue">Ingresos totales</p><p className="text-2xl">{dinero(d.valor.total, moneda)}</p></>}>
          <ul className="space-y-3 text-sm">
            {([['Abiertas', d.valor.abierta, '#2e90fa'], ['Ganadas', d.valor.ganada, '#12b76a'], ['Perdidas', d.valor.perdida, '#f04438'], ['Abandonadas', d.valor.abandonada, '#667085']] as const).map(([t, v, c]) => (
              <li key={t}>
                <div className="mb-1 flex justify-between"><span>{t}</span><span className="font-medium">{dinero(v, moneda)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-superficie-2">
                  <div className="h-full rounded-full" style={{ width: `${d.valor.total ? (Number(v) / Number(d.valor.total)) * 100 : 0}%`, background: c }} />
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Tasa de conversión"
          pie={<><p className="text-sm text-tenue">Ingresos ganados</p><p className="text-2xl">{dinero(d.conversion.ingresos_ganados, moneda)}</p></>}>
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6">
            <span className="text-5xl font-semibold text-primario">{tasa} %</span>
            <span className="text-sm text-tenue">{d.conversion.ganadas} ganadas de {d.conversion.total} oportunidades</span>
          </div>
        </Tarjeta>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Embudo" control={<SelectorUrl param="eg" valor={embEtapas} etiqueta="Embudo" opciones={opcionesEmbudo} />}>
          <Embudo datos={d.embudo} moneda={moneda} />
          <p className="mt-2 text-xs text-tenue">Oportunidades abiertas o ganadas que han llegado al menos a cada etapa.</p>
        </Tarjeta>
        <Tarjeta titulo="Distribución de etapas" control={<SelectorUrl param="eg" valor={embEtapas} etiqueta="Embudo" opciones={opcionesEmbudo} />}>
          <Rosco datos={d.etapas.map((e) => ({ nombre: e.etapa, n: e.n, valor: e.valor }))} moneda={moneda} />
        </Tarjeta>
      </div>

      <section className="mt-4 rounded-xl border bg-superficie shadow-sm">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg">Tareas <span className="text-sm text-tenue">· Pendiente · Fecha de vencimiento (ASC)</span></h2>
          <Link href={`/subcuenta/${id}/contactos/tareas`} className="text-sm text-primario hover:underline">Ver todas</Link>
        </header>
        <ul className="divide-y">
          {(tareas.data ?? []).length === 0 && <li className="px-5 py-8 text-center text-sm text-tenue">No hay tareas pendientes.</li>}
          {((tareas.data ?? []) as unknown as Tarea[]).map((t) => {
            const atrasada = t.vence && new Date(t.vence) < new Date();
            const u = asignables.find((x) => x.usuario_id === t.asignado_id);
            return (
              <li key={t.id} className="px-5 py-3 text-sm">
                <p className="font-medium">{t.titulo}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-tenue">
                  {t.vence && <span className={atrasada ? 'text-peligro' : ''}>{atrasada ? 'Atrasado' : 'Vence'} - {new Intl.DateTimeFormat('es-ES', { timeZone: subcuenta.zona_horaria }).format(new Date(t.vence))}</span>}
                  <span>Asignado a: {u ? u.nombre || u.email : 'Sin asignar'}</span>
                  {t.contacto && <Link href={`/subcuenta/${id}/contacto/${t.contacto.id}`} className="text-primario hover:underline">{nombreContacto(t.contacto)}</Link>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
