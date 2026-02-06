-- =====================================================
-- SCRIPT DE OPTIMIZACIÓN DE BASE DE DATOS - WINSAP
-- Ejecutar con: mysql -u root -p whatsflow < optimize_database.sql
-- =====================================================

-- =====================================================
-- 1. INDICES PARA MEJORAR RENDIMIENTO DE CONSULTAS
-- =====================================================

-- Tabla messages: índice compuesto para consultas frecuentes
ALTER TABLE messages ADD INDEX IF NOT EXISTS idx_messages_session_chat_time (session_id, chat_jid, timestamp DESC);
ALTER TABLE messages ADD INDEX IF NOT EXISTS idx_messages_session_timestamp (session_id, timestamp DESC);
ALTER TABLE messages ADD INDEX IF NOT EXISTS idx_messages_status (status);

-- Tabla chat: índice compuesto para listado de chats
ALTER TABLE chat ADD INDEX IF NOT EXISTS idx_chat_session_timestamp (session_id, timestamp DESC);
ALTER TABLE chat ADD INDEX IF NOT EXISTS idx_chat_session_jid (session_id, chat_jid);
ALTER TABLE chat ADD INDEX IF NOT EXISTS idx_chat_agent (agent_id);

-- Tabla contacts: índice para búsquedas frecuentes
ALTER TABLE contacts ADD INDEX IF NOT EXISTS idx_contacts_session_jid (session_id, jid);
ALTER TABLE contacts ADD INDEX IF NOT EXISTS idx_contacts_phone (phone);

-- Tabla campaigns: índice para filtrado por estado
ALTER TABLE campaigns ADD INDEX IF NOT EXISTS idx_campaigns_session_status (session_id, status);
ALTER TABLE campaigns ADD INDEX IF NOT EXISTS idx_campaigns_scheduled (scheduled_at, status);

-- Tabla campaign_recipients: índice para procesamiento
ALTER TABLE campaign_recipients ADD INDEX IF NOT EXISTS idx_recipients_campaign_status (campaign_id, status);

-- Tabla chat_assignments: índice para consultas de agentes
ALTER TABLE chat_assignments ADD INDEX IF NOT EXISTS idx_assignments_agent (agent_id, status);
ALTER TABLE chat_assignments ADD INDEX IF NOT EXISTS idx_assignments_session_jid (session_id, chat_jid);

-- Tabla agents: índice para búsqueda por admin
ALTER TABLE agents ADD INDEX IF NOT EXISTS idx_agents_admin (admin_id, status);

-- Tabla user_sessions: índice para resolución de sesiones
ALTER TABLE user_sessions ADD INDEX IF NOT EXISTS idx_sessions_phone (phone);
ALTER TABLE user_sessions ADD INDEX IF NOT EXISTS idx_sessions_active (is_active, updated_at DESC);

-- Tabla subscriptions: índice para verificación de planes
ALTER TABLE subscriptions ADD INDEX IF NOT EXISTS idx_subs_session_status (session_id, status);

-- Tabla password_reset_tokens: índice para búsqueda por token
ALTER TABLE password_reset_tokens ADD INDEX IF NOT EXISTS idx_reset_token (token);
ALTER TABLE password_reset_tokens ADD INDEX IF NOT EXISTS idx_reset_expires (expires_at);

-- =====================================================
-- 2. CREAR USUARIO MYSQL CON PERMISOS LIMITADOS
-- =====================================================
-- IMPORTANTE: Cambiar 'nueva_password_segura_2026' por una contraseña real segura
-- Luego actualizar DB_USER y DB_PASSWORD en .env

-- CREATE USER IF NOT EXISTS 'winsap_app'@'localhost' IDENTIFIED BY 'nueva_password_segura_2026';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON whatsflow.* TO 'winsap_app'@'localhost';
-- FLUSH PRIVILEGES;

-- Después de crear el usuario, actualizar .env:
-- DB_USER=winsap_app
-- DB_PASSWORD=nueva_password_segura_2026

SELECT 'Optimización de índices completada' AS resultado;
