/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Script simple para agregar columna category a contacts
    -- Ejecutar en MySQL Workbench o línea de comandos

    USE whatsflow;

    -- Agregar columna category si no existe
    ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS category VARCHAR(255) DEFAULT 'sin_categoria' AFTER is_online;

    -- Agregar índice
    ALTER TABLE contacts
    ADD INDEX IF NOT EXISTS idx_category (category);

    -- Verificar que se agregó correctamente
    SHOW COLUMNS FROM contacts LIKE 'category';

    -- Ver contactos actuales
    SELECT COUNT(*) as total, category FROM contacts GROUP BY category;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    -- Eliminar columna category si existe
    ALTER TABLE contacts
    DROP COLUMN IF EXISTS category;

    -- Eliminar índice si existe (MySQL no tiene DROP INDEX IF EXISTS directamente en ALTER TABLE)
    -- Se puede verificar y luego eliminar si es necesario, o simplemente intentar eliminar
    -- y manejar el error si no existe. Para Knex, es mejor usar el schema builder.
    -- Sin embargo, si se usa knex.raw, se puede hacer así:
    DROP INDEX IF EXISTS idx_category ON contacts;
  `);
};
