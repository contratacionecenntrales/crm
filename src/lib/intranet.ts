export const ADMIN_EMAIL = "admin@labs24k.com";

export const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatFecha(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatHora(value: string) {
  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mayusInicial(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export type EstadoFactura = "Pendiente" | "Aprobada" | "Pagada";
export type EstadoCita = "Pendiente" | "Realizada" | "Cerrada" | "Cancelada";
export type EstadoLead = "Nuevo" | "Contactado" | "Cita agendada" | "Ganado" | "Descartado";
export type EstadoComision = "Pendiente" | "Aprobada" | "Liquidada" | "Cancelada";
export type EstadoLiquidacion = "Pendiente" | "Pagada" | "Cancelada";
export type FaseCandidato =
  "Recibido" | "Entrevista" | "Prueba" | "Oferta" | "Contratado" | "Onboarding" | "Descartado";
export type EstadoTicket = "Abierto" | "En proceso" | "Resuelto" | "Cerrado";
export type PrioridadTicket = "Baja" | "Media" | "Alta";

export type AppRole = "admin" | "comercial" | "account_manager" | "entrevistador" | "admin_staff";

export const ROLES: AppRole[] = [
  "admin",
  "comercial",
  "account_manager",
  "entrevistador",
  "admin_staff",
];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  comercial: "Comercial",
  account_manager: "Account Manager",
  entrevistador: "Entrevistador",
  admin_staff: "Admin Staff",
};

export const MODULOS = [
  "leads",
  "facturacion",
  "comisiones",
  "recursos",
  "academia",
  "agenda",
  "entrevistas",
  "backoffice",
] as const;
export type Modulo = (typeof MODULOS)[number];

export const MODULO_LABEL: Record<Modulo, string> = {
  leads: "Leads",
  facturacion: "Facturación",
  comisiones: "Comisiones",
  recursos: "Recursos",
  academia: "Academia",
  agenda: "Agenda",
  entrevistas: "Entrevistas",
  backoffice: "Backoffice",
};

export const estadoFacturaClass: Record<EstadoFactura, string> = {
  Pendiente: "bg-accent/15 text-accent",
  Aprobada: "bg-lime/15 text-lime",
  Pagada: "bg-brand/15 text-brand",
};

export const estadoCitaClass: Record<EstadoCita, string> = {
  Pendiente: "bg-amber/15 text-amber",
  Realizada: "bg-brand/15 text-brand",
  Cerrada: "bg-lime/15 text-lime",
  Cancelada: "bg-coral/15 text-coral",
};

export const estadoLeadClass: Record<EstadoLead, string> = {
  Nuevo: "bg-secondary text-ink-400",
  Contactado: "bg-amber/15 text-amber",
  "Cita agendada": "bg-brand/15 text-brand",
  Ganado: "bg-lime/15 text-lime",
  Descartado: "bg-coral/15 text-coral",
};

export const estadoComisionClass: Record<EstadoComision, string> = {
  Pendiente: "bg-amber/15 text-amber",
  Aprobada: "bg-brand/15 text-brand",
  Liquidada: "bg-lime/15 text-lime",
  Cancelada: "bg-coral/15 text-coral",
};

export const estadoLiquidacionClass: Record<EstadoLiquidacion, string> = {
  Pendiente: "bg-amber/15 text-amber",
  Pagada: "bg-lime/15 text-lime",
  Cancelada: "bg-coral/15 text-coral",
};

export const FASES_CANDIDATO: FaseCandidato[] = [
  "Recibido",
  "Entrevista",
  "Prueba",
  "Oferta",
  "Contratado",
  "Onboarding",
  "Descartado",
];

export const faseCandidatoClass: Record<FaseCandidato, string> = {
  Recibido: "bg-secondary text-ink-400",
  Entrevista: "bg-accent/15 text-accent",
  Prueba: "bg-amber/15 text-amber",
  Oferta: "bg-brand/15 text-brand",
  Contratado: "bg-lime/15 text-lime",
  Onboarding: "bg-lime/15 text-lime",
  Descartado: "bg-coral/15 text-coral",
};

export const estadoTicketClass: Record<EstadoTicket, string> = {
  Abierto: "bg-coral/15 text-coral",
  "En proceso": "bg-amber/15 text-amber",
  Resuelto: "bg-brand/15 text-brand",
  Cerrado: "bg-lime/15 text-lime",
};

export const prioridadTicketClass: Record<PrioridadTicket, string> = {
  Baja: "bg-secondary text-ink-400",
  Media: "bg-amber/15 text-amber",
  Alta: "bg-coral/15 text-coral",
};
