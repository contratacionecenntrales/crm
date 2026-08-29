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

export type EstadoFactura = "Pendiente" | "Aprobada" | "Pagada";
export type EstadoCita = "Pendiente" | "Realizada" | "Cerrada" | "Cancelada";

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
