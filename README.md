# Intranet Comercial 24K

Portal privado de gestión comercial para el equipo de **24k.com** (marca de
producto: _Labs24k_): facturación, agenda de citas con calendario mensual,
Academia de formaciones, recursos corporativos y perfil del comercial (con
cambio de contraseña propio), con inicio de sesión individual y control de
acceso por roles (`comercial` / `admin`). El rol `admin` tiene además una
pestaña de **Configuración** para gestionar todo lo demás: publicar
formaciones y recursos, ascender/retirar administradores y fijar el objetivo
trimestral por defecto de los comerciales nuevos.

## Stack técnico

- **Frontend/SSR**: React 19 + [TanStack Start](https://tanstack.com/start) (Vite + Nitro), Tailwind CSS 4.
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage). No hay servidor Node/Express aparte: la app habla directamente con Supabase desde el cliente, protegida por Row Level Security (RLS) en cada tabla.
- **Base de datos**: PostgreSQL gestionado por Supabase. El esquema y las políticas de seguridad viven como migraciones SQL versionadas en `supabase/migrations/`.
- **Autenticación**: Supabase Auth (email/contraseña + Google OAuth opcional). Las contraseñas nunca las gestiona esta app: Supabase las almacena ya hasheadas (bcrypt) y nunca viajan ni se guardan en texto plano en este código.
- **Almacenamiento de ficheros**: Supabase Storage, con buckets privados (`comprobantes`, `recursos`, `formaciones`), límite de tamaño y lista blanca de tipos MIME aplicados también a nivel de base de datos (no solo en el navegador).

> Nota importante: esta app **no usa SQLite ni MySQL propios** porque el
> proyecto ya estaba construido sobre Supabase (Postgres gestionado) desde su
> generación en Lovable. Mantenerlo así da autenticación, RLS y Storage
> "de fábrica" con mucho menos código propio que mantener y auditar. Todo el
> esquema es SQL estándar (`supabase/migrations/`) y se puede migrar a
> cualquier Postgres, incluido uno propio en tu VPS o cPanel, si en el futuro
> quieres independizarte también de Supabase.

## Estructura del proyecto

```
src/
  routes/               páginas (TanStack Router basado en archivos)
    index.tsx           intranet (Dashboard, Facturación, Recursos, Academia, Agenda, Perfil, Configuración)
    auth.tsx            login / alta de comercial
  components/intranet/  una pestaña por componente
  hooks/useAuth.tsx     estado de sesión de Supabase
  integrations/supabase/ cliente Supabase (browser + server) y tipos generados
  server.ts             entrada SSR: cabeceras de seguridad (CSP con nonce, etc.)
supabase/migrations/    esquema de base de datos, RLS y buckets, en SQL
```

## 1. Puesta en marcha en local

Requisitos: Node.js 20+ (o Bun 1.3+).

```bash
cp .env.example .env
# rellena .env con los datos de tu proyecto Supabase (ver sección 2)

bun install        # o: npm install
bun run dev        # o: npm run dev
```

La app queda disponible en `http://localhost:3000` (o el puerto que indique la consola).

## 2. Base de datos (Supabase)

Puedes usar el proyecto Supabase ya conectado por Lovable Cloud, o crear uno
propio para independizarte por completo de Lovable. Para un proyecto propio:

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com) (tiene plan gratuito).
2. En **Project Settings → API** copia:
   - `Project URL` → variables `SUPABASE_URL` y `VITE_SUPABASE_URL`.
   - `Project ID` (referencia del proyecto) → `SUPABASE_PROJECT_ID` y `VITE_SUPABASE_PROJECT_ID`.
   - La clave **publishable/anon** → `SUPABASE_PUBLISHABLE_KEY` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - **Nunca** copies aquí la clave `service_role`: esa es secreta y no la usa esta app.
