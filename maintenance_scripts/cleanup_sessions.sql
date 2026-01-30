-- Script para limpiar sesiones duplicadas y normalizar la base de datos
-- EJECUTAR CON PRECAUCIÓN

-- 1. Ver sesiones actuales
SELECT id, session_id, phone_number, is_active, last_connection_time 
FROM user_sessions 
ORDER BY last_connection_time DESC;

-- 2. Desactivar sesiones antiguas (mantener solo la más reciente por teléfono)
UPDATE user_sessions us1
SET is_active = 0
WHERE EXISTS (
    SELECT 1 FROM user_sessions us2
    WHERE us2.phone_number = us1.phone_number
    AND us2.last_connection_time > us1.last_connection_time
);

-- 3. Ver mensajes con diferentes session_id
SELECT 
    session_id,
    phone_number,
    COUNT(*) as message_count
FROM messages
GROUP BY session_id, phone_number
ORDER BY message_count DESC;

-- 4. OPCIONAL: Normalizar mensajes para usar phone_number consistentemente
-- (Solo ejecutar si estás seguro)
/*
UPDATE messages m
SET phone_number = (
    SELECT phone_number 
    FROM user_sessions us 
    WHERE us.session_id = m.session_id 
    LIMIT 1
)
WHERE m.phone_number IS NULL OR m.phone_number = '';
*/
