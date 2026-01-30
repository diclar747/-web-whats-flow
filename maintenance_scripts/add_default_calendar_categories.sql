-- Agregar categorías por defecto al calendario
-- Se insertan solo si no existen para evitar duplicados

-- Categoría 1: Reservas de Turnos
INSERT INTO appointment_categories (session_id, name, color, icon, is_active, created_at)
SELECT DISTINCT 
    phone_number,
    'Reservas de Turnos',
    '#2196F3',
    '📅',
    TRUE,
    NOW()
FROM users 
WHERE role = 'admin'
AND phone_number IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM appointment_categories ac 
    WHERE ac.session_id = users.phone_number 
    AND ac.name = 'Reservas de Turnos'
);

-- Categoría 2: Citas Médicas
INSERT INTO appointment_categories (session_id, name, color, icon, is_active, created_at)
SELECT DISTINCT 
    phone_number,
    'Citas Médicas',
    '#4CAF50',
    '🏥',
    TRUE,
    NOW()
FROM users 
WHERE role = 'admin'
AND phone_number IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM appointment_categories ac 
    WHERE ac.session_id = users.phone_number 
    AND ac.name = 'Citas Médicas'
);

-- Categoría 3: Reuniones
INSERT INTO appointment_categories (session_id, name, color, icon, is_active, created_at)
SELECT DISTINCT 
    phone_number,
    'Reuniones',
    '#FF9800',
    '👥',
    TRUE,
    NOW()
FROM users 
WHERE role = 'admin'
AND phone_number IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM appointment_categories ac 
    WHERE ac.session_id = users.phone_number 
    AND ac.name = 'Reuniones'
);

SELECT '✅ Categorías por defecto creadas correctamente' AS resultado;
