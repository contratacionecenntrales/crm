/* =============================================================================
   CAPA 1 · Cabeceras de seguridad HTTP (OWASP Secure Headers)
   ========================================================================== */
const helmet = require('helmet');

function configureHelmet(app) {
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        // La API sirve JSON: no necesita permitir scripts de ningun tipo.
        // Si este mismo servidor sirve el panel, cambia scriptSrc por el hash
        // del bloque embebido (lo genera harden.py en el paquete del frontend).
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'self'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // COEP queda desactivado a proposito: rompe la carga de recursos de terceros
    // (pasarelas de pago, mapas) y esta API no usa SharedArrayBuffer.
    crossOriginEmbedderPolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // xssFilter de helmet envia X-XSS-Protection: 0, que es lo correcto hoy:
    // el filtro XSS de los navegadores antiguos introducia vulnerabilidades.
    xssFilter: true
  }));

  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy',
      'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.removeHeader('X-Powered-By');
    next();
  });
}

module.exports = configureHelmet;
