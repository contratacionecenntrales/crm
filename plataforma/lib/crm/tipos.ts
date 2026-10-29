export type TipoCampo =
  | 'texto' | 'texto_largo' | 'numero' | 'moneda' | 'fecha' | 'lista' | 'casillas' | 'si_no' | 'telefono' | 'email' | 'url';

export const TIPOS_CAMPO: { valor: TipoCampo; texto: string }[] = [
  { valor: 'texto', texto: 'Texto de una línea' },
  { valor: 'texto_largo', texto: 'Texto de varias líneas' },
  { valor: 'numero', texto: 'Número' },
  { valor: 'moneda', texto: 'Importe' },
  { valor: 'fecha', texto: 'Fecha' },
  { valor: 'lista', texto: 'Desplegable (una opción)' },
  { valor: 'casillas', texto: 'Casillas (varias opciones)' },
  { valor: 'si_no', texto: 'Sí / No' },
  { valor: 'telefono', texto: 'Teléfono' },
  { valor: 'email', texto: 'Correo electrónico' },
  { valor: 'url', texto: 'Enlace web' },
];

export interface Campo {
  id: string;
  clave: string;
  nombre: string;
  tipo: TipoCampo;
  opciones: string[];
  carpeta: string;
  orden: number;
}

export type ValorCampo = string | number | boolean | string[] | null;

export interface Contacto {
  id: string;
  subcuenta_id: string;
  nombre: string;
  apellidos: string;
  email: string | null;
  telefono: string;
  empresa_id: string | null;
  tipo: 'lead' | 'cliente';
  fuente: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  pais: string;
  web: string;
  fecha_nacimiento: string | null;
  zona_horaria: string;
  propietario_id: string | null;
  etiquetas: string[];
  dnd: boolean;
  dnd_canales: string[];
  campos: Record<string, ValorCampo>;
  ultima_actividad: string | null;
  creado: string;
  actualizado: string;
  empresa?: { nombre: string } | null;
}

export interface Empresa {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string;
  web: string;
  direccion: string;
  ciudad: string;
  pais: string;
  creado: string;
}

export interface Usuario {
  usuario_id: string;
  email: string;
  nombre: string;
}

export interface Tarea {
  id: string;
  contacto_id: string | null;
  titulo: string;
  descripcion: string;
  vence: string | null;
  asignado_id: string | null;
  completada: string | null;
  creado: string;
  contacto?: { id: string; nombre: string; apellidos: string; email: string | null; telefono: string } | null;
}

export interface Nota {
  id: string;
  cuerpo: string;
  autor_id: string | null;
  creado: string;
  actualizado: string;
}

export interface Evento {
  id: number;
  tipo: string;
  detalle: Record<string, unknown>;
  actor_id: string | null;
  ts: string;
}

export interface Filtro {
  campo: string;
  op: string;
  valor?: string;
}

export interface ListaInteligente {
  id: string;
  nombre: string;
  filtros: Filtro[];
  busqueda: string;
  orden: string;
  columnas: string[];
  compartida: boolean;
  propietario_id: string | null;
}

export interface AccionLote {
  id: string;
  etiqueta: string;
  operacion: string;
  estado: 'en_curso' | 'completada' | 'error';
  usuario_id: string | null;
  total: number;
  correctos: number;
  errores: number;
  creado: string;
  completado: string | null;
}

export type EstadoOportunidad = 'abierta' | 'ganada' | 'perdida' | 'abandonada';

export const ESTADOS_OPORTUNIDAD: { valor: EstadoOportunidad; texto: string }[] = [
  { valor: 'abierta', texto: 'Abierta' },
  { valor: 'ganada', texto: 'Ganada' },
  { valor: 'perdida', texto: 'Perdida' },
  { valor: 'abandonada', texto: 'Abandonada' },
];

export interface Embudo {
  id: string;
  nombre: string;
  orden: number;
  etapas: Etapa[];
}

export interface Etapa {
  id: string;
  embudo_id: string;
  nombre: string;
  orden: number;
}

export interface Oportunidad {
  id: string;
  embudo_id: string;
  etapa_id: string;
  contacto_id: string;
  nombre: string;
  valor: number;
  estado: EstadoOportunidad;
  propietario_id: string | null;
  fuente: string;
  motivo_perdida: string;
  posicion: number;
  etapa_desde: string;
  creado: string;
  contacto?: { id: string; nombre: string; apellidos: string; email: string | null; telefono: string } | null;
}

export const nombreContacto = (c: { nombre: string; apellidos: string; email?: string | null; telefono?: string }) =>
  [c.nombre, c.apellidos].filter(Boolean).join(' ') || c.email || c.telefono || 'Sin nombre';
