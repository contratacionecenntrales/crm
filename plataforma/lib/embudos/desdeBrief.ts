import { bloqueIT, campos, cifras, faq, form, hero, llamada, logos, opiniones, pagina, pasos, planes, sec, texto, titulo, ventajas, b } from './plantillas.ts';
import { esquemaContenido, rutaPaso, type Bloque, type Contenido, type Fuente, type Seccion, type Visual } from './tipos.ts';

// Convierte el «brief» que genera la IA (secciones con textos) en páginas
// reales hechas con los bloques de diseño. La IA solo escribe; el diseño
// (fondos, espaciados, colores) lo decide este código para que quede siempre bien.

export const TIPOS_SECCION = ['hero', 'ventajas', 'imagen_texto', 'cifras', 'testimonios', 'planes', 'pasos', 'preguntas', 'logos', 'llamada', 'formulario', 'calendario'] as const;
export const VISUALES = ['tarjetas', 'panel', 'movil', 'chat', 'ninguno'] as const;
export const FUENTES = ['geometrica', 'sans', 'elegante', 'editorial', 'redondeada'] as const;
export const ICONOS_IA = ['rayo', 'estrella', 'corazon', 'escudo', 'reloj', 'calendario', 'chat', 'telefono', 'grafico', 'cohete', 'check', 'usuario', 'usuarios', 'dinero', 'tarjeta', 'regalo', 'ubicacion', 'camara', 'herramienta', 'hoja', 'casa', 'trofeo', 'globo', 'candado', 'sol', 'correo', 'ia', 'objetivo', 'libro'] as const;

export interface ItemBrief { icono: string; titulo: string; texto: string; valor: string; etiqueta: string; cita: string; autor: string; cargo: string; nombre: string; precio: string; periodo: string; caracteristicas: string[]; destacado: boolean; pregunta: string; respuesta: string }
export interface SeccionBrief { tipo: string; etiqueta: string; titulo: string; subtitulo: string; texto: string; boton: string; boton2: string; prueba: string; visual: string; puntos: string[]; items: ItemBrief[] }
export interface Brief {
  marca: string; color: string; acento: string; fuente: string; radio: string; descripcion: string; boton_menu: string;
  paginas: { nombre: string; ruta: string; secciones: SeccionBrief[] }[];
}

const HEX = /^#[0-9a-f]{6}$/i;
const corta = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const lista = (x: unknown, max: number, n: number) => (Array.isArray(x) ? x : []).map((v) => corta(v, n)).filter(Boolean).slice(0, max);
const de = <T extends readonly string[]>(v: unknown, op: T, def: T[number]): T[number] => (op.includes(String(v)) ? String(v) as T[number] : def);

// Fondo de cada sección según su posición y tipo: portada con malla, cifras en
// oscuro y el resto alternando blanco / gris muy claro.
function fondoPara(tipo: string, i: number, oscura: boolean): { fondo: string; tipo?: Seccion['fondo_tipo']; relleno?: Seccion['relleno']; ancho?: Seccion['ancho'] } {
  if (tipo === 'hero') return { fondo: oscura ? '#0b0f1e' : '#ffffff', tipo: 'malla', relleno: 'grande' };
  if (tipo === 'cifras') return { fondo: '#0b1220' };
  if (tipo === 'logos') return { fondo: oscura ? '#0b0f1e' : '#ffffff', relleno: 'pequeno' };
  if (tipo === 'formulario') return { fondo: oscura ? '#0b0f1e' : '#ffffff', tipo: 'malla', ancho: 'estrecho' };
  if (tipo === 'preguntas') return { fondo: oscura ? '#0b0f1e' : '#ffffff', ancho: 'normal' };
  if (tipo === 'llamada') return { fondo: oscura ? '#0b0f1e' : '#ffffff', relleno: 'pequeno' };
  return { fondo: oscura ? (i % 2 ? '#0f1426' : '#0b0f1e') : (i % 2 ? '#f8fafc' : '#ffffff') };
}

