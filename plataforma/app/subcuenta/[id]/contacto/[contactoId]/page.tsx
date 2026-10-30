import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible, usuarioActual } from '@/lib/sesion';
import { asignablesDe, camposDe, embudosDe, etiquetasDe, monedaDe } from '@/lib/crm/datos';
import { SELECT_CONTACTO } from '@/lib/crm/consultaContactos';
import { FichaContacto } from '@/components/crm/FichaContacto';
import { COLUMNAS_CITA, type Cita } from '@/lib/calendario/tipos';
import type { Contacto, Evento, Nota, Oportunidad, Tarea } from '@/lib/crm/tipos';

export const metadata = { title: 'Contacto' };

export default async function PaginaContacto({ params }: { params: Promise<{ id: string; contactoId: string }> }) {
  const { id, contactoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(contactoId)) notFound();
  const usuario = await usuarioActual();
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);
  const moneda = await monedaDe(id);
  const supabase = await crearClienteServidor();

  const { data: contacto } = await supabase.from('crm_contactos').select(SELECT_CONTACTO).eq('id', contactoId).eq('subcuenta_id', id).maybeSingle();
  if (!contacto) notFound();

  const [campos, asignables, etiquetas, embudos, notas, tareas, oportunidades, eventos, citas, calendarios] = await Promise.all([
    camposDe(id),
    asignablesDe(id),
    etiquetasDe(id),
    embudosDe(id),
    supabase.from('crm_notas').select('id, cuerpo, autor_id, creado, actualizado').eq('contacto_id', contactoId).order('creado', { ascending: false }),
    supabase.from('crm_tareas').select('id, contacto_id, titulo, descripcion, vence, asignado_id, completada, creado')
      .eq('contacto_id', contactoId).order('completada', { ascending: true, nullsFirst: true }).order('vence', { ascending: true, nullsFirst: false }),
    supabase.from('crm_oportunidades').select('*, etapa:crm_etapas(nombre)').eq('contacto_id', contactoId).order('creado', { ascending: false }),
    supabase.from('crm_eventos').select('id, tipo, detalle, actor_id, ts').eq('contacto_id', contactoId).order('ts', { ascending: false }).limit(100),
    supabase.from('cal_citas').select(COLUMNAS_CITA).eq('contacto_id', contactoId).order('inicio', { ascending: false }).limit(100),
    supabase.from('cal_calendarios').select('id, nombre, color').eq('subcuenta_id', id),
  ]);

  return (
    <FichaContacto
      subId={id}
      contacto={contacto as unknown as Contacto}
      campos={campos}
      asignables={asignables}
      etiquetas={etiquetas}
      notas={(notas.data ?? []) as Nota[]}
      tareas={(tareas.data ?? []) as Tarea[]}
      oportunidades={(oportunidades.data ?? []) as (Oportunidad & { etapa: { nombre: string } | null })[]}
      eventos={(eventos.data ?? []) as Evento[]}
      citas={(citas.data ?? []) as unknown as Cita[]}
      calendarios={(calendarios.data ?? []) as { id: string; nombre: string; color: string }[]}
      embudos={embudos}
      moneda={moneda}
      zona={subcuenta.zona_horaria}
      yo={usuario.id}
      soyAdmin={soyAdmin}
    />
  );
}
