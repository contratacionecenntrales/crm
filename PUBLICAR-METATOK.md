# Publicar Metatok en metatok.labs24k.com

Tres piezas, cada una en su sitio:

| Pieza | Dónde | Coste |
|---|---|---|
| Base de datos, usuarios y archivos | **Supabase** (región Frankfurt, datos en la UE) | Gratis para empezar · Pro 25 $/mes |
| La plataforma (Next.js) | **Vercel** (región Frankfurt) | Gratis para probar · Pro 20 $/mes para uso comercial |
| El dominio `labs24k.com` y el correo | **Hostalia** (lo que ya tienes) | Lo que ya pagas |

El alojamiento normal de Hostalia no puede ejecutar la plataforma (no tiene Node).
Por eso solo se usa para el dominio: el subdominio `metatok` apunta a Vercel.
El panel antiguo (`SUBIR-A-HOSTALIA/`) sigue igual en Hostalia.

> Tiempo total: unos 45 minutos. Haz los pasos en orden.

---

## 1 · Supabase (base de datos)

1. Entra en <https://supabase.com> → **New project**.
   - Name: `metatok` · Region: **Central EU (Frankfurt)** · Database password: una larga (guárdala).
2. **SQL Editor** → **New query**. Abre cada archivo de `NO-SUBIR-supabase/`, pega
   su contenido y pulsa **Run**, uno por uno y **en este orden**:
   `09`, `10`, `11`, … hasta `33`.
   - No ejecutes los `01`–`08` (son del panel antiguo), ni los `test-…` ni los `_…`.
   - Si alguno da error, para y mándame el mensaje.
3. **Project Settings → API**: copia **Project URL**, la clave **anon public** y la
   clave **service_role** (esta es secreta). Las usarás en Vercel.
4. **Authentication → URL Configuration**:
   - Site URL: `https://metatok.labs24k.com`
   - Redirect URLs: añade `https://metatok.labs24k.com/**`
5. **Authentication → Emails → SMTP Settings** → activa *Custom SMTP* con un buzón de
   Hostalia (p. ej. `no-responder@labs24k.com`):
   - Host y puerto: los de tu correo en el panel de Hostalia (normalmente puerto 587).
   - Usuario: el buzón completo · Contraseña: la del buzón.
   - Sin esto, Supabase solo manda unos pocos correos por hora (invitaciones y
     recuperar contraseña).
6. **Authentication → Emails → Templates**: pega las plantillas en español que
   explica `plataforma/README.md` (apartado «Plantillas de correo de Supabase»).

## 2 · Vercel (la plataforma)

1. Entra en <https://vercel.com> con tu cuenta de GitHub → **Add New → Project** →
   importa el repositorio `contratacionecenntrales/crm`.
2. **Root Directory**: `plataforma` (importante). Framework: Next.js (sale solo).
3. **Environment Variables** (todas en *Production*):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | clave service_role (secreta) |
   | `NEXT_PUBLIC_SITE_URL` | `https://metatok.labs24k.com` |
   | `CRON_SECRET` | una cadena larga al azar (mínimo 32 caracteres; guárdala) |
   | `ANTHROPIC_API_KEY` | tu clave de la IA (asistentes, voz, páginas con IA) |
   | `IA_PROVEEDOR_PAGINAS` | `claude` |
   | `STRIPE_WEBHOOK_SECRET` | solo si cobras con Stripe |

4. **Deploy**. Cuando termine, **Settings → Domains → Add** → `metatok.labs24k.com`.
   Vercel te enseña el registro DNS que tienes que crear (un **CNAME**).

## 3 · Hostalia (el subdominio)

En el panel de Hostalia → tu dominio `labs24k.com` → **Zona DNS / Gestión DNS** →
añadir registro:

| Tipo | Nombre | Valor |
|---|---|---|
| CNAME | `metatok` | el que te dé Vercel (normalmente `cname.vercel-dns.com.`) |

- No toques los registros del correo (MX) ni el de `www`: el resto de tu web y tu
  correo siguen igual.
- Tarda de unos minutos a unas horas. Cuando funcione, Vercel pone el candado
  (HTTPS) solo y en **Domains** sale «Valid Configuration».
- El error `DNS_PROBE_FINISHED_NXDOMAIN` significa que este registro aún no existe
  o no se ha propagado.

## 4 · Últimos pasos en Supabase (SQL Editor)

1. Tareas programadas (recordatorios, automatizaciones, campañas, IA), con el mismo
   `CRON_SECRET` que pusiste en Vercel:
   ```sql
   select public.programar_tareas('https://metatok.labs24k.com', 'TU_CRON_SECRET');
   ```
   A los dos minutos, comprueba que responde con código 200:
   ```sql
   select * from public.tareas_ultimas;
   ```
2. Tu usuario: **Authentication → Users → Add user** (con tu correo y contraseña,
   marcando *Auto Confirm User*). Después, en el SQL Editor:
   ```sql
   select public.plataforma_alta_admin('tu-correo@labs24k.com');
   ```
3. Entra en `https://metatok.labs24k.com`: te pedirá el nombre de tu primera agencia.

## 5 · Integraciones (cuando las uses)

- **Twilio** (SMS, WhatsApp y llamadas): cada subcuenta lo conecta en
  *Configuración → Integración telefónica*; allí salen las URLs que hay que pegar en
  Twilio. Para el asistente de voz: `https://metatok.labs24k.com/api/voz/<id de la subcuenta>`.
- **Stripe**: webhook a `https://metatok.labs24k.com/api/webhooks/stripe`
  (detalles en `plataforma/README.md`).

## Si algo falla

| Síntoma | Causa |
|---|---|
| `DNS_PROBE_FINISHED_NXDOMAIN` | Falta el CNAME `metatok` en Hostalia o aún no se ha propagado |
| Página de error de Vercel 404 | El dominio no está añadido en Vercel → Settings → Domains |
| «Falta la variable de entorno…» | Falta una variable en Vercel: añádela y pulsa **Redeploy** |
| No llegan invitaciones | SMTP sin configurar en Supabase (paso 1.5) |
| No salen recordatorios ni campañas | Paso 4.1 sin hacer o `CRON_SECRET` distinto en Vercel y Supabase |

---

**Alternativa sin Supabase ni Vercel:** todo en un VPS de Hostalia, con la carpeta
`servidor-hostalia/` (`sudo bash instalar.sh`).