function seccion(s: SeccionBrief, i: number, ctx: { oscura: boolean; tieneForm: boolean; siguiente: string | null }): Seccion | null {
  const tipo = de(s.tipo, TIPOS_SECCION, 'ventajas');
  const items = (Array.isArray(s.items) ? s.items : []).slice(0, 12);
  const f = fondoPara(tipo, i, ctx.oscura);
  const visual = de(s.visual, VISUALES, 'tarjetas') as Visual;
  // Los botones van al formulario de la página, o a la página siguiente.
  const destino = ctx.tieneForm ? { accion: 'ancla' as const, url: '#formulario' } : ctx.siguiente ? { accion: 'pagina' as const, url: ctx.siguiente } : { accion: 'ancla' as const, url: '#formulario' };
  let bloques: Bloque[] = [];
  switch (tipo) {
    case 'hero':
      bloques = [hero({ etiqueta: corta(s.etiqueta, 80), titulo: corta(s.titulo, 200) || 'Tu propuesta de valor', subtitulo: corta(s.subtitulo || s.texto, 600), boton: corta(s.boton, 80) || 'Empezar', accion: destino.accion, url: destino.url,
        boton2: corta(s.boton2, 80), accion2: 'ancla', url2: '#mas', prueba: corta(s.prueba, 120), visual, centro: visual === 'ninguno' })];
      break;
    case 'ventajas': {
      const its = items.map((x) => [de(x.icono, ICONOS_IA, 'rayo'), corta(x.titulo, 100), corta(x.texto, 400)] as [string, string, string]).filter((x) => x[1]).slice(0, 8);
      if (!its.length) return null;
      bloques = [ventajas(corta(s.titulo, 200), corta(s.subtitulo, 400), its, its.length === 4 || its.length === 8 ? 4 : its.length === 2 ? 2 : 3)];
      break;
    }
    case 'imagen_texto':
      bloques = [bloqueIT({ etiqueta: corta(s.etiqueta, 80), titulo: corta(s.titulo, 200), texto: corta(s.texto || s.subtitulo, 1500), puntos: lista(s.puntos, 6, 200), visual: visual === 'ninguno' ? 'panel' : visual, invertir: i % 2 === 0,
        boton: corta(s.boton, 80), accion: destino.accion, url: destino.url })];
      break;
    case 'cifras': {
      const its = items.map((x) => [corta(x.valor, 20), corta(x.etiqueta || x.texto, 80)] as [string, string]).filter((x) => x[0]).slice(0, 4);
      if (its.length < 2) return null;
      bloques = [cifras(its)];
      break;
    }
    case 'testimonios': {
      const its = items.map((x) => [corta(x.cita || x.texto, 600), corta(x.autor || x.nombre, 80), corta(x.cargo, 100)] as [string, string, string]).filter((x) => x[0] && x[1]).slice(0, 6);
      if (!its.length) return null;
      bloques = [opiniones(corta(s.titulo, 200), its)];
      break;
    }
    case 'planes': {
      const its = items.filter((x) => x.nombre || x.titulo).slice(0, 3).map((x) => ({ nombre: corta(x.nombre || x.titulo, 60), precio: corta(x.precio, 30) || 'Consultar', periodo: corta(x.periodo, 30), descripcion: corta(x.texto, 200),
        caracteristicas: lista(x.caracteristicas, 8, 150), boton: corta(s.boton, 60) || 'Elegir', destacado: Boolean(x.destacado) }));
      if (!its.length) return null;
      if (!its.some((x) => x.destacado) && its.length === 3) its[1].destacado = true;
      bloques = [planes(corta(s.titulo, 200), corta(s.subtitulo, 400), its, destino.accion, destino.url)];
      break;
    }
    case 'pasos': {
      const its = items.map((x) => [corta(x.titulo, 100), corta(x.texto, 400)] as [string, string]).filter((x) => x[0]).slice(0, 4);
      if (!its.length) return null;
      bloques = [pasos(corta(s.titulo, 200), its)];
      break;
    }
    case 'preguntas': {
      const its = items.map((x) => [corta(x.pregunta || x.titulo, 200), corta(x.respuesta || x.texto, 1500)] as [string, string]).filter((x) => x[0] && x[1]).slice(0, 8);
      if (!its.length) return null;
      bloques = [faq(corta(s.titulo, 200) || 'Preguntas frecuentes', its)];
      break;
    }
    case 'logos': {
      const its = lista(s.puntos.length ? s.puntos : items.map((x) => x.nombre || x.titulo), 6, 40);
      if (its.length < 3) return null;
      bloques = [logos(corta(s.titulo, 120), its)];
      break;
    }
    case 'llamada':
      bloques = [llamada(corta(s.titulo, 200) || '¿Empezamos?', corta(s.texto || s.subtitulo, 500), corta(s.boton, 80) || 'Contactar', destino.accion, destino.url)];
      break;
    case 'formulario': {
      const conTelefono = /tel|whats|llam|cita|reserv/i.test(`${s.titulo} ${s.texto}`);
      bloques = [titulo(corta(s.titulo, 300) || 'Hablemos'), ...(s.texto || s.subtitulo ? [texto(corta(s.texto || s.subtitulo, 500))] : []),
        form(corta(s.boton, 80) || 'Enviar', ['web-ia'], campos(['nombre', 'Nombre', 'texto', true], ['email', 'Correo electrónico', 'email', true], ...(conTelefono ? [['telefono', 'Teléfono', 'tel', false] as [string, string, 'tel', boolean]] : []), ['mensaje', 'Cuéntanos qué necesitas', 'textarea', false]),
          ctx.siguiente ? 'siguiente' : 'mensaje', '¡Gracias! Te respondemos muy pronto.')];
      return sec({ ...f, ancla: 'formulario' }, bloques);
    }
    case 'calendario':
      bloques = [titulo(corta(s.titulo, 300) || 'Reserva tu cita'), ...(s.texto ? [texto(corta(s.texto, 500))] : []), b({ tipo: 'calendario', slug: '', alto: 760 })];
      break;
  }
  return sec(f, bloques);
}

