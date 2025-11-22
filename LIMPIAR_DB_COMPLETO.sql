-- ==========================================
-- LIMPIEZA COMPLETA BASE DE DATOS
-- ==========================================

USE whatsflow;

-- Deshabilitar foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- 1. LIMPIAR SISTEMA DE AGENTES
TRUNCATE TABLE agents;
TRUNCATE TABLE agent_chat_history;

-- 2. LIMPIAR CHATS Y MENSAJES
TRUNCATE TABLE messages;

-- 3. LIMPIAR CONTACTOS Y GRUPOS
TRUNCATE TABLE contacts;
TRUNCATE TABLE contact_groups;
TRUNCATE TABLE contact_group_members;
TRUNCATE TABLE contact_segments;

-- 4. LIMPIAR KANBAN
TRUNCATE TABLE kanban_contacts;
TRUNCATE TABLE kanban_boards;

-- 5. LIMPIAR CHATBOT
TRUNCATE TABLE chatbot_flows;
TRUNCATE TABLE chatbot_interactions;
TRUNCATE TABLE chatbot_settings;

-- 6. LIMPIAR PERMISOS
TRUNCATE TABLE user_permissions;

-- 7. REINICIAR AUTO_INCREMENT
ALTER TABLE agents AUTO_INCREMENT = 1;
ALTER TABLE messages AUTO_INCREMENT = 1;
ALTER TABLE contacts AUTO_INCREMENT = 1;
ALTER TABLE contact_groups AUTO_INCREMENT = 1;
ALTER TABLE kanban_boards AUTO_INCREMENT = 1;
ALTER TABLE kanban_contacts AUTO_INCREMENT = 1;
ALTER TABLE chatbot_flows AUTO_INCREMENT = 1;

-- Rehabilitar foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- RESULTADO
-- ==========================================
SELECT '✅ Base de datos limpiada completamente' as STATUS;

-- Verificar conteo de registros
SELECT 
    'agents' as tabla, COUNT(*) as registros FROM agents
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'contact_groups', COUNT(*) FROM contact_groups
UNION ALL
SELECT 'kanban_boards', COUNT(*) FROM kanban_boards
UNION ALL
SELECT 'chatbot_flows', COUNT(*) FROM chatbot_flows
UNION ALL
SELECT 'user_permissions', COUNT(*) FROM user_permissions;
