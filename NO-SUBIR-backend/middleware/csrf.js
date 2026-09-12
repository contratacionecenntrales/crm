/* =============================================================================
   CAPA 4c · Protección CSRF (doble envío de testigo)
   Falta en la mayoría de stacks que usan cookies: si la sesión viaja en cookie,
   el navegador la envía sola, así que un formulario en otra web podría operar
   en nombre del comercial. SameSite=strict lo corta en navegadores modernos;
   esto lo cubre también donde SameSite no basta.
   ========================================================================== */
const crypto = require('crypto');
const { securityLogger } = require('../utils/logger');

const SEGUROS = ['GET', 'HEAD', 'OPTIONS'];

function comparaSegura(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function csrfProtection(req, res, next) {
  if (SEGUROS.includes(req.method)) return next();

  const cookie = req.cookies && req.cookies.lk_csrf;
  const cabecera = req.headers['x-csrf-token'];

  if (!cookie || !cabecera || !comparaSegura(cookie, cabecera)) {
    securityLogger.error('Petición CSRF bloqueada', {
      ip: req.ip, url: req.originalUrl, origen: req.headers.origin,
      referer: req.headers.referer
    });
    return res.status(403).json({ error: 'Testigo CSRF ausente o no válido.',
                                  code: 'CSRF_INVALIDO' });
  }
  next();
}

module.exports = csrfProtection;
