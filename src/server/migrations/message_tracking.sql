-- ============================================
-- Migración: Tracking de Mensajes por Tipo
-- ============================================
-- Descripción: Agrega columnas para trackear mensajes por tipo
-- (campañas programadas, personalizadas, API, chatbot)
-- Fecha: 2025-12-16
-- ============================================

USE whatsflow;

-- Agregar columnas de tracking a user_sessions
ALTER TABLE user_sessions
ADD COLUMN IF NOT EXISTS messages_scheduled INT DEFAULT 0 COMMENT 'Mensajes enviados por campañas programadas',
ADD COLUMN IF NOT EXISTS messages_personalized INT DEFAULT 0 COMMENT 'Mensajes enviados por campañas personalizadas (Excel)',
ADD COLUMN IF NOT EXISTS messages_api INT DEFAULT 0 COMMENT 'Mensajes enviados vía API REST',
ADD COLUMN IF NOT EXISTS messages_chatbot INT DEFAULT 0 COMMENT 'Respuestas automáticas del chatbot';

-- Inicializar valores en 0 para registros existentes
UPDATE user_sessions 
SET 
    messages_scheduled = 0,
    messages_personalized = 0,
    messages_api = 0,
    messages_chatbot = 0
WHERE messages_scheduled IS NULL 
   OR messages_personalized IS NULL 
   OR messages_api IS NULL 
   OR messages_chatbot IS NULL;

-- ============================================
-- Trigger para reseteo mensual automático
-- ============================================

-- Eliminar trigger existente si existe
DROP EVENT IF EXISTS reset_monthly_message_counters;

-- Crear evento para resetear contadores al inicio de cada mes
CREATE EVENT IF NOT EXISTS reset_monthly_message_counters
ON SCHEDULE EVERY 1 MONTH
STARTS (DATE_FORMAT(NOW(), '%Y-%m-01') + INTERVAL 1 MONTH)
DO
  UPDATE user_sessions 
  SET 
    messages_sent_this_month = 0,
    messages_scheduled = 0,
    messages_personalized = 0,
    messages_api = 0,
    messages_chatbot = 0;

-- ============================================
-- Verificación
-- ============================================

-- Mostrar estructura actualizada
DESCRIBE user_sessions;

-- Contar registros afectados
SELECT 
    COUNT(*) as total_sessions,
    SUM(CASE WHEN messages_scheduled IS NOT NULL THEN 1 ELSE 0 END) as with_scheduled,
    SUM(CASE WHEN messages_personalized IS NOT NULL THEN 1 ELSE 0 END) as with_personalized,
    SUM(CASE WHEN messages_api IS NOT NULL THEN 1 ELSE 0 END) as with_api,
    SUM(CASE WHEN messages_chatbot IS NOT NULL THEN 1 ELSE 0 END) as with_chatbot
FROM user_sessions;

-- ============================================
-- Fin de la migración
-- ============================================
