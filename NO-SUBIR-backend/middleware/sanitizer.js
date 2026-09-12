/* =============================================================================
   CAPA 3 · Saneamiento de entradas
   Bloquea contaminacion de prototipos, operadores de inyeccion NoSQL y
   secuencias de control, y neutraliza el HTML de las cadenas recibidas.

   NOTA: aqui NO se usan express-mongo-sanitize ni xss-clean.
   xss-clean lleva sin mantenimiento desde 2022 y ambos paquetes reasignan
   req.query, que en Express 5 es una propiedad de solo lectura y provoca un
   fallo en arranque. Esta implementacion cubre lo mismo sin dependencias.
   ========================================================================== */
const { securityLogger } = require('../utils/logger');

const CLAVES_PROHIBIDAS = ['__proto__', 'constructor', 'prototype'];
const MAX_PROFUNDIDAD = 12;

/* Escapa el HTML de una cadena. La defensa definitiva contra XSS es escapar
   en la salida, pero neutralizar en la entrada corta los payloads almacenados. */
function escapaHtml(s) {
  return s.replace(/[&<>"'`]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;', '`': '&#96;'
  }[c]));
}

function limpia(valor, ctx, profundidad = 0) {
  if (profundidad > MAX_PROFUNDIDAD) { ctx.motivo = 'ESTRUCTURA_DEMASIADO_ANIDADA'; return null; }

  if (typeof valor === 'string') {
    // elimina caracteres de control (log injection, terminal escapes)
    return escapaHtml(valor.replace(/[\x00-\x1F\x7F]/g, ''));
  }
  if (valor === null || typeof valor !== 'object') return valor;

  if (Array.isArray(valor)) return valor.map(v => limpia(v, ctx, profundidad + 1));

  const salida = Object.create(null);
  for (const clave of Object.keys(valor)) {
    if (CLAVES_PROHIBIDAS.includes(clave)) { ctx.motivo = 'PROTOTYPE_POLLUTION'; return null; }
    // operadores de inyeccion NoSQL: $gt, $ne, $where, y claves con punto
    if (clave.startsWith('$') || clave.includes('.')) { ctx.motivo = 'OPERADOR_NOSQL'; return null; }
    const v = limpia(valor[clave], ctx, profundidad + 1);
    if (ctx.motivo) return null;
    salida[clave] = v;
  }
  return salida;
}

function applySanitization(app) {
  app.use((req, res, next) => {
    const ctx = {};

    if (req.body && typeof req.body === 'object') {
      const limpio = limpia(req.body, ctx);
      if (ctx.motivo) return rechaza(req, res, ctx.motivo, 'body');
      req.body = limpio;
    }

    // req.query es de solo lectura en Express 5: se valida sin reasignarlo.
    if (req.query && typeof req.query === 'object') {
      limpia({ ...req.query }, ctx);
      if (ctx.motivo) return rechaza(req, res, ctx.motivo, 'query');
    }

    if (req.params && typeof req.params === 'object') {
      limpia({ ...req.params }, ctx);
      if (ctx.motivo) return rechaza(req, res, ctx.motivo, 'params');
    }

    next();
  });
}

function rechaza(req, res, motivo, donde) {
  securityLogger.error('Carga maliciosa bloqueada', {
    motivo, donde, ip: req.ip, url: req.originalUrl,
    ua: req.headers['user-agent']
  });
  return res.status(400).json({ error: 'Carga maliciosa detectada.', code: motivo });
}

module.exports = applySanitization;
module.exports.escapaHtml = escapaHtml;
