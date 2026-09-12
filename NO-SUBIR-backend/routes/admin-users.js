/* =============================================================================
   GESTIÓN DE USUARIOS · EXCLUSIVO DEL ADMINISTRADOR
   Ciclo de vida completo: alta, ficha, permisos granulares, preferencias,
   estado, credenciales, token de API y sesiones.

   Reglas que no se pueden saltar desde el cliente:
   · Ninguna ruta de registro público existe: /register devuelve siempre 403.
   · Todo el router exige rol admin (exigeRol) antes de cualquier operación.
   · Los campos se leen de una lista blanca: lo que no está, se ignora. Así el
     cliente no puede colar `hash`, `rel`, `id` ni permisos inventados.
   · Nadie puede modificar su propio rol, estado ni permisos (escalada).
   · El sistema nunca se queda sin administrador activo.
   · La contraseña en claro se devuelve UNA vez; después solo existe el hash.
   ========================================================================== */
const express = require('express');
const crypto = require('crypto');
const { exigeRol } = require('../middleware/authMiddleware');
const { securityLogger, ACCESOS_RAIZ } = require('../utils/logger');
const { auditar, difUsuario } = require('../utils/auditoria');
const { cifra, algoritmo } = require('../utils/clave');
const { USUARIOS, ROLES, ESTADOS, PERMISOS, permisosDeRol, nuevoRelacion,
        claveAleatoria, revisaClave, apiToken, preferenciasPorDefecto, publico,
        normalizaEmail, esRaiz, RAIZ_EMAIL } = require('../utils/usuarios');

const router = express.Router();
router.use(exigeRol('admin'));

const RE_EMAIL   = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const RE_PREFIJO = /^\+\d{1,3}$/;
const RE_TEL     = /^[\d\s.-]{6,20}$/;
const RE_EXT     = /^\d{0,6}$/;
const RE_HORA    = /^([01]\d|2[0-3]):[0-5]\d$/;
const AVATAR_MAX = 2.5 * 1024 * 1024;                 // 2,5 MB de imagen real

function txt(v, max){ return typeof v === 'string' && v.length <= max ? v.trim() : null; }

/* Admite el teléfono entero («+34 601 223 344») o separado en prefijo y número.
   Devuelve {prefijo, telefono} o null si el formato no vale. */
function separaTelefono(prefijo, telefono){
  let pre = prefijo === undefined || prefijo === '' ? null : String(prefijo).trim();
  let num = telefono === undefined ? '' : String(telefono).trim();
  const junto = /^(\+\d{1,3})[\s.-]*(.*)$/.exec(num);
  if (junto) { if (pre === null) pre = junto[1]; num = junto[2].trim(); }
  if (pre === null) pre = '+34';
  if (!RE_PREFIJO.test(pre)) return null;
  if (num !== '' && !RE_TEL.test(num)) return null;
  return { prefijo: pre, telefono: num };
}
function adminsActivos(excepto){
  return USUARIOS.filter(u => u.rol === 'admin' && u.estado === 'Activo' && u.id !== excepto).length;
}

/* -----------------------------------------------------------------------
   BLINDAJE DE LA CUENTA DE RAÍZ
   Lo que ningún administrador —tampoco el propio titular— puede hacer con
   ella desde el panel. La comprobación vive en el servidor porque es el
   único sitio donde no se puede saltar: ocultar el botón en la interfaz no
   impide que alguien envíe la petición a mano.
   Cambiar el correo de raíz o dejarla inactiva equivale a perder la llave
   maestra del sistema, así que esas dos operaciones no existen. Si algún día
   hace falta mover la cuenta a otra dirección, se cambia en el código de la
   semilla y se reinicia: un movimiento consciente y con despliegue, no un
   clic en una pantalla.
   -------------------------------------------------------------------- */
function vetoRaiz(u, b){
  if (!esRaiz(u)) return null;
  if (b.email !== undefined && normalizaEmail(b.email) !== u.email) {
    return { code: 'RAIZ_EMAIL_FIJO',
      error: 'El correo del Super Administrador de raíz no se cambia desde el panel.' };
  }
  if (b.estado !== undefined && b.estado !== 'Activo') {
    return { code: 'RAIZ_SIEMPRE_ACTIVA',
      error: 'La cuenta de raíz no se puede suspender ni dar de baja.' };
  }
  if (b.rol !== undefined && b.rol !== 'admin') {
    return { code: 'RAIZ_ROL_FIJO',
      error: 'La cuenta de raíz es administradora de forma permanente.' };
  }
  if (b.permisos !== undefined) {
    return { code: 'RAIZ_PERMISOS_TOTALES',
      error: 'La cuenta de raíz tiene todos los permisos y no se le recortan.' };
  }
  return null;
}
function copia(u){ return JSON.parse(JSON.stringify({ ...u, hash: undefined })); }
function usuario(id){ return USUARIOS.find(u => u.id === id); }

