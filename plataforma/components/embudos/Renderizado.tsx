import {
  ArrowRight, BarChart3, BookOpen, Calendar, Camera, Check, Clock, CreditCard, Euro, Gift, Globe, Heart, Home, Leaf, Lock, Mail, MapPin,
  MessageCircle, Phone, Plus, Rocket, Shield, Sparkles, Star, Sun, Target, Trophy, User, Users, Wrench, Zap,
} from 'lucide-react';
import { enlaceSeguro, imagenSegura, videoInsertable, type Bloque, type Contenido, type Fuente, type Seccion, type Visual } from '@/lib/embudos/tipos';
import { conAlfa, esOscuro, mezclar, textoSobre } from '@/lib/embudos/color';
import { FormularioPublico } from './FormularioPublico';
import { CuentaAtras } from './CuentaAtras';

// Renderizado de una página de embudo o sitio. Lo usan la página pública y el
// editor. Todo el texto se pinta como texto (sin HTML) y los enlaces se filtran.

export interface ContextoPagina {
  pasoId: string;
  siguiente: string | null; // URL del paso siguiente (o null)
  vistaPrevia?: boolean; // en el editor: formularios y enlaces no navegan
}

// --- Tipografía ------------------------------------------------------------------
const FUENTES: Record<Fuente, { titulo: string; texto: string; google?: string }> = {
  sans: { titulo: "'Inter', ui-sans-serif, system-ui, sans-serif", texto: "'Inter', ui-sans-serif, system-ui, sans-serif" },
  serif: { titulo: "Georgia, 'Times New Roman', serif", texto: "Georgia, 'Times New Roman', serif" },
  redondeada: { titulo: "'Nunito', ui-rounded, system-ui, sans-serif", texto: "'Nunito', ui-rounded, system-ui, sans-serif", google: 'Nunito:wght@400;600;700;800' },
  elegante: { titulo: "'Playfair Display', Georgia, serif", texto: "'Inter', ui-sans-serif, system-ui, sans-serif", google: 'Playfair+Display:wght@500;600;700' },
  geometrica: { titulo: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif", texto: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif", google: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  editorial: { titulo: "'Fraunces', Georgia, serif", texto: "'Inter', ui-sans-serif, system-ui, sans-serif", google: 'Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700' },
};
export const fuenteDe = (f: Fuente) => (FUENTES[f] ?? FUENTES.sans).texto;
export const fuenteTitulo = (f: Fuente) => (FUENTES[f] ?? FUENTES.sans).titulo;
// Hoja de Google Fonts de la tipografía elegida (React la sube al <head>).
export function Tipografia({ fuente }: { fuente: Fuente }) {
  const g = FUENTES[fuente]?.google;
  return g ? <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${g}&display=swap`} precedence="default" /> : null;
}

// --- Tema de una sección -----------------------------------------------------------
export interface Tema { color: string; acento: string; oscuro: boolean; radio: 'recto' | 'suave' | 'redondo'; titulo: string }
export function temaDe(estilo: Contenido['estilo'], s?: Seccion): Tema {
  const color = estilo.color_primario;
  const acento = estilo.color_acento ?? mezclar(color, '#a855f7', 0.55);
  let oscuro = false;
  if (s) {
    if (s.fondo_tipo === 'imagen' && imagenSegura(s.imagen_fondo ?? '')) oscuro = true;
    else if (s.fondo_tipo === 'degradado') oscuro = esOscuro(mezclar(s.fondo, s.fondo2 ?? mezclar(s.fondo, color, 0.5), 0.5));
    else oscuro = esOscuro(s.fondo);
  }
  return { color, acento, oscuro, radio: estilo.radio ?? 'suave', titulo: fuenteTitulo(estilo.fuente) };
}
const tinta = (t: Tema) => (t.oscuro
  ? { fuerte: '#ffffff', cuerpo: 'rgba(255,255,255,0.78)', suave: 'rgba(255,255,255,0.58)', tarjeta: 'rgba(255,255,255,0.06)', borde: 'rgba(255,255,255,0.12)' }
  : { fuerte: '#0b1220', cuerpo: '#475467', suave: '#667085', tarjeta: '#ffffff', borde: '#eaecf0' });
const rTarjeta = (t: Tema) => (t.radio === 'recto' ? 'rounded-none' : t.radio === 'redondo' ? 'rounded-[28px]' : 'rounded-2xl');
const rBoton = (t: Tema) => (t.radio === 'recto' ? 'rounded-none' : t.radio === 'redondo' ? 'rounded-full' : 'rounded-xl');

const ALI = { izquierda: 'text-left', centro: 'text-center', derecha: 'text-right' } as const;
const JUST = { izquierda: 'justify-start', centro: 'justify-center', derecha: 'justify-end' } as const;
const RELLENO = { pequeno: 'py-10', normal: 'py-16 sm:py-20', grande: 'py-20 sm:py-28' } as const;
const ANCHO = { estrecho: 'max-w-2xl', normal: 'max-w-5xl', ancho: 'max-w-6xl' } as const;

export const ICONOS = {
  rayo: Zap, estrella: Star, corazon: Heart, escudo: Shield, reloj: Clock, calendario: Calendar, chat: MessageCircle, telefono: Phone,
  grafico: BarChart3, cohete: Rocket, check: Check, usuario: User, usuarios: Users, dinero: Euro, tarjeta: CreditCard, regalo: Gift,
  ubicacion: MapPin, camara: Camera, herramienta: Wrench, hoja: Leaf, casa: Home, trofeo: Trophy, globo: Globe, candado: Lock, sol: Sun,
  correo: Mail, ia: Sparkles, objetivo: Target, libro: BookOpen,
} as const;
const Icono = ({ nombre, className, style }: { nombre: string; className?: string; style?: React.CSSProperties }) => {
  const I = ICONOS[nombre as keyof typeof ICONOS] ?? Sparkles;
  return <I className={className} style={style} aria-hidden />;
};

function destino(accion: 'siguiente' | 'url' | 'ancla', url: string, ctx: ContextoPagina): string | undefined {
  if (accion === 'siguiente') return ctx.siguiente ?? undefined;
  return enlaceSeguro(url) ?? undefined;
}

// Texto con *palabras destacadas* (entre asteriscos) en degradado de marca.
function Destacado({ texto, t }: { texto: string; t: Tema }) {
  const partes = texto.split(/(\*[^*\n]{1,80}\*)/g);
  return <>{partes.map((p, i) => /^\*[^*]+\*$/.test(p)
    ? <span key={i} className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(100deg, ${t.oscuro ? mezclar(t.color, '#ffffff', 0.35) : t.color}, ${t.acento})` }}>{p.slice(1, -1)}</span>
    : p)}</>;
}

