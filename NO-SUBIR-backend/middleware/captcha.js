/* =============================================================================
   Verificación anti-bot (Cloudflare Turnstile) para login y recuperación.
   Se activa sola en cuanto TURNSTILE_SECRET_KEY está en el entorno; si no lo
   está, deja pasar sin bloquear (así el prototipo sigue arrancando sin que
   nadie tenga que dar de alta una cuenta de Turnstile primero), pero avisa
   una vez en el arranque para que no se olvide en producción.
   El panel debe enviar el token del widget en el campo "captchaToken" del
   cuerpo de la petición.
   ========================================================================== */
const { securityLogger } = require('../utils/logger');

const SECRETO = process.env.TURNSTILE_SECRET_KEY;
if (!SECRETO) {
  console.warn('[AVISO] TURNSTILE_SECRET_KEY no está configurada: login y recuperación ' +
    'no piden verificación anti-bot. Añádela antes de desplegar a producción.');
}

async function verificaTurnstile(req, res, next) {
  if (!SECRETO) return next();   // no configurado: no se exige (ver aviso de arriba)

  const token = req.body && req.body.captchaToken;
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Falta la verificación anti-bot.', code: 'CAPTCHA_AUSENTE' });
  }

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRETO, response: token, remoteip: req.ip })
    });
    const datos = await r.json();
    if (!datos.success) {
      securityLogger.warn('Verificación anti-bot rechazada', { ip: req.ip, codigos: datos['error-codes'] });
      return res.status(400).json({ error: 'Verificación anti-bot no superada.', code: 'CAPTCHA_INVALIDO' });
    }
    next();
  } catch (err) {
    securityLogger.error('No se pudo comprobar la verificación anti-bot', { motivo: err.message, ip: req.ip });
    return res.status(503).json({ error: 'No se pudo comprobar la verificación anti-bot. Inténtalo de nuevo.',
                                  code: 'CAPTCHA_NO_DISPONIBLE' });
  }
}

module.exports = { verificaTurnstile };