/* Valida los permisos que llegan del panel.

   Se reciben como LISTA de las claves concedidas —["presu.ver","exp.docs"]—,
   no como objeto {"presu.ver":true}. El motivo es la capa de saneamiento: para
   cortar la inyección por rutas anidadas rechaza cualquier clave de objeto que
   lleve un punto, y los permisos lo llevan. Como lista, los identificadores
   viajan de valor y esa defensa se mantiene intacta.
   La respuesta sí devuelve el objeto, que es más cómodo de consultar. */
function saneaPermisos(entrada, actuales){
  if (entrada === undefined) return { ok: true, valor: actuales };
  if (!Array.isArray(entrada)) {
    return { ok: false, motivo: 'Los permisos se envían como lista de claves concedidas, ' +
      'por ejemplo ["presu.ver","exp.docs"].' };
  }
  if (entrada.length > PERMISOS.length) {
    return { ok: false, motivo: 'Demasiados permisos en la lista.' };
  }
  const desconocida = entrada.find(k => typeof k !== 'string' || !PERMISOS.includes(k));
  if (desconocida !== undefined) {
    return { ok: false, motivo: `Permiso desconocido: ${String(desconocida).slice(0, 40)}.` };
  }
  const salida = {};
  PERMISOS.forEach(k => { salida[k] = entrada.includes(k); });
  return { ok: true, valor: salida };
}

/* Igual con las preferencias: se reconstruyen campo a campo sobre la forma
   conocida, para que el cliente no pueda inyectar estructuras arbitrarias. */
function saneaPreferencias(entrada, actuales){
  if (entrada === undefined) return { ok: true, valor: actuales };
  if (!entrada || typeof entrada !== 'object') return { ok: false, motivo: 'Preferencias no válidas.' };
  const p = JSON.parse(JSON.stringify(actuales || preferenciasPorDefecto()));
  const { llamadas, disponibilidad, calendario, notificaciones } = entrada;

  if (llamadas && typeof llamadas === 'object') {
    if (llamadas.extension !== undefined) {
      if (!RE_EXT.test(String(llamadas.extension))) return { ok:false, motivo:'Extensión no válida.' };
      p.llamadas.extension = String(llamadas.extension);
    }
    if (llamadas.desvio !== undefined) p.llamadas.desvio = txt(llamadas.desvio, 40) || '';
    if (typeof llamadas.grabar === 'boolean') p.llamadas.grabar = llamadas.grabar;
    if (typeof llamadas.buzon  === 'boolean') p.llamadas.buzon  = llamadas.buzon;
    if (llamadas.saludo !== undefined) {
      const s = txt(llamadas.saludo, 400);
      if (s === null) return { ok:false, motivo:'El saludo del buzón es demasiado largo.' };
      p.llamadas.saludo = s;
    }
  }
  if (disponibilidad && typeof disponibilidad === 'object') {
    if (disponibilidad.dias && typeof disponibilidad.dias === 'object') {
      ['L','M','X','J','V','S','D'].forEach(d => {
        if (typeof disponibilidad.dias[d] === 'boolean') p.disponibilidad.dias[d] = disponibilidad.dias[d];
      });
    }
    for (const [k, campo] of [['desde','desde'], ['hasta','hasta']]) {
      if (disponibilidad[k] !== undefined) {
        if (!RE_HORA.test(String(disponibilidad[k]))) return { ok:false, motivo:`Hora «${campo}» no válida.` };
        p.disponibilidad[k] = String(disponibilidad[k]);
      }
    }
    if (disponibilidad.zona !== undefined) {
      const z = txt(disponibilidad.zona, 40);
      if (!z || !/^[A-Za-z]+\/[A-Za-z_]+$/.test(z)) return { ok:false, motivo:'Zona horaria no válida.' };
      p.disponibilidad.zona = z;
    }
  }
  if (calendario && typeof calendario === 'object') {
    const num = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
    if (calendario.duracion   !== undefined) {
      if (!num(calendario.duracion, 5, 480))  return { ok:false, motivo:'Duración de cita no válida.' };
      p.calendario.duracion = calendario.duracion;
    }
    if (calendario.margen     !== undefined) {
      if (!num(calendario.margen, 0, 240))    return { ok:false, motivo:'Margen entre citas no válido.' };
      p.calendario.margen = calendario.margen;
    }
    if (calendario.antelacion !== undefined) {
      if (!num(calendario.antelacion, 0, 168)) return { ok:false, motivo:'Antelación no válida.' };
      p.calendario.antelacion = calendario.antelacion;
    }
    if (calendario.enlace !== undefined) {
      const e = txt(calendario.enlace, 300) || '';
      if (e && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i.test(e)) {
        return { ok:false, motivo:'El enlace de reserva debe ser una dirección https válida.' };
      }
      p.calendario.enlace = e;
    }
  }
  if (notificaciones && typeof notificaciones === 'object') {
    ['correo','push','whatsapp','resumen','altas','incidencias'].forEach(k => {
      if (typeof notificaciones[k] === 'boolean') p.notificaciones[k] = notificaciones[k];
    });
  }
  return { ok: true, valor: p };
}

