import { nuevoId, type Bloque, type CampoFormulario, type Contenido, type Seccion } from './tipos.ts';

// Plantillas de embudo: cada una crea varios pasos ya diseñados y listos para
// editar. Los textos son de ejemplo y se cambian en el editor.

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never;
const b = (x: SinId<Bloque>): Bloque => ({ id: nuevoId(), ...x } as Bloque);
const sec = (fondo: string, bloques: Bloque[], relleno: Seccion['relleno'] = 'normal', ancho: Seccion['ancho'] = 'normal', ancla = ''): Seccion =>
  ({ id: nuevoId(), ancla, fondo, relleno, ancho, bloques });
const titulo = (texto: string, nivel: 1 | 2 | 3 = 1) => b({ tipo: 'titulo', texto, nivel, alineacion: 'centro' });
const texto = (t: string, tamano: 'normal' | 'grande' = 'normal') => b({ tipo: 'texto', texto: t, alineacion: 'centro', tamano });
const boton = (t: string, accion: 'siguiente' | 'url' | 'ancla' = 'siguiente', url = '') => b({ tipo: 'boton', texto: t, accion, url, alineacion: 'centro', tamano: 'grande' });
const lista = (elementos: string[], icono: 'check' | 'punto' | 'numero' = 'check') => b({ tipo: 'lista', elementos, icono });
const campos = (...c: [string, string, CampoFormulario['tipo'], boolean][]): CampoFormulario[] => c.map(([clave, etiqueta, tipo, obligatorio]) => ({ clave, etiqueta, tipo, obligatorio }));
const form = (botonTxt: string, etiquetas: string[], cs = campos(['nombre', 'Nombre', 'texto', true], ['email', 'Correo electrónico', 'email', true])) =>
  b({ tipo: 'formulario', campos: cs, boton: botonTxt, etiquetas, despues: 'siguiente', url: '', mensaje: '¡Gracias! Te escribimos en breve.', aviso_legal: 'Al enviar aceptas nuestra política de privacidad.' });
const testimonio = (cita: string, autor: string, cargo: string) => b({ tipo: 'testimonio', cita, autor, cargo, foto: '' });
const espacio = (alto = 16) => b({ tipo: 'separador', estilo: 'espacio', alto });
const pagina = (color: string, secciones: Seccion[], fuente: Contenido['estilo']['fuente'] = 'sans'): Contenido => ({ estilo: { color_primario: color, fondo: '#ffffff', fuente }, secciones });
const enUnaSemana = () => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16);

