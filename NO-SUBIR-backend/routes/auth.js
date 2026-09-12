/* =============================================================================
   Rutas de autenticación
   Usuarios de demostración en memoria. Sustituye `USUARIOS` por tu tabla real:
   lo único que debe guardarse es el hash, nunca la contraseña.
   ========================================================================== */
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { emiteSesion, rotaRefresco, cierraSesion } = require('../utils/tokens');
const { securityLogger, registraAccesoRaiz } = require('../utils/logger');
const { cifra, verifica, necesitaReciclado, HASH_SENUELO } = require('../utils/clave');
const { estaBloqueada, marcaFallo, marcaExito } = require('../utils/bloqueoCuenta');

const router = express.Router();

const { USUARIOS, normalizaEmail, esRaiz } = require('../utils/usuarios');
const { auditar } = require('../utils/auditoria');

/* Registro de sesiones abiertas: lo que el administrador ve y puede revocar
   desde la ficha del usuario. En producción va en tabla, no en memoria. */
function registraSesion(u, req){
  if (!Array.isArray(u.sesiones)) u.sesiones = [];
  const ua = String(req.headers['user-agent'] || '');
  const navegador = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' :
                    /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Navegador';
  const so = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' :
             /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' :
             /Linux/.test(ua) ? 'Linux' : 'sistema desconocido';
  u.sesiones.unshift({
    id: crypto.randomUUID(),
    dispositivo: navegador + ' · ' + so,
    ip: req.ip,
    inicio: new Date().toISOString()
  });
  if (u.sesiones.length > 12) u.sesiones.length = 12;
}

/* El hash señuelo se compara siempre, aunque el correo no exista, para que el
   tiempo de respuesta no revele qué cuentas están dadas de alta. Vive en
   utils/clave.js, junto al algoritmo. */

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' ||
      email.length > 120 || password.length > 200) {
    return res.status(400).json({ error: 'Credenciales mal formadas.', code: 'DATOS_INVALIDOS' });
  }

  // normalizaEmail resuelve los alias de la cuenta de raíz (con tilde y sin ella).
  const buscado = normalizaEmail(email);

  // Bloqueo por cuenta, no solo por IP: independiente de authLimiter, que
  // solo frena repeticiones desde la misma dirección (middleware/rateLimiter.js).
  const restanteMs = estaBloqueada(buscado);
  if (restanteMs > 0) {
    securityLogger.warn('Intento contra cuenta bloqueada por fuerza bruta', { email: buscado, ip: req.ip });
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Vuelve a intentarlo en unos minutos.',
                                  code: 'CUENTA_BLOQUEADA', reintentaEnMs: restanteMs });
  }

  const usuario = USUARIOS.find(u => u.email === buscado);
  const ok = await verifica(password, usuario ? usuario.hash : HASH_SENUELO);
  if (!ok) marcaFallo(buscado);

  if (usuario && ok && usuario.estado !== 'Activo') {
    securityLogger.warn('Acceso de cuenta suspendida', { usuario: usuario.id, ip: req.ip });
    if (esRaiz(usuario)) registraAccesoRaiz('FALLIDO', req, { motivo: 'CUENTA_NO_ACTIVA' });
    return res.status(403).json({ error: 'Cuenta suspendida. Contacta con tu administrador.',
                                  code: 'CUENTA_SUSPENDIDA' });
  }
  if (!usuario || !ok) {
    securityLogger.warn('Intento de acceso fallido', { email: buscado, ip: req.ip,
      ua: req.headers['user-agent'] });
    // Todo intento contra la cuenta que lo puede todo deja rastro propio.
    if (usuario && esRaiz(usuario)) {
      registraAccesoRaiz('FALLIDO', req, { motivo: 'CREDENCIALES_INCORRECTAS' });
    }
    // Mensaje idéntico en ambos casos: no se revela si el correo existe.
    return res.status(401).json({ error: 'Credenciales incorrectas.', code: 'CREDENCIALES' });
  }

  /* Reciclado silencioso del hash: si la cuenta venía de bcrypt y Argon2id ya
     está disponible, este es el único momento en que existe la contraseña en
     claro, así que es aquí donde se vuelve a cifrar con el algoritmo actual. */
  if (necesitaReciclado(usuario.hash)) {
    try {
      usuario.hash = await cifra(password);
      securityLogger.info('Hash de contraseña reciclado al algoritmo actual', { usuario: usuario.id });
    } catch (e) {
      securityLogger.error('No se pudo reciclar el hash', { usuario: usuario.id, motivo: e.message });
    }
  }

  if (esRaiz(usuario)) {
    registraAccesoRaiz('ENTRADA', req, { usuario: usuario.id, email: usuario.email,
                                         debeCambiar: usuario.debeCambiar });
  }

  marcaExito(buscado);
  usuario.ultimo = new Date().toISOString();
  registraSesion(usuario, req);
  const { csrf } = emiteSesion(res, req, usuario);
  securityLogger.info('Acceso correcto', { usuario: usuario.id, rol: usuario.rol, ip: req.ip });

  res.json({
    usuario: { id: usuario.id, nombre: usuario.nombre, apellidos: usuario.apellidos,
               rol: usuario.rol, rolRaiz: usuario.rolRaiz, raiz: esRaiz(usuario),
               email: usuario.email, rel: usuario.rel,
               avatarUrl: usuario.avatarUrl, permisos: usuario.permisos,
               debeCambiar: usuario.debeCambiar },
    csrfToken: csrf
  });
});