/* ------------------------------- LISTADO -------------------------------- */
router.get('/', (req, res) => {
  const { q, rol, estado } = req.query;
  let lista = USUARIOS.slice();
  if (rol)    lista = lista.filter(u => u.rol === rol);
  if (estado) lista = lista.filter(u => u.estado === estado);
  if (typeof q === 'string' && q.trim()) {
    const t = q.trim().toLowerCase();
    lista = lista.filter(u => [u.nombre, u.apellidos, u.email, u.telefono, u.rel, u.rol]
      .join(' ').toLowerCase().includes(t));
  }
  res.json({
    usuarios: lista.map(u => publico(u)),
    resumen: {
      total:      USUARIOS.length,
      activos:    USUARIOS.filter(u => u.estado === 'Activo').length,
      google:     USUARIOS.filter(u => u.google).length,
      suspendidos:USUARIOS.filter(u => u.estado === 'Suspendido').length,
      baja:       USUARIOS.filter(u => u.estado === 'Dado de baja').length
    }
  });
});

/* Registro forense de la cuenta de raíz: entradas, salidas e intentos
   fallidos, con marca de tiempo, IP y agente de usuario. Solo lectura; el
   fichero completo está en logs/root-access.log. */
router.get('/raiz/accesos', (req, res) => {
  const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
  const raiz = USUARIOS.find(esRaiz);
  res.json({
    cuenta: raiz ? { email: raiz.email, rel: raiz.rel, rolRaiz: raiz.rolRaiz,
                     debeCambiar: raiz.debeCambiar } : null,
    algoritmo,
    total: ACCESOS_RAIZ.length,
    accesos: ACCESOS_RAIZ.slice(0, limite)
  });
});

router.get('/:id', (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });
  res.json({ usuario: publico(u, true), sesiones: u.sesiones || [] });
});

