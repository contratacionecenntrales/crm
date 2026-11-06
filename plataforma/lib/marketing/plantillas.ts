import type { Disparador, Paso } from '@/lib/automatizacion/tipos';

// Biblioteca de campañas listas para usar con un clic.

export interface PlantillaEnvio {
  id: string; nombre: string; categoria: 'Ventas' | 'Fidelización' | 'Reactivación' | 'Eventos' | 'Comunicación';
  descripcion: string; canal: 'email' | 'sms' | 'whatsapp'; asunto: string; cuerpo: string; etiquetas_sugeridas: string[];
}

export const PLANTILLAS_ENVIO: PlantillaEnvio[] = [
  { id: 'black-friday', nombre: 'Black Friday', categoria: 'Ventas', canal: 'email', etiquetas_sugeridas: ['clientes'],
    descripcion: 'Oferta por tiempo limitado con urgencia y un único llamado a la acción.',
    asunto: '{{contacto.nombre}}, solo hasta el domingo: -30 % en todo',
    cuerpo: 'Hola {{contacto.nombre}},\n\nEste fin de semana tenemos la mejor oferta del año en {{empresa.nombre}}: un 30 % de descuento en todos nuestros servicios.\n\n✅ Válido hasta el domingo a las 23:59\n✅ Plazas limitadas\n✅ Puedes usarlo para ti o regalarlo\n\nResponde a este correo con «QUIERO» y te reservamos tu plaza.\n\nUn abrazo,\nEl equipo de {{empresa.nombre}}' },
  { id: 'whatsapp-oferta', nombre: 'Oferta flash por WhatsApp', categoria: 'Ventas', canal: 'whatsapp', etiquetas_sugeridas: ['clientes'],
    descripcion: 'Mensaje corto y directo para vender hoy mismo.', asunto: '',
    cuerpo: 'Hola {{contacto.nombre}} 👋 Solo para clientes de {{empresa.nombre}}: hoy y mañana tienes un 20 % de descuento. ¿Te reservo hueco? Responde «SÍ» y te digo horarios.' },
  { id: 'reactivar-90', nombre: 'Te echamos de menos', categoria: 'Reactivación', canal: 'email', etiquetas_sugeridas: ['inactivo'],
    descripcion: 'Recupera clientes que hace tiempo que no vienen, con un incentivo.',
    asunto: 'Hace tiempo que no te vemos, {{contacto.nombre}}',
    cuerpo: 'Hola {{contacto.nombre}},\n\nHace tiempo que no sabemos de ti y queríamos saludarte.\n\nPara celebrar tu vuelta te regalamos un 15 % en tu próxima visita. Solo tienes que responder a este correo o reservar en nuestra web.\n\n¡Te esperamos!\n{{empresa.nombre}}' },
  { id: 'reactivar-sms', nombre: 'Vuelve con regalo (SMS)', categoria: 'Reactivación', canal: 'sms', etiquetas_sugeridas: ['inactivo'],
    descripcion: 'SMS breve para reactivar con un incentivo claro.', asunto: '',
    cuerpo: '{{contacto.nombre}}, te echamos de menos en {{empresa.nombre}}. Vuelve este mes y llévate un 15 % de descuento. Responde a este SMS para reservar.' },
  { id: 'novedades', nombre: 'Boletín de novedades', categoria: 'Comunicación', canal: 'email', etiquetas_sugeridas: [],
    descripcion: 'Newsletter mensual con novedades, un consejo y una llamada a la acción.',
    asunto: 'Novedades de {{empresa.nombre}} este mes',
    cuerpo: 'Hola {{contacto.nombre}},\n\nEsto es lo nuevo en {{empresa.nombre}} este mes:\n\n🆕 Novedad: [cuenta aquí tu novedad]\n💡 Consejo del mes: [un consejo útil para tus clientes]\n📅 Próximamente: [evento, lanzamiento o fecha importante]\n\n¿Tienes alguna duda? Responde a este correo y te contestamos personalmente.\n\nGracias por estar ahí,\n{{empresa.nombre}}' },
  { id: 'encuesta', nombre: 'Encuesta de satisfacción', categoria: 'Fidelización', canal: 'email', etiquetas_sugeridas: ['clientes'],
    descripcion: 'Pregunta en una línea para detectar mejoras y clientes promotores.',
    asunto: '¿Nos ayudas con una pregunta, {{contacto.nombre}}?',
    cuerpo: 'Hola {{contacto.nombre}},\n\nTu opinión nos ayuda a mejorar. ¿Del 0 al 10, cuánto recomendarías {{empresa.nombre}} a un amigo?\n\nSolo tienes que responder a este correo con un número (y, si quieres, el motivo).\n\n¡Mil gracias!\n{{empresa.nombre}}' },
  { id: 'cumple', nombre: 'Felicitación con regalo', categoria: 'Fidelización', canal: 'whatsapp', etiquetas_sugeridas: [],
    descripcion: 'Felicita y regala un detalle para fidelizar.', asunto: '',
    cuerpo: '¡Feliz día, {{contacto.nombre}}! 🎉 En {{empresa.nombre}} queremos celebrarlo contigo: tienes un regalo esperándote en tu próxima visita. ¡Gracias por confiar en nosotros!' },
  { id: 'evento', nombre: 'Invitación a evento', categoria: 'Eventos', canal: 'email', etiquetas_sugeridas: [],
    descripcion: 'Invita a un evento, taller o webinar con fecha, hora y plazas.',
    asunto: '{{contacto.nombre}}, te invitamos (plazas limitadas)',
    cuerpo: 'Hola {{contacto.nombre}},\n\nTe invitamos a nuestro próximo evento:\n\n📌 Qué: [nombre del evento]\n📅 Cuándo: [día y hora]\n📍 Dónde: [lugar o enlace]\n\nLas plazas son limitadas. Responde «ME APUNTO» y te guardamos sitio.\n\n¡Nos vemos!\n{{empresa.nombre}}' },
  { id: 'recordatorio-revision', nombre: 'Recordatorio de revisión', categoria: 'Fidelización', canal: 'sms', etiquetas_sugeridas: ['clientes'],
    descripcion: 'Recuerda la revisión periódica (clínicas, talleres, mantenimientos).', asunto: '',
    cuerpo: 'Hola {{contacto.nombre}}, te toca tu revisión en {{empresa.nombre}}. ¿Te buscamos hueco esta semana? Responde a este SMS y te damos opciones.' },
  { id: 'lanzamiento', nombre: 'Lanzamiento de producto', categoria: 'Ventas', canal: 'email', etiquetas_sugeridas: [],
    descripcion: 'Anuncia algo nuevo con beneficios claros y precio de lanzamiento.',
    asunto: 'Ya está aquí: lo nuevo de {{empresa.nombre}}',
    cuerpo: 'Hola {{contacto.nombre}},\n\nPor fin podemos contártelo: lanzamos [nombre del producto o servicio].\n\nCon él vas a poder:\n• [beneficio 1]\n• [beneficio 2]\n• [beneficio 3]\n\nSolo esta semana tienes precio de lanzamiento. Responde a este correo y te contamos todo.\n\n{{empresa.nombre}}' },
  { id: 'ultimas-plazas', nombre: 'Últimas plazas', categoria: 'Ventas', canal: 'whatsapp', etiquetas_sugeridas: [],
    descripcion: 'Empujón final con escasez real.', asunto: '',
    cuerpo: '{{contacto.nombre}}, quedan solo 3 plazas para este mes en {{empresa.nombre}}. Si te interesa, responde «YO» y te la reservo antes de que se agoten.' },
  { id: 'gracias-clientes', nombre: 'Gracias por un gran año', categoria: 'Comunicación', canal: 'email', etiquetas_sugeridas: ['clientes'],
    descripcion: 'Mensaje de agradecimiento de fin de año que refuerza la relación.',
    asunto: 'Gracias por este año, {{contacto.nombre}}',
    cuerpo: 'Hola {{contacto.nombre}},\n\nQueríamos parar un momento para darte las gracias. Este año hemos crecido gracias a personas como tú, que confían en {{empresa.nombre}}.\n\nTe deseamos lo mejor para el año que viene y esperamos seguir acompañándote.\n\nCon cariño,\nEl equipo de {{empresa.nombre}}' },
];

