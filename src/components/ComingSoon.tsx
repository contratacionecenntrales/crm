export function ComingSoon({ label, description }: { label: string; description: string }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start px-6 py-16">
      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-gray-500">
        Próximamente
      </span>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{label}</h1>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <p className="mt-6 text-sm text-gray-400">
        Este módulo todavía no está implementado. Cuéntanos qué debe hacer y lo construimos.
      </p>
    </main>
  );
}
