import { z } from 'zod';

export type Disparador = 'contacto_creado' | 'etiqueta_anadida' | 'cita_reservada' | 'cita_cancelada' | 'cita_estado'
  | 'mensaje_recibido' | 'oportunidad_etapa' | 'factura_pagada' | 'manual';

export const DISPARADORES: { valor: Disparador; texto: string; ayuda: string }[] = [
  { valor: 'contacto_creado', texto: 'Contacto creado', ayuda: 'Cuando se crea un contacto (a mano, importado, por reserva o por mensaje).' },
  { valor: 'etiqueta_anadida', texto: 'Etiqueta añadida', ayuda: 'Cuando un contacto recibe una etiqueta.' },
  { valor: 'cita_reservada', texto: 'Cita reservada', ayuda: 'Cuando se crea una cita (también las reservas online).' },
  { valor: 'cita_cancelada', texto: 'Cita cancelada', ayuda: 'Cuando una cita pasa a cancelada.' },
  { valor: 'cita_estado', texto: 'Estado de la cita', ayuda: 'Cuando una cita se marca como presentada, no presentada o confirmada.' },
  { valor: 'mensaje_recibido', texto: 'Respuesta del cliente', ayuda: 'Cuando llega un SMS, WhatsApp o correo.' },
  { valor: 'oportunidad_etapa', texto: 'Oportunidad cambia de etapa', ayuda: 'Cuando una oportunidad se crea o se mueve de etapa.' },
  { valor: 'factura_pagada', texto: 'Factura pagada', ayuda: 'Cuando una factura queda pagada.' },
  { valor: 'manual', texto: 'Solo a mano', ayuda: 'El contacto entra cuando lo añades tú desde el flujo.' },
];

export type TipoPaso = 'enviar_sms' | 'enviar_whatsapp' | 'enviar_email' | 'anadir_etiqueta' | 'quitar_etiqueta' | 'asignar_propietario'
  | 'crear_tarea' | 'crear_oportunidad' | 'nota' | 'notificar' | 'esperar' | 'condicion' | 'webhook';

export const PASOS: { tipo: TipoPaso; texto: string; grupo: 'Comunicación' | 'Contacto' | 'Interno' | 'Lógica' }[] = [
  { tipo: 'enviar_sms', texto: 'Enviar SMS', grupo: 'Comunicación' },
  { tipo: 'enviar_whatsapp', texto: 'Enviar WhatsApp', grupo: 'Comunicación' },
  { tipo: 'enviar_email', texto: 'Enviar correo', grupo: 'Comunicación' },
  { tipo: 'anadir_etiqueta', texto: 'Añadir etiqueta', grupo: 'Contacto' },
  { tipo: 'quitar_etiqueta', texto: 'Quitar etiqueta', grupo: 'Contacto' },
  { tipo: 'asignar_propietario', texto: 'Asignar propietario', grupo: 'Contacto' },
  { tipo: 'crear_oportunidad', texto: 'Crear oportunidad', grupo: 'Contacto' },
  { tipo: 'crear_tarea', texto: 'Crear tarea', grupo: 'Interno' },
  { tipo: 'nota', texto: 'Añadir nota', grupo: 'Interno' },
  { tipo: 'notificar', texto: 'Avisar al equipo', grupo: 'Interno' },
  { tipo: 'webhook', texto: 'Webhook (enviar datos a una URL)', grupo: 'Interno' },
  { tipo: 'esperar', texto: 'Esperar', grupo: 'Lógica' },
  { tipo: 'condicion', texto: 'Condición (si/no)', grupo: 'Lógica' },
];
export const nombrePaso = (t: string) => PASOS.find((p) => p.tipo === t)?.texto ?? t;

