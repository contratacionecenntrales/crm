import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe } from '@/lib/crm/datos';
import { TablaLotes } from '@/components/crm/TablaLotes';
import type { AccionLote } from '@/lib/crm/tipos';

export const metadata = { title: 'Acciones en lote' };

const OPERACIONES = ['exportar', 'importar', 'añadir_etiqueta', 'quitar_etiqueta', 'asignar_propietario', 'borrar'];
const POR_PAGINA = 50;

export default async function PaginaLotes({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string; operacion?: string; usuario?: string; desde?: string; hasta?: string; p?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { subcuenta } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const hoy = new Date();
  const hace6m = new Date(hoy.getFullYear(), hoy.getMonth() - 6, hoy.getDate());
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde ?? '') ? sp.desde! : iso(hace6m);
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta ?? '') ? sp.hasta! : iso(hoy);
  const pagina = Math.max(1, Number.parseInt(sp.p ?? '1', 10) || 1);

  let q = supabase.from('crm_acciones_lote').select('*').eq('subcuenta_id', id)
    .gte('creado', `${desde}T00:00:00`).lt('creado', new Date(Date.parse(`${hasta}T00:00:00Z`) + 86_400_000).toISOString())
    .order('creado', { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA); // uno de más para saber si hay siguiente
  if (sp.estado && ['completada', 'en_curso', 'error'].includes(sp.estado)) q = q.eq('estado', sp.estado);
  if (sp.operacion && OPERACIONES.includes(sp.operacion)) q = q.eq('operacion', sp.operacion);
  if (sp.usuario && /^[0-9a-f-]{36}$/i.test(sp.usuario)) q = q.eq('usuario_id', sp.usuario);
  const [{ data, error }, usuarios] = await Promise.all([q, asignablesDe(id)]);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as (AccionLote & { detalle: Record<string, unknown> })[];

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold leading-[30px] text-texto">Acciones en bloque</h2>
      <p className="text-xs leading-[17px] text-tenue">Haga un seguimiento del progreso y los resultados de las acciones en lote.</p>
      <TablaLotes
        subId={id}
        lotes={filas.slice(0, POR_PAGINA)}
        haySiguiente={filas.length > POR_PAGINA}
        pagina={pagina}
        usuarios={usuarios}
        zona={subcuenta.zona_horaria}
        desde={desde}
        hasta={hasta}
      />
    </div>
  );
}
