<?php
// =============================================================================
// EVOLVIX GLOBAL · Instalación de la primera cuenta de administrador
//
// Abre este archivo en tu navegador (https://tudominio.com/instalar.php)
// UNA SOLA VEZ, después de haber ejecutado sql/01-esquema.sql. Rellena el
// formulario y pulsa Crear.
//
// Por seguridad, este script se niega a funcionar si ya existe cualquier
// cuenta en el sistema — así que, aunque alguien más encontrara esta
// dirección, no podría usarla para crear una cuenta de administrador.
// Aun así, en cuanto hayas creado la tuya, BORRA este archivo del servidor
// (o renómbralo) con el administrador de archivos de Hostalia.
// =============================================================================

require_once __DIR__ . '/api/db.php';

$pdo = evolvixConectar();
$yaHayCuentas = (int)$pdo->query('SELECT COUNT(*) FROM perfiles')->fetchColumn() > 0;

$error = '';
$exito = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$yaHayCuentas) {
  $nombre = trim($_POST['nombre'] ?? '');
  $apellidos = trim($_POST['apellidos'] ?? '');
  $email = trim($_POST['email'] ?? '');
  $clave = (string)($_POST['clave'] ?? '');

  if ($nombre === '' || $email === '') {
    $error = 'Rellena al menos el nombre y el correo.';
  } elseif (strlen($clave) < 10 || !preg_match('/[a-z]/', $clave) || !preg_match('/[A-Z]/', $clave)
      || !preg_match('/[0-9]/', $clave) || !preg_match('/[^A-Za-z0-9]/', $clave)) {
    $error = 'La contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula, número y símbolo.';
  } else {
    $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
      mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000,
      mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
    $hash = password_hash($clave, PASSWORD_BCRYPT);
    $pdo->prepare('INSERT INTO perfiles (id, nombre, apellidos, email, clave_hash, rol, estado) VALUES (?,?,?,?,?,\'admin\',\'Activo\')')
      ->execute([$id, $nombre, $apellidos, $email, $hash]);
    $exito = true;
    $yaHayCuentas = true;
  }
}
?>
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Instalación · Evolvix Global</title>
<style>
body{font-family:system-ui,sans-serif;background:#0B1120;color:#E2E8F0;display:flex;min-height:100vh;
  align-items:center;justify-content:center;margin:0}
.card{background:#121A2E;border:1px solid #1F2A44;border-radius:16px;padding:32px;max-width:420px;width:100%}
h1{font-size:18px;margin:0 0 18px}
label{display:block;font-size:12px;color:#8A96AE;margin:14px 0 5px}
input{width:100%;padding:9px 11px;border-radius:9px;border:1px solid #1F2A44;background:#0F1626;color:#E2E8F0;
  font-size:14px;box-sizing:border-box}
button{margin-top:20px;width:100%;padding:11px;border-radius:9px;border:none;background:#17C8C0;color:#04231A;
  font-weight:600;font-size:14px;cursor:pointer}
.msg{padding:10px 12px;border-radius:9px;font-size:13px;margin-bottom:10px}
.err{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#FCA5A5}
.ok{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);color:#86EFAC}
</style></head><body>
<div class="card">
<h1>Instalación de Evolvix Global</h1>
<?php if ($exito): ?>
  <div class="msg ok">Cuenta creada. Ya puedes entrar en <code>index.html</code> con ese correo y esa contraseña.</div>
  <div class="msg err">Ahora BORRA este archivo (<code>instalar.php</code>) del servidor.</div>
<?php elseif ($yaHayCuentas): ?>
  <div class="msg err">Ya existe al menos una cuenta en el sistema. Por seguridad, este formulario no vuelve a
    funcionar. Borra este archivo si todavía está en el servidor.</div>
<?php else: ?>
  <?php if ($error): ?><div class="msg err"><?= htmlspecialchars($error) ?></div><?php endif; ?>
  <form method="post">
    <label>Nombre</label><input name="nombre" required>
    <label>Apellidos</label><input name="apellidos">
    <label>Correo</label><input name="email" type="email" required>
    <label>Contraseña</label><input name="clave" type="password" required>
    <button type="submit">Crear administrador</button>
  </form>
<?php endif; ?>
</div>
</body></html>
