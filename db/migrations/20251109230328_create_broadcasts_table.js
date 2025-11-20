/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Tabla para almacenar broadcasts (status@broadcast, newsletters @lid)
    CREATE TABLE IF NOT EXISTS broadcasts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        jid VARCHAR(255) NOT NULL,
        name VARCHAR(255) DEFAULT NULL,
        session_id VARCHAR(255) NOT NULL,
        broadcast_type ENUM('status', 'newsletter', 'other') DEFAULT 'status',
        avatar_url VARCHAR(1024) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_broadcast (jid, session_id),
        INDEX idx_session (session_id),
        INDEX idx_type (broadcast_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TABLE IF EXISTS broadcasts;
  `);
};
