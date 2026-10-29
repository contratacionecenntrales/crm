import 'server-only';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/env';

// Invita por correo a alguien que aún no tiene cuenta. Necesita la clave
// secreta en el servidor; sin ella devuelve un error explicativo.
export async function invitarPorCorreo(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = crearClienteAdmin();
  if (!admin) {
    return {
      ok: false,
      error: 'Ese correo no tiene cuenta todavía. Para enviar invitaciones hay que configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.',
    };
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirmar?siguiente=/auth/nueva-clave`,
  });
  if (error) return { ok: false, error: `No se pudo enviar la invitación: ${error.message}` };
  return { ok: true };
}
