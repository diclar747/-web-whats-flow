-- =====================================================
-- PUSH NOTIFICATIONS MODULE - DATABASE SCHEMA
-- =====================================================
-- Created: 2026-01-16
-- Description: Complete schema for Push Notifications module
-- Features: Subscription URLs, Categories, Subscribers, Campaigns, Analytics
-- =====================================================

-- 1. Categorías para organizar suscriptores
CREATE TABLE IF NOT EXISTS push_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3b82f6',
    icon VARCHAR(50) DEFAULT 'tag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. URLs de suscripción únicas por usuario
CREATE TABLE IF NOT EXISTS push_subscription_urls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT,
    url_code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    redirect_url VARCHAR(500),
    welcome_message TEXT,
    max_subscribers INT DEFAULT NULL,
    expires_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES push_categories(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_url_code (url_code),
    INDEX idx_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Suscriptores a notificaciones push
CREATE TABLE IF NOT EXISTS push_subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category_id INT,
    subscription_url_id INT,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    subscriber_name VARCHAR(100),
    subscriber_email VARCHAR(150),
    subscriber_phone VARCHAR(50),
    user_agent TEXT,
    ip_address VARCHAR(45),
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME DEFAULT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES push_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (subscription_url_id) REFERENCES push_subscription_urls(id) ON DELETE SET NULL,
    UNIQUE KEY unique_endpoint (endpoint(500)),
    INDEX idx_user_id (user_id),
    INDEX idx_category_id (category_id),
    INDEX idx_subscription_url_id (subscription_url_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Campañas de Push Notifications
CREATE TABLE IF NOT EXISTS push_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(500),
    action_url VARCHAR(500),
    icon_url VARCHAR(500),
    badge_url VARCHAR(500),
    status ENUM('draft', 'scheduled', 'sending', 'sent', 'failed') DEFAULT 'draft',
    
    -- Targeting
    target_all BOOLEAN DEFAULT FALSE,
    target_category_ids JSON,
    target_subscriber_ids JSON,
    
    -- Scheduling
    send_immediately BOOLEAN DEFAULT TRUE,
    scheduled_at DATETIME DEFAULT NULL,
    sent_at DATETIME DEFAULT NULL,
    
    -- Statistics (cached)
    total_targets INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_viewed INT DEFAULT 0,
    total_clicked INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    
    -- Settings
    ttl INT DEFAULT 86400,
    urgency ENUM('very-low', 'low', 'normal', 'high') DEFAULT 'normal',
    require_interaction BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_scheduled_at (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Analytics detallado de campañas
CREATE TABLE IF NOT EXISTS push_campaign_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    subscriber_id INT NOT NULL,
    
    -- Estado de envío
    status ENUM('pending', 'sent', 'delivered', 'failed') DEFAULT 'pending',
    error_message TEXT,
    
    -- Eventos de interacción
    sent_at DATETIME DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    viewed_at DATETIME DEFAULT NULL,
    clicked_at DATETIME DEFAULT NULL,
    closed_at DATETIME DEFAULT NULL,
    
    -- Detalles técnicos
    response_code INT,
    response_message TEXT,
    
    -- Engagement metrics
    time_to_view INT DEFAULT NULL, -- segundos desde envío hasta vista
    time_to_click INT DEFAULT NULL, -- segundos desde envío hasta click
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES push_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (subscriber_id) REFERENCES push_subscribers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_campaign_subscriber (campaign_id, subscriber_id),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_subscriber_id (subscriber_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Logs de eventos para auditoría
CREATE TABLE IF NOT EXISTS push_event_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_type ENUM('subscribe', 'unsubscribe', 'campaign_created', 'campaign_sent', 'notification_sent', 'notification_viewed', 'notification_clicked') NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VAPID Keys storage (para Web Push API)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_vapid_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_vapid (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- INDEXES ADICIONALES PARA PERFORMANCE
-- =====================================================

-- Performance index para búsqueda de suscriptores activos
CREATE INDEX idx_active_subscribers ON push_subscribers(user_id, is_active, category_id);

-- Performance index para analytics queries
CREATE INDEX idx_campaign_analytics_datetime ON push_campaign_analytics(campaign_id, sent_at, viewed_at, clicked_at);

-- Performance index para URLs activas
CREATE INDEX idx_active_urls ON push_subscription_urls(user_id, is_active);

-- =====================================================
-- DATOS INICIALES (OPCIONAL)
-- =====================================================

-- Insertar categoría por defecto para cada usuario existente
-- (Esto se puede ejecutar opcionalmente)
-- INSERT INTO push_categories (user_id, name, description, color, icon)
-- SELECT id, 'General', 'Lista general de suscriptores', '#3b82f6', 'users'
-- FROM users
-- WHERE id NOT IN (SELECT DISTINCT user_id FROM push_categories WHERE name = 'General');

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
