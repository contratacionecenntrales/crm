import { z } from 'zod';

const texto = (max: number) => z.string().trim().max(max);
export const esquemaContactoApi = z.object({
  nombre: texto(100).optional(),
  apellidos: texto(100).optional(),
  email: z.string().trim().toLowerCase().max(200).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Correo no válido').nullable().optional(),
  telefono: texto(30).optional(),
  tipo: z.enum(['lead', 'cliente']).optional(),
  fuente: texto(100).optional(),
  direccion: texto(200).optional(),
  ciudad: texto(100).optional(),
  provincia: texto(100).optional(),
  codigo_postal: texto(12).optional(),
  pais: texto(60).optional(),
  web: texto(200).optional(),
  etiquetas: z.array(texto(60).min(1)).max(50).optional(),
  dnd: z.boolean().optional(),
}).strict();

export const esquemaOportunidadApi = z.object({
  contacto_id: z.string().uuid(),
  nombre: texto(160).min(1),
  valor: z.number().min(0).max(1e12).optional(),
  embudo_id: z.string().uuid().optional(),
  etapa_id: z.string().uuid().optional(),
  estado: z.enum(['abierta', 'ganada', 'perdida', 'abandonada']).optional(),
  fuente: texto(100).optional(),
}).strict();

export const esquemaCambioOportunidadApi = z.object({
  nombre: texto(160).min(1).optional(),
  valor: z.number().min(0).max(1e12).optional(),
  etapa_id: z.string().uuid().optional(),
  estado: z.enum(['abierta', 'ganada', 'perdida', 'abandonada']).optional(),
  motivo_perdida: texto(300).optional(),
}).strict();

export const esquemaMensajeApi = z.object({
  contacto_id: z.string().uuid(),
  canal: z.enum(['sms', 'whatsapp', 'email']),
  cuerpo: z.string().trim().min(1).max(20000),
  asunto: texto(300).optional(),
}).strict().refine((m) => m.canal !== 'email' || Boolean(m.asunto), { message: 'Un correo necesita «asunto»' })
  .refine((m) => m.canal === 'email' || m.cuerpo.length <= 1600, { message: 'SMS y WhatsApp: máximo 1600 caracteres' });

export const primerProblema = (e: z.ZodError) => {
  const i = e.issues[0];
  return i ? `${i.path.join('.') || 'cuerpo'}: ${i.message}` : 'Datos no válidos';
};
