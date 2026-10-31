import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

// Cliente sin sesión (rol «anon»): para las páginas públicas, aunque quien las
// abra tenga sesión iniciada en la plataforma.
export function crearClienteAnonimo() {
  return createClient(supabaseUrl(), supabaseAnonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
