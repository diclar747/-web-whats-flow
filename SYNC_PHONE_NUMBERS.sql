-- ========================================
-- SINCRONIZACIÓN DE PHONE_NUMBER
-- Mantener phone_number actualizado en contacts
-- ========================================

-- 1. Actualizar contacts sin phone_number
UPDATE contacts 
SET phone_number = session_id 
WHERE phone_number IS NULL 
AND session_id IS NOT NULL 
AND session_id != '0'
AND session_id REGEXP '^[0-9]+$';

-- 2. Crear índice para mejorar performance si no existe
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_jid_phone ON contacts(jid, phone_number);

-- 3. Verificar resultado
SELECT 
    COUNT(*) as total_contacts,
    COUNT(DISTINCT phone_number) as with_phone_number,
    COUNT(DISTINCT session_id) as with_session_id
FROM contacts;

SELECT '✅ Phone numbers sincronizados correctamente' as status;
