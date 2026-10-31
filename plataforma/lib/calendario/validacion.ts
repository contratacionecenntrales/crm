import { z } from 'zod';
import { esDia, esHora } from './tiempo.ts';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Identificador no válido');
const uuidOpcional = z.union([z.literal(''), uuid]).transform((v) => v || null);
const dia = z.string().refine(esDia, 'Fecha no válida');
const hora = z.string().refine(esHora, 'Hora no válida');
const entero = (min: number, max: number, nombre: string) =>
  z.coerce.number({ invalid_type_error: `${nombre}: escribe un número` }).int(`${nombre}: sin decimales`)
    .min(min, `${nombre}: mínimo ${min}`).max(max, `${nombre}: máximo ${max}`);

export const esquemaCita = z.object({
  calendario_id: z.string().min(1, 'Elige un calendario').pipe(uuid),
  titulo: z.string().trim().max(200, 'Título demasiado largo'),
  contacto_id: uuidOpcional,
  asignado_id: uuidOpcional,
  fecha: dia,
  hora_inicio: hora,
  hora_fin: hora,
  ubicacion: z.string().trim().max(500),
  estado: z.enum(['nueva', 'confirmada', 'cancelada', 'presentado', 'no_presentado']),
  notas: z.string().trim().max(5000, 'Notas demasiado largas'),
}).refine((c) => c.hora_fin !== c.hora_inicio, { message: 'La hora de fin tiene que ser distinta de la de inicio' });

export const esquemaBloqueo = z.object({
  titulo: z.string().trim().max(200).transform((v) => v || 'Bloqueado'),
  fecha: dia,
  fecha_fin: z.union([z.literal(''), dia]),
  todo_el_dia: z.string().transform((v) => v === 'on' || v === '1'),
  hora_inicio: z.union([z.literal(''), hora]),
  hora_fin: z.union([z.literal(''), hora]),
  calendario_id: uuidOpcional,
  usuario_id: uuidOpcional,
});

export const esquemaCalendario = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre al calendario').max(120),
  descripcion: z.string().trim().max(2000),
  slug: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'El enlace solo admite minúsculas, números y guiones')
    .min(3, 'El enlace necesita al menos 3 caracteres').max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Color no válido').transform((v) => v.toLowerCase()),
  tipo: z.enum(['personal', 'ronda']),
  duracion_min: entero(5, 480, 'Duración'),
  intervalo_min: entero(5, 480, 'Intervalo'),
  antelacion_min: entero(0, 43200, 'Antelación mínima'),
  dias_reserva: entero(1, 365, 'Ventana de reserva'),
  margen_antes: entero(0, 240, 'Margen antes'),
  margen_despues: entero(0, 240, 'Margen después'),
  max_por_dia: z.union([z.literal(''), entero(1, 500, 'Máximo por día')]).transform((v) => (v === '' ? null : v)),
  zona_horaria: z.string().trim().refine((v) => {
    try { new Intl.DateTimeFormat('es-ES', { timeZone: v }); return true; } catch { return false; }
  }, 'Zona horaria no válida'),
  ubicacion: z.string().trim().max(500),
  confirmacion: z.string().trim().max(1000),
  plantilla_confirmacion: z.string().trim().max(1600, 'La plantilla de confirmación es demasiado larga'),
  plantilla_recordatorio: z.string().trim().max(1600, 'La plantilla de recordatorio es demasiado larga'),
});

// Avisos: canales marcados y antelaciones de los recordatorios (en minutos).
export const esquemaRecordatorios = z.array(z.number().int().min(5, 'Un recordatorio necesita al menos 5 minutos de antelación')
  .max(43200, 'Un recordatorio puede ir como mucho 30 días antes')).max(5, 'Máximo 5 recordatorios')
  .transform((l) => [...new Set(l)].sort((a, b) => b - a));

export const CAMPOS_CALENDARIO = Object.keys(esquemaCalendario.shape);

// Franjas del editor semanal: [{dia, inicio, fin}] sin solapes dentro del día.
export const esquemaFranjas = z.array(z.object({
  dia: z.number().int().min(0).max(6),
  inicio: hora,
  fin: z.string().refine((v) => esHora(v) || v === '24:00', 'Hora no válida'),
})).max(70).superRefine((lista, ctx) => {
  for (const f of lista) if (f.fin <= f.inicio) ctx.addIssue({ code: 'custom', message: 'Cada franja tiene que terminar después de empezar' });
  for (let d = 0; d < 7; d++) {
    const del = lista.filter((f) => f.dia === d).sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let i = 1; i < del.length; i++) {
      if (del[i].inicio < del[i - 1].fin) ctx.addIssue({ code: 'custom', message: 'Hay franjas del mismo día que se solapan' });
    }
  }
});

// Enlace de reserva a partir del nombre: "Consulta inicial" → "consulta-inicial-x7k2".
export function slugCalendario(nombre: string, sufijo: string): string {
  const base = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return `${base || 'calendario'}-${sufijo}`;
}
