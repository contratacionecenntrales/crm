<?php
require_once __DIR__ . '/seguridad.php';
evolvixIniciaSesion();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') evolvixJson(['ok' => false, 'mensaje' => 'Método no permitido.'], 405);

$cuerpo = evolvixCuerpo();
$email = trim((string)($cuerpo['email'] ?? ''));
$clave = (string)($cuerpo['password'] ?? '');
if ($email === '' || $clave === '') {
  evolvixJson(['ok' => false, 'mensaje' => 'Escribe tu correo y tu contraseña.'], 400);
}

$pdo = evolvixConectar();
$stmt = $pdo->prepare('SELECT * FROM perfiles WHERE email = ?');
$stmt->execute([$email]);
$perfil = $stmt->fetch();

// Mismo mensaje tanto si el correo no existe como si la contraseña es
// incorrecta: así nadie puede usar este formulario para averiguar qué
// correos tienen cuenta en el sistema.
if (!$perfil || !password_verify($clave, $perfil['clave_hash'])) {
  evolvixJson(['ok' => false, 'mensaje' => 'Credenciales incorrectas.'], 401);
}
if ($perfil['estado'] !== 'Activo') {
  evolvixJson(['ok' => false, 'mensaje' => 'Tu cuenta está suspendida.'], 403);
}

session_regenerate_id(true);
$_SESSION['uid'] = $perfil['id'];
$_SESSION['nombre'] = $perfil['nombre'];
$_SESSION['apellidos'] = $perfil['apellidos'];
$_SESSION['email'] = $perfil['email'];
$_SESSION['rol'] = $perfil['rol'];

evolvixJson([
  'ok' => true,
  'usuario' => ['id' => $perfil['id'], 'nombre' => $perfil['nombre'], 'apellidos' => $perfil['apellidos'],
    'email' => $perfil['email'], 'rol' => $perfil['rol']],
  'csrf' => evolvixTokenCsrf(),
]);
