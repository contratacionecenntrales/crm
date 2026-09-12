/* =============================================================================
   Modelo de usuario. Sustituir el array por la tabla de la base de datos:
   lo único que debe persistirse de la contraseña es su hash (utils/clave.js).

   Esquema:
     id            UUID v4
     nombre, apellidos
     email         único, validado
     prefijo+telefono (formato internacional) y extension
     hash          Argon2id, o bcrypt de coste alto si Argon2 no está
                   instalado. NUNCA sale de este proceso.
     raiz          marca del Super Administrador de raíz: cuenta única,
                   permanente y con todos los permisos.
     avatarUrl     data URI o ruta del objeto en el almacén de imágenes
     rol           admin | manager | commercial | backoffice
     estado        Activo | Suspendido | Dado de baja
     google        lista blanca de acceso federado
     rel           identificador interno único (n.º de relación)
     permisos      matriz granular; parte de los del rol y admite excepciones
     preferencias  llamadas, disponibilidad, calendario y notificaciones
     apiToken      token de integración, rotable
     dobleFactor   verificación en dos pasos
     debeCambiar   fuerza el cambio de contraseña en el próximo acceso
     ultimo        marca de tiempo ISO del último acceso
   ========================================================================== */
const crypto = require('crypto');
const { cifraSync } = require('./clave');

const ROLES  = ['admin', 'manager', 'commercial', 'backoffice'];
const ESTADOS = ['Activo', 'Suspendido', 'Dado de baja'];

/* Catálogo de permisos: idéntico al del panel. Cualquier clave fuera de esta
   lista se rechaza, para que nadie invente permisos por la vía del JSON. */
const PERMISOS = [
  'presu.ver','presu.crear','presu.dto','funnel.ver',
  'exp.ver','exp.estado','exp.hitos','exp.docs','exp.borrar',
  'hr.ver','hr.mover','hr.contratar',
  'com.llamadas','com.wsp','com.plant',
  'sys.config','sys.usuarios','sys.audit'
];
const PERM_ROL = {
  admin: PERMISOS,
  manager: ['presu.ver','presu.crear','presu.dto','funnel.ver','exp.ver','exp.estado','exp.hitos',
            'exp.docs','hr.ver','hr.mover','hr.contratar','com.llamadas','com.wsp','com.plant','sys.audit'],
  commercial: ['presu.ver','presu.crear','funnel.ver','exp.ver','exp.docs','com.llamadas','com.wsp'],
  backoffice: ['exp.ver','exp.estado','exp.hitos','exp.docs','exp.borrar','presu.ver','com.llamadas']
};
function permisosDeRol(rol){
  const base = PERM_ROL[rol] || [];
  const o = {};
  PERMISOS.forEach(k => { o[k] = base.includes(k); });
  return o;
}

function nuevoRelacion(){
  const a = 100 + crypto.randomInt(900), b = 100 + crypto.randomInt(900);
  return `0-${a}-${b}`;
}

