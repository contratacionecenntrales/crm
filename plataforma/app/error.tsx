'use client';

export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Algo ha fallado</h1>
      <p className="max-w-md text-sm text-tenue">{error.message || 'Error inesperado.'}</p>
      {error.digest && <p className="text-xs text-tenue">Referencia: {error.digest}</p>}
      <button onClick={reset} className="rounded-lg bg-primario px-4 py-2 text-sm font-medium text-white">Reintentar</button>
    </main>
  );
}
