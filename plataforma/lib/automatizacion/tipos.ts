import { z } from 'zod';

export type Disparador = 'contacto_creado' | 'etiqueta_anadida' | 'cita_reservada' | 'cita_cancelada' | 'cita_estado'
  | 'mensaje_recibido' | 'oportunidad_etapa' | 'factura_pagada' | 'formulario_enviado' | 'webhook' | 'manual';

export const DISPARADORES: { valor: Disparador; texto: string; ayuda: string }[] = [
  { valor: 'contacto_creado', texto: 'Contacto creado', ayuda: 'Cuando se crea un contacto (a mano, importado, por reserva o por mensaje).' },
  { valor: 'etiqueta_anadida', texto: 'Etiqueta añadida', ayuda: 'Cuando un contacto recibe una etiqueta.' },
  { valor: 'cita_reservada', texto: 'Cita reservada', ayuda: 'Cuando se crea una cita (también las reservas online).' },
  { valor: 'cita_cancelada', texto: 'Cita cancelada', ayuda: 'Cuando una cita pasa a cancelada.' },
  { valor: 'cita_estado', texto: 'Estado de la cita', ayuda: 'Cuando una cita se marca como presentada, no presentada o confirmada.' },
  { valor: 'mensaje_recibido', texto: 'Respuesta del cliente', ayuda: 'Cuando llega un SMS, WhatsApp, correo o mensaje del chat web.' },
  { valor: 'oportunidad_etapa', texto: 'Oportunidad cambia de etapa', ayuda: 'Cuando una oportunidad se crea o se mueve de etapa.' },
  { valor: 'formulario_enviado', texto: 'Formulario enviado', ayuda: 'Cuando alguien rellena un formulario de tus embudos o páginas.' },
  { valor: 'webhook', texto: 'Webhook entrante', ayuda: 'Cuando otra herramienta envía datos a la URL secreta de este flujo (formularios externos, tiendas, Zapier, Make, n8n…).' },
  { valor: 'factura_pagada', texto: 'Factura pagada', ayuda: 'Cuando una factura queda pagada.' },
  { valor: 'manual', texto: 'Solo a mano', ayuda: 'El contacto entra cuando lo añades tú desde el flujo.' },
];

export type TipoPaso = 'enviar_sms' | 'enviar_whatsapp' | 'enviar_email' | 'anadir_etiqueta' | 'quitar_etiqueta' | 'asignar_propietario'
  | 'crear_tarea' | 'crear_oportunidad' | 'nota' | 'notificar' | 'esperar' | 'condicion' | 'webhook' | 'ia_mensaje' | 'pedir_resena' | 'si' | 'http' | 'variable' | 'actualizar_contacto';

export const PASOS: { tipo: TipoPaso; texto: string; grupo: 'Comunicación' | 'Contacto' | 'Interno' | 'Lógica' }[] = [
  { tipo: 'enviar_sms', texto: 'Enviar SMS', grupo: 'Comunicación' },
  { tipo: 'enviar_whatsapp', texto: 'Enviar WhatsApp', grupo: 'Comunicación' },
  { tipo: 'enviar_email', texto: 'Enviar correo', grupo: 'Comunicación' },
  { tipo: 'ia_mensaje', texto: 'Mensaje con IA', grupo: 'Comunicación' },
  { tipo: 'pedir_resena', texto: 'Pedir reseña', grupo: 'Comunicación' },
  { tipo: 'anadir_etiqueta', texto: 'Añadir etiqueta', grupo: 'Contacto' },
  { tipo: 'quitar_etiqueta', texto: 'Quitar etiqueta', grupo: 'Contacto' },
  { tipo: 'asignar_propietario', texto: 'Asignar propietario', grupo: 'Contacto' },
  { tipo: 'actualizar_contacto', texto: 'Actualizar contacto', grupo: 'Contacto' },
  { tipo: 'crear_oportunidad', texto: 'Crear oportunidad', grupo: 'Contacto' },
  { tipo: 'crear_tarea', texto: 'Crear tarea', grupo: 'Interno' },
  { tipo: 'nota', texto: 'Añadir nota', grupo: 'Interno' },
  { tipo: 'notificar', texto: 'Avisar al equipo', grupo: 'Interno' },
  { tipo: 'webhook', texto: 'Webhook (enviar datos a una URL)', grupo: 'Interno' },
  { tipo: 'http', texto: 'Petición HTTP (API)', grupo: 'Interno' },
  { tipo: 'esperar', texto: 'Esperar', grupo: 'Lógica' },
  { tipo: 'si', texto: 'Si / si no (ramas)', grupo: 'Lógica' },
  { tipo: 'condicion', texto: 'Seguir solo si…', grupo: 'Lógica' },
  { tipo: 'variable', texto: 'Guardar variable', grupo: 'Lógica' },
];
export const nombrePaso = (t: string) => PASOS.find((p) => p.tipo === t)?.texto ?? t;

