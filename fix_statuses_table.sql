-- Agregar columna phone a whatsapp_statuses si no existe
SET @dbname = DATABASE();
SET @tablename = 'whatsapp_statuses';
SET @columnname = 'phone';
SET @columntype = 'VARCHAR(50)';

SET @sql = CONCAT(
    'ALTER TABLE ', @tablename, 
    ' ADD COLUMN ', @columnname, ' ', @columntype, 
    ' AFTER session_id'
);

SET @sql = IF(
    NOT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = @dbname 
        AND table_name = @tablename 
        AND column_name = @columnname
    ),
    @sql,
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Actualizar registros existentes para que tengan un valor válido
UPDATE whatsapp_statuses SET phone = 'unknown' WHERE phone IS NULL OR phone = '';
