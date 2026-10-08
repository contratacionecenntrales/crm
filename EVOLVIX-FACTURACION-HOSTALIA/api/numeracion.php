<?php
// =============================================================================
// Numeración automática de facturas: PREFIJO-AÑO-NNNN, correlativa por marca
// y por año. Usa el truco LAST_INSERT_ID(expr) de MySQL: cada conexión lee
// SU PROPIO valor, así que dos facturas creadas en el mismo instante por dos
// personas distintas nunca pueden recibir el mismo número.
// =============================================================================

function evolvixPrefijoDisponible(PDO $pdo, string $nombre): string {
  $letras = preg_replace('/[^A-Za-z]/', '', $nombre);
  $base = strtoupper(substr($letras, 0, 3));
  if ($base === '') $base = 'MCA';
  if (strlen($base) < 3) $base = str_pad($base, 3, 'X');

  $stmt = $pdo->prepare('SELECT COUNT(*) FROM marcas WHERE prefijo = ?');
  $candidato = $base;
  for ($n = 2; $n <= 9; $n++) {
    $stmt->execute([$candidato]);
    if ((int)$stmt->fetchColumn() === 0) return $candidato;
    $candidato = substr($base, 0, 2) . $n;
  }
  // Caso extremo (más de 8 marcas con las mismas 2 primeras letras): nunca
  // debería llegar aquí con un grupo de pocas marcas, pero no nos arriesgamos
  // a devolver un prefijo repetido.
  return substr($base, 0, 2) . strtoupper(substr(bin2hex(random_bytes(1)), 0, 1));
}

function evolvixSiguienteNumeroFactura(PDO $pdo, int $marcaId): string {
  $stmt = $pdo->prepare('SELECT prefijo FROM marcas WHERE id = ?');
  $stmt->execute([$marcaId]);
  $prefijo = $stmt->fetchColumn();
  if ($prefijo === false) throw new RuntimeException('La marca indicada no existe.');

  $anio = (int)date('Y');
  $upd = $pdo->prepare(
    'INSERT INTO numeracion_facturas (marca_id, anio, siguiente) VALUES (?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE siguiente = LAST_INSERT_ID(siguiente + 1)'
  );
  $upd->execute([$marcaId, $anio]);
  $siguiente = (int)$pdo->lastInsertId();

  return sprintf('%s-%d-%04d', $prefijo, $anio, $siguiente);
}
