-- Script para limpiar todos los datos de sincronización de WhatsApp
-- Ejecutar este script cuando quieras limpiar completamente la base de datos
-- para probar la sincronización desde cero

-- ADVERTENCIA: Este script eliminará TODOS los datos de sincronización
-- Asegúrate de hacer un backup antes si necesitas los datos

USE whatsflow;

-- Desactivar verificaciones de llaves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Limpiar tabla de mensajes
TRUNCATE TABLE messages;
SELECT 'Tabla messages limpiada' AS status;

-- Limpiar tabla de miembros de grupos (intermedia)
TRUNCATE TABLE contact_group_members;
SELECT 'Tabla contact_group_members limpiada' AS status;

-- Limpiar tabla de grupos
TRUNCATE TABLE contact_groups;
SELECT 'Tabla contact_groups limpiada' AS status;

-- Limpiar tabla de contactos
TRUNCATE TABLE contacts;
SELECT 'Tabla contacts limpiada' AS status;

-- Limpiar tabla de broadcasts
TRUNCATE TABLE broadcasts;
SELECT 'Tabla broadcasts limpiada' AS status;

-- Resetear flags de sincronización en usuarios
UPDATE users
SET auto_sync = FALSE,
    sync_completed = FALSE,
    last_sync_date = NULL
WHERE 1=1;
SELECT 'Flags de sincronización reseteados en tabla users' AS status;

-- Reactivar verificaciones de llaves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- Mostrar resumen
SELECT
    'Limpieza completada exitosamente' AS status,
    (SELECT COUNT(*) FROM messages) AS messages_count,
    (SELECT COUNT(*) FROM contacts) AS contacts_count,
    (SELECT COUNT(*) FROM contact_groups) AS groups_count,
    (SELECT COUNT(*) FROM contact_group_members) AS members_count,
    (SELECT COUNT(*) FROM broadcasts) AS broadcasts_count;
