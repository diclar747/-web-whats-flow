-- ============================================
-- FIX AGENT SYSTEM - Solución Completa
-- ============================================
-- Este script corrige toda la configuración del sistema de agentes

USE whatsflow;

-- 1. Asegurar que el agente tenga el admin_phone correcto
UPDATE users 
SET admin_phone = '595985768793' 
WHERE id = 4 AND role = 'agent';

-- 2. Verificar sesiones activas del admin
SELECT 
    '=== SESIONES ACTIVAS DEL ADMIN ===' AS info,
    session_id, 
    phone_number, 
    is_active, 
    last_activity
FROM user_sessions 
WHERE phone_number = '595985768793' 
AND is_active = 1;

-- 3. Verificar configuración del agente
SELECT 
    '=== CONFIGURACIÓN DEL AGENTE ===' AS info,
    id, 
    name, 
    email, 
    role, 
    admin_phone, 
    status
FROM users 
WHERE id = 4;

-- 4. Mostrar chats asignados al agente
SELECT 
    '=== CHATS ASIGNADOS AL AGENTE ===' AS info,
    ca.id,
    ca.chat_jid,
    ca.session_id,
    ca.status,
    ca.assigned_at,
    COALESCE(c.name, SUBSTRING_INDEX(ca.chat_jid, '@', 1)) as contact_name
FROM chat_assignments ca
LEFT JOIN contacts c ON c.jid = ca.chat_jid AND c.session_id = ca.session_id
WHERE ca.user_id = 4 
AND ca.status = 'active'
ORDER BY ca.assigned_at DESC;

-- 5. Limpiar asignaciones duplicadas (si las hay)
DELETE t1 FROM chat_assignments t1
INNER JOIN chat_assignments t2 
WHERE 
    t1.id > t2.id 
    AND t1.chat_jid = t2.chat_jid 
    AND t1.user_id = t2.user_id 
    AND t1.session_id = t2.session_id
    AND t1.status = t2.status;

SELECT '✅ Sistema de agentes corregido' AS resultado;
