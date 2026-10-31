import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { FormularioLogin } from './Formulario';

export const metadata = { title: 'Iniciar sesión' };

// Solo mensajes conocidos: el texto de la URL nunca se pinta tal cual.
const ERRORES: Record<string, string> = {
  enlace: 'El enlace no es válido o ha caducado.',
  sso: 'No se pudo completar el acceso con tu proveedor de identidad.',
  sesion: 'Tu sesión ha caducado. Vuelve a entrar.',
};

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente = '/', error: codigo } = await searchParams;
  const error = codigo ? ERRORES[codigo] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.' : null;
  return (
    <MarcoAcceso titulo="Inicia sesión" subtitulo="Accede a tu agencia y a tus subcuentas.">
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <FormularioLogin siguiente={siguiente} />
    </MarcoAcceso>
  );
}
