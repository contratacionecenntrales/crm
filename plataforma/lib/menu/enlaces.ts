// Enlaces de menú personalizados: tipos y utilidades compartidas.
export const ICONOS_ENLACE = [
  ['enlace', 'Enlace'], ['globo', 'Web'], ['documento', 'Documento'], ['video', 'Vídeo'], ['ayuda', 'Ayuda'],
  ['carrito', 'Tienda'], ['grafico', 'Informes'], ['estrella', 'Destacado'], ['chat', 'Chat'], ['calendario', 'Calendario'],
] as const;
export type IconoEnlace = (typeof ICONOS_ENLACE)[number][0];

export interface EnlaceMenu {
  id: string;
  nombre: string;
  url: string;
  icono: IconoEnlace;
  modo: 'pestana' | 'iframe';
  en_agencia: boolean;
  en_subcuentas: boolean;
  subcuentas: string[];
  orden: number;
}

// Variables que se pueden usar en la URL: {{subcuenta.id}} y {{agencia.id}}.
export function resolverUrl(url: string, ctx: { subcuenta?: string | null; agencia?: string | null }): string {
  return url
    .replace(/\{\{\s*(subcuenta|location)\.id\s*\}\}/g, encodeURIComponent(ctx.subcuenta ?? ''))
    .replace(/\{\{\s*(agencia|company)\.id\s*\}\}/g, encodeURIComponent(ctx.agencia ?? ''));
}

export const urlEnlaceValida = (v: string) => /^https:\/\/[^\s/$.?#][^\s]*$/.test(v) && v.length <= 1000;
