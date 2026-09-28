# Conectar el CRM de Evolvix Global con Supabase

Este es un CRM **nuevo y separado** del Command Center de Labs24k: su propio
proyecto de Supabase, su propio inicio de sesión, su propia web. No comparte
usuarios ni datos con el otro sistema.

## Paso 0 · Crear el proyecto en Supabase

Si todavía no lo tienes:

1. Entra en [supabase.com](https://supabase.com) → **New project**.
2. Ponle un nombre (p. ej. `evolvix-facturacion`), elige una contraseña de base
   de datos (guárdala en un gestor de contraseñas, no hace falta para lo
   siguiente) y la región más cercana (Europa).
3. Espera dos o tres minutos a que el proyecto termine de crearse.

## Paso 1 · Crear las tablas

Panel de Supabase → **SQL Editor** → *New query*. Abre cada archivo, copia
**todo** el contenido y pégalo. En este orden:

| Orden | Archivo | Para qué |
|---|---|---|
| 1 | `01-esquema.sql` | Tablas (marcas, clientes, facturas), permisos y numeración automática |
| 2 | `02-cuenta-admin.sql` | **Crea tu usuario administrador.** Sin esto no se puede entrar |

Con esos dos archivos ya está todo: no hay más módulos que instalar, a
diferencia del Command Center de Labs24k.

> El archivo `_stub-auth.sql` **no se ejecuta en Supabase**: es la pieza que
> usamos aquí, en local, para probar las reglas de seguridad antes de
> entregarte nada.

## Paso 2 · Crear tu cuenta de administrador

Antes de pegar `02-cuenta-admin.sql`, ábrelo con el Bloc de notas y cambia
estas dos líneas por tus datos reales:

```sql
v_email text := 'PON-AQUI-EL-CORREO-REAL@evolvixglobal.com';
v_clave text := 'PON-AQUI-TU-CONTRASEÑA-REAL';
```

La contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula,
número y símbolo. Guarda el archivo, pégalo entero en el SQL Editor y pulsa
**Run**. Al final te devuelve una fila de comprobación: si `rol` sale `admin`
y `estado` sale `Activo`, tu cuenta ya existe.

Puedes volver a ejecutar este mismo archivo más adelante, cambiando el correo,
para crear cuentas de **contable** (edita la fila final del archivo cambiando
`'admin'` por `'contable'` si quieres dar acceso a alguien de contabilidad sin
permiso para crear marcas nuevas).

## Paso 3 · Autorizar tu dominio

*Authentication* → **URL Configuration** → *Site URL* y *Redirect URLs*: añade
la dirección exacta donde vayas a publicar este panel en Hostalia (por
ejemplo `https://facturacion.evolvixglobal.com`). Sin esto Supabase rechaza
los inicios de sesión desde esa web.

## Paso 4 · Conectar el panel con tu proyecto

Necesitas dos datos de tu proyecto, en *Project Settings → API*:

| Dato | Cómo se llama en Supabase | Ejemplo |
|---|---|---|
| **URL del proyecto** | Project URL | `https://abcdefghijk.supabase.co` |
| **Clave publicable** | `anon` `public` (o `sb_publishable_...`) | empieza distinto según la versión del panel de Supabase, pero siempre está en esa misma pantalla |

**Esa clave es pública a propósito**: no da ningún acceso por sí sola, todo lo
filtran las políticas de seguridad de la base de datos según quién haya
iniciado sesión. **No es la clave `service_role` / secreta** — esa no se pega
nunca en un archivo que se sube a un servidor.

Abre `index.html` con el Bloc de notas, busca esta línea (aparece una sola
vez, cerca del principio del `<script>`):

```js
var SB_DEFECTO = { url:'', clave:'', activo:true };
```

y sustitúyela por tus valores reales, por ejemplo:

```js
var SB_DEFECTO = { url:'https://abcdefghijk.supabase.co', clave:'eyJhbGciOi...', activo:true };
```

Guarda el archivo con codificación **UTF-8** (el Bloc de notas de Windows lo
hace por defecto) y ya está listo para subir a Hostalia.

## Comprobar que ha funcionado

Sube `index.html` y `.htaccess` a tu hosting, ábrelo en el navegador y entra
con el correo y la contraseña que pusiste en el paso 2. Deberías ver el
**Resumen del Grupo** con la marca «Evolvix Global» ya creada (la crea el
propio `01-esquema.sql`), aunque todavía sin facturas.

Si algo falla, el panel lo dice en la pantalla de acceso en vez de quedarse
colgado — comprueba primero que la URL y la clave del paso 4 estén bien
copiadas, sin espacios delante ni detrás.

## Añadir más marcas del grupo más adelante

Solo un administrador puede hacerlo, desde el propio panel: **Marcas → Nueva
marca**. No hace falta tocar ninguna base de datos ni ningún archivo — el
sistema está pensado desde el principio para que Evolvix Global no sea la
única marca para siempre.

---

## Qué protege la base de datos, no la aplicación

- Solo un administrador puede crear o desactivar marcas.
- Un contable puede dar de alta clientes y facturas, pero no marcas.
- La numeración de cada factura (`EVO-2026-0001`, por ejemplo) la calcula la
  propia base de datos, correlativa por marca y por año — nunca se puede
  repetir ni saltarse un número a mano.
- **Ninguna factura se puede borrar**, ni siquiera un administrador. Solo se
  puede anular, y queda constancia de que existió.
- Cada factura creada y cada cambio de estado (pendiente → pagada / impagada)
  deja una fila en un histórico que tampoco se puede editar ni borrar desde la
  aplicación.

## Comprobaciones automáticas pasadas

Contra un PostgreSQL real, con el `auth` de Supabase imitado
(`_stub-auth.sql`):

- Un administrador puede crear una segunda marca; un contable **no** puede
  (bloqueado por las políticas de seguridad de la base de datos, no por el
  botón que está oculto).
- Un contable sí puede dar de alta clientes y facturas.
- Dos facturas seguidas de la misma marca reciben números correlativos
  (`EVO-2026-0001`, `EVO-2026-0002`) sin colisión.
- Crear una factura y cambiarla a «Pagada» deja exactamente dos filas en el
  histórico — ni una menos, ni ninguna se puede reescribir.
- Nadie, ni el propio administrador, puede borrar una factura.

Contra el panel real en un navegador (Chromium, sin cabeza), con la misma
Content-Security-Policy que llevará en producción: inicio de sesión, las
cuatro vistas (Resumen, Marcas, Clientes, Facturas) para los dos roles, la
creación de una marca, la creación de una factura con varios conceptos — sin
ningún error de consola ni ninguna violación de la política de seguridad.

---

*Evolvix Global · Grupo Evolvix Global SL*
