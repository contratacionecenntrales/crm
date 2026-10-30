import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe, embudosDe, monedaDe } from '@/lib/crm/datos';
import { BarrasValor, BotonPeriodo, EmbudoTabla, Indicador, Rosco, SelectorUrl } from '@/components/crm/GraficosTablero';
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

function Tarjeta({ titulo, control, children, pie, actualizado, clase = '' }: {
  titulo: string; control?: React.ReactNode; children: React.ReactNode; pie?: React.ReactNode; actualizado: string; clase?: string;
}) {
  return (
    <section className={`flex min-h-[416px] flex-col rounded-lg border border-borde bg-superficie ${clase}`}>
      <header className="border-b border-borde p-4">
        <h2 className="text-base font-semibold leading-6 text-texto">{titulo}</h2>
        <p className="mt-0.5 text-xs leading-[17px] text-texto">(Actualizado el {actualizado})</p>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {control}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      {pie && <div className="px-4 pb-4 text-center">{pie}</div>}
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

  const actualizado = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: subcuenta.zona_horaria }).format(new Date());
  const pieValor = (t: string, v: number) => (
    <>
      <p className="text-xs text-tenue">{t}</p>
      <p className="text-xl text-texto">{dinero(v, moneda)}</p>
    </>
  );

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="inline-flex h-9 items-center rounded-lg border border-borde-fuerte bg-superficie px-3.5 text-sm font-semibold text-texto-2 shadow-xs">Dashboard</span>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href={`/subcuenta/${id}?${new URLSearchParams(sp as Record<string, string>).toString()}`} aria-label="Actualizar" title="Actualizar"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-borde-fuerte bg-superficie text-texto-2 shadow-xs hover:bg-superficie-2">
            <RefreshCw className="size-5" strokeWidth={1.75} />
          </Link>
          <BotonPeriodo valor={r} opciones={RANGOS} />
        </div>
      </div>
      <p className="mb-4 mt-3 text-sm font-semibold text-[#84adff]">Filtros rápidos · <span className="font-normal text-tenue">oportunidades creadas en el periodo</span></p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Tarjeta clase="lg:col-span-5" titulo="Estado de Oportunidad" actualizado={actualizado}
          control={<SelectorUrl param="ee" valor={embEstado} etiqueta="Embudo" opciones={[{ valor: '', texto: 'Todas las secuencias' }, ...opcionesEmbudo]} />}>
          <Rosco datos={[
            { nombre: 'Abierto', n: d.estado.abierta, color: '#53b1fd' }, { nombre: 'Ganado', n: d.estado.ganada, color: '#32d583' },
            { nombre: 'Perdido', n: d.estado.perdida, color: '#f97066' }, { nombre: 'Abandonado', n: d.estado.abandonada, color: '#98a2b3' },
          ]} />
        </Tarjeta>
        <Tarjeta clase="lg:col-span-4" titulo="Valor de Oportunidad" actualizado={actualizado} pie={pieValor('Ingresos totales', d.valor.total)}>
          <BarrasValor moneda={moneda} datos={[
            { nombre: 'Abierto', valor: Number(d.valor.abierta), color: '#53b1fd' }, { nombre: 'Ganado', valor: Number(d.valor.ganada), color: '#32d583' },
            { nombre: 'Perdido', valor: Number(d.valor.perdida), color: '#f97066' }, { nombre: 'Abandonado', valor: Number(d.valor.abandonada), color: '#98a2b3' },
          ]} />
        </Tarjeta>
        <Tarjeta clase="lg:col-span-3" titulo="Tasa de conversión" actualizado={actualizado} pie={pieValor('Ingresos ganados', d.conversion.ingresos_ganados)}>
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <Indicador porcentaje={tasa} />
            <span className="text-xs text-tenue">{d.conversion.ganadas} ganadas de {d.conversion.total}</span>
          </div>
        </Tarjeta>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Embudo" actualizado={actualizado} control={<SelectorUrl param="eg" valor={embEtapas} etiqueta="Embudo" opciones={opcionesEmbudo} />}>
          <EmbudoTabla datos={d.embudo} moneda={moneda} />
        </Tarjeta>
        <Tarjeta titulo="Distribución de etapas" actualizado={actualizado} control={<SelectorUrl param="eg" valor={embEtapas} etiqueta="Embudo" opciones={opcionesEmbudo} />}>
          <Rosco datos={d.etapas.map((e) => ({ nombre: e.etapa, n: e.n, valor: e.valor }))} moneda={moneda} />
        </Tarjeta>
      </div>

      <section className="mt-4 rounded-lg border border-borde bg-superficie">
        <header className="flex items-center justify-between border-b border-borde p-4">
          <div>
            <h2 className="text-base font-semibold text-texto">Tareas</h2>
            <p className="mt-0.5 text-xs text-texto">Pendiente · Fecha de vencimiento (ASC) · Todos los usuarios</p>
          </div>
          <Link href={`/subcuenta/${id}/contactos/tareas`} className="text-sm font-semibold text-primario-texto hover:underline">Ver todas</Link>
        </header>
        <ul className="divide-y divide-borde">
          {(tareas.data ?? []).length === 0 && <li className="px-4 py-8 text-center text-sm text-tenue">No hay tareas pendientes.</li>}
          {((tareas.data ?? []) as unknown as Tarea[]).map((t) => {
            const atrasada = t.vence && new Date(t.vence) < new Date();
            const u = asignables.find((x) => x.usuario_id === t.asignado_id);
            return (
              <li key={t.id} className="px-4 py-3 text-sm">
                <p className="font-medium text-texto">{t.titulo}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-tenue">
                  {t.vence && <span className={atrasada ? 'text-peligro' : ''}>{atrasada ? 'Atrasado' : 'Vence'} - {new Intl.DateTimeFormat('en-US', { timeZone: subcuenta.zona_horaria }).format(new Date(t.vence))}</span>}
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
