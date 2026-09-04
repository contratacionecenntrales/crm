# Labs Command Center 360 — Labs24k

Oficina virtual SaaS de la red comercial de Labs24k: panel de control, calendario, academia comercial, presupuestos, embudos de venta, auditorías IA, clientes, contratos y facturación, back office, asistentes de voz/WhatsApp e integraciones.

## Stack

Aplicación de una sola página (`index.html`) en JavaScript vanilla, sin build ni dependencias externas. Pensada para hosting compartido (Hostalia), servida como archivo estático mediante `.htaccess`.

- Todos los datos son de demostración (`DB` en el script).
- El estado de sesión y los datos editables (presupuestos, auditorías, pipeline) se guardan en `localStorage` del navegador para no perderse al recargar la página — no hay backend ni base de datos compartida.
- Incluye una hoja de impresión (`@media print`) para exportar presupuestos a PDF directamente desde el navegador.

## Uso local

```bash
python3 -m http.server 8080
# abrir http://localhost:8080/index.html
```

## Despliegue

Subir `index.html` y `.htaccess` a la raíz del hosting.
