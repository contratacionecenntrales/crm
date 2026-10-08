-- =============================================================================
-- EVOLVIX GLOBAL · Facturación de Grupo — Esquema MySQL/MariaDB para Hostalia
--
-- Sustituye al esquema de Supabase/Postgres: aquí no hay RLS (seguridad por
-- fila dentro de la propia base de datos), así que esa parte la hace el
-- código PHP de la carpeta api/ — cada archivo explica, en un comentario,
-- qué regla de seguridad está aplicando y por qué.
--
-- Ejecútalo entero, de una vez, desde phpMyAdmin (pestaña SQL) en tu base de
-- datos de Hostalia. Se puede volver a ejecutar sin romper nada: todas las
-- tablas usan "IF NOT EXISTS".
-- =============================================================================

CREATE TABLE IF NOT EXISTS perfiles (
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  nombre      VARCHAR(120)  NOT NULL,
  apellidos   VARCHAR(120)  NOT NULL DEFAULT '',
  email       VARCHAR(190)  NOT NULL,
  clave_hash  VARCHAR(255)  NOT NULL,
  rol         ENUM('admin','contable') NOT NULL DEFAULT 'contable',
  estado      ENUM('Activo','Suspendido') NOT NULL DEFAULT 'Activo',
  creado      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_perfiles_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marcas (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(160)  NOT NULL,
  prefijo   VARCHAR(3)    NOT NULL,
  cif       VARCHAR(40)   NOT NULL DEFAULT '',
  email     VARCHAR(190)  NOT NULL DEFAULT '',
  color     VARCHAR(10)   NOT NULL DEFAULT '#EF7F14',
  activa    TINYINT(1)    NOT NULL DEFAULT 1,
  creado    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_marcas_nombre (nombre),
  UNIQUE KEY uq_marcas_prefijo (prefijo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clientes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  marca_id    INT           NOT NULL,
  nombre      VARCHAR(200)  NOT NULL,
  cif         VARCHAR(40)   NOT NULL DEFAULT '',
  email       VARCHAR(190)  NOT NULL DEFAULT '',
  telefono    VARCHAR(40)   NOT NULL DEFAULT '',
  contacto    VARCHAR(160)  NOT NULL DEFAULT '',
  creado_por  CHAR(36)      NULL,
  creado      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clientes_marca FOREIGN KEY (marca_id) REFERENCES marcas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_clientes_creador FOREIGN KEY (creado_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un contador por marca y año. Lo usa api/numeracion.php con el truco
-- LAST_INSERT_ID(expr) de MySQL para repartir números sin que dos facturas
-- creadas a la vez puedan recibir el mismo número (seguro bajo concurrencia
-- real, no solo en pruebas con una sola petición a la vez).
CREATE TABLE IF NOT EXISTS numeracion_facturas (
  marca_id   INT NOT NULL,
  anio       INT NOT NULL,
  siguiente  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (marca_id, anio),
  CONSTRAINT fk_numeracion_marca FOREIGN KEY (marca_id) REFERENCES marcas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facturas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  numero         VARCHAR(40)   NOT NULL,
  marca_id       INT           NOT NULL,
  cliente_id     INT           NOT NULL,
  fecha_emision  DATE          NOT NULL,
  fecha_pago     DATE          NULL,
  base           DECIMAL(12,2) NOT NULL DEFAULT 0,
  iva            DECIMAL(5,2)  NOT NULL DEFAULT 21,
  total          DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado         ENUM('Pendiente','Pagada','Impagada','Anulada') NOT NULL DEFAULT 'Pendiente',
  creado_por     CHAR(36)      NULL,
  creado         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_facturas_numero (numero),
  CONSTRAINT fk_facturas_marca FOREIGN KEY (marca_id) REFERENCES marcas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_facturas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_facturas_creador FOREIGN KEY (creado_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS factura_lineas (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  factura_id       INT           NOT NULL,
  descripcion      VARCHAR(300)  NOT NULL,
  cantidad         DECIMAL(10,2) NOT NULL DEFAULT 1,
  precio_unitario  DECIMAL(12,2) NOT NULL DEFAULT 0,
  orden            INT           NOT NULL DEFAULT 0,
  CONSTRAINT fk_lineas_factura FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico de cada factura. Nunca se actualiza ni se borra desde la
-- aplicación: api/facturas.php solo tiene INSERT hacia esta tabla, igual que
-- en la versión de Supabase el trigger solo podía insertar.
CREATE TABLE IF NOT EXISTS factura_eventos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  factura_id  INT           NOT NULL,
  tipo        VARCHAR(40)   NOT NULL,
  detalle     VARCHAR(300)  NOT NULL DEFAULT '',
  creado_por  CHAR(36)      NULL,
  creado      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_eventos_factura FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Siembra la marca «Evolvix Global» si todavía no existe ninguna marca.
INSERT INTO marcas (nombre, prefijo, cif, email, color, activa)
SELECT 'Evolvix Global', 'EVO', '', '', '#EF7F14', 1
WHERE NOT EXISTS (SELECT 1 FROM marcas WHERE nombre = 'Evolvix Global');

-- =============================================================================
-- COMPROBACIÓN
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM marcas) AS marcas,
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN ('perfiles','marcas','clientes','numeracion_facturas',
                           'facturas','factura_lineas','factura_eventos')) AS tablas_creadas;
-- Esperado: marcas >= 1, tablas_creadas = 7.