3. Aplica el esquema ejecutando, en orden, los ficheros de `supabase/migrations/`
   en el **SQL Editor** del panel de Supabase (o con la CLI, ver abajo). Crean:
   - Tablas `perfiles`, `user_roles`, `facturacion`, `citas`, `recursos`, `formaciones` (Academia) y `configuracion` (ajustes globales, fila única).
   - Políticas RLS para que cada comercial solo vea/edite sus propios datos, y el rol `admin` pueda ver y validar los de todos, gestionar Academia/Recursos y asignar roles.
   - Los buckets de Storage `comprobantes` (privado, PDF/imagen, máx. 10 MB), `recursos` (privado, solo PDF, máx. 20 MB) y `formaciones` (privado, solo PDF, máx. 30 MB).
   - Un trigger que crea automáticamente el perfil y el rol `comercial` al registrarse un usuario nuevo, usando el objetivo trimestral por defecto configurado en `configuracion`.

   Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) instalada:

   ```bash
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```

4. **Da de alta al primer administrador.** Regístrate normalmente desde `/auth`
   (todo usuario nuevo entra como `comercial`) y luego, en el SQL Editor de
   Supabase, promociónalo:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('<uuid-del-usuario>', 'admin')
   on conflict (user_id, role) do nothing;
   ```

   El `uuid` lo ves en **Authentication → Users** dentro del panel de Supabase.
   Este paso manual solo hace falta para el **primer** administrador: a partir
   de ahí, cualquier admin puede ascender o retirar a otros comerciales desde
   la pestaña **Configuración → Comerciales y roles** de la propia intranet.

5. **(Opcional) Login con Google.** En **Authentication → Providers → Google**
   del panel de Supabase, activa el proveedor y añade tu Client ID/Secret de
   Google Cloud. El botón "Continuar con Google" ya está implementado con la
   API estándar de Supabase (`supabase.auth.signInWithOAuth`), así que
   funciona igual da igual dónde despliegues el frontend.

## 3. Variables de entorno

Copia `.env.example` a `.env` y rellena los 6 valores (hay dos copias de cada
uno: sin prefijo para el servidor SSR, con prefijo `VITE_` para el bundle de
cliente; deben apuntar al mismo proyecto).

```
SUPABASE_PROJECT_ID=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

`.env` está en `.gitignore`: nunca lo subas al repositorio. En producción,
define estas variables como variables de entorno del propio servidor/host
(panel de cPanel, systemd, PM2, etc.), no como fichero desplegado.

## 4. Compilar para producción

Este proyecto usa Nitro (vía TanStack Start) para el build de servidor.
**Por defecto compila para Cloudflare Workers** (config heredada de Lovable
Cloud). Para un hosting tradicional (VPS o cPanel) usa el target Node:

```bash
bun run build:node     # o: npm run build:node
# genera .output/public (estáticos) y .output/server/index.mjs (servidor Node)
```

Arrancar el servidor generado:

```bash
PORT=3000 node .output/server/index.mjs
# o simplemente: bun run start / npm run start
```

## 5. Despliegue en un VPS (recomendado)

