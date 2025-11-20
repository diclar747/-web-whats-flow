-- Migración: Agregar columna 'category' a la tabla contacts
-- Fecha: 2024
-- Descripción: Agrega soporte para tableros Kanban

USE whatsflow;

-- Verificar si la columna ya existe antes de agregarla
SET @dbname = DATABASE();
SET @tablename = 'contacts';
SET @columnname = 'category';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT ''Column already exists'' AS message;',
  'ALTER TABLE contacts ADD COLUMN category VARCHAR(255) DEFAULT ''sin_categoria'' AFTER is_online;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Agregar índice para la columna category si no existe
SET @indexname = 'idx_category';
SET @preparedStatement2 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT ''Index already exists'' AS message;',
  'ALTER TABLE contacts ADD INDEX idx_category (category);'
));

PREPARE alterIndexIfNotExists FROM @preparedStatement2;
EXECUTE alterIndexIfNotExists;
DEALLOCATE PREPARE alterIndexIfNotExists;

-- Verificar el resultado
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
  AND TABLE_NAME = @tablename
  AND COLUMN_NAME = @columnname;

-- Mostrar estadísticas
SELECT
    COUNT(*) as total_contacts,
    category,
    COUNT(*) as count_per_category
FROM contacts
GROUP BY category;
