import 'server-only';
import { claude, ErrorIA, iaConfigurada, MODELO_IA, traducirError, type Uso } from './claude';
import { FUENTES, ICONOS_IA, TIPOS_SECCION, VISUALES, type Brief } from '@/lib/embudos/desdeBrief';

// Generación de páginas y sitios con IA. Cada proveedor devuelve un «brief»
// (secciones con textos); el diseño lo monta lib/embudos/desdeBrief.ts.
// Para añadir otro proveedor (p. ej. OpenAI) basta con implementar esta interfaz
// y registrarlo en PROVEEDORES; se elige con IA_PROVEEDOR_PAGINAS.

export interface PeticionPagina { tipo: 'embudo' | 'sitio'; descripcion: string; nombre: string }
export interface ProveedorPaginas {
  id: string;
  disponible: () => boolean;
  generar: (p: PeticionPagina) => Promise<{ brief: Brief; uso: Uso }>;
}

const str = { type: 'string' } as const;
const lista = (items: object) => ({ type: 'array', items });
const ITEM = {
  type: 'object', additionalProperties: false,
  required: ['icono', 'titulo', 'texto', 'valor', 'etiqueta', 'cita', 'autor', 'cargo', 'nombre', 'precio', 'periodo', 'caracteristicas', 'destacado', 'pregunta', 'respuesta'],
  properties: {
    icono: { type: 'string', enum: [...ICONOS_IA] }, titulo: str, texto: str, valor: str, etiqueta: str, cita: str, autor: str, cargo: str,
    nombre: str, precio: str, periodo: str, caracteristicas: lista(str), destacado: { type: 'boolean' }, pregunta: str, respuesta: str,
  },
};
const SECCION = {
  type: 'object', additionalProperties: false,
  required: ['tipo', 'etiqueta', 'titulo', 'subtitulo', 'texto', 'boton', 'boton2', 'prueba', 'visual', 'puntos', 'items'],
  properties: {
    tipo: { type: 'string', enum: [...TIPOS_SECCION] }, etiqueta: str, titulo: str, subtitulo: str, texto: str, boton: str, boton2: str, prueba: str,
    visual: { type: 'string', enum: [...VISUALES] }, puntos: lista(str), items: lista(ITEM),
  },
};
const ESQUEMA_BRIEF = {
  type: 'object', additionalProperties: false,
  required: ['marca', 'color', 'acento', 'fuente', 'radio', 'descripcion', 'boton_menu', 'paginas'],
  properties: {
    marca: str, color: { type: 'string', description: 'Color principal en hexadecimal #rrggbb' }, acento: { type: 'string', description: 'Color de acento #rrggbb que combine' },
    fuente: { type: 'string', enum: [...FUENTES] }, radio: { type: 'string', enum: ['recto', 'suave', 'redondo'] }, descripcion: str, boton_menu: str,
    paginas: lista({ type: 'object', additionalProperties: false, required: ['nombre', 'ruta', 'secciones'], properties: { nombre: str, ruta: str, secciones: lista(SECCION) } }),
  },
};

const SISTEMA = `Eres un director creativo y redactor publicitario experto en webs que convierten. Escribes en español de España, con frases cortas, concretas y orientadas al beneficio del cliente.

Diseñas la estructura y los textos de una página o un sitio web. Devuelves solo el JSON pedido.

Reglas de contenido:
- Usa lo que te cuenten del negocio. No inventes datos verificables (teléfonos, direcciones, correos, premios, cifras exactas de clientes): si hacen falta cifras, que sean prudentes y genéricas («+10 años», «4,9★») o elige otra sección.
- En el titular de la portada rodea 1-3 palabras clave con *asteriscos* para destacarlas.
- Cada página empieza con una sección «hero». Termina con «formulario», «calendario» o «llamada».
- Variedad: no repitas el mismo tipo de sección seguido. Entre 5 y 9 secciones en la página principal; 3-6 en las demás.
- Rellena con cadena vacía, lista vacía o false los campos que no use cada tipo de sección.

Qué campos usa cada tipo de sección:
- hero: etiqueta, titulo, subtitulo, boton, boton2, prueba, visual.
- ventajas: titulo, subtitulo, items (icono, titulo, texto) — 3, 4 o 6.
- imagen_texto: etiqueta, titulo, texto, puntos (3-5), boton, visual.
- cifras: items (valor, etiqueta) — 3 o 4.
- testimonios: titulo, items (cita, autor, cargo) — 3. Nombres verosímiles de pila e inicial.
- planes: titulo, subtitulo, boton, items (nombre, precio, periodo, texto, caracteristicas, destacado) — 2 o 3.
- pasos: titulo, items (titulo, texto) — 3 o 4.
- preguntas: titulo, items (pregunta, respuesta) — 3 a 6.
- logos: titulo, puntos (nombres de marcas o medios ficticios) — solo si encaja.
- llamada: titulo, texto, boton.
- formulario: titulo, texto, boton.
- calendario: titulo, texto (para negocios con citas).

Diseño: elige un color principal y un acento que encajen con el sector (salud: verdes/azules; lujo: oscuros y dorados; tecnología: azules/violetas; comida: cálidos) y una tipografía: geometrica (moderna), elegante (lujo, salud, belleza), editorial (cultura, gastronomía), redondeada (infantil, cercano), sans (neutra).`;

const claudeProveedor: ProveedorPaginas = {
  id: 'claude',
  disponible: iaConfigurada,
  async generar({ tipo, descripcion, nombre }) {
    const pide = tipo === 'sitio'
      ? 'Un sitio web de 3 a 5 páginas (por ejemplo: Inicio, Servicios, Sobre nosotros, Precios, Contacto; adapta los nombres al negocio). La última página es de contacto con formulario o calendario. Rutas cortas en minúsculas.'
      : 'Un embudo de 2 páginas: una landing de captación o venta muy completa (termina en formulario) y una página de gracias breve con «pasos».';
    try {
      const r = await claude().beta.messages.stream({
        model: MODELO_IA,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA_BRIEF } },
        system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `<pedido>${pide}</pedido>\n<nombre>${nombre}</nombre>\n<negocio>\n${descripcion}\n</negocio>` }],
      }, { timeout: 180_000 }).finalMessage();
      const uso: Uso = { entrada: (r.usage.input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0), salida: r.usage.output_tokens ?? 0 };
      if (r.stop_reason === 'refusal') throw new ErrorIA('La IA no quiso generar esta página. Prueba a describir el negocio de otra forma.', false);
      if (r.stop_reason === 'max_tokens') throw new ErrorIA('La página salió demasiado larga. Pide menos secciones o páginas.', false);
      const txt = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      try {
        return { brief: JSON.parse(txt) as Brief, uso };
      } catch {
        throw new ErrorIA('La IA devolvió un formato inesperado. Inténtalo de nuevo.', true);
      }
    } catch (e) {
      throw traducirError(e);
    }
  },
};

const PROVEEDORES: Record<string, ProveedorPaginas> = { claude: claudeProveedor };

export function proveedorPaginas(): ProveedorPaginas | null {
  const p = PROVEEDORES[process.env.IA_PROVEEDOR_PAGINAS || 'claude'];
  return p && p.disponible() ? p : null;
}
