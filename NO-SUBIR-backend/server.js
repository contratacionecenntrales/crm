/* =============================================================================
   LABS COMMAND CENTER 360 · API blindada
   Labs24k · Grupo Evolvix Global SL
   Las capas se aplican en orden: perímetro → cabeceras → tamaño → saneamiento
   → auditoría → límites → sesión → rutas → errores.
   ========================================================================== */
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const configureHelmet = require('./middleware/securityHeaders');
const applySanitization = require('./middleware/sanitizer');
const csrfProtection = require('./middleware/csrf');
const { globalLimiter, authLimiter, recoveryLimiter, writeLimiter } = require('./middleware/rateLimiter');
const { securityLogger, securityAuditMiddleware } = require('./utils/logger');
const { verifySecureToken, exigeRol } = require('./middleware/authMiddleware');
const { verificaTurnstile } = require('./middleware/captcha');
const authRoutes = require('./routes/auth');
const adminUsuarios = require('./routes/admin-users');
const auditoriaRutas = require('./routes/auditoria');
const cuentaRutas = require('./routes/cuenta');

/* --- CAPA 0 · el servidor no arranca con secretos débiles ------------------ */
const DEBILES = ['cambiame_por_un_secreto_largo_y_aleatorio_de_48_bytes',
                 'otro_secreto_distinto_igual_de_largo_y_aleatorio', 'secret', 'changeme'];
for (const clave of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  const v = process.env[clave];
  if (!v || v.length < 32 || DEBILES.includes(v)) {
    console.error(`[ARRANQUE ABORTADO] ${clave} ausente, corto o sin cambiar. ` +
      'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
    process.exit(1);
  }
}
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
  console.error('[ARRANQUE ABORTADO] Los secretos de acceso y refresco deben ser distintos.');
  process.exit(1);
}
/* Sin esto, desplegar sin fijar NODE_ENV=production degrada en silencio las
   cookies de sesión a "secure:false" (utils/tokens.js) y las serviría igual
   por HTTP simple. Que falte una variable de entorno debe romper el arranque,
   no debilitar la sesión sin que nadie se entere. */
if (process.env.NODE_ENV !== 'production' && process.env.PERMITIR_ARRANQUE_NO_PRODUCCION !== 'true') {
  console.error('[ARRANQUE ABORTADO] NODE_ENV no es "production": las cookies de sesión se ' +
    'servirían sin el flag Secure. Fija NODE_ENV=production en el despliegue real, o exporta ' +
    'PERMITIR_ARRANQUE_NO_PRODUCCION=true si esto es a propósito (desarrollo local).');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.disable('etag');

/* --- CAPA 1 · perímetro --------------------------------------------------- */
// Con Cloudflare o Nginx delante: confía solo en el primer salto, no en toda
// la cadena. Sin esto, la IP del rate limiter se puede falsificar con
// X-Forwarded-For y el bloqueo por fuerza bruta deja de servir.
app.set('trust proxy', 1);

/* Solo el panel puede llamar a esta API. app.metatok.ai y hostalia.webmail.es
   son sitios externos a los que se enlaza: nunca originan peticiones aquí,
   por lo que NO deben figurar como orígenes permitidos. */
const ORIGENES = [
  process.env.FRONTEND_ORIGIN,
  process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);              // curl, apps móviles, mismo origen
    if (ORIGENES.includes(origin)) return cb(null, true);
    securityLogger.warn('Origen CORS bloqueado', { origin });
    return cb(null, false);                          // se rechaza sin lanzar error 500
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  maxAge: 600,
  optionsSuccessStatus: 204
}));

/* --- CAPA 2 · cabeceras --------------------------------------------------- */
configureHelmet(app);

/* --- CAPA 3 · tamaño de carga y saneamiento ------------------------------- */
/* Excepción acotada: la foto de perfil viaja como data URI y necesita más
   sitio. Solo esa ruta admite 4 MB; el resto de la API sigue en 32 kB, así que
   ampliar el límite aquí no abre la puerta a cargas grandes en ningún otro
   sitio. El primer analizador que actúa marca el cuerpo como leído y los
   siguientes no vuelven a procesarlo. */
