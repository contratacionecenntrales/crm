# API blindada · Labs Command Center 360™

Backend Node.js/Express con las siete capas defensivas, **probado y funcionando**:
`node test-security.js` pasa 115 comprobaciones sobre el servidor en marcha.

---

## ⚠️ Antes de nada: esto NO va en el hosting compartido de Hostalia

El panel que tienes desplegado (`index.html`) es estático y funciona en cualquier
alojamiento Apache. **Este backend necesita Node.js**, que los planes de hosting
compartido de Hostalia no ejecutan. Necesitas uno de estos:

| Opción | Coste orientativo | Notas |
|---|---|---|
| VPS de Hostalia (o Cloud) | desde ~10 €/mes | Control total, instalas Node y Nginx |
| Railway / Render / Fly.io | gratis a ~7 €/mes | Despliegue desde Git, HTTPS incluido |
| Supabase o Firebase | gratis al inicio | Sin servidor propio: te ahorras este backend |

Si de momento no vas a montar servidor, **lo que sí puedes aplicar hoy** es el
`.htaccess` blindado que acompaña al paquete del panel: lleva CSP estricta con
hash, HSTS, anti-clickjacking y bloqueo de ficheros sensibles.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env
# genera cada secreto (deben ser distintos entre sí):
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node server.js
```

El servidor **se niega a arrancar** si los secretos faltan, miden menos de 32
caracteres, siguen con el valor de ejemplo o son iguales entre sí. Verificado.

Prueba de seguridad, con el servidor levantado en otra terminal:

```bash
node test-security.js
```

---

## Las siete capas

| Capa | Archivo | Qué hace |
|---|---|---|
| 1 · Perímetro | `server.js` | `trust proxy` en 1 salto, CORS cerrado a tu dominio |
| 2 · Cabeceras | `middleware/securityHeaders.js` | CSP `default-src 'none'`, HSTS un año, anti-clickjacking, sin MIME sniffing |
| 3 · Saneamiento | `middleware/sanitizer.js` | Prototype pollution, operadores NoSQL, XSS y caracteres de control |
| 4 · Sesión | `utils/tokens.js`, `middleware/authMiddleware.js`, `middleware/csrf.js` | JWT en cookie HttpOnly, rotación de refresco con detección de robo, huella de sesión, CSRF de doble envío, control de rol |
| 5 · Auditoría | `utils/logger.js` | Winston con censura de campos sensibles y rotación de ficheros |
| 6 · Integración | `server.js` | Orden estricto de middlewares y errores sin traza |
| 7 · Arranque | `server.js` | Aborta con secretos débiles o repetidos |

---

## Cambios respecto al planteamiento inicial, y por qué

**1. Fuera `xss-clean` y `express-mongo-sanitize`.** El primero está sin
mantenimiento desde 2022. Los dos reasignan `req.query`, que en Express 5 es
una propiedad de solo lectura: el servidor reventaría al arrancar en cuanto
actualices. `middleware/sanitizer.js` cubre lo mismo sin dependencias y además
bloquea caracteres de control (inyección en logs).

**2. CORS corregido.** `app.metatok.ai` y `hostalia.webmail.es` figuraban como
orígenes permitidos, pero son sitios externos a los que tu panel *enlaza*:
nunca van a llamar a tu API. Incluirlos solo amplía la superficie de ataque. El
origen permitido es el dominio de tu propio panel.

**3. Añadida protección CSRF.** Faltaba, y es la pieza que hace peligroso el uso
de cookies: si la sesión viaja en cookie, el navegador la envía sola, de modo
que un formulario alojado en otra web podría cambiar el estado de un expediente
en nombre del comercial. Se cubre con `SameSite=Strict` más testigo de doble
envío.

**4. Token solo por cookie.** Se eliminó la lectura de `Authorization: Bearer`
como alternativa. Aceptar las dos vías obliga al panel a guardar el token en
JavaScript, que es exactamente lo que convierte cualquier XSS en un robo de
sesión — y anula la ventaja de usar `HttpOnly`.

**5. Rotación real del refresco.** Cada token de refresco se canjea una sola
vez. Si alguien reutiliza uno ya gastado, se revoca la familia entera de tokens
y se cierra la sesión: así se detecta el robo en lugar de solo dificultarlo.

**6. Login sin fuga de información.** Mismo mensaje y mismo tiempo de respuesta
tanto si el correo existe como si no (se compara siempre contra un hash señuelo),
para que nadie pueda enumerar las cuentas dadas de alta.

**7. `skipSuccessfulRequests` en el límite de login.** Con el planteamiento
original, cinco entradas correctas en una hora dejaban fuera al comercial. Ahora
solo cuentan los intentos fallidos.

---

## Super Administrador de raíz

Una sola cuenta, creada por código en el arranque del servidor —nunca desde el
panel—, con el distintivo `SYSTEM_ADMIN_ROOT` y todos los permisos:

```
correo    jalvarez@labs24k.com
alias     JÁlvarez@labs24k.com · j.alvarez@labs24k.com
          juan.alvarez@labs24k.com · admin@labs24k.com
