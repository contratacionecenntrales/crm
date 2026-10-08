<?php
require_once __DIR__ . '/seguridad.php';

$u = evolvixUsuarioActual();
if (!$u) evolvixJson(['ok' => false], 401);

// Vuelve a comprobar el estado en la base de datos, no solo lo que guardó
// la sesión al iniciar: si un admin suspende la cuenta mientras la persona
// sigue con el panel abierto, se le echa en la siguiente carga.
$pdo = evolvixConectar();
$stmt = $pdo->prepare('SELECT estado FROM perfiles WHERE id = ?');
$stmt->execute([$u['id']]);
$estado = $stmt->fetchColumn();
if ($estado !== 'Activo') {
  $_SESSION = [];
  evolvixJson(['ok' => false, 'mensaje' => 'Tu cuenta está suspendida.'], 403);
}

evolvixJson(['ok' => true, 'usuario' => $u, 'csrf' => evolvixTokenCsrf()]);
