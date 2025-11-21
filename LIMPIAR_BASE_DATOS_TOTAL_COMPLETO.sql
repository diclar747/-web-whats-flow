-- =====================================================
-- LIMPIEZA TOTAL Y COMPLETA DE LA BASE DE DATOS
-- Elimina TODOS los datos excepto usuarios y configuración
-- =====================================================

USE whatsflow;

-- Deshabilitar verificaciones de claves foráneas
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- 1. LIMPIAR MENSAJES Y CHATS
-- =====================================================
TRUNCATE TABLE messages;
TRUNCATE TABLE chats;
TRUNCATE TABLE agent_chat_history;

-- =====================================================
-- 2. LIMPIAR CONTACTOS
-- =====================================================
TRUNCATE TABLE contacts;
TRUNCATE TABLE contact_groups;
TRUNCATE TABLE contact_group_members;
TRUNCATE TABLE contact_segments;

-- =====================================================
-- 3. LIMPIAR GRUPOS (Si existen tablas de grupos)
-- =====================================================
-- TRUNCATE TABLE whatsapp_groups;
-- TRUNCATE TABLE group_members;

-- =====================================================
-- 4. LIMPIAR TRANSFERENCIAS Y ASIGNACIONES
-- =====================================================
TRUNCATE TABLE chat_assignments;

-- =====================================================
-- 5. LIMPIAR CAMPAÑAS Y ENVÍOS
-- =====================================================
TRUNCATE TABLE campaigns;
TRUNCATE TABLE campaign_recipients;
TRUNCATE TABLE broadcasts;

-- =====================================================
-- 6. LIMPIAR CHATBOT Y FLOWS
-- =====================================================
TRUNCATE TABLE chatbot_flows;
TRUNCATE TABLE chatbot_interactions;
TRUNCATE TABLE chatbot_settings;

-- =====================================================
-- 7. LIMPIAR CITAS Y CALENDARIO
-- =====================================================
TRUNCATE TABLE appointments;
TRUNCATE TABLE appointment_categories;
TRUNCATE TABLE appointment_reminders_sent;
TRUNCATE TABLE appointment_templates;

-- =====================================================
-- 8. LIMPIAR MEDIOS Y ARCHIVOS
-- =====================================================
-- TRUNCATE TABLE media_files;

-- =====================================================
-- 9. LIMPIAR MÉTRICAS Y LOGS
-- =====================================================
-- TRUNCATE TABLE system_logs;

-- =====================================================
-- 10. LIMPIAR KANBAN Y TABLEROS
-- =====================================================
TRUNCATE TABLE kanban_boards;
TRUNCATE TABLE kanban_contacts;

-- =====================================================
-- 11. LIMPIAR SESIONES Y TOKENS
-- =====================================================
TRUNCATE TABLE user_sessions;

-- Habilitar verificaciones de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
SELECT 'Mensajes' as tabla, COUNT(*) as registros FROM messages
UNION ALL
SELECT 'Chats', COUNT(*) FROM chats
UNION ALL
SELECT 'Contactos', COUNT(*) FROM contacts
UNION ALL
SELECT 'Asignaciones', COUNT(*) FROM chat_assignments
UNION ALL
SELECT 'Campañas', COUNT(*) FROM campaigns
UNION ALL
SELECT 'Usuarios', COUNT(*) FROM users
UNION ALL
SELECT 'Agentes', COUNT(*) FROM agents;

-- =====================================================
-- RESETEAR AUTO_INCREMENT
-- =====================================================
ALTER TABLE messages AUTO_INCREMENT = 1;
ALTER TABLE chats AUTO_INCREMENT = 1;
ALTER TABLE contacts AUTO_INCREMENT = 1;
ALTER TABLE campaigns AUTO_INCREMENT = 1;
ALTER TABLE appointments AUTO_INCREMENT = 1;
ALTER TABLE chat_assignments AUTO_INCREMENT = 1;

SELECT '✅ BASE DE DATOS LIMPIADA COMPLETAMENTE' as resultado;