export function contenidoDesdeBrief(brief: Brief, tipo: 'embudo' | 'sitio'): { paginas: { nombre: string; ruta: string; contenido: Contenido }[]; marca: string; descripcion: string; boton_menu: string } {
  const color = HEX.test(brief.color) ? brief.color.toLowerCase() : '#155eef';
  const acento = HEX.test(brief.acento) ? brief.acento.toLowerCase() : '#7a5af8';
  const fuente = de(brief.fuente, FUENTES, 'geometrica') as Fuente;
  const radio = de(brief.radio, ['recto', 'suave', 'redondo'] as const, 'suave');
  const crudas = (Array.isArray(brief.paginas) ? brief.paginas : []).slice(0, tipo === 'sitio' ? 6 : 3);
  const usadas = new Set<string>();
  const rutas = crudas.map((p, i) => {
    let r = rutaPaso(corta(p.ruta || p.nombre, 60)) || `pagina-${i + 1}`;
    while (usadas.has(r)) r = `${r}-${i + 1}`.slice(0, 60);
    usadas.add(r);
    return r;
  });
  const paginas = crudas.map((p, i) => {
    const secs = (Array.isArray(p.secciones) ? p.secciones : []).slice(0, 10);
    const tieneForm = secs.some((x) => x.tipo === 'formulario');
    const siguiente = tipo === 'embudo' ? rutas[i + 1] ?? null : rutas.find((r) => /contact|reserv|cita/.test(r)) ?? null;
    const secciones = secs.map((x, k) => seccion(x, k, { oscura: false, tieneForm, siguiente: siguiente === rutas[i] ? null : siguiente })).filter((x): x is Seccion => Boolean(x));
    // El botón secundario de la portada baja a la sección siguiente.
    if (secciones[1] && !secciones[1].ancla) secciones[1].ancla = 'mas';
    const contenido = pagina({ color, acento, fuente, radio }, secciones.length ? secciones : [sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'grande' }, [titulo(corta(p.nombre, 100) || 'Página', 1)])]);
    const v = esquemaContenido.safeParse(contenido);
    if (!v.success) throw new Error(`La página generada no es válida: ${v.error.issues[0]?.message ?? ''}`);
    return { nombre: corta(p.nombre, 120) || `Página ${i + 1}`, ruta: rutas[i], contenido: v.data as Contenido };
  });
  if (!paginas.length) throw new Error('La IA no devolvió ninguna página.');
  return { paginas, marca: corta(brief.marca, 80), descripcion: corta(brief.descripcion, 300), boton_menu: corta(brief.boton_menu, 40) };
}
