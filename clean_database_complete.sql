-- Limpieza completa de la base de datos WhatsFlow
-- Mantiene estructura pero limpia datos transaccionales

USE whatsflow;

-- Limpiar mensajes y chats
TRUNCATE TABLE messages;
TRUNCATE TABLE chats;
TRUNCATE TABLE chatbot_interactions;
TRUNCATE TABLE chat_assignments;
TRUNCATE TABLE agent_chat_history;

-- Desactivar verificación de foreign keys
SET FOREIGN_KEY_CHECKS = 0;

-- Limpiar grupos de WhatsApp y sus miembros
TRUNCATE TABLE contact_group_members;
TRUNCATE TABLE contact_groups;

-- Limpiar contactos de WhatsApp
TRUNCATE TABLE contacts;

-- Limpiar campañas y broadcasts
TRUNCATE TABLE campaign_recipients;
TRUNCATE TABLE campaigns;
TRUNCATE TABLE broadcasts;

-- Limpiar kanban
TRUNCATE TABLE kanban_contacts;

-- Limpiar segmentos
TRUNCATE TABLE contact_segments;
TRUNCATE TABLE segments;

-- Reactivar verificación de foreign keys
SET FOREIGN_KEY_CHECKS = 1;

-- Limpiar sesiones antiguas
DELETE FROM user_sessions WHERE last_activity < DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Limpiar recordatorios enviados
TRUNCATE TABLE appointment_reminders_sent;

-- Limpiar historial de suscripciones antiguo
DELETE FROM subscription_history WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

SELECT 'Base de datos limpiada exitosamente' AS resultado;
