<?php
require_once __DIR__ . '/seguridad.php';
evolvixRequiereSesion();

$pdo = evolvixConectar();
$filas = $pdo->query(
  "SELECT
     m.id, m.nombre AS marca, m.color,
     COUNT(f.id) AS facturas_totales,
     COUNT(DISTINCT CASE WHEN f.estado <> 'Anulada' THEN f.cliente_id END) AS clientes_facturados,
     COALESCE(SUM(CASE WHEN f.estado <> 'Anulada' THEN f.total ELSE 0 END), 0) AS facturado,
     COALESCE(SUM(CASE WHEN f.estado = 'Pagada' THEN f.total ELSE 0 END), 0) AS cobrado,
     COALESCE(SUM(CASE WHEN f.estado = 'Pendiente' THEN f.total ELSE 0 END), 0) AS pendiente,
     COALESCE(SUM(CASE WHEN f.estado = 'Impagada' THEN f.total ELSE 0 END), 0) AS impagado
   FROM marcas m
   LEFT JOIN facturas f ON f.marca_id = m.id
   GROUP BY m.id, m.nombre, m.color
   ORDER BY facturado DESC"
)->fetchAll();

foreach ($filas as &$f) {
  foreach (['facturas_totales', 'clientes_facturados'] as $k) $f[$k] = (int)$f[$k];
  foreach (['facturado', 'cobrado', 'pendiente', 'impagado'] as $k) $f[$k] = (float)$f[$k];
}

evolvixJson(['ok' => true, 'datos' => $filas]);
