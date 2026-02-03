-- Migración: Crear tabla chat y migrar datos recientes
-- Esta migración crea la tabla optimizada para la interfaz de chat
-- y migra los mensajes recientes (últimos 30 días)

-- ============================================================
-- 1. CREAR TABLA CHAT (si no existe)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    chat_jid VARCHAR(255) NOT NULL,
    sender_jid VARCHAR(255),
    from_me BOOLEAN NOT NULL,
    message_type VARCHAR(50),
    text_content TEXT,
    media_url VARCHAR(1024),
    media_mime_type VARCHAR(100),
    timestamp DATETIME NOT NULL,
    status VARCHAR(50) DEFAULT 'received',
    is_read BOOLEAN DEFAULT FALSE,
    sender_name VARCHAR(255),
    sender_pushname VARCHAR(255),
    agent_id INT,
    agent_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_chat (session_id, chat_jid),
    INDEX idx_session_timestamp (session_id, timestamp),
    INDEX idx_timestamp (timestamp),
    INDEX idx_chat_timestamp (chat_jid, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. MIGRAR MENSAJES RECIENTES (últimos 30 días)
-- ============================================================
-- Solo migramos mensajes recientes para mantener la tabla chat liviana
INSERT INTO chat (
    id, session_id, chat_jid, sender_jid, from_me,
    message_type, text_content, media_url, media_mime_type,
    timestamp, status, is_read, sender_name, sender_pushname,
    agent_id, agent_name
)
SELECT 
    m.id,
    m.session_id,
    m.chat_jid,
    m.sender_jid,
    m.from_me,
    m.message_type,
    m.text_content,
    m.media_url,
    m.media_mime_type,
    m.timestamp,
    m.status,
    m.is_read,
    m.sender_name,
    NULL as sender_pushname,
    m.agent_id,
    m.agent_name
FROM messages m
WHERE m.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND m.id NOT IN (SELECT id FROM chat WHERE id IS NOT NULL)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    is_read = VALUES(is_read),
    sender_name = VALUES(sender_name),
    agent_id = VALUES(agent_id),
    agent_name = VALUES(agent_name),
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- 3. VERIFICAR RESULTADO
-- ============================================================
SELECT 
    'Migración completada' as estado,
    COUNT(*) as mensajes_migrados,
    MIN(timestamp) as primer_mensaje,
    MAX(timestamp) as ultimo_mensaje
FROM chat;
