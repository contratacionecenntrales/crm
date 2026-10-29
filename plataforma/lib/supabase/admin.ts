import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serviceRoleKey, supabaseUrl } from '@/lib/env';

// Cliente con la clave secreta: SE SALTA RLS. Solo para tareas de servidor
// concretas (invitar usuarios, webhooks). Nunca se importa desde el cliente.
export function crearClienteAdmin() {
  const clave = serviceRoleKey();
  if (!clave) return null;
  return createClient(supabaseUrl(), clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
