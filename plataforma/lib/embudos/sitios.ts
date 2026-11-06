import { b, bloqueIT, campos, cifras, faq, form, hero, llamada, logos, opiniones, pagina, pasos, planes, sec, texto, titulo, ventajas } from './plantillas.ts';
import type { Bloque, Contenido } from './tipos.ts';

// Sitios web: varias páginas con menú, pie de página y datos del negocio.

export interface ConfigSitio {
  marca: string; logo: string; menu_cta_texto: string; menu_cta_ruta: string;
  descripcion: string; telefono: string; email: string; direccion: string; horario: string;
  redes: { instagram: string; facebook: string; linkedin: string; tiktok: string; youtube: string; x: string };
}
export const CONFIG_VACIA: ConfigSitio = {
  marca: '', logo: '', menu_cta_texto: 'Contactar', menu_cta_ruta: 'contacto', descripcion: '', telefono: '', email: '', direccion: '', horario: '',
  redes: { instagram: '', facebook: '', linkedin: '', tiktok: '', youtube: '', x: '' },
};

export interface PlantillaSitio {
  id: string; nombre: string; descripcion: string; categoria: string; color: string; config: Partial<ConfigSitio>;
  paginas: () => { nombre: string; ruta: string; contenido: Contenido }[];
}

// Página de contacto común: datos + formulario (+ calendario opcional).
const contacto = (o: { color: string; acento: string; fuente?: Contenido['estilo']['fuente']; radio?: 'recto' | 'suave' | 'redondo'; titulo: string; texto: string; calendario?: boolean; etiqueta: string; datos: [string, string, string][] }) =>
  pagina({ color: o.color, acento: o.acento, fuente: o.fuente, radio: o.radio }, [
    sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'normal', ancho: 'normal' }, [titulo(o.titulo, 1), texto(o.texto, 'grande')]),
    sec({ fondo: '#ffffff', relleno: 'pequeno' }, [ventajas('', '', o.datos, 3, 'tarjetas')]),
    ...(o.calendario ? [sec({ fondo: '#f8fafc', ancho: 'ancho', ancla: 'reservar' }, [titulo('Reserva online'), b({ tipo: 'calendario', slug: '', alto: 760 }) as Bloque])] : []),
    sec({ fondo: o.calendario ? '#ffffff' : '#f8fafc', ancho: 'estrecho', ancla: 'formulario' }, [titulo('Escríbenos'), texto('Te respondemos en menos de 24 horas laborables.'),
      form('Enviar mensaje', [o.etiqueta], campos(['nombre', 'Nombre', 'texto', true], ['email', 'Correo electrónico', 'email', true], ['telefono', 'Teléfono', 'tel', false], ['mensaje', '¿En qué podemos ayudarte?', 'textarea', true]), 'mensaje', '¡Gracias! Te respondemos muy pronto.')]),
  ]);

