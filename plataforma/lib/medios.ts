// Biblioteca de medios: tipos y utilidades compartidas (servidor y navegador).
export interface Medio {
  id: string; ruta: string; nombre: string; carpeta: string; tipo: string; tamano: number; creado: string; url: string;
}

export const CUPO_MEDIOS = 5 * 1024 ** 3; // igual que medios_cupo() en la base de datos
export const MAX_ARCHIVO = 25 * 1024 ** 2;

export const TIPOS_MEDIOS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
  'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mp4': 'm4a',
  'text/plain': 'txt', 'text/csv': 'csv', 'application/zip': 'zip',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: v < 10 ? 2 : 1 })} ${u[i]}`;
}

export const carpetaValida = (c: string) => c.length <= 60 && !/[/\\<>]/.test(c);

export function urlPublicaMedio(supabaseUrl: string, ruta: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/medios/${ruta}`;
}