/* --------------------------------- ALTA --------------------------------- */
router.post('/', async (req, res) => {
  const b = req.body || {};
  const nombre = txt(b.nombre, 60), apellidos = txt(b.apellidos, 80) || '';
  // normalizaEmail resuelve los alias de la raíz, así que nadie puede dar de
  // alta una segunda cuenta que apunte a la misma identidad por otra grafía.
  const email  = b.email === undefined ? null : normalizaEmail(txt(b.email, 120) || '');

  if (!nombre || nombre.length < 2) {
    return res.status(400).json({ error: 'Nombre no válido.', code: 'NOMBRE_INVALIDO' });
  }
  if (!email || !RE_EMAIL.test(email)) {
    return res.status(400).json({ error: 'Correo no válido.', code: 'EMAIL_INVALIDO' });
  }
  if (!ROLES.includes(b.rol)) {
    return res.status(400).json({ error: 'Rol no válido.', code: 'ROL_INVALIDO' });
  }
  const tel = separaTelefono(b.prefijo, b.telefono);
  if (!tel) {
    return res.status(400).json({ error: 'Teléfono no válido. Usa formato internacional, como +34 600 000 000.',
                                  code: 'TELEFONO_INVALIDO' });
  }
  if (USUARIOS.some(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.', code: 'EMAIL_DUPLICADO' });
  }

  /* La contraseña la genera el servidor salvo que el administrador imponga una,
     y en ese caso tiene que cumplir la política corporativa. */
  let passwordInicial = claveAleatoria();
  if (b.password !== undefined) {
    const faltan = revisaClave(b.password, { email, nombre, apellidos });
    if (faltan.length) {
      return res.status(400).json({ error: 'La contraseña necesita ' + faltan.join(', ') + '.',
                                    code: 'CLAVE_DEBIL', faltan });
    }
    passwordInicial = b.password;
  }

  const perm = saneaPermisos(b.permisos, permisosDeRol(b.rol));
  if (!perm.ok) return res.status(400).json({ error: perm.motivo, code: 'PERMISOS_INVALIDOS' });

  const u = {
    id: crypto.randomUUID(),
    nombre, apellidos,
    email: email.toLowerCase(),
    prefijo: tel.prefijo,
    telefono: tel.telefono,
    extension: RE_EXT.test(String(b.extension || '')) ? String(b.extension || '') : '',
    rol: b.rol,
    rel: nuevoRelacion(),
    hash: await cifra(passwordInicial),
    avatarUrl: null,
    google: b.google === true,                 // lista blanca de Google, explícita
    estado: 'Activo',
    debeCambiar: true,                         // obliga a cambiarla en el primer acceso
    dobleFactor: b.dobleFactor === true,
    permisos: perm.valor,
    preferencias: preferenciasPorDefecto(),
    apiToken: apiToken(),
    sesiones: [],
    alta: new Date().toISOString().slice(0, 10),
    ultimo: null
  };
  USUARIOS.push(u);

  auditar(req, { destino: u, accion: 'Cuenta creada',
    detalle: `${u.rol} · relación ${u.rel} · ${u.google ? 'Google autorizado' : 'solo contraseña'}` });

  // La contraseña en claro se devuelve UNA sola vez, para entregarla en mano.
  res.status(201).json({ usuario: publico(u, true), passwordInicial });
});

/* ------------------------- MODIFICACIÓN DE LA FICHA ---------------------- */
router.patch('/:id', async (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });

  const b = req.body || {};
  const antes = copia(u);
  const propia = req.user.sub === u.id;

  /* La cuenta de raíz, primero: su blindaje está por encima de todo lo demás. */
  const veto = vetoRaiz(u, b);
  if (veto) {
    securityLogger.error('Intento de alterar la cuenta de raíz', {
      porAdmin: req.user.sub, motivo: veto.code, ip: req.ip, ua: req.headers['user-agent'] });
    auditar(req, { destino: u, accion: 'Intento bloqueado sobre la cuenta de raíz',
                   detalle: veto.error });
    return res.status(409).json(veto);
  }

  /* Escalada de privilegios: nadie se cambia a sí mismo el rol, el estado ni
     sus permisos, aunque sea administrador. Eso lo hace otro administrador. */
  if (propia && (b.rol !== undefined || b.estado !== undefined || b.permisos !== undefined)) {
    securityLogger.warn('Intento de auto-modificación de privilegios', { usuario: u.id, ip: req.ip });
    return res.status(403).json({
      error: 'No puedes cambiar tu propio rol, estado ni permisos. Pídeselo a otro administrador.',
      code: 'AUTO_ESCALADA' });
  }

  if (b.nombre !== undefined) {
    const n = txt(b.nombre, 60);
    if (!n || n.length < 2) return res.status(400).json({ error:'Nombre no válido.', code:'NOMBRE_INVALIDO' });
    u.nombre = n;
  }
  if (b.apellidos !== undefined) u.apellidos = txt(b.apellidos, 80) || '';
  if (b.email !== undefined) {
    const e = txt(b.email, 120);
    if (!e || !RE_EMAIL.test(e)) return res.status(400).json({ error:'Correo no válido.', code:'EMAIL_INVALIDO' });
    if (USUARIOS.some(x => x.email === e.toLowerCase() && x.id !== u.id)) {
      return res.status(409).json({ error:'Ya existe otra cuenta con ese correo.', code:'EMAIL_DUPLICADO' });
    }
    // Cambiar el correo invalida la autorización de Google: ya no es la misma identidad.
    if (e.toLowerCase() !== u.email) u.google = false;
    u.email = e.toLowerCase();
  }
  if (b.prefijo !== undefined || b.telefono !== undefined) {
    const t = separaTelefono(b.prefijo !== undefined ? b.prefijo : u.prefijo,
                             b.telefono !== undefined ? b.telefono : u.telefono);
    if (!t) {
      return res.status(400).json({ error:'Teléfono no válido. Usa formato internacional, como +34 600 000 000.',
                                    code:'TELEFONO_INVALIDO' });
    }
    u.prefijo = t.prefijo; u.telefono = t.telefono;
  }
  if (b.extension !== undefined) {
    if (!RE_EXT.test(String(b.extension))) {
      return res.status(400).json({ error:'Extensión no válida.', code:'EXTENSION_INVALIDA' });
    }
    u.extension = String(b.extension);
  }

  if (b.rol !== undefined) {
    if (!ROLES.includes(b.rol)) return res.status(400).json({ error:'Rol no válido.', code:'ROL_INVALIDO' });
    if (u.rol === 'admin' && b.rol !== 'admin' && adminsActivos(u.id) === 0) {
      return res.status(409).json({ error:'No puedes dejar el sistema sin ningún administrador activo.',
                                    code:'ULTIMO_ADMIN' });
    }
    if (u.rol !== b.rol) { u.rol = b.rol; u.permisos = permisosDeRol(b.rol); }
  }
  if (b.estado !== undefined) {
    if (!ESTADOS.includes(b.estado)) {
      return res.status(400).json({ error:'Estado no válido.', code:'ESTADO_INVALIDO' });
    }
    if (u.rol === 'admin' && b.estado !== 'Activo' && adminsActivos(u.id) === 0) {
      return res.status(409).json({ error:'No puedes dejar el sistema sin ningún administrador activo.',
                                    code:'ULTIMO_ADMIN' });
    }
    u.estado = b.estado;
    if (b.estado !== 'Activo') u.sesiones = [];      // cortar el acceso es inmediato
  }

  const perm = saneaPermisos(b.permisos, u.permisos);
  if (!perm.ok) return res.status(400).json({ error: perm.motivo, code: 'PERMISOS_INVALIDOS' });
  u.permisos = perm.valor;

  const pref = saneaPreferencias(b.preferencias, u.preferencias);
  if (!pref.ok) return res.status(400).json({ error: pref.motivo, code: 'PREFERENCIAS_INVALIDAS' });
  u.preferencias = pref.valor;

  if (typeof b.google      === 'boolean') u.google = b.google;
  if (typeof b.dobleFactor === 'boolean') u.dobleFactor = b.dobleFactor;
  if (typeof b.debeCambiar === 'boolean') u.debeCambiar = b.debeCambiar;

  /* Red de seguridad: pase lo que pase en este cuerpo, la raíz sale de aquí
     activa, administradora y con todos los permisos. */
  if (esRaiz(u)) {
    u.estado = 'Activo'; u.rol = 'admin'; u.email = RAIZ_EMAIL;
    u.permisos = permisosDeRol('admin');
    u.dobleFactor = true;                    // la cuenta que lo puede todo, con doble factor siempre
  }

  const cambios = difUsuario(antes, u);
  auditar(req, { destino: u,
    accion: cambios.length ? 'Ficha actualizada' : 'Ficha revisada sin cambios',
    detalle: cambios.join(' · ') });

  res.json({ usuario: publico(u), cambios });
});

