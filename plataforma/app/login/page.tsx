import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { FormularioLogin } from './Formulario';

export const metadata = { title: 'Iniciar sesión' };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente = '/', error } = await searchParams;
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
