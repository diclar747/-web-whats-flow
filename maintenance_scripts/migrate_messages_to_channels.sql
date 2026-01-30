-- ============================================================================
-- Script de Migración: Reasignar Mensajes Históricos a Canales Correctos
-- ============================================================================
-- 
-- PROPÓSITO:
-- Este script migra los mensajes históricos que están guardados bajo session_id='1'
-- al canal correcto basándose en el número de teléfono del destinatario.
--
-- IMPORTANTE: 
-- 1. Hacer BACKUP de la base de datos antes de ejecutar
-- 2. Ejecutar en horario de bajo tráfico
-- 3. Revisar los conteos antes de confirmar
--
-- ============================================================================

-- Paso 1: ANÁLISIS - Ver cuántos mensajes se migrarían
-- ============================================================================
SELECT 
    'ANÁLISIS PREVIO' as paso,
    session_id,
    phone,
    COUNT(*) as total_mensajes,
    MIN(timestamp) as mensaje_mas_antiguo,
    MAX(timestamp) as mensaje_mas_reciente
FROM messages
WHERE session_id = '1'
GROUP BY session_id, phone
ORDER BY phone;

-- Resultado esperado:
-- session_id='1', phone='595985768793' -> Quedan en session_id='1' (Carlos)
-- session_id='1', phone='595994854167' -> Migran a session_id='2' (Gestión)

-- ============================================================================
-- Paso 2: BACKUP - Crear tabla de respaldo (RECOMENDADO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages_backup_20260113 AS 
SELECT * FROM messages WHERE session_id = '1';

SELECT 
    'BACKUP CREADO' as paso,
    COUNT(*) as mensajes_respaldados 
FROM messages_backup_20260113;

-- ============================================================================
-- Paso 3: MIGRACIÓN - Reasignar mensajes del canal Gestión
-- ============================================================================

-- 3.1: Actualizar tabla MESSAGES
UPDATE messages 
SET session_id = '2'
WHERE session_id = '1' 
  AND phone = '595994854167';

-- Verificar resultado
SELECT 
    'MENSAJES MIGRADOS' as paso,
    session_id,
    phone,
    COUNT(*) as total
FROM messages
WHERE phone = '595994854167'
GROUP BY session_id, phone;

-- 3.2: Actualizar tabla CHATS
UPDATE chats 
SET session_id = '2'
WHERE session_id = '1' 
  AND phone = '595994854167';

-- Verificar resultado
SELECT 
    'CHATS MIGRADOS' as paso,
    session_id,
    phone,
    COUNT(*) as total
FROM chats
WHERE phone = '595994854167'
GROUP BY session_id, phone;

-- 3.3: Actualizar tabla CONTACTS (si existen contactos duplicados)
UPDATE contacts 
SET session_id = '2'
WHERE session_id = '1' 
  AND jid IN (
      SELECT DISTINCT chat_jid 
      FROM messages 
      WHERE session_id = '2' 
        AND phone = '595994854167'
  );

-- ============================================================================
-- Paso 4: VERIFICACIÓN FINAL
-- ============================================================================

-- 4.1: Conteo por canal
SELECT 
    'DISTRIBUCIÓN FINAL' as verificacion,
    session_id,
    COUNT(*) as total_mensajes,
    COUNT(DISTINCT chat_jid) as chats_unicos,
    MIN(timestamp) as desde,
    MAX(timestamp) as hasta
FROM messages
GROUP BY session_id
ORDER BY session_id;

-- 4.2: Verificar que no haya mensajes huérfanos
SELECT 
    'VERIFICACIÓN INTEGRIDAD' as verificacion,
    m.session_id,
    m.phone,
    COUNT(*) as mensajes_sin_chat
FROM messages m
LEFT JOIN chats c ON m.chat_jid = c.jid AND m.session_id = c.session_id
WHERE c.jid IS NULL
GROUP BY m.session_id, m.phone;

-- 4.3: Últimos 10 mensajes por canal (para verificar visualmente)
SELECT 
    session_id,
    phone,
    chat_jid,
    text_content,
    timestamp
FROM messages
WHERE session_id IN ('1', '2')
ORDER BY session_id, timestamp DESC
LIMIT 10;

-- ============================================================================
-- Paso 5: ROLLBACK (Solo si algo salió mal)
-- ============================================================================
-- DESCOMENTAR SOLO SI NECESITAS REVERTIR:

-- ROLLBACK: Restaurar desde backup
-- TRUNCATE TABLE messages;
-- INSERT INTO messages SELECT * FROM messages_backup_20260113;

-- ROLLBACK: Restaurar chats
-- UPDATE chats SET session_id = '1' WHERE session_id = '2' AND phone = '595994854167';

-- ============================================================================
-- NOTAS FINALES
-- ============================================================================
-- 
-- Después de ejecutar este script:
-- 1. Reiniciar el servidor: pm2 restart whatsflow-server
-- 2. Limpiar caché del navegador (Ctrl+F5)
-- 3. Verificar que cada canal muestre solo sus mensajes
-- 4. Si todo funciona correctamente, puedes eliminar el backup después de 7 días:
--    DROP TABLE messages_backup_20260113;
--
-- ============================================================================