export const PLANTILLAS_SITIO: PlantillaSitio[] = [
  {
    id: 'agencia', nombre: 'Agencia digital', categoria: 'Servicios profesionales', color: '#155eef',
    descripcion: 'Web corporativa de 5 páginas: inicio, servicios, casos de éxito, precios y contacto.',
    config: { marca: 'Nova Studio', menu_cta_texto: 'Pide presupuesto', menu_cta_ruta: 'contacto', descripcion: 'Agencia de marketing y crecimiento para negocios que quieren más clientes.', telefono: '+34 910 000 000', email: 'hola@novastudio.es', direccion: 'Madrid · Remoto en toda España' },
    paginas: () => {
      const C = '#155eef'; const A = '#7a5af8';
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#ffffff', tipo: 'malla', relleno: 'grande' }, [hero({ etiqueta: 'Agencia de crecimiento', titulo: 'Hacemos crecer negocios con *marketing que se mide*', subtitulo: 'Estrategia, webs, anuncios y automatización con un único equipo y un único objetivo: que vendas más.', boton: 'Pide presupuesto', accion: 'pagina', url: 'contacto', boton2: 'Ver casos', accion2: 'pagina', url2: 'casos', prueba: '+120 marcas confían en nosotros', visual: 'panel' })]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [logos('Han trabajado con nosotros', ['Nórdika', 'Lumen', 'Atlas', 'Verdia', 'Kairos'])]),
          sec({ fondo: '#f8fafc' }, [ventajas('Qué hacemos', 'Servicios que se conectan entre sí.', [['objetivo', 'Estrategia', 'Plan de crecimiento con objetivos y números.'], ['globo', 'Webs y landings', 'Rápidas, bonitas y pensadas para convertir.'], ['grafico', 'Publicidad', 'Meta, Google y TikTok Ads optimizados a diario.'], ['rayo', 'Automatización', 'CRM, WhatsApp y seguimiento automático.']], 4)]),
          sec({ fondo: '#0b1220' }, [cifras([['+120', 'clientes'], ['3,4x', 'retorno medio'], ['8 años', 'de experiencia'], ['96 %', 'renuevan']])]),
          sec({ fondo: '#ffffff' }, [opiniones('Clientes que hablan por nosotros', [['Triplicamos los leads en un trimestre, con el mismo presupuesto.', 'Sergio L.', 'CEO, Atlas'], ['Un equipo que entiende de negocio, no solo de diseño.', 'Paula V.', 'Directora, Lumen'], ['La web nueva convierte el doble que la anterior.', 'Iker M.', 'Fundador, Verdia']])]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [llamada('¿Hablamos de tu proyecto?', 'Primera consultoría gratuita de 30 minutos.', 'Pedir presupuesto', 'pagina', 'contacto')]),
        ]) },
        { nombre: 'Servicios', ruta: 'servicios', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#ffffff', tipo: 'malla', ancho: 'normal' }, [titulo('Servicios', 1), texto('Elige uno o combínalos. Siempre con objetivos claros y medibles.', 'grande')]),
          sec({ fondo: '#ffffff' }, [bloqueIT({ etiqueta: 'Webs y landings', titulo: 'Tu mejor comercial, abierto 24/7', texto: 'Diseñamos webs que cargan rápido, se ven perfectas en el móvil y guían al visitante hasta el contacto.', puntos: ['Diseño a medida', 'SEO técnico desde el día 1', 'Formularios conectados al CRM'], visual: 'panel', boton: 'Quiero una web', accion: 'pagina', url: 'contacto' })]),
          sec({ fondo: '#f8fafc' }, [bloqueIT({ etiqueta: 'Publicidad', titulo: 'Anuncios que traen clientes, no clics', texto: 'Campañas segmentadas por zona e intención, con creatividades que probamos cada semana.', puntos: ['Meta, Google y TikTok', 'Informe semanal', 'Optimización continua'], visual: 'tarjetas', invertir: true })]),
          sec({ fondo: '#ffffff' }, [bloqueIT({ etiqueta: 'Automatización', titulo: 'Que ningún contacto se quede sin respuesta', texto: 'Conectamos tu web, WhatsApp y calendario para responder al momento y hacer seguimiento solo.', puntos: ['Asistente con IA', 'Recordatorios de citas', 'Seguimiento automático'], visual: 'chat' })]),
        ]) },
        { nombre: 'Casos de éxito', ruta: 'casos', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#ffffff', tipo: 'malla', ancho: 'normal' }, [titulo('Casos de *éxito*', 1), texto('Resultados reales de clientes reales.', 'grande')]),
          sec({ fondo: '#ffffff' }, [ventajas('', '', [['trofeo', 'Clínica Alba · +312 % citas', 'Web nueva, anuncios locales y recordatorios automáticos.'], ['cohete', 'Atlas Fit · 3,1x ROAS', 'Captación de socios con campañas de vídeo corto.'], ['grafico', 'Verdia · -48 % coste por lead', 'Landing optimizada y seguimiento por WhatsApp.']])]),
          sec({ fondo: '#0b1220' }, [cifras([['+312 %', 'citas'], ['3,1x', 'retorno'], ['-48 %', 'coste por lead']])]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [llamada('¿Quieres ser el próximo?', 'Cuéntanos tu objetivo.', 'Contactar', 'pagina', 'contacto')]),
        ]) },
        { nombre: 'Precios', ruta: 'precios', contenido: pagina({ color: C, acento: A }, [
          sec({ fondo: '#ffffff', tipo: 'malla' }, [planes('Planes claros', 'Sin permanencia. Todo incluido.', [
            { nombre: 'Despegue', precio: '490 €', periodo: '/mes', descripcion: 'Para empezar', caracteristicas: ['Landing optimizada', '1 canal de anuncios', 'Informe mensual'], boton: 'Empezar' },
            { nombre: 'Crecimiento', precio: '990 €', periodo: '/mes', descripcion: 'El más elegido', caracteristicas: ['Web completa', '2 canales de anuncios', 'Automatización y CRM', 'Informe semanal'], boton: 'Elegir', destacado: true },
            { nombre: 'Escala', precio: 'A medida', descripcion: 'Para equipos', caracteristicas: ['Todo lo anterior', 'Equipo dedicado', 'Estrategia trimestral'], boton: 'Hablar' },
          ], 'pagina', 'contacto')]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [faq('Preguntas frecuentes', [['¿El presupuesto de anuncios está incluido?', 'No, se paga aparte directamente a cada plataforma. Te ayudamos a definirlo.'], ['¿Hay permanencia?', 'No. Mes a mes.'], ['¿En cuánto tiempo arrancamos?', 'En 10 días laborables desde el primer pago.']])]),
        ]) },
        { nombre: 'Contacto', ruta: 'contacto', contenido: contacto({ color: C, acento: A, titulo: 'Hablemos', texto: 'Cuéntanos qué necesitas y te respondemos con una propuesta.', etiqueta: 'web-contacto', datos: [['telefono', 'Teléfono', '+34 910 000 000'], ['correo', 'Correo', 'hola@novastudio.es'], ['ubicacion', 'Dónde', 'Madrid · Remoto en toda España']] }) },
      ];
    },
  },
  {
    id: 'clinica', nombre: 'Clínica / centro de salud', categoria: 'Salud y bienestar', color: '#0e9384',
    descripcion: 'Inicio, tratamientos, equipo y contacto con reserva online integrada.',
    config: { marca: 'Clínica Sonrisa', menu_cta_texto: 'Pedir cita', menu_cta_ruta: 'contacto', descripcion: 'Clínica dental en el centro. Primera valoración gratuita.', telefono: '+34 910 111 222', email: 'citas@clinicasonrisa.es', direccion: 'Calle Mayor 12, Madrid', horario: 'L-V 9:00–20:00 · S 10:00–14:00' },
    paginas: () => {
      const C = '#0e9384'; const A = '#2e90fa'; const F = 'elegante' as const; const R = 'redondo' as const;
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fuente: F, radio: R }, [
          sec({ fondo: '#f0fdf9', tipo: 'malla', relleno: 'grande' }, [hero({ etiqueta: 'Primera visita gratuita', titulo: 'Cuidamos tu sonrisa con *calma y tecnología*', subtitulo: 'Especialistas en estética dental, implantes y ortodoncia invisible, en pleno centro y con cita en 48 horas.', boton: 'Pedir cita', accion: 'pagina', url: 'contacto', boton2: 'Tratamientos', accion2: 'pagina', url2: 'tratamientos', prueba: '4,9 en Google · +850 reseñas', visual: 'movil' })]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [cifras([['15', 'años de experiencia'], ['+12.000', 'pacientes'], ['48 h', 'para tu cita'], ['24 meses', 'de financiación']])]),
          sec({ fondo: '#ffffff' }, [ventajas('Por qué elegirnos', '', [['corazon', 'Trato cercano', 'Te explicamos todo, sin prisas ni sorpresas.'], ['escudo', 'Garantía', 'Tratamientos con garantía por escrito.'], ['tarjeta', 'Financiación', 'Hasta 24 meses sin intereses.']])]),
          sec({ fondo: '#f8fafc' }, [opiniones('Lo que dicen nuestros pacientes', [['Profesionales y muy humanos. Me quitaron el miedo al dentista.', 'Elena S.', 'Paciente'], ['El resultado de las carillas es natural, ¡nadie lo nota!', 'Raúl P.', 'Paciente'], ['Puntuales y con un trato exquisito.', 'Nuria M.', 'Paciente']])]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [llamada('Tu primera valoración es gratis', 'Reserva online en menos de un minuto.', 'Pedir cita', 'pagina', 'contacto')]),
        ]) },
        { nombre: 'Tratamientos', ruta: 'tratamientos', contenido: pagina({ color: C, acento: A, fuente: F, radio: R }, [
          sec({ fondo: '#f0fdf9', tipo: 'malla', ancho: 'normal' }, [titulo('Tratamientos', 1), texto('Todo lo que necesitas en un solo lugar, con presupuesto cerrado.', 'grande')]),
          sec({ fondo: '#ffffff' }, [ventajas('', '', [['estrella', 'Estética dental', 'Blanqueamiento y carillas con resultados naturales.'], ['escudo', 'Implantes', 'Recupera piezas con implantes de primera calidad.'], ['sol', 'Ortodoncia invisible', 'Alineadores transparentes, cómodos y discretos.'], ['corazon', 'Odontopediatría', 'Atención especial para los más pequeños.'], ['herramienta', 'Endodoncia', 'Salvamos tus dientes con técnicas mínimamente invasivas.'], ['check', 'Higiene y revisión', 'Prevención para evitar problemas futuros.']])]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [faq('Dudas frecuentes', [['¿Duele un implante?', 'Se realiza con anestesia local y la recuperación es rápida.'], ['¿Cuánto dura la ortodoncia invisible?', 'Entre 6 y 18 meses según el caso.']])]),
        ]) },
        { nombre: 'Equipo', ruta: 'equipo', contenido: pagina({ color: C, acento: A, fuente: F, radio: R }, [
          sec({ fondo: '#ffffff', tipo: 'malla', ancho: 'normal' }, [titulo('Nuestro *equipo*', 1), texto('Especialistas en cada área, coordinados para darte el mejor resultado.', 'grande')]),
          sec({ fondo: '#ffffff' }, [bloqueIT({ etiqueta: 'Dirección médica', titulo: 'Dra. Laura Martín', texto: 'Odontóloga especialista en estética dental, con más de 15 años de experiencia y formación en Nueva York.', puntos: ['Máster en Estética Dental', 'Miembro de SEPES'], visual: 'tarjetas' })]),
          sec({ fondo: '#f8fafc' }, [ventajas('Especialistas', '', [['usuario', 'Dr. Pablo Ruiz', 'Implantología y cirugía.'], ['usuario', 'Dra. Ana Gil', 'Ortodoncia invisible.'], ['usuario', 'Dra. Sara León', 'Odontopediatría.']])]),
        ]) },
        { nombre: 'Contacto', ruta: 'contacto', contenido: contacto({ color: C, acento: A, fuente: F, radio: R, titulo: 'Pide tu cita', texto: 'Online, por teléfono o por WhatsApp. Como prefieras.', calendario: true, etiqueta: 'web-cita', datos: [['telefono', 'Teléfono', '+34 910 111 222'], ['ubicacion', 'Dirección', 'Calle Mayor 12, Madrid'], ['reloj', 'Horario', 'L-V 9:00–20:00 · S 10:00–14:00']] }) },
      ];
    },
  },
  {
    id: 'restaurante', nombre: 'Restaurante / cafetería', categoria: 'Hostelería', color: '#dc6803',
    descripcion: 'Inicio, carta y reservas, con estilo cálido y editorial.',
    config: { marca: 'Casa Olivo', menu_cta_texto: 'Reservar', menu_cta_ruta: 'reservas', descripcion: 'Cocina mediterránea de mercado desde 2009.', telefono: '+34 910 222 333', email: 'reservas@casaolivo.es', direccion: 'Plaza del Sol 4, Valencia', horario: 'Mar-Dom 13:00–16:00 · 20:00–23:30' },
    paginas: () => {
      const C = '#dc6803'; const A = '#e31b54'; const F = 'editorial' as const; const R = 'redondo' as const;
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fuente: F, radio: R }, [
          sec({ fondo: '#fff8f1', tipo: 'malla', relleno: 'grande' }, [hero({ etiqueta: 'Desde 2009 · Valencia', titulo: 'Cocina de mercado con *alma mediterránea*', subtitulo: 'Arroces, producto de temporada y una terraza para alargar la sobremesa.', boton: 'Reservar mesa', accion: 'pagina', url: 'reservas', boton2: 'Ver la carta', accion2: 'pagina', url2: 'carta', prueba: '4,8 en Google · Guía Repsol', visual: 'tarjetas' })]),
          sec({ fondo: '#ffffff' }, [ventajas('La casa', '', [['hoja', 'Producto local', 'Trabajamos con huertas y lonjas de la zona.'], ['corazon', 'Hecho aquí', 'Pan, postres y fondos de elaboración propia.'], ['sol', 'Terraza', 'Climatizada y abierta todo el año.']], 3, 'simple')]),
          sec({ fondo: '#fff8f1' }, [opiniones('Nos dicen', [['El mejor arroz de la ciudad, sin discusión.', 'Pablo y Sara', 'Google'], ['Servicio impecable y precios honestos.', 'Marta L.', 'TheFork'], ['La terraza en primavera es un lujo.', 'Iván R.', 'Google']])]),
          sec({ fondo: '#ffffff', relleno: 'pequeno' }, [llamada('¿Te guardamos mesa?', 'Reserva en 30 segundos.', 'Reservar', 'pagina', 'reservas')]),
        ]) },
        { nombre: 'Carta', ruta: 'carta', contenido: pagina({ color: C, acento: A, fuente: F, radio: R }, [
          sec({ fondo: '#fff8f1', tipo: 'malla', ancho: 'normal' }, [titulo('La *carta*', 1), texto('Cambia con la temporada. Pregunta por las sugerencias del día.', 'grande')]),
          sec({ fondo: '#ffffff' }, [planes('Para empezar · Principales · Postres', '', [
            { nombre: 'Para empezar', precio: '8–14 €', caracteristicas: ['Croquetas de jamón ibérico', 'Tomate de huerta con ventresca', 'Esgarraet con bacalao'], boton: 'Reservar' },
            { nombre: 'Arroces y principales', precio: '16–26 €', caracteristicas: ['Paella valenciana (mín. 2)', 'Arroz negro con sepia', 'Pescado de lonja del día'], boton: 'Reservar', destacado: true },
            { nombre: 'Postres', precio: '6–8 €', caracteristicas: ['Tarta de queso al horno', 'Flan de la abuela', 'Helado artesano'], boton: 'Reservar' },
          ], 'pagina', 'reservas')]),
          sec({ fondo: '#ffffff', ancho: 'normal' }, [faq('Alergias e intolerancias', [['¿Tenéis opciones sin gluten?', 'Sí. Avísanos al reservar y adaptamos los platos.'], ['¿Y veganas?', 'Siempre hay varias opciones en la carta.']])]),
        ]) },
        { nombre: 'Reservas', ruta: 'reservas', contenido: contacto({ color: C, acento: A, fuente: F, radio: R, titulo: 'Reserva tu mesa', texto: 'Te confirmamos por WhatsApp en minutos.', etiqueta: 'web-reserva', datos: [['telefono', 'Teléfono', '+34 910 222 333'], ['ubicacion', 'Dirección', 'Plaza del Sol 4, Valencia'], ['reloj', 'Horario', 'Mar-Dom 13–16 h · 20–23:30 h']] }) },
      ];
    },
  },
  {
    id: 'despacho', nombre: 'Despacho / asesoría', categoria: 'Servicios profesionales', color: '#1d2939',
    descripcion: 'Abogados, gestorías y consultoras: sobrio, elegante y orientado a la consulta.',
    config: { marca: 'Vidal & Asociados', menu_cta_texto: 'Consulta gratuita', menu_cta_ruta: 'contacto', descripcion: 'Asesoría fiscal, laboral y jurídica para empresas y autónomos.', telefono: '+34 910 333 444', email: 'despacho@vidalasociados.es', direccion: 'Paseo de Gracia 50, Barcelona' },
    paginas: () => {
      const C = '#1d2939'; const A = '#b54708'; const F = 'elegante' as const; const R = 'recto' as const;
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fuente: F, radio: R, fondo: '#fcfcfd' }, [
          sec({ fondo: '#0f1728', tipo: 'malla', relleno: 'grande' }, [hero({ etiqueta: 'Más de 25 años asesorando', titulo: 'Tranquilidad legal y fiscal para *tu empresa*', subtitulo: 'Un equipo multidisciplinar que se encarga de todo para que tú te centres en tu negocio.', boton: 'Consulta gratuita', accion: 'pagina', url: 'contacto', boton2: 'Áreas de práctica', accion2: 'pagina', url2: 'areas', prueba: '+900 empresas asesoradas', visual: 'tarjetas' })]),
          sec({ fondo: '#ffffff' }, [ventajas('Áreas de práctica', '', [['libro', 'Fiscal', 'Impuestos, planificación y requerimientos.'], ['usuarios', 'Laboral', 'Nóminas, contratos y despidos.'], ['escudo', 'Jurídico', 'Mercantil, contratos y reclamaciones.']], 3)]),
          sec({ fondo: '#f9fafb' }, [cifras([['25', 'años'], ['+900', 'empresas'], ['12', 'especialistas']])]),
          sec({ fondo: '#ffffff' }, [opiniones('Confían en nosotros', [['Nos ahorraron una inspección complicada. Rigor absoluto.', 'Jordi P.', 'Gerente, Textil Puig'], ['Responden rápido y hablan claro.', 'Ana C.', 'Autónoma'], ['Llevamos 10 años con ellos. Ni una incidencia.', 'Marc V.', 'CEO, Logística V']])]),
        ]) },
        { nombre: 'Áreas', ruta: 'areas', contenido: pagina({ color: C, acento: A, fuente: F, radio: R }, [
          sec({ fondo: '#ffffff', tipo: 'malla', ancho: 'normal' }, [titulo('Áreas de práctica', 1), texto('Soluciones a medida para cada etapa de tu empresa.', 'grande')]),
          sec({ fondo: '#ffffff' }, [bloqueIT({ etiqueta: 'Fiscal', titulo: 'Paga lo justo, sin sustos', texto: 'Planificación fiscal, declaraciones y defensa ante la Agencia Tributaria.', puntos: ['Impuesto de sociedades e IVA', 'Planificación patrimonial', 'Inspecciones'], visual: 'panel' })]),
          sec({ fondo: '#f9fafb' }, [bloqueIT({ etiqueta: 'Laboral', titulo: 'Tu equipo, en regla', texto: 'Gestionamos nóminas, contratos, altas y bajas y te asesoramos en conflictos.', puntos: ['Nóminas y seguros sociales', 'Contratación', 'Despidos y ERTE'], visual: 'tarjetas', invertir: true })]),
        ]) },
        { nombre: 'Contacto', ruta: 'contacto', contenido: contacto({ color: C, acento: A, fuente: F, radio: R, titulo: 'Consulta gratuita', texto: 'Primera reunión de 30 minutos sin coste.', calendario: true, etiqueta: 'web-consulta', datos: [['telefono', 'Teléfono', '+34 910 333 444'], ['correo', 'Correo', 'despacho@vidalasociados.es'], ['ubicacion', 'Oficina', 'Paseo de Gracia 50, Barcelona']] }) },
      ];
    },
  },
  {
    id: 'gimnasio', nombre: 'Gimnasio / entrenador', categoria: 'Deporte', color: '#e31b54',
    descripcion: 'Enérgico y oscuro: clases, tarifas y prueba gratuita.',
    config: { marca: 'Pulso Fit', menu_cta_texto: 'Prueba gratis', menu_cta_ruta: 'contacto', descripcion: 'Entrenamiento funcional y clases dirigidas en grupos reducidos.', telefono: '+34 910 444 555', email: 'hola@pulsofit.es', direccion: 'Av. del Puerto 20, Málaga', horario: 'L-V 7:00–22:00 · S 9:00–14:00' },
    paginas: () => {
      const C = '#e31b54'; const A = '#f79009';
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fondo: '#0a0a0f' }, [
          sec({ fondo: '#0a0a0f', tipo: 'malla', relleno: 'grande' }, [hero({ etiqueta: 'Primera semana gratis', titulo: 'Entrena con *propósito*. Resultados que se notan.', subtitulo: 'Clases funcionales en grupos de máximo 10 personas, con entrenadores que te corrigen de verdad.', boton: 'Probar gratis', accion: 'pagina', url: 'contacto', boton2: 'Ver tarifas', accion2: 'pagina', url2: 'tarifas', prueba: '+600 socios activos', visual: 'tarjetas' })]),
          sec({ fondo: '#0a0a0f' }, [ventajas('Clases', '', [['rayo', 'HIIT', 'Alta intensidad en 45 minutos.'], ['trofeo', 'Fuerza', 'Técnica y progresión con barra.'], ['corazon', 'Movilidad', 'Recupera y previene lesiones.'], ['usuarios', 'Grupos reducidos', 'Máximo 10 personas por clase.']], 4)]),
          sec({ fondo: '#111118' }, [cifras([['10', 'personas por clase'], ['+40', 'clases semanales'], ['6', 'entrenadores']])]),
          sec({ fondo: '#0a0a0f', relleno: 'pequeno' }, [llamada('Tu primera semana corre de nuestra cuenta', 'Sin matrícula ni permanencia.', 'Quiero probar', 'pagina', 'contacto')]),
        ]) },
        { nombre: 'Tarifas', ruta: 'tarifas', contenido: pagina({ color: C, acento: A, fondo: '#0a0a0f' }, [
          sec({ fondo: '#0a0a0f', tipo: 'malla' }, [planes('Tarifas', 'Sin matrícula. Cancela cuando quieras.', [
            { nombre: '2 días', precio: '39 €', periodo: '/mes', caracteristicas: ['8 clases al mes', 'App de reservas'], boton: 'Empezar' },
            { nombre: 'Ilimitado', precio: '59 €', periodo: '/mes', caracteristicas: ['Clases ilimitadas', 'Plan nutricional', 'Seguimiento mensual'], boton: 'Elegir', destacado: true },
            { nombre: 'Personal', precio: '35 €', periodo: '/sesión', caracteristicas: ['Entrenador 1 a 1', 'Plan a medida'], boton: 'Reservar' },
          ], 'pagina', 'contacto')]),
        ]) },
        { nombre: 'Contacto', ruta: 'contacto', contenido: contacto({ color: C, acento: A, titulo: 'Reserva tu prueba gratis', texto: 'Elige día y hora o escríbenos.', calendario: true, etiqueta: 'web-prueba', datos: [['telefono', 'Teléfono', '+34 910 444 555'], ['ubicacion', 'Dónde', 'Av. del Puerto 20, Málaga'], ['reloj', 'Horario', 'L-V 7–22 h · S 9–14 h']] }) },
      ];
    },
  },
  {
    id: 'inmobiliaria', nombre: 'Inmobiliaria', categoria: 'Inmobiliario', color: '#155b75',
    descripcion: 'Captación de propietarios y compradores con valoración gratuita.',
    config: { marca: 'Hogar Prime', menu_cta_texto: 'Valora tu casa', menu_cta_ruta: 'contacto', descripcion: 'Vendemos tu vivienda al mejor precio y en menos tiempo.', telefono: '+34 910 555 666', email: 'info@hogarprime.es', direccion: 'Calle Serrano 80, Madrid' },
    paginas: () => {
      const C = '#155b75'; const A = '#15b79e'; const F = 'geometrica' as const;
      return [
        { nombre: 'Inicio', ruta: 'inicio', contenido: pagina({ color: C, acento: A, fuente: F }, [
          sec({ fondo: '#f0f9ff', tipo: 'malla', relleno: 'grande' }, [hero({ etiqueta: 'Valoración gratuita en 24 h', titulo: 'Vende tu casa *más rápido* y al mejor precio', subtitulo: 'Fotografía profesional, difusión en los principales portales y compradores ya filtrados.', boton: 'Valorar mi vivienda', accion: 'pagina', url: 'contacto', boton2: 'Cómo trabajamos', accion2: 'pagina', url2: 'servicios', prueba: 'Vendemos en 47 días de media', visual: 'panel' })]),
          sec({ fondo: '#ffffff' }, [pasos('Cómo vendemos tu casa', [['Valoración', 'Precio real de mercado en 24 horas.'], ['Puesta en escena', 'Fotos, vídeo y plano profesionales.'], ['Difusión', 'Portales, redes y cartera de compradores.'], ['Firma', 'Te acompañamos hasta la notaría.']])]),
          sec({ fondo: '#0b1220' }, [cifras([['47', 'días de media'], ['98 %', 'del precio pedido'], ['+1.300', 'viviendas vendidas']])]),
          sec({ fondo: '#ffffff' }, [opiniones('Propietarios satisfechos', [['Vendieron en tres semanas y por encima de lo esperado.', 'Carmen R.', 'Chamberí'], ['Profesionales en todo momento. Muy recomendables.', 'Luis G.', 'Retiro'], ['Se encargaron de todo el papeleo.', 'Elisa M.', 'Salamanca']])]),
        ]) },
        { nombre: 'Servicios', ruta: 'servicios', contenido: pagina({ color: C, acento: A, fuente: F }, [
          sec({ fondo: '#f0f9ff', tipo: 'malla', ancho: 'normal' }, [titulo('Servicios', 1), texto('Todo lo necesario para vender o comprar con tranquilidad.', 'grande')]),
          sec({ fondo: '#ffffff' }, [ventajas('', '', [['casa', 'Venta de viviendas', 'Estrategia completa hasta la firma.'], ['camara', 'Marketing inmobiliario', 'Fotografía, vídeo y tour virtual.'], ['dinero', 'Financiación', 'Te ayudamos a conseguir la mejor hipoteca.'], ['libro', 'Gestión legal', 'Notaría, registro e impuestos.']], 2)]),
        ]) },
        { nombre: 'Contacto', ruta: 'contacto', contenido: contacto({ color: C, acento: A, fuente: F, titulo: 'Valora tu vivienda gratis', texto: 'Cuéntanos la dirección y te llamamos con una valoración en 24 horas.', etiqueta: 'web-valoracion', datos: [['telefono', 'Teléfono', '+34 910 555 666'], ['correo', 'Correo', 'info@hogarprime.es'], ['ubicacion', 'Oficina', 'Calle Serrano 80, Madrid']] }) },
      ];
    },
  },
];

// Para usar en el detalle de una página nueva de un sitio.

