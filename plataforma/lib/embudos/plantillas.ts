import { nuevoId, type AccionBoton, type Bloque, type CampoFormulario, type Contenido, type Fuente, type Seccion, type Visual } from './tipos.ts';

// Plantillas de embudo: cada una crea varios pasos ya diseñados y listos para
// editar. Los textos son de ejemplo y se cambian en el editor.

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never;
export const b = (x: SinId<Bloque>): Bloque => ({ id: nuevoId(), ...x } as Bloque);

interface OpcSec { fondo?: string; tipo?: Seccion['fondo_tipo']; fondo2?: string; relleno?: Seccion['relleno']; ancho?: Seccion['ancho']; ancla?: string }
export const sec = (o: OpcSec, bloques: Bloque[]): Seccion => ({
  id: nuevoId(), ancla: o.ancla ?? '', fondo: o.fondo ?? '#ffffff', relleno: o.relleno ?? 'normal', ancho: o.ancho ?? 'ancho', bloques,
  ...(o.tipo && o.tipo !== 'solido' ? { fondo_tipo: o.tipo } : {}), ...(o.fondo2 ? { fondo2: o.fondo2 } : {}),
});
export const pagina = (o: { color: string; acento: string; fuente?: Fuente; radio?: 'recto' | 'suave' | 'redondo'; fondo?: string }, secciones: Seccion[]): Contenido =>
  ({ estilo: { color_primario: o.color, color_acento: o.acento, fondo: o.fondo ?? '#ffffff', fuente: o.fuente ?? 'geometrica', radio: o.radio ?? 'suave' }, secciones });

// --- Constructores de bloques ----------------------------------------------------
export const titulo = (texto: string, nivel: 1 | 2 | 3 = 2) => b({ tipo: 'titulo', texto, nivel, alineacion: 'centro' });
export const texto = (t: string, tamano: 'normal' | 'grande' = 'normal') => b({ tipo: 'texto', texto: t, alineacion: 'centro', tamano });
export const boton = (t: string, accion: AccionBoton = 'siguiente', url = '') => b({ tipo: 'boton', texto: t, accion, url, alineacion: 'centro', tamano: 'grande' });
export const campos = (...c: [string, string, CampoFormulario['tipo'], boolean][]): CampoFormulario[] => c.map(([clave, etiqueta, tipo, obligatorio]) => ({ clave, etiqueta, tipo, obligatorio }));
export const CAMPOS_BASE = campos(['nombre', 'Nombre', 'texto', true], ['email', 'Correo electrónico', 'email', true]);
export const form = (botonTxt: string, etiquetas: string[], cs = CAMPOS_BASE, despues: 'siguiente' | 'mensaje' = 'siguiente', mensaje = '¡Gracias! Te escribimos en breve.') =>
  b({ tipo: 'formulario', campos: cs, boton: botonTxt, etiquetas, despues, url: '', mensaje, aviso_legal: 'Al enviar aceptas nuestra política de privacidad. Cero spam.' });
export const hero = (o: { etiqueta?: string; titulo: string; subtitulo: string; boton: string; accion?: AccionBoton; url?: string; boton2?: string; accion2?: AccionBoton; url2?: string; prueba?: string; visual?: Visual; centro?: boolean }) =>
  b({ tipo: 'hero', etiqueta: o.etiqueta ?? '', titulo: o.titulo, subtitulo: o.subtitulo, prueba: o.prueba ?? '', disposicion: o.centro ? 'centro' : 'dividido', visual: o.visual ?? 'tarjetas', imagen: '',
    boton_texto: o.boton, boton_accion: o.accion ?? 'ancla', boton_url: o.url ?? '#formulario', boton2_texto: o.boton2 ?? '', boton2_accion: o.accion2 ?? 'ancla', boton2_url: o.url2 ?? '' });
export const ventajas = (tituloTxt: string, subtitulo: string, items: [string, string, string][], columnas: 2 | 3 | 4 = 3, estilo: 'tarjetas' | 'simple' = 'tarjetas') =>
  b({ tipo: 'caracteristicas', titulo: tituloTxt, subtitulo, columnas, estilo, items: items.map(([icono, t, x]) => ({ icono, titulo: t, texto: x })) });
export const bloqueIT = (o: { etiqueta: string; titulo: string; texto: string; puntos?: string[]; visual?: Visual; invertir?: boolean; boton?: string; accion?: AccionBoton; url?: string }) =>
  b({ tipo: 'imagen_texto', etiqueta: o.etiqueta, titulo: o.titulo, texto: o.texto, puntos: o.puntos ?? [], visual: o.visual ?? 'panel', imagen: '', invertir: o.invertir ?? false,
    boton_texto: o.boton ?? '', boton_accion: o.accion ?? 'ancla', boton_url: o.url ?? '#formulario' });
