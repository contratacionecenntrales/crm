import {
  BookUser, Building2, CalendarDays, LayoutDashboard, LayoutGrid, MessageCircle, Network, Receipt, Settings, User, UserCog, Users,
} from 'lucide-react';

// Los iconos se eligen por nombre porque un Server Component no puede pasar
// funciones (componentes) a un Client Component.
export const ICONOS = {
  tablero: LayoutGrid,
  tableroAgencia: LayoutDashboard,
  subcuentas: User,
  empresas: Building2,
  equipo: Users,
  ajustes: Settings,
  usuario: UserCog,
  conversaciones: MessageCircle,
  calendarios: CalendarDays,
  contactos: BookUser,
  oportunidades: Network,
  facturacion: Receipt,
} as const;

export type NombreIcono = keyof typeof ICONOS;

export interface ElementoNav {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  exacto?: boolean;
  // Rutas extra que también marcan este elemento como activo.
  tambien?: string[];
}
