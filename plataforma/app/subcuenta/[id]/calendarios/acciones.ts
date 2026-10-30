'use server';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearClienteServidor } from '@/lib/supabase/server';
import { usuarioActual } from '@/lib/sesion';
import { mensajeDeError } from '@/lib/errores';
import { leerFormulario, primerError } from '@/lib/validacion';
import { CAMPOS_CALENDARIO, esquemaRecordatorios, esquemaBloqueo, esquemaCalendario, esquemaCita, esquemaFranjas, slugCalendario } from '@/lib/calendario/validacion';
import { esDia, horaEn, instante, sumarDias } from '@/lib/calendario/tiempo';
import type { Aviso, EstadoCita } from '@/lib/calendario/tipos';
import type { Resultado } from '@/lib/tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ResultadoId = Resultado & { id?: string };

function validarIds(...ids: string[]) {
  if (ids.some((i) => !UUID.test(i))) throw new Error('Identificador no válido.');
}

async function contexto(subId: string) {
  validarIds(subId);
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();
  return { usuario, supabase };
}

const refrescar = (subId: string) => revalidatePath(`/subcuenta/${subId}`, 'layout');

async function zonaDe(supabase: SupabaseClient, subId: string): Promise<string> {
  const { data } = await supabase.from('subcuentas').select('zona_horaria').eq('id', subId).maybeSingle();
  return (data?.zona_horaria as string) || 'Europe/Madrid';
}

// --- Citas --------------------------------------------------------------------

