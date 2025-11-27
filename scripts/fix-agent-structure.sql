-- Script para corregir la estructura de agentes por admin
-- Fecha: 2025-11-26

-- 1. Limpiar session_id de agentes cuando el admin se desconecta
-- Esto se ejecuta automáticamente cuando el admin se desconecta
-- UPDATE users SET session_id = NULL WHERE admin_phone = ? AND role IN ("agent", "supervisor")

-- 2. Corregir agentes sin admin_phone (ejemplo para admin específico)
-- IMPORTANTE: Solo ejecutar si se confirma que estos agentes pertenecen al admin
UPDATE users 
SET admin_phone = '595985768793' 
WHERE role IN ('agent', 'supervisor') 
    AND status = 'active'
    AND (admin_phone IS NULL OR admin_phone = '')
    AND email IN ('claudio@cnid.com.py');

-- 3. Verificar la corrección
SELECT 'Después de corrección - Agentes por admin' as info;
SELECT 
    admin_phone,
    COUNT(*) as total_agentes,
    GROUP_CONCAT(email) as agentes
FROM users 
WHERE role IN ('agent', 'supervisor') 
    AND status = 'active'
    AND admin_phone IS NOT NULL
GROUP BY admin_phone;

-- 4. Limpiar duplicados en user_sessions (si existen)
-- DELETE FROM user_sessions 
-- WHERE id NOT IN (
--     SELECT MIN(id) 
--     FROM user_sessions 
--     GROUP BY phone_number, session_id
-- );

-- 5. Actualizar user_sessions con números de teléfono correctos
-- Esto asegura que los admins tengan sus números correctos
UPDATE user_sessions 
SET phone_number = '595985768793' 
WHERE session_id = '595985768793' 
    AND phone_number != '595985768793';

UPDATE user_sessions 
SET phone_number = '595994854167' 
WHERE session_id = '595994854167' 
    AND phone_number != '595994854167';

-- 6. Verificar user_sessions actualizados
SELECT 'User sessions actualizados' as info;
SELECT 
    session_id,
    phone_number,
    is_active,
    last_activity
FROM user_sessions 
WHERE phone_number IN ('595985768793', '595994854167')
ORDER BY last_activity DESC;

-- 7. Verificar que los agentes tengan session_id correcto cuando el admin está conectado
-- Esto se hace automáticamente cuando el admin inicia sesión con QR

-- 8. Limpiar sesiones inactivas antiguas (más de 7 días)
DELETE FROM user_sessions 
WHERE is_active = 0 
    AND last_activity < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 9. Verificar estado final
SELECT 'Estado final - Sesiones activas' as info;
SELECT COUNT(*) as sesiones_activas FROM user_sessions WHERE is_active = 1;

SELECT 'Estado final - Agentes por admin' as info;
SELECT 
    admin_phone,
    COUNT(*) as agentes_activos
FROM users 
WHERE role IN ('agent', 'supervisor') 
    AND status = 'active'
GROUP BY admin_phone;