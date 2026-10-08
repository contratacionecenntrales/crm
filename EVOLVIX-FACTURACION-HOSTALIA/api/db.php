<?php
require_once __DIR__ . '/config.php';

function evolvixConectar(): PDO {
  static $pdo = null;
  if ($pdo !== null) return $pdo;

  $dsn = 'mysql:host=' . EVOLVIX_DB_HOST . ';dbname=' . EVOLVIX_DB_NOMBRE . ';charset=utf8mb4';
  try {
    $pdo = new PDO($dsn, EVOLVIX_DB_USUARIO, EVOLVIX_DB_CLAVE, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
  } catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'mensaje' => 'No se ha podido conectar con la base de datos.',
      'detalle' => EVOLVIX_DEPURAR ? $e->getMessage() : null]);
    exit;
  }
  return $pdo;
}
