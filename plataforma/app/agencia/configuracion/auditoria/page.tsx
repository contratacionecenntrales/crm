import { crearClienteServidor } from '@/lib/supabase/server';
import { exigirAgencia } from '@/lib/sesion';
import { ContenedorAjustes, TituloAjustes } from '@/components/ajustes/Piezas';

export const metadata = { title: 'Registros de auditoría' };

const ACCIONES: Record<string, string> = {
  'subcuentas.insert': 'Subcuenta creada', 'subcuentas.update': 'Subcuenta modificada', 'subcuentas.delete': 'Subcuenta eliminada',
  'subcuenta_miembros.insert': 'Acceso a subcuenta concedido', 'subcuenta_miembros.update': 'Rol en subcuenta cambiado',
  'subcuenta_miembros.delete': 'Acceso a subcuenta retirado', 'agencia_miembros.insert': 'Usuario de agencia añadido',
  'agencia_miembros.update': 'Rol de agencia cambiado', 'agencia_miembros.delete': 'Usuario de agencia retirado',
  'suscripciones.insert': 'Plan asignado', 'suscripciones.update': 'Plan modificado', 'suscripciones.delete': 'Plan eliminado',
};

export default async function PaginaAuditoria({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { actual } = await exigirAgencia({ admin: true });
  const { p } = await searchParams;
  const pagina = Math.max(1, Number.parseInt(p ?? '1', 10) || 1);
  const tam = 50;
  const supabase = await crearClienteServidor();
  const [{ data, error }, usuarios] = await Promise.all([
    supabase.from('actividad').select('id, subcuenta_id, actor_id, accion, detalle, ts').eq('agencia_id', actual.agencia.id)
      .order('ts', { ascending: false }).range((pagina - 1) * tam, pagina * tam),
    supabase.rpc('usuarios_de_agencia', { p_agencia: actual.agencia.id }),
  ]);
  if (error) throw new Error(error.message);
  const filas = (data ?? []).slice(0, tam);
  const quien = new Map(((usuarios.data ?? []) as { usuario_id: string; email: string; nombre: string }[]).map((u) => [u.usuario_id, u.nombre || u.email]));
  const fmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: actual.agencia.zona_horaria });

  return (
    <ContenedorAjustes>
      <TituloAjustes titulo="Registros de auditoría" subtitulo="Quién ha cambiado qué en la agencia. No se puede editar ni borrar." />
      <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b border-borde text-left text-texto">
            <tr>{['Fecha', 'Usuario', 'Acción', 'Detalle'].map((h) => <th key={h} className="border-l border-borde px-3 py-2.5 font-semibold first:border-l-0">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-tenue">Sin actividad registrada.</td></tr>}
            {filas.map((a) => {
              const d = a.detalle as Record<string, unknown>;
              return (
                <tr key={a.id} className="border-b border-borde last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-texto-2">{fmt.format(new Date(a.ts))}</td>
                  <td className="px-3 py-2 text-texto">{a.actor_id ? quien.get(a.actor_id) ?? 'Usuario retirado' : 'Sistema'}</td>
                  <td className="px-3 py-2 text-texto">{ACCIONES[a.accion] ?? a.accion}</td>
                  <td className="px-3 py-2 text-xs text-texto-2">
                    {[d.nombre, d.plan, d.rol && `rol ${d.rol}`, Array.isArray(d.cambios) && (d.cambios as string[]).length ? `campos: ${(d.cambios as string[]).join(', ')}` : '']
                      .filter(Boolean).join(' · ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end gap-2 text-sm">
        {pagina > 1 && <a href={`?p=${pagina - 1}`} className="rounded border border-borde-fuerte px-3 py-1">Anterior</a>}
        {(data ?? []).length > tam && <a href={`?p=${pagina + 1}`} className="rounded border border-borde-fuerte px-3 py-1">Siguiente</a>}
      </div>
    </ContenedorAjustes>
  );
}
