-- =====================================================
-- FIX ADMIN-AGENT RELATIONSHIP
-- Corrige la relación entre admins y agentes
-- =====================================================

-- PROBLEMA IDENTIFICADO:
-- El usuario claudio@cnid.com.py (phone: 595985768793) tiene admin_phone = 595985768793 (él mismo)
-- Esto hace que aparezca como su propio agente, lo cual es incorrecto.

-- 1. Identificar usuarios que son sus propios admins (auto-referencia)
SELECT
    'USUARIOS CON AUTO-REFERENCIA (admin_phone = phone):' as Problema,
    id,
    name,
    email,
    phone,
    role,
    admin_phone,
    created_at
FROM users
WHERE phone = admin_phone
  AND phone IS NOT NULL
  AND admin_phone IS NOT NULL;

-- 2. Corregir auto-referencias: Si un usuario tiene admin_phone = phone, establecer admin_phone a NULL
-- Esto significa que es un usuario principal/admin, no un agente de sí mismo
UPDATE users
SET admin_phone = NULL
WHERE phone = admin_phone
  AND phone IS NOT NULL
  AND admin_phone IS NOT NULL;

-- 3. Verificar agentes sin admin válido
SELECT
    'AGENTES SIN ADMIN VÁLIDO:' as Problema,
    u.id,
    u.name,
    u.email,
    u.phone,
    u.role,
    u.admin_phone,
    CASE
        WHEN u.admin_phone IS NULL THEN 'Sin admin asignado'
        WHEN NOT EXISTS (
            SELECT 1 FROM users u2
            WHERE u2.phone = u.admin_phone
            AND u2.role IN ('admin', 'supervisor')
        ) THEN 'Admin no existe o no es admin/supervisor'
        ELSE 'OK'
    END as Estado
FROM users u
WHERE u.role = 'agent'
ORDER BY u.created_at DESC;

-- 4. Mostrar relación correcta admin-agentes
SELECT
    'RELACIÓN ADMIN-AGENTES CORRECTA:' as Info,
    admin.id as admin_id,
    admin.name as admin_name,
    admin.phone as admin_phone,
    admin.role as admin_role,
    COUNT(DISTINCT agent.id) as cantidad_agentes,
    GROUP_CONCAT(CONCAT(agent.name, ' (', agent.email, ')') SEPARATOR ', ') as agentes
FROM users admin
LEFT JOIN users agent ON agent.admin_phone = admin.phone AND agent.role = 'agent'
WHERE admin.role IN ('admin', 'supervisor')
GROUP BY admin.id, admin.name, admin.phone, admin.role
ORDER BY cantidad_agentes DESC;

-- 5. RECOMENDACIÓN:
-- Si un usuario quiere ser tanto admin como agente, debe:
-- a) Tener role = 'admin' (no 'agent')
-- b) Tener admin_phone = NULL (es principal)
-- c) Otros agentes tendrán admin_phone = su número

-- Ejemplo de corrección manual si es necesario:
-- UPDATE users SET role = 'admin', admin_phone = NULL WHERE email = 'claudio@cnid.com.py';
