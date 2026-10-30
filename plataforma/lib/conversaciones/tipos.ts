// Tipos compartidos entre servidor y navegador (sin secretos).
export interface Ajustes {
  twilio_sid: string;
  twilio_numero_sms: string;
  twilio_numero_wa: string;
  correo_proveedor: '' | 'mailgun' | 'smtp';
  correo_remitente: string;
  correo_nombre: string;
  mailgun_dominio: string;
  mailgun_region: 'us' | 'eu';
  smtp_host: string;
  smtp_puerto: number;
  smtp_seguro: boolean;
  smtp_usuario: string;
}

export const AJUSTES_VACIOS: Ajustes = {
  twilio_sid: '', twilio_numero_sms: '', twilio_numero_wa: '', correo_proveedor: '', correo_remitente: '', correo_nombre: '',
  mailgun_dominio: '', mailgun_region: 'eu', smtp_host: '', smtp_puerto: 587, smtp_seguro: false, smtp_usuario: '',
};


export type Canal = 'sms' | 'whatsapp' | 'email' | 'nota';
export const NOMBRE_CANAL: Record<Canal, string> = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'Correo', nota: 'Comentario interno' };

export interface ContactoConv { id: string; nombre: string; apellidos: string; email: string | null; telefono: string }

export interface Conversacion {
  id: string;
  contacto_id: string;
  asignado_id: string | null;
  estado: 'abierta' | 'cerrada';
  destacada: boolean;
  no_leidos: number;
  ultimo_mensaje_en: string | null;
  ultimo_extracto: string;
  ultimo_canal: Canal | null;
  ultima_direccion: 'entrante' | 'saliente' | null;
  contacto: ContactoConv;
}

export const COLUMNAS_CONVERSACION =
  'id, contacto_id, asignado_id, estado, destacada, no_leidos, ultimo_mensaje_en, ultimo_extracto, ultimo_canal, ultima_direccion, contacto:crm_contactos!inner(id, nombre, apellidos, email, telefono)';

export interface Mensaje {
  id: string;
  direccion: 'entrante' | 'saliente';
  canal: Canal;
  asunto: string;
  cuerpo: string;
  estado: 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'fallido' | 'recibido';
  error: string;
  autor_id: string | null;
  creado: string;
}

export const COLUMNAS_MENSAJE = 'id, direccion, canal, asunto, cuerpo, estado, error, autor_id, creado';

export interface Fragmento { id: string; nombre: string; cuerpo: string }

// Segmentos SMS: 160 caracteres (70 si hay emojis o letras fuera del alfabeto GSM).
const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
export function segmentosSms(t: string) {
  if (!t) return { n: 0, max: 160 };
  const gsm = GSM.test(t);
  const uno = gsm ? 160 : 70;
  const varios = gsm ? 153 : 67;
  return { n: t.length <= uno ? 1 : Math.ceil(t.length / varios), max: uno };
}

