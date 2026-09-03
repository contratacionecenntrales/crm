export type ModuleStatus = "live" | "soon";

export type AppModule = {
  slug: string;
  href: string;
  label: string;
  description: string;
  status: ModuleStatus;
};

export const APP_MODULES: AppModule[] = [
  {
    slug: "labs",
    href: "/labs",
    label: "Laboratorio",
    description: "Seguimiento de pedidos y resultados de laboratorio.",
    status: "live",
  },
  {
    slug: "sales-crm",
    href: "/sales-crm",
    label: "Sales CRM",
    description: "Pipeline comercial, leads y oportunidades.",
    status: "soon",
  },
  {
    slug: "backoffice",
    href: "/backoffice",
    label: "Backoffice Admin",
    description: "Gestión administrativa y operativa interna.",
    status: "soon",
  },
  {
    slug: "formacion",
    href: "/formacion",
    label: "Formación",
    description: "Materiales y seguimiento de formación del equipo.",
    status: "soon",
  },
  {
    slug: "liquidaciones",
    href: "/liquidaciones",
    label: "Liquidaciones",
    description: "Comisiones y liquidaciones a distribuidores.",
    status: "soon",
  },
  {
    slug: "usuarios",
    href: "/usuarios",
    label: "Usuarios",
    description: "Gestión de cuentas de usuario del equipo.",
    status: "soon",
  },
  {
    slug: "permisos",
    href: "/permisos",
    label: "Permisos",
    description: "Roles y permisos de acceso por módulo.",
    status: "soon",
  },
  {
    slug: "oficina",
    href: "/oficina",
    label: "Oficina",
    description: "Panel general de oficina virtual.",
    status: "soon",
  },
  {
    slug: "sala-entrevistas",
    href: "/sala-entrevistas",
    label: "Sala de Entrevistas",
    description: "Entrevistas y procesos de selección.",
    status: "soon",
  },
];