export const cifras = (items: [string, string][]) => b({ tipo: 'cifras', items: items.map(([valor, etiqueta]) => ({ valor, etiqueta })) });
export const opiniones = (tituloTxt: string, items: [string, string, string][]) =>
  b({ tipo: 'testimonios', titulo: tituloTxt, items: items.map(([cita, autor, cargo]) => ({ cita, autor, cargo, foto: '', estrellas: 5 })) });
export const faq = (tituloTxt: string, items: [string, string][]) => b({ tipo: 'preguntas', titulo: tituloTxt, items: items.map(([pregunta, respuesta]) => ({ pregunta, respuesta })) });
export const logos = (tituloTxt: string, items: string[]) => b({ tipo: 'logos', titulo: tituloTxt, items });
export const llamada = (t: string, x: string, botonTxt: string, accion: AccionBoton = 'ancla', url = '#formulario') =>
  b({ tipo: 'llamada', titulo: t, texto: x, estilo: 'tarjeta', boton_texto: botonTxt, boton_accion: accion, boton_url: url });
export const pasos = (tituloTxt: string, items: [string, string][]) => b({ tipo: 'pasos', titulo: tituloTxt, items: items.map(([t, x]) => ({ titulo: t, texto: x })) });
export const planes = (tituloTxt: string, subtitulo: string, items: { nombre: string; precio: string; periodo?: string; descripcion?: string; caracteristicas: string[]; boton: string; destacado?: boolean }[], accion: AccionBoton = 'siguiente', url = '') =>
  b({ tipo: 'planes', titulo: tituloTxt, subtitulo, accion, url, items: items.map((p) => ({ periodo: '', descripcion: '', destacado: false, ...p })) });
const enUnaSemana = () => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16);
export const espacio = (alto = 8) => b({ tipo: 'separador', estilo: 'espacio', alto });

// Página de «gracias» común con próximos pasos.
const gracias = (color: string, acento: string, fuente: Fuente, t: string, sub: string, items: [string, string][], extra: Bloque[] = []) => pagina({ color, acento, fuente }, [
  sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'grande', ancho: 'normal' }, [
    b({ tipo: 'hero', etiqueta: 'Todo listo', titulo: t, subtitulo: sub, prueba: '', disposicion: 'centro', visual: 'ninguno', imagen: '', boton_texto: '', boton_accion: 'siguiente', boton_url: '', boton2_texto: '', boton2_accion: 'siguiente', boton2_url: '' }),
    ...extra,
  ]),
  sec({ fondo: '#f8fafc', ancho: 'normal' }, [pasos('Qué pasa ahora', items)]),
]);

