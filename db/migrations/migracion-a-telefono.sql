-- MIGRACIÓN COMPLETA AL SISTEMA BASADO EN NÚMERO DE TELÉFONO
-- Este script migra TODOS los datos para usar el número de teléfono como identificador único

USE whatsflow;

-- Paso 1: Crear backup de seguridad
CREATE TABLE IF NOT EXISTS messages_backup_pre_phone_migration AS SELECT * FROM messages;
CREATE TABLE IF NOT EXISTS contacts_backup_pre_phone_migration AS SELECT * FROM contacts;
CREATE TABLE IF NOT EXISTS contact_groups_backup_pre_phone_migration AS SELECT * FROM contact_groups;

-- Paso 2: Migrar mensajes al número de teléfono actual
-- Asumiendo que todas las sesiones antiguas son del mismo usuario: 595985768793
UPDATE messages 
SET session_id = '595985768793' 
WHERE session_id IN (
    'e52c73fc3f5d8e67',
    '022a4463c94cedcb', 
    '9871e33c59d06c36',
    'f22f37f9f15719be',
    'ebbe0201a57230ed'
);

-- Paso 3: Migrar contactos al número de teléfono
UPDATE contacts 
SET session_id = '595985768793' 
WHERE session_id IN (
    'e52c73fc3f5d8e67',
    '022a4463c94cedcb',
    '9871e33c59d06c36',
    'f22f37f9f15719be',
    'ebbe0201a57230ed'
);

-- Paso 4: Migrar grupos al número de teléfono
UPDATE contact_groups 
SET session_id = '595985768793' 
WHERE session_id IN (
    'e52c73fc3f5d8e67',
    '022a4463c94cedcb',
    '9871e33c59d06c36',
    'f22f37f9f15719be',
    'ebbe0201a57230ed'
);

-- Paso 5: Migrar miembros de grupos
UPDATE contact_group_members 
SET session_id = '595985768793' 
WHERE session_id IN (
    'e52c73fc3f5d8e67',
    '022a4463c94cedcb',
    '9871e33c59d06c36',
    'f22f37f9f15719be',
    'ebbe0201a57230ed'
);

-- Paso 6: Actualizar o crear entrada en user_sessions
INSERT INTO user_sessions (session_id, phone_number, created_at, last_activity)
VALUES ('595985768793', '595985768793', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    phone_number = '595985768793',
    last_activity = NOW();

-- Paso 7: Verificar resultados
SELECT 'Mensajes migrados' as tipo, COUNT(*) as total FROM messages WHERE session_id = '595985768793'
UNION ALL
SELECT 'Contactos migrados', COUNT(*) FROM contacts WHERE session_id = '595985768793'
UNION ALL
SELECT 'Grupos migrados', COUNT(*) FROM contact_groups WHERE session_id = '595985768793'
UNION ALL
SELECT 'Miembros migrados', COUNT(*) FROM contact_group_members WHERE session_id = '595985768793';

-- Paso 8: Limpiar duplicados después de la migración
-- Contactos duplicados (mantener el más reciente)
DELETE c1 FROM contacts c1
INNER JOIN contacts c2 
WHERE 
    c1.jid = c2.jid 
    AND c1.session_id = c2.session_id
    AND c1.id < c2.id;

-- Grupos duplicados (mantener el más reciente)
DELETE g1 FROM contact_groups g1
INNER JOIN contact_groups g2 
WHERE 
    g1.jid = g2.jid 
    AND g1.session_id = g2.session_id
    AND g1.id < g2.id;

-- Miembros duplicados
DELETE m1 FROM contact_group_members m1
INNER JOIN contact_group_members m2
WHERE
    m1.group_jid = m2.group_jid
    AND m1.member_jid = m2.member_jid
    AND m1.session_id = m2.session_id
    AND m1.id < m2.id;

COMMIT;

-- Resumen final
SELECT '==== RESUMEN FINAL ====' as '';
SELECT 
    'Mensajes' as tabla, 
    session_id, 
    COUNT(*) as total 
FROM messages 
GROUP BY session_id
UNION ALL
SELECT 
    'Contactos', 
    session_id, 
    COUNT(*) 
FROM contacts 
GROUP BY session_id
UNION ALL
SELECT 
    'Grupos', 
    session_id, 
    COUNT(*) 
FROM contact_groups 
GROUP BY session_id;
