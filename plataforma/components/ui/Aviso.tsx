import type { Resultado } from '@/lib/tipos';

export function Aviso({ estado }: { estado: Resultado | null }) {
  if (!estado) return null;
  if (estado.ok) {
    return estado.mensaje ? (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        {estado.mensaje}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {estado.error}
    </p>
  );
}
