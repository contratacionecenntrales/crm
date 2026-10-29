import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe } from '@/lib/crm/datos';
import { Avatar } from '@/components/ui/Avatar';
import { Insignia } from '@/components/ui/Insignia';
import { FiltrosLote } from '@/components/crm/FiltrosLote';
import type { AccionLote } from '@/lib/crm/tipos';

export const metadata = { title: 'Acciones en lote' };

const OPERACION: Record<string, string> = {
  exportar: 'Exportar', importar: 'Importar', 'añadir_etiqueta': 'Añadir etiqueta', quitar_etiqueta: 'Quitar etiqueta',
  asignar_propietario: 'Asignar propietario', borrar: 'Borrar',
};
const ESTADO = { completada: ['Completar', 'verde'], en_curso: ['En curso', 'azul'], error: ['Error', 'rojo'] } as const;

export default async function PaginaLotes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string; operacion?: string; usuario?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { subcuenta } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  let q = supabase.from('crm_acciones_lote').select('*').eq('subcuenta_id', id).order('creado', { ascending: false }).limit(200);
  if (sp.estado && sp.estado in ESTADO) q = q.eq('estado', sp.estado);
  if (sp.operacion && sp.operacion in OPERACION) q = q.eq('operacion', sp.operacion);
  if (sp.usuario && /^[0-9a-f-]{36}$/i.test(sp.usuario)) q = q.eq('usuario_id', sp.usuario);
  const [{ data, error }, usuarios] = await Promise.all([q, asignablesDe(id)]);
  if (error) throw new Error(error.message);
  const lotes = (data ?? []) as AccionLote[];
  const fecha = (v: string | null) =>
    v ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: subcuenta.zona_horaria }).format(new Date(v)) : '—';

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-xl border bg-superficie shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Acciones en bloque</h2>
          <p className="text-sm text-tenue">Haga un seguimiento del progreso y los resultados de las acciones en lote.</p>
          <FiltrosLote operaciones={OPERACION} usuarios={usuarios} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-superficie-2 text-left">
              <tr>{['Etiqueta de acción', 'Operación', 'Estado', 'Usuario', 'Creado', 'Completado', 'Estadísticas'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {lotes.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-tenue">Todavía no hay acciones en lote.</td></tr>}
              {lotes.map((l) => {
                const u = usuarios.find((x) => x.usuario_id === l.usuario_id);
                const [texto, tono] = ESTADO[l.estado];
                return (
                  <tr key={l.id}>
                    <td className="max-w-72 truncate px-4 py-3 font-medium text-primario">{l.etiqueta}</td>
                    <td className="px-4 py-3">{OPERACION[l.operacion] ?? l.operacion}</td>
                    <td className="px-4 py-3"><Insignia tono={tono}>{texto}</Insignia></td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2"><Avatar nombre={u?.nombre || u?.email || '?'} tam="size-7" />{u ? u.nombre || u.email : '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{fecha(l.creado)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{fecha(l.completado)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="text-exito">{l.correctos} ok</span>
                      {l.errores > 0 && <span className="text-peligro"> · {l.errores} con error</span>}
                      <span className="text-tenue"> / {l.total}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
