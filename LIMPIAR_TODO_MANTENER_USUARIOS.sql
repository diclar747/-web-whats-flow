-- =====================================================
-- LIMPIEZA COMPLETA DE BASE DE DATOS
-- Mantiene solo usuarios, elimina todo lo demás
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Eliminar datos de chats y mensajes
TRUNCATE TABLE messages;
TRUNCATE TABLE chats;
TRUNCATE TABLE chat_assignments;

-- Eliminar datos de contactos y grupos
TRUNCATE TABLE contact_group_members;
TRUNCATE TABLE contact_groups;
TRUNCATE TABLE contacts;
TRUNCATE TABLE contact_segments;

-- Eliminar datos de agentes
TRUNCATE TABLE agent_chat_history;
TRUNCATE TABLE agents;

-- Eliminar datos de chatbot
TRUNCATE TABLE chatbot_interactions;
TRUNCATE TABLE chatbot_flows;
TRUNCATE TABLE chatbot_settings;

-- Eliminar campañas y broadcasts
TRUNCATE TABLE campaign_recipients;
TRUNCATE TABLE campaigns;
TRUNCATE TABLE broadcasts;

-- Eliminar estados de WhatsApp
TRUNCATE TABLE status_schedule_items;
TRUNCATE TABLE status_schedules;
TRUNCATE TABLE whatsapp_statuses;
TRUNCATE TABLE status_analytics;

-- Eliminar citas
TRUNCATE TABLE appointment_reminders_sent;
TRUNCATE TABLE appointments;
TRUNCATE TABLE appointment_templates;
TRUNCATE TABLE appointment_categories;
TRUNCATE TABLE appointment_reminder_config;

-- Eliminar kanban
TRUNCATE TABLE kanban_contacts;
TRUNCATE TABLE kanban_boards;

-- Eliminar segmentos
TRUNCATE TABLE segments;

-- Eliminar mapeos LID
TRUNCATE TABLE lid_mappings;

-- Eliminar suscripciones
TRUNCATE TABLE subscription_history;
TRUNCATE TABLE subscriptions;
TRUNCATE TABLE subscription_plans;

-- Eliminar dispositivos PWA
TRUNCATE TABLE pwa_devices;

-- Eliminar sesiones de usuario
TRUNCATE TABLE user_sessions;

-- Eliminar permisos de usuario (opcional, comentar si quieres mantenerlos)
TRUNCATE TABLE user_permissions;

SET FOREIGN_KEY_CHECKS = 1;

-- Verificar que solo quedan usuarios
SELECT 'Usuarios restantes:' as Info;
SELECT COUNT(*) as total_users FROM users;

SELECT 'Admin usuarios restantes:' as Info;
SELECT COUNT(*) as total_admin_users FROM admin_users;

-- Verificar que otras tablas están vacías
SELECT 'Mensajes:' as Tabla, COUNT(*) as Registros FROM messages
UNION ALL
SELECT 'Chats:', COUNT(*) FROM chats
UNION ALL
SELECT 'Contactos:', COUNT(*) FROM contacts
UNION ALL
SELECT 'Agentes:', COUNT(*) FROM agents
UNION ALL
SELECT 'Campañas:', COUNT(*) FROM campaigns
UNION ALL
SELECT 'Citas:', COUNT(*) FROM appointments;

SELECT '✓ Limpieza completada exitosamente' as Estado;
