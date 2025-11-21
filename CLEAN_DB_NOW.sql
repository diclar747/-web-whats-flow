-- LIMPIEZA COMPLETA DE BASE DE DATOS
USE whatsflow;

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

-- Limpiar sesiones antiguas de agentes
DELETE FROM user_sessions WHERE user_role = 'agent' AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Optimizar tablas
OPTIMIZE TABLE messages;
OPTIMIZE TABLE contacts;
OPTIMIZE TABLE contact_groups;
OPTIMIZE TABLE contact_group_members;
OPTIMIZE TABLE chat_assignments;
OPTIMIZE TABLE user_sessions;

SELECT '✅ Limpieza completa finalizada' as Status;

-- Verificar agentes
SELECT u.id, u.name, u.email, u.role, COUNT(ca.id) as active_chats
FROM users u
LEFT JOIN chat_assignments ca ON u.id = ca.user_id AND ca.status = 'active'
WHERE u.role = 'agent'
GROUP BY u.id, u.name, u.email, u.role;
