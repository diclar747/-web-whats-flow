-- Sistema de Suscripciones y Planes
-- Fecha: 2025-11-08

-- 1. Agregar columnas de suscripción a la tabla users
ALTER TABLE users
ADD COLUMN subscription_plan ENUM('free', 'basic', 'professional', 'enterprise') DEFAULT 'free',
ADD COLUMN subscription_status ENUM('active', 'inactive', 'trial', 'expired', 'cancelled') DEFAULT 'inactive',
ADD COLUMN subscription_start_date DATETIME NULL,
ADD COLUMN subscription_end_date DATETIME NULL,
ADD COLUMN subscription_days INT DEFAULT 0,
ADD COLUMN is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN admin_phone VARCHAR(20) NULL;

-- 2. Crear tabla de planes disponibles
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plan_name VARCHAR(50) NOT NULL UNIQUE,
    plan_display_name VARCHAR(100) NOT NULL,
    duration_days INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    features JSON,
    max_users INT DEFAULT 1,
    max_messages_per_month INT DEFAULT 1000,
    max_campaigns INT DEFAULT 10,
    max_contacts INT DEFAULT 1000,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Crear tabla de historial de suscripciones
CREATE TABLE IF NOT EXISTS subscription_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    plan_name VARCHAR(50) NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    days INT NOT NULL,
    price DECIMAL(10,2),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(100),
    status ENUM('active', 'completed', 'cancelled', 'expired') DEFAULT 'active',
    activated_by INT NULL COMMENT 'ID del admin que activó',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Insertar planes predeterminados
INSERT INTO subscription_plans (plan_name, plan_display_name, duration_days, price, features, max_users, max_messages_per_month, max_campaigns, max_contacts) VALUES
('free', 'Plan Gratuito', 0, 0.00, '["Chat básico", "100 mensajes/mes", "1 usuario"]', 1, 100, 0, 100),
('basic', 'Plan Básico', 30, 29.99, '["Chat ilimitado", "1000 mensajes/mes", "3 usuarios", "Campañas básicas"]', 3, 1000, 10, 1000),
('professional', 'Plan Profesional', 30, 79.99, '["Todo del Básico", "10000 mensajes/mes", "10 usuarios", "Campañas avanzadas", "CRM integrado"]', 10, 10000, 50, 5000),
('enterprise', 'Plan Enterprise', 30, 199.99, '["Todo ilimitado", "Usuarios ilimitados", "Mensajes ilimitados", "Soporte prioritario", "API completa"]', 999999, 999999, 999999, 999999);

-- 5. Agregar índices para mejor rendimiento
CREATE INDEX idx_subscription_status ON users(subscription_status);
CREATE INDEX idx_subscription_end_date ON users(subscription_end_date);
CREATE INDEX idx_admin_phone ON users(admin_phone);

-- 6. Actualizar el usuario administrador (número que empieza con 595994854167)
-- Este se ejecutará después desde el backend cuando el usuario inicie sesión

-- 7. Crear procedimiento almacenado para verificar expiración
DELIMITER //
CREATE PROCEDURE check_expired_subscriptions()
BEGIN
    UPDATE users 
    SET subscription_status = 'expired'
    WHERE subscription_status = 'active' 
    AND subscription_end_date IS NOT NULL
    AND subscription_end_date < NOW();
END//
DELIMITER ;

-- 8. Crear evento para ejecutar la verificación diariamente
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS daily_subscription_check;
CREATE EVENT daily_subscription_check
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO CALL check_expired_subscriptions();

SELECT 'Sistema de suscripciones creado exitosamente' AS status;
