// Solo rutas internas de la app: evita redirecciones abiertas a otro dominio
// ("//otro.com", "/\otro.com", "/%5Cotro.com", saltos de línea…).
export function rutaInterna(valor: unknown): string {
  const v = typeof valor === 'string' ? valor : '';
  if (!v.startsWith('/') || v.length > 2000) return '/';
  if (/[\\\u0000-\u001f\u007f]/.test(v)) return '/';
  try {
    const u = new URL(v, 'http://interno.invalid');
    if (u.origin !== 'http://interno.invalid') return '/';
    const ruta = u.pathname + u.search + u.hash;
    return ruta.startsWith('//') ? '/' : ruta;
  } catch {
    return '/';
  }
}
