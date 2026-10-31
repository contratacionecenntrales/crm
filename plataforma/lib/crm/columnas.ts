import type { Campo } from './tipos';

// Columnas de la tabla de contactos. `tipo` decide qué operadores de filtro
// se ofrecen y cómo se aplican.
export type TipoColumna = 'texto' | 'texto_nulo' | 'etiquetas' | 'fecha' | 'seleccion' | 'booleano' | 'empresa' | 'personalizado';

export interface Columna {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
  ordenable?: boolean;
  opciones?: { valor: string; texto: string }[];
}

export const COLUMNAS_BASE: Columna[] = [
  { clave: 'nombre', titulo: 'Nombre', tipo: 'texto', ordenable: true },
  { clave: 'telefono', titulo: 'Teléfono', tipo: 'texto', ordenable: true },
  { clave: 'email', titulo: 'Correo electrónico', tipo: 'texto_nulo', ordenable: true },
  { clave: 'empresa', titulo: 'Nombre de la empresa', tipo: 'empresa' },
  { clave: 'creado', titulo: 'Creado', tipo: 'fecha', ordenable: true },
  { clave: 'ultima_actividad', titulo: 'Última actividad', tipo: 'fecha', ordenable: true },
  { clave: 'etiquetas', titulo: 'Etiquetas', tipo: 'etiquetas' },
  { clave: 'apellidos', titulo: 'Apellidos', tipo: 'texto', ordenable: true },
  { clave: 'tipo', titulo: 'Tipo de contacto', tipo: 'seleccion', ordenable: true,
    opciones: [{ valor: 'lead', texto: 'Lead' }, { valor: 'cliente', texto: 'Cliente' }] },
  { clave: 'fuente', titulo: 'Fuente de contacto', tipo: 'texto', ordenable: true },
  { clave: 'propietario_id', titulo: 'Propietario', tipo: 'seleccion' },
  { clave: 'direccion', titulo: 'Dirección postal', tipo: 'texto' },
  { clave: 'ciudad', titulo: 'Ciudad', tipo: 'texto', ordenable: true },
  { clave: 'provincia', titulo: 'Provincia', tipo: 'texto', ordenable: true },
  { clave: 'codigo_postal', titulo: 'Código postal', tipo: 'texto', ordenable: true },
  { clave: 'pais', titulo: 'País', tipo: 'texto', ordenable: true },
  { clave: 'web', titulo: 'Sitio web', tipo: 'texto' },
  { clave: 'fecha_nacimiento', titulo: 'Fecha de nacimiento', tipo: 'fecha', ordenable: true },
  { clave: 'dnd', titulo: 'No molestar', tipo: 'booleano' },
  { clave: 'actualizado', titulo: 'Actualizado', tipo: 'fecha', ordenable: true },
];

export const COLUMNAS_POR_DEFECTO = ['nombre', 'telefono', 'email', 'empresa', 'creado', 'ultima_actividad', 'etiquetas'];

export function todasLasColumnas(campos: Campo[]): Columna[] {
  return [
    ...COLUMNAS_BASE,
    ...campos.map<Columna>((c) => ({
      clave: `campo:${c.clave}`,
      titulo: c.nombre,
      tipo: 'personalizado',
      opciones: c.opciones.length ? c.opciones.map((o) => ({ valor: o, texto: o })) : undefined,
    })),
  ];
}

export const OPERADORES: Record<TipoColumna, { op: string; texto: string; sinValor?: boolean; numerico?: boolean }[]> = {
  texto: [
    { op: 'contiene', texto: 'contiene' }, { op: 'no_contiene', texto: 'no contiene' },
    { op: 'es', texto: 'es' }, { op: 'no_es', texto: 'no es' },
    { op: 'vacio', texto: 'está vacío', sinValor: true }, { op: 'no_vacio', texto: 'no está vacío', sinValor: true },
  ],
  texto_nulo: [
    { op: 'contiene', texto: 'contiene' }, { op: 'no_contiene', texto: 'no contiene' }, { op: 'es', texto: 'es' },
    { op: 'vacio', texto: 'está vacío', sinValor: true }, { op: 'no_vacio', texto: 'no está vacío', sinValor: true },
  ],
  empresa: [
    { op: 'contiene', texto: 'contiene' },
    { op: 'vacio', texto: 'está vacío', sinValor: true }, { op: 'no_vacio', texto: 'no está vacío', sinValor: true },
  ],
  etiquetas: [
    { op: 'incluye', texto: 'incluye' }, { op: 'no_incluye', texto: 'no incluye' },
    { op: 'vacio', texto: 'sin etiquetas', sinValor: true }, { op: 'no_vacio', texto: 'con alguna etiqueta', sinValor: true },
  ],
  fecha: [
    { op: 'ultimos_dias', texto: 'en los últimos (días)', numerico: true }, { op: 'antes', texto: 'antes de' },
    { op: 'despues', texto: 'después de' },
    { op: 'vacio', texto: 'está vacío', sinValor: true }, { op: 'no_vacio', texto: 'no está vacío', sinValor: true },
  ],
  seleccion: [
    { op: 'es', texto: 'es' }, { op: 'no_es', texto: 'no es' },
    { op: 'vacio', texto: 'sin asignar', sinValor: true },
  ],
  booleano: [{ op: 'si', texto: 'activado', sinValor: true }, { op: 'no', texto: 'desactivado', sinValor: true }],
  personalizado: [
    { op: 'contiene', texto: 'contiene' }, { op: 'no_contiene', texto: 'no contiene' },
    { op: 'es', texto: 'es' }, { op: 'no_es', texto: 'no es' },
    { op: 'vacio', texto: 'está vacío', sinValor: true }, { op: 'no_vacio', texto: 'no está vacío', sinValor: true },
  ],
};
