/* =============================================================================
   CAPA 4b · Verificación de sesión y control de rol
   ========================================================================== */
const jwt = require('jsonwebtoken');
const { huella } = require('../utils/tokens');
const { securityLogger } = require('../utils/logger');

function verifySecureToken(req, res, next) {
  // Solo cookie HttpOnly. No se acepta el token por cabecera Authorization
  // porque eso obligaría al panel a guardarlo en JS, que es justo lo que
  // convierte cualquier XSS en un robo de sesión.
  const token = req.cookies && req.cookies.lk_at;

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Sesión no iniciada.',
                                  code: 'SIN_SESION' });
  }
  try {
    const dec = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],            // fija el algoritmo: evita el ataque alg=none
      issuer: 'labs24k',
      audience: 'command-center'
    });

    // La huella ata el token al navegador y a la IP que lo obtuvieron.
    if (dec.fp && dec.fp !== huella(req)) {
      securityLogger.error('Huella de sesión no coincide', {
        usuario: dec.sub, ip: req.ip, ua: req.headers['user-agent']
      });
      return res.status(403).json({ error: 'Sesión no válida en este dispositivo.',
                                    code: 'HUELLA_INVALIDA' });
    }

    req.user = dec;
    next();
  } catch (err) {
    const expirado = err.name === 'TokenExpiredError';
    securityLogger.warn('Token rechazado', { motivo: err.name, ip: req.ip, url: req.originalUrl });
    return res.status(expirado ? 401 : 403).json({
      error: expirado ? 'La sesión ha caducado.' : 'Token no válido.',
      code: expirado ? 'SESION_CADUCADA' : 'TOKEN_INVALIDO'
    });
  }
}

/* Control de rol, equivalente al del panel:
   admin · manager · commercial · backoffice */
function exigeRol(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sin sesión.', code: 'SIN_SESION' });
    if (!roles.includes(req.user.rol)) {
      securityLogger.warn('Acceso denegado por rol', {
        usuario: req.user.sub, rol: req.user.rol, exigido: roles, url: req.originalUrl
      });
      return res.status(403).json({ error: 'Tu perfil no tiene permiso para esta operación.',
                                    code: 'ROL_INSUFICIENTE' });
    }
    next();
  };
}

module.exports = verifySecureToken;
module.exports.verifySecureToken = verifySecureToken;
module.exports.exigeRol = exigeRol;
