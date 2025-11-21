-- ============================================
-- LIMPIEZA COMPLETA DE BASE DE DATOS
-- Elimina contactos, grupos, mensajes, cache
-- Mantiene estructura y usuarios/agentes
-- ============================================

-- Limpiar mensajes
TRUNCATE TABLE messages;
TRUNCATE TABLE message_reactions;
TRUNCATE TABLE message_metadata;

-- Limpiar contactos y grupos
TRUNCATE TABLE contacts;
TRUNCATE TABLE contact_groups;
TRUNCATE TABLE contact_tags;
TRUNCATE TABLE group_members;

-- Limpiar chats y asignaciones
TRUNCATE TABLE chats;
TRUNCATE TABLE chat_assignments;
TRUNCATE TABLE agent_chat_history;

-- Limpiar interacciones de chatbot
TRUNCATE TABLE chatbot_interactions;

-- Limpiar campañas y sus mensajes enviados
TRUNCATE TABLE campaign_messages;

-- Limpiar notificaciones
TRUNCATE TABLE notifications;

-- Limpiar cola de trabajos
TRUNCATE TABLE job_queue;

-- Limpiar audit logs (opcional - comentar si quieres mantener el historial)
TRUNCATE TABLE audit_log;

-- Limpiar activity logs
TRUNCATE TABLE activity_log;

-- Limpiar citas/appointments
TRUNCATE TABLE appointments;

-- Limpiar transferencias y metadatos
TRUNCATE TABLE chat_transfers;

-- Resetear sesiones de WhatsApp (mantener estructura, eliminar datos)
DELETE FROM user_sessions WHERE phone_number IS NOT NULL;

-- Mensaje de confirmación
SELECT '✅ Base de datos limpiada exitosamente' as status;
SELECT '📊 Tablas limpiadas:' as info;
SELECT 'messages, contacts, groups, chats, assignments, campaigns, notifications' as tables;
SELECT '✅ Estructura mantenida: users, agents, permissions, settings' as preserved;
