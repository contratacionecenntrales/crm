// Textos de los avisos de cita. Sin dependencias: se usa en el servidor y en
// el editor de calendarios (vista previa) y se prueba con node --test.

export type TipoAviso = 'confirmacion' | 'recordatorio' | 'cambio' | 'cancelacion';

export interface DatosAviso {
  nombre: string;
  calendario: string;
  empresa: string;
  fecha: string; // «jueves, 5 de noviembre»
  hora: string; // «10:00»
  ubicacion: string;
  enlace: string; // página para ver o cancelar la cita
}

export const VARIABLES: { clave: keyof DatosAviso; texto: string }[] = [
  { clave: 'nombre', texto: 'Nombre del contacto' },
  { clave: 'calendario', texto: 'Nombre del calendario' },
  { clave: 'empresa', texto: 'Nombre de la empresa' },
  { clave: 'fecha', texto: 'Fecha de la cita' },
  { clave: 'hora', texto: 'Hora de la cita' },
  { clave: 'ubicacion', texto: 'Ubicación' },
  { clave: 'enlace', texto: 'Enlace para ver o cancelar' },
];

export const POR_DEFECTO: Record<TipoAviso, string> = {
  confirmacion: 'Hola {{nombre}}, tu cita «{{calendario}}» con {{empresa}} está confirmada para el {{fecha}} a las {{hora}}.{{ubicacion}} Si no puedes venir, avísanos aquí: {{enlace}}',
  recordatorio: 'Hola {{nombre}}, te recordamos tu cita «{{calendario}}» con {{empresa}} el {{fecha}} a las {{hora}}.{{ubicacion}} ¿No puedes venir? {{enlace}}',
  cambio: 'Hola {{nombre}}, tu cita «{{calendario}}» con {{empresa}} ha cambiado: ahora es el {{fecha}} a las {{hora}}.{{ubicacion}} Detalles: {{enlace}}',
  cancelacion: 'Hola {{nombre}}, tu cita «{{calendario}}» con {{empresa}} del {{fecha}} a las {{hora}} ha sido cancelada.',
};

export const ASUNTOS: Record<TipoAviso, string> = {
  confirmacion: 'Cita confirmada: {{calendario}} el {{fecha}} a las {{hora}}',
  recordatorio: 'Recordatorio: {{calendario}} el {{fecha}} a las {{hora}}',
  cambio: 'Tu cita ha cambiado: {{fecha}} a las {{hora}}',
  cancelacion: 'Cita cancelada: {{calendario}} el {{fecha}}',
};

export function rellenar(plantilla: string, d: DatosAviso, enTexto = true): string {
  return plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (todo, clave: string) => {
    if (clave === 'ubicacion' && enTexto && /\.\{\{\s*ubicacion/.test(plantilla)) return d.ubicacion ? ` Lugar: ${d.ubicacion}.` : '';
    const v = (d as unknown as Record<string, string>)[clave];
    return v === undefined ? todo : v;
  }).replace(/[ \t]{2,}/g, ' ').trim();
}

// Texto final de un aviso: la plantilla del calendario si la hay (para
// confirmación y recordatorio) o la de por defecto.
export function textoAviso(tipo: TipoAviso, plantillas: { confirmacion: string; recordatorio: string }, d: DatosAviso) {
  const propia = tipo === 'confirmacion' ? plantillas.confirmacion : tipo === 'recordatorio' ? plantillas.recordatorio : '';
  return { cuerpo: rellenar(propia.trim() || POR_DEFECTO[tipo], d), asunto: rellenar(ASUNTOS[tipo], d, false) };
}

// 1440 → «1 día antes», 60 → «1 hora antes», 90 → «90 minutos antes».
export function antelacionTexto(min: number): string {
  if (min % 1440 === 0) return `${min / 1440} ${min === 1440 ? 'día' : 'días'} antes`;
  if (min % 60 === 0) return `${min / 60} ${min === 60 ? 'hora' : 'horas'} antes`;
  return `${min} minutos antes`;
}
