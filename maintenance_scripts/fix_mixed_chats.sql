-- Script para limpiar chats mezclados entre canales
-- IMPORTANTE: Esto eliminará chats duplicados que están en el session_id incorrecto

-- 1. Ver cuántos chats duplicados hay
SELECT 'Chats duplicados:' as info, COUNT(*) as total
FROM (
    SELECT jid, COUNT(*) as count 
    FROM chats 
    GROUP BY jid 
    HAVING count > 1
) as duplicates;

-- 2. Eliminar chats del session_id=1 que pertenecen al canal 2 (595994854167)
-- Estos son chats donde el JID es el número del canal 2
DELETE FROM chats 
WHERE session_id = '1' 
AND jid = '595994854167@s.whatsapp.net';

-- 3. Mantener solo el chat más reciente para cada JID duplicado
-- Esto eliminará las versiones antiguas
DELETE c1 FROM chats c1
INNER JOIN chats c2 
WHERE c1.jid = c2.jid 
AND c1.session_id = c2.session_id
AND c1.last_message_time < c2.last_message_time;

-- 4. Verificar resultado
SELECT 'Chats por canal después de limpieza:' as info;
SELECT session_id, COUNT(*) as total_chats
FROM chats
GROUP BY session_id;