export async function guardarCita(subId: string, citaId: string | null, _: ResultadoId | null, fd: FormData): Promise<ResultadoId> {
  try {
    const datos = esquemaCita.safeParse(leerFormulario(fd, ['calendario_id', 'titulo', 'contacto_id', 'asignado_id', 'fecha',
      'hora_inicio', 'hora_fin', 'ubicacion', 'estado', 'notas']));
    if (!datos.success) return { ok: false, error: primerError(datos.error) };
    const { supabase } = await contexto(subId);
    const d = datos.data;
    const zona = await zonaDe(supabase, subId);

    let titulo = d.titulo;
    if (!titulo) {
      if (d.contacto_id) {
        const { data: c } = await supabase.from('crm_contactos').select('nombre, apellidos, email').eq('id', d.contacto_id).maybeSingle();
        titulo = c ? `${c.nombre} ${c.apellidos}`.trim() || (c.email as string) || '' : '';
      }
      if (!titulo) {
        const { data: cal } = await supabase.from('cal_calendarios').select('nombre').eq('id', d.calendario_id).maybeSingle();
        titulo = (cal?.nombre as string) || 'Cita';
      }
    }

    const fila = {
      calendario_id: d.calendario_id,
      contacto_id: d.contacto_id,
      asignado_id: d.asignado_id,
      titulo: titulo.slice(0, 200),
      inicio: instante(d.fecha, d.hora_inicio, zona).toISOString(),
      fin: instante(d.fecha, d.hora_fin, zona).toISOString(),
      ubicacion: d.ubicacion,
      estado: d.estado,
      notas: d.notas,
      avisar: fd.get('avisar') === 'on',
    };
    const r = citaId
      ? (validarIds(citaId), await supabase.from('cal_citas').update(fila).eq('id', citaId).eq('subcuenta_id', subId).select('id').single())
      : await supabase.from('cal_citas').insert({ ...fila, subcuenta_id: subId }).select('id').single();
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    refrescar(subId);
    return { ok: true, mensaje: citaId ? 'Cita guardada.' : 'Cita creada.', id: r.data.id as string };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Arrastrar una cita: conserva la duración.
export async function moverCita(subId: string, citaId: string, inicioIso: string): Promise<Resultado> {
  validarIds(citaId);
  const nuevo = new Date(inicioIso);
  if (Number.isNaN(nuevo.getTime())) return { ok: false, error: 'Hora no válida.' };
  const { supabase } = await contexto(subId);
  const { data: c, error } = await supabase.from('cal_citas').select('inicio, fin').eq('id', citaId).eq('subcuenta_id', subId).maybeSingle();
  if (error || !c) return { ok: false, error: 'La cita ya no existe.' };
  const duracion = Date.parse(c.fin as string) - Date.parse(c.inicio as string);
  const r = await supabase.from('cal_citas')
    .update({ inicio: nuevo.toISOString(), fin: new Date(nuevo.getTime() + duracion).toISOString() })
    .eq('id', citaId).eq('subcuenta_id', subId);
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  refrescar(subId);
  return { ok: true };
}

export async function estadoCita(subId: string, citaId: string, estado: EstadoCita): Promise<Resultado> {
  validarIds(citaId);
  if (!['nueva', 'confirmada', 'cancelada', 'presentado', 'no_presentado'].includes(estado)) return { ok: false, error: 'Estado no válido.' };
  const { supabase } = await contexto(subId);
  const r = await supabase.from('cal_citas').update({ estado }).eq('id', citaId).eq('subcuenta_id', subId);
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  refrescar(subId);
  return { ok: true };
}

export async function borrarCita(subId: string, citaId: string): Promise<Resultado> {
  validarIds(citaId);
  const { supabase } = await contexto(subId);
  const r = await supabase.from('cal_citas').delete().eq('id', citaId).eq('subcuenta_id', subId).select('id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'Solo quien creó la cita o un administrador puede borrarla. Puedes cancelarla.' };
  refrescar(subId);
  return { ok: true };
}

// Horas libres de un calendario en un día (para el formulario de cita).
export async function huecosDelDia(subId: string, calId: string, dia: string): Promise<{ hora: string; inicio: string; usuarios: string[] }[]> {
  if (!UUID.test(calId) || !UUID.test(subId) || !esDia(dia)) return [];
  const { supabase } = await contexto(subId);
  const zona = await zonaDe(supabase, subId);
  // El día de la subcuenta puede caer en dos días del calendario si las zonas difieren.
  const { data, error } = await supabase.rpc('cal_huecos_internos', { p_cal: calId, p_desde: sumarDias(dia, -1), p_hasta: sumarDias(dia, 1) });
  if (error) return [];
  const desde = instante(dia, '00:00', zona).getTime();
  const hasta = instante(sumarDias(dia, 1), '00:00', zona).getTime();
  return ((data ?? []) as { inicio: string; usuarios: string[] | null }[])
    .filter((h) => { const t = Date.parse(h.inicio); return t >= desde && t < hasta; })
    .map((h) => ({ hora: horaEn(new Date(h.inicio), zona), inicio: h.inicio, usuarios: h.usuarios ?? [] }));
}

// --- Franjas bloqueadas ---------------------------------------------------------

export async function guardarBloqueo(subId: string, bloqueoId: string | null, _: Resultado | null, fd: FormData): Promise<Resultado> {
  try {
    const datos = esquemaBloqueo.safeParse(leerFormulario(fd, ['titulo', 'fecha', 'fecha_fin', 'todo_el_dia', 'hora_inicio', 'hora_fin',
      'calendario_id', 'usuario_id']));
    if (!datos.success) return { ok: false, error: primerError(datos.error) };
    const d = datos.data;
    const { supabase } = await contexto(subId);
    const zona = await zonaDe(supabase, subId);
    let inicio: Date;
    let fin: Date;
    if (d.todo_el_dia) {
      const ultimo = d.fecha_fin || d.fecha;
      if (ultimo < d.fecha) return { ok: false, error: 'La fecha final no puede ser anterior a la inicial.' };
      inicio = instante(d.fecha, '00:00', zona);
      fin = instante(sumarDias(ultimo, 1), '00:00', zona);
    } else {
      if (!d.hora_inicio || !d.hora_fin) return { ok: false, error: 'Indica la hora de inicio y de fin.' };
      if (d.hora_fin <= d.hora_inicio) return { ok: false, error: 'La hora de fin tiene que ser posterior a la de inicio.' };
      inicio = instante(d.fecha, d.hora_inicio, zona);
      fin = instante(d.fecha, d.hora_fin, zona);
    }
    const fila = {
      titulo: d.titulo, calendario_id: d.calendario_id, usuario_id: d.usuario_id, todo_el_dia: d.todo_el_dia,
      inicio: inicio.toISOString(), fin: fin.toISOString(),
    };
    const r = bloqueoId
      ? (validarIds(bloqueoId), await supabase.from('cal_bloqueos').update(fila).eq('id', bloqueoId).eq('subcuenta_id', subId))
      : await supabase.from('cal_bloqueos').insert({ ...fila, subcuenta_id: subId });
    if (r.error) return { ok: false, error: mensajeDeError(r.error) };
    refrescar(subId);
    return { ok: true, mensaje: 'Franja bloqueada guardada.' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function borrarBloqueo(subId: string, bloqueoId: string): Promise<Resultado> {
  validarIds(bloqueoId);
  const { supabase } = await contexto(subId);
  const r = await supabase.from('cal_bloqueos').delete().eq('id', bloqueoId).eq('subcuenta_id', subId).select('id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'Solo quien la creó o un administrador puede borrarla.' };
  refrescar(subId);
  return { ok: true };
}

// --- Calendarios ------------------------------------------------------------------

export async function guardarCalendario(subId: string, calId: string | null, _: ResultadoId | null, fd: FormData): Promise<ResultadoId> {
  try {
    const datos = esquemaCalendario.safeParse(leerFormulario(fd, CAMPOS_CALENDARIO));
    if (!datos.success) return { ok: false, error: primerError(datos.error) };
    let franjasCrudas: unknown;
    try {
      franjasCrudas = JSON.parse(String(fd.get('franjas') ?? '[]'));
    } catch {
      return { ok: false, error: 'Horario no válido.' };
    }
    const franjas = esquemaFranjas.safeParse(franjasCrudas);
    if (!franjas.success) return { ok: false, error: primerError(franjas.error) };
    const equipo = fd.getAll('equipo').map(String).filter((x) => UUID.test(x));
    if (datos.data.tipo === 'personal' && equipo.length > 1) {
      return { ok: false, error: 'Un calendario personal solo puede tener una persona. Elige «Por turnos» para repartir entre varias.' };
    }

    let recCrudos: unknown;
    try {
      recCrudos = JSON.parse(String(fd.get('recordatorios') ?? '[]'));
    } catch {
      return { ok: false, error: 'Recordatorios no válidos.' };
    }
    const recordatorios = esquemaRecordatorios.safeParse(recCrudos);
    if (!recordatorios.success) return { ok: false, error: primerError(recordatorios.error) };
    const avisos_canales = fd.getAll('avisos_canales').map(String).filter((x) => ['email', 'sms', 'whatsapp'].includes(x));

    const { supabase } = await contexto(subId);
    const fila = {
      ...datos.data, equipo, recordatorios: recordatorios.data, avisos_canales,
      aviso_confirmacion: fd.get('aviso_confirmacion') === 'on', permitir_cancelar: fd.get('permitir_cancelar') === 'on',
    };
    const r = calId
      ? (validarIds(calId), await supabase.from('cal_calendarios').update(fila).eq('id', calId).eq('subcuenta_id', subId).select('id').single())
      : await supabase.from('cal_calendarios').insert({ ...fila, subcuenta_id: subId }).select('id').single();
    if (r.error) {
      if (r.error.code === '23505') return { ok: false, error: 'Ese enlace ya lo usa otro calendario. Elige otro.' };
      return { ok: false, error: mensajeDeError(r.error) };
    }
    const id = r.data.id as string;
    const h = await supabase.rpc('cal_guardar_horario', {
      p_cal: id,
      p_franjas: franjas.data.map((f) => ({ ...f, fin: f.fin === '24:00' ? '24:00:00' : f.fin })),
    });
    if (h.error) return { ok: false, error: mensajeDeError(h.error), id };
    refrescar(subId);
    return { ok: true, mensaje: calId ? 'Calendario guardado.' : 'Calendario creado.', id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function crearCalendarioRapido(subId: string, nombre: string): Promise<ResultadoId> {
  const n = nombre.trim().slice(0, 120);
  if (!n) return { ok: false, error: 'Ponle un nombre al calendario.' };
  const { supabase, usuario } = await contexto(subId);
  const sufijo = Math.random().toString(36).slice(2, 6);
  const zona = await zonaDe(supabase, subId);
  const r = await supabase.from('cal_calendarios')
    .insert({ subcuenta_id: subId, nombre: n, slug: slugCalendario(n, sufijo), zona_horaria: zona, equipo: [usuario.id] })
    .select('id').single();
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  const id = r.data.id as string;
  // Horario por defecto: de lunes a viernes, de 9:00 a 17:00.
  await supabase.rpc('cal_guardar_horario', {
    p_cal: id, p_franjas: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: '09:00', fin: '17:00' })),
  });
  refrescar(subId);
  return { ok: true, id };
}

export async function alternarCalendario(subId: string, calId: string, activo: boolean): Promise<Resultado> {
  validarIds(calId);
  const { supabase } = await contexto(subId);
  const r = await supabase.from('cal_calendarios').update({ activo }).eq('id', calId).eq('subcuenta_id', subId);
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  refrescar(subId);
  return { ok: true };
}

export async function borrarCalendario(subId: string, calId: string): Promise<Resultado> {
  validarIds(calId);
  const { supabase } = await contexto(subId);
  const r = await supabase.from('cal_calendarios').delete().eq('id', calId).eq('subcuenta_id', subId).select('id');
  if (r.error) return { ok: false, error: mensajeDeError(r.error) };
  if (!r.data?.length) return { ok: false, error: 'No tienes permiso para borrar este calendario.' };
  refrescar(subId);
  return { ok: true };
}

// Avisos programados o enviados de una cita (para el formulario).
export async function avisosDeCita(subId: string, citaId: string) {
  if (!UUID.test(subId) || !UUID.test(citaId)) return [];
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('cal_avisos').select('id, tipo, canal, enviar_en, estado, error')
    .eq('cita_id', citaId).eq('subcuenta_id', subId).order('enviar_en').limit(50);
  return (data ?? []) as Aviso[];
}
