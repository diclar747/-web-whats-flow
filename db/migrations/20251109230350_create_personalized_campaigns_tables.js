/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Tabla para campañas personalizadas con envíos programados
    CREATE TABLE IF NOT EXISTS personalized_campaigns (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        mensaje TEXT NOT NULL,
        archivo VARCHAR(500),
        archivo_nombre VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        estado ENUM('activa', 'completada', 'pausada') DEFAULT 'activa',
        total_contactos INT DEFAULT 0,
        enviados INT DEFAULT 0,
        pendientes INT DEFAULT 0,
        errores INT DEFAULT 0,
        INDEX idx_session (session_id),
        INDEX idx_estado (estado)
    );

    -- Tabla para contactos de campañas personalizadas
    CREATE TABLE IF NOT EXISTS personalized_campaign_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id VARCHAR(36) NOT NULL,
        numero VARCHAR(50) NOT NULL,
        nombre VARCHAR(255),
        dato1 VARCHAR(255),
        dato2 VARCHAR(255),
        dato3 VARCHAR(255),
        fecha DATE NOT NULL,
        estado ENUM('pendiente', 'enviado', 'error') DEFAULT 'pendiente',
        error_message TEXT,
        sent_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES personalized_campaigns(id) ON DELETE CASCADE,
        INDEX idx_campaign (campaign_id),
        INDEX idx_estado (estado),
        INDEX idx_fecha (fecha)
    );

    -- Índice compuesto para buscar contactos pendientes por fecha
    CREATE INDEX idx_pending_by_date ON personalized_campaign_contacts(estado, fecha);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TABLE IF EXISTS personalized_campaign_contacts;
    DROP TABLE IF EXISTS personalized_campaigns;
  `);
};
