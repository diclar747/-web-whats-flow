-- Script para verificar y corregir la estructura de agentes por admin
-- Fecha: 2025-11-26

-- 1. Verificar estructura de la tabla users
SELECT 
    'Verificando estructura de tabla users' as info;
DESCRIBE users;

-- 2. Verificar agentes por admin
SELECT 
    'Agentes por admin' as info;
SELECT 
    admin_phone,
    COUNT(*) as total_agentes,
    GROUP_CONCAT(email) as agentes
FROM users 
WHERE role IN ('agent', 'supervisor') 
    AND status = 'active'
    AND admin_phone IS NOT NULL
GROUP BY admin_phone;

-- 3. Verificar agentes sin admin_phone
SELECT 
    'Agentes sin admin_phone' as info;
SELECT 
    id, name, email, role, session_id
FROM users 
WHERE role IN ('agent', 'supervisor') 
    AND status = 'active'
    AND (admin_phone IS NULL OR admin_phone = '');

-- 4. Verificar session_id de agentes
SELECT 
    'Session IDs de agentes' as info;
SELECT 
    u.admin_phone,
    u.email as agente_email,
    u.session_id as agente_session,
    us.phone_number as admin_phone_real,
    us.session_id as admin_session
FROM users u
LEFT JOIN user_sessions us ON u.admin_phone = us.phone_number
WHERE u.role IN ('agent', 'supervisor') 
    AND u.status = 'active'
    AND u.admin_phone IS NOT NULL;

-- 5. Verificar admins activos
SELECT 
    'Admins activos' as info;
SELECT 
    phone_number,
    session_id,
    is_active,
    last_activity
FROM user_sessions 
WHERE is_active = 1
ORDER BY last_activity DESC;

-- 6. Corregir agentes sin admin_phone (si es necesario)
-- UPDATE users 
-- SET admin_phone = '595985768793' 
-- WHERE role IN ('agent', 'supervisor') 
--     AND status = 'active'
--     AND (admin_phone IS NULL OR admin_phone = '')
--     AND email = 'claudio@cnid.com.py';

-- 7. Verificar contador de agentes en dashboard
SELECT 
    'Verificación contador dashboard' as info;
SELECT 
    admin_phone,
    COUNT(*) as agentes_activos
FROM users 
WHERE role IN ('agent', 'supervisor') 
    AND status = 'active'
    AND admin_phone = '595985768793';

-- 8. Verificar sesiones activas en memoria
SELECT 
    'Sesiones activas en sistema' as info;
SELECT 
    COUNT(*) as sesiones_activas
FROM user_sessions 
WHERE is_active = 1;