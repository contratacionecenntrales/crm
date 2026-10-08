<?php
require_once __DIR__ . '/seguridad.php';
require_once __DIR__ . '/numeracion.php';

$metodo = $_SERVER['REQUEST_METHOD'];
$pdo = evolvixConectar();

if ($metodo === 'GET') {
  evolvixRequiereSesion();
  $filas = $pdo->query(
    'SELECT id, numero, marca_id, cliente_id, fecha_emision, fecha_pago, base, iva, total, estado
     FROM facturas ORDER BY creado DESC'
  )->fetchAll();
  evolvixJson(['ok' => true, 'datos' => $filas]);
}

if ($metodo === 'POST') {
  $u = evolvixRequiereSesion();
  $c = evolvixCuerpo();
  $marcaId = (int)($c['marca_id'] ?? 0);
  $clienteId = (int)($c['cliente_id'] ?? 0);
  $iva = (float)($c['iva'] ?? 21);
  $lineas = is_array($c['lineas'] ?? null) ? $c['lineas'] : [];
  $lineas = array_values(array_filter($lineas, fn($l) => trim((string)($l['descripcion'] ?? '')) !== ''));

  if ($marcaId <= 0) evolvixJson(['ok' => false, 'mensaje' => 'Elige una marca.'], 400);
  if ($clienteId <= 0) evolvixJson(['ok' => false, 'mensaje' => 'Elige un cliente.'], 400);
  if (!$lineas) evolvixJson(['ok' => false, 'mensaje' => 'Añade al menos un concepto.'], 400);

  $base = 0.0;
  foreach ($lineas as $l) $base += (float)($l['cantidad'] ?? 0) * (float)($l['precio_unitario'] ?? 0);
  $base = round($base, 2);
  $total = round($base * (1 + $iva / 100), 2);

  // Todo (número, factura, líneas y el primer evento del histórico) se
  // confirma junto en una sola transacción: si algo falla a mitad, no
  // queda ni un número consumido sin factura, ni una factura sin líneas.
  $pdo->beginTransaction();
  try {
    $numero = evolvixSiguienteNumeroFactura($pdo, $marcaId);

    $ins = $pdo->prepare(
      'INSERT INTO facturas (numero, marca_id, cliente_id, fecha_emision, base, iva, total, estado, creado_por)
       VALUES (?,?,?,CURDATE(),?,?,?,\'Pendiente\',?)'
    );
    $ins->execute([$numero, $marcaId, $clienteId, $base, $iva, $total, $u['id']]);
    $facturaId = (int)$pdo->lastInsertId();

    $insLinea = $pdo->prepare(
      'INSERT INTO factura_lineas (factura_id, descripcion, cantidad, precio_unitario, orden) VALUES (?,?,?,?,?)'
    );
    foreach ($lineas as $i => $l) {
      $insLinea->execute([$facturaId, trim((string)$l['descripcion']), (float)($l['cantidad'] ?? 0),
        (float)($l['precio_unitario'] ?? 0), $i]);
    }

    $pdo->prepare('INSERT INTO factura_eventos (factura_id, tipo, detalle, creado_por) VALUES (?,\'creada\',?,?)')
      ->execute([$facturaId, "Factura $numero creada.", $u['id']]);

    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    evolvixJson(['ok' => false, 'mensaje' => 'No se ha podido registrar la factura.',
      'detalle' => EVOLVIX_DEPURAR ? $e->getMessage() : null], 500);
  }

  evolvixJson(['ok' => true, 'datos' => [[
    'id' => $facturaId, 'numero' => $numero, 'marca_id' => $marcaId, 'cliente_id' => $clienteId,
    'base' => $base, 'iva' => $iva, 'total' => $total, 'estado' => 'Pendiente',
  ]]]);
}

if ($metodo === 'PATCH') {
  // Cambiar el estado (marcar pagada, impagada o anular) sí está permitido
  // a cualquier autenticado, igual que en la versión de Supabase. Lo que
  // NO existe aquí, a propósito, es un método DELETE: ninguna factura se
  // puede borrar nunca, ni siquiera un administrador. Para "quitar" una
  // factura, la única opción es marcarla como Anulada, y queda constancia
  // de que existió.
  $u = evolvixRequiereSesion();
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) evolvixJson(['ok' => false, 'mensaje' => 'Falta el identificador de la factura.'], 400);
  $c = evolvixCuerpo();
  $estado = (string)($c['estado'] ?? '');
  if (!in_array($estado, ['Pagada', 'Impagada', 'Anulada'], true)) {
    evolvixJson(['ok' => false, 'mensaje' => 'Estado no válido.'], 400);
  }

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare('SELECT numero FROM facturas WHERE id = ?');
    $stmt->execute([$id]);
    $numero = $stmt->fetchColumn();
    if ($numero === false) throw new RuntimeException('La factura no existe.');

    if ($estado === 'Pagada') {
      $pdo->prepare('UPDATE facturas SET estado = ?, fecha_pago = CURDATE() WHERE id = ?')->execute([$estado, $id]);
    } else {
      $pdo->prepare('UPDATE facturas SET estado = ? WHERE id = ?')->execute([$estado, $id]);
    }

    $pdo->prepare('INSERT INTO factura_eventos (factura_id, tipo, detalle, creado_por) VALUES (?,?,?,?)')
      ->execute([$id, 'estado:' . $estado, "Factura $numero pasó a $estado.", $u['id']]);

    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    evolvixJson(['ok' => false, 'mensaje' => 'No se ha podido actualizar la factura.',
      'detalle' => EVOLVIX_DEPURAR ? $e->getMessage() : null], 500);
  }

  evolvixJson(['ok' => true]);
}

evolvixJson(['ok' => false, 'mensaje' => 'Método no permitido.'], 405);
