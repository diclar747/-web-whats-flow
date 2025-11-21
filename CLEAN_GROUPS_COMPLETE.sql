-- ====================================================================
-- SCRIPT COMPLETO PARA LIMPIAR GRUPOS Y MIEMBROS
-- Ejecutar con: mysql -u root -p'Langostino#23' whatsflow < CLEAN_GROUPS_COMPLETE.sql
-- ====================================================================

-- Limpiar contact_group_members (tabla de miembros de grupos)
DELETE FROM contact_group_members;
ALTER TABLE contact_group_members AUTO_INCREMENT = 1;
SELECT '✅ Tabla contact_group_members limpiada' AS Status;

-- Limpiar contact_groups (tabla de grupos)
DELETE FROM contact_groups;
ALTER TABLE contact_groups AUTO_INCREMENT = 1;
SELECT '✅ Tabla contact_groups limpiada' AS Status;

-- Limpiar mensajes de grupos
DELETE FROM messages WHERE chat_jid LIKE '%@g.us';
SELECT '✅ Mensajes de grupos eliminados' AS Status;

-- Limpiar chats de grupos
DELETE FROM chats WHERE jid LIKE '%@g.us';
SELECT '✅ Chats de grupos eliminados' AS Status;

SELECT '✅✅✅ LIMPIEZA DE GRUPOS COMPLETADA ✅✅✅' AS Status;
