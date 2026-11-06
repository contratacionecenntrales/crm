import { z } from 'zod';

// Contenido de una página de embudo: estilo + secciones con bloques.
export type Alineacion = 'izquierda' | 'centro' | 'derecha';
export type AccionBoton = 'siguiente' | 'url' | 'ancla' | 'pagina'; // pagina: otra página del sitio (url = su ruta)

export type Bloque =
  | { id: string; tipo: 'titulo'; texto: string; nivel: 1 | 2 | 3; alineacion: Alineacion }
  | { id: string; tipo: 'texto'; texto: string; alineacion: Alineacion; tamano: 'normal' | 'grande' }
  | { id: string; tipo: 'imagen'; url: string; alt: string; ancho: 'completo' | 'medio'; redondeada: boolean }
  | { id: string; tipo: 'boton'; texto: string; accion: AccionBoton; url: string; alineacion: Alineacion; tamano: 'normal' | 'grande' }
  | { id: string; tipo: 'video'; url: string }
  | { id: string; tipo: 'formulario'; campos: CampoFormulario[]; boton: string; etiquetas: string[]; despues: 'siguiente' | 'url' | 'mensaje'; url: string; mensaje: string; aviso_legal: string }
  | { id: string; tipo: 'lista'; elementos: string[]; icono: 'check' | 'punto' | 'numero' }
  | { id: string; tipo: 'testimonio'; cita: string; autor: string; cargo: string; foto: string }
  | { id: string; tipo: 'precio'; titulo: string; precio: string; periodo: string; caracteristicas: string[]; boton: string; accion: AccionBoton; url: string; destacado: boolean }
  | { id: string; tipo: 'cuenta_atras'; hasta: string; texto_fin: string }
  | { id: string; tipo: 'calendario'; slug: string; alto: number }
  | { id: string; tipo: 'separador'; estilo: 'linea' | 'espacio'; alto: number }
  // --- Bloques de diseño (v2) ---
  | ({ id: string; tipo: 'hero'; etiqueta: string; titulo: string; subtitulo: string; prueba: string; disposicion: 'centro' | 'dividido'; visual: Visual; imagen: string } & Boton1 & Boton2)
  | { id: string; tipo: 'caracteristicas'; titulo: string; subtitulo: string; columnas: 2 | 3 | 4; estilo: 'tarjetas' | 'simple'; items: { icono: string; titulo: string; texto: string }[] }
  | ({ id: string; tipo: 'imagen_texto'; etiqueta: string; titulo: string; texto: string; puntos: string[]; visual: Visual; imagen: string; invertir: boolean } & Boton1)
  | { id: string; tipo: 'cifras'; items: { valor: string; etiqueta: string }[] }
  | { id: string; tipo: 'testimonios'; titulo: string; items: { cita: string; autor: string; cargo: string; foto: string; estrellas: number }[] }
  | { id: string; tipo: 'planes'; titulo: string; subtitulo: string; accion: AccionBoton; url: string; items: { nombre: string; precio: string; periodo: string; descripcion: string; caracteristicas: string[]; boton: string; destacado: boolean }[] }
  | { id: string; tipo: 'preguntas'; titulo: string; items: { pregunta: string; respuesta: string }[] }
  | { id: string; tipo: 'logos'; titulo: string; items: string[] }
  | ({ id: string; tipo: 'llamada'; titulo: string; texto: string; estilo: 'tarjeta' | 'plano' } & Boton1)
  | { id: string; tipo: 'pasos'; titulo: string; items: { titulo: string; texto: string }[] }
  | { id: string; tipo: 'galeria'; imagenes: string[]; columnas: 2 | 3 | 4 };

// Ilustraciones hechas con CSS (no dependen de fotos externas).
export type Visual = 'ninguno' | 'imagen' | 'panel' | 'movil' | 'chat' | 'tarjetas';
interface Boton1 { boton_texto: string; boton_accion: AccionBoton; boton_url: string }
interface Boton2 { boton2_texto: string; boton2_accion: AccionBoton; boton2_url: string }
export type Fuente = 'sans' | 'serif' | 'redondeada' | 'elegante' | 'geometrica' | 'editorial';

export interface CampoFormulario { clave: string; etiqueta: string; tipo: 'texto' | 'email' | 'tel' | 'textarea'; obligatorio: boolean }