relación  0-413-936
```

Se pidió la dirección con tilde. Una tilde **antes de la arroba** obliga al
servidor de correo a hablar SMTPUTF8, que muchos proveedores —Hostalia entre
ellos— no admiten: el buzón simplemente no recibiría. Por eso la identidad se
guarda sin tilde y las demás grafías quedan como alias, resueltas antes de
buscar en la base de datos. Se entra igual escribiendo cualquiera de ellas, y
tampoco se puede dar de alta a nadie con un alias, porque apuntaría a la misma
identidad (409 `EMAIL_DUPLICADO`). Si algún día el correo admite UTF-8, basta
con intercambiar las constantes en `utils/usuarios.js`.

Lo que el servidor impide sobre esta cuenta, responda quien responda:

| Intento | Respuesta |
|---|---|
| Eliminarla | 409 `RAIZ_INDESTRUCTIBLE` |
| Suspenderla o darla de baja | 409 `RAIZ_SIEMPRE_ACTIVA` |
| Cambiarle el correo | 409 `RAIZ_EMAIL_FIJO` |
| Degradarle el rol | 409 `RAIZ_ROL_FIJO` |
| Recortarle permisos | 409 `RAIZ_PERMISOS_TOTALES` |

Además, después de cada guardado el servidor le reimpone estado activo, rol de
administrador, correo canónico y la matriz completa de permisos. Y cada intento
bloqueado queda en la bitácora con el nombre de quien lo hizo.

### ⚠️ La contraseña inicial

La cuenta arranca con el valor de `RAIZ_CLAVE_INICIAL` en `utils/usuarios.js`
(por defecto un marcador de posición sin usar), guardado solo como hash, y con
`debeCambiar: true`. Pon ahí una frase real antes de desplegar, y ten en
cuenta que **debe pasar la misma política corporativa** que aplica esta API a
todos los demás usuarios —mayúscula, minúscula, número y símbolo—: una frase
predecible es de las primeras cosas que prueba un atacante.

Mientras la de arranque siga puesta, esa cuenta es el punto más débil del
sistema, y es justamente la que lo puede todo. Cámbiala en el primer acceso:

```bash
curl -X POST https://api.tudominio.com/api/v1/cuenta/password \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" -b cookies.txt \
  -d '{"actual":"<la frase que hayas puesto en RAIZ_CLAVE_INICIAL>","nueva":"UnaFraseLarga+DificilDeAdivinar_2026"}'
