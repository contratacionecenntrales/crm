/* =============================================================================
   BITÁCORA DE AUDITORÍA · consulta
   Solo administración y dirección. No existe ninguna ruta para borrar apuntes:
   la bitácora es de solo lectura desde la API, a propósito.
   ========================================================================== */
const express = require('express');
const { exigeRol } = require('../middleware/authMiddleware');
const { AUDITORIA } = require('../utils/auditoria');

const router = express.Router();
router.use(exigeRol('admin', 'manager'));

router.get('/', (req, res) => {
  const { usuario, accion } = req.query;
  const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
  let lista = AUDITORIA;
  if (usuario) lista = lista.filter(a => a.destinoId === usuario || a.actorId === usuario);
  if (accion)  lista = lista.filter(a => a.accion.toLowerCase().includes(String(accion).toLowerCase()));
  res.json({ total: lista.length, apuntes: lista.slice(0, limite) });
});

/* Cualquier intento de alterar la bitácora queda a su vez registrado. */
['delete', 'patch', 'put', 'post'].forEach(m => {
  router[m]('*', (req, res) => {
    res.status(405).json({ error: 'La bitácora de auditoría no se puede modificar.',
                           code: 'AUDITORIA_INMUTABLE' });
  });
});

module.exports = router;