export interface Receta {
  id: string; nombre: string; descripcion: string; categoria: 'Captación' | 'Citas' | 'Ventas' | 'Fidelización' | 'Atención';
  disparador: Disparador; filtro: Record<string, unknown>; pasos: Paso[];
}

export const RECETAS: Receta[] = [
  { id: 'bienvenida-lead', nombre: 'Bienvenida a nuevos contactos', categoria: 'Captación', disparador: 'contacto_creado', filtro: {},
    descripcion: 'Correo de bienvenida al momento, WhatsApp al día siguiente y tarea para llamar si no responde.',
    pasos: [
      { tipo: 'enviar_email', asunto: '¡Bienvenido/a a {{empresa.nombre}}, {{contacto.nombre}}!', texto: 'Hola {{contacto.nombre}},\n\nGracias por contactar con {{empresa.nombre}}. Hemos recibido tus datos y en breve te contactamos.\n\nMientras tanto, si tienes cualquier duda, responde a este correo.\n\nUn saludo,\n{{empresa.nombre}}' },
      { tipo: 'esperar', cantidad: 1, unidad: 'dias' },
      { tipo: 'enviar_whatsapp', texto: 'Hola {{contacto.nombre}} 👋 Soy de {{empresa.nombre}}. ¿Cuándo te viene bien que hablemos 5 minutos?' },
      { tipo: 'esperar', cantidad: 1, unidad: 'dias' },
      { tipo: 'crear_tarea', titulo: 'Llamar a {{contacto.nombre_completo}}', descripcion: 'Contacto nuevo sin respuesta: hacer una llamada.', dias: 0, asignado_id: '' },
    ] },
  { id: 'lead-formulario', nombre: 'Seguimiento de formulario web (7 días)', categoria: 'Captación', disparador: 'formulario_enviado', filtro: {},
    descripcion: 'Secuencia de 3 mensajes en 7 días para quien rellena un formulario de tus embudos.',
    pasos: [
      { tipo: 'anadir_etiqueta', etiqueta: 'lead-web' },
      { tipo: 'enviar_email', asunto: 'Gracias, {{contacto.nombre}}: esto es lo siguiente', texto: 'Hola {{contacto.nombre}},\n\nGracias por tu interés en {{empresa.nombre}}. Te escribimos en menos de 24 horas para ayudarte.\n\nUn saludo.' },
      { tipo: 'esperar', cantidad: 2, unidad: 'dias' },
      { tipo: 'enviar_whatsapp', texto: 'Hola {{contacto.nombre}}, ¿pudiste ver nuestro correo? Si quieres, te llamo hoy y te lo cuento en 5 minutos.' },
      { tipo: 'esperar', cantidad: 5, unidad: 'dias' },
      { tipo: 'enviar_email', asunto: '¿Seguimos, {{contacto.nombre}}?', texto: 'Hola {{contacto.nombre}},\n\nNo queremos molestarte. Si sigues interesado, responde a este correo y lo retomamos cuando te venga bien.\n\n{{empresa.nombre}}' },
    ] },
  { id: 'recordatorio-cita', nombre: 'Confirmación de cita reservada', categoria: 'Citas', disparador: 'cita_reservada', filtro: {},
    descripcion: 'WhatsApp de confirmación con fecha y hora al reservar.',
    pasos: [{ tipo: 'enviar_whatsapp', texto: 'Hola {{contacto.nombre}}, tu cita en {{empresa.nombre}} está confirmada para el {{cita.fecha}} a las {{cita.hora}}. Si necesitas cambiarla, responde a este mensaje.' }] },
  { id: 'no-show', nombre: 'Recuperar a quien no vino', categoria: 'Citas', disparador: 'cita_estado', filtro: { estado: 'no_presentado' },
    descripcion: 'Mensaje amable para reprogramar, etiqueta y tarea si no responde.',
    pasos: [
      { tipo: 'anadir_etiqueta', etiqueta: 'no-show' },
      { tipo: 'enviar_whatsapp', texto: 'Hola {{contacto.nombre}}, te echamos de menos hoy en {{empresa.nombre}}. ¿Te busco otra hora? Responde a este mensaje y lo vemos.' },
      { tipo: 'esperar', cantidad: 2, unidad: 'dias' },
      { tipo: 'crear_tarea', titulo: 'Reprogramar cita de {{contacto.nombre_completo}}', descripcion: 'No se presentó y no ha respondido.', dias: 0, asignado_id: '' },
    ] },
  { id: 'resena-tras-cita', nombre: 'Pedir reseña tras la visita', categoria: 'Fidelización', disparador: 'cita_estado', filtro: { estado: 'presentado' },
    descripcion: 'Dos horas después de que el cliente venga, le pide una valoración (las buenas van a Google).',
    pasos: [{ tipo: 'esperar', cantidad: 2, unidad: 'horas' }, { tipo: 'pedir_resena', canal: 'whatsapp' }] },
  { id: 'gracias-pago', nombre: 'Gracias por tu pago', categoria: 'Ventas', disparador: 'factura_pagada', filtro: {},
    descripcion: 'Agradece el pago, marca como cliente y pide reseña una semana después.',
    pasos: [
      { tipo: 'enviar_email', asunto: 'Gracias por tu pago, {{contacto.nombre}}', texto: 'Hola {{contacto.nombre}},\n\nHemos recibido el pago de la factura {{factura.numero}} ({{factura.total}}). ¡Muchas gracias por confiar en {{empresa.nombre}}!' },
      { tipo: 'anadir_etiqueta', etiqueta: 'cliente' },
      { tipo: 'esperar', cantidad: 7, unidad: 'dias' },
      { tipo: 'pedir_resena', canal: 'email' },
    ] },
  { id: 'oportunidad-ganada', nombre: 'Bienvenida a nuevo cliente', categoria: 'Ventas', disparador: 'oportunidad_etapa', filtro: {},
    descripcion: 'Cuando una oportunidad cambia de etapa: aviso al equipo y mensaje personalizado con IA.',
    pasos: [
      { tipo: 'notificar', usuario_id: '', titulo: 'Movimiento en {{oportunidad.nombre}}', texto: '{{contacto.nombre_completo}} ha avanzado en el embudo de ventas.' },
      { tipo: 'ia_mensaje', canal: 'email', instrucciones: 'Escribe un correo breve y cálido agradeciendo al contacto su confianza, explicando que su gestor le contactará hoy para los siguientes pasos.' },
    ] },
  { id: 'respuesta-urgente', nombre: 'Aviso de mensajes con «urgente»', categoria: 'Atención', disparador: 'mensaje_recibido', filtro: { palabra: 'urgente' },
    descripcion: 'Si un cliente escribe «urgente», avisa al equipo y crea una tarea para hoy.',
    pasos: [
      { tipo: 'notificar', usuario_id: '', titulo: 'Mensaje URGENTE de {{contacto.nombre_completo}}', texto: '{{mensaje.texto}}' },
      { tipo: 'crear_tarea', titulo: 'Responder urgente a {{contacto.nombre_completo}}', descripcion: '{{mensaje.texto}}', dias: 0, asignado_id: '' },
    ] },
];
