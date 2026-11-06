import { notFound } from 'next/navigation';
import { usuarioActual } from '@/lib/sesion';
import { PLANTILLAS } from '@/lib/embudos/plantillas';
import { PaginaEmbudo } from '@/components/embudos/Renderizado';

export const metadata = { title: 'Vista previa de plantilla', robots: { index: false } };

// Vista previa a pantalla completa de una plantilla (para elegirla con calma).
export default async function VistaPlantilla({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paso?: string }> }) {
  await usuarioActual();
  const { id } = await params;
  const { paso } = await searchParams;
  const p = PLANTILLAS.find((x) => x.id === id);
  if (!p) notFound();
  const pasos = p.pasos();
  const i = Math.min(Math.max(Number(paso ?? 0) || 0, 0), pasos.length - 1);
  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-black/10 bg-white/90 px-4 py-2 font-sans text-sm text-[#101828] backdrop-blur">
        <span className="font-semibold">{p.nombre}</span>
        <span className="text-[#667085]">· Vista previa</span>
        <span className="ml-auto flex gap-1">
          {pasos.map((x, k) => <a key={k} href={`?paso=${k}`} className={`rounded-md px-2.5 py-1 ${k === i ? 'bg-[#101828] text-white' : 'hover:bg-black/5'}`}>{x.nombre}</a>)}
        </span>
      </div>
      <PaginaEmbudo contenido={pasos[i].contenido} ctx={{ pasoId: '', siguiente: null, vistaPrevia: true }} />
    </>
  );
}
