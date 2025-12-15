-- =====================================================
-- FIX SESSION ISSUES
-- Soluciona problemas de sesiones duplicadas y campos faltantes
-- =====================================================

-- 1. Agregar campos name y avatar_url a user_sessions
ALTER TABLE user_sessions
ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL AFTER phone_number,
ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL AFTER name;

-- 2. Eliminar sesiones con phone_number inválido (que sean session_id en lugar de número)
-- Las sesiones válidas deben tener phone_number que sean solo dígitos
DELETE FROM user_sessions
WHERE phone_number REGEXP '[^0-9]'
AND LENGTH(phone_number) != 0;

-- 3. Poblar name y avatar_url desde tabla users para sesiones existentes
UPDATE user_sessions us
INNER JOIN users u ON u.phone = us.phone_number
SET
    us.name = u.name,
    us.avatar_url = u.avatar_url
WHERE us.name IS NULL;

-- 4. Verificar sesiones problemáticas antes de limpiar
SELECT
    'SESIONES DUPLICADAS O INVÁLIDAS:' as Tipo,
    id,
    session_id,
    phone_number,
    owner_phone_number,
    is_active,
    created_at
FROM user_sessions
WHERE phone_number REGEXP '[^0-9]'
   OR phone_number IN (
       SELECT phone_number
       FROM user_sessions
       GROUP BY phone_number
       HAVING COUNT(*) > 1
   );

-- 5. Mostrar estructura final
DESCRIBE user_sessions;

-- 6. Mostrar datos actualizados
SELECT
    id,
    session_id,
    phone_number,
    name,
    avatar_url,
    owner_phone_number,
    is_active,
    last_connection_time
FROM user_sessions
ORDER BY last_connection_time DESC
LIMIT 10;
