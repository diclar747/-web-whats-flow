/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Agregar columna para controlar sincronización automática
    -- Por defecto, NO sincronizar (false)

    ALTER TABLE users 
    ADD COLUMN auto_sync BOOLEAN DEFAULT FALSE COMMENT 'Si TRUE, sincroniza automáticamente al conectar';

    -- Agregar columna para saber si ya se hizo la sincronización inicial
    ALTER TABLE users
    ADD COLUMN sync_completed BOOLEAN DEFAULT FALSE COMMENT 'Si TRUE, ya se sincronizó al menos una vez';

    -- Agregar columna para fecha de última sincronización
    ALTER TABLE users
    ADD COLUMN last_sync_date DATETIME NULL COMMENT 'Fecha de la última sincronización completa';

    -- Por defecto, todos los usuarios NO sincronizan automáticamente
    UPDATE users SET auto_sync = FALSE WHERE auto_sync IS NULL;

    -- SELECT 'Columnas de sincronización agregadas exitosamente' AS status; -- Not needed in migration
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    ALTER TABLE users 
    DROP COLUMN auto_sync,
    DROP COLUMN sync_completed,
    DROP COLUMN last_sync_date;
  `);
};