export interface Plantilla {
  id: string; nombre: string; descripcion: string; categoria: string; color: string;
  pasos: () => { nombre: string; ruta: string; contenido: Contenido }[];
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: 'captacion', nombre: 'Captación para agencias y servicios', categoria: 'Leads', color: '#155eef',
    descripcion: 'Landing completa para conseguir clientes potenciales: propuesta clara, prueba social, proceso y formulario.',
    pasos: () => {
      const C = '#155eef'; const A = '#7a5af8';
      return [
        { nombre: 'Registro', ruta: 'registro', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Plazas limitadas este mes', titulo: 'Llena tu agenda con clientes que *sí compran*',
            subtitulo: 'Diseñamos, lanzamos y optimizamos tu sistema de captación: anuncios, landing y seguimiento automático. Tú solo atiendes a los clientes.',
            boton: 'Quiero mi estrategia gratis', boton2: 'Ver resultados', url2: '#resultados', prueba: '4,9/5 en más de 300 negocios', visual: 'tarjetas',
          })]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [logos('Negocios que ya crecen con nosotros', ['Nórdika', 'Clínica Alba', 'Lumen', 'Atlas Fit', 'Verdia'])]),
          sec({ fondo: '#f8fafc' }, [ventajas('Un sistema, no un parche', 'Todo conectado para que ningún contacto se quede sin respuesta.', [
            ['objetivo', 'Anuncios que convierten', 'Campañas en Meta y Google centradas en clientes de tu zona, no en clics vacíos.'],
            ['rayo', 'Landing de alto impacto', 'Páginas rápidas, claras y pensadas para que el visitante dé el paso.'],
            ['chat', 'Respuesta en segundos', 'WhatsApp, SMS y correo automáticos para que el lead no se enfríe.'],
            ['calendario', 'Citas en piloto automático', 'Reservas con recordatorios: menos ausencias, más ingresos.'],
            ['grafico', 'Informes que se entienden', 'Sabes cuánto te cuesta cada cliente y de dónde viene.'],
            ['escudo', 'Sin permanencia', 'Trabajamos por resultados. Si no te sirve, lo dejas.'],
          ])]),
          sec({ fondo: '#ffffff', ancla: 'resultados' }, [bloqueIT({
            etiqueta: 'Resultados reales', titulo: 'De 4 a 27 citas al mes en 60 días', texto: 'Así lo hicimos para una clínica de fisioterapia con el mismo presupuesto que ya gastaba en publicidad.',
            puntos: ['Coste por cliente un 63 % más bajo', 'Respuesta automática en menos de 1 minuto', 'Recordatorios que redujeron las ausencias a la mitad'], visual: 'panel', boton: 'Quiero lo mismo',
          })]),
          sec({ fondo: '#0b1220', relleno: 'normal' }, [cifras([['+300', 'negocios acompañados'], ['63 %', 'menos coste por cliente'], ['< 1 min', 'tiempo de respuesta'], ['4,9★', 'valoración media']])]),
          sec({ fondo: '#ffffff' }, [opiniones('Lo que dicen nuestros clientes', [
            ['En dos meses hemos tenido que ampliar horario. Y todo llega solo a la agenda.', 'Laura Méndez', 'Clínica Alba'],
            ['Por fin sé cuánto me cuesta un cliente. Y es bastante menos que antes.', 'Javier Ortega', 'Atlas Fit'],
            ['La parte de WhatsApp automático nos ha cambiado la forma de trabajar.', 'Marta Ríos', 'Estudio Lumen'],
          ])]),
          sec({ fondo: '#f8fafc', ancho: 'normal' }, [pasos('Cómo trabajamos', [['Diagnóstico gratis', 'Analizamos tu negocio y tu competencia en una llamada de 20 minutos.'], ['Plan a medida', 'Te proponemos objetivos, presupuesto y plazos claros.'], ['Lanzamiento', 'En 10 días tienes el sistema funcionando y midiendo.']])]),
          sec({ fondo: '#ffffff', tipo: 'malla', ancho: 'estrecho', ancla: 'formulario' }, [titulo('Pide tu estrategia gratuita'), texto('Te respondemos en menos de 24 horas laborables.'),
            form('Quiero mi estrategia', ['lead', 'estrategia'], campos(['nombre', 'Nombre', 'texto', true], ['email', 'Correo electrónico', 'email', true], ['telefono', 'Teléfono', 'tel', false], ['empresa', 'Tu negocio', 'texto', false]))]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [faq('Preguntas frecuentes', [['¿Cuánto cuesta?', 'Depende de tu objetivo y tu zona. En el diagnóstico te damos una cifra cerrada, sin sorpresas.'], ['¿Cuándo veré resultados?', 'Los primeros contactos suelen llegar en la primera semana tras el lanzamiento.'], ['¿Hay permanencia?', 'No. Mes a mes. Si no ves valor, lo dejas.']])]),
        ]) },
        { nombre: 'Gracias', ruta: 'gracias', contenido: gracias(C, A, 'geometrica', '¡Recibido! Hablamos *muy pronto*', 'Revisa tu correo: te acabamos de enviar la confirmación y los siguientes pasos.', [['Revisa tu correo', 'Si no lo ves, mira en promociones o spam.'], ['Te llamamos', 'En menos de 24 h laborables para conocer tu negocio.'], ['Tu estrategia', 'Recibes un plan con objetivos y presupuesto.']]) },
      ];
    },
  },
  {
    id: 'webinar', nombre: 'Webinar en directo', categoria: 'Eventos', color: '#7a5af8',
    descripcion: 'Registro con cuenta atrás y fondo oscuro, confirmación y página de repetición.',
    pasos: () => {
      const C = '#7a5af8'; const A = '#ee46bc';
      return [
        { nombre: 'Registro', ruta: 'registro', contenido: pagina({ color: C, acento: A, fuente: 'geometrica' }, [
          sec({ fondo: '#0b0720', tipo: 'malla', relleno: 'grande', ancho: 'normal' }, [hero({
            etiqueta: 'Webinar gratuito · En directo', titulo: 'Automatiza tu negocio con IA en *60 minutos*',
            subtitulo: 'Te enseñamos, paso a paso y en directo, cómo responder clientes, agendar citas y hacer seguimiento sin tocar el móvil.',
            boton: 'Reservar mi plaza', prueba: '+1.200 inscritos en la última edición', visual: 'ninguno', centro: true,
          }), b({ tipo: 'cuenta_atras', hasta: enUnaSemana(), texto_fin: '¡Estamos en directo!' })]),
          sec({ fondo: '#ffffff' }, [ventajas('Lo que vas a aprender', '', [
            ['ia', 'Asistentes que venden', 'Cómo configurar un asistente que contesta y agenda por WhatsApp.'],
            ['rayo', 'Flujos en piloto automático', 'Las 5 automatizaciones que todo negocio debería tener.'],
            ['grafico', 'Medir lo que importa', 'Qué números mirar cada semana para crecer.'],
          ])]),
          sec({ fondo: '#f8fafc' }, [bloqueIT({ etiqueta: 'Tu ponente', titulo: 'Ana Torres', texto: '12 años ayudando a negocios de servicios a crecer con sistemas. Ha automatizado más de 400 empresas en España y LATAM.', puntos: ['Fundadora de Escala Lab', 'Autora de «Negocio en piloto automático»'], visual: 'chat', invertir: true })]),
          sec({ fondo: '#0b0720', tipo: 'malla', ancho: 'estrecho', ancla: 'formulario' }, [titulo('Reserva tu plaza gratis'), texto('Te enviamos el enlace por correo y un recordatorio una hora antes.'), form('Quiero asistir', ['webinar'])]),
        ]) },
        { nombre: 'Confirmación', ruta: 'confirmacion', contenido: gracias(C, A, 'geometrica', '¡Tu plaza está *reservada*!', 'Te hemos enviado el enlace de acceso por correo.', [['Apúntalo', 'Añade el evento a tu calendario.'], ['Prepárate', 'Ten a mano tus dudas: habrá ronda de preguntas.'], ['Conéctate', 'Entra 5 minutos antes para no perderte nada.']]) },
        { nombre: 'Repetición', ruta: 'repeticion', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#0b0720', tipo: 'malla', relleno: 'grande' }, [titulo('La repetición del webinar', 1), texto('Disponible solo durante 72 horas.', 'grande'), b({ tipo: 'video', url: '' }), boton('Quiero ayuda para implementarlo', 'url', 'https://example.com')]),
        ]) },
      ];
    },
  },
  {
    id: 'citas', nombre: 'Clínica / reserva de citas', categoria: 'Servicios', color: '#0e9384',
    descripcion: 'Estética, clínicas y centros: servicios, opiniones y el calendario de reservas integrado.',
    pasos: () => {
      const C = '#0e9384'; const A = '#2e90fa';
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fuente: 'elegante', radio: 'redondo' }, [
          sec({ fondo: '#f0fdf9', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Primera visita con un 20 % de descuento', titulo: 'Tu sonrisa, en las mejores *manos*',
            subtitulo: 'Clínica dental en el centro con especialistas, tecnología de última generación y cita en menos de 48 horas.',
            boton: 'Reservar cita', url: '#reservar', boton2: 'Ver tratamientos', url2: '#tratamientos', prueba: '4,9 en Google · +850 reseñas', visual: 'movil',
          })]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [cifras([['15 años', 'de experiencia'], ['+12.000', 'pacientes'], ['48 h', 'para tu cita'], ['0 €', 'primera valoración']])]),
          sec({ fondo: '#ffffff', ancla: 'tratamientos' }, [ventajas('Tratamientos', 'Todo en un mismo lugar, con presupuesto cerrado.', [
            ['estrella', 'Estética dental', 'Blanqueamiento y carillas con resultados naturales.'],
            ['escudo', 'Implantes', 'Recupera tu sonrisa con garantía de por vida.'],
            ['sol', 'Ortodoncia invisible', 'Alineadores discretos y cómodos, sin brackets.'],
            ['corazon', 'Odontopediatría', 'Los más pequeños, tranquilos y bien atendidos.'],
          ], 4)]),
          sec({ fondo: '#f8fafc' }, [opiniones('Pacientes felices', [
            ['Me explicaron todo con calma y el resultado es perfecto. Volvería mil veces.', 'Elena S.', 'Carillas'],
            ['Tenía pánico al dentista y aquí ha desaparecido. Trato increíble.', 'Raúl P.', 'Implantes'],
            ['Cita al día siguiente y sin esperas. Así da gusto.', 'Nuria M.', 'Revisión'],
          ])]),
          sec({ fondo: '#ffffff', ancla: 'reservar' }, [titulo('Elige día y hora'), texto('Recibirás la confirmación al instante y un recordatorio el día antes.'), b({ tipo: 'calendario', slug: '', alto: 760 })]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [faq('Preguntas frecuentes', [['¿La primera visita tiene coste?', 'No. La primera valoración es gratuita y sin compromiso.'], ['¿Puedo financiar el tratamiento?', 'Sí, hasta 24 meses sin intereses.'], ['¿Dónde estáis?', 'En pleno centro, a 2 minutos del metro. Parking concertado.']])]),
        ]) },
        { nombre: 'Confirmación', ruta: 'confirmacion', contenido: gracias(C, A, 'elegante', 'Cita *confirmada*', 'Te esperamos. Si necesitas cambiarla, usa el enlace del correo.', [['Recordatorio', 'Te avisaremos el día antes por SMS o WhatsApp.'], ['Llega 10 min antes', 'Para completar tu ficha con calma.'], ['Trae tu DNI', 'Y tu tarjeta sanitaria si la tienes.']]) },
      ];
    },
  },
  {
    id: 'venta', nombre: 'Página de venta de curso o producto', categoria: 'Ventas', color: '#e04f16',
    descripcion: 'Carta de ventas con problema, solución, temario, precios, garantía y preguntas.',
    pasos: () => {
      const C = '#e04f16'; const A = '#f79009';
      return [
        { nombre: 'Oferta', ruta: 'oferta', contenido: pagina({ color: C, acento: A, fuente: 'editorial' }, [
          sec({ fondo: '#fffaf5', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Nueva edición · Precio de lanzamiento', titulo: 'Domina las ventas por WhatsApp en *30 días*',
            subtitulo: 'El programa práctico para convertir conversaciones en clientes, con guiones, plantillas y automatizaciones listas para copiar.',
            boton: 'Quiero el programa', url: '#precios', prueba: '+2.400 alumnos · 4,8 de valoración', visual: 'movil',
          })]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [bloqueIT({ etiqueta: 'El problema', titulo: 'Contestas tarde, preguntan precio y desaparecen', texto: 'Si te suena, no es culpa tuya: nadie te enseñó a vender por chat. Este programa sí.', puntos: ['Mensajes sin respuesta que se enfrían', 'Clientes que comparan solo por precio', 'Horas perdidas repitiendo lo mismo'], visual: 'tarjetas', invertir: true })]),
          sec({ fondo: '#f8fafc' }, [ventajas('Qué incluye', '4 módulos prácticos + plantillas descargables.', [
            ['libro', 'Módulo 1 · Primer mensaje', 'Cómo abrir la conversación para que te respondan.'],
            ['chat', 'Módulo 2 · Guiones de venta', '15 guiones probados para cada situación.'],
            ['rayo', 'Módulo 3 · Automatización', 'Respuestas y seguimientos que trabajan por ti.'],
            ['trofeo', 'Módulo 4 · Cierre', 'Objeciones, precio y el último empujón.'],
          ], 2)]),
          sec({ fondo: '#ffffff', ancla: 'precios' }, [planes('Elige tu acceso', 'Pago único. Acceso de por vida y actualizaciones.', [
            { nombre: 'Esencial', precio: '97 €', descripcion: 'El programa completo', caracteristicas: ['4 módulos en vídeo', 'Plantillas y guiones', 'Comunidad privada'], boton: 'Comprar Esencial' },
            { nombre: 'Pro', precio: '197 €', descripcion: 'Con acompañamiento', caracteristicas: ['Todo lo de Esencial', '4 sesiones en directo', 'Revisión de tus guiones', 'Bonus: automatizaciones'], boton: 'Comprar Pro', destacado: true },
          ])]),
          sec({ fondo: '#0b1220', ancho: 'normal' }, [bloqueIT({ etiqueta: 'Garantía', titulo: '30 días o te devolvemos el dinero', texto: 'Haz el programa. Si en 30 días no ves mejora en tus ventas, te devolvemos el 100 %. Sin preguntas.', visual: 'tarjetas' })]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [faq('Preguntas frecuentes', [['¿Para quién es?', 'Para negocios que venden por WhatsApp o redes: servicios, tiendas, formación…'], ['¿Cuánto tiempo necesito?', 'Unos 20 minutos al día durante 30 días.'], ['¿Cómo accedo?', 'Al instante, con tu correo, desde cualquier dispositivo.']])]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [llamada('Tus próximas ventas empiezan hoy', 'Precio de lanzamiento solo esta semana.', 'Quiero el programa', 'ancla', '#precios')]),
        ]) },
        { nombre: 'Gracias', ruta: 'gracias', contenido: gracias(C, A, 'editorial', '¡Bienvenido al *programa*!', 'En unos minutos recibirás tu acceso por correo.', [['Accede', 'Entra con el enlace del correo.'], ['Preséntate', 'Únete a la comunidad privada.'], ['Empieza', 'Módulo 1: 20 minutos y a practicar.']]) },
      ];
    },
  },
  {
    id: 'descarga', nombre: 'Descarga de guía (lead magnet)', categoria: 'Leads', color: '#2e90fa',
    descripcion: 'Regala una guía a cambio del correo: portada atractiva, contenido y formulario directo.',
    pasos: () => {
      const C = '#2e90fa'; const A = '#12b76a';
      return [
        { nombre: 'Descarga', ruta: 'descarga', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#f5faff', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Guía gratuita · PDF de 24 páginas', titulo: 'Los *7 errores* que te hacen perder clientes',
            subtitulo: 'Descubre qué falla en tu web, tus anuncios y tu seguimiento, y cómo arreglarlo esta misma semana.',
            boton: 'Descargar gratis', prueba: 'Descargada por +5.000 profesionales', visual: 'panel',
          })]),
          sec({ fondo: '#ffffff' }, [ventajas('Qué vas a encontrar', '', [['objetivo', 'Diagnóstico rápido', 'Un test de 5 minutos para saber dónde pierdes clientes.'], ['herramienta', 'Soluciones concretas', 'Qué cambiar, en qué orden y con qué herramientas.'], ['regalo', 'Plantillas', 'Mensajes y textos listos para copiar y pegar.']])]),
          sec({ fondo: '#f5faff', tipo: 'malla', ancho: 'estrecho', ancla: 'formulario' }, [titulo('¿A dónde te la enviamos?'), form('Enviarme la guía', ['ebook'], campos(['nombre', 'Nombre', 'texto', false], ['email', 'Tu mejor correo', 'email', true]))]),
        ]) },
        { nombre: 'Tu guía', ruta: 'tu-guia', contenido: gracias(C, A, 'geometrica', 'Tu guía va de *camino*', 'Revisa tu bandeja de entrada en los próximos minutos.', [['Revisa el correo', 'Busca un mensaje con el asunto «Tu guía».'], ['Haz el test', 'Empieza por el diagnóstico de la página 3.'], ['Aplica', 'Elige un error y arréglalo esta semana.']], [boton('Descargar ahora', 'url', 'https://example.com/guia.pdf')]) },
      ];
    },
  },
  {
    id: 'lista-espera', nombre: 'Lanzamiento / lista de espera', categoria: 'Lanzamientos', color: '#6172f3',
    descripcion: 'Página oscura de producto con panel, logos y lista de espera con acceso anticipado.',
    pasos: () => {
      const C = '#6172f3'; const A = '#22ccee';
      return [
        { nombre: 'Próximamente', ruta: 'proximamente', contenido: pagina({ color: C, acento: A, fuente: 'geometrica', fondo: '#070b18' }, [
          sec({ fondo: '#070b18', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Acceso anticipado · Primavera 2027', titulo: 'El CRM que trabaja *mientras duermes*',
            subtitulo: 'Captura, responde y cierra clientes con IA en un único panel. Únete a la lista y consigue 3 meses gratis.',
            boton: 'Unirme a la lista', prueba: '1.847 personas ya en la lista', visual: 'panel', centro: true,
          })]),
          sec({ fondo: '#070b18', relleno: 'pequeno' }, [logos('Respaldado por', ['Kairos Ventures', 'Atlas', 'Seedcamp', 'Nórdika'])]),
          sec({ fondo: '#070b18' }, [ventajas('Por qué te va a encantar', '', [['ia', 'IA de verdad', 'Responde, agenda y hace seguimiento por ti.'], ['rayo', 'En 10 minutos', 'Conecta WhatsApp y tu web sin técnicos.'], ['candado', 'Privado y seguro', 'Tus datos en Europa, cifrados.']])]),
          sec({ fondo: '#070b18', tipo: 'malla', ancho: 'estrecho', ancla: 'formulario' }, [titulo('Reserva tu acceso'), form('Avisadme', ['lista-espera'], campos(['email', 'Correo electrónico', 'email', true]), 'mensaje', '¡Dentro! Te avisaremos el primero.')]),
        ]) },
      ];
    },
  },
  {
    id: 'negocio-local', nombre: 'Negocio local (restaurante, peluquería…)', categoria: 'Servicios', color: '#dc6803',
    descripcion: 'Presentación cálida del negocio, servicios, opiniones y reserva o contacto.',
    pasos: () => {
      const C = '#dc6803'; const A = '#e31b54';
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fuente: 'editorial', radio: 'redondo' }, [
          sec({ fondo: '#fff8f1', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Abierto hoy · 13:00 – 23:30', titulo: 'Cocina de mercado con *alma mediterránea*',
            subtitulo: 'Producto de temporada, recetas de siempre y una terraza que querrás repetir. Reserva tu mesa en 30 segundos.',
            boton: 'Reservar mesa', url: '#reservar', boton2: 'Ver la carta', url2: '#carta', prueba: '4,8 en Google · TheFork Awards', visual: 'tarjetas',
          })]),
          sec({ fondo: '#ffffff', ancla: 'carta' }, [ventajas('Nuestra propuesta', '', [['hoja', 'De temporada', 'Carta que cambia con el mercado cada semana.'], ['corazon', 'Hecho en casa', 'Pan, postres y fondos elaborados aquí.'], ['sol', 'Terraza', 'La mejor terraza del barrio, todo el año.'], ['regalo', 'Eventos', 'Cumpleaños y empresa con menús cerrados.']], 4, 'simple')]),
          sec({ fondo: '#fff8f1' }, [opiniones('Lo que dicen', [['El arroz del domingo es otro nivel. Volvemos cada mes.', 'Pablo y Sara', 'Google'], ['Servicio de diez y precios muy razonables.', 'Marta L.', 'TheFork'], ['La terraza en verano es un lujo.', 'Iván R.', 'Google']])]),
          sec({ fondo: '#ffffff', ancho: 'estrecho', ancla: 'reservar' }, [titulo('Reserva tu mesa'), texto('Te confirmamos por WhatsApp en minutos.'),
            form('Pedir reserva', ['reserva'], campos(['nombre', 'Nombre', 'texto', true], ['telefono', 'Teléfono', 'tel', true], ['mensaje', 'Día, hora y número de personas', 'textarea', true]), 'mensaje', '¡Gracias! Te confirmamos por WhatsApp en breve.')]),
        ]) },
      ];
    },
  },
  {
    id: 'saas-ia', nombre: 'Software / asistente con IA', categoria: 'Tecnología', color: '#444ce7',
    descripcion: 'Landing de producto tecnológico: chat en portada, ventajas, cifras, planes y preguntas.',
    pasos: () => {
      const C = '#444ce7'; const A = '#9e77ed';
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Nuevo · Asistente de WhatsApp con IA', titulo: 'Atiende a cada cliente al momento, *24/7*',
            subtitulo: 'Un asistente que conoce tu negocio, responde por WhatsApp y web, agenda citas y te pasa solo lo importante.',
            boton: 'Probar 14 días gratis', accion: 'siguiente', url: '', boton2: 'Ver demo', url2: '#demo', prueba: 'Sin tarjeta · Listo en 10 minutos', visual: 'chat',
          })]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [logos('Usado por equipos de', ['Lumen', 'Kairos', 'Verdia', 'Atlas', 'Nórdika'])]),
          sec({ fondo: '#f8fafc', ancla: 'demo' }, [bloqueIT({ etiqueta: 'Todo en un panel', titulo: 'Conversaciones, citas y ventas, de un vistazo', texto: 'Cada mensaje queda en la ficha del cliente. Tu equipo entra solo cuando hace falta.', puntos: ['Bandeja unificada: WhatsApp, SMS, correo y web', 'Traspaso a una persona con un clic', 'Informes de conversión por canal'], visual: 'panel' })]),
          sec({ fondo: '#ffffff' }, [ventajas('Hecho para negocios de verdad', '', [['ia', 'Aprende de ti', 'Sube tus precios, horarios y preguntas frecuentes.'], ['calendario', 'Agenda solo', 'Conectado a tu calendario, sin dobles reservas.'], ['usuarios', 'Trabajo en equipo', 'Asigna conversaciones y deja notas internas.'], ['grafico', 'Mide todo', 'Cuántos contactos, citas y ventas genera.'], ['candado', 'RGPD', 'Datos en la UE y control total.'], ['rayo', 'Integraciones', 'Calendarios, pagos, webhooks y API.']])]),
          sec({ fondo: '#0b1220' }, [cifras([['< 5 s', 'tiempo de respuesta'], ['+38 %', 'más citas'], ['24/7', 'disponibilidad'], ['10 min', 'para empezar']])]),
          sec({ fondo: '#ffffff' }, [planes('Precios claros', 'Cancela cuando quieras.', [
            { nombre: 'Inicio', precio: '39 €', periodo: '/mes', descripcion: 'Para autónomos', caracteristicas: ['1 asistente', '500 conversaciones', 'Web y WhatsApp'], boton: 'Empezar' },
            { nombre: 'Crecimiento', precio: '99 €', periodo: '/mes', descripcion: 'El favorito', caracteristicas: ['3 asistentes', '3.000 conversaciones', 'Citas y automatizaciones', 'Informes'], boton: 'Probar gratis', destacado: true },
            { nombre: 'Equipos', precio: '249 €', periodo: '/mes', descripcion: 'Para empresas', caracteristicas: ['Asistentes ilimitados', 'Conversaciones ilimitadas', 'API y soporte prioritario'], boton: 'Hablar con ventas' },
          ])]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [faq('Preguntas frecuentes', [['¿Necesito saber programar?', 'No. Lo configuras en minutos desde el panel.'], ['¿Y si la IA no sabe algo?', 'Lo reconoce y pasa la conversación a tu equipo.'], ['¿Puedo cancelar?', 'Cuando quieras, sin permanencia.']])]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [llamada('Empieza hoy, gratis', '14 días de prueba. Sin tarjeta.', 'Crear mi asistente', 'siguiente', '')]),
        ]) },
        { nombre: 'Alta', ruta: 'alta', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'grande', ancho: 'estrecho' }, [titulo('Crea tu cuenta gratis', 1), texto('En 2 minutos tienes tu asistente funcionando.'),
            form('Crear mi cuenta', ['prueba-gratis'], campos(['nombre', 'Nombre', 'texto', true], ['email', 'Correo de trabajo', 'email', true], ['empresa', 'Empresa', 'texto', true]), 'mensaje', '¡Listo! Te hemos enviado el acceso por correo.')]),
        ]) },
      ];
    },
  },
  {
    id: 'coach', nombre: 'Coach / consultoría personal', categoria: 'Servicios', color: '#7f56d9',
    descripcion: 'Marca personal elegante: historia, método, testimonios y sesión de descubrimiento.',
    pasos: () => {
      const C = '#7f56d9'; const A = '#ee46bc';
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fuente: 'elegante', radio: 'redondo', fondo: '#fcfaff' }, [
          sec({ fondo: '#fcfaff', tipo: 'malla', relleno: 'grande' }, [hero({
            etiqueta: 'Coach de negocio para mujeres emprendedoras', titulo: 'Construye un negocio que *te dé vida*, no que te la quite',
            subtitulo: 'Te acompaño a ordenar tu oferta, subir precios con seguridad y trabajar menos horas ganando más.',
            boton: 'Reservar sesión gratuita', boton2: 'Conocer el método', url2: '#metodo', prueba: '+180 clientas acompañadas', visual: 'tarjetas',
          })]),
          sec({ fondo: '#ffffff', ancla: 'metodo' }, [pasos('El método en 3 fases', [['Claridad', 'Definimos tu cliente ideal, tu oferta y tu precio.'], ['Sistema', 'Montamos captación y ventas que no dependan de ti.'], ['Libertad', 'Delegas, automatizas y recuperas tu tiempo.']])]),
          sec({ fondo: '#f9f5ff' }, [bloqueIT({ etiqueta: 'Sobre mí', titulo: 'Hola, soy Clara', texto: 'Pasé de trabajar 60 horas semanales a 25, facturando el doble. Hoy ayudo a otras emprendedoras a hacer lo mismo, sin fórmulas mágicas.', puntos: ['Certificada ICF', '10 años en consultoría', 'Mentora en Lanzadera'], visual: 'chat', invertir: true })]),
          sec({ fondo: '#ffffff' }, [opiniones('Historias reales', [['Subí mis precios un 40 % y no perdí ni una clienta.', 'Lucía G.', 'Nutricionista'], ['Por fin tengo un negocio y no un autoempleo agotador.', 'Ana P.', 'Diseñadora'], ['Clara te ordena la cabeza y el negocio.', 'Sonia R.', 'Fisioterapeuta']])]),
          sec({ fondo: '#fcfaff', tipo: 'malla', ancho: 'estrecho', ancla: 'formulario' }, [titulo('Reserva tu sesión de descubrimiento'), texto('45 minutos, gratis y sin compromiso.'), form('Quiero mi sesión', ['sesion-descubrimiento'], campos(['nombre', 'Nombre', 'texto', true], ['email', 'Correo', 'email', true], ['mensaje', '¿Qué te gustaría conseguir?', 'textarea', false]))]),
        ]) },
        { nombre: 'Gracias', ruta: 'gracias', contenido: gracias(C, A, 'elegante', 'Qué ilusión, ¡*hablamos pronto*!', 'Te escribo hoy mismo para cerrar día y hora.', [['Revisa tu correo', 'Te llega un pequeño cuestionario.'], ['Elegimos fecha', 'La que mejor te venga.'], ['Sesión', '45 minutos para trazar tu plan.']]) },
      ];
    },
  },
];

export const PAGINA_EN_BLANCO = (): Contenido => pagina({ color: '#155eef', acento: '#7a5af8' }, [
  sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'grande' }, [hero({ titulo: 'Tu titular *aquí*', subtitulo: 'Haz clic en cualquier bloque para editarlo, o añade secciones desde el panel de la izquierda.', boton: 'Empezar', accion: 'siguiente', visual: 'tarjetas' })]),
  sec({ fondo: '#ffffff' }, [espacio(8)]),
]);
