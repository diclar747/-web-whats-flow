-- Verificar y corregir estructura de base de datos WhatsFlow

-- 1. Asegurar que la tabla users tiene los campos correctos
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL DEFAULT NULL;

-- 2. Verificar índices importantes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_admin_phone ON users(admin_phone);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_messages_chat_jid ON messages(chat_jid);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chats_session_id ON chats(session_id);

-- 3. Asegurar que la tabla agents existe
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255),
    status ENUM('online', 'offline', 'busy') DEFAULT 'offline',
    max_concurrent_chats INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de permisos de agentes
CREATE TABLE IF NOT EXISTS agent_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    permission VARCHAR(50) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    UNIQUE KEY unique_agent_permission (agent_id, permission),
    INDEX idx_agent_id (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de campañas
CREATE TABLE IF NOT EXISTS campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('draft', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
    message_template TEXT,
    target_type ENUM('all', 'contacts', 'groups', 'custom') DEFAULT 'contacts',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    total_targets INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    INDEX idx_session_id (session_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla de mensajes de campaña
CREATE TABLE IF NOT EXISTS campaign_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    target_jid VARCHAR(100) NOT NULL,
    target_name VARCHAR(255),
    status ENUM('pending', 'sent', 'delivered', 'failed') DEFAULT 'pending',
    message_id VARCHAR(100),
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    error_message TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_status (status),
    INDEX idx_target_jid (target_jid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Verificar que existan las columnas necesarias en users
SELECT 
    'Verificando estructura de tabla users' as info;
    
SHOW COLUMNS FROM users LIKE 'is_admin';
SHOW COLUMNS FROM users LIKE 'admin_phone';
SHOW COLUMNS FROM users LIKE 'plan_type';

-- 8. Mostrar resumen
SELECT 
    'Schema verificado correctamente' as resultado,
    NOW() as fecha;
