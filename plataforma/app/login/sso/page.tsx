import Link from 'next/link';
import { MarcoAcceso } from '@/components/ui/MarcoAcceso';
import { FormularioSso } from './FormularioSso';

export const metadata = { title: 'Inicio de sesión único' };

export default async function PaginaSso({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente = '/' } = await searchParams;
  return (
    <MarcoAcceso titulo="Inicio de sesión único" subtitulo="Entra con la cuenta de tu empresa.">
      <FormularioSso siguiente={siguiente} />
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-primario hover:underline">Entrar con contraseña</Link></p>
    </MarcoAcceso>
  );
}
