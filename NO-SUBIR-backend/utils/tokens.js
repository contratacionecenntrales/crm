/* =============================================================================
   CAPA 4a · Emisión y rotación de tokens
   Acceso corto en cookie HttpOnly + refresco largo con rotación y detección
   de reutilización (si un token robado se reutiliza, se invalida la familia).
   ========================================================================== */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESO_MIN = 15;          // minutos
const REFRESCO_DIAS = 7;

/* Almacén de refrescos vivos. En producción esto va a Redis o a una tabla:
   { jti -> { sub, familia, usado } } */
const refrescos = new Map();
const familiasRevocadas = new Set();

function esProduccion() { return process.env.NODE_ENV === 'production'; }

function opcionesCookie(maxAgeMs) {
  return {
    httpOnly: true,                 // inaccesible desde JavaScript: inmune a XSS
    secure: esProduccion(),         // solo por HTTPS en producción
    sameSite: 'strict',             // el navegador no la envía desde otros sitios: corta CSRF
    path: '/',
    maxAge: maxAgeMs,
    ...(process.env.COOKIE_DOMAIN && esProduccion()
        ? { domain: process.env.COOKIE_DOMAIN } : {})
  };
}

function firmaAcceso(usuario, huella) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre, fp: huella },
    process.env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: `${ACCESO_MIN}m`, issuer: 'labs24k', audience: 'command-center' }
  );
}

function firmaRefresco(usuario, familia) {
  const jti = crypto.randomUUID();
  refrescos.set(jti, { sub: usuario.id, familia, usado: false });
  return jwt.sign(
    { sub: usuario.id, familia, jti },
    process.env.JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: `${REFRESCO_DIAS}d`, issuer: 'labs24k', audience: 'command-center' }
  );
}

/* Huella de sesión: ata el token al navegador que lo pidió. */
function huella(req) {
  return crypto.createHash('sha256')
    .update(String(req.headers['user-agent'] || '') + '|' + String(req.ip || ''))
    .digest('hex').slice(0, 32);
}

function emiteSesion(res, req, usuario, familia = crypto.randomUUID()) {
  const acceso = firmaAcceso(usuario, huella(req));
  const refresco = firmaRefresco(usuario, familia);
  const csrf = crypto.randomBytes(24).toString('base64url');

  res.cookie('lk_at', acceso, opcionesCookie(ACCESO_MIN * 60 * 1000));
  res.cookie('lk_rt', refresco, opcionesCookie(REFRESCO_DIAS * 24 * 3600 * 1000));
  // El testigo CSRF sí es legible por el panel: se reenvía en la cabecera.
  res.cookie('lk_csrf', csrf, { ...opcionesCookie(REFRESCO_DIAS * 24 * 3600 * 1000), httpOnly: false });
  return { csrf, familia };
}

/* Rotación: cada refresco se canjea una sola vez. */
function rotaRefresco(token) {
  const dec = jwt.verify(token, process.env.JWT_REFRESH_SECRET,
    { algorithms: ['HS256'], issuer: 'labs24k', audience: 'command-center' });

  if (familiasRevocadas.has(dec.familia)) {
    const e = new Error('Familia de tokens revocada'); e.code = 'FAMILIA_REVOCADA'; throw e;
  }
  const guardado = refrescos.get(dec.jti);
  if (!guardado || guardado.usado) {
    // Reutilización: alguien está usando un refresco ya canjeado.
    familiasRevocadas.add(dec.familia);
    const e = new Error('Reutilización de token detectada'); e.code = 'REUTILIZACION_DETECTADA'; throw e;
  }
  guardado.usado = true;
  return dec;
}

function cierraSesion(res, familia) {
  if (familia) familiasRevocadas.add(familia);
  ['lk_at', 'lk_rt', 'lk_csrf'].forEach(c => res.clearCookie(c, { path: '/' }));
}

module.exports = { emiteSesion, rotaRefresco, cierraSesion, huella, opcionesCookie };
