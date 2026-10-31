import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible } from '@/lib/sesion';
import { asignablesDe, embudosDe, etiquetasDe } from '@/lib/crm/datos';
import { Constructor, type Ejecucion, type Flujo } from '@/components/automatizacion/Constructor';

export const metadata = { title: 'Flujo de trabajo' };

export default async function PaginaFlujo({ params, searchParams }: { params: Promise<{ id: string; fid: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id, fid } = await params;
  const { tab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(fid)) notFound();
  const { subcuenta, soyAdmin } = await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [f, ejec, etiquetas, embudos, usuarios, calendarios] = await Promise.all([
    supabase.from('aut_flujos').select('id, nombre, activo, disparador, filtro, pasos, permitir_reentrada').eq('id', fid).eq('subcuenta_id', id).maybeSingle(),
    supabase.from('aut_ejecuciones').select('id, estado, paso, motivo, creado, terminado, siguiente_en, contacto:crm_contactos(id, nombre, apellidos, email, telefono), registro:aut_registro(paso, tipo, ok, detalle, ts)')
      .eq('flujo_id', fid).order('creado', { ascending: false }).limit(100),
    etiquetasDe(id), embudosDe(id), asignablesDe(id),
    supabase.from('cal_calendarios').select('id, nombre').eq('subcuenta_id', id).order('nombre'),
  ]);
  if (!f.data) notFound();
  return (
    <Constructor
      subId={id}
      zona={subcuenta.zona_horaria}
      flujo={f.data as unknown as Flujo}
      ejecuciones={(ejec.data ?? []) as unknown as Ejecucion[]}
      opciones={{ etiquetas, embudos, usuarios, calendarios: (calendarios.data ?? []) as { id: string; nombre: string }[] }}
      soyAdmin={soyAdmin}
      pestanaInicial={tab === 'historial' ? 'historial' : 'constructor'}
    />
  );
}