const texto = (max: number, msg = 'Escribe el texto') => z.string().trim().min(1, msg).max(max);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const esquemaPaso = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('enviar_sms'), texto: texto(1600, 'El SMS necesita texto') }),
  z.object({ tipo: z.literal('enviar_whatsapp'), texto: texto(4000, 'El WhatsApp necesita texto') }),
  z.object({ tipo: z.literal('enviar_email'), asunto: texto(300, 'El correo necesita asunto'), texto: texto(20000, 'El correo necesita texto') }),
  z.object({ tipo: z.literal('anadir_etiqueta'), etiqueta: texto(60, 'Indica la etiqueta') }),
  z.object({ tipo: z.literal('quitar_etiqueta'), etiqueta: texto(60, 'Indica la etiqueta') }),
  z.object({ tipo: z.literal('asignar_propietario'), usuario_id: uuid.or(z.literal('')) }),
  z.object({ tipo: z.literal('crear_tarea'), titulo: texto(200, 'La tarea necesita título'), descripcion: z.string().max(5000).default(''),
    dias: z.number().int().min(0).max(365).default(1), asignado_id: uuid.or(z.literal('')).default('') }),
  z.object({ tipo: z.literal('crear_oportunidad'), embudo_id: uuid, etapa_id: uuid, nombre: texto(160, 'La oportunidad necesita nombre'), valor: z.number().min(0).max(1e12).default(0) }),
  z.object({ tipo: z.literal('nota'), texto: texto(10000, 'La nota necesita texto') }),
  z.object({ tipo: z.literal('notificar'), usuario_id: uuid.or(z.literal('')), titulo: texto(200, 'El aviso necesita título'), texto: z.string().max(1000).default('') }),
  z.object({ tipo: z.literal('esperar'), cantidad: z.number().int().min(1, 'Espera al menos 1').max(365), unidad: z.enum(['minutos', 'horas', 'dias']) }),
  z.object({ tipo: z.literal('condicion'), regla: z.enum(['tiene_etiqueta', 'no_tiene_etiqueta', 'tiene_email', 'tiene_telefono']), etiqueta: z.string().trim().max(60).default('') }),
  z.object({ tipo: z.literal('webhook'), url: z.string().trim().url('URL no válida').max(500).refine((u) => /^https:\/\//i.test(u), 'El webhook tiene que ser https://') }),
]);
export type Paso = z.infer<typeof esquemaPaso>;
export const esquemaPasos = z.array(esquemaPaso).max(50, 'Máximo 50 pasos').superRefine((l, ctx) => {
  for (const p of l) if (p.tipo === 'condicion' && p.regla.includes('etiqueta') && !p.etiqueta) ctx.addIssue({ code: 'custom', message: 'Indica la etiqueta de la condición' });
});

export function pasoVacio(tipo: TipoPaso): Paso {
  switch (tipo) {
    case 'enviar_sms': case 'enviar_whatsapp': return { tipo, texto: 'Hola {{contacto.nombre}}, ' };
    case 'enviar_email': return { tipo, asunto: '', texto: 'Hola {{contacto.nombre}},\n\n' };
    case 'anadir_etiqueta': case 'quitar_etiqueta': return { tipo, etiqueta: '' };
    case 'asignar_propietario': return { tipo, usuario_id: '' };
    case 'crear_tarea': return { tipo, titulo: 'Llamar a {{contacto.nombre}}', descripcion: '', dias: 1, asignado_id: '' };
    case 'crear_oportunidad': return { tipo, embudo_id: '', etapa_id: '', nombre: '{{contacto.nombre_completo}}', valor: 0 } as unknown as Paso;
    case 'nota': return { tipo, texto: '' };
    case 'notificar': return { tipo, usuario_id: '', titulo: 'Atención: {{contacto.nombre_completo}}', texto: '' };
    case 'esperar': return { tipo, cantidad: 1, unidad: 'dias' };
    case 'condicion': return { tipo, regla: 'tiene_etiqueta', etiqueta: '' };
    case 'webhook': return { tipo, url: 'https://' };
  }
}

export const VARIABLES = [
  ['contacto.nombre', 'Nombre'], ['contacto.apellidos', 'Apellidos'], ['contacto.nombre_completo', 'Nombre completo'],
  ['contacto.email', 'Correo'], ['contacto.telefono', 'Teléfono'], ['empresa.nombre', 'Tu empresa'],
  ['cita.fecha', 'Fecha de la cita'], ['cita.hora', 'Hora de la cita'], ['mensaje.texto', 'Mensaje recibido'],
  ['factura.numero', 'Nº de factura'], ['factura.total', 'Total de la factura'], ['oportunidad.nombre', 'Oportunidad'],
] as const;

// Sustituye {{grupo.campo}}; lo desconocido se deja vacío.
export function rellenarVariables(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{\{\s*([a-z_]+\.[a-z_]+)\s*\}\}/gi, (_, k: string) => valores[k.toLowerCase()] ?? '');
}

export function esperaEnMinutos(p: { cantidad: number; unidad: 'minutos' | 'horas' | 'dias' }) {
  return p.cantidad * (p.unidad === 'dias' ? 1440 : p.unidad === 'horas' ? 60 : 1);
}

// Resumen de una línea para la tarjeta del constructor.
export function resumenPaso(p: Paso): string {
  switch (p.tipo) {
    case 'enviar_sms': case 'enviar_whatsapp': case 'nota': return p.texto.slice(0, 80);
    case 'enviar_email': return p.asunto || 'Sin asunto';
    case 'anadir_etiqueta': case 'quitar_etiqueta': return p.etiqueta || 'Sin etiqueta';
    case 'asignar_propietario': return p.usuario_id ? 'A una persona concreta' : 'Elige a quién';
    case 'crear_tarea': return `${p.titulo} · vence en ${p.dias} ${p.dias === 1 ? 'día' : 'días'}`;
    case 'crear_oportunidad': return p.nombre;
    case 'notificar': return p.titulo;
    case 'esperar': return `${p.cantidad} ${p.unidad === 'dias' ? (p.cantidad === 1 ? 'día' : 'días') : p.unidad === 'horas' ? (p.cantidad === 1 ? 'hora' : 'horas') : 'minutos'}`;
    case 'condicion': return { tiene_etiqueta: `Si tiene «${p.etiqueta}»`, no_tiene_etiqueta: `Si no tiene «${p.etiqueta}»`, tiene_email: 'Si tiene correo', tiene_telefono: 'Si tiene teléfono' }[p.regla] + '; si no, termina';
    case 'webhook': return p.url;
  }
}

// Evita que un webhook apunte a la red interna del servidor.
export function urlPublica(url: string): boolean {
  let h: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h)) return false;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h === '::') return false;
  return true;
}
