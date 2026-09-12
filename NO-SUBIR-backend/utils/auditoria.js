/* =============================================================================
   BITÁCORA DE AUDITORÍA
   Quién modificó a quién, qué cambió y cuándo. Cada apunte se escribe además
   en el registro de seguridad (winston), que es el que debe conservarse fuera
   de la aplicación: un array en memoria se pierde al reiniciar el proceso y
   cualquiera con acceso al servidor podría alterarlo.
   En producción: tabla append-only, sin UPDATE ni DELETE para el rol de la API.
   ========================================================================== */
const crypto = require('crypto');
const { securityLogger } = require('./logger');

const AUDITORIA = [];
const MAX = 2000;

function auditar(req, { destino, accion, detalle, datos }) {
  const apunte = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    actorId: req.user ? req.user.sub : null,
    actorNombre: req.user ? req.user.nombre : 'sistema',
    actorRol: req.user ? req.user.rol : null,
    destinoId: destino ? destino.id : null,
    destinoNombre: destino ? `${destino.nombre} ${destino.apellidos || ''}`.trim() : null,
    accion,
    detalle: detalle || '',
    ip: req.ip,
    ua: String(req.headers['user-agent'] || '').slice(0, 180)
  };
  AUDITORIA.unshift(apunte);
  if (AUDITORIA.length > MAX) AUDITORIA.length = MAX;

  securityLogger.info('AUDITORÍA · ' + accion, { ...apunte, ...(datos || {}) });
  return apunte;
}

/* Compara dos versiones de la ficha y devuelve la lista de cambios en texto.
   Nunca incluye contraseñas ni hashes: solo el hecho de que han cambiado. */
function difUsuario(antes, ahora) {
  const c = [];
  const campos = [['nombre','nombre'], ['apellidos','apellidos'], ['email','correo'],
                  ['prefijo','prefijo'], ['telefono','teléfono'], ['extension','extensión'],
                  ['rol','rol'], ['estado','estado']];
  campos.forEach(([k, etiqueta]) => {
    if (antes[k] !== ahora[k]) c.push(`${etiqueta}: «${antes[k] || '—'}» → «${ahora[k] || '—'}»`);
  });
  if (antes.google !== ahora.google) c.push(ahora.google ? 'Google autorizado' : 'Google revocado');
  if (antes.dobleFactor !== ahora.dobleFactor)
    c.push(ahora.dobleFactor ? 'doble factor activado' : 'doble factor desactivado');
  if (antes.avatarUrl !== ahora.avatarUrl) c.push('foto de perfil actualizada');

  const dif = Object.keys(ahora.permisos || {})
    .filter(k => !!(antes.permisos || {})[k] !== !!ahora.permisos[k]);
  if (dif.length) c.push('permisos: ' + dif.join(', '));

  if (JSON.stringify(antes.preferencias) !== JSON.stringify(ahora.preferencias))
    c.push('preferencias de llamadas, disponibilidad, calendario o notificaciones');
  return c;
}

module.exports = { AUDITORIA, auditar, difUsuario };
