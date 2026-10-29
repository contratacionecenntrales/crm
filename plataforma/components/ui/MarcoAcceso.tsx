export function MarcoAcceso({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-superficie p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <div className="mb-4 text-xl font-bold tracking-tight text-primario">METATOK</div>
          <h1 className="text-xl font-semibold">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-tenue">{subtitulo}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