export interface Plantilla {
  id: string; nombre: string; descripcion: string; categoria: string; color: string;
  pasos: () => { nombre: string; ruta: string; contenido: Contenido }[];
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: 'captacion', nombre: 'Captación de clientes potenciales', categoria: 'Leads', color: '#155eef',
    descripcion: 'Página con formulario para captar contactos y página de gracias.',
    pasos: () => [
      { nombre: 'Registro', ruta: 'registro', contenido: pagina('#155eef', [
        sec('#0b1f4d', [titulo('Consigue más clientes este mes sin gastar más en anuncios'), texto('Te enseñamos el método que usan cientos de negocios locales para llenar su agenda. Déjanos tus datos y te enviamos la guía gratis.', 'grande')], 'grande'),
        sec('#ffffff', [lista(['Plan paso a paso, sin tecnicismos', 'Plantillas de mensajes listas para usar', 'Casos reales de negocios como el tuyo']), form('Quiero la guía gratis', ['lead', 'guia'])], 'normal', 'estrecho'),
        sec('#f2f4f7', [titulo('Lo que dicen nuestros clientes', 2), testimonio('En dos semanas duplicamos las citas. Lo mejor: todo automático.', 'Laura Méndez', 'Clínica dental')]),
      ]) },
      { nombre: 'Gracias', ruta: 'gracias', contenido: pagina('#155eef', [
        sec('#ffffff', [titulo('¡Gracias! Revisa tu correo'), texto('Te acabamos de enviar la guía. Si no la ves en unos minutos, mira en la carpeta de promociones o spam.', 'grande'), boton('Volver a la web', 'url', 'https://example.com')], 'grande', 'estrecho'),
      ]) },
    ],
  },
  {
    id: 'webinar', nombre: 'Webinar', categoria: 'Eventos', color: '#7a5af8',
    descripcion: 'Registro al webinar con cuenta atrás, confirmación y sala de la repetición.',
    pasos: () => [
      { nombre: 'Registro', ruta: 'registro', contenido: pagina('#7a5af8', [
        sec('#1e1240', [texto('WEBINAR GRATUITO EN DIRECTO'), titulo('Cómo automatizar tu negocio con IA en 60 minutos'), b({ tipo: 'cuenta_atras', hasta: enUnaSemana(), texto_fin: '¡Estamos en directo!' })], 'grande'),
        sec('#ffffff', [titulo('En esta sesión aprenderás', 2), lista(['A responder a tus clientes 24/7 con un asistente de IA', 'A recuperar citas perdidas con recordatorios automáticos', 'A medir qué canal te trae más ventas'], 'numero'), form('Reservar mi plaza', ['webinar'])], 'normal', 'estrecho'),
      ]) },
      { nombre: 'Confirmación', ruta: 'confirmacion', contenido: pagina('#7a5af8', [
        sec('#ffffff', [titulo('¡Plaza reservada!'), texto('Te enviaremos el enlace de acceso por correo y un recordatorio una hora antes.', 'grande'), boton('Ver la repetición del último webinar')], 'grande', 'estrecho'),
      ]) },
      { nombre: 'Repetición', ruta: 'repeticion', contenido: pagina('#7a5af8', [
        sec('#0f0a24', [titulo('Repetición del webinar', 2), b({ tipo: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), boton('Hablar con el equipo', 'url', 'https://example.com/contacto')], 'normal', 'ancho'),
      ]) },
    ],
  },
  {
    id: 'citas', nombre: 'Reserva de citas', categoria: 'Servicios', color: '#0e9384',
    descripcion: 'Página de servicio con el calendario de reservas integrado y confirmación.',
    pasos: () => [
      { nombre: 'Inicio', ruta: 'inicio', contenido: pagina('#0e9384', [
        sec('#e6f6f4', [titulo('Tu primera consulta, sin esperas'), texto('Elige el día y la hora que mejor te vengan. Confirmación al instante y recordatorio automático.', 'grande'), boton('Reservar ahora')], 'grande'),
        sec('#ffffff', [titulo('¿Por qué elegirnos?', 2), lista(['Más de 10 años de experiencia', 'Atención en menos de 24 horas', 'Primera valoración sin compromiso'])], 'normal', 'estrecho'),
      ]) },
      { nombre: 'Reservar', ruta: 'reservar', contenido: pagina('#0e9384', [
        sec('#ffffff', [titulo('Elige tu cita', 2), b({ tipo: 'calendario', slug: '', alto: 760 })], 'normal', 'ancho'),
      ]) },
    ],
  },
  {
    id: 'venta', nombre: 'Página de venta', categoria: 'Ventas', color: '#e04f16',
    descripcion: 'Venta de un producto o servicio con precios, testimonios y garantía.',
    pasos: () => [
      { nombre: 'Oferta', ruta: 'oferta', contenido: pagina('#e04f16', [
        sec('#1a0f0a', [titulo('El programa que transforma tu negocio en 30 días'), texto('Todo lo que necesitas para vender más, con acompañamiento paso a paso.', 'grande'), boton('Ver precios', 'ancla', '#precios')], 'grande'),
        sec('#ffffff', [titulo('Qué incluye', 2), lista(['12 lecciones en vídeo', 'Plantillas y guiones', 'Sesión mensual de preguntas en directo', 'Comunidad privada'])], 'normal', 'estrecho'),
        sec('#fff4ed', [titulo('Elige tu plan', 2), b({ tipo: 'precio', titulo: 'Programa completo', precio: '297 €', periodo: 'pago único', caracteristicas: ['Acceso de por vida', 'Actualizaciones incluidas', 'Garantía de 14 días'], boton: 'Comprar ahora', accion: 'url', url: 'https://example.com/pago', destacado: true })], 'normal', 'normal', 'precios'),
        sec('#ffffff', [testimonio('Recuperé la inversión la primera semana. Muy recomendable.', 'Carlos Ruiz', 'Consultor')]),
      ]) },
      { nombre: 'Gracias', ruta: 'gracias', contenido: pagina('#e04f16', [
        sec('#ffffff', [titulo('¡Bienvenido al programa!'), texto('En unos minutos recibirás tus accesos por correo.', 'grande')], 'grande', 'estrecho'),
      ]) },
    ],
  },
  {
    id: 'descarga', nombre: 'Descarga de recurso (lead magnet)', categoria: 'Leads', color: '#2e90fa',
    descripcion: 'Ebook o guía gratuita a cambio del correo, con página de descarga.',
    pasos: () => [
      { nombre: 'Descarga', ruta: 'descarga', contenido: pagina('#2e90fa', [
        sec('#eff8ff', [texto('GUÍA GRATUITA'), titulo('Los 7 errores que te hacen perder clientes'), texto('Descárgala gratis y evita los fallos más comunes.', 'grande'), form('Descargar la guía', ['ebook'], campos(['email', 'Tu mejor correo', 'email', true]))], 'grande', 'estrecho'),
      ]) },
      { nombre: 'Tu guía', ruta: 'tu-guia', contenido: pagina('#2e90fa', [
        sec('#ffffff', [titulo('Aquí tienes tu guía'), texto('Pulsa el botón para descargarla. Súbela a Medios y pega aquí su enlace.'), boton('Descargar PDF', 'url', 'https://example.com/guia.pdf')], 'grande', 'estrecho'),
      ]) },
    ],
  },
  {
    id: 'lista-espera', nombre: 'Próximamente / lista de espera', categoria: 'Lanzamientos', color: '#101828',
    descripcion: 'Una sola página para captar interesados antes del lanzamiento.',
    pasos: () => [
      { nombre: 'Próximamente', ruta: 'proximamente', contenido: pagina('#101828', [
        sec('#101828', [titulo('Algo grande está a punto de llegar'), texto('Apúntate a la lista de espera y te avisaremos el primero, con un descuento de lanzamiento.', 'grande'), b({ tipo: 'cuenta_atras', hasta: enUnaSemana(), texto_fin: '¡Ya está aquí!' }), espacio(8),
          b({ tipo: 'formulario', campos: campos(['email', 'Correo electrónico', 'email', true]), boton: 'Avisadme', etiquetas: ['lista-espera'], despues: 'mensaje', url: '', mensaje: '¡Listo! Te avisaremos en cuanto abramos.', aviso_legal: '' })], 'grande', 'estrecho'),
      ], 'redondeada') },
    ],
  },
  {
    id: 'negocio-local', nombre: 'Negocio local', categoria: 'Servicios', color: '#dc6803',
    descripcion: 'Landing para clínicas, talleres o restaurantes con servicios, opiniones y contacto.',
    pasos: () => [
      { nombre: 'Inicio', ruta: 'inicio', contenido: pagina('#dc6803', [
        sec('#fffaeb', [titulo('Tu clínica de confianza en el centro'), texto('Atención cercana, profesionales con experiencia y cita en menos de 48 horas.', 'grande'), boton('Pedir cita', 'ancla', '#contacto')], 'grande'),
        sec('#ffffff', [titulo('Nuestros servicios', 2), lista(['Primera visita y diagnóstico', 'Tratamientos personalizados', 'Revisiones periódicas', 'Financiación sin intereses'])], 'normal', 'estrecho'),
        sec('#f9fafb', [titulo('Opiniones', 2), testimonio('Trato excelente y muy puntuales. Volveré seguro.', 'Marta G.', 'Paciente'), testimonio('Me explicaron todo con mucha paciencia.', 'Jorge P.', 'Paciente')]),
        sec('#ffffff', [titulo('Pide tu cita', 2), b({ tipo: 'formulario', campos: campos(['nombre', 'Nombre', 'texto', true], ['telefono', 'Teléfono', 'tel', true], ['mensaje', '¿En qué podemos ayudarte?', 'textarea', false]), boton: 'Quiero que me llaméis', etiquetas: ['web', 'pide-cita'], despues: 'mensaje', url: '', mensaje: '¡Gracias! Te llamamos hoy mismo.', aviso_legal: 'Al enviar aceptas nuestra política de privacidad.' })], 'normal', 'estrecho', 'contacto'),
      ]) },
    ],
  },
];

export const PAGINA_EN_BLANCO = (): Contenido => pagina('#155eef', [sec('#ffffff', [titulo('Título de tu página'), texto('Escribe aquí el texto. Pulsa un bloque para editarlo o añade más desde la izquierda.', 'grande'), boton('Continuar')], 'grande')]);
