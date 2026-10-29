import {
  Building2, LayoutDashboard, Settings, Users, UserCog, Rocket, MessageSquare, CalendarDays, Contact, Receipt,
} from 'lucide-react';

// Los iconos se eligen por nombre porque un Server Component no puede pasar
// funciones (componentes) a un Client Component.
export const ICONOS = {
  tablero: LayoutDashboard,
  subcuentas: Building2,
  equipo: Users,
  ajustes: Settings,
  usuario: UserCog,
  launchpad: Rocket,
  conversaciones: MessageSquare,
  calendarios: CalendarDays,
  contactos: Contact,
  facturacion: Receipt,
} as const;

export type NombreIcono = keyof typeof ICONOS;

export interface ElementoNav {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  exacto?: boolean;
}
