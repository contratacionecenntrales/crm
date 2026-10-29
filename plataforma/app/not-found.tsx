import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-primario">404</p>
      <h1 className="text-lg font-semibold">No encontramos esta página</h1>
      <p className="text-sm text-tenue">Puede que no exista o que no tengas acceso.</p>
      <Link href="/" className="text-sm text-primario hover:underline">Ir al inicio</Link>
    </main>
  );
}
