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
