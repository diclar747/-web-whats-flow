-- Crear tabla de categorías de calendario si no existe
CREATE TABLE IF NOT EXISTS appointment_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#2196F3',
    icon VARCHAR(10) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar categorías por defecto
INSERT INTO appointment_categories (session_id, name, color, icon, is_active, created_at)
SELECT DISTINCT 
    phone_number,
    'Reservas de Turnos',
    '#2196F3',
    '📅',
    TRUE,
    NOW()
FROM user_sessions 
WHERE phone_number IS NOT NULL
AND is_active = 1
AND NOT EXISTS (
    SELECT 1 FROM appointment_categories ac 
    WHERE ac.session_id = user_sessions.phone_number 
    AND ac.name = 'Reservas de Turnos'
);

INSERT INTO appointment_categories (session_id, name, color, icon, is_active, created_at)
SELECT DISTINCT 
    phone_number,
    'Citas Médicas',
    '#4CAF50',
    '🏥',
    TRUE,
    NOW()
FROM user_sessions 
WHERE phone_number IS NOT NULL
AND is_active = 1
AND NOT EXISTS (
    SELECT 1 FROM appointment_categories ac 
    WHERE ac.session_id = user_sessions.phone_number 
    AND ac.name = 'Citas Médicas'
);

INSERT INTO appointment_categories (session_id, name, color, icon, is_active, created_at)
SELECT DISTINCT 
    phone_number,
    'Reuniones',
    '#FF9800',
    '👥',
    TRUE,
    NOW()
FROM user_sessions 
WHERE phone_number IS NOT NULL
AND is_active = 1
AND NOT EXISTS (
    SELECT 1 FROM appointment_categories ac 
    WHERE ac.session_id = user_sessions.phone_number 
    AND ac.name = 'Reuniones'
);

SELECT '✅ Tabla y categorías por defecto creadas' AS resultado;
SELECT COUNT(*) as total_categorias FROM appointment_categories;
