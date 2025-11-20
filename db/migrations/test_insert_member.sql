-- ============================================
-- SCRIPT DE PRUEBA: Insertar Miembro Manualmente
-- ============================================
-- Este script prueba si se puede insertar en contact_group_members

-- 1. Verificar que la tabla existe
SHOW TABLES LIKE 'contact_group_members';

-- 2. Ver estructura de la tabla
DESCRIBE contact_group_members;

-- 3. Ver índices y restricciones
SHOW INDEX FROM contact_group_members;
SHOW CREATE TABLE contact_group_members;

-- 4. Contar registros actuales
SELECT COUNT(*) as total_actual FROM contact_group_members;

-- 5. Intentar insertar un registro de prueba
-- IMPORTANTE: Ajusta estos valores según tu base de datos
INSERT INTO contact_group_members (
    contact_jid,
    group_jid,
    is_admin,
    is_super_admin,
    phone_number,
    name,
    notify_name,
    avatar_url,
    session_id,
    user_session_id,
    created_at,
    updated_at
) VALUES (
    'TEST595999999999@s.whatsapp.net',  -- contact_jid
    'TEST120000000000@g.us',             -- group_jid
    0,                                    -- is_admin
    0,                                    -- is_super_admin
    '595999999999',                       -- phone_number
    'Usuario de Prueba',                  -- name
    'Prueba',                             -- notify_name
    NULL,                                 -- avatar_url
    '595123456789',                       -- session_id (tu número)
    1,                                    -- user_session_id
    NOW(),
    NOW()
);

-- 6. Verificar que se insertó
SELECT * FROM contact_group_members WHERE name = 'Usuario de Prueba';

-- 7. Contar registros después del INSERT
SELECT COUNT(*) as total_despues FROM contact_group_members;

-- 8. Eliminar el registro de prueba
DELETE FROM contact_group_members WHERE name = 'Usuario de Prueba';

-- 9. Verificar permisos del usuario de MySQL
SHOW GRANTS;

-- 10. Ver errores recientes
SHOW WARNINGS;
SHOW ERRORS;

-- ============================================
-- Si el INSERT manual funciona, el problema es en el código Node.js
-- Si el INSERT manual falla, el problema es la base de datos o permisos
-- ============================================