function Boton({ texto, accion, url, ctx, t, variante = 'primario', grande }: { texto: string; accion: 'siguiente' | 'url' | 'ancla'; url: string; ctx: ContextoPagina; t: Tema; variante?: 'primario' | 'secundario' | 'claro'; grande?: boolean }) {
  if (!texto) return null;
  const href = destino(accion, url, ctx);
  const tk = tinta(t);
  const base = `inline-flex items-center justify-center gap-2 font-semibold transition duration-200 hover:-translate-y-0.5 ${rBoton(t)} ${grande ? 'px-7 py-3.5 text-[16px]' : 'px-5 py-2.5 text-[15px]'}`;
  const estilo: React.CSSProperties = variante === 'primario'
    ? { background: `linear-gradient(135deg, ${t.color}, ${mezclar(t.color, t.acento, 0.45)})`, color: '#fff', boxShadow: `0 10px 30px -10px ${conAlfa(t.color, 0.6)}` }
    : variante === 'claro' ? { background: '#ffffff', color: t.color, boxShadow: '0 10px 30px -12px rgba(0,0,0,0.35)' }
      : { border: `1px solid ${tk.borde}`, color: tk.fuerte, background: t.oscuro ? 'rgba(255,255,255,0.04)' : '#ffffff' };
  const contenido = <>{texto}{variante !== 'secundario' && <ArrowRight className="size-4" aria-hidden />}</>;
  return href && !ctx.vistaPrevia
    ? <a href={href} className={base} style={estilo} {...(/^https?:/.test(href) && !href.includes('/f/') ? { rel: 'noopener noreferrer' } : {})}>{contenido}</a>
    : <span className={base} style={estilo}>{contenido}</span>;
}

function Encabezado({ etiqueta, titulo, subtitulo, t, centro = true }: { etiqueta?: string; titulo?: string; subtitulo?: string; t: Tema; centro?: boolean }) {
  if (!etiqueta && !titulo && !subtitulo) return null;
  const tk = tinta(t);
  return (
    <div className={`mb-10 sm:mb-12 ${centro ? 'mx-auto max-w-2xl text-center' : ''}`}>
      {etiqueta && <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: t.oscuro ? mezclar(t.color, '#ffffff', 0.45) : t.color }}>{etiqueta}</p>}
      {titulo && <h2 className="text-[30px] font-semibold leading-[1.12] tracking-tight [overflow-wrap:anywhere] sm:text-[42px]" style={{ color: tk.fuerte, fontFamily: t.titulo }}><Destacado texto={titulo} t={t} /></h2>}
      {subtitulo && <p className="mt-4 text-[17px] leading-relaxed [overflow-wrap:anywhere] sm:text-lg" style={{ color: tk.cuerpo }}>{subtitulo}</p>}
    </div>
  );
}

