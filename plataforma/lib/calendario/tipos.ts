export type EstadoCita = 'nueva' | 'confirmada' | 'cancelada' | 'presentado' | 'no_presentado';

export const ESTADOS_CITA: { valor: EstadoCita; texto: string; clase: string }[] = [
  { valor: 'confirmada', texto: 'Confirmada', clase: 'bg-[#dcfae6] text-[#067647]' },
  { valor: 'nueva', texto: 'Sin confirmar', clase: 'bg-[#fef0c7] text-[#93370d]' },
  { valor: 'presentado', texto: 'Se presentó', clase: 'bg-[#d1e9ff] text-[#175cd3]' },
  { valor: 'no_presentado', texto: 'No se presentó', clase: 'bg-[#fee4e2] text-[#b42318]' },
  { valor: 'cancelada', texto: 'Cancelada', clase: 'bg-[#f2f4f7] text-[#344054]' },
];
export const estadoCita = (v: string) => ESTADOS_CITA.find((e) => e.valor === v) ?? ESTADOS_CITA[0];

export interface Calendario {
  id: string;
  nombre: string;
  descripcion: string;
  slug: string;
  color: string;
  tipo: 'personal' | 'ronda';
  equipo: string[];
  duracion_min: number;
  intervalo_min: number;
  antelacion_min: number;
  dias_reserva: number;
  margen_antes: number;
  margen_despues: number;
  max_por_dia: number | null;
  zona_horaria: string;
  ubicacion: string;
  confirmacion: string;
  activo: boolean;
}

export const COLUMNAS_CALENDARIO =
  'id, nombre, descripcion, slug, color, tipo, equipo, duracion_min, intervalo_min, antelacion_min, dias_reserva, margen_antes, margen_despues, max_por_dia, zona_horaria, ubicacion, confirmacion, activo';

export interface Franja { dia: number; inicio: string; fin: string }

export interface ContactoCita { id: string; nombre: string; apellidos: string; email: string | null; telefono: string }

export interface Cita {
  id: string;
  calendario_id: string;
  contacto_id: string | null;
  asignado_id: string | null;
  titulo: string;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  notas: string;
  ubicacion: string;
  origen: 'interno' | 'reserva';
  creado: string;
  contacto: ContactoCita | null;
}

export const COLUMNAS_CITA =
  'id, calendario_id, contacto_id, asignado_id, titulo, inicio, fin, estado, notas, ubicacion, origen, creado, contacto:crm_contactos(id, nombre, apellidos, email, telefono)';

export interface Bloqueo {
  id: string;
  calendario_id: string | null;
  usuario_id: string | null;
  titulo: string;
  inicio: string;
  fin: string;
  todo_el_dia: boolean;
}

export const COLUMNAS_BLOQUEO = 'id, calendario_id, usuario_id, titulo, inicio, fin, todo_el_dia';

export const COLORES_CALENDARIO = ['#155eef', '#12b76a', '#f79009', '#f04438', '#7a5af8', '#ee46bc', '#06aed4', '#667085'];

// Fondo suave del color del calendario para pintar la cita.
export function fondoSuave(hex: string, alfa = 0.14): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

export const nombrePersona = (u: { nombre: string; email: string } | undefined | null) =>
  u ? u.nombre || u.email.split('@')[0] : 'Sin asignar';
