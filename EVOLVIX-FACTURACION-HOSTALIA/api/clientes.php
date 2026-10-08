<?php
require_once __DIR__ . '/seguridad.php';

$metodo = $_SERVER['REQUEST_METHOD'];
$pdo = evolvixConectar();

if ($metodo === 'GET') {
  evolvixRequiereSesion();
  $filas = $pdo->query('SELECT id, marca_id, nombre, cif, email, telefono, contacto FROM clientes ORDER BY nombre ASC')->fetchAll();
  evolvixJson(['ok' => true, 'datos' => $filas]);
}

if ($metodo === 'POST') {
  // Cualquier persona con sesión (admin o contable) puede dar de alta un
  // cliente — igual que la política "clientes_crea" en Supabase, que
  // dejaba hacerlo a cualquier autenticado, no solo a admin.
  $u = evolvixRequiereSesion();
  $c = evolvixCuerpo();
  $nombre = trim((string)($c['nombre'] ?? ''));
  $marcaId = (int)($c['marca_id'] ?? 0);
  if ($nombre === '') evolvixJson(['ok' => false, 'mensaje' => 'Ponle un nombre al cliente.'], 400);
  if ($marcaId <= 0) evolvixJson(['ok' => false, 'mensaje' => 'Elige una marca.'], 400);

  $stmt = $pdo->prepare(
    'INSERT INTO clientes (marca_id, nombre, cif, email, telefono, contacto, creado_por) VALUES (?,?,?,?,?,?,?)'
  );
  try {
    $stmt->execute([$marcaId, $nombre, trim((string)($c['cif'] ?? '')), trim((string)($c['email'] ?? '')),
      trim((string)($c['telefono'] ?? '')), trim((string)($c['contacto'] ?? '')), $u['id']]);
  } catch (PDOException $e) {
    evolvixJson(['ok' => false, 'mensaje' => 'La marca indicada no existe.'], 400);
  }
  $id = (int)$pdo->lastInsertId();
  $fila = $pdo->prepare('SELECT id, marca_id, nombre, cif, email, telefono, contacto FROM clientes WHERE id = ?');
  $fila->execute([$id]);
  evolvixJson(['ok' => true, 'datos' => [$fila->fetch()]]);
}

evolvixJson(['ok' => false, 'mensaje' => 'Método no permitido.'], 405);