1. Instala Node.js 20+ en el servidor.
2. Sube el código (o clona el repo) y copia tu `.env` de producción.
3. `npm ci && npm run build:node`.
4. Arranca el proceso con un gestor persistente, por ejemplo [PM2](https://pm2.keymetrics.io/):

   ```bash
   npm install -g pm2
   PORT=3000 pm2 start .output/server/index.mjs --name intranet-24k
   pm2 save
   pm2 startup   # deja el proceso arrancando solo tras un reinicio del servidor
   ```

5. Pon Nginx (o Apache) delante como proxy inverso y activa HTTPS con
   [Let's Encrypt](https://certbot.eff.org/) (`certbot --nginx`). Ejemplo mínimo de Nginx:

   ```nginx
   server {
     listen 80;
     server_name intranet.24k.com;
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```

   Tras emitir el certificado, certbot añade automáticamente el bloque
   `listen 443 ssl` y la redirección de 80→443.

## 6. Despliegue en cPanel

Esta app necesita ejecutar JavaScript en el servidor (SSR), así que **no
funciona en un hosting compartido "solo PHP"**. Necesitas un plan de cPanel
cuyo proveedor incluya la función **"Setup Node.js App"** (muy habitual hoy en
día en hostings compartidos y VPS con cPanel/WHM):

1. En cPanel → **Setup Node.js App** → _Create Application_.
   - Versión de Node: 20 o superior.
   - Modo de la aplicación: `Production`.
   - Application root: la carpeta donde subirás el proyecto (ej. `intranet-24k`).
   - Application URL: tu dominio o subdominio (ej. `intranet.24k.com`).
   - **Application startup file**: `.output/server/index.mjs`.
2. Sube el código por Git o FTP/SFTP a la _Application root_.
3. Desde el terminal que ofrece "Setup Node.js App" (botón _Enter to the virtual environment_):

   ```bash
   npm ci
   npm run build:node
   ```

4. En la misma pantalla de "Setup Node.js App", añade las variables de
   entorno (sección **Environment variables**) con los mismos valores que
   `.env.example` (ver sección 3).
5. Pulsa **Restart**. cPanel gestiona el proceso Node con Passenger y ya
   expone tu dominio con el proxy interno de cPanel.
6. Activa el certificado SSL gratuito de cPanel (**SSL/TLS Status → AutoSSL**)
   para servir la intranet por HTTPS, obligatorio antes de manejar
   credenciales o facturación real.

Si tu hosting **no** ofrece "Setup Node.js App" (cPanel puramente PHP/MySQL
clásico), esta aplicación no puede correr ahí: necesitarás un VPS (sección 5)
o un proveedor con soporte Node.

## 7. Seguridad ya implementada

- **Rutas protegidas**: la intranet (`/`) redirige a `/auth` si no hay sesión activa; todos los datos, además, están protegidos por RLS en la base de datos (no solo por ocultar la pantalla).
- **Contraseñas**: hasheadas y gestionadas por completo por Supabase Auth; esta app nunca las ve en claro ni las guarda.
- **RLS por fila**: cada comercial solo puede leer/editar sus propias facturas y citas; solo `admin` puede ver los datos de todo el equipo, cambiar el estado de una factura, gestionar Academia/Recursos o asignar roles (protegido también por triggers y políticas en base de datos, no solo por la interfaz).
- **Subida de ficheros**: validación de tipo MIME y tamaño máximo tanto en el cliente (antes de subir) como en el propio bucket de Supabase Storage (`allowed_mime_types` / `file_size_limit`), y nombres de fichero saneados. Los buckets son privados: la descarga se hace con URLs firmadas de corta duración, nunca con enlaces públicos permanentes.
- **Cabeceras HTTP de seguridad** (`src/server.ts`, aplicadas a toda respuesta): `Content-Security-Policy` estricta (scripts solo desde el propio origen, con un nonce distinto por petición — nada de `unsafe-inline` para scripts), `X-Frame-Options: DENY` y `frame-ancestors 'none'` (anti-clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` y `Strict-Transport-Security`.
- **HTTPS**: la app es agnóstica del transporte; el cifrado en tránsito lo aporta el proxy/host (Nginx+certbot, cPanel AutoSSL o Cloudflare, según dónde despliegues). No despliegues nunca en producción sirviendo por HTTP plano.
- **Dependencias**: `bunfig.toml` bloquea instalar versiones de paquetes publicadas hace menos de 24h (protección básica frente a ataques de cadena de suministro).
- **Fuerza bruta y filtraciones de contraseñas**: Supabase Auth ya limita intentos de login/registro por IP. Para reforzarlo aún más, en el panel de Supabase (**Authentication → Policies/Settings**) puedes activar _Leaked password protection_ y añadir un CAPTCHA (hCaptcha/Turnstile) al formulario de alta.

## Scripts disponibles

| Script       | Descripción                                                       |
| ------------ | ----------------------------------------------------------------- |
| `dev`        | Servidor de desarrollo con recarga en caliente                    |
| `build`      | Build de producción (preset Cloudflare, el que usa Lovable Cloud) |
| `build:node` | Build de producción para Node (VPS / cPanel)                      |
| `start`      | Arranca el build de Node (`.output/server/index.mjs`)             |
| `lint`       | ESLint                                                            |
| `format`     | Prettier                                                          |