/* Contraseña aleatoria que ya cumple la política corporativa. */
function claveAleatoria(){
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ', min = 'abcdefghijkmnopqrstuvwxyz',
        num = '23456789', sig = '!@#$%&*';
  const r = s => s.charAt(crypto.randomInt(s.length));
  const base = [r(may), r(may), r(min), r(min), r(min), r(min), r(num), r(num), r(sig), r(sig), r(min), r(num)];
  for (let i = base.length - 1; i > 0; i--) {          // barajado Fisher-Yates
    const j = crypto.randomInt(i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}

/* Política corporativa. Devuelve la lista de requisitos que faltan: vacía = correcta. */
const CLAVE_MIN = 10;
function revisaClave(p, usuario){
  const f = [];
  if (typeof p !== 'string' || p.length < CLAVE_MIN) f.push(`al menos ${CLAVE_MIN} caracteres`);
  if (typeof p !== 'string') return f;
  if (p.length > 200)          f.push('un máximo de 200 caracteres');
  if (!/[A-ZÁÉÍÓÚÑ]/.test(p))  f.push('una mayúscula');
  if (!/[a-záéíóúñ]/.test(p))  f.push('una minúscula');
  if (!/[0-9]/.test(p))        f.push('un número');
  if (!/[^A-Za-z0-9]/.test(p)) f.push('un símbolo');
  if (/(.)\1{3,}/.test(p))     f.push('no repetir el mismo carácter cuatro veces');
  if (usuario) {
    const partes = [usuario.email ? usuario.email.split('@')[0] : '', usuario.nombre, usuario.apellidos]
      .filter(x => x && x.length > 2).map(x => x.toLowerCase());
    if (partes.some(x => p.toLowerCase().includes(x))) f.push('no contener su nombre ni su correo');
  }
  return f;
}

function apiToken(){ return 'lk_' + crypto.randomBytes(21).toString('base64url'); }

function preferenciasPorDefecto(){
  return {
    llamadas: { extension:'', desvio:'', grabar:true, buzon:true,
                saludo:'Has llamado a Labs24k. Deja tu mensaje y te devolvemos la llamada.' },
    disponibilidad: { dias:{L:true,M:true,X:true,J:true,V:true,S:false,D:false},
                      desde:'09:00', hasta:'18:00', zona:'Europe/Madrid' },
    calendario: { duracion:30, margen:10, antelacion:4, enlace:'' },
    notificaciones: { correo:true, push:true, whatsapp:false,
                      resumen:true, altas:true, incidencias:true }
  };
}

/* =============================================================================
   SUPER ADMINISTRADOR DE RAÍZ
   Una única cuenta, creada por código en el arranque, nunca por el panel.
   No se elimina, no se bloquea, no se le cambia el correo ni el rol, y sus
   permisos son siempre todos. Lo garantiza el servidor, no la interfaz.

   Sobre la dirección: el correo se pidió como «JÁlvarez@labs24k.com», con
   tilde. Las direcciones con caracteres fuera de ASCII en la parte local
   necesitan SMTPUTF8, que muchos servidores de correo —Hostalia entre ellos—
   no admiten, así que la identidad canónica se guarda SIN tilde y la versión
   con tilde queda como alias: quien escriba cualquiera de las dos entra en la
   misma cuenta. Si algún día el buzón admite UTF-8, basta con intercambiarlas.
   ========================================================================== */
const RAIZ_EMAIL  = 'jalvarez@labs24k.com';
const RAIZ_ALIAS  = ['jálvarez@labs24k.com', 'j.alvarez@labs24k.com',
                     'juan.alvarez@labs24k.com', 'admin@labs24k.com'];
/* Contraseña de arranque. Es la que se pidió; se guarda solo su hash y la
   cuenta nace con debeCambiar=true para forzar el relevo en el primer acceso.
   Ver el aviso del README: esta frase no cumple la política corporativa. */
const RAIZ_CLAVE_INICIAL = 'CAMBIA-ESTA-CLAVE-ANTES-DE-DESPLEGAR';

function normalizaEmail(e){
  const t = String(e || '').trim().toLowerCase();
  return RAIZ_ALIAS.includes(t) ? RAIZ_EMAIL : t;
}
function esRaiz(u){ return !!u && u.raiz === true; }

const USUARIOS = [
  { id: 'root-labs24k', raiz: true,
    nombre: 'Juan', apellidos: 'Álvarez', email: RAIZ_EMAIL,
    prefijo: '+34', telefono: '600 112 233', extension: '101',
    rol: 'admin', rolRaiz: 'SYSTEM_ADMIN_ROOT', rel: '0-413-936',
    hash: cifraSync(RAIZ_CLAVE_INICIAL),
    avatarUrl: null, google: true, estado: 'Activo',
    debeCambiar: true,                       // el relevo de la clave inicial es obligatorio
    dobleFactor: true,
    permisos: permisosDeRol('admin'),        // todos, y el servidor los reimpone en cada guardado
    preferencias: preferenciasPorDefecto(),
    apiToken: apiToken(), alta: '2026-01-12', ultimo: null }
];

/* Vista pública: el hash y el token nunca salen en los listados. */
function publico(u, conToken){
  return {
    id: u.id, raiz: u.raiz === true, rolRaiz: u.rolRaiz,
    nombre: u.nombre, apellidos: u.apellidos, email: u.email,
    prefijo: u.prefijo, telefono: u.telefono, extension: u.extension,
    rol: u.rol, rel: u.rel, avatarUrl: u.avatarUrl, google: u.google,
    estado: u.estado, debeCambiar: u.debeCambiar, dobleFactor: u.dobleFactor,
    permisos: u.permisos, preferencias: u.preferencias,
    alta: u.alta, ultimo: u.ultimo,
    apiToken: conToken ? u.apiToken : undefined
  };
}

module.exports = { USUARIOS, ROLES, ESTADOS, PERMISOS, PERM_ROL, permisosDeRol,
                   nuevoRelacion, claveAleatoria, revisaClave, CLAVE_MIN,
                   apiToken, preferenciasPorDefecto, publico,
                   RAIZ_EMAIL, RAIZ_ALIAS, RAIZ_CLAVE_INICIAL, normalizaEmail, esRaiz };
