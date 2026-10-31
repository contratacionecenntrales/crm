// Traduce los errores de PostgREST/Postgres a mensajes legibles.
export function mensajeDeError(error: { message?: string; code?: string; hint?: string } | null): string {
  if (!error) return 'Error desconocido';
  const m = error.message ?? '';
  if (error.code === '42501' || /row-level security|permission denied/i.test(m)) {
    return 'No tienes permiso para hacer esto.';
  }
  if (error.code === '23P01') return 'Esa persona (o el calendario) ya tiene una cita a esa hora.';
  if (error.code === '23505') return 'Ya existe un registro con esos datos.';
  if (error.code === '23514' && !/^[A-ZÁÉÍÓÚ]/.test(m)) return 'Algún dato no cumple el formato esperado.';
  return m || 'No se pudo completar la operación.';
}

// Errores de Supabase Auth (vienen en inglés) traducidos a mensajes claros.
export function mensajeDeAuth(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Error desconocido';
  const m = error.message ?? '';
  const c = error.code ?? '';
  if (c === 'same_password' || /different from the old/i.test(m)) return 'La nueva contraseña tiene que ser distinta de la anterior.';
  if (c === 'weak_password' || /weak|at least \d+ characters|should contain/i.test(m)) return 'La contraseña es demasiado débil: usa más caracteres y mezcla letras, números y símbolos.';
  if (c === 'session_not_found' || c === 'no_authorization' || /session|jwt|not authenticated/i.test(m)) return 'El enlace ha caducado. Pide uno nuevo desde «¿Has olvidado la contraseña?».';
  if (c === 'reauthentication_needed' || /reauthenticat/i.test(m)) return 'Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña.';
  if (c === 'email_exists' || /already (been )?registered/i.test(m)) return 'Ese correo ya está en uso.';
  if (c === 'over_email_send_rate_limit' || /rate limit/i.test(m)) return 'Has hecho demasiados intentos. Espera unos minutos.';
  if (c === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(m)) return 'Correo no válido.';
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
