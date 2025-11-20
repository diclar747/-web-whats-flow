/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- ============================================
    -- ESTRUCTURA DE BASE DE DATOS PARA SISTEMA SAAS DE NOTIFICACIONES PUSH
    -- ============================================

    -- Tabla de usuarios
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        user_type ENUM('advertiser', 'affiliate', 'admin') DEFAULT 'affiliate',
        country VARCHAR(100),
        city VARCHAR(100),
        phone VARCHAR(50),
        avatar_url VARCHAR(1024),
        is_active BOOLEAN DEFAULT TRUE,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_user_type (user_type),
        INDEX idx_country (country),
        INDEX idx_city (city)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Tabla de suscripciones push
    CREATE TABLE IF NOT EXISTS subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        endpoint TEXT NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        ip VARCHAR(45),
        country VARCHAR(100),
        city VARCHAR(100),
        browser VARCHAR(100),
        device VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_endpoint (endpoint),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_country (country),
        INDEX idx_city (city),
        INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Tabla de tokens/saldo
    CREATE TABLE IF NOT EXISTS tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00,
        total_earned DECIMAL(15,2) DEFAULT 0.00,
        total_spent DECIMAL(15,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_balance (balance)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Tabla de campañas
    CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        image_url VARCHAR(1024),
        url VARCHAR(1024),
        segment_country VARCHAR(100),
        segment_city VARCHAR(100),
        max_sends INT DEFAULT 1000,
        scheduled_at TIMESTAMP NULL,
        status ENUM('draft', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
        tokens_cost DECIMAL(10,2) DEFAULT 0.00,
        total_sent INT DEFAULT 0,
        total_received INT DEFAULT 0,
        total_clicked INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_scheduled_at (scheduled_at),
        INDEX idx_segment_country (segment_country),
        INDEX idx_segment_city (segment_city)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Tabla de logs de campañas (resultados de envíos)
    CREATE TABLE IF NOT EXISTS campaign_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        subscription_id INT NOT NULL,
        sent_at TIMESTAMP NULL,
        received_at TIMESTAMP NULL,
        clicked_at TIMESTAMP NULL,
        status ENUM('sent', 'received', 'clicked', 'failed') DEFAULT 'sent',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
        INDEX idx_campaign_id (campaign_id),
        INDEX idx_subscription_id (subscription_id),
        INDEX idx_status (status),
        INDEX idx_sent_at (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Tabla de recompensas de afiliados
    CREATE TABLE IF NOT EXISTS affiliate_rewards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        campaign_id INT,
        subscription_id INT,
        action ENUM('receive', 'open', 'click') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        campaign_log_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_log_id) REFERENCES campaign_logs(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_campaign_id (campaign_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Tabla de transacciones (compras, recompensas, retiros)
    CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('purchase', 'reward', 'withdrawal', 'refund') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        reference_id VARCHAR(255), -- ID de campaña, transacción externa, etc.
        status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_type (type),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Tabla de configuraciones globales
    CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        key_name VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key_name (key_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- Insertar configuraciones por defecto
    INSERT INTO settings (key_name, value, description) VALUES
    ('token_price', '35', 'Precio por token en guaraníes'),
    ('reward_receive', '100', 'Recompensa por recibir notificación (Gs)'),
    ('reward_open', '200', 'Recompensa por abrir notificación (Gs)'),
    ('reward_click', '500', 'Recompensa por clic en URL (Gs)'),
    ('admin_percentage', '30', 'Porcentaje que se queda la administración (%)'),
    ('min_withdrawal', '50000', 'Monto mínimo para retiro (Gs)'),
    ('max_sends_per_campaign', '10000', 'Máximo envíos por campaña'),
    ('daily_send_limit', '50000', 'Límite diario de envíos por usuario'),
    ('vapid_public_key', '', 'Clave pública VAPID para push notifications'),
    ('vapid_private_key', '', 'Clave privada VAPID para push notifications'),
    ('system_email', 'admin@pushsaas.com', 'Email del sistema para notificaciones');

    -- Crear usuario administrador por defecto (contraseña: admin123)
    INSERT INTO users (name, email, password, user_type) VALUES
    ('Administrador', 'admin@pushsaas.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TABLE IF EXISTS affiliate_rewards;
    DROP TABLE IF EXISTS campaign_logs;
    DROP TABLE IF EXISTS campaigns;
    DROP TABLE IF EXISTS tokens;
    DROP TABLE IF EXISTS subscriptions;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS settings;
  `);
};
