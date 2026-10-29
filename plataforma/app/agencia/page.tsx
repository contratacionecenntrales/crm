import { DollarSign, Info, RefreshCcw, UserPlus, Users } from 'lucide-react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { dinero, haceCuanto } from '@/lib/formato';
import { TarjetaKpi } from '@/components/agencia/TarjetaKpi';
import { GraficoCrecimiento, GraficoDistribucion } from '@/components/agencia/Graficos';
import type { Metricas } from '@/lib/tipos';

export const metadata = { title: 'Tablero de la agencia' };

const ACCIONES: Record<string, string> = {
  'subcuentas.insert': 'Subcuenta creada',
  'subcuentas.update': 'Subcuenta modificada',
  'subcuentas.delete': 'Subcuenta eliminada',
  'subcuenta_miembros.insert': 'Acceso concedido a una subcuenta',
  'subcuenta_miembros.update': 'Rol cambiado en una subcuenta',
  'subcuenta_miembros.delete': 'Acceso retirado de una subcuenta',
  'agencia_miembros.insert': 'Usuario añadido a la agencia',
  'agencia_miembros.update': 'Rol de agencia cambiado',
  'agencia_miembros.delete': 'Usuario retirado de la agencia',
  'suscripciones.insert': 'Plan asignado',
  'suscripciones.update': 'Plan modificado',
  'suscripciones.delete': 'Plan eliminado',
};

export default async function TableroAgencia() {
  const { actual } = await exigirAgencia({ admin: true });
  const supabase = await crearClienteServidor();
  const [{ data, error }, actividad] = await Promise.all([
    supabase.rpc('metricas_agencia', { p_agencia: actual.agencia.id, p_meses: 7 }),
    supabase
      .from('actividad')
      .select('id, accion, detalle, ts')
      .eq('agencia_id', actual.agencia.id)
      .order('ts', { ascending: false })
      .limit(8),
  ]);
  if (error) throw new Error(error.message);
  const m = data as Metricas;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex items-end gap-6 border-b">
        <h1 className="pb-3 text-2xl font-semibold sm:text-3xl">Tablero de la agencia</h1>
        <span className="border-b-2 border-primario pb-3 text-sm font-medium text-primario">Resumen</span>
      </div>

      <h2 className="mt-6 text-lg text-texto">Visión general de ingresos y clientes</h2>
      <p className="mt-3 flex gap-2 rounded-xl border border-blue-300 bg-primario-suave px-4 py-3 text-sm text-primario">
        <Info className="mt-0.5 size-4 shrink-0" />
        El MRR suma las suscripciones activas o impagadas de tus subcuentas. Los ingresos son los pagos registrados a mano o recibidos desde Stripe.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaKpi icono={<DollarSign className="size-5" />} titulo="Ingresos totales del último mes" valor={dinero(m.ingresos_30d, m.moneda)}
          ayuda="Suma de los pagos de los últimos 30 días." />
        <TarjetaKpi icono={<RefreshCcw className="size-5" />} titulo="Ingresos recurrentes mensuales" valor={dinero(m.mrr, m.moneda)}
          ayuda="Suma de los importes mensuales de las suscripciones activas o impagadas." />
        <TarjetaKpi icono={<UserPlus className="size-5" />} titulo="Nuevos clientes" valor={String(m.nuevos_30d)}
          ayuda="Subcuentas creadas en los últimos 30 días." />
        <TarjetaKpi icono={<Users className="size-5" />} titulo="Total de clientes" valor={String(m.total_clientes)}
          ayuda="Subcuentas activas (no suspendidas)." />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-superficie shadow-sm">
          <h3 className="flex items-center gap-2 border-b px-5 py-4 font-semibold">
            Tasa de crecimiento
            <span title="Evolución de los últimos 7 meses: subcuentas nuevas por mes, MRR a cierre de mes e ingresos cobrados." className="text-tenue">
              <Info className="size-4" />
            </span>
          </h3>
          <div className="p-4">
            <GraficoCrecimiento serie={m.serie} moneda={m.moneda} />
          </div>
        </section>
        <section className="rounded-xl border bg-superficie shadow-sm">
          <h3 className="flex items-center justify-between gap-2 border-b px-5 py-4 font-semibold">
            Distribución de ingresos del mes pasado
            <span title="Pagos del mes natural anterior agrupados por concepto." className="text-tenue">
              <Info className="size-4" />
            </span>
          </h3>
          <div className="p-4">
            <GraficoDistribucion datos={m.distribucion} moneda={m.moneda} />
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-xl border bg-superficie shadow-sm">
        <h3 className="border-b px-5 py-4 font-semibold">Actividad reciente</h3>
        {(actividad.data ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-tenue">Todavía no hay actividad.</p>
        ) : (
          <ul className="divide-y">
            {(actividad.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span>
                  {ACCIONES[a.accion] ?? a.accion}
                  {(a.detalle as { nombre?: string })?.nombre && <span className="text-tenue"> · {(a.detalle as { nombre: string }).nombre}</span>}
                </span>
                <span className="shrink-0 text-xs text-tenue">{haceCuanto(a.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
