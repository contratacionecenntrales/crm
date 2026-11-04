import 'server-only';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { crearClienteServidor } from '@/lib/supabase/server';
import { resolverUrl } from '@/lib/menu/enlaces';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Enlace de menú abierto dentro de la app (modo «iframe»). Solo se muestra si
// el enlace está visible para quien lo abre en esta vista.
export async function VistaEnlace({ enlaceId, agenciaId, subcuentaId }: { enlaceId: string; agenciaId: string | null; subcuentaId: string | null }) {
  if (!UUID.test(enlaceId)) notFound();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('enlaces_menu', { p_agencia: agenciaId, p_subcuenta: subcuentaId });
  const e = ((data ?? []) as { id: string; nombre: string; url: string }[]).find((x) => x.id === enlaceId);
  if (!e) notFound();
  const url = resolverUrl(e.url, { subcuenta: subcuentaId, agencia: agenciaId });
  return (
    <div className="flex h-[calc(100dvh-93px)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-borde bg-superficie px-4 py-2 font-sans">
        <h1 className="truncate text-sm font-medium text-texto">{e.nombre}</h1>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primario-texto hover:underline">
          <ExternalLink className="size-3.5" /> Abrir en otra pestaña
        </a>
      </div>
      <iframe src={url} title={e.nombre} className="w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerPolicy="strict-origin-when-cross-origin" />
      <p className="sr-only">Si la página no carga, puede que no permita mostrarse dentro de otra web: usa «Abrir en otra pestaña».</p>
    </div>
  );
}