/* -----------------------------------------------------------------------
   RECUPERACIÓN DE CONTRASEÑA
   No se envía ningún enlace automático ni se revela si la cuenta existe:
   se avisa al administrador, que restablece la clave y la entrega en mano.
   La respuesta es siempre la misma, exista o no el correo.
   -------------------------------------------------------------------- */
router.post('/recuperar', (req, res) => {
  const { email } = req.body || {};
  const respuesta = { ok: true,
    mensaje: 'Si la cuenta existe, el administrador de Labs24k recibirá el aviso.' };

  if (typeof email !== 'string' || email.length > 120 || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return res.json(respuesta);
  }
  const u = USUARIOS.find(x => x.email === email.toLowerCase().trim());
  securityLogger.warn('Solicitud de recuperación de contraseña', {
    email: email.toLowerCase().trim(), existe: !!u, ip: req.ip });
  if (u) auditar(req, { destino: u, accion: 'Recuperación de contraseña solicitada',
                        detalle: 'Pendiente de que un administrador la restablezca.' });
  res.json(respuesta);
});

/* -----------------------------------------------------------------------
   REGISTRO PÚBLICO: PROHIBIDO SIEMPRE
   Cualquier ruta que suene a alta propia responde 403 y queda registrada.
   -------------------------------------------------------------------- */
['/register', '/signup', '/registro', '/alta', '/crear-cuenta'].forEach(ruta => {
  router.all(ruta, (req, res) => {
    securityLogger.warn('Intento de registro público bloqueado', {
      ruta, ip: req.ip, ua: req.headers['user-agent'], cuerpo: Object.keys(req.body || {})
    });
    res.status(403).json({
      error: 'El registro está deshabilitado. Las cuentas las crea el administrador de Labs24k.',
      code: 'REGISTRO_DESHABILITADO'
    });
  });
});

/* -----------------------------------------------------------------------
   ACCESO CON GOOGLE · solo correos previamente autorizados (lista blanca)
   El id_token se verifica CONTRA GOOGLE, no se cree lo que envía el cliente.
   -------------------------------------------------------------------- */