```

Para cambiar la frase de arranque antes del primer despliegue, edita
`RAIZ_CLAVE_INICIAL` en `utils/usuarios.js`. Mejor todavía: sácala a una
variable de entorno para que no viaje en el repositorio.

### Registro forense del acceso de raíz

Cada entrada, salida e intento fallido de esta cuenta se escribe en
`logs/root-access.log`, **aparte** del resto de registros, con marca de tiempo,
IP de origen y agente de usuario. Se consulta con
`GET /api/v1/admin/usuarios/raiz/accesos`. En producción, envíalo a un destino
de solo-añadir fuera de la máquina (syslog remoto, CloudWatch, un bucket con
Object Lock): un registro que puede borrar quien entra en el servidor no prueba
nada.

---

## Cifrado de las contraseñas

Todo pasa por `utils/clave.js`; ningún otro fichero llama al algoritmo
directamente.

- **Argon2id** si el paquete está instalado (`npm install argon2`), con los
  parámetros que recomienda OWASP: 19 MiB de memoria, 2 iteraciones, 1 hilo.
- **bcrypt de coste 13** si no lo está. Va como dependencia opcional porque se
  compila de forma nativa y no todos los alojamientos lo permiten; si falla la
  instalación, `npm install` continúa y la API arranca igual.
- Los dos formatos conviven: el prefijo del hash dice cuál es. Cuando alguien
  entra con un hash del algoritmo antiguo y el nuevo ya está disponible, se
  **recicla en silencio** en ese mismo momento, que es el único instante en que
  la contraseña existe en claro.

`GET /api/v1/admin/usuarios/raiz/accesos` devuelve, en el campo `algoritmo`,
cuál de los dos está funcionando ahora mismo.

---

## Gestión de usuarios: rutas

Todo lo que cuelga de `/api/v1/admin/` exige sesión válida, testigo CSRF y rol
`admin`. El registro público no existe: seis rutas distintas devuelven 403.

| Método y ruta | Qué hace |
|---|---|
| `GET /api/v1/admin/usuarios` | Listado con `?q=`, `?rol=`, `?estado=` y el resumen para las tarjetas |
| `GET /api/v1/admin/usuarios/:id` | Ficha completa, con token de API y sesiones |
| `POST /api/v1/admin/usuarios` | Alta. Devuelve `passwordInicial` **una sola vez** |
| `PATCH /api/v1/admin/usuarios/:id` | Perfil, rol, estado, permisos y preferencias |
| `POST /api/v1/admin/usuarios/:id/password` | Restablece la contraseña y cierra sus sesiones |
| `POST /api/v1/admin/usuarios/:id/token` | Rota el token de API |
| `PUT · DELETE /api/v1/admin/usuarios/:id/avatar` | Foto de perfil (máx. 2,5 MB, PNG/JPG/WebP) |
| `GET · DELETE /api/v1/admin/usuarios/:id/sesiones[/:sid]` | Ver y revocar sesiones abiertas |
| `DELETE /api/v1/admin/usuarios/:id` | Elimina la cuenta |
| `GET /api/v1/admin/usuarios/raiz/accesos` | Registro forense de la cuenta de raíz y algoritmo de cifrado en uso |
| `GET /api/v1/admin/auditoria` | Bitácora (admin y dirección). Sin rutas de borrado: responde 405 |
| `GET · POST · DELETE /api/v1/cuenta[...]` | Lo que cada usuario puede hacer consigo mismo |
| `POST /api/v1/auth/recuperar` | Aviso al administrador. Respuesta idéntica exista o no la cuenta |

**Los permisos se envían como lista de claves concedidas**, no como objeto:

```json
{ "permisos": ["presu.ver", "presu.crear", "exp.docs"] }
```

El saneamiento de la capa 3 rechaza cualquier clave de objeto que lleve un
punto, porque así se cortan las inyecciones por ruta anidada. Como los
identificadores de permiso llevan punto (`presu.dto`), viajan de valor y esa
defensa queda intacta. La respuesta sí devuelve el objeto `{clave: booleano}`,
que es más cómodo de consultar.

### Lo que no se puede hacer, por diseño

- **Escalada de privilegios**: nadie modifica su propio rol, estado ni permisos,
  ni siquiera un administrador. Eso lo hace otro administrador (403 `AUTO_ESCALADA`).
- **Quedarse sin administración**: el sistema nunca acepta suspender, dar de baja
  o degradar al último administrador activo (409 `ULTIMO_ADMIN`).
- **Colar campos**: los cuerpos se leen de una lista blanca. `hash`, `id` y `rel`
  enviados por el cliente se ignoran en silencio.
- **Inventar permisos**: cualquier clave fuera del catálogo devuelve 400.
- **Contraseñas flojas**: mínimo 10 caracteres con mayúscula, minúscula, número y
  símbolo; sin repetir un carácter cuatro veces y sin contener el nombre ni el
  correo del propio usuario. Se aplica también al cambio que hace el usuario.
- **Tocar la bitácora**: `/admin/auditoria` solo admite lectura.

## Pruebas

```bash
node server.js          # en una terminal
node test-security.js   # en otra
```

115 comprobaciones automáticas: cabeceras, CORS, inyección, fuerza bruta, CSRF,
rotación de refrescos, registro bloqueado, permisos, escalada de privilegios,
política de contraseñas, avatar, sesiones, auditoría, recuperación, blindaje de
la cuenta de raíz, alias del correo y registro forense.

Importante: la suite cambia la contraseña de raíz en la última sección, así que
**reinicia el servidor antes de volver a lanzarla** (los datos viven en memoria).

---

## Lo que todavía falta para producción

Esto es un esqueleto blindado, no un sistema completo. Antes de manejar datos
reales de clientes necesitas:

- **Base de datos**, con consultas parametrizadas. Los usuarios están en memoria.
- **Almacén de tokens de refresco en Redis o tabla**, para que la rotación
  sobreviva a un reinicio y funcione con varias instancias.
- **Doble factor de verdad**: el interruptor `dobleFactor` ya está en la ficha y
  se guarda, pero todavía no hay envío de código ni verificación TOTP.
- **Almacén de imágenes** (S3 o disco) para los avatares: hoy se guardan como
  data URI en el propio registro, lo que engorda las respuestas.
- **Bitácora en tabla append-only**, sin permisos de UPDATE ni DELETE para el
  usuario de la aplicación. La de memoria se pierde al reiniciar el proceso.
- **RGPD**: registro de actividades de tratamiento, cifrado en reposo y política
  de retención de los logs, que contienen IPs (dato personal).
- **Copias de seguridad** y un plan de restauración probado.
- **Cloudflare o WAF** delante, con las reglas OWASP activadas.
- **Auditoría externa** antes de meter datos de salud, que es lo que llevas en
  proyectos como el de la clínica.

---

*Labs24k · Grupo Evolvix Global SL*
