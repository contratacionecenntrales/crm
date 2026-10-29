import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible, usuarioActual } from '@/lib/sesion';
import { asignablesDe } from '@/lib/crm/datos';
import { ListaTareas } from '@/components/crm/ListaTareas';
import type { Tarea } from '@/lib/crm/tipos';

export const metadata = { title: 'Tareas' };

export default async function PaginaTareas({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string; asignado?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const usuario = await usuarioActual();
  const { subcuenta } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const estado = ['pendientes', 'completadas', 'todas'].includes(sp.estado ?? '') ? sp.estado! : 'pendientes';
  let q = supabase
    .from('crm_tareas')
    .select('id, contacto_id, titulo, descripcion, vence, asignado_id, completada, creado, contacto:crm_contactos(id, nombre, apellidos, email, telefono)')
    .eq('subcuenta_id', id)
    .order('vence', { ascending: true, nullsFirst: false })
    .order('creado', { ascending: false })
    .limit(500);
  if (estado === 'pendientes') q = q.is('completada', null);
  if (estado === 'completadas') q = q.not('completada', 'is', null);
  if (sp.asignado === 'yo') q = q.eq('asignado_id', usuario.id);
  else if (sp.asignado && /^[0-9a-f-]{36}$/i.test(sp.asignado)) q = q.eq('asignado_id', sp.asignado);
  const [{ data, error }, asignables] = await Promise.all([q, asignablesDe(id)]);
  if (error) throw new Error(error.message);
  return <ListaTareas subId={id} tareas={(data ?? []) as unknown as Tarea[]} asignables={asignables} zona={subcuenta.zona_horaria} yo={usuario.id} estado={estado} />;
}
