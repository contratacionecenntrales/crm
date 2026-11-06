import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { crearClienteAnonimo } from '@/lib/supabase/anonimo';
import { esquemaContenido, ESTILO_DEFECTO, type Contenido } from '@/lib/embudos/tipos';
import { PaginaEmbudo } from '@/components/embudos/Renderizado';
import { Visita } from '@/components/embudos/Visita';
import { CabeceraSitio, PieSitio } from '@/components/embudos/Sitio';
import type { ConfigSitio } from '@/lib/embudos/sitios';

type P = { params: Promise<{ slug: string; ruta?: string[] }> };
interface Pagina { paso_id: string; embudo: string; slug: string; ruta: string; nombre: string; contenido: unknown; siguiente: string | null; seo_titulo: string; seo_descripcion: string; empresa: string; logo: string | null; tipo?: 'embudo' | 'sitio'; config?: Partial<ConfigSitio>; menu?: { nombre: string; ruta: string }[] }

async function cargar(slug: string, ruta?: string[]): Promise<Pagina | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug) || (ruta && (ruta.length > 1 || !/^[a-z0-9-]{1,60}$/.test(ruta[0])))) return null;
  const { data } = await crearClienteAnonimo().rpc('emb_pagina_publica', { p_slug: slug, p_ruta: ruta?.[0] ?? '' });
  return (data as Pagina | null) ?? null;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug, ruta } = await params;
  const p = await cargar(slug, ruta);
  if (!p) return { title: 'Página no encontrada' };
  return { title: p.seo_titulo || (p.tipo === 'sitio' ? `${p.nombre} · ${p.config?.marca || p.empresa}` : `${p.nombre} · ${p.empresa}`), description: p.seo_descripcion || undefined };
}

// Página pública de un embudo: /f/<embudo> (primer paso) o /f/<embudo>/<paso>.
export default async function PaginaPublicaEmbudo({ params }: P) {
  const { slug, ruta } = await params;
  const p = await cargar(slug, ruta);
  if (!p) notFound();
  const v = esquemaContenido.safeParse(p.contenido);
  const contenido: Contenido = v.success ? (v.data as Contenido) : { estilo: ESTILO_DEFECTO, secciones: [] };
  const base = `/f/${p.slug}`;
  const menu = p.menu ?? [];
  const ctx = { pasoId: p.paso_id, siguiente: p.siguiente ? `${base}/${p.siguiente}` : null, base, primera: menu[0]?.ruta };
  if (p.tipo === 'sitio') {
    const props = { config: p.config ?? {}, menu, base, actual: p.ruta, estilo: contenido.estilo, empresa: p.empresa, logoEmpresa: p.logo };
    return (
      <div style={{ background: contenido.estilo.fondo }}>
        <Visita pasoId={p.paso_id} />
        <CabeceraSitio {...props} />
        <PaginaEmbudo contenido={contenido} ctx={ctx} />
        <PieSitio {...props} />
      </div>
    );
  }
  return (
    <>
      <Visita pasoId={p.paso_id} />
      <PaginaEmbudo contenido={contenido} ctx={ctx} />
    </>
  );
}