export interface Seccion {
  id: string; ancla?: string; fondo: string; relleno: 'pequeno' | 'normal' | 'grande'; ancho: 'estrecho' | 'normal' | 'ancho'; bloques: Bloque[];
  // Fondo especial: degradado (fondo → fondo2), malla de color o imagen con capa oscura.
  fondo_tipo?: 'solido' | 'degradado' | 'malla' | 'imagen'; fondo2?: string; imagen_fondo?: string; oscurecer?: number;
}
export interface Contenido {
  estilo: { color_primario: string; fondo: string; fuente: Fuente; color_acento?: string; radio?: 'recto' | 'suave' | 'redondo' };
  secciones: Seccion[];
}

export const ESTILO_DEFECTO: Contenido['estilo'] = { color_primario: '#155eef', fondo: '#ffffff', fuente: 'sans' };
export const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// --- Validación (lo que se guarda tiene que cumplir esto) ------------------------
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const txt = (max: number) => z.string().max(max);
const id = z.string().regex(/^[a-z0-9_-]{1,40}$/i);
const ali = z.enum(['izquierda', 'centro', 'derecha']);
const accion = z.enum(['siguiente', 'url', 'ancla', 'pagina']);
const visual = z.enum(['ninguno', 'imagen', 'panel', 'movil', 'chat', 'tarjetas']);
const boton1 = { boton_texto: txt(80), boton_accion: accion, boton_url: txt(1000) };
const campo = z.object({ clave: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), etiqueta: txt(80), tipo: z.enum(['texto', 'email', 'tel', 'textarea']), obligatorio: z.boolean() });

