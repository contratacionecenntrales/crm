/* =============================================================================
   CIFRADO DE CONTRASEÑAS · Argon2id con bcrypt de respaldo

   Nunca se guarda una contraseña en claro. Solo el hash, y siempre pasando por
   aquí: ningún otro fichero llama directamente a bcrypt.

   Argon2id es el algoritmo recomendado hoy (ganador del Password Hashing
   Competition, y el que aconseja OWASP): endurece contra GPU y ASIC porque
   además de tiempo exige memoria. Su paquete se compila de forma nativa y no
   siempre está disponible en un hosting compartido, así que se carga de manera
   opcional: si está, se usa; si no, se cae a bcrypt con coste alto, que sigue
   siendo perfectamente aceptable.

   Los hashes viven mezclados sin problema: el prefijo dice cuál es cuál
   ($argon2id$… o $2a$/$2b$…). Cuando alguien entra con un hash del algoritmo
   antiguo y el nuevo está disponible, se recicla en silencio en ese momento,
   que es el único instante en que existe la contraseña en claro.

   Para instalar Argon2id:  npm install argon2
   ========================================================================== */
const bcrypt = require('bcryptjs');

let argon2 = null;
try { argon2 = require('argon2'); } catch (_) { /* no instalado: se usa bcrypt */ }

/* Coste de bcrypt. 13 ≈ 0,4 s por comprobación en un servidor modesto: caro
   para quien prueba millones de contraseñas, imperceptible al entrar. */
const COSTE_BCRYPT = 13;

/* Parámetros de Argon2id según la guía de OWASP: 19 MiB de memoria,
   2 iteraciones y 1 hilo. */
const ARGON = { type: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };

const algoritmo = argon2 ? 'argon2id' : `bcrypt (coste ${COSTE_BCRYPT})`;

async function cifra(clave) {
  if (typeof clave !== 'string' || !clave) throw new Error('Contraseña vacía');
  if (argon2) return argon2.hash(clave, ARGON);
  return bcrypt.hash(clave, COSTE_BCRYPT);
}

/* Versión síncrona: solo para la semilla inicial, antes de aceptar peticiones.
   Siempre bcrypt, porque Argon2 no ofrece API síncrona. Al primer acceso
   correcto el hash se recicla a Argon2id si el paquete está instalado. */
function cifraSync(clave) {
  return bcrypt.hashSync(clave, COSTE_BCRYPT);
}

async function verifica(clave, hash) {
  if (typeof clave !== 'string' || typeof hash !== 'string' || !hash) return false;
  try {
    if (hash.startsWith('$argon2')) {
      if (!argon2) return false;            // hash Argon2 sin el paquete: no se puede comprobar
      return await argon2.verify(hash, clave);
    }
    return await bcrypt.compare(clave, hash);
  } catch (_) {
    return false;                            // hash corrupto: se trata como fallo, nunca como acierto
  }
}

/* ¿Conviene volver a cifrar este hash con el algoritmo actual? */
function necesitaReciclado(hash) {
  if (typeof hash !== 'string') return false;
  if (argon2) return !hash.startsWith('$argon2');
  const m = /^\$2[aby]\$(\d{2})\$/.exec(hash);
  return !!m && parseInt(m[1], 10) < COSTE_BCRYPT;
}

/* Comprobación de tiempo constante para el señuelo del login. */
const HASH_SENUELO = cifraSync('senuelo-de-tiempo-constante-labs24k');

module.exports = { cifra, cifraSync, verifica, necesitaReciclado,
                   algoritmo, HASH_SENUELO, COSTE_BCRYPT };
