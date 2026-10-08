# Instalar el CRM de Evolvix Global en Hostalia

Esta versión no usa Supabase: la base de datos, el panel y la lógica que
protege quién puede hacer qué viven **enteros en tu propio hosting de
Hostalia**, en MySQL y PHP (lo que trae de serie cualquier plan de Hostalia
con web). No hace falta terminal ni SSH: todo se hace desde el panel de
Hostalia (Plesk o cPanel) y desde el navegador.

## Paso 1 · Crear la base de datos MySQL

En el panel de Hostalia: **Bases de datos → Crear base de datos MySQL**.
Apunta estos cuatro datos que te da Hostalia al crearla — los necesitarás en
el paso 3:

- Servidor (host): a veces es `localhost`, a veces algo como `mysqlXXX.hostalia.com`
- Nombre de la base de datos
- Usuario
- Contraseña

## Paso 2 · Crear las tablas

Entra en **phpMyAdmin** desde el panel de Hostalia, elige tu base de datos
nueva, pestaña **SQL**, y pega entero el contenido de `sql/01-esquema.sql`.
Pulsa **Continuar/Ejecutar**.

Verás al final una fila de comprobación: `marcas >= 1` y `tablas_creadas = 7`.
Esto crea las tablas y siembra la marca «Evolvix Global», ya lista.

## Paso 3 · Subir los archivos

Sube **todo** el contenido de esta carpeta (`index.html`, `.htaccess`,
`instalar.php`, la carpeta `api/`) a la raíz de tu dominio en Hostalia
(normalmente `httpdocs` o `public_html`), con el administrador de archivos o
por FTP. La carpeta `sql/` también puedes subirla como referencia, aunque
ya no hace falta después del paso 2 (el `.htaccess` impide que nadie pueda
descargar los `.sql` directamente).

Abre `api/config.php` con el editor de archivos de Hostalia (o descárgalo,
edítalo con el Bloc de notas, y vuelve a subirlo) y rellena los cuatro datos
del paso 1:

```php
define('EVOLVIX_DB_HOST', 'el-servidor-que-te-dio-hostalia');
define('EVOLVIX_DB_NOMBRE', 'el-nombre-de-tu-base-de-datos');
define('EVOLVIX_DB_USUARIO', 'tu-usuario-mysql');
define('EVOLVIX_DB_CLAVE', 'tu-contraseña-mysql');
```

## Paso 4 · Crear tu cuenta de administrador

Abre en el navegador `https://tudominio.com/instalar.php`, rellena el
formulario (nombre, correo, contraseña de al menos 10 caracteres con
mayúscula, minúscula, número y símbolo) y pulsa **Crear administrador**.

**Después de usarlo, borra `instalar.php` del servidor** con el
administrador de archivos de Hostalia. El propio script se niega a
funcionar una segunda vez en cuanto existe cualquier cuenta, pero es más
limpio no dejarlo ahí.

## Comprobar que ha funcionado

Abre `https://tudominio.com/index.html`, entra con el correo y la
contraseña del paso 4. Deberías ver el **Resumen del Grupo** con la marca
«Evolvix Global» ya creada, sin facturas todavía.

## Añadir más cuentas (admin o contable) más adelante

No hace falta volver a tocar `instalar.php`. Abre
`https://tudominio.com/api/generar-hash.php`, escribe la contraseña que
quieras darle a la persona, y te da dos cosas: el valor cifrado, y una
plantilla de `INSERT` ya lista para pegar en phpMyAdmin (pestaña SQL) —
solo tienes que cambiar el correo, el nombre y el rol (`'admin'` o
`'contable'`).

## Añadir más marcas del grupo

Solo un administrador puede hacerlo, desde el propio panel: **Marcas →
Nueva marca**. No hace falta tocar la base de datos ni ningún archivo.

---

## Qué protege cada capa, y una diferencia honesta con la versión de Supabase

En la versión de Supabase, la propia base de datos (con RLS, seguridad por
fila) garantizaba estas reglas aunque alguien se saltara la aplicación. En
MySQL compartido de Hostalia esa garantía no existe de la misma forma: el
usuario de base de datos que te da Hostalia normalmente tiene permiso total
sobre su propia base. Así que aquí estas reglas las hace cumplir el código
PHP de `api/`, no MySQL:

- **Sesión por cookie**, segura (`HttpOnly`, `Secure` en HTTPS, `SameSite=Strict`)
  y un token anti-CSRF que se comprueba en cada acción que cambia datos.
- Solo un administrador puede crear marcas nuevas (`api/marcas.php`
  comprueba el rol antes de tocar la base de datos).
- Cualquier persona con sesión puede dar de alta clientes y facturas.
- **Ninguna factura se puede borrar nunca** — no porque la base de datos lo
  impida, sino porque `api/facturas.php` sencillamente no tiene ningún
  método para borrar una. Solo existe anular.
- Cada factura creada y cada cambio de estado quedan en un histórico
  (`factura_eventos`) que la aplicación solo puede rellenar, nunca editar
  ni borrar.
- La numeración de cada factura (`EVO-2026-0001`, por marca y año) la
  calcula el propio servidor con un truco de MySQL pensado para que dos
  facturas creadas a la vez por personas distintas nunca choquen.

Si en algún momento tu plan de Hostalia te permite crear un segundo usuario
de MySQL con permisos restringidos (por ejemplo, sin `DELETE` en la tabla
`facturas`), dímelo y añado esa capa de más como refuerzo — pero el sistema
ya es seguro sin ella, porque esa puerta simplemente no existe en el código.

## Comprobaciones hechas antes de entregarte esto

Contra una base de datos MySQL/MariaDB real y el propio PHP (sin trucos ni
simulaciones):

- Un administrador crea una segunda marca; una cuenta de contable **no**
  puede (bloqueado por `api/marcas.php`, con 403).
- Una petición que cambia datos sin el token anti-CSRF se rechaza (403).
- Dos facturas seguidas, de marcas distintas, reciben numeración
  correlativa independiente (`EVO-2026-0001`, `LAB-2026-0001`).
- Cada factura creada deja su evento en el histórico; cada cambio de estado
  deja uno más.
- Intentar borrar una factura por la API da **405** (ese método no existe).
- El formulario de instalación se niega a crear una segunda cuenta en
  cuanto ya existe una.

Y en un navegador real (Chromium, sin cabeza), con la misma
Content-Security-Policy que llevará en producción: inicio de sesión, las
cuatro vistas para los dos roles, crear una marca, crear un cliente y crear
una factura completa con varios conceptos — comprobando además, con
tráfico real a la base de datos (no datos de prueba simulados), que el
importe final calculado por la aplicación coincide con el que queda
guardado.

---

*Evolvix Global · Grupo Evolvix Global SL*