router.post('/google', async (req, res) => {
  const { idToken } = req.body || {};
  if (typeof idToken !== 'string' || idToken.length < 20) {
    return res.status(400).json({ error: 'Token de Google ausente.', code: 'TOKEN_AUSENTE' });
  }

  let datos;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' +
                          encodeURIComponent(idToken));
    if (!r.ok) throw new Error('tokeninfo ' + r.status);
    datos = await r.json();
  } catch (err) {
    securityLogger.error('No se pudo verificar el token de Google', { motivo: err.message, ip: req.ip });
    return res.status(401).json({ error: 'No se ha podido verificar tu cuenta de Google.',
                                  code: 'GOOGLE_NO_VERIFICADO' });
  }

  // El token debe estar emitido para NUESTRA aplicación y con el correo verificado.
  if (datos.aud !== process.env.GOOGLE_CLIENT_ID ||
      String(datos.email_verified) !== 'true' || !datos.email) {
    securityLogger.error('Token de Google no válido para esta aplicación', {
      aud: datos.aud, ip: req.ip });
    return res.status(401).json({ error: 'Acceso no autorizado. Contacta con tu administrador.',
                                  code: 'GOOGLE_AUD_INVALIDA' });
  }

  const usuario = USUARIOS.find(u => u.email === normalizaEmail(datos.email));

  // Aquí está la regla: si no lo dio de alta el administrador, no entra.
  if (!usuario || !usuario.google || usuario.estado !== 'Activo') {
    securityLogger.warn('Google fuera de la lista blanca', { email: datos.email, ip: req.ip });
    if (usuario && esRaiz(usuario)) registraAccesoRaiz('FALLIDO', req, { motivo: 'GOOGLE_NO_AUTORIZADO' });
    return res.status(403).json({ error: 'Acceso no autorizado. Contacta con tu administrador.',
                                  code: 'NO_AUTORIZADO' });
  }

  if (esRaiz(usuario)) {
    registraAccesoRaiz('ENTRADA_GOOGLE', req, { usuario: usuario.id, email: usuario.email });
  }
  usuario.ultimo = new Date().toISOString();
  registraSesion(usuario, req);
  const { csrf } = emiteSesion(res, req, usuario);
  securityLogger.info('Acceso correcto por Google', { usuario: usuario.id, ip: req.ip });
  res.json({
    usuario: { id: usuario.id, nombre: usuario.nombre, apellidos: usuario.apellidos,
               rol: usuario.rol, email: usuario.email, rel: usuario.rel,
               avatarUrl: usuario.avatarUrl, permisos: usuario.permisos },
    csrfToken: csrf
  });
});

/* Renovación con rotación del refresco */
router.post('/refresh', (req, res) => {
  const token = req.cookies && req.cookies.lk_rt;
  if (!token) return res.status(401).json({ error: 'Sin token de refresco.', code: 'SIN_REFRESCO' });

  try {
    const dec = rotaRefresco(token);
    const usuario = USUARIOS.find(u => u.id === dec.sub);
    if (!usuario) throw new Error('Usuario inexistente');

    const { csrf } = emiteSesion(res, req, usuario, dec.familia);
    res.json({ ok: true, csrfToken: csrf });
  } catch (err) {
    if (err.code === 'REUTILIZACION_DETECTADA' || err.code === 'FAMILIA_REVOCADA') {
      securityLogger.error('Posible robo de token', { motivo: err.code, ip: req.ip,
        ua: req.headers['user-agent'] });
      cierraSesion(res);
      return res.status(401).json({ error: 'Sesión invalidada por seguridad. Vuelve a entrar.',
                                    code: err.code });
    }
    return res.status(401).json({ error: 'Refresco no válido.', code: 'REFRESCO_INVALIDO' });
  }
});

router.post('/logout', (req, res) => {
  let familia = null, sub = null;
  try {
    const dec = jwt.decode(req.cookies && req.cookies.lk_rt);
    familia = dec && dec.familia;
    sub = dec && dec.sub;
  } catch (_) {}
  const u = sub ? USUARIOS.find(x => x.id === sub) : null;
  if (u && esRaiz(u)) registraAccesoRaiz('SALIDA', req, { usuario: u.id });
  cierraSesion(res, familia);
  res.json({ ok: true });
});

module.exports = router;
