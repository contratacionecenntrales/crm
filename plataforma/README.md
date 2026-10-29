# Plataforma Metatok (Next.js + Supabase)

La nueva plataforma multi-tenant al estilo HighLevel: **agencia → subcuentas**,
con el aislamiento de datos hecho en la base de datos (RLS), no en la aplicación.

Convive con el panel HTML de Hostalia (`SUBIR-A-HOSTALIA/`), que sigue funcionando
igual. Esta carpeta **no** se sube a Hostalia: necesita un servidor Node (Vercel).

## Qué incluye este primer bloque

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Inicio de sesión | `/login` | Correo + contraseña, recuperación por correo |
| Alta de agencia | `/onboarding` | Primer acceso sin agencia: la crea y te deja como propietario |
| Tablero de la agencia | `/agencia` | Ingresos 30 días, MRR, nuevos clientes, total de clientes, gráfico de crecimiento (7 meses), distribución de ingresos del mes pasado, actividad reciente |
| Subcuentas | `/agencia/subcuentas` | Crear, buscar, editar, suspender/reactivar, eliminar (con confirmación por nombre), plan mensual y pagos, cambiar a la subcuenta |
| Equipo de la agencia | `/agencia/equipo` | Añadir por correo (invita si no tiene cuenta), cambiar rol, quitar |
| Configuración de la agencia | `/agencia/configuracion` | Nombre, contacto, moneda, zona horaria, URL del webhook de Stripe |
| Configuración de la subcuenta | `/subcuenta/[id]/configuracion` | Perfil de empresa y usuarios de la subcuenta |
| Selector de subcuenta | barra lateral | Buscar, fijar, entrar en una subcuenta, volver a la vista de agencia |
| Notificaciones | campana | Pestañas Sistema/Alerta, marcar como leídas, borrar, en directo por Realtime |
| Webhook de Stripe | `/api/webhooks/stripe` | Suscripciones y cobros entran solos en el tablero |

Tema claro/oscuro/sistema en el menú de usuario. Diseño adaptado a móvil.

### Roles

| Rol | Ve | Puede |
|---|---|---|
| Propietario de agencia | Todas las subcuentas, facturación, métricas | Todo, incluido nombrar otros propietarios y borrar la agencia |
| Admin de agencia | Igual que el propietario | Todo salvo tocar propietarios |
| Usuario de agencia | Solo las subcuentas a las que se le da acceso | Trabajar dentro de ellas |
| Admin de subcuenta | Su subcuenta (si no está suspendida) | Editar el perfil y gestionar los usuarios de la subcuenta |
| Usuario de subcuenta | Su subcuenta | Trabajar dentro de ella |

## Puesta en marcha

### 1 · Base de datos

Supabase → SQL Editor → pega y ejecuta `NO-SUBIR-supabase/09-agencias-subcuentas.sql`.
Es independiente de los guiones 01–08 y se puede volver a ejecutar.

### 2 · Plantillas de correo de Supabase

Supabase → Authentication → Email Templates. En **Invite user** y en **Reset
password**, cambia el enlace por:

```html
<a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite">Aceptar invitación</a>
```
```html
<a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery">Crear nueva contraseña</a>
```

Y en Authentication → URL Configuration pon como **Site URL** la dirección
pública de la plataforma (la misma que `NEXT_PUBLIC_SITE_URL`).

### 3 · Variables de entorno

Copia `.env.example` a `.env.local` (en local) o créalas en Vercel → Settings →
Environment Variables. `SUPABASE_SERVICE_ROLE_KEY` y `STRIPE_WEBHOOK_SECRET` son
secretas: solo en el servidor, nunca en el navegador ni en el repositorio.

### 4 · Arrancar

```bash
cd plataforma
npm install
npm run dev        # http://localhost:3000
```

Para publicar: importa el repositorio en Vercel con **Root Directory = `plataforma`**.

### 5 · Primer usuario

Crea tu usuario en Supabase → Authentication → Users → Add user (con contraseña),
entra en `/login` y la plataforma te pedirá el nombre de tu agencia.

### 6 · Stripe (opcional)

Stripe → Developers → Webhooks → Add endpoint → `https://TU-DOMINIO/api/webhooks/stripe`
con los eventos `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.created`, `customer.subscription.updated` y
`customer.subscription.deleted`. Pon el *signing secret* en `STRIPE_WEBHOOK_SECRET`
y añade `subcuenta_id` (el ID de la subcuenta) en los metadatos de la suscripción
de Stripe de cada cliente.

## Comprobaciones

```bash
npm run typecheck   # TypeScript
npm test            # firma de Stripe, validaciones y formato
npm run build       # build de producción
```

Pruebas de seguridad de la base de datos (PostgreSQL local, no Supabase):

```bash
psql -d prueba -f NO-SUBIR-supabase/_stub-auth.sql \
     -f NO-SUBIR-supabase/09-agencias-subcuentas.sql \
     -f NO-SUBIR-supabase/test-agencias.sql
```

## Estructura

```
app/                 rutas (App Router) y Server Actions
  agencia/           vista de agencia
  subcuenta/[id]/    vista de subcuenta
  api/webhooks/      webhooks entrantes
components/shell/    barra lateral, selector, campana, menú de usuario
components/agencia/  tablero, subcuentas, facturación
components/ui/       piezas comunes
lib/                 sesión, validación, Supabase, Stripe, formato
```

Cada módulo nuevo (contactos, oportunidades, conversaciones, calendarios…) cuelga
de `subcuenta_id` y usa `puedo_ver_subcuenta()` en sus políticas RLS.
