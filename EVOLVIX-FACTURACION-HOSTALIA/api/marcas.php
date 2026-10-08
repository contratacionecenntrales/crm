<?php
require_once __DIR__ . '/seguridad.php';
require_once __DIR__ . '/numeracion.php';

$metodo = $_SERVER['REQUEST_METHOD'];
$pdo = evolvixConectar();

if ($metodo === 'GET') {
  evolvixRequiereSesion();
  $filas = $pdo->query('SELECT id, nombre, cif, email, color, activa FROM marcas ORDER BY nombre ASC')->fetchAll();
  foreach ($filas as &$f) $f['activa'] = (bool)$f['activa'];
  evolvixJson(['ok' => true, 'datos' => $filas]);
}

if ($metodo === 'POST') {
  // Solo un administrador puede crear marcas nuevas — regla de negocio
  // central de este sistema, la misma que en Supabase imponía la política
  // RLS "marcas_admin". Aquí la impone esta sola línea.
  evolvixRequiereAdmin();
  $c = evolvixCuerpo();
  $nombre = trim((string)($c['nombre'] ?? ''));
  if ($nombre === '') evolvixJson(['ok' => false, 'mensaje' => 'Ponle un nombre a la marca.'], 400);

  $prefijo = evolvixPrefijoDisponible($pdo, $nombre);
  $stmt = $pdo->prepare('INSERT INTO marcas (nombre, prefijo, cif, email, color, activa) VALUES (?,?,?,?,?,1)');
  try {
    $stmt->execute([$nombre, $prefijo, trim((string)($c['cif'] ?? '')), trim((string)($c['email'] ?? '')),
      (string)($c['color'] ?? '#17C8C0')]);
  } catch (PDOException $e) {
    evolvixJson(['ok' => false, 'mensaje' => 'Ya existe una marca con ese nombre.'], 409);
  }
  $id = (int)$pdo->lastInsertId();
  $fila = $pdo->prepare('SELECT id, nombre, cif, email, color, activa FROM marcas WHERE id = ?');
  $fila->execute([$id]);
  $m = $fila->fetch();
  $m['activa'] = (bool)$m['activa'];
  evolvixJson(['ok' => true, 'datos' => [$m]]);
}

if ($metodo === 'PATCH') {
  evolvixRequiereAdmin();
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) evolvixJson(['ok' => false, 'mensaje' => 'Falta el identificador de la marca.'], 400);
  $c = evolvixCuerpo();
  if (!array_key_exists('activa', $c)) evolvixJson(['ok' => false, 'mensaje' => 'No hay nada que actualizar.'], 400);
  $stmt = $pdo->prepare('UPDATE marcas SET activa = ? WHERE id = ?');
  $stmt->execute([$c['activa'] ? 1 : 0, $id]);
  evolvixJson(['ok' => true]);
}

evolvixJson(['ok' => false, 'mensaje' => 'Método no permitido.'], 405);
