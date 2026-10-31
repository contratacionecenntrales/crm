import { z } from 'zod';
import { numeroEs } from './formato.ts';

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const opcionalEmail = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v.toLowerCase())
  .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Correo no válido')
  .transform((v) => (v === '' ? null : v));
const web = texto(200).refine(
  (v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v),
  'La web tiene que empezar por http:// o https://',
);
const zonaHoraria = z
  .string()
  .trim()
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('es-ES', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Zona horaria no válida');

export const esquemaSubcuenta = z.object({
  nombre: texto(120).min(2, 'El nombre necesita al menos 2 caracteres'),
  email: opcionalEmail,
  prefijo: z.string().trim().regex(/^\+\d{1,4}$/, 'Prefijo no válido (ej. +34)'),
  telefono: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d ]/g, ''))
    .pipe(z.string().max(20, 'Teléfono demasiado largo')),
  direccion: texto(200),
  ciudad: texto(100),
  provincia: texto(100),
  codigo_postal: texto(12),
  pais: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'País en formato ISO de 2 letras (ej. ES)'),
  web,
  zona_horaria: zonaHoraria,
  etapa: z.enum(['Prospecto', 'Prueba', 'Cerrado (Ganado)', 'Cancelado']).optional(),
});

export const esquemaAgencia = z.object({
  nombre: texto(120).min(2, 'El nombre necesita al menos 2 caracteres'),
  email: opcionalEmail,
  telefono: texto(30),
  web,
  moneda: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Moneda ISO de 3 letras (ej. EUR)'),
  zona_horaria: zonaHoraria,
});

const importe = z
  .string()
  .trim()
  .transform((v) => numeroEs(v))
  .refine((v) => Number.isFinite(v), 'Importe no válido');

export const esquemaSuscripcion = z.object({
  plan: texto(80).min(1, 'Pon un nombre al plan'),
  importe_mensual: importe.refine((v) => v >= 0, 'El importe no puede ser negativo'),
  estado: z.enum(['activa', 'prueba', 'impagada', 'cancelada']),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida'),
});

export const esquemaPago = z.object({
  importe: importe.refine((v) => v !== 0, 'El importe no puede ser 0'),
  concepto: texto(120).min(1, 'Indica el concepto'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida'),
});

export const esquemaMiembro = z.object({
  email: z.string().trim().toLowerCase().email('Correo no válido'),
  rol: z.enum(['propietario', 'admin', 'usuario']),
});

// FormData → objeto plano de strings (los campos ausentes quedan como '').
export function leerFormulario(fd: FormData, campos: string[]): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const c of campos) {
    const v = fd.get(c);
    salida[c] = typeof v === 'string' ? v : '';
  }
  return salida;
}

export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos no válidos';
}
