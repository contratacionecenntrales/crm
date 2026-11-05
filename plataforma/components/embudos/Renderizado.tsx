import { Check } from 'lucide-react';
import { enlaceSeguro, imagenSegura, videoInsertable, type Bloque, type Contenido, type Seccion } from '@/lib/embudos/tipos';
import { textoSobre } from '@/lib/embudos/color';
import { FormularioPublico } from './FormularioPublico';
import { CuentaAtras } from './CuentaAtras';

// Renderizado de una página de embudo. Lo usan la página pública y el editor.
// Todo el texto se pinta como texto (sin HTML), y los enlaces se filtran.

export interface ContextoPagina {
  pasoId: string;
  siguiente: string | null; // URL del paso siguiente (o null)
  vistaPrevia?: boolean; // en el editor: formularios y enlaces no navegan
}

const FUENTES = { sans: "'Inter', ui-sans-serif, system-ui, sans-serif", serif: "Georgia, 'Times New Roman', serif", redondeada: "ui-rounded, 'Nunito', 'Arial Rounded MT Bold', system-ui, sans-serif" };
const ALI = { izquierda: 'text-left', centro: 'text-center', derecha: 'text-right' } as const;
const JUST = { izquierda: 'justify-start', centro: 'justify-center', derecha: 'justify-end' } as const;
const RELLENO = { pequeno: 'py-8', normal: 'py-14', grande: 'py-24' } as const;
const ANCHO = { estrecho: 'max-w-2xl', normal: 'max-w-4xl', ancho: 'max-w-6xl' } as const;

function destino(accion: 'siguiente' | 'url' | 'ancla', url: string, ctx: ContextoPagina): string | undefined {
  if (accion === 'siguiente') return ctx.siguiente ?? undefined;
  return enlaceSeguro(url) ?? undefined;
}

