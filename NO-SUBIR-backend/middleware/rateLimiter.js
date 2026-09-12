/* =============================================================================
   CAPA 2 · Limitacion de peticiones (fuerza bruta, escaneo y saturacion)
   ========================================================================== */
const rateLimit = require('express-rate-limit');
const { securityLogger } = require('../utils/logger');

function onLimit(code) {
  return (req, res, next, options) => {
    securityLogger.warn('Limite de peticiones superado', {
      code, ip: req.ip, url: req.originalUrl, ua: req.headers['user-agent']
    });
    res.status(options.statusCode).json(options.message);
  };
}

/* Limite general de la API */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP. Inténtalo más tarde.',
             code: 'RATE_LIMIT_EXCEEDED' },
  handler: onLimit('RATE_LIMIT_EXCEEDED')
});

/* Limite estricto de autenticacion.
   skipSuccessfulRequests: los accesos correctos no gastan intentos, asi un
   comercial que entra bien varias veces al dia nunca se queda fuera. */
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Acceso bloqueado temporalmente por seguridad tras varios intentos fallidos.',
             code: 'AUTH_RATE_LIMIT_EXCEEDED' },
  handler: onLimit('AUTH_RATE_LIMIT_EXCEEDED')
});

/* Limite de la recuperacion de contrasena. Contador propio, separado del de
   login: un ataque de fuerza bruta a la contrasena no debe dejar sin servicio
   al usuario que de verdad la ha olvidado, ni al reves. */
const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperacion. Inténtalo más tarde.',
             code: 'RECOVERY_RATE_LIMIT_EXCEEDED' },
  handler: onLimit('RECOVERY_RATE_LIMIT_EXCEEDED')
});

/* Limite para operaciones de escritura (fichas, permisos, documentos).
   60 por minuto: sobra para un administrador trabajando a mano en el panel y
   sigue cortando cualquier script que dispare cientos de cambios seguidos. */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas operaciones seguidas.', code: 'WRITE_RATE_LIMIT_EXCEEDED' },
  handler: onLimit('WRITE_RATE_LIMIT_EXCEEDED')
});

module.exports = { globalLimiter, authLimiter, recoveryLimiter, writeLimiter };