// --- Ilustraciones CSS -------------------------------------------------------------
function Ilustracion({ visual, imagen, t, vistaPrevia }: { visual: Visual; imagen: string; t: Tema; vistaPrevia?: boolean }) {
  const r = rTarjeta(t);
  if (visual === 'ninguno') return null;
  if (visual === 'imagen') {
    const src = imagenSegura(imagen);
    // eslint-disable-next-line @next/next/no-img-element
    if (src) return <img src={src} alt="" loading="lazy" className={`h-auto w-full object-cover shadow-2xl ${r}`} style={{ boxShadow: `0 40px 80px -30px ${conAlfa(t.color, 0.45)}` }} />;
    return vistaPrevia ? <div className={`flex aspect-[4/3] items-center justify-center border-2 border-dashed border-current/30 text-sm opacity-60 ${r}`}>Elige una imagen</div> : null;
  }
  const halo = <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full blur-3xl" style={{ background: `radial-gradient(closest-side, ${conAlfa(t.color, 0.35)}, transparent)` }} />;
  if (visual === 'panel') {
    const barras = [38, 52, 44, 63, 58, 72, 66, 81, 75, 90, 84, 96];
    return (
      <div className="relative isolate" aria-hidden>{halo}
        <div className={`overflow-hidden border border-black/5 bg-white text-left text-[#101828] shadow-2xl ${r}`}>
          <div className="flex items-center gap-1.5 border-b border-[#eaecf0] bg-[#f9fafb] px-4 py-3">{['#f97066', '#fdb022', '#32d583'].map((c) => <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />)}<span className="ml-3 h-2 w-40 rounded-full bg-[#eaecf0]" /></div>
          <div className="grid grid-cols-[72px_1fr] sm:grid-cols-[110px_1fr]">
            <div className="space-y-3 border-r border-[#eaecf0] p-3">{[1, 0.6, 0.6, 0.6, 0.6].map((o, i) => <div key={i} className="h-2.5 rounded-full" style={{ background: i === 0 ? t.color : '#eaecf0', opacity: o }} />)}</div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2.5">
                {[['Leads', '+128'], ['Citas', '34'], ['Ventas', '18,4k']].map(([a, v], i) => (
                  <div key={a} className="rounded-xl border border-[#eaecf0] p-2.5"><p className="text-[10px] text-[#667085]">{a}</p><p className="text-[15px] font-bold" style={{ color: i === 0 ? t.color : '#101828' }}>{v}</p></div>
                ))}
              </div>
              <div className="mt-3 flex h-28 items-end gap-1.5 rounded-xl border border-[#eaecf0] p-3">
                {barras.map((h, i) => <span key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `linear-gradient(180deg, ${t.color}, ${conAlfa(t.acento, 0.55)})`, opacity: 0.35 + (i / barras.length) * 0.65 }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (visual === 'movil' || visual === 'chat') {
    const burbujas: [boolean, string][] = [[false, 'Hola 👋 ¿Tenéis cita este jueves?'], [true, '¡Hola! Sí, a las 17:30 o a las 19:00. ¿Cuál te viene mejor?'], [false, 'A las 19:00 perfecto'], [true, 'Reservado ✅ Te envío un recordatorio el día antes.']];
    const chat = (
      <div className="space-y-2 p-3 text-[12.5px] leading-snug">
        {burbujas.map(([negocio, txt], i) => (
          <div key={i} className={`flex ${negocio ? 'justify-start' : 'justify-end'}`}>
            <span className={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${negocio ? 'rounded-bl-md bg-white text-[#101828]' : 'rounded-br-md text-white'}`} style={negocio ? undefined : { background: t.color }}>{txt}</span>
          </div>
        ))}
      </div>
    );
    if (visual === 'chat') return (
      <div className="relative isolate mx-auto w-full max-w-sm" aria-hidden>{halo}
        <div className={`overflow-hidden border border-black/5 bg-[#f2f4f7] shadow-2xl ${r}`}>
          <div className="flex items-center gap-2.5 px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.acento})` }}>
            <span className="flex size-8 items-center justify-center rounded-full bg-white/20"><Sparkles className="size-4" /></span>
            <span><span className="block text-sm font-semibold">Asistente</span><span className="block text-[11px] opacity-80">Responde en segundos</span></span>
          </div>{chat}
        </div>
      </div>
    );
    return (
      <div className="relative isolate mx-auto w-[260px]" aria-hidden>{halo}
        <div className="rounded-[2.6rem] border-[10px] border-[#101828] bg-[#e7ddd3] shadow-2xl">
          <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-[#101828]" />
          <div className="mt-2 flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white"><span className="size-7 rounded-full bg-white/25" /><span className="text-[13px] font-semibold">Tu negocio</span></div>
          <div className="h-[380px]">{chat}</div>
        </div>
      </div>
    );
  }
  // tarjetas flotantes
  return (
    <div className="relative isolate mx-auto h-[340px] w-full max-w-md text-left text-[#101828]" aria-hidden>{halo}
      <div className={`absolute left-0 top-4 w-64 -rotate-3 border border-black/5 bg-white p-4 shadow-xl ${r}`}>
        <p className="flex items-center gap-2 text-[12px] font-semibold text-[#067647]"><Calendar className="size-4" /> Nueva reserva</p>
        <p className="mt-1 text-[15px] font-semibold">Hoy · 17:30</p><p className="text-[12px] text-[#667085]">Marta G. · Primera visita</p>
      </div>
      <div className={`absolute right-0 top-28 w-60 rotate-2 border border-black/5 bg-white p-4 shadow-xl ${r}`}>
        <p className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="size-4 fill-[#fdb022] text-[#fdb022]" />)}</p>
        <p className="mt-1.5 text-[13px] leading-snug">“Atención de diez. Repetiré seguro.”</p><p className="mt-1 text-[11px] text-[#667085]">Reseña en Google</p>
      </div>
      <div className={`absolute bottom-0 left-8 w-64 -rotate-1 p-4 text-white shadow-xl ${r}`} style={{ background: `linear-gradient(135deg, ${t.color}, ${t.acento})` }}>
        <p className="text-[12px] opacity-85">Contactos esta semana</p><p className="text-[26px] font-bold">+24</p>
        <div className="mt-1 flex h-8 items-end gap-1">{[30, 45, 35, 60, 55, 80, 95].map((h, i) => <span key={i} className="flex-1 rounded-sm bg-white/70" style={{ height: `${h}%` }} />)}</div>
      </div>
    </div>
  );
}

// --- Bloques -----------------------------------------------------------------------
export function BloqueVista({ b, ctx, color, tema }: { b: Bloque; ctx: ContextoPagina; color: string; texto?: string; tema?: Tema }) {
  const t: Tema = tema ?? { color, acento: mezclar(color, '#a855f7', 0.55), oscuro: false, radio: 'suave', titulo: FUENTES.sans.titulo };
  const tk = tinta(t);
  const r = rTarjeta(t);
  const tarjeta: React.CSSProperties = { background: tk.tarjeta, border: `1px solid ${tk.borde}`, boxShadow: t.oscuro ? 'none' : '0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -16px rgba(16,24,40,0.12)' };
  switch (b.tipo) {
    case 'titulo': {
      const Etiqueta = (`h${b.nivel}`) as 'h1' | 'h2' | 'h3';
      const tam = b.nivel === 1 ? 'text-[38px] leading-[1.06] sm:text-[56px]' : b.nivel === 2 ? 'text-[30px] leading-[1.12] sm:text-[40px]' : 'text-[22px] leading-snug sm:text-2xl';
      return <Etiqueta className={`${tam} font-semibold tracking-tight ${ALI[b.alineacion]} whitespace-pre-line [overflow-wrap:anywhere]`} style={{ color: tk.fuerte, fontFamily: t.titulo }}><Destacado texto={b.texto} t={t} /></Etiqueta>;
    }
    case 'texto':
      return <p className={`${b.tamano === 'grande' ? 'text-[19px] sm:text-xl' : 'text-[17px]'} mx-auto max-w-3xl leading-relaxed ${ALI[b.alineacion]} whitespace-pre-line [overflow-wrap:anywhere]`} style={{ color: tk.cuerpo }}>{b.texto}</p>;
    case 'imagen': {
      const src = imagenSegura(b.url);
      if (!src) return ctx.vistaPrevia ? <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-current/30 text-sm opacity-60">Elige una imagen</div> : null;
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={b.alt} loading="lazy" className={`mx-auto h-auto ${b.ancho === 'medio' ? 'w-full max-w-md' : 'w-full'} ${b.redondeada ? r : ''} shadow-xl`} />;
    }
    case 'boton':
      return <div className={`flex ${JUST[b.alineacion]}`}><Boton texto={b.texto || 'Continuar'} accion={b.accion} url={b.url} ctx={ctx} t={t} grande={b.tamano === 'grande'} /></div>;
    case 'video': {
      const src = videoInsertable(b.url);
      if (!src) return ctx.vistaPrevia ? <div className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-current/30 text-sm opacity-60">Pega un enlace de YouTube o Vimeo</div> : null;
      return <div className={`mx-auto aspect-video w-full max-w-4xl overflow-hidden shadow-2xl ${r}`}><iframe src={src} title="Vídeo" className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" /></div>;
    }
    case 'formulario':
      return (
        <div className={`mx-auto w-full max-w-md p-6 sm:p-7 ${r}`} style={t.oscuro ? { background: '#ffffff', boxShadow: '0 30px 60px -30px rgba(0,0,0,0.6)' } : tarjeta}>
          <FormularioPublico b={b} pasoId={ctx.pasoId} destinoSiguiente={ctx.siguiente} color={color} vistaPrevia={ctx.vistaPrevia} />
        </div>
      );
    case 'lista': {
      const Lista = b.icono === 'numero' ? 'ol' : 'ul';
      return (
        <Lista className="mx-auto max-w-xl space-y-3 text-left text-[17px]" style={{ color: tk.cuerpo }}>
          {b.elementos.filter(Boolean).map((e, i) => (
            <li key={i} className="flex items-start gap-3">
              {b.icono === 'check' ? <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full" style={{ background: conAlfa(color, 0.12), color }}><Check className="size-4" /></span>
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
        <figure className={`mx-auto max-w-2xl p-7 text-left ${r}`} style={tarjeta}>
          <p className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="size-4 fill-[#fdb022] text-[#fdb022]" />)}</p>
          <blockquote className="mt-3 text-[18px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: tk.fuerte }}>“{b.cita}”</blockquote>
          <figcaption className="mt-5 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {foto ? <img src={foto} alt="" className="size-11 rounded-full object-cover" /> : <span className="flex size-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>{(b.autor || '?')[0]}</span>}
            <span><span className="block font-semibold" style={{ color: tk.fuerte }}>{b.autor}</span>{b.cargo && <span className="block text-sm" style={{ color: tk.suave }}>{b.cargo}</span>}</span>
          </figcaption>
        </figure>
      );
    }
    case 'precio':
      return <div className="mx-auto w-full max-w-sm"><Plan p={{ nombre: b.titulo, precio: b.precio, periodo: b.periodo, descripcion: '', caracteristicas: b.caracteristicas, boton: b.boton, destacado: b.destacado }} accion={b.accion} url={b.url} ctx={ctx} t={t} /></div>;
    case 'cuenta_atras':
      return <CuentaAtras hasta={b.hasta} textoFin={b.texto_fin} color={color} />;
    case 'calendario':
      if (!/^[a-z0-9-]{3,60}$/.test(b.slug)) return ctx.vistaPrevia ? <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-current/30 text-sm opacity-60">Elige un calendario</div> : null;
      return <iframe src={`/reservar/${b.slug}`} title="Reservar cita" className={`w-full border-0 bg-white shadow-xl ${r}`} style={{ height: b.alto }} loading="lazy" />;
    case 'separador':
      return b.estilo === 'linea' ? <hr className="mx-auto w-24 border-t-2" style={{ borderColor: color, marginBlock: b.alto / 2 }} /> : <div style={{ height: b.alto }} aria-hidden />;

    // ---- v2 ----
    case 'hero': {
      const dividido = b.disposicion === 'dividido' && b.visual !== 'ninguno';
      const texto = (
        <div className={dividido ? 'text-left' : 'mx-auto max-w-3xl text-center'}>
          {b.etiqueta && (
            <span className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium" style={{ background: t.oscuro ? 'rgba(255,255,255,0.08)' : conAlfa(color, 0.08), color: t.oscuro ? '#fff' : color, border: `1px solid ${t.oscuro ? 'rgba(255,255,255,0.15)' : conAlfa(color, 0.2)}` }}>
              <span className="size-1.5 rounded-full" style={{ background: t.oscuro ? '#fff' : color }} />{b.etiqueta}
            </span>
          )}
          <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[60px]" style={{ color: tk.fuerte, fontFamily: t.titulo }}><Destacado texto={b.titulo} t={t} /></h1>
          {b.subtitulo && <p className={`mt-6 text-[18px] leading-relaxed [overflow-wrap:anywhere] sm:text-[20px] ${dividido ? 'max-w-xl' : 'mx-auto max-w-2xl'}`} style={{ color: tk.cuerpo }}>{b.subtitulo}</p>}
          <div className={`mt-9 flex flex-wrap gap-3 ${dividido ? '' : 'justify-center'}`}>
            <Boton texto={b.boton_texto} accion={b.boton_accion} url={b.boton_url} ctx={ctx} t={t} grande />
            <Boton texto={b.boton2_texto} accion={b.boton2_accion} url={b.boton2_url} ctx={ctx} t={t} variante="secundario" grande />
          </div>
          {b.prueba && (
            <div className={`mt-8 flex items-center gap-3 text-[14px] ${dividido ? '' : 'justify-center'}`} style={{ color: tk.suave }}>
              <span className="flex -space-x-2">{['#f79009', '#12b76a', '#7a5af8', color].map((c, i) => <span key={i} className="size-8 rounded-full border-2" style={{ background: `linear-gradient(135deg, ${c}, ${mezclar(c, '#ffffff', 0.4)})`, borderColor: t.oscuro ? '#0b1220' : '#ffffff' }} />)}</span>
              <span><span className="mr-1 inline-flex align-[-2px]">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="size-3.5 fill-[#fdb022] text-[#fdb022]" />)}</span>{b.prueba}</span>
            </div>
          )}
        </div>
      );
      if (dividido) return <div className="grid items-center gap-12 md:grid-cols-[1.05fr_1fr] md:gap-14">{texto}<Ilustracion visual={b.visual} imagen={b.imagen} t={t} vistaPrevia={ctx.vistaPrevia} /></div>;
      return <div>{texto}{b.visual !== 'ninguno' && <div className="mx-auto mt-14 max-w-4xl"><Ilustracion visual={b.visual} imagen={b.imagen} t={t} vistaPrevia={ctx.vistaPrevia} /></div>}</div>;
    }
    case 'caracteristicas': {
      const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[b.columnas];
      return (
        <div>
          <Encabezado titulo={b.titulo} subtitulo={b.subtitulo} t={t} />
          <div className={`grid grid-cols-1 gap-5 ${cols}`}>
            {b.items.map((x, i) => (
              <div key={i} className={`text-left ${b.estilo === 'tarjetas' ? `p-6 ${r} transition hover:-translate-y-1` : 'py-2'}`} style={b.estilo === 'tarjetas' ? tarjeta : undefined}>
                <span className="flex size-11 items-center justify-center rounded-xl" style={{ background: `linear-gradient(135deg, ${conAlfa(color, 0.16)}, ${conAlfa(t.acento, 0.16)})`, color: t.oscuro ? mezclar(color, '#ffffff', 0.45) : color }}><Icono nombre={x.icono} className="size-5" /></span>
                <h3 className="mt-4 text-[18px] font-semibold [overflow-wrap:anywhere]" style={{ color: tk.fuerte }}>{x.titulo}</h3>
                <p className="mt-2 text-[15px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: tk.cuerpo }}>{x.texto}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'imagen_texto':
      return (
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className={`text-left ${b.invertir ? 'md:order-2' : ''}`}>
            <Encabezado etiqueta={b.etiqueta} titulo={b.titulo} t={t} centro={false} />
            {b.texto && <p className="-mt-6 whitespace-pre-line text-[17px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: tk.cuerpo }}>{b.texto}</p>}
            {b.puntos.filter(Boolean).length > 0 && (
              <ul className="mt-6 space-y-3">{b.puntos.filter(Boolean).map((p, i) => (
                <li key={i} className="flex gap-3 text-[16px]" style={{ color: tk.cuerpo }}><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}><Check className="size-3.5" /></span><span className="[overflow-wrap:anywhere]">{p}</span></li>
              ))}</ul>
            )}
            {b.boton_texto && <div className="mt-8"><Boton texto={b.boton_texto} accion={b.boton_accion} url={b.boton_url} ctx={ctx} t={t} /></div>}
          </div>
          <div className={b.invertir ? 'md:order-1' : ''}><Ilustracion visual={b.visual} imagen={b.imagen} t={t} vistaPrevia={ctx.vistaPrevia} /></div>
        </div>
      );
    case 'cifras':
      return (
        <div className={`grid grid-cols-2 gap-y-8 ${b.items.length >= 4 ? 'lg:grid-cols-4' : b.items.length === 3 ? 'sm:grid-cols-3' : ''}`}>
          {b.items.map((x, i) => (
            <div key={i} className="px-4 text-center">
              <p className="bg-clip-text text-[40px] font-bold leading-none tracking-tight text-transparent sm:text-[52px]" style={{ backgroundImage: `linear-gradient(135deg, ${t.oscuro ? '#ffffff' : color}, ${t.acento})`, fontFamily: t.titulo }}>{x.valor}</p>
              <p className="mt-2 text-[15px]" style={{ color: tk.suave }}>{x.etiqueta}</p>
            </div>
          ))}
        </div>
      );
    case 'testimonios':
      return (
        <div>
          <Encabezado titulo={b.titulo} t={t} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {b.items.map((x, i) => {
              const foto = imagenSegura(x.foto);
              return (
                <figure key={i} className={`flex flex-col p-6 text-left ${r}`} style={tarjeta}>
                  {x.estrellas > 0 && <p className="flex gap-0.5">{Array.from({ length: x.estrellas }, (_, k) => <Star key={k} className="size-4 fill-[#fdb022] text-[#fdb022]" />)}</p>}
                  <blockquote className="mt-3 flex-1 text-[16px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: tk.fuerte }}>“{x.cita}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {foto ? <img src={foto} alt="" className="size-10 rounded-full object-cover" /> : <span className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${color}, ${t.acento})` }}>{(x.autor || '?')[0]}</span>}
                    <span className="min-w-0"><span className="block truncate text-[15px] font-semibold" style={{ color: tk.fuerte }}>{x.autor}</span><span className="block truncate text-[13px]" style={{ color: tk.suave }}>{x.cargo}</span></span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      );
    case 'planes':
      return (
        <div>
          <Encabezado titulo={b.titulo} subtitulo={b.subtitulo} t={t} />
          <div className={`mx-auto grid grid-cols-1 items-stretch gap-6 ${b.items.length === 2 ? 'max-w-3xl md:grid-cols-2' : b.items.length >= 3 ? 'md:grid-cols-3' : 'max-w-sm'}`}>
            {b.items.map((p, i) => <Plan key={i} p={p} accion={b.accion} url={b.url} ctx={ctx} t={t} />)}
          </div>
        </div>
      );
    case 'preguntas':
      return (
        <div className="mx-auto max-w-3xl">
          <Encabezado titulo={b.titulo} t={t} />
          <div className="divide-y" style={{ borderColor: tk.borde }}>
            {b.items.map((x, i) => (
              <details key={i} className="group py-5 text-left" style={{ borderColor: tk.borde }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden" style={{ color: tk.fuerte }}>
                  <span className="[overflow-wrap:anywhere]">{x.pregunta}</span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full transition group-open:rotate-45" style={{ background: conAlfa(color, 0.1), color }}><Plus className="size-4" /></span>
                </summary>
                <p className="mt-3 whitespace-pre-line pr-10 text-[16px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: tk.cuerpo }}>{x.respuesta}</p>
              </details>
            ))}
          </div>
        </div>
      );
    case 'logos':
      return (
        <div className="text-center">
          {b.titulo && <p className="mb-6 text-[14px] font-medium" style={{ color: tk.suave }}>{b.titulo}</p>}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {b.items.filter(Boolean).map((x, i) => <span key={i} className="text-[20px] font-bold tracking-tight opacity-60 sm:text-[22px]" style={{ color: tk.fuerte, fontFamily: i % 2 ? t.titulo : undefined }}>{x}</span>)}
          </div>
        </div>
      );
    case 'llamada':
      return b.estilo === 'tarjeta' ? (
        <div className={`relative overflow-hidden px-6 py-14 text-center text-white sm:px-14 ${t.radio === 'recto' ? '' : 'rounded-[32px]'}`} style={{ background: `linear-gradient(135deg, ${color}, ${t.acento})`, boxShadow: `0 40px 80px -40px ${conAlfa(color, 0.7)}` }}>
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl text-[30px] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-[42px]" style={{ fontFamily: t.titulo }}>{b.titulo}</h2>
          {b.texto && <p className="relative mx-auto mt-4 max-w-xl text-[17px] text-white/85 [overflow-wrap:anywhere]">{b.texto}</p>}
          <div className="relative mt-8 flex justify-center"><Boton texto={b.boton_texto} accion={b.boton_accion} url={b.boton_url} ctx={ctx} t={{ ...t, oscuro: true }} variante="claro" grande /></div>
        </div>
      ) : (
        <div className="text-center">
          <Encabezado titulo={b.titulo} subtitulo={b.texto} t={t} />
          <div className="-mt-4 flex justify-center"><Boton texto={b.boton_texto} accion={b.boton_accion} url={b.boton_url} ctx={ctx} t={t} grande /></div>
        </div>
      );
    case 'pasos':
      return (
        <div>
          <Encabezado titulo={b.titulo} t={t} />
          <ol className={`grid grid-cols-1 gap-8 ${b.items.length >= 4 ? 'lg:grid-cols-4 sm:grid-cols-2' : b.items.length === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {b.items.map((x, i) => (
              <li key={i} className="relative text-left">
                <span className="flex size-12 items-center justify-center rounded-2xl text-[18px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${color}, ${t.acento})`, boxShadow: `0 12px 24px -10px ${conAlfa(color, 0.6)}` }}>{i + 1}</span>
                <h3 className="mt-5 text-[18px] font-semibold [overflow-wrap:anywhere]" style={{ color: tk.fuerte }}>{x.titulo}</h3>
                <p className="mt-2 text-[15px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: tk.cuerpo }}>{x.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      );
    case 'galeria': {
      const imgs = b.imagenes.map((u) => imagenSegura(u)).filter((u): u is string => Boolean(u));
      if (!imgs.length) return ctx.vistaPrevia ? <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-current/30 text-sm opacity-60">Añade imágenes a la galería</div> : null;
      const cols = { 2: 'grid-cols-2', 3: 'grid-cols-2 md:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' }[b.columnas];
      // eslint-disable-next-line @next/next/no-img-element
      return <div className={`grid gap-3 ${cols}`}>{imgs.map((src, i) => <img key={i} src={src} alt="" loading="lazy" className={`aspect-square w-full object-cover ${r}`} />)}</div>;
    }
    default:
      return null;
  }
}

function Plan({ p, accion, url, ctx, t }: { p: { nombre: string; precio: string; periodo: string; descripcion: string; caracteristicas: string[]; boton: string; destacado: boolean }; accion: 'siguiente' | 'url' | 'ancla'; url: string; ctx: ContextoPagina; t: Tema }) {
  const r = rTarjeta(t);
  const oscuroPlan = p.destacado;
  const fuerte = oscuroPlan ? '#ffffff' : '#0b1220';
  const suave = oscuroPlan ? 'rgba(255,255,255,0.7)' : '#667085';
  return (
    <div className={`relative flex flex-col p-7 text-left ${r}`} style={oscuroPlan
      ? { background: `linear-gradient(160deg, #0b1220, ${mezclar('#0b1220', t.color, 0.35)})`, boxShadow: `0 30px 60px -25px ${conAlfa(t.color, 0.6)}`, border: `1px solid ${conAlfa(t.color, 0.5)}` }
      : { background: '#ffffff', border: '1px solid #eaecf0', boxShadow: '0 12px 32px -16px rgba(16,24,40,0.15)' }}>
      {p.destacado && <span className="absolute -top-3 left-7 rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.acento})` }}>Más elegido</span>}
      <h3 className="text-[18px] font-semibold" style={{ color: fuerte }}>{p.nombre}</h3>
      {p.descripcion && <p className="mt-1 text-[14px]" style={{ color: suave }}>{p.descripcion}</p>}
      <p className="mt-5 flex items-baseline gap-1"><span className="text-[44px] font-bold leading-none tracking-tight" style={{ color: fuerte, fontFamily: t.titulo }}>{p.precio}</span><span className="text-[15px]" style={{ color: suave }}>{p.periodo}</span></p>
      <ul className="mt-6 flex-1 space-y-3 text-[15px]">
        {p.caracteristicas.filter(Boolean).map((c, i) => <li key={i} className="flex gap-2.5" style={{ color: oscuroPlan ? 'rgba(255,255,255,0.88)' : '#344054' }}><Check className="mt-0.5 size-4 shrink-0" style={{ color: oscuroPlan ? mezclar(t.color, '#ffffff', 0.4) : t.color }} />{c}</li>)}
      </ul>
      <div className="mt-7 [&>*]:w-full"><Boton texto={p.boton || 'Empezar'} accion={accion} url={url} ctx={ctx} t={{ ...t, oscuro: oscuroPlan }} variante={p.destacado ? 'primario' : 'secundario'} /></div>
    </div>
  );
}

// --- Sección y página --------------------------------------------------------------
export function fondoSeccion(s: Seccion, t: Tema): React.CSSProperties {
  const img = s.fondo_tipo === 'imagen' ? imagenSegura(s.imagen_fondo ?? '') : null;
  if (img) {
    const o = Math.min(90, Math.max(0, s.oscurecer ?? 55)) / 100;
    return { backgroundImage: `linear-gradient(rgba(5,10,20,${o}), rgba(5,10,20,${o})), url("${img}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0b1220' };
  }
  if (s.fondo_tipo === 'degradado') return { background: `linear-gradient(135deg, ${s.fondo}, ${s.fondo2 ?? mezclar(s.fondo, t.color, 0.5)})` };
  if (s.fondo_tipo === 'malla') {
    const a = t.oscuro ? 0.45 : 0.22;
    return {
      backgroundColor: s.fondo,
      backgroundImage: `radial-gradient(at 12% 18%, ${conAlfa(t.color, a)} 0, transparent 48%), radial-gradient(at 88% 8%, ${conAlfa(t.acento, a)} 0, transparent 46%), radial-gradient(at 60% 100%, ${conAlfa(t.color, a * 0.7)} 0, transparent 50%)`,
    };
  }
  return { background: s.fondo };
}

export function SeccionVista({ s, ctx, color, estilo, children }: { s: Seccion; ctx: ContextoPagina; color: string; estilo?: Contenido['estilo']; children?: React.ReactNode }) {
  const t = temaDe(estilo ?? { color_primario: color, fondo: '#ffffff', fuente: 'sans' }, s);
  return (
    <section id={s.ancla || `s-${s.id}`} className={`relative overflow-hidden px-5 sm:px-8 ${RELLENO[s.relleno]}`} style={{ ...fondoSeccion(s, t), color: t.oscuro ? '#ffffff' : textoSobre(s.fondo) }}>
      <div className={`relative mx-auto flex ${ANCHO[s.ancho]} flex-col gap-8`}>
        {children ?? s.bloques.map((b) => <BloqueVista key={b.id} b={b} ctx={ctx} color={color} tema={t} />)}
      </div>
    </section>
  );
}

export function PaginaEmbudo({ contenido, ctx }: { contenido: Contenido; ctx: ContextoPagina }) {
  return (
    <main style={{ fontFamily: fuenteDe(contenido.estilo.fuente), background: contenido.estilo.fondo }} className="min-h-dvh antialiased">
      <Tipografia fuente={contenido.estilo.fuente} />
      {contenido.secciones.map((s) => <SeccionVista key={s.id} s={s} ctx={ctx} color={contenido.estilo.color_primario} estilo={contenido.estilo} />)}
    </main>
  );
}