app.put('/api/v1/admin/usuarios/:id/avatar', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(cookieParser());
applySanitization(app);

/* --- CAPA 5 · auditoría --------------------------------------------------- */
app.use(securityAuditMiddleware);

/* --- CAPA 2b · límites de petición ---------------------------------------- */
app.use(globalLimiter);

/* --- Rutas ---------------------------------------------------------------- */
app.get('/api/v1/health', (req, res) => res.json({ ok: true, servicio: 'labs24k-api' }));

app.use('/api/v1/auth/login', authLimiter, verificaTurnstile);
app.use('/api/v1/auth/recuperar', recoveryLimiter, verificaTurnstile);
app.use('/api/v1/auth', authRoutes);

// A partir de aquí: sesión válida + testigo CSRF en toda escritura.
app.use('/api/v1', verifySecureToken, csrfProtection);

/* Alta y gestión de usuarios: exclusivo del administrador. */
app.use('/api/v1/admin/usuarios', writeLimiter, adminUsuarios);

/* Bitácora: consulta para administración y dirección, sin rutas de borrado. */
app.use('/api/v1/admin/auditoria', auditoriaRutas);

/* Cada usuario, sobre su propia cuenta: contraseña y sesiones. */
app.use('/api/v1/cuenta', writeLimiter, cuentaRutas);

app.get('/api/v1/me', (req, res) => {
  res.json({ id: req.user.sub, nombre: req.user.nombre, rol: req.user.rol });
});

/* exp.ver lo tienen los cuatro roles hoy, pero la puerta es el rol explícito,
   no solo "tener sesión": así una futura ampliación (un rol sin exp.ver) no
   hereda acceso por descuido. */
app.get('/api/v1/expedientes',
  exigeRol('admin', 'manager', 'commercial', 'backoffice'),
  (req, res) => res.json({ expedientes: [], nota: 'Conecta aquí tu base de datos.' }));

/* Los hitos y el estado del proyecto solo los tocan Back Office y dirección,
   igual que en el panel. */
app.patch('/api/v1/expedientes/:id/estado',
  writeLimiter, exigeRol('admin', 'manager', 'backoffice'),
  (req, res) => res.json({ ok: true, id: req.params.id, estado: req.body.estado }));

/* Cualquier otra ruta de registro que alguien pruebe a ciegas. */
app.all(/^\/(register|signup|registro|alta|crear-cuenta)$/, (req, res) => {
  securityLogger.warn('Intento de registro en la raíz', { url: req.originalUrl, ip: req.ip });
  res.status(403).json({ error: 'El registro está deshabilitado.', code: 'REGISTRO_DESHABILITADO' });
});

/* --- 404 ------------------------------------------------------------------ */
app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado.', code: 'NO_ENCONTRADO' }));

/* --- Errores: nunca se filtra la traza al cliente ------------------------- */
app.use((err, req, res, next) => {
  const ref = Math.random().toString(36).slice(2, 10);
  securityLogger.error('Excepción no controlada', {
    ref, mensaje: err.message, stack: err.stack, url: req.originalUrl, ip: req.ip
  });
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Carga demasiado grande.', code: 'CARGA_EXCESIVA' });
  }
  res.status(500).json({ error: 'Error interno del servidor.',
                         code: 'EXCEPCION_INTERNA', referencia: ref });
});

/* --- Arranque ------------------------------------------------------------- */
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  securityLogger.info('Servidor iniciado', { puerto: PORT, entorno: process.env.NODE_ENV });
  console.log(`[LABS24K] API blindada escuchando en el puerto ${PORT}`);
});

process.on('unhandledRejection', r => securityLogger.error('Promesa no gestionada', { motivo: String(r) }));
process.on('uncaughtException', e => {
  securityLogger.error('Excepción no capturada', { mensaje: e.message, stack: e.stack });
  server.close(() => process.exit(1));
});

module.exports = app;
