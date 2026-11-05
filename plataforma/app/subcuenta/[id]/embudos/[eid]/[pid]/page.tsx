import { notFound } from 'next/navigation';
import { subcuentaVisible } from '@/lib/sesion';
import { supabaseUrl } from '@/lib/env';
import { crearClienteServidor } from '@/lib/supabase/server';
import { urlPublicaMedio } from '@/lib/medios';
import { esquemaContenido, ESTILO_DEFECTO, type Contenido } from '@/lib/embudos/tipos';
import { EditorPagina } from '@/components/embudos/EditorPagina';

export const metadata = { title: 'Editor de página' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditor({ params }: { params: Promise<{ id: string; eid: string; pid: string }> }) {
  const { id, eid, pid } = await params;
  if (!UUID.test(eid) || !UUID.test(pid)) notFound();
  await subcuentaVisible(id);
  const supabase = await crearClienteServidor();
  const [{ data: embudo }, { data: paso }, { data: pasos }, { data: medios }, { data: calendarios }] = await Promise.all([
    supabase.from('emb_embudos').select('id, nombre, slug, publicado').eq('id', eid).eq('subcuenta_id', id).maybeSingle(),
    supabase.from('emb_pasos').select('id, nombre, ruta, contenido, publicado_en, actualizado').eq('id', pid).eq('embudo_id', eid).eq('subcuenta_id', id).maybeSingle(),
    supabase.from('emb_pasos').select('id, nombre, orden').eq('embudo_id', eid).order('orden'),
    supabase.from('medios').select('id, ruta, nombre, tipo').eq('subcuenta_id', id).like('tipo', 'image/%').order('creado', { ascending: false }).limit(300),
    supabase.from('cal_calendarios').select('nombre, slug, activo').eq('subcuenta_id', id).order('nombre'),
  ]);
  if (!embudo || !paso) notFound();
  const v = esquemaContenido.safeParse(paso.contenido);
  const contenido: Contenido = v.success ? (v.data as Contenido) : { estilo: ESTILO_DEFECTO, secciones: [] };
  const base = supabaseUrl();
  const imagenes = (medios ?? []).map((m) => ({ id: m.id as string, nombre: m.nombre as string, url: urlPublicaMedio(base, m.ruta as string) }));
  const indice = (pasos ?? []).findIndex((p) => p.id === pid);
  return (
    <EditorPagina
      subId={id} embudo={embudo as { id: string; nombre: string; slug: string; publicado: boolean }}
      paso={{ id: paso.id as string, nombre: paso.nombre as string, ruta: paso.ruta as string, publicado_en: paso.publicado_en as string | null, primero: indice === 0 }}
      pasos={(pasos ?? []).map((p) => ({ id: p.id as string, nombre: p.nombre as string }))}
      inicial={contenido} imagenes={imagenes}
      calendarios={(calendarios ?? []).map((c) => ({ nombre: c.nombre as string, slug: c.slug as string, activo: c.activo as boolean }))}
    />
  );
}
