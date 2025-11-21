-- =============================================
-- FIX COMPLETO DEL SISTEMA DE AGENTES
-- =============================================

-- 1. Actualizar chats asignados para usar la sesión activa actual
UPDATE chat_assignments ca
JOIN user_sessions us ON us.is_active = 1 AND us.phone_number = '595985768793'
SET ca.session_id = us.session_id
WHERE ca.status = 'active';

-- 2. Verificar resultados
SELECT 'Chats actualizados:' as resultado, COUNT(*) as cantidad
FROM chat_assignments ca
JOIN user_sessions us ON ca.session_id = us.session_id
WHERE ca.status = 'active' AND us.is_active = 1;

-- 3. Mostrar chats del agente con sessionId activo
SELECT 
    ca.id,
    ca.chat_jid,
    ca.session_id,
    ca.user_id,
    u.name as agent_name,
    COALESCE(c.name, SUBSTRING_INDEX(ca.chat_jid, '@', 1)) as contact_name,
    us.phone_number,
    us.is_active
FROM chat_assignments ca
JOIN users u ON ca.user_id = u.id
LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
JOIN user_sessions us ON ca.session_id = us.session_id
WHERE ca.status = 'active'
LIMIT 10;
