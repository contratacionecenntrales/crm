/* =============================================================================
   Bloqueo de cuenta por fuerza bruta, independiente de la IP de origen.
   authLimiter (middleware/rateLimiter.js) frena por IP: cinco intentos por
   hora desde la misma dirección. Eso no protege una cuenta concreta de un
   atacante que reparte los intentos entre varias IP o las va rotando. Este
   módulo lleva la cuenta por correo, no por IP, y se reinicia en memoria como
   el resto del prototipo (ver README, "lo que todavía falta para producción").
   ========================================================================== */
const INTENTOS_MAX = 7;
const VENTANA_MS   = 15 * 60 * 1000;   // cuentan los fallos de los últimos 15 min
const BLOQUEO_MS   = 15 * 60 * 1000;   // y el bloqueo dura otros 15 min

const estado = new Map();   // email normalizado -> { fallos: number[], bloqueadoHasta: number|null }

function registro(email){
  let r = estado.get(email);
  if (!r) { r = { fallos: [], bloqueadoHasta: null }; estado.set(email, r); }
  return r;
}

function estaBloqueada(email){
  const r = estado.get(email);
  if (!r || !r.bloqueadoHasta) return 0;
  const restante = r.bloqueadoHasta - Date.now();
  if (restante <= 0) { r.bloqueadoHasta = null; r.fallos = []; return 0; }
  return restante;
}

function marcaFallo(email){
  const r = registro(email);
  const ahora = Date.now();
  r.fallos = r.fallos.filter(ts => ahora - ts < VENTANA_MS);
  r.fallos.push(ahora);
  if (r.fallos.length >= INTENTOS_MAX) {
    r.bloqueadoHasta = ahora + BLOQUEO_MS;
  }
}

function marcaExito(email){
  estado.delete(email);
}

module.exports = { estaBloqueada, marcaFallo, marcaExito, INTENTOS_MAX };
