import Link from 'next/link';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe } from '@/lib/crm/datos';
import { calendariosDe } from '@/lib/calendario/datos';
import { COLUMNAS_CITA, type Cita } from '@/lib/calendario/tipos';
import { FiltrosCitas, ListaCitas } from '@/components/calendario/ListaCitas';

export const metadata = { title: 'Lista de citas' };

const POR_PAGINA = 50;
const FILTROS = [
  { valor: 'proximas', texto: 'Próximas' },
  { valor: 'pasadas', texto: 'Pasadas' },
  { valor: 'canceladas', texto: 'Canceladas' },
  { valor: 'todas', texto: 'Todas' },
] as const;

export default async function PaginaCitas({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const [{ subcuenta }, calendarios, usuarios] = await Promise.all([subcuentaVisible(id), calendariosDe(id), asignablesDe(id)]);
  const filtro = FILTROS.some((f) => f.valor === q.filtro) ? q.filtro! : 'proximas';
  const pagina = Math.max(1, Math.min(1000, Number(q.pagina) || 1));
  const calendario = calendarios.some((c) => c.id === q.calendario) ? q.calendario! : '';
  const persona = usuarios.some((u) => u.usuario_id === q.persona) ? q.persona! : '';

  const supabase = await crearClienteServidor();
  const ahora = new Date().toISOString();
  let consulta = supabase.from('cal_citas').select(COLUMNAS_CITA, { count: 'exact' }).eq('subcuenta_id', id);
  if (filtro === 'proximas') consulta = consulta.gte('fin', ahora).neq('estado', 'cancelada');
  if (filtro === 'pasadas') consulta = consulta.lt('fin', ahora).neq('estado', 'cancelada');
  if (filtro === 'canceladas') consulta = consulta.eq('estado', 'cancelada');
  if (calendario) consulta = consulta.eq('calendario_id', calendario);
  if (persona) consulta = consulta.eq('asignado_id', persona);
  const { data, count, error } = await consulta
    .order('inicio', { ascending: filtro === 'proximas' })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (cambios: Record<string, string>) => {
    const u = new URLSearchParams({ filtro, ...(calendario && { calendario }), ...(persona && { persona }), ...cambios });
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k);
    return `?${u}`;
  };

  return (
    <div className="space-y-4 p-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-lg border border-borde-fuerte bg-superficie p-0.5 shadow-xs" aria-label="Filtrar citas">
          {FILTROS.map((f) => (
            <Link key={f.valor} href={enlace({ filtro: f.valor, pagina: '' })} aria-current={f.valor === filtro ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${f.valor === filtro ? 'bg-primario-suave text-primario-texto' : 'text-texto-2 hover:bg-superficie-2'}`}>
              {f.texto}
            </Link>
          ))}
        </nav>
        <FiltrosCitas calendarios={calendarios} usuarios={usuarios} calendario={calendario} persona={persona} />
      </div>
      <ListaCitas subId={id} zona={subcuenta.zona_horaria} citas={(data ?? []) as unknown as Cita[]} calendarios={calendarios} usuarios={usuarios} />
      <div className="flex items-center justify-between text-sm text-tenue">
        <span>{total === 0 ? 'Sin citas' : `${(pagina - 1) * POR_PAGINA + 1}–${Math.min(total, pagina * POR_PAGINA)} de ${total}`}</span>
        <div className="flex gap-2">
          {pagina > 1 && <Link href={enlace({ pagina: String(pagina - 1) })} className="rounded-lg border border-borde-fuerte bg-superficie px-3 py-1.5 font-medium text-texto-2 shadow-xs">Anterior</Link>}
          {pagina < paginas && <Link href={enlace({ pagina: String(pagina + 1) })} className="rounded-lg border border-borde-fuerte bg-superficie px-3 py-1.5 font-medium text-texto-2 shadow-xs">Siguiente</Link>}
        </div>
      </div>
    </div>
  );
}
