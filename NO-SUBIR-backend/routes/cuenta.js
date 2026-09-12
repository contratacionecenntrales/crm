/* =============================================================================
   LA PROPIA CUENTA · lo que cada usuario puede hacer consigo mismo
   Cambiar su contraseña, ver su ficha y cerrar sus sesiones. Nada más:
   el rol, el estado y los permisos solo los toca un administrador.
   ========================================================================== */
const express = require('express');
const { cifra, verifica } = require('../utils/clave');
const { USUARIOS, revisaClave, publico } = require('../utils/usuarios');
const { auditar } = require('../utils/auditoria');
const { securityLogger } = require('../utils/logger');

const router = express.Router();

function yo(req){ return USUARIOS.find(u => u.id === req.user.sub); }

router.get('/', (req, res) => {
  const u = yo(req);
  if (!u) return res.status(404).json({ error: 'Cuenta no encontrada.', code: 'NO_ENCONTRADO' });
  res.json({ usuario: publico(u, true), sesiones: u.sesiones || [] });
});

/* Cambio de contraseña: exige la actual, aunque haya sesión válida. */
router.post('/password', async (req, res) => {
  const u = yo(req);
  if (!u) return res.status(404).json({ error: 'Cuenta no encontrada.', code: 'NO_ENCONTRADO' });

  const { actual, nueva } = req.body || {};
  if (typeof actual !== 'string' || typeof nueva !== 'string') {
    return res.status(400).json({ error: 'Faltan datos.', code: 'DATOS_INVALIDOS' });
  }
  const ok = await verifica(actual, u.hash);
  if (!ok) {
    securityLogger.warn('Cambio de contraseña con clave actual incorrecta', { usuario: u.id, ip: req.ip });
    return res.status(401).json({ error: 'La contraseña actual no es correcta.', code: 'CREDENCIALES' });
  }
  const faltan = revisaClave(nueva, u);
  if (faltan.length) {
    return res.status(400).json({ error: 'La nueva contraseña necesita ' + faltan.join(', ') + '.',
                                  code: 'CLAVE_DEBIL', faltan });
  }
  if (await verifica(nueva, u.hash)) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.',
                                  code: 'CLAVE_REPETIDA' });
  }

  u.hash = await cifra(nueva);
  u.debeCambiar = false;
  auditar(req, { destino: u, accion: 'Contraseña cambiada por el propio usuario' });
  res.json({ ok: true });
});

router.delete('/sesiones', (req, res) => {
  const u = yo(req);
  if (!u) return res.status(404).json({ error: 'Cuenta no encontrada.', code: 'NO_ENCONTRADO' });
  const n = (u.sesiones || []).length;
  u.sesiones = [];
  auditar(req, { destino: u, accion: 'Cierre de todas sus sesiones', detalle: n + ' sesión(es)' });
  res.json({ ok: true, cerradas: n });
});

module.exports = router;
