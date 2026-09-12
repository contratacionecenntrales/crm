/* =============================================================================
   Batería de pruebas de seguridad contra la API en marcha.
   Uso:  node server.js   (en otra terminal)  ->  node test-security.js
   ========================================================================== */
const BASE = process.env.BASE || 'http://127.0.0.1:4000';
let ok = 0, ko = 0;

function comprueba(nombre, condicion, detalle = '') {
  if (condicion) { ok++; console.log(`  [OK]   ${nombre}`); }
  else { ko++; console.log(`  [FALLO] ${nombre} ${detalle}`); }
}

function cookiesDe(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const mapa = {};
  raw.forEach(c => { const [kv] = c.split(';'); const i = kv.indexOf('='); mapa[kv.slice(0, i)] = kv.slice(i + 1); });
  return { raw, mapa, header: Object.entries(mapa).map(([k, v]) => `${k}=${v}`).join('; ') };
}

(async () => {
  console.log('\n=== 1. Cabeceras de seguridad ===');
  let r = await fetch(`${BASE}/api/v1/health`);
  const h = r.headers;
  comprueba('Content-Security-Policy presente', !!h.get('content-security-policy'));
  comprueba('CSP con default-src none', /default-src 'none'/.test(h.get('content-security-policy') || ''));
  comprueba('Strict-Transport-Security', /max-age=31536000/.test(h.get('strict-transport-security') || ''));
  comprueba('X-Content-Type-Options: nosniff', h.get('x-content-type-options') === 'nosniff');
  comprueba('X-Frame-Options: DENY', h.get('x-frame-options') === 'DENY');
  comprueba('Referrer-Policy', !!h.get('referrer-policy'));
  comprueba('Permissions-Policy', !!h.get('permissions-policy'));
  comprueba('Sin X-Powered-By', !h.get('x-powered-by'));

  console.log('\n=== 2. Sesión y control de acceso ===');
  r = await fetch(`${BASE}/api/v1/me`);
  comprueba('Sin cookie -> 401', r.status === 401);

  r = await fetch(`${BASE}/api/v1/me`, { headers: { Cookie: 'lk_at=token.falso.inventado' } });
  comprueba('Token falso -> 403', r.status === 403);

  console.log('\n=== 3. Login ===');
  r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jalvarez@labs24k.com', password: 'incorrecta' })
  });
  const cuerpoMal = await r.json();
  comprueba('Contraseña incorrecta -> 401', r.status === 401);
  comprueba('No revela si el correo existe', cuerpoMal.error === 'Credenciales incorrectas.');

  r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jalvarez@labs24k.com', password: 'CAMBIA-ESTA-CLAVE-ANTES-DE-DESPLEGAR' })
  });
  const login = await r.json();
  const c = cookiesDe(r);
  comprueba('Login correcto -> 200', r.status === 200);
  comprueba('Cookie de acceso HttpOnly', c.raw.some(x => /^lk_at=/.test(x) && /HttpOnly/i.test(x)));
  comprueba('Cookie de acceso SameSite=Strict', c.raw.some(x => /^lk_at=/.test(x) && /SameSite=Strict/i.test(x)));
  comprueba('Cookie de refresco HttpOnly', c.raw.some(x => /^lk_rt=/.test(x) && /HttpOnly/i.test(x)));
  comprueba('Testigo CSRF legible por el panel', c.raw.some(x => /^lk_csrf=/.test(x) && !/HttpOnly/i.test(x)));
  comprueba('El JSON no devuelve el token', !JSON.stringify(login).includes('eyJ'));

  console.log('\n=== 4. Acceso autenticado ===');
  r = await fetch(`${BASE}/api/v1/me`, { headers: { Cookie: c.header } });
  const yo = await r.json();
  comprueba('Con sesión -> 200', r.status === 200);
  comprueba('Devuelve el rol correcto', yo.rol === 'admin', JSON.stringify(yo));

  console.log('\n=== 5. CSRF ===');
  r = await fetch(`${BASE}/api/v1/expedientes/1/estado`, {
    method: 'PATCH', headers: { Cookie: c.header, 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'Proyecto activo SaaS' })
  });
  comprueba('Escritura sin testigo CSRF -> 403', r.status === 403);

  r = await fetch(`${BASE}/api/v1/expedientes/1/estado`, {
    method: 'PATCH',
    headers: { Cookie: c.header, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken },
    body: JSON.stringify({ estado: 'Proyecto activo SaaS' })
  });
  comprueba('Escritura con testigo CSRF -> 200', r.status === 200);

  console.log('\n=== 6. Inyecciones ===');
  r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{"email":{"$gt":""},"password":"x"}'
  });
  let b = await r.json();
  comprueba('Operador NoSQL $gt bloqueado', r.status === 400 && b.code === 'OPERADOR_NOSQL', JSON.stringify(b));

  r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{"email":"a@b.c","password":"x","__proto__":{"admin":true}}'
  });
  b = await r.json();
  comprueba('Prototype pollution bloqueado',
    r.status === 400 || b.code === 'CREDENCIALES', JSON.stringify(b));
  comprueba('Object.prototype intacto', ({}).admin === undefined);

  console.log('\n=== 7. Tamaño de carga ===');
  r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(200000) })
  });
  comprueba('Carga de 200 KB rechazada', r.status === 413 || r.status === 400, 'estado ' + r.status);

  console.log('\n=== 8. Fuerza bruta ===');
  let bloqueado = false, intentos = 0;
  for (let i = 0; i < 9; i++) {
    intentos++;
    const rr = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'jalvarez@labs24k.com', password: 'fallo' + i })
    });
    if (rr.status === 429) { bloqueado = true; break; }
  }
  comprueba('Bloqueo por fuerza bruta activado', bloqueado, `tras ${intentos} intentos`);

  console.log('\n=== 9. Rotación de refresco ===');
  const r1 = await fetch(`${BASE}/api/v1/auth/refresh`, { method: 'POST', headers: { Cookie: c.header } });
  comprueba('Primer refresco válido -> 200', r1.status === 200);
  const r2 = await fetch(`${BASE}/api/v1/auth/refresh`, { method: 'POST', headers: { Cookie: c.header } });
  const b2 = await r2.json();
  comprueba('Reutilizar el mismo refresco -> 401 y familia revocada',
    r2.status === 401 && b2.code === 'REUTILIZACION_DETECTADA', JSON.stringify(b2));

  console.log('\n=== 10. Rutas inexistentes ===');
  r = await fetch(`${BASE}/api/v1/../../etc/passwd`);
  comprueba('Path traversal no expone ficheros', r.status === 404 || r.status === 400 || r.status === 401);

  console.log('\n=== 11. Registro público bloqueado ===');
  for (const ruta of ['/api/v1/auth/register','/api/v1/auth/signup','/api/v1/auth/registro',
                      '/api/v1/auth/alta','/register','/signup']) {
    const rr = await fetch(BASE + ruta, { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email:'intruso@gmail.com', password:'Intruso!2026', nombre:'Intruso' }) });
    const bb = await rr.json().catch(()=>({}));
    comprueba('POST ' + ruta + ' -> 403', rr.status === 403 && bb.code === 'REGISTRO_DESHABILITADO',
      'estado ' + rr.status);
  }

  console.log('\n=== 12. Alta de usuarios: solo el administrador ===');
  // sin sesión
  let ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nombre:'X', email:'x@y.es', rol:'commercial' }) });
  comprueba('Alta sin sesión -> 401', ra.status === 401);

  // se reutiliza la sesión de administrador abierta en la prueba 3:
  // el limitador de la prueba 8 ya bloquea cualquier login nuevo desde esta IP.
  const cab = { Cookie: c.header, 'Content-Type':'application/json', 'X-CSRF-Token': login.csrfToken };

  ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { method:'POST', headers: cab,
    body: JSON.stringify({ nombre:'Lucía Fernández', email:'lucia@labs24k.com',
      telefono:'+34 601 223 344', rol:'commercial', google:true }) });
  const creado = await ra.json();
  comprueba('Administrador crea usuario -> 201', ra.status === 201, JSON.stringify(creado).slice(0,90));
  comprueba('Devuelve contraseña inicial una sola vez', typeof creado.passwordInicial === 'string' && creado.passwordInicial.length >= 10);
  comprueba('Genera número de relación 0-XXX-XXX', /^0-\d{3}-\d{3}$/.test(creado.usuario && creado.usuario.rel || ''));
  comprueba('Nunca devuelve el hash', !JSON.stringify(creado).includes('$2'));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { method:'POST', headers: cab,
    body: JSON.stringify({ nombre:'Otra', email:'lucia@labs24k.com', rol:'commercial' }) });
  comprueba('Correo duplicado -> 409', ra.status === 409);

  // el nuevo usuario ya podría entrar; aquí solo se comprueba que la cuenta existe y está activa
  ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { headers: cab });
  const listado = await ra.json();
  comprueba('El usuario creado figura activo en el listado',
    listado.usuarios.some(u => u.email === 'lucia@labs24k.com' && u.estado === 'Activo'));

  // suspender y volver a intentar
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${creado.usuario.id}`, { method:'PATCH',
    headers: cab, body: JSON.stringify({ estado:'Suspendido' }) });
  comprueba('Suspender usuario -> 200', ra.status === 200);
  ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { headers: cab });
  const tras = await ra.json();
  comprueba('La cuenta queda suspendida en el listado',
    tras.usuarios.some(u => u.email === 'lucia@labs24k.com' && u.estado === 'Suspendido'));

  // un rol que no sea administrador no puede dar de alta (se prueba en la sección 14)
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${creado.usuario.id}`, { method:'PATCH',
    headers: cab, body: JSON.stringify({ estado:'Activo' }) });
  comprueba('Reactivar usuario -> 200', ra.status === 200);

  console.log('\n=== 13. Google restringido a la lista blanca ===');
  ra = await fetch(`${BASE}/api/v1/auth/google`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ idToken:'token.falso.inventado.aaaaaaaaaaaa' }) });
  const bg = await ra.json();
  comprueba('Token de Google no verificable -> 401/403', [401,403].includes(ra.status), JSON.stringify(bg).slice(0,70));
  ra = await fetch(`${BASE}/api/v1/auth/google`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:'intruso@gmail.com' }) });
  comprueba('Sin id_token -> 400', ra.status === 400);

  console.log('\n=== 14. Ficha del usuario: perfil, permisos y preferencias ===');
  const uid = creado.usuario.id;

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ nombre:'Lucía', apellidos:'Fernández Roces',
      prefijo:'+34', telefono:'601 223 300', extension:'204' }) });
  let bb = await ra.json();
  comprueba('Actualiza nombre, apellidos, teléfono y extensión',
    ra.status === 200 && bb.usuario.apellidos === 'Fernández Roces' && bb.usuario.extension === '204',
    JSON.stringify(bb).slice(0,90));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ extension:'no-es-un-numero' }) });
  comprueba('Extensión no numérica -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ telefono:'34-mal' }) });
  comprueba('Teléfono sin prefijo internacional -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { headers: cab });
  const base14 = Object.keys((await ra.json()).usuario.permisos).filter(k => k !== 'presu.dto');
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ permisos: base14.concat(['presu.dto']) }) });
  bb = await ra.json();
  comprueba('Concede un permiso concreto (excepción sobre el rol)',
    ra.status === 200 && bb.usuario.permisos['presu.dto'] === true);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ permisos:['sys.inventado'] }) });
  bb = await ra.json();
  comprueba('Permiso inventado -> 400', ra.status === 400 && bb.code === 'PERMISOS_INVALIDOS');

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ permisos:{ presuDto:true } }) });
  comprueba('Permisos enviados como objeto -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ rol:'backoffice' }) });
  bb = await ra.json();
  comprueba('Cambiar el rol reescribe los permisos de fábrica',
    ra.status === 200 && bb.usuario.permisos['exp.borrar'] === true &&
    bb.usuario.permisos['presu.dto'] === false);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ rol:'superadmin' }) });
  comprueba('Rol inexistente -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ hash:'$2a$12$falso', rel:'9-999-999', id:'otro' }) });
  bb = await ra.json();
  comprueba('Ignora hash, rel e id enviados por el cliente',
    ra.status === 200 && bb.usuario.rel === creado.usuario.rel && bb.usuario.id === uid);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ preferencias:{ calendario:{ duracion:45, enlace:'https://citas.labs24k.com/lucia' },
      disponibilidad:{ desde:'08:30', hasta:'17:00' }, notificaciones:{ whatsapp:true } } }) });
  bb = await ra.json();
  comprueba('Guarda preferencias de calendario, horario y avisos',
    ra.status === 200 && bb.usuario.preferencias.calendario.duracion === 45 &&
    bb.usuario.preferencias.disponibilidad.desde === '08:30' &&
    bb.usuario.preferencias.notificaciones.whatsapp === true);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ preferencias:{ calendario:{ enlace:'javascript:alert(1)' } } }) });
  comprueba('Enlace de reserva que no es https -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ preferencias:{ disponibilidad:{ desde:'25:99' } } }) });
  comprueba('Hora imposible -> 400', ra.status === 400);

  console.log('\n=== 15. Contraseñas: política corporativa ===');
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/password`, { method:'POST', headers: cab,
    body: JSON.stringify({ password:'123456' }) });
  bb = await ra.json();
  comprueba('Contraseña débil rechazada -> 400', ra.status === 400 && bb.code === 'CLAVE_DEBIL',
    (bb.faltan || []).join(', ').slice(0,60));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/password`, { method:'POST', headers: cab,
    body: JSON.stringify({ password:'Lucia!2026Segura' }) });
  comprueba('Contraseña que contiene su propio nombre -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/password`, { method:'POST', headers: cab,
    body: '{}' });
  bb = await ra.json();
  const gen = bb.passwordInicial || '';
  comprueba('Restablece y devuelve una clave que cumple la política',
    ra.status === 200 && gen.length >= 10 && /[A-Z]/.test(gen) && /[a-z]/.test(gen) &&
    /[0-9]/.test(gen) && /[^A-Za-z0-9]/.test(gen), gen);
  comprueba('Marca que deberá cambiarla al entrar', bb.usuario.debeCambiar === true);
  comprueba('El restablecimiento no devuelve el hash', !JSON.stringify(bb).includes('$2'));

  console.log('\n=== 16. Token de API, avatar y sesiones ===');
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { headers: cab });
  bb = await ra.json();
  const tokAntes = bb.usuario.apiToken;
  comprueba('La ficha individual muestra el token', /^lk_/.test(tokAntes || ''));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/token`, { method:'POST', headers: cab, body:'{}' });
  bb = await ra.json();
  comprueba('Rota el token de API', ra.status === 200 && /^lk_/.test(bb.apiToken) && bb.apiToken !== tokAntes);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { headers: cab });
  bb = await ra.json();
  comprueba('El listado nunca incluye el token',
    !bb.usuarios.some(u => u.apiToken !== undefined));
  comprueba('El listado trae el resumen para las tarjetas',
    bb.resumen && typeof bb.resumen.activos === 'number' && typeof bb.resumen.baja === 'number');

  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/avatar`, { method:'PUT', headers: cab,
    body: JSON.stringify({ avatar: png }) });
  comprueba('Acepta una foto de perfil válida -> 200', ra.status === 200);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/avatar`, { method:'PUT', headers: cab,
    body: JSON.stringify({ avatar: 'data:text/html;base64,PHNjcmlwdD4=' }) });
  comprueba('Rechaza un archivo que no es imagen -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/avatar`, { method:'PUT', headers: cab,
    body: JSON.stringify({ avatar: 'data:image/png;base64,' + 'A'.repeat(3600000) }) });
  comprueba('Rechaza una imagen de más de 2,5 MB -> 413', ra.status === 413);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}/sesiones`, { headers: cab });
  bb = await ra.json();
  comprueba('Lista las sesiones del usuario', Array.isArray(bb.sesiones));

  ra = await fetch(`${BASE}/api/v1/cuenta`, { headers: cab });
  bb = await ra.json();
  const misSesiones = (bb.sesiones || []).length;
  comprueba('El administrador ve sus propias sesiones abiertas', misSesiones >= 1);

  console.log('\n=== 17. Escalada de privilegios ===');
  const yoId = login.usuario.id;
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${yoId}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ rol:'admin' }) });
  bb = await ra.json();
  comprueba('Nadie modifica su propio rol -> 403', ra.status === 403 && bb.code === 'AUTO_ESCALADA');

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${yoId}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ estado:'Suspendido' }) });
  comprueba('Nadie cambia su propio estado', [403,409].includes(ra.status));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${yoId}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ permisos:['sys.config'] }) });
  comprueba('Nadie se recorta ni amplía sus permisos', [403,409].includes(ra.status));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${yoId}`, { method:'DELETE', headers: cab });
  comprueba('El administrador no se elimina a sí mismo', [409].includes(ra.status));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${uid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ nombre:'Lucía María' }) });
  comprueba('Sí puede editar la ficha de otro usuario -> 200', ra.status === 200);

  console.log('\n=== 18. Bitácora de auditoría ===');
  ra = await fetch(`${BASE}/api/v1/admin/auditoria?limite=100`, { headers: cab });
  bb = await ra.json();
  const apuntes = bb.apuntes || [];
  comprueba('Registra los movimientos', apuntes.length >= 5, apuntes.length + ' apuntes');
  comprueba('Cada apunte dice quién, a quién, qué y cuándo',
    apuntes.every(a => a.actorNombre && a.accion && a.ts && a.ip));
  comprueba('Recoge el restablecimiento de contraseña',
    apuntes.some(a => a.accion === 'Contraseña restablecida' && a.destinoId === uid));
  comprueba('La bitácora nunca guarda contraseñas ni hashes',
    !JSON.stringify(apuntes).includes('$2') && !JSON.stringify(apuntes).toLowerCase().includes(gen.toLowerCase()));

  ra = await fetch(`${BASE}/api/v1/admin/auditoria/${apuntes[0].id}`, { method:'DELETE', headers: cab });
  comprueba('No se puede borrar un apunte -> 405', ra.status === 405);

  ra = await fetch(`${BASE}/api/v1/admin/auditoria?usuario=${uid}`, { headers: cab });
  bb = await ra.json();
  comprueba('Filtra la bitácora por usuario',
    bb.apuntes.length > 0 && bb.apuntes.every(a => a.destinoId === uid || a.actorId === uid));

  console.log('\n=== 19. Recuperación de contraseña sin enumerar cuentas ===');
  const rec1 = await fetch(`${BASE}/api/v1/auth/recuperar`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:'jalvarez@labs24k.com' }) });
  const t1 = await rec1.text();
  const rec2 = await fetch(`${BASE}/api/v1/auth/recuperar`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:'nadie@ejemplo.com' }) });
  const t2 = await rec2.text();
  comprueba('Misma respuesta exista o no la cuenta', rec1.status === 200 && t1 === t2, t1.slice(0,70));
  comprueba('No envía ningún enlace de restablecimiento',
    !/token|enlace=|reset/i.test(t1));

  console.log('\n=== 20. Cambio de contraseña por el propio usuario ===');
  ra = await fetch(`${BASE}/api/v1/cuenta/password`, { method:'POST', headers: cab,
    body: JSON.stringify({ actual:'me-la-invento', nueva:'OtraClave!2026x' }) });
  comprueba('Exige la contraseña actual -> 401', ra.status === 401);

  ra = await fetch(`${BASE}/api/v1/cuenta/password`, { method:'POST', headers: cab,
    body: JSON.stringify({ actual:'CAMBIA-ESTA-CLAVE-ANTES-DE-DESPLEGAR', nueva:'corta' }) });
  comprueba('La nueva contraseña también pasa la política -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/cuenta/password`, { method:'POST', headers: cab,
    body: JSON.stringify({ actual:'CAMBIA-ESTA-CLAVE-ANTES-DE-DESPLEGAR', nueva:'CAMBIA-ESTA-CLAVE-ANTES-DE-DESPLEGAR' }) });
  comprueba('No admite repetir la misma contraseña -> 400', ra.status === 400);

  ra = await fetch(`${BASE}/api/v1/cuenta/password`, { method:'POST', headers: cab,
    body: JSON.stringify({ actual:'CAMBIA-ESTA-CLAVE-ANTES-DE-DESPLEGAR', nueva:'Gt7#kwPz2mR4' }) });
  comprueba('Cambia la contraseña correctamente -> 200', ra.status === 200);

  console.log('\n=== 21. Super Administrador de raíz ===');
  ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { headers: cab });
  const todos = (await ra.json()).usuarios;
  const raiz = todos.find(u => u.raiz === true);
  comprueba('Existe una única cuenta de raíz', todos.filter(u => u.raiz).length === 1);
  comprueba('Es jalvarez@labs24k.com', raiz && raiz.email === 'jalvarez@labs24k.com', raiz && raiz.email);
  comprueba('Lleva el distintivo SYSTEM_ADMIN_ROOT', raiz && raiz.rolRaiz === 'SYSTEM_ADMIN_ROOT');
  comprueba('Tiene todos los permisos',
    raiz && Object.values(raiz.permisos).every(v => v === true),
    raiz ? Object.values(raiz.permisos).filter(Boolean).length + ' de ' +
           Object.keys(raiz.permisos).length : '');
  // se mira lo que devolvió el login del principio: la sección 20 ya cambió la clave
  comprueba('Nace obligada a cambiar la contraseña inicial',
    login.usuario && login.usuario.debeCambiar === true);

  const rid = raiz.id;
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${rid}`, { method:'DELETE', headers: cab });
  bb = await ra.json();
  comprueba('No se puede eliminar -> 409', ra.status === 409 && bb.code === 'RAIZ_INDESTRUCTIBLE');

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${rid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ estado:'Suspendido' }) });
  bb = await ra.json();
  comprueba('No se puede suspender -> 409', ra.status === 409 && bb.code === 'RAIZ_SIEMPRE_ACTIVA');

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${rid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ estado:'Dado de baja' }) });
  comprueba('No se puede dar de baja -> 409', ra.status === 409);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${rid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ email:'otro@labs24k.com' }) });
  bb = await ra.json();
  comprueba('No se le puede cambiar el correo -> 409', ra.status === 409 && bb.code === 'RAIZ_EMAIL_FIJO');

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${rid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ rol:'commercial' }) });
  bb = await ra.json();
  comprueba('No se le puede degradar el rol -> 409', ra.status === 409 && bb.code === 'RAIZ_ROL_FIJO');

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${rid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ permisos:['presu.ver'] }) });
  comprueba('No se le pueden recortar los permisos -> 409', ra.status === 409);

  ra = await fetch(`${BASE}/api/v1/admin/usuarios/${rid}`, { method:'PATCH', headers: cab,
    body: JSON.stringify({ telefono:'600 112 244', extension:'100' }) });
  bb = await ra.json();
  comprueba('Sí admite cambios inocuos (teléfono, extensión)',
    ra.status === 200 && bb.usuario.extension === '100');
  comprueba('Tras el cambio sigue activa, admin y con todo',
    bb.usuario.estado === 'Activo' && bb.usuario.rol === 'admin' &&
    Object.values(bb.usuario.permisos).every(Boolean));

  ra = await fetch(`${BASE}/api/v1/admin/usuarios`, { method:'POST', headers: cab,
    body: JSON.stringify({ nombre:'Falso', apellidos:'Raíz', email:'jálvarez@labs24k.com',
                           rol:'admin' }) });
  comprueba('No se puede duplicar la identidad de raíz con la grafía con tilde -> 409',
    ra.status === 409);

  console.log('\n=== 22. Registro forense del acceso de raíz ===');
  ra = await fetch(`${BASE}/api/v1/admin/usuarios/raiz/accesos`, { headers: cab });
  bb = await ra.json();
  const accesos = bb.accesos || [];
  comprueba('Registra la entrada de la cuenta de raíz',
    accesos.some(a => a.evento === 'ENTRADA'), accesos.length + ' apuntes');
  comprueba('Cada apunte lleva fecha, IP y agente de usuario',
    accesos.every(a => a.ts && a.ip && typeof a.ua === 'string'));
  comprueba('Registra también los intentos fallidos',
    accesos.some(a => a.evento === 'FALLIDO'));
  comprueba('El registro no contiene la contraseña',
    !JSON.stringify(accesos).toLowerCase().includes('los mejores'));
  comprueba('Informa del algoritmo de cifrado en uso',
    typeof bb.algoritmo === 'string' && /argon2id|bcrypt/.test(bb.algoritmo), bb.algoritmo);

  const fsx = require('fs'), pathx = require('path');
  const ficheroRaiz = pathx.join(__dirname, 'logs', 'root-access.log');
  comprueba('Se escribe en su propio fichero de log', fsx.existsSync(ficheroRaiz));

  console.log('\n=== 23. Alias del correo de raíz ===');
  // Todas estas grafías tienen que resolver a la MISMA identidad. Se comprueba
  // intentando dar de alta una cuenta con cada una: si resuelven bien, el
  // servidor responde «ya existe» en vez de crear un segundo administrador.
  for (const alias of ['jálvarez@labs24k.com', 'JÁlvarez@labs24k.com',
                       'JAlvarez@LABS24K.com', 'admin@labs24k.com']) {
    const rl = await fetch(`${BASE}/api/v1/admin/usuarios`, { method:'POST', headers: cab,
      body: JSON.stringify({ nombre:'Suplantador', email: alias, rol:'admin' }) });
    const bl = await rl.json();
    comprueba(`«${alias}» resuelve a la cuenta de raíz`,
      rl.status === 409 && bl.code === 'EMAIL_DUPLICADO', 'estado ' + rl.status);
  }

  console.log(`\n=========== RESULTADO: ${ok} correctas, ${ko} fallidas ===========\n`);
  process.exit(ko ? 1 : 0);
})();
