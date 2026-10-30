import { crearClienteServidor } from '@/lib/supabase/server';
import { subcuentaVisible, usuarioActual } from '@/lib/sesion';
import { asignablesDe } from '@/lib/crm/datos';
import { calendariosDe } from '@/lib/calendario/datos';
import { diaEn, diasDeVista, esDia, instante, sumarDias, type Vista } from '@/lib/calendario/tiempo';
import { COLUMNAS_BLOQUEO, COLUMNAS_CITA, type Bloqueo, type Cita } from '@/lib/calendario/tipos';
import { VistaCalendario } from '@/components/calendario/VistaCalendario';

export const metadata = { title: 'Calendarios' };

export default async function PaginaCalendario({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const [{ subcuenta, soyAdmin }, usuario, calendarios, asignables] = await Promise.all([
    subcuentaVisible(id), usuarioActual(), calendariosDe(id), asignablesDe(id),
  ]);
  const zona = subcuenta.zona_horaria || 'Europe/Madrid';
  const hoy = diaEn(new Date(), zona);
  const vista: Vista = q.vista === 'dia' || q.vista === 'mes' ? q.vista : 'semana';
  const dia = esDia(q.fecha) ? q.fecha : hoy;
  const dias = diasDeVista(vista, dia);
  const desde = instante(dias[0], '00:00', zona).toISOString();
  const hasta = instante(sumarDias(dias[dias.length - 1], 1), '00:00', zona).toISOString();

  const supabase = await crearClienteServidor();
  const [citas, bloqueos] = await Promise.all([
    supabase.from('cal_citas').select(COLUMNAS_CITA).eq('subcuenta_id', id)
      .lt('inicio', hasta).gt('fin', desde).order('inicio').limit(2000),
    supabase.from('cal_bloqueos').select(COLUMNAS_BLOQUEO).eq('subcuenta_id', id)
      .lt('inicio', hasta).gt('fin', desde).order('inicio').limit(500),
  ]);
  if (citas.error) throw new Error(citas.error.message);
  if (bloqueos.error) throw new Error(bloqueos.error.message);

  // Una cita concreta (desde la lista o una notificación) que no cae en el rango.
  let abrir: Cita | null = null;
  if (q.cita && /^[0-9a-f-]{36}$/i.test(q.cita)) {
    abrir = (citas.data as unknown as Cita[]).find((c) => c.id === q.cita) ?? null;
    if (!abrir) {
      const { data } = await supabase.from('cal_citas').select(COLUMNAS_CITA).eq('id', q.cita).eq('subcuenta_id', id).maybeSingle();
      abrir = (data as unknown as Cita) ?? null;
    }
  }

  // «Reservar cita» desde la ficha de un contacto.
  let contactoNuevo: Cita['contacto'] = null;
  if (q.nuevo === '1' && q.contacto && /^[0-9a-f-]{36}$/i.test(q.contacto)) {
    const { data } = await supabase.from('crm_contactos').select('id, nombre, apellidos, email, telefono').eq('id', q.contacto).eq('subcuenta_id', id).maybeSingle();
    contactoNuevo = (data as Cita['contacto']) ?? null;
  }

  return (
    <VistaCalendario
      contactoNuevo={contactoNuevo}
      subId={id}
      zona={zona}
      vista={vista}
      dia={dia}
      hoy={hoy}
      calendarios={calendarios}
      usuarios={asignables}
      citas={citas.data as unknown as Cita[]}
      bloqueos={bloqueos.data as Bloqueo[]}
      yo={usuario.id}
      soyAdmin={soyAdmin}
      abrirCita={abrir}
      abrirNueva={q.nuevo === '1'}
    />
  );
}