/* --------------------- RESTABLECER LA CONTRASEÑA ------------------------- */
router.post('/:id/password', async (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });

  let nueva = claveAleatoria();
  if (req.body && req.body.password !== undefined) {
    const faltan = revisaClave(req.body.password, u);
    if (faltan.length) {
      return res.status(400).json({ error: 'La contraseña necesita ' + faltan.join(', ') + '.',
                                    code: 'CLAVE_DEBIL', faltan });
    }
    nueva = req.body.password;
  }
  u.hash = await cifra(nueva);
  u.debeCambiar = true;
  u.sesiones = [];                                   // sus sesiones abiertas caen

  auditar(req, { destino: u, accion: 'Contraseña restablecida',
    detalle: 'Deberá cambiarla en el próximo acceso. Sesiones cerradas.' });

  res.json({ usuario: publico(u), passwordInicial: nueva });
});

/* ------------------------- TOKEN DE API (ROTACIÓN) ----------------------- */
router.post('/:id/token', (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });
  u.apiToken = apiToken();
  auditar(req, { destino: u, accion: 'Token de API rotado',
    detalle: 'Las integraciones con el token anterior dejan de funcionar.' });
  res.json({ apiToken: u.apiToken });
});

/* Comprueba los bytes de firma reales del fichero, no solo lo que dice la
   cabecera "data:image/...;base64,". Esa cabecera la escribe quien envía la
   petición: no demuestra nada por sí sola. */
