<?php
// =============================================================================
// EVOLVIX GLOBAL · Configuración de la base de datos
//
// Rellena estos cuatro valores con los que te dé el panel de Hostalia al
// crear tu base de datos MySQL (Plesk/cPanel → Bases de datos). NUNCA subas
// este archivo a un repositorio público ni lo compartas: quien tenga estos
// cuatro datos tiene acceso completo a la base de datos.
// =============================================================================

define('EVOLVIX_DB_HOST', 'PON-AQUI-EL-SERVIDOR-MYSQL');      // p. ej. localhost, o mysqlXXX.hostalia.com
define('EVOLVIX_DB_NOMBRE', 'PON-AQUI-EL-NOMBRE-DE-LA-BASE-DE-DATOS');
define('EVOLVIX_DB_USUARIO', 'PON-AQUI-EL-USUARIO-MYSQL');
define('EVOLVIX_DB_CLAVE', 'PON-AQUI-LA-CONTRASEÑA-MYSQL');

// Déjalo en true mientras pruebas; en producción, en cuanto todo funcione,
// cámbialo a false para que los errores no se muestren en el navegador.
define('EVOLVIX_DEPURAR', true);
