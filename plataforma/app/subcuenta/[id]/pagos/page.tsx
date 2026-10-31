import Link from 'next/link';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { escaparLike } from '@/lib/crm/filtros';
import { dinero } from '@/lib/formato';
import { COLUMNAS_FACTURA, ESTILO_ESTADO, estadoVisible, type Factura } from '@/lib/pagos/tipos';
import { nombreContacto } from '@/lib/crm/tipos';
import { BotonNuevaFactura, BuscadorFacturas } from '@/components/pagos/Facturas';

export const metadata = { title: 'Facturas' };

const FILTROS = [['todas', 'Todas'], ['pendientes', 'Pendientes'], ['vencidas', 'Vencidas'], ['pagadas', 'Pagadas'], ['borradores', 'Borradores'], ['anuladas', 'Anuladas']] as const;

export default async function PaginaFacturas({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const q = await searchParams;
  const { subcuenta } = await subcuentaVisible(id);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: subcuenta.zona_horaria }).format(new Date());
  const filtro = FILTROS.some(([v]) => v === q.f) ? q.f! : 'todas';
  const texto = (q.q ?? '').trim().slice(0, 80);
  const supabase = await crearClienteServidor();

  let consulta = supabase.from('pag_facturas').select(COLUMNAS_FACTURA).eq('subcuenta_id', id);
  if (filtro === 'pendientes') consulta = consulta.eq('estado', 'enviada');
  if (filtro === 'vencidas') consulta = consulta.eq('estado', 'enviada').lt('vencimiento', hoy);
  if (filtro === 'pagadas') consulta = consulta.eq('estado', 'pagada');
  if (filtro === 'borradores') consulta = consulta.eq('estado', 'borrador');
  if (filtro === 'anuladas') consulta = consulta.eq('estado', 'anulada');
  if (texto) consulta = consulta.ilike('numero', `%${escaparLike(texto)}%`);
  const inicioMes = hoy.slice(0, 8) + '01';
  const [{ data, error }, pendientes, cobradoMes] = await Promise.all([
    consulta.order('creado', { ascending: false }).limit(300),
    supabase.from('pag_facturas').select('total, cobrado, vencimiento, moneda').eq('subcuenta_id', id).eq('estado', 'enviada').limit(5000),
    supabase.from('pag_transacciones').select('importe').eq('subcuenta_id', id).eq('estado', 'completada').gte('fecha', inicioMes).limit(5000),
  ]);
  if (error) throw new Error(error.message);
  const facturas = (data ?? []) as unknown as Factura[];
  const moneda = (pendientes.data?.[0]?.moneda as string) || facturas[0]?.moneda || 'EUR';
  const porCobrar = (pendientes.data ?? []).reduce((s, f) => s + Number(f.total) - Number(f.cobrado), 0);
  const vencido = (pendientes.data ?? []).filter((f) => f.vencimiento && (f.vencimiento as string) < hoy).reduce((s, f) => s + Number(f.total) - Number(f.cobrado), 0);
  const cobrado = (cobradoMes.data ?? []).reduce((s, t) => s + Number(t.importe), 0);
  const fecha = (d: string | null) => (d ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z')) : '—');

  return (
    <div className="space-y-4 p-4 font-sans">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[['Pendiente de cobro', porCobrar, ''], ['Vencido', vencido, 'text-[#b42318]'], ['Cobrado este mes', cobrado, 'text-[#067647]']].map(([t, v, c]) => (
          <div key={t as string} className="rounded-xl border border-borde bg-superficie p-4 shadow-xs">
            <p className="text-sm text-tenue">{t as string}</p>
            <p className={`mt-1 text-2xl font-semibold text-texto ${c}`}>{dinero(v as number, moneda)}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex flex-wrap rounded-lg border border-borde-fuerte bg-superficie p-0.5 shadow-xs" aria-label="Filtrar facturas">
          {FILTROS.map(([v, t]) => (
            <Link key={v} href={`?f=${v}${texto ? `&q=${encodeURIComponent(texto)}` : ''}`} aria-current={v === filtro ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${v === filtro ? 'bg-primario-suave text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>{t}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <BuscadorFacturas inicial={texto} />
          <BotonNuevaFactura subId={id} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-borde-fuerte bg-superficie">
        <table className="w-full min-w-[820px] text-left text-[13px] text-[#475467] dark:text-texto-2">
          <thead className="bg-superficie-2 text-xs text-[#475467]">
            <tr>{['Número', 'Contacto', 'Emisión', 'Vencimiento', 'Total', 'Pendiente', 'Estado'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {facturas.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-tenue">No hay facturas aquí.</td></tr>}
            {facturas.map((f) => {
              const e = ESTILO_ESTADO[estadoVisible(f, hoy)];
              return (
                <tr key={f.id} className="border-t border-borde-fuerte hover:bg-superficie-2">
                  <td className="px-4 py-2.5"><Link href={`/subcuenta/${id}/pagos/facturas/${f.id}`} className="font-medium text-primario-texto hover:underline">{f.numero}</Link></td>
                  <td className="px-4 py-2.5">{f.contacto ? nombreContacto(f.contacto) : <span className="text-tenue">Sin contacto</span>}</td>
                  <td className="px-4 py-2.5">{fecha(f.emision)}</td>
                  <td className="px-4 py-2.5">{fecha(f.vencimiento)}</td>
                  <td className="px-4 py-2.5 font-medium text-texto">{dinero(Number(f.total), f.moneda)}</td>
                  <td className="px-4 py-2.5">{f.estado === 'enviada' ? dinero(Number(f.total) - Number(f.cobrado), f.moneda) : '—'}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e[1]}`}>{e[0]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
