import { Mail, MapPin, Menu, Phone, Clock } from 'lucide-react';
import { enlaceSeguro, imagenSegura, type Contenido } from '@/lib/embudos/tipos';
import { conAlfa, mezclar } from '@/lib/embudos/color';
import type { ConfigSitio } from '@/lib/embudos/sitios';
import { fuenteTitulo } from './Renderizado';

// Cabecera con menú y pie de página de un sitio web (página pública y editor).

interface Props { config: Partial<ConfigSitio>; menu: { nombre: string; ruta: string }[]; base: string; actual: string; estilo: Contenido['estilo']; empresa: string; logoEmpresa?: string | null; vistaPrevia?: boolean }

const enlace = (base: string, ruta: string, primera: string) => (ruta === primera ? base : `${base}/${ruta}`);
const REDES: [keyof ConfigSitio['redes'], string][] = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['x', 'X']];

function Marca({ config, empresa, logoEmpresa, estilo }: Pick<Props, 'config' | 'empresa' | 'logoEmpresa' | 'estilo'>) {
  const logo = imagenSegura(config.logo ?? '') ?? (logoEmpresa ? imagenSegura(logoEmpresa) : null);
  const nombre = config.marca || empresa;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo ? <img src={logo} alt={nombre} className="h-8 w-auto max-w-[140px] object-contain" />
        : <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${estilo.color_primario}, ${estilo.color_acento ?? mezclar(estilo.color_primario, '#a855f7', 0.55)})` }}>{nombre.slice(0, 1).toUpperCase()}</span>}
      <span className="truncate text-[17px] font-semibold tracking-tight" style={{ fontFamily: fuenteTitulo(estilo.fuente) }}>{nombre}</span>
    </span>
  );
}

export function CabeceraSitio(p: Props) {
  const primera = p.menu[0]?.ruta ?? '';
  const oscuro = ['#0', '#1'].some((x) => p.estilo.fondo.toLowerCase().startsWith(x));
  const tinta = oscuro ? '#ffffff' : '#0b1220';
  const a = (ruta: string) => (p.vistaPrevia ? undefined : enlace(p.base, ruta, primera));
  const cta = p.config.menu_cta_texto && p.config.menu_cta_ruta
    ? (p.menu.some((m) => m.ruta === p.config.menu_cta_ruta) ? a(p.config.menu_cta_ruta) : (p.vistaPrevia ? undefined : enlaceSeguro(p.config.menu_cta_ruta) ?? undefined))
    : undefined;
  const radio = p.estilo.radio === 'recto' ? 'rounded-none' : p.estilo.radio === 'redondo' ? 'rounded-full' : 'rounded-xl';
  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ background: oscuro ? 'rgba(10,10,15,0.75)' : 'rgba(255,255,255,0.8)', borderColor: oscuro ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.06)', color: tinta }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <a href={a(primera)} className="min-w-0"><Marca {...p} /></a>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Menú">
          {p.menu.map((m) => (
            <a key={m.ruta} href={a(m.ruta)} aria-current={m.ruta === p.actual ? 'page' : undefined}
              className="rounded-lg px-3 py-2 text-[15px] font-medium transition hover:opacity-100" style={{ opacity: m.ruta === p.actual ? 1 : 0.7 }}>{m.nombre}</a>
          ))}
        </nav>
        {p.config.menu_cta_texto && (
          <a href={cta} className={`hidden px-4 py-2 text-[14px] font-semibold text-white md:inline-flex ${radio}`} style={{ background: p.estilo.color_primario, boxShadow: `0 8px 20px -8px ${conAlfa(p.estilo.color_primario, 0.6)}` }}>{p.config.menu_cta_texto}</a>
        )}
        <details className="relative ml-auto md:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg [&::-webkit-details-marker]:hidden" aria-label="Abrir menú"><Menu className="size-5" /></summary>
          <div className="absolute right-0 top-12 w-56 rounded-2xl border p-2 shadow-2xl" style={{ background: oscuro ? '#111118' : '#ffffff', borderColor: oscuro ? 'rgba(255,255,255,0.1)' : '#eaecf0' }}>
            {p.menu.map((m) => <a key={m.ruta} href={a(m.ruta)} className="block rounded-lg px-3 py-2.5 text-[15px] font-medium" style={{ background: m.ruta === p.actual ? conAlfa(p.estilo.color_primario, 0.1) : undefined }}>{m.nombre}</a>)}
            {p.config.menu_cta_texto && <a href={cta} className="mt-1 block rounded-lg px-3 py-2.5 text-center text-[15px] font-semibold text-white" style={{ background: p.estilo.color_primario }}>{p.config.menu_cta_texto}</a>}
          </div>
        </details>
      </div>
    </header>
  );
}

export function PieSitio(p: Props) {
  const primera = p.menu[0]?.ruta ?? '';
  const a = (ruta: string) => (p.vistaPrevia ? undefined : enlace(p.base, ruta, primera));
  const redes = REDES.map(([k, n]) => [n, enlaceSeguro(p.config.redes?.[k] ?? '')] as const).filter(([, u]) => u && /^https:\/\//.test(u));
  const dato = (I: typeof Phone, v?: string, href?: string) => v ? <li className="flex items-start gap-2.5"><I className="mt-0.5 size-4 shrink-0 opacity-60" />{href && !p.vistaPrevia ? <a href={href} className="hover:underline">{v}</a> : <span>{v}</span>}</li> : null;
  return (
    <footer className="border-t px-5 py-14 text-[15px] sm:px-8" style={{ background: '#0b1220', color: 'rgba(255,255,255,0.72)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div className="text-white">
          <Marca {...p} />
          {p.config.descripcion && <p className="mt-4 max-w-sm leading-relaxed text-white/65">{p.config.descripcion}</p>}
          {redes.length > 0 && <p className="mt-5 flex flex-wrap gap-2">{redes.map(([n, u]) => <a key={n} href={p.vistaPrevia ? undefined : u!} rel="noopener noreferrer" target="_blank" className="rounded-full border border-white/15 px-3 py-1 text-[13px] text-white/80 hover:border-white/40">{n}</a>)}</p>}
        </div>
        <nav aria-label="Pie de página">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/45">Páginas</p>
          <ul className="space-y-2">{p.menu.map((m) => <li key={m.ruta}><a href={a(m.ruta)} className="hover:text-white">{m.nombre}</a></li>)}</ul>
        </nav>
        <div>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/45">Contacto</p>
          <ul className="space-y-2.5">
            {dato(Phone, p.config.telefono, p.config.telefono ? `tel:${p.config.telefono.replace(/[^0-9+]/g, '')}` : undefined)}
            {dato(Mail, p.config.email, p.config.email ? `mailto:${p.config.email}` : undefined)}
            {dato(MapPin, p.config.direccion)}
            {dato(Clock, p.config.horario)}
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-[13px] text-white/45">© {new Date().getFullYear()} {p.config.marca || p.empresa}. Todos los derechos reservados.</p>
    </footer>
  );
}
