-- =====================================================
-- SCRIPT DE LIMPIEZA COMPLETA DE BASE DE DATOS
-- WhatsFlow System - 2025-11-21
-- =====================================================

USE whatsflow;

-- =====================================================
-- 1. LIMPIAR DATOS DE GRUPOS Y MIEMBROS
-- =====================================================
SET FOREIGN_KEY_CHECKS = 0;

-- Eliminar todos los mensajes de grupos
DELETE FROM messages WHERE chat_jid LIKE '%@g.us';

-- Eliminar todos los miembros de grupos
TRUNCATE TABLE contact_group_members;

-- Eliminar todos los grupos
TRUNCATE TABLE contact_groups;

-- Eliminar asignaciones de chats de grupos
DELETE FROM chat_assignments WHERE chat_jid LIKE '%@g.us';

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Grupos y miembros eliminados' as Status;

-- =====================================================
-- 2. LIMPIAR CACHÉ Y DATOS TEMPORALES
-- =====================================================

-- Limpiar sesiones antiguas (más de 7 días)
DELETE FROM user_sessions WHERE updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY) AND user_role = 'agent';

-- Limpiar mensajes antiguos no importantes (más de 30 días)
-- DELETE FROM messages WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY) AND message_type = 'notification';

SELECT 'Caché limpiado' as Status;

-- =====================================================
-- 3. OPTIMIZAR TABLAS
-- =====================================================

OPTIMIZE TABLE messages;
OPTIMIZE TABLE contacts;
OPTIMIZE TABLE contact_groups;
OPTIMIZE TABLE contact_group_members;
OPTIMIZE TABLE chat_assignments;
OPTIMIZE TABLE user_sessions;

SELECT 'Tablas optimizadas' as Status;

-- =====================================================
-- 4. VERIFICAR INTEGRIDAD DE DATOS
-- =====================================================

-- Verificar usuarios sin permisos básicos
SELECT u.id, u.email, u.role, COUNT(up.id) as permission_count
FROM users u
LEFT JOIN user_permissions up ON u.id = up.user_id
WHERE u.role = 'agent'
GROUP BY u.id, u.email, u.role;

-- Verificar agentes con chats asignados
SELECT u.id, u.name, u.email, COUNT(ca.id) as active_chats
FROM users u
LEFT JOIN chat_assignments ca ON u.id = ca.user_id AND ca.status = 'active'
WHERE u.role = 'agent'
GROUP BY u.id, u.name, u.email;

SELECT '✅ Limpieza completa finalizada' as Status;
