-- ====================================================================
-- SCRIPT COMPLETO PARA LIMPIAR TODA LA BASE DE DATOS
-- ⚠️ CUIDADO: Esto eliminará TODOS los contactos, grupos, mensajes y chats
-- Ejecutar con: mysql -u root -p'Langostino#23' whatsflow < CLEAN_DATABASE_TOTAL.sql
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Limpiar mensajes
DELETE FROM messages;
ALTER TABLE messages AUTO_INCREMENT = 1;
SELECT '✅ 1/8 - Mensajes eliminados' AS Status;

-- 2. Limpiar chats
DELETE FROM chats;
ALTER TABLE chats AUTO_INCREMENT = 1;
SELECT '✅ 2/8 - Chats eliminados' AS Status;

-- 3. Limpiar contactos
DELETE FROM contacts;
ALTER TABLE contacts AUTO_INCREMENT = 1;
SELECT '✅ 3/8 - Contactos eliminados' AS Status;

-- 4. Limpiar grupos
DELETE FROM contact_groups;
ALTER TABLE contact_groups AUTO_INCREMENT = 1;
SELECT '✅ 4/8 - Grupos eliminados' AS Status;

-- 5. Limpiar miembros de grupos
DELETE FROM contact_group_members;
ALTER TABLE contact_group_members AUTO_INCREMENT = 1;
SELECT '✅ 5/8 - Miembros de grupos eliminados' AS Status;

-- 6. Limpiar asignaciones de chat
DELETE FROM chat_assignments;
ALTER TABLE chat_assignments AUTO_INCREMENT = 1;
SELECT '✅ 6/8 - Asignaciones de chat eliminadas' AS Status;

-- 7. Limpiar historial de chat de agentes
DELETE FROM agent_chat_history;
ALTER TABLE agent_chat_history AUTO_INCREMENT = 1;
SELECT '✅ 7/8 - Historial de agentes eliminado' AS Status;

-- 8. Limpiar notas de contactos
DELETE FROM contact_notes WHERE 1=1;
SELECT '✅ 8/8 - Notas de contactos eliminadas' AS Status;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '
✅✅✅ LIMPIEZA COMPLETA DE BASE DE DATOS FINALIZADA ✅✅✅

Los siguientes datos fueron eliminados:
- Todos los mensajes
- Todos los chats
- Todos los contactos individuales
- Todos los grupos
- Todos los miembros de grupos
- Todas las asignaciones de chat a agentes
- Todo el historial de agentes
- Todas las notas de contactos

Las sesiones de WhatsApp y usuarios se mantienen intactos.
' AS Resumen;
