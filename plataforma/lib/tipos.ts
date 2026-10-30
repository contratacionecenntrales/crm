export type RolAgencia = 'propietario' | 'admin' | 'usuario';
export type RolSubcuenta = 'admin' | 'usuario';
export type EstadoSubcuenta = 'activa' | 'suspendida';
export type Etapa = 'Prospecto' | 'Prueba' | 'Cerrado (Ganado)' | 'Cancelado';
export type EstadoSuscripcion = 'activa' | 'prueba' | 'impagada' | 'cancelada';

export const ETAPAS: Etapa[] = ['Prospecto', 'Prueba', 'Cerrado (Ganado)', 'Cancelado'];
export const ESTADOS_SUSCRIPCION: EstadoSuscripcion[] = ['activa', 'prueba', 'impagada', 'cancelada'];

export interface Agencia {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string;
  web: string;
  logo_url: string | null;
  moneda: string;
  zona_horaria: string;
  creado: string;
  categoria: string;
  nicho: string;
  uso_principal: string;
  direccion: string;
  ciudad: string;
  codigo_postal: string;
  provincia: string;
  pais: string;
  dominio_marca: string;
  dominio_api: string;
  url_privacidad: string;
  url_terminos: string;
  css_personalizado: string;
  tema_defecto: 'claro' | 'oscuro';
  expiracion_sesion_min: number | null;
}

export interface Subcuenta {
  id: string;
  agencia_id: string;
  nombre: string;
  email: string | null;
  prefijo: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  pais: string;
  web: string;
  zona_horaria: string;
  logo_url: string | null;
  etapa: Etapa;
  estado: EstadoSubcuenta;
  ultimo_acceso: string | null;
  creado: string;
}

export interface Suscripcion {
  id: string;
  subcuenta_id: string;
  plan: string;
  importe_mensual: number;
  estado: EstadoSuscripcion;
  inicio: string;
  cancelada_en: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface Pago {
  id: string;
  subcuenta_id: string | null;
  importe: number;
  concepto: string;
  fecha: string;
  origen: 'manual' | 'stripe';
}

export interface Miembro<R> {
  usuario_id: string;
  email: string;
  nombre: string;
  rol: R;
  creado: string;
}

export interface Notificacion {
  id: string;
  subcuenta_id: string | null;
  tipo: 'sistema' | 'alerta';
  categoria: string;
  titulo: string;
  cuerpo: string;
  enlace: string | null;
  leida: string | null;
  creado: string;
}

export interface Metricas {
  moneda: string;
  ingresos_30d: number;
  mrr: number;
  nuevos_30d: number;
  total_clientes: number;
  serie: { mes: string; nuevos: number; mrr: number; ingresos: number }[];
  distribucion: { concepto: string; importe: number }[];
}

// Resultado de una Server Action que se muestra en un formulario.
export type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };
