import { notFound } from 'next/navigation';
import { usuarioActual } from '@/lib/sesion';
import { PLANTILLAS } from '@/lib/embudos/plantillas';
import { CONFIG_VACIA, PLANTILLAS_SITIO } from '@/lib/embudos/sitios';
import { PaginaEmbudo } from '@/components/embudos/Renderizado';
import { CabeceraSitio, PieSitio } from '@/components/embudos/Sitio';

export const metadata = { title: 'Vista previa de plantilla', robots: { index: false } };

// Vista previa a pantalla completa de una plantilla de embudo o de sitio.
export default async function VistaPlantilla({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paso?: string; tipo?: string }> }) {
  await usuarioActual();
  const { id } = await params;
  const q = await searchParams;
  const sitio = q.tipo === 'sitio' ? PLANTILLAS_SITIO.find((x) => x.id === id) : null;
  const embudo = !sitio ? PLANTILLAS.find((x) => x.id === id) : null;
  if (!sitio && !embudo) notFound();
  const pasos = sitio ? sitio.paginas() : embudo!.pasos();
  const nombre = sitio?.nombre ?? embudo!.nombre;
  const i = Math.min(Math.max(Number(q.paso ?? 0) || 0, 0), pasos.length - 1);
  const contenido = pasos[i].contenido;
  const sufijo = sitio ? '&tipo=sitio' : '';
  const menu = pasos.map((p) => ({ nombre: p.nombre, ruta: p.ruta }));
  const props = sitio ? { config: { ...CONFIG_VACIA, ...sitio.config }, menu, base: '', actual: pasos[i].ruta, estilo: contenido.estilo, empresa: sitio.config.marca ?? nombre, vistaPrevia: true } : null;
  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-black/10 bg-white/90 px-4 py-2 font-sans text-sm text-[#101828] backdrop-blur">
        <span className="font-semibold">{nombre}</span>
        <span className="text-[#667085]">· Vista previa</span>
        <span className="ml-auto flex flex-wrap gap-1">
          {pasos.map((x, k) => <a key={k} href={`?paso=${k}${sufijo}`} className={`rounded-md px-2.5 py-1 ${k === i ? 'bg-[#101828] text-white' : 'hover:bg-black/5'}`}>{x.nombre}</a>)}
        </span>
      </div>
      <div style={{ background: contenido.estilo.fondo }}>
        {props && <CabeceraSitio {...props} />}
        <PaginaEmbudo contenido={contenido} ctx={{ pasoId: '', siguiente: null, vistaPrevia: true }} />
        {props && <PieSitio {...props} />}
      </div>
    </>
  );
}
