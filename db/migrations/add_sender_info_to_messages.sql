-- Migración: Agregar campos de información del remitente a la tabla messages
-- Fecha: 2025-11-18
-- Descripción: Agrega sender_name y sender_avatar para mejorar la visualización de mensajes en el chat

-- Agregar columna sender_name
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255) DEFAULT NULL COMMENT 'Nombre del remitente en el momento del mensaje';

-- Agregar columna sender_avatar
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS sender_avatar VARCHAR(1024) DEFAULT NULL COMMENT 'URL del avatar del remitente en el momento del mensaje';

-- Índice para mejorar búsquedas por remitente
ALTER TABLE messages
ADD INDEX IF NOT EXISTS idx_sender_jid (sender_jid);

-- Actualizar mensajes existentes con información de contacts (solo para referencia histórica)
UPDATE messages m
LEFT JOIN contacts c ON m.sender_jid = c.jid AND m.session_id = c.session_id
SET
    m.sender_name = COALESCE(c.name, c.notify_name),
    m.sender_avatar = c.avatar_url
WHERE m.sender_name IS NULL
  AND c.jid IS NOT NULL;

-- Mostrar estadísticas de la migración
SELECT
    COUNT(*) as total_mensajes,
    COUNT(sender_name) as mensajes_con_nombre,
    COUNT(sender_avatar) as mensajes_con_avatar,
    COUNT(*) - COUNT(sender_name) as mensajes_sin_nombre
FROM messages;

-- Verificación
DESCRIBE messages;
