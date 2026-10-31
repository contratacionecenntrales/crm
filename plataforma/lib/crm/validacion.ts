import { z } from 'zod';
import { normalizarTelefono } from './csv.ts';
import type { Campo, ValorCampo } from './tipos';
import { numeroEs } from '../formato.ts';

const t = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

export const esquemaContacto = z
  .object({
    nombre: t(100),
    apellidos: t(100),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Correo no válido')
      .transform((v) => v || null),
    telefono: z.string().trim().max(30),
    tipo: z.enum(['lead', 'cliente']),
    fuente: t(100),
    direccion: t(200),
    ciudad: t(100),
    provincia: t(100),
    codigo_postal: t(12),
    pais: t(60),
    web: t(200).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'La web tiene que empezar por http:// o https://'),
    fecha_nacimiento: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha no válida')
      .transform((v) => v || null),
    empresa: t(160),
    propietario_id: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[0-9a-f-]{36}$/i.test(v), 'Propietario no válido')
      .transform((v) => v || null),
  })
  .refine((c) => c.nombre || c.apellidos || c.email || c.telefono, { message: 'Indica al menos un nombre, un correo o un teléfono.' });

export const CAMPOS_FORM_CONTACTO = [
  'nombre', 'apellidos', 'email', 'telefono', 'tipo', 'fuente', 'direccion', 'ciudad', 'provincia', 'codigo_postal', 'pais',
  'web', 'fecha_nacimiento', 'empresa', 'propietario_id',
];

export function telefonoParaGuardar(v: string, prefijo: string): string {
  const n = normalizarTelefono(v, prefijo);
  if (n && !/^\+[0-9]{6,15}$/.test(n)) throw new Error('El teléfono no parece válido.');
  return n;
}

// Valida y convierte el valor de un campo personalizado según su tipo.
// Devuelve undefined si está vacío (se borra del jsonb) o lanza si no vale.
export function valorCampo(campo: Campo, crudo: string | string[] | undefined): ValorCampo | undefined {
  const texto = Array.isArray(crudo) ? '' : (crudo ?? '').trim();
  const error = (m: string) => new Error(`${campo.nombre}: ${m}`);
  switch (campo.tipo) {
    case 'casillas': {
      const lista = (Array.isArray(crudo) ? crudo : crudo ? [crudo] : []).filter(Boolean);
      if (lista.some((v) => !campo.opciones.includes(v))) throw error('opción no válida');
      return lista.length ? lista : undefined;
    }
    case 'si_no':
      return texto === 'si' ? true : texto === 'no' ? false : undefined;
    default:
      if (texto === '') return undefined;
  }
  switch (campo.tipo) {
    case 'numero':
    case 'moneda': {
      const n = numeroEs(texto);
      if (!Number.isFinite(n)) throw error('tiene que ser un número');
      return n;
    }
    case 'fecha':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw error('fecha no válida');
      return texto;
    case 'lista':
      if (!campo.opciones.includes(texto)) throw error('opción no válida');
      return texto;
    case 'email':
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto)) throw error('correo no válido');
      return texto.toLowerCase();
    case 'url':
      if (!/^https?:\/\/\S+$/i.test(texto)) throw error('tiene que empezar por http:// o https://');
      return texto;
    case 'telefono':
      return texto.replace(/[^\d+ ]/g, '');
    case 'texto':
      return texto.slice(0, 500);
    default:
      return texto.slice(0, 5000);
  }
}

export function leerCamposPersonalizados(fd: FormData, campos: Campo[]): Record<string, ValorCampo> {
  const salida: Record<string, ValorCampo> = {};
  for (const c of campos) {
    const nombre = `campo:${c.clave}`;
    const crudo = c.tipo === 'casillas' ? fd.getAll(nombre).map(String) : (fd.get(nombre) as string | null) ?? undefined;
    const v = valorCampo(c, crudo);
    if (v !== undefined) salida[c.clave] = v;
  }
  return salida;
}
