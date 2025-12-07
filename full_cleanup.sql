-- ============================================
-- LIMPIEZA COMPLETA DE BASE DE DATOS
-- WhatsFlow - Preparación para datos reales
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. LIMPIAR CAMPAÑAS
DELETE FROM campaign_recipients;
DELETE FROM campaigns;
DELETE FROM campaign_templates;
DELETE FROM campaign_settings;

-- 2. LIMPIAR MENSAJES
DELETE FROM messages;

-- 3. LIMPIAR CONTACTOS (excepto el admin principal)
DELETE FROM contacts WHERE jid != '595985768793@s.whatsapp.net';
DELETE FROM crm_contacts;

-- 4. LIMPIAR GRUPOS
DELETE FROM contact_group_members;
DELETE FROM contact_groups;

-- 5. LIMPIAR SESIONES ANTIGUAS
DELETE FROM user_sessions WHERE phone_number != '595985768793' OR is_active = 0;

-- 6. LIMPIAR AGENTES
DELETE FROM users WHERE role = 'agent';
DELETE FROM user_permissions;

-- 7. LIMPIAR TABLEROS KANBAN
DELETE FROM kanban_contacts;
DELETE FROM kanban_boards;

-- 8. LIMPIAR CITAS
DELETE FROM appointment_reminders_sent;
DELETE FROM appointments;
DELETE FROM appointment_templates;
DELETE FROM appointment_categories;
DELETE FROM appointment_reminder_config;

-- 9. LIMPIAR ESTADOS DE WHATSAPP
DELETE FROM whatsapp_statuses_history;
DELETE FROM whatsapp_statuses;
DELETE FROM status_schedules;

-- 10. LIMPIAR CHATBOTS
DELETE FROM chatbot_flows;
DELETE FROM chatbot_settings;

SET FOREIGN_KEY_CHECKS = 1;

-- 11. RESETEAR AUTO_INCREMENT
ALTER TABLE campaigns AUTO_INCREMENT = 1;
ALTER TABLE campaign_recipients AUTO_INCREMENT = 1;
ALTER TABLE contacts AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE kanban_boards AUTO_INCREMENT = 1;
ALTER TABLE appointments AUTO_INCREMENT = 1;
ALTER TABLE messages AUTO_INCREMENT = 1;

-- 12. VERIFICAR LIMPIEZA
SELECT 'Campañas' as tabla, COUNT(*) as registros FROM campaigns
UNION ALL
SELECT 'Destinatarios', COUNT(*) FROM campaign_recipients
UNION ALL
SELECT 'Mensajes', COUNT(*) FROM messages
UNION ALL
SELECT 'Contactos', COUNT(*) FROM contacts
UNION ALL
SELECT 'Sesiones', COUNT(*) FROM user_sessions
UNION ALL
SELECT 'Agentes', COUNT(*) FROM users WHERE role = 'agent'
UNION ALL
SELECT 'Kanban', COUNT(*) FROM kanban_boards
UNION ALL
SELECT 'Grupos', COUNT(*) FROM contact_groups
UNION ALL
SELECT 'Citas', COUNT(*) FROM appointments
UNION ALL
SELECT 'Estados WA', COUNT(*) FROM whatsapp_statuses
UNION ALL
SELECT 'Chatbots', COUNT(*) FROM chatbot_flows;

SELECT '✅ LIMPIEZA COMPLETADA - Sistema listo para datos reales' as status;