const texto = (max: number, msg = 'Escribe el texto') => z.string().trim().min(1, msg).max(max);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const esquemaBase = z.discriminatedUnion('tipo', [
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
  z.object({ tipo: z.literal('pedir_resena'), canal: z.enum(['sms', 'whatsapp', 'email']) }),
  z.object({ tipo: z.literal('ia_mensaje'), canal: z.enum(['sms', 'whatsapp', 'email']), instrucciones: texto(4000, 'Dile a la IA qué mensaje escribir') }),
  z.object({ tipo: z.literal('webhook'), url: z.string().trim().url('URL no válida').max(500).refine((u) => /^https:\/\//i.test(u), 'El webhook tiene que ser https://') }),
  z.object({ tipo: z.literal('http'), metodo: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']), url: z.string().trim().min(8, 'Indica la URL').max(1000),
    cabeceras: z.array(z.object({ nombre: z.string().trim().regex(/^[A-Za-z0-9-]{1,60}$/, 'Nombre de cabecera no válido'), valor: z.string().max(2000) })).max(10).default([]),
    cuerpo: z.string().max(20000).default(''), guardar: z.string().trim().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Nombre de variable: minúsculas, números y _').default('respuesta') }),
  z.object({ tipo: z.literal('variable'), nombre: z.string().trim().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Nombre de variable: minúsculas, números y _'), valor: z.string().max(5000) }),
  z.object({ tipo: z.literal('actualizar_contacto'), campo: z.enum(['nombre', 'apellidos', 'email', 'telefono', 'fuente']), valor: texto(300, 'Indica el valor') }),
]);
type PasoBase = z.infer<typeof esquemaBase>;

// Reglas de las ramas «si / si no».
export const OPERADORES = [
  ['igual', 'es igual a'], ['distinto', 'es distinto de'], ['contiene', 'contiene'], ['no_contiene', 'no contiene'],
  ['vacio', 'está vacío'], ['no_vacio', 'no está vacío'], ['mayor', 'es mayor que'], ['menor', 'es menor que'],
] as const;
export type Operador = (typeof OPERADORES)[number][0];
export interface Regla { campo: string; operador: Operador; valor: string }
export interface PasoSi { tipo: 'si'; modo: 'todas' | 'alguna'; reglas: Regla[]; si: Paso[]; no: Paso[] }
export type Paso = PasoBase | PasoSi;
const esquemaRegla = z.object({
  campo: z.string().trim().min(1, 'Elige el dato de la regla').max(120).regex(/^[a-z_]+(\.[a-z0-9_]+)*$/i, 'Dato no válido'),
  operador: z.enum(OPERADORES.map((o) => o[0]) as [Operador, ...Operador[]]), valor: z.string().max(500).default(''),
});
export const esquemaPaso: z.ZodType<Paso, z.ZodTypeDef, unknown> = z.lazy(() => z.union([
  esquemaBase,
  z.object({ tipo: z.literal('si'), modo: z.enum(['todas', 'alguna']).default('todas'), reglas: z.array(esquemaRegla).min(1, 'Añade al menos una regla').max(10),
    si: z.array(esquemaPaso).max(50).default([]), no: z.array(esquemaPaso).max(50).default([]) }),
]));
// Nodos totales y profundidad de ramas (para límites).
export function medir(l: Paso[], nivel = 1): { nodos: number; nivel: number } {
  let nodos = 0; let max = l.some((p) => p.tipo === 'si') ? nivel : 0;
  for (const p of l) {
    nodos++;
    if (p.tipo === 'si') { const a = medir(p.si, nivel + 1); const b = medir(p.no, nivel + 1); nodos += a.nodos + b.nodos; max = Math.max(max, a.nivel, b.nivel); }
  }
  return { nodos, nivel: max };
}
export const esquemaPasos = z.array(esquemaPaso).max(50, 'Máximo 50 pasos').superRefine((l, ctx) => {
  const recorrer = (x: Paso[]) => {
    for (const p of x) {
      if (p.tipo === 'condicion' && p.regla.includes('etiqueta') && !p.etiqueta) ctx.addIssue({ code: 'custom', message: 'Indica la etiqueta de la condición' });
      if (p.tipo === 'si') { recorrer(p.si); recorrer(p.no); }
    }
  };
  recorrer(l);
  const m = medir(l);
  if (m.nodos > 120) ctx.addIssue({ code: 'custom', message: 'Como mucho 120 pasos en total (contando las ramas)' });
  if (m.nivel > 4) ctx.addIssue({ code: 'custom', message: 'Como mucho 4 niveles de ramas' });
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
    case 'pedir_resena': return { tipo, canal: 'whatsapp' };
    case 'si': return { tipo, modo: 'todas', reglas: [{ campo: 'contacto.etiquetas', operador: 'contiene', valor: '' }], si: [], no: [] };
    case 'http': return { tipo, metodo: 'POST', url: 'https://', cabeceras: [], cuerpo: '{\n  "email": "{{contacto.email}}",\n  "nombre": "{{contacto.nombre}}"\n}', guardar: 'respuesta' };
    case 'variable': return { tipo, nombre: 'mi_variable', valor: '' };
    case 'actualizar_contacto': return { tipo, campo: 'fuente', valor: '' };
    case 'ia_mensaje': return { tipo, canal: 'whatsapp', instrucciones: 'Saluda al contacto por su nombre, agradécele su interés y pregúntale qué día le viene bien para una llamada de 15 minutos.' };
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
    case 'si': return `${p.reglas.length} regla(s) · ${p.si.length} paso(s) si / ${p.no.length} si no`;
    case 'http': return `${p.metodo} ${p.url.replace(/^https:\/\//, '')} → {{var.${p.guardar}}}`;
    case 'variable': return `{{var.${p.nombre}}} = ${p.valor.slice(0, 50)}`;
    case 'actualizar_contacto': return `${p.campo} = ${p.valor.slice(0, 50)}`;
    case 'pedir_resena': return `Por ${p.canal === 'email' ? 'correo' : p.canal === 'sms' ? 'SMS' : 'WhatsApp'}, con enlace de valoración`;
    case 'ia_mensaje': return `${p.canal === 'email' ? 'Correo' : p.canal === 'sms' ? 'SMS' : 'WhatsApp'} · ${p.instrucciones.slice(0, 70)}`;
  }
}

export { urlPublica } from '../red/ip.ts';