function tipoImagenReal(buf){
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return 'png';
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/* ------------------------------- AVATAR ---------------------------------- */
router.put('/:id/avatar', (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });

  const d = (req.body || {}).avatar;
  const m = typeof d === 'string' && d.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) {
    return res.status(400).json({ error: 'La imagen debe ser PNG, JPG o WebP.', code: 'IMAGEN_INVALIDA' });
  }
  let buf;
  try { buf = Buffer.from(m[2], 'base64'); }
  catch (_) { return res.status(400).json({ error: 'La imagen no se pudo decodificar.', code: 'IMAGEN_INVALIDA' }); }

  const bytes = buf.length;
  if (bytes > AVATAR_MAX) {
    return res.status(413).json({ error: 'La imagen supera los 2,5 MB.', code: 'IMAGEN_GRANDE' });
  }
  const real = tipoImagenReal(buf);
  if (!real || real !== m[1]) {
    return res.status(400).json({ error: 'El contenido del archivo no coincide con el tipo de imagen declarado.',
                                  code: 'IMAGEN_INVALIDA' });
  }
  u.avatarUrl = d;
  auditar(req, { destino: u, accion: 'Foto de perfil actualizada',
    detalle: (bytes / 1024).toFixed(0) + ' KB' });
  res.json({ ok: true, bytes });
});

router.delete('/:id/avatar', (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });
  u.avatarUrl = null;
  auditar(req, { destino: u, accion: 'Foto de perfil eliminada' });
  res.json({ ok: true });
});

/* ------------------------------ SESIONES --------------------------------- */
router.get('/:id/sesiones', (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });
  res.json({ sesiones: u.sesiones || [] });
});

router.delete('/:id/sesiones', (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });
  const n = (u.sesiones || []).length;
  u.sesiones = [];
  auditar(req, { destino: u, accion: 'Sesiones cerradas', detalle: n + ' sesión(es) revocada(s)' });
  res.json({ ok: true, cerradas: n });
});

router.delete('/:id/sesiones/:sid', (req, res) => {
  const u = usuario(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });
  const i = (u.sesiones || []).findIndex(s => s.id === req.params.sid);
  if (i < 0) return res.status(404).json({ error: 'Sesión no encontrada.', code: 'NO_ENCONTRADO' });
  const s = u.sesiones.splice(i, 1)[0];
  auditar(req, { destino: u, accion: 'Sesión revocada', detalle: s.dispositivo + ' · ' + s.ip });
  res.json({ ok: true });
});

/* ------------------------------- BORRADO --------------------------------- */
router.delete('/:id', (req, res) => {
  const i = USUARIOS.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Usuario no encontrado.', code: 'NO_ENCONTRADO' });
  if (esRaiz(USUARIOS[i])) {
    securityLogger.error('Intento de eliminar la cuenta de raíz', {
      porAdmin: req.user.sub, ip: req.ip, ua: req.headers['user-agent'] });
    auditar(req, { destino: USUARIOS[i], accion: 'Intento bloqueado sobre la cuenta de raíz',
                   detalle: 'Se intentó eliminar el Super Administrador de raíz.' });
    return res.status(409).json({ error: 'El Super Administrador de raíz no se puede eliminar.',
                                  code: 'RAIZ_INDESTRUCTIBLE' });
  }
  if (USUARIOS[i].rol === 'admin') {
    return res.status(409).json({ error: 'La cuenta de administración no se elimina desde aquí. ' +
      'Cámbiale antes el rol.', code: 'ADMIN_PROTEGIDO' });
  }
  if (USUARIOS[i].id === req.user.sub) {
    return res.status(409).json({ error: 'No puedes eliminar tu propia cuenta.', code: 'AUTO_BORRADO' });
  }
  const fuera = USUARIOS.splice(i, 1)[0];
  auditar(req, { destino: fuera, accion: 'Cuenta eliminada',
    detalle: `relación ${fuera.rel} · ${fuera.rol}` });
  res.json({ ok: true });
});

module.exports = router;
