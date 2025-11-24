-- ============================================
-- LIMPIEZA COMPLETA 100% - WhatsFlow Database
-- Mantiene: Usuarios y Estructura de tablas
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. LIMPIAR MENSAJES Y CHATS
TRUNCATE TABLE messages;
TRUNCATE TABLE chats;

-- 2. LIMPIAR CONTACTOS Y GRUPOS
TRUNCATE TABLE contacts;
TRUNCATE TABLE contact_groups;
TRUNCATE TABLE contact_group_members;

-- 3. LIMPIAR ASIGNACIONES DE CHAT Y HISTORIAL DE AGENTES
TRUNCATE TABLE chat_assignments;
TRUNCATE TABLE agent_chat_history;

-- 4. LIMPIAR CAMPAÑAS Y BROADCASTS
TRUNCATE TABLE campaigns;
TRUNCATE TABLE campaign_recipients;
TRUNCATE TABLE broadcasts;

-- 5. LIMPIAR CHATBOT
TRUNCATE TABLE chatbot_flows;
TRUNCATE TABLE chatbot_interactions;
TRUNCATE TABLE chatbot_settings;

-- 6. LIMPIAR KANBAN
TRUNCATE TABLE kanban_boards;
TRUNCATE TABLE kanban_contacts;

-- 7. LIMPIAR STATUS/ESTADOS
TRUNCATE TABLE whatsapp_statuses;
TRUNCATE TABLE status_schedules;
TRUNCATE TABLE status_schedule_items;
TRUNCATE TABLE status_analytics;

-- 8. LIMPIAR CITAS
TRUNCATE TABLE appointments;
TRUNCATE TABLE appointment_reminders_sent;

-- 9. LIMPIAR SESIONES DE WHATSAPP (IMPORTANTE)
TRUNCATE TABLE user_sessions;

-- 10. LIMPIAR LID MAPPINGS
TRUNCATE TABLE lid_mappings;

-- 11. LIMPIAR SEGMENTOS
TRUNCATE TABLE segments;
TRUNCATE TABLE contact_segments;

-- 12. ACTUALIZAR USUARIOS - Limpiar session_id
UPDATE users SET session_id = NULL WHERE role IN ('agent', 'supervisor', 'admin');

-- 13. REINICIAR AUTO_INCREMENT
ALTER TABLE messages AUTO_INCREMENT = 1;
ALTER TABLE chats AUTO_INCREMENT = 1;
ALTER TABLE contacts AUTO_INCREMENT = 1;
ALTER TABLE chat_assignments AUTO_INCREMENT = 1;
ALTER TABLE campaigns AUTO_INCREMENT = 1;
ALTER TABLE broadcasts AUTO_INCREMENT = 1;
ALTER TABLE chatbot_flows AUTO_INCREMENT = 1;
ALTER TABLE kanban_boards AUTO_INCREMENT = 1;
ALTER TABLE appointments AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- MOSTRAR RESUMEN
SELECT 'LIMPIEZA COMPLETA FINALIZADA' AS STATUS;
SELECT COUNT(*) AS mensajes_restantes FROM messages;
SELECT COUNT(*) AS contactos_restantes FROM contacts;
SELECT COUNT(*) AS chats_restantes FROM chats;
SELECT COUNT(*) AS usuarios_activos FROM users WHERE status = 'active';
