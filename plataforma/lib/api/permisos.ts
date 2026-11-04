export type Permiso = 'contactos.leer' | 'contactos.escribir' | 'oportunidades.leer' | 'oportunidades.escribir' | 'conversaciones.escribir' | 'calendarios.leer';

export const PERMISOS: { valor: Permiso; texto: string }[] = [
  { valor: 'contactos.leer', texto: 'Contactos: leer' },
  { valor: 'contactos.escribir', texto: 'Contactos: crear, editar y borrar' },
  { valor: 'oportunidades.leer', texto: 'Oportunidades: leer' },
  { valor: 'oportunidades.escribir', texto: 'Oportunidades: crear y mover' },
  { valor: 'conversaciones.escribir', texto: 'Conversaciones: enviar mensajes' },
  { valor: 'calendarios.leer', texto: 'Calendarios y citas: leer' },
];

export interface ClaveApi {
  id: string; nombre: string; prefijo: string; permisos: Permiso[]; subcuentas: string[];
  creado: string; ultimo_uso: string | null; caduca: string | null; revocada_en: string | null;
}
