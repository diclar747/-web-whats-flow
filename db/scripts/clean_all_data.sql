-- ========================================
-- SCRIPT DE LIMPIEZA COMPLETA DE BASE DE DATOS
-- Fecha: 2025-11-18
-- Descripción: Limpia TODOS los datos de mensajes, contactos, grupos, chats y cache
-- ADVERTENCIA: Esta operación es IRREVERSIBLE
-- ========================================

SET FOREIGN_KEY_CHECKS = 0;

-- ========================================
-- 1. LIMPIAR MENSAJES Y RELACIONADOS
-- ========================================
TRUNCATE TABLE message_reactions;
TRUNCATE TABLE message_metadata;
TRUNCATE TABLE messages;

SELECT 'Mensajes limpiados' as paso;

-- ========================================
-- 2. LIMPIAR CONTACTOS Y GRUPOS
-- ========================================
TRUNCATE TABLE contact_group_members;
TRUNCATE TABLE contact_groups;
TRUNCATE TABLE contacts;
TRUNCATE TABLE crm_contacts;

SELECT 'Contactos y grupos limpiados' as paso;

-- ========================================
-- 3. LIMPIAR CHATS Y ASIGNACIONES
-- ========================================
TRUNCATE TABLE chat_transfers;
TRUNCATE TABLE chat_assignments;
TRUNCATE TABLE chats;

SELECT 'Chats limpiados' as paso;

-- ========================================
-- 4. LIMPIAR CAMPAÑAS
-- ========================================
TRUNCATE TABLE campaign_recipients;
TRUNCATE TABLE campaign_contacts;
TRUNCATE TABLE campaigns;
TRUNCATE TABLE broadcasts;

SELECT 'Campañas limpiadas' as paso;

-- ========================================
-- 5. LIMPIAR HISTORIAL DE AGENTES
-- ========================================
TRUNCATE TABLE agent_chat_history;
TRUNCATE TABLE agent_activity_logs;

SELECT 'Historial de agentes limpiado' as paso;

-- ========================================
-- 6. LIMPIAR KANBAN CONTACTS
-- ========================================
TRUNCATE TABLE kanban_contacts;

SELECT 'Kanban contacts limpiado' as paso;

-- ========================================
-- 7. LIMPIAR ESTADOS DE WHATSAPP
-- ========================================
TRUNCATE TABLE whatsapp_statuses_history;
TRUNCATE TABLE whatsapp_statuses;

SELECT 'Estados de WhatsApp limpiados' as paso;

-- ========================================
-- 8. LIMPIAR CHATBOTS
-- ========================================
TRUNCATE TABLE chatbot_flows;
TRUNCATE TABLE chatbot_settings;

SELECT 'Chatbots limpiados' as paso;

-- ========================================
-- 9. LIMPIAR TRANSFERENCIAS
-- ========================================
TRUNCATE TABLE transfer_requests;

SELECT 'Transferencias limpiadas' as paso;

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- RESUMEN FINAL
-- ========================================
SELECT 'LIMPIEZA COMPLETA FINALIZADA' as resultado;

SELECT
    'messages' as tabla, COUNT(*) as registros FROM messages
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'contact_groups', COUNT(*) FROM contact_groups
UNION ALL
SELECT 'chats', COUNT(*) FROM chats
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'message_reactions', COUNT(*) FROM message_reactions
UNION ALL
SELECT 'chat_assignments', COUNT(*) FROM chat_assignments
UNION ALL
SELECT 'kanban_contacts', COUNT(*) FROM kanban_contacts
UNION ALL
SELECT 'whatsapp_statuses', COUNT(*) FROM whatsapp_statuses;

SELECT 'Todas las tablas han sido limpiadas completamente' as mensaje;
SELECT 'NOTA: Los usuarios, sesiones, agentes y configuraciones se mantienen intactos' as nota;
