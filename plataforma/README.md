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

### Dentro de cada subcuenta

| Pantalla | Ruta | Qué hace |
|---|---|---|
| Tablero | `/subcuenta/[id]` | Estado de oportunidad, valor, tasa de conversión, embudo, distribución de etapas y tareas pendientes, con selector de periodo y de embudo |
| Contactos · Listas inteligentes | `/subcuenta/[id]/contactos` | Tabla con columnas a elegir (incluidos campos personalizados), filtros combinables, orden, búsqueda, paginación, listas guardadas (compartidas o privadas), selección múltiple con añadir/quitar etiqueta, asignar, exportar y eliminar |
| Importar / exportar | botones de Contactos | Importación CSV (coma o punto y coma) con mapeo automático de columnas, actualización u omisión de duplicados por correo e informe de errores por fila; exportación CSV de la vista o de la selección |
| Ficha del contacto | `/subcuenta/[id]/contacto/[id]` | Propietario, etiquetas, todos los campos, No molestar por canal, línea de tiempo automática, notas, tareas y oportunidades |
| Acciones en lote | `/subcuenta/[id]/contactos/acciones-lote` | Registro de importaciones, exportaciones y acciones masivas con su resultado |
| Campos personalizados | `/subcuenta/[id]/contactos/campos` | 11 tipos (texto, número, importe, fecha, desplegable, casillas, sí/no…), agrupados en carpetas |
| Tareas | `/subcuenta/[id]/contactos/tareas` | Pendientes/completadas, por persona, vencidas en rojo; avisa en la campana a quien se le asigna |
| Empresas | `/subcuenta/[id]/contactos/empresas` | Se crean solas al escribir la empresa en un contacto; recuento de contactos |
| Clientes potenciales | `/subcuenta/[id]/oportunidades` | Tablero por etapas con arrastrar y soltar (ratón, dedo y teclado), vista de lista, filtros por estado y búsqueda |
| Embudos | `/subcuenta/[id]/oportunidades/embudos` | Crear, renombrar y borrar embudos; añadir, renombrar, reordenar y borrar etapas (moviendo antes sus oportunidades) |

Cada subcuenta nueva nace con un embudo de ventas de 5 etapas.

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

Supabase → SQL Editor → pega y ejecuta, en este orden:

1. `NO-SUBIR-supabase/09-agencias-subcuentas.sql` — agencias, subcuentas, equipos, facturación, notificaciones
2. `NO-SUBIR-supabase/10-crm-contactos-oportunidades.sql` — contactos, empresas, campos, listas, notas, tareas, embudos y oportunidades
3. `NO-SUBIR-supabase/11-configuracion.sql` — datos de empresa, marca blanca (logo, dominios, CSS, tema), expiración de sesión, anuncios y catálogo de etiquetas
4. `NO-SUBIR-supabase/12-calendarios.sql` — calendarios, horarios, citas, franjas bloqueadas y página pública de reservas (`/reservar/<enlace>`)
5. `NO-SUBIR-supabase/13-conversaciones.sql` — bandeja de Conversaciones (SMS, WhatsApp, correo y notas internas), fragmentos y ajustes de Twilio / Mailgun / SMTP

Son independientes de los guiones 01–08 del panel antiguo y se pueden volver a ejecutar.

### Conversaciones (SMS, WhatsApp y correo)

- `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SITE_URL` (con https) son **obligatorias**: el servidor lee con ellas las claves de Twilio/Mailgun, que nadie del equipo puede leer.
- Cada subcuenta conecta su cuenta en **Configuración → Integración telefónica** (Twilio) y **Servicios de correo** (Mailgun o SMTP). Allí aparece la URL del webhook que hay que pegar en Twilio y en la «Route» de Mailgun para recibir respuestas.
- Los webhooks comprueban la firma de Twilio (`X-Twilio-Signature`) y de Mailgun; las peticiones falsas se rechazan.

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
     -f NO-SUBIR-supabase/10-crm-contactos-oportunidades.sql \
     -f NO-SUBIR-supabase/11-configuracion.sql \
     -f NO-SUBIR-supabase/12-calendarios.sql \
     -f NO-SUBIR-supabase/13-conversaciones.sql \
     -f NO-SUBIR-supabase/test-agencias.sql \
     -f NO-SUBIR-supabase/test-crm.sql \
     -f NO-SUBIR-supabase/test-configuracion.sql \
     -f NO-SUBIR-supabase/test-calendarios.sql \
     -f NO-SUBIR-supabase/test-conversaciones.sql
```

## Estructura

```
app/                 rutas (App Router) y Server Actions
  agencia/           vista de agencia
  subcuenta/[id]/    vista de subcuenta
  api/webhooks/      webhooks entrantes
components/shell/    barra lateral, selector, campana, menú de usuario
components/agencia/  tablero, subcuentas, facturación
components/crm/      contactos, ficha, importador, tareas, oportunidades, embudos
components/ui/       piezas comunes
lib/                 sesión, validación, Supabase, Stripe, formato
lib/crm/             columnas, filtros, CSV y validación de contactos
```

Cada módulo nuevo (contactos, oportunidades, conversaciones, calendarios…) cuelga
de `subcuenta_id` y usa `puedo_ver_subcuenta()` en sus políticas RLS.