const bloque = z.discriminatedUnion('tipo', [
  z.object({ id, tipo: z.literal('titulo'), texto: txt(300), nivel: z.union([z.literal(1), z.literal(2), z.literal(3)]), alineacion: ali }),
  z.object({ id, tipo: z.literal('texto'), texto: txt(5000), alineacion: ali, tamano: z.enum(['normal', 'grande']) }),
  z.object({ id, tipo: z.literal('imagen'), url: txt(1000), alt: txt(200), ancho: z.enum(['completo', 'medio']), redondeada: z.boolean() }),
  z.object({ id, tipo: z.literal('boton'), texto: txt(80), accion, url: txt(1000), alineacion: ali, tamano: z.enum(['normal', 'grande']) }),
  z.object({ id, tipo: z.literal('video'), url: txt(500) }),
  z.object({ id, tipo: z.literal('formulario'), campos: z.array(campo).min(1).max(12), boton: txt(80), etiquetas: z.array(txt(60)).max(10),
    despues: z.enum(['siguiente', 'url', 'mensaje']), url: txt(1000), mensaje: txt(500), aviso_legal: txt(400) }),
  z.object({ id, tipo: z.literal('lista'), elementos: z.array(txt(300)).max(30), icono: z.enum(['check', 'punto', 'numero']) }),
  z.object({ id, tipo: z.literal('testimonio'), cita: txt(1000), autor: txt(100), cargo: txt(100), foto: txt(1000) }),
  z.object({ id, tipo: z.literal('precio'), titulo: txt(100), precio: txt(40), periodo: txt(40), caracteristicas: z.array(txt(200)).max(20),
    boton: txt(80), accion, url: txt(1000), destacado: z.boolean() }),
  z.object({ id, tipo: z.literal('cuenta_atras'), hasta: txt(40), texto_fin: txt(200) }),
  z.object({ id, tipo: z.literal('calendario'), slug: z.string().max(60).regex(/^[a-z0-9-]*$/), alto: z.number().int().min(300).max(1400) }),
  z.object({ id, tipo: z.literal('separador'), estilo: z.enum(['linea', 'espacio']), alto: z.number().int().min(4).max(200) }),
  z.object({ id, tipo: z.literal('hero'), etiqueta: txt(80), titulo: txt(200), subtitulo: txt(600), prueba: txt(120), disposicion: z.enum(['centro', 'dividido']),
    visual, imagen: txt(1000), ...boton1, boton2_texto: txt(80), boton2_accion: accion, boton2_url: txt(1000) }),
  z.object({ id, tipo: z.literal('caracteristicas'), titulo: txt(200), subtitulo: txt(400), columnas: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    estilo: z.enum(['tarjetas', 'simple']), items: z.array(z.object({ icono: txt(30), titulo: txt(100), texto: txt(400) })).max(12) }),
  z.object({ id, tipo: z.literal('imagen_texto'), etiqueta: txt(80), titulo: txt(200), texto: txt(1500), puntos: z.array(txt(200)).max(8), visual,
    imagen: txt(1000), invertir: z.boolean(), ...boton1 }),
  z.object({ id, tipo: z.literal('cifras'), items: z.array(z.object({ valor: txt(20), etiqueta: txt(80) })).max(6) }),
  z.object({ id, tipo: z.literal('testimonios'), titulo: txt(200), items: z.array(z.object({ cita: txt(600), autor: txt(80), cargo: txt(100), foto: txt(1000),
    estrellas: z.number().int().min(0).max(5) })).max(9) }),
  z.object({ id, tipo: z.literal('planes'), titulo: txt(200), subtitulo: txt(400), accion, url: txt(1000), items: z.array(z.object({ nombre: txt(60), precio: txt(30),
    periodo: txt(30), descripcion: txt(200), caracteristicas: z.array(txt(150)).max(12), boton: txt(60), destacado: z.boolean() })).max(4) }),
  z.object({ id, tipo: z.literal('preguntas'), titulo: txt(200), items: z.array(z.object({ pregunta: txt(200), respuesta: txt(1500) })).max(20) }),
  z.object({ id, tipo: z.literal('logos'), titulo: txt(120), items: z.array(txt(40)).max(10) }),
  z.object({ id, tipo: z.literal('llamada'), titulo: txt(200), texto: txt(500), estilo: z.enum(['tarjeta', 'plano']), ...boton1 }),
  z.object({ id, tipo: z.literal('pasos'), titulo: txt(200), items: z.array(z.object({ titulo: txt(100), texto: txt(400) })).max(6) }),
  z.object({ id, tipo: z.literal('galeria'), imagenes: z.array(txt(1000)).max(12), columnas: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
]);

export const esquemaContenido = z.object({
  estilo: z.object({ color_primario: color, fondo: color, fuente: z.enum(['sans', 'serif', 'redondeada', 'elegante', 'geometrica', 'editorial']),
    color_acento: color.optional(), radio: z.enum(['recto', 'suave', 'redondo']).optional() }),
  secciones: z.array(z.object({
    id, ancla: z.string().regex(/^[a-z0-9-]{0,40}$/).optional(), fondo: color, relleno: z.enum(['pequeno', 'normal', 'grande']), ancho: z.enum(['estrecho', 'normal', 'ancho']),
    fondo_tipo: z.enum(['solido', 'degradado', 'malla', 'imagen']).optional(), fondo2: color.optional(), imagen_fondo: txt(1000).optional(),
    oscurecer: z.number().int().min(0).max(90).optional(),
    bloques: z.array(bloque).max(60),
  })).max(40),
}).superRefine((c, ctx) => {
  const ids = new Set<string>();
  for (const s of c.secciones) for (const b of s.bloques) {
    if (ids.has(b.id)) ctx.addIssue({ code: 'custom', message: 'Hay bloques repetidos.' });
    ids.add(b.id);
    if (b.tipo === 'formulario') {
      const claves = b.campos.map((x) => x.clave);
      if (new Set(claves).size !== claves.length) ctx.addIssue({ code: 'custom', message: 'Un formulario tiene campos repetidos.' });
      if (!claves.includes('email') && !claves.includes('telefono')) ctx.addIssue({ code: 'custom', message: 'Cada formulario necesita un campo de correo o de teléfono.' });
    }
  }
});

// --- Seguridad de enlaces y medios ----------------------------------------------
// Solo https/http, mailto, tel y anclas: nunca javascript:, data:, etc.
export function enlaceSeguro(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^#[a-z0-9_-]{1,60}$/i.test(u)) return u;
  if (/^(mailto|tel):[^\s<>"]{1,300}$/i.test(u)) return u;
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null;
  } catch {
    return null;
  }
}

export function imagenSegura(url: string): string | null {
  const u = enlaceSeguro(url);
  return u && /^https?:\/\//.test(u) ? u : null;
}

// YouTube / Vimeo → URL de inserción; cualquier otra cosa se ignora.
export function videoInsertable(url: string): string | null {
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export const slugEmbudo = (nombre: string, sufijo: string) =>
  `${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 45) || 'embudo'}-${sufijo}`;
export const rutaPaso = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'pagina';
