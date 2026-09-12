# Labs Command Center 360™

Oficina virtual de la red comercial de **Labs24k** (Grupo Evolvix Global, S.L.).

Panel de CRM en dos páginas HTML autocontenidas (sin Node, sin npm, sin build),
que hablan directamente con Supabase por `fetch`. Incluye un backend Node/Express
opcional para gestión de usuarios y una Edge Function equivalente para Supabase.

## Estructura

| Carpeta / archivo | Qué es | ¿Se sube al hosting? |
|---|---|---|
| `SUBIR-A-HOSTALIA/` | El panel (`index.html`), la página de firma del cliente (`firmar.html`), `.htaccess` y `test.html` | **Sí** — solo el contenido de esta carpeta |
| `NO-SUBIR-supabase/` | Guiones SQL (`01`–`05`) y la Edge Function `admin-usuarios` | No — se pegan en el editor SQL de Supabase / se despliegan como función |
| `NO-SUBIR-backend/` | API Node.js/Express opcional (gestión de usuarios, auditoría) | No — requiere un servidor con Node, no hosting compartido |
| `documentacion/` | Guías de instalación y ejemplos en PDF | No — solo lectura |
| `LEEME-PRIMERO.txt` | Resumen rápido de instalación en Hostalia | — |

Empieza por `LEEME-PRIMERO.txt` y `documentacion/LEEME-INSTALACION.md` para el
detalle completo (subida por FTP, orden de los guiones SQL, claves de Supabase,
circuito de firma de contratos, etc).

## Aviso de seguridad

`NO-SUBIR-supabase/02-cuenta-raiz.sql` contiene la contraseña inicial de la
cuenta administradora en texto legible, y `NO-SUBIR-backend/.env.example`
solo lleva valores de ejemplo. Ninguna de las dos carpetas `NO-SUBIR-*` debe
subirse a la carpeta pública del hosting — ver `AVISO-NO-SUBIR.txt` en cada una.
