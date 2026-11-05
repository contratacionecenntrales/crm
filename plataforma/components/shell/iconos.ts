import {
  BarChart3, BookUser, Bot, Images, Building2, CalendarDays, CircleHelp, FileText, Globe, LayoutDashboard, LayoutGrid, LayoutTemplate, Link2, MessageCircle, MessagesSquare,
  Network, PlayCircle, Receipt, Rocket, Settings, ShoppingCart, Star, Workflow, User, UserCog, Users,
} from 'lucide-react';

// Los iconos se eligen por nombre porque un Server Component no puede pasar
// funciones (componentes) a un Client Component.
export const ICONOS = {
  launchpad: Rocket,
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
  automatizacion: Workflow,
  medios: Images,
  embudos: LayoutTemplate,
  ia: Bot,
  // Iconos de los enlaces de menú personalizados
  enlace: Link2,
  globo: Globe,
  documento: FileText,
  video: PlayCircle,
  ayuda: CircleHelp,
  carrito: ShoppingCart,
  grafico: BarChart3,
  estrella: Star,
  chat: MessagesSquare,
  calendario: CalendarDays,
} as const;

export type NombreIcono = keyof typeof ICONOS;

export interface ElementoNav {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  exacto?: boolean;
  // Rutas extra que también marcan este elemento como activo.
  tambien?: string[];
  externo?: boolean; // se abre en otra pestaña
}
