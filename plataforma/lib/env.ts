// Lectura centralizada de variables de entorno, con un error claro si falta alguna.
function obligatoria(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa .env.local (ver .env.example).`);
  }
  return valor;
}

export const supabaseUrl = () =>
  obligatoria('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () =>
  obligatoria('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const serviceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || null;
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
