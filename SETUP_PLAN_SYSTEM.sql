-- =====================================================
-- SISTEMA COMPLETO DE GESTIÓN DE PLANES Y SOLICITUDES
-- =====================================================

-- Paso 1: Crear tabla para solicitudes de planes
CREATE TABLE IF NOT EXISTS plan_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    session_id VARCHAR(255),
    plan_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    plan_price DECIMAL(10,2) NOT NULL,
    duration_days INT NOT NULL DEFAULT 30,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    payment_proof_url VARCHAR(500),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    reviewed_by VARCHAR(20),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone_number),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paso 2: Agregar campos de suscripción a user_sessions si no existen
ALTER TABLE user_sessions
    ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS subscription_status ENUM('active', 'inactive', 'expired', 'cancelled', 'trial') DEFAULT 'inactive',
    ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS subscription_days INT DEFAULT 0;

-- Paso 3: Verificar que la tabla plans tiene datos
-- Si no tienes planes, puedes insertar algunos de ejemplo:
-- DELETE FROM plans WHERE name IN ('Básico', 'Estándar', 'Premium');

INSERT IGNORE INTO plans (name, description, price, modules, max_agents, max_sessions, max_channels, max_messages, bot_enabled, api_enabled)
VALUES
('Básico', 'Plan básico para pequeños negocios', 80000, '[]', 2, 1, 1, 1000, 0, 0),
('Estándar', 'Plan estándar para negocios en crecimiento', 160000, '[]', 5, 2, 2, 5000, 1, 0),
('Premium', 'Plan premium con todas las funcionalidades', 320000, '[]', 10, 5, 5, 999999, 1, 1);

-- Paso 4: Verificar las tablas
SHOW TABLES LIKE '%plan%';

-- Paso 5: Ver estructura de plan_requests
DESC plan_requests;

-- Paso 6: Ver planes disponibles
SELECT id, name, price, max_agents, max_sessions, bot_enabled, api_enabled FROM plans;

-- Paso 7: Ver user_sessions con campos de suscripción
DESC user_sessions;

-- =====================================================
-- CONSULTAS ÚTILES PARA ADMINISTRACIÓN
-- =====================================================

-- Ver todas las solicitudes pendientes
SELECT
    pr.id,
    pr.phone_number,
    pr.plan_name,
    pr.plan_price,
    pr.status,
    pr.requested_at,
    p.name as plan_display_name
FROM plan_requests pr
LEFT JOIN plans p ON pr.plan_id = p.id
WHERE pr.status = 'pending'
ORDER BY pr.requested_at DESC;

-- Ver usuarios con planes activos en user_sessions
SELECT
    phone_number,
    subscription_plan,
    subscription_status,
    subscription_start_date,
    subscription_end_date,
    DATEDIFF(subscription_end_date, NOW()) as days_remaining
FROM user_sessions
WHERE subscription_status = 'active'
ORDER BY subscription_end_date ASC;

-- Ver todas las solicitudes (historial completo)
SELECT
    pr.*,
    p.name as plan_display_name,
    p.description as plan_description
FROM plan_requests pr
LEFT JOIN plans p ON pr.plan_id = p.id
ORDER BY pr.requested_at DESC;

-- =====================================================
-- LIMPIAR DATOS DE PRUEBA (Opcional - solo para testing)
-- =====================================================

-- CUIDADO: Esto eliminará todas las solicitudes de prueba
-- DELETE FROM plan_requests WHERE status = 'pending';

-- CUIDADO: Esto eliminará todos los planes de suscripción de user_sessions
-- UPDATE user_sessions SET subscription_plan = NULL, subscription_status = 'inactive', subscription_start_date = NULL, subscription_end_date = NULL, subscription_days = 0;

COMMIT;
