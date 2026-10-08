<?php
// =============================================================================
// Utilidad para crear MÁS cuentas (admin o contable) después de la
// instalación inicial. No toca la base de datos: solo convierte una
// contraseña en el valor cifrado que hay que pegar en un INSERT desde
// phpMyAdmin. Puedes dejarlo en el servidor o borrarlo; no es un riesgo
// como instalar.php porque no crea ninguna cuenta por sí mismo.
// =============================================================================

$hash = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['clave'] ?? '') !== '') {
  $hash = password_hash($_POST['clave'], PASSWORD_BCRYPT);
}
?>
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Generar hash · Evolvix Global</title>
<style>
body{font-family:system-ui,sans-serif;background:#0B1120;color:#E2E8F0;display:flex;min-height:100vh;
  align-items:center;justify-content:center;margin:0}
.card{background:#121A2E;border:1px solid #1F2A44;border-radius:16px;padding:32px;max-width:480px;width:100%}
h1{font-size:18px;margin:0 0 10px}
p{font-size:13px;color:#8A96AE;margin:0 0 16px}
input{width:100%;padding:9px 11px;border-radius:9px;border:1px solid #1F2A44;background:#0F1626;color:#E2E8F0;
  font-size:14px;box-sizing:border-box}
button{margin-top:14px;width:100%;padding:11px;border-radius:9px;border:none;background:#17C8C0;color:#04231A;
  font-weight:600;font-size:14px;cursor:pointer}
textarea{width:100%;margin-top:16px;padding:10px;border-radius:9px;border:1px solid #1F2A44;background:#0F1626;
  color:#4ADE80;font-family:monospace;font-size:12px;box-sizing:border-box}
code{background:#0F1626;padding:2px 5px;border-radius:5px}
</style></head><body>
<div class="card">
<h1>Generar hash de contraseña</h1>
<p>Para crear una cuenta nueva (admin o contable) sin volver a ejecutar
<code>instalar.php</code>: escribe la contraseña, copia el resultado, y pégalo
en un INSERT desde phpMyAdmin, cambiando el correo, el nombre y el rol que
quieras (<code>'admin'</code> o <code>'contable'</code>).</p>
<form method="post">
  <input name="clave" type="password" placeholder="Contraseña (mín. 10 caracteres)" required>
  <button type="submit">Generar</button>
</form>
<?php if ($hash): ?>
<textarea rows="3" readonly onclick="this.select()"><?= htmlspecialchars($hash) ?></textarea>
<p style="margin-top:14px">Pégalo aquí, cambiando correo/nombre/rol:</p>
<textarea rows="4" readonly onclick="this.select()">INSERT INTO perfiles (id, nombre, apellidos, email, clave_hash, rol, estado)
VALUES (UUID(), 'Nombre', 'Apellidos', 'correo@evolvixglobal.com',
'<?= htmlspecialchars($hash) ?>', 'contable', 'Activo');</textarea>
<?php endif; ?>
</div>
</body></html>
