/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Script para agregar la columna 'category' a la tabla contacts
    -- Verificar si la columna ya existe antes de agregarla
    SET @dbname = DATABASE();
    SET @tablename = 'contacts';
    SET @columnname = 'category';
    SET @preparedStatement = (SELECT IF(
      (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
          TABLE_SCHEMA = @dbname
          AND TABLE_NAME = @tablename
          AND COLUMN_NAME = @columnname
      ) > 0,
      'SELECT "La columna category ya existe" AS resultado;',
      'ALTER TABLE contacts ADD COLUMN category VARCHAR(255) DEFAULT ''sin_categoria'' AFTER is_online;'
    ));

    PREPARE alterIfNotExists FROM @preparedStatement;
    EXECUTE alterIfNotExists;
    DEALLOCATE PREPARE alterIfNotExists;

    -- Agregar índice si no existe
    SET @indexStatement = (SELECT IF(
      (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE
          TABLE_SCHEMA = @dbname
          AND TABLE_NAME = @tablename
          AND INDEX_NAME = 'idx_category'
      ) > 0,
      'SELECT "El índice idx_category ya existe" AS resultado;',
      'ALTER TABLE contacts ADD INDEX idx_category (category);'
    ));

    PREPARE addIndexIfNotExists FROM @indexStatement;
    EXECUTE addIndexIfNotExists;
    DEALLOCATE PREPARE addIndexIfNotExists;

    -- Mostrar resultado (opcional, no necesario en migración)
    -- SELECT
    --   COLUMN_NAME,
    --   DATA_TYPE,
    --   COLUMN_DEFAULT,
    --   IS_NULLABLE
    -- FROM INFORMATION_SCHEMA.COLUMNS
    -- WHERE TABLE_SCHEMA = DATABASE()
    --   AND TABLE_NAME = 'contacts'
    --   AND COLUMN_NAME = 'category';
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    -- Script para revertir la migración: eliminar la columna 'category' y su índice
    SET @dbname = DATABASE();
    SET @tablename = 'contacts';
    SET @columnname = 'category';
    SET @indexname = 'idx_category';

    -- Eliminar índice si existe
    SET @dropIndexStatement = (SELECT IF(
      (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE
          TABLE_SCHEMA = @dbname
          AND TABLE_NAME = @tablename
          AND INDEX_NAME = @indexname
      ) > 0,
      'DROP INDEX idx_category ON contacts;',
      'SELECT "El índice idx_category no existe" AS resultado;'
    ));

    PREPARE dropIndexIfExists FROM @dropIndexStatement;
    EXECUTE dropIndexIfExists;
    DEALLOCATE PREPARE dropIndexIfExists;

    -- Eliminar columna si existe
    SET @dropColumnStatement = (SELECT IF(
      (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
          TABLE_SCHEMA = @dbname
          AND TABLE_NAME = @tablename
          AND COLUMN_NAME = @columnname
      ) > 0,
      'ALTER TABLE contacts DROP COLUMN category;',
      'SELECT "La columna category no existe" AS resultado;'
    ));

    PREPARE dropColumnIfExists FROM @dropColumnStatement;
    EXECUTE dropColumnIfExists;
    DEALLOCATE PREPARE dropColumnIfExists;
  `);
};