export function BloqueVista({ b, ctx, color, texto }: { b: Bloque; ctx: ContextoPagina; color: string; texto: string }) {
  switch (b.tipo) {
    case 'titulo': {
      const Etiqueta = (`h${b.nivel}`) as 'h1' | 'h2' | 'h3';
      const tam = b.nivel === 1 ? 'text-4xl sm:text-5xl' : b.nivel === 2 ? 'text-3xl sm:text-4xl' : 'text-2xl';
      return <Etiqueta className={`${tam} font-bold leading-tight tracking-tight ${ALI[b.alineacion]} whitespace-pre-line [overflow-wrap:anywhere]`}>{b.texto}</Etiqueta>;
    }
    case 'texto':
      return <p className={`${b.tamano === 'grande' ? 'text-xl' : 'text-[17px]'} leading-relaxed opacity-90 ${ALI[b.alineacion]} whitespace-pre-line [overflow-wrap:anywhere]`}>{b.texto}</p>;
    case 'imagen': {
      const src = imagenSegura(b.url);
      if (!src) return ctx.vistaPrevia ? <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-current/30 text-sm opacity-60">Elige una imagen</div> : null;
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={b.alt} loading="lazy" className={`mx-auto h-auto ${b.ancho === 'medio' ? 'w-full max-w-md' : 'w-full'} ${b.redondeada ? 'rounded-2xl' : ''}`} />;
    }
    case 'boton': {
      const href = destino(b.accion, b.url, ctx);
      const clase = `inline-flex items-center justify-center rounded-lg font-semibold text-white shadow-sm transition hover:brightness-110 ${b.tamano === 'grande' ? 'px-8 py-4 text-lg' : 'px-6 py-3 text-base'}`;
      return (
        <div className={`flex ${JUST[b.alineacion]}`}>
          {href && !ctx.vistaPrevia
            ? <a href={href} className={clase} style={{ background: color }} {...(/^https?:/.test(href) && !href.includes('/f/') ? { rel: 'noopener noreferrer' } : {})}>{b.texto || 'Continuar'}</a>
            : <span className={clase} style={{ background: color }}>{b.texto || 'Continuar'}</span>}
        </div>
      );
    }
    case 'video': {
      const src = videoInsertable(b.url);
      if (!src) return ctx.vistaPrevia ? <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-current/30 text-sm opacity-60">Pega un enlace de YouTube o Vimeo</div> : null;
      return <div className="aspect-video overflow-hidden rounded-xl shadow-lg"><iframe src={src} title="Vídeo" className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" /></div>;
    }
    case 'formulario':
      return <FormularioPublico b={b} pasoId={ctx.pasoId} destinoSiguiente={ctx.siguiente} color={color} vistaPrevia={ctx.vistaPrevia} />;
    case 'lista': {
      const Lista = b.icono === 'numero' ? 'ol' : 'ul';
      return (
        <Lista className="mx-auto max-w-xl space-y-2.5 text-left text-[17px]">
          {b.elementos.filter(Boolean).map((e, i) => (
            <li key={i} className="flex items-start gap-3">
              {b.icono === 'check' ? <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}><Check className="size-4" /></span>
                : b.icono === 'numero' ? <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>{i + 1}</span>
                : <span className="mt-2.5 size-2 shrink-0 rounded-full" style={{ background: color }} />}
              <span className="[overflow-wrap:anywhere]">{e}</span>
            </li>
          ))}
        </Lista>
      );
    }
    case 'testimonio': {
      const foto = imagenSegura(b.foto);
      return (
        <figure className="mx-auto max-w-2xl rounded-2xl bg-white/90 p-6 text-left text-[#101828] shadow-md">
          <blockquote className="text-lg leading-relaxed [overflow-wrap:anywhere]">“{b.cita}”</blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {foto ? <img src={foto} alt="" className="size-11 rounded-full object-cover" /> : <span className="flex size-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>{(b.autor || '?')[0]}</span>}
            <span><span className="block font-semibold">{b.autor}</span>{b.cargo && <span className="block text-sm text-[#667085]">{b.cargo}</span>}</span>
          </figcaption>
        </figure>
      );
    }
    case 'precio': {
      const href = destino(b.accion, b.url, ctx);
      return (
        <div className={`mx-auto max-w-sm rounded-2xl bg-white p-7 text-left text-[#101828] shadow-lg ${b.destacado ? 'ring-4' : 'ring-1 ring-black/5'}`} style={b.destacado ? { ['--tw-ring-color' as string]: color } : undefined}>
          {b.destacado && <span className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: color }}>Recomendado</span>}
          <h3 className="text-xl font-semibold">{b.titulo}</h3>
          <p className="mt-3"><span className="text-4xl font-bold">{b.precio}</span> <span className="text-[#667085]">{b.periodo}</span></p>
          <ul className="mt-5 space-y-2 text-[15px]">{b.caracteristicas.filter(Boolean).map((c, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" style={{ color }} />{c}</li>)}</ul>
          {href && !ctx.vistaPrevia
            ? <a href={href} className="mt-6 block rounded-lg py-3 text-center font-semibold text-white" style={{ background: color }}>{b.boton || 'Empezar'}</a>
            : <span className="mt-6 block rounded-lg py-3 text-center font-semibold text-white" style={{ background: color }}>{b.boton || 'Empezar'}</span>}
        </div>
      );
    }
    case 'cuenta_atras':
      return <CuentaAtras hasta={b.hasta} textoFin={b.texto_fin} color={color} />;
    case 'calendario':
      if (!/^[a-z0-9-]{3,60}$/.test(b.slug)) return ctx.vistaPrevia ? <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-current/30 text-sm opacity-60">Elige un calendario</div> : null;
      return <iframe src={`/reservar/${b.slug}`} title="Reservar cita" className="w-full rounded-xl border-0 bg-white shadow-md" style={{ height: b.alto }} loading="lazy" />;
    case 'separador':
      return b.estilo === 'linea' ? <hr className="mx-auto w-24 border-t-2" style={{ borderColor: color, marginBlock: b.alto / 2 }} /> : <div style={{ height: b.alto }} aria-hidden />;
    default:
      return null;
  }
}

export function SeccionVista({ s, ctx, color, children }: { s: Seccion; ctx: ContextoPagina; color: string; children?: React.ReactNode }) {
  const texto = textoSobre(s.fondo);
  return (
    <section id={s.ancla || `s-${s.id}`} className={`px-5 ${RELLENO[s.relleno]}`} style={{ background: s.fondo, color: texto }}>
      <div className={`mx-auto flex ${ANCHO[s.ancho]} flex-col gap-6`}>
        {children ?? s.bloques.map((b) => <BloqueVista key={b.id} b={b} ctx={ctx} color={color} texto={texto} />)}
      </div>
    </section>
  );
}

export function PaginaEmbudo({ contenido, ctx }: { contenido: Contenido; ctx: ContextoPagina }) {
  return (
    <main style={{ fontFamily: FUENTES[contenido.estilo.fuente] ?? FUENTES.sans, background: contenido.estilo.fondo }} className="min-h-dvh">
      {contenido.secciones.map((s) => <SeccionVista key={s.id} s={s} ctx={ctx} color={contenido.estilo.color_primario} />)}
    </main>
  );
}

export const fuenteDe = (f: Contenido['estilo']['fuente']) => FUENTES[f] ?? FUENTES.sans;
