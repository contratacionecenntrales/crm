/* =============================================================================
   CAPA 5 · Registro forense y auditoria
   ========================================================================== */
const winston = require('winston');
const path = require('path');

const DIR = path.join(__dirname, '..', 'logs');

/* Nunca deben llegar secretos al fichero de log. Recorre objetos anidados:
   un campo sensible metido dentro de otro (p.ej. {detalle:{token:'...'}})
   se censura igual que uno de primer nivel.
   "info" lleva propiedades Symbol de uso interno de winston (nivel, mensaje):
   se muta en el sitio para conservarlas, en vez de reconstruir el objeto. */
const CAMPOS_SENSIBLES = /pass|secret|token|cookie|authorization|iban|tarjeta/i;
const PROFUNDIDAD_MAX = 6;
function censuraValor(valor, profundidad) {
  if (profundidad > PROFUNDIDAD_MAX || valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(v => censuraValor(v, profundidad + 1));
  const salida = {};
  for (const k of Object.keys(valor)) {
    salida[k] = CAMPOS_SENSIBLES.test(k) ? '[censurado]' : censuraValor(valor[k], profundidad + 1);
  }
  return salida;
}
const censura = winston.format(info => {
  for (const k of Object.keys(info)) {
    info[k] = CAMPOS_SENSIBLES.test(k) ? '[censurado]' : censuraValor(info[k], 1);
  }
  return info;
});

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    censura(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'labs24k-security-shield' },
  transports: [
    new winston.transports.File({
      filename: path.join(DIR, 'security-error.log'), level: 'error',
      maxsize: 5 * 1024 * 1024, maxFiles: 10, tailable: true
    }),
    new winston.transports.File({
      filename: path.join(DIR, 'security-combined.log'),
      maxsize: 5 * 1024 * 1024, maxFiles: 10, tailable: true
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  securityLogger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

/* -----------------------------------------------------------------------
   REGISTRO DEL ACCESO DE RAÍZ
   Fichero aparte, solo para la cuenta de Super Administrador: cada entrada,
   cada salida y cada intento fallido, con marca de tiempo, IP y agente de
   usuario. Va separado a propósito, para que un log de aplicación ruidoso no
   entierre el rastro de la cuenta que lo puede todo, y para poder darle
   permisos de fichero más estrictos que al resto.

   En producción: envíalo a un destino de solo-añadir fuera de la máquina
   (syslog remoto, CloudWatch, un bucket con Object Lock). Un registro que
   puede borrar quien entra en el servidor no prueba nada.
   -------------------------------------------------------------------- */
const raizLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    censura(), winston.format.timestamp(), winston.format.json()
  ),
  defaultMeta: { service: 'labs24k-root-access' },
  transports: [
    new winston.transports.File({
      filename: path.join(DIR, 'root-access.log'),
      maxsize: 5 * 1024 * 1024, maxFiles: 20, tailable: true
    })
  ]
});

/* Últimos accesos de raíz en memoria, para poder mostrarlos en el panel. */
const ACCESOS_RAIZ = [];

function registraAccesoRaiz(evento, req, extra) {
  const apunte = {
    evento,                                   // ENTRADA · ENTRADA_GOOGLE · FALLIDO · SALIDA
    ts: new Date().toISOString(),
    ip: req.ip,
    ua: String(req.headers['user-agent'] || '').slice(0, 250),
    origen: req.headers['origin'] || null,
    ...(extra || {})
  };
  ACCESOS_RAIZ.unshift(apunte);
  if (ACCESOS_RAIZ.length > 200) ACCESOS_RAIZ.length = 200;

  if (evento === 'FALLIDO') raizLogger.warn('Acceso de raíz fallido', apunte);
  else raizLogger.info('Acceso de raíz', apunte);
  return apunte;
}

/* Auditoria de peticiones: registra los fallos y las operaciones sensibles. */
function securityAuditMiddleware(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - inicio;
    const base = {
      metodo: req.method,
      url: req.originalUrl,
      estado: res.statusCode,
      ip: req.ip,
      ua: req.headers['user-agent'],
      usuario: req.user ? req.user.sub : null,
      ms
    };
    if (res.statusCode >= 500) securityLogger.error('Error de servidor', base);
    else if (res.statusCode >= 400) securityLogger.warn('Petición rechazada', base);
    else if (req.method !== 'GET') securityLogger.info('Operación registrada', base);
  });
  next();
}

module.exports = { securityLogger, securityAuditMiddleware,
                   raizLogger, ACCESOS_RAIZ, registraAccesoRaiz };
