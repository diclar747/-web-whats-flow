-- Agregar columnas faltantes para campañas personalizadas
-- Este script arregla el problema de estado PENDING y la visualización de campañas programadas

USE whatsflow;

-- Agregar columna type si no existe
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'whatsflow' 
  AND TABLE_NAME = 'campaigns' 
  AND COLUMN_NAME = 'type'
);

SET @query = IF(@column_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN type VARCHAR(50) DEFAULT ''standard'' AFTER name;',
  'SELECT "Column type already exists" AS message;'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar columna message_text si no existe
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'whatsflow' 
  AND TABLE_NAME = 'campaigns' 
  AND COLUMN_NAME = 'message_text'
);

SET @query = IF(@column_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN message_text TEXT AFTER message_template;',
  'SELECT "Column message_text already exists" AS message;'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar columna contacts si no existe
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'whatsflow' 
  AND TABLE_NAME = 'campaigns' 
  AND COLUMN_NAME = 'contacts'
);

SET @query = IF(@column_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN contacts LONGTEXT AFTER message_media_type;',
  'SELECT "Column contacts already exists" AS message;'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar columna progress_total si no existe
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'whatsflow' 
  AND TABLE_NAME = 'campaigns' 
  AND COLUMN_NAME = 'progress_total'
);

SET @query = IF(@column_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN progress_total INT DEFAULT 0 AFTER contacts;',
  'SELECT "Column progress_total already exists" AS message;'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar columna progress_sent si no existe
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'whatsflow' 
  AND TABLE_NAME = 'campaigns' 
  AND COLUMN_NAME = 'progress_sent'
);

SET @query = IF(@column_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN progress_sent INT DEFAULT 0 AFTER progress_total;',
  'SELECT "Column progress_sent already exists" AS message;'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar columna progress_failed si no existe
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'whatsflow' 
  AND TABLE_NAME = 'campaigns' 
  AND COLUMN_NAME = 'progress_failed'
);

SET @query = IF(@column_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN progress_failed INT DEFAULT 0 AFTER progress_sent;',
  'SELECT "Column progress_failed already exists" AS message;'
);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Actualizar el estado 'pending' a 'active' para campañas programadas
UPDATE campaigns 
SET status = 'scheduled' 
WHERE status = 'pending' AND type = 'personalized' AND scheduled_at IS NOT NULL;

UPDATE campaigns 
SET status = 'active' 
WHERE status = 'pending' AND type = 'personalized' AND scheduled_at IS NULL;

-- Copiar message_template a message_text para retrocompatibilidad
UPDATE campaigns 
SET message_text = message_template 
WHERE message_text IS NULL OR message_text = '';

SELECT '✅ Schema actualizado correctamente para campañas personalizadas' AS resultado;
