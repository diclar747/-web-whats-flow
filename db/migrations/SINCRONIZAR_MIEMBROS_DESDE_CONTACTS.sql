-- ============================================
-- SCRIPT: Sincronizar Miembros desde Contacts
-- ============================================
-- Este script sincroniza miembros de grupos usando los datos de la tabla contacts
-- SOLUCIÓN ALTERNATIVA cuando los participantes vienen con formato @lid
--
-- IMPORTANTE: Este script agrega TODOS los contactos a TODOS los grupos
-- Es un workaround porque con @lid no podemos saber qué contacto pertenece a qué grupo
-- ============================================

-- 1. Ver estadísticas actuales
SELECT
    'ANTES DE SINCRONIZAR' as estado,
    (SELECT COUNT(*) FROM contacts WHERE is_group = 0 AND jid LIKE '%@s.whatsapp.net') as total_contactos,
    (SELECT COUNT(*) FROM contact_groups) as total_grupos,
    (SELECT COUNT(*) FROM contact_group_members) as miembros_actuales,
    (SELECT COUNT(*) FROM contact_group_members WHERE phone_number IS NOT NULL) as miembros_con_numero,
    (SELECT COUNT(*) FROM contact_group_members WHERE phone_number IS NULL) as miembros_sin_numero;

-- 2. Insertar todos los contactos como miembros de todos los grupos
-- NOTA: Esto puede tardar dependiendo de cuántos contactos y grupos tengas
INSERT INTO contact_group_members (
    contact_jid,
    group_jid,
    is_admin,
    is_super_admin,
    phone_number,
    name,
    notify_name,
    avatar_url,
    user_session_id,
    session_id
)
SELECT
    c.jid as contact_jid,
    cg.jid as group_jid,
    0 as is_admin,
    0 as is_super_admin,
    -- Extraer número de teléfono con prefijo +
    CONCAT('+', REPLACE(c.jid, '@s.whatsapp.net', '')) as phone_number,
    c.name,
    c.notify_name,
    c.avatar_url,
    (SELECT id FROM user_sessions WHERE phone_number = c.session_id LIMIT 1) as user_session_id,
    c.session_id
FROM contacts c
CROSS JOIN contact_groups cg
WHERE c.is_group = 0
  AND c.jid LIKE '%@s.whatsapp.net'
  AND cg.session_id = c.session_id
  AND NOT EXISTS (
      -- No insertar si ya existe
      SELECT 1 FROM contact_group_members cgm
      WHERE cgm.contact_jid = c.jid
        AND cgm.group_jid = cg.jid
  );

-- 3. Ver estadísticas después de sincronizar
SELECT
    'DESPUÉS DE SINCRONIZAR' as estado,
    (SELECT COUNT(*) FROM contacts WHERE is_group = 0 AND jid LIKE '%@s.whatsapp.net') as total_contactos,
    (SELECT COUNT(*) FROM contact_groups) as total_grupos,
    (SELECT COUNT(*) FROM contact_group_members) as miembros_actuales,
    (SELECT COUNT(*) FROM contact_group_members WHERE phone_number IS NOT NULL) as miembros_con_numero,
    (SELECT COUNT(*) FROM contact_group_members WHERE phone_number IS NULL) as miembros_sin_numero;

-- 4. Ver cuántos miembros se agregaron por grupo
SELECT
    cg.name as grupo,
    COUNT(cgm.id) as total_miembros,
    COUNT(CASE WHEN cgm.phone_number IS NOT NULL THEN 1 END) as con_numero_real,
    COUNT(CASE WHEN cgm.phone_number IS NULL THEN 1 END) as sin_numero,
    CONCAT(
        ROUND(COUNT(CASE WHEN cgm.phone_number IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1),
        '%'
    ) as porcentaje_numeros_reales
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
GROUP BY cg.id, cg.name
ORDER BY total_miembros DESC;

-- 5. Ver muestra de miembros agregados (primeros 20)
SELECT
    cgm.contact_jid,
    cgm.phone_number,
    cgm.name,
    cg.name as grupo,
    cgm.created_at
FROM contact_group_members cgm
JOIN contact_groups cg ON cgm.group_jid = cg.jid
WHERE cgm.phone_number IS NOT NULL
ORDER BY cgm.created_at DESC
LIMIT 20;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- ⚠️ ADVERTENCIA:
-- Este script agrega TODOS los contactos a TODOS los grupos
-- Esto significa que verás contactos en grupos donde NO están realmente
-- Es una limitación del formato @lid

-- ✅ VENTAJAS:
-- - Poblas la tabla contact_group_members con datos reales
-- - Tienes nombres y números de teléfono reales (no @lid)
-- - Puedes usar estos datos para búsquedas y filtros

-- ❌ DESVENTAJAS:
-- - No es 100% preciso (contactos pueden aparecer en grupos incorrectos)
-- - Puede crear muchos registros si tienes muchos contactos y grupos

-- 💡 RECOMENDACIÓN:
-- Usa el endpoint API /api/sync/group-members en lugar de este script
-- El endpoint tiene mejor manejo de errores y logs

-- ============================================
-- LIMPIAR DATOS ANTERIORES (OPCIONAL)
-- ============================================
-- Si quieres empezar limpio, ejecuta esto ANTES del INSERT:

/*
-- Eliminar todos los miembros con @lid
DELETE FROM contact_group_members WHERE contact_jid LIKE '%@lid';

-- O eliminar TODOS los miembros
DELETE FROM contact_group_members;
*/

-- ============================================
-- VERIFICACIONES
-- ============================================

-- Ver contactos que NO están en ningún grupo (después de sincronizar no debería haber)
SELECT
    c.jid,
    c.name,
    c.session_id
FROM contacts c
WHERE c.is_group = 0
  AND c.jid LIKE '%@s.whatsapp.net'
  AND NOT EXISTS (
      SELECT 1 FROM contact_group_members cgm
      WHERE cgm.contact_jid = c.jid
  )
LIMIT 20;

-- Ver grupos sin miembros (después de sincronizar no debería haber)
SELECT
    cg.id,
    cg.name,
    cg.jid,
    cg.participants_count as deberia_tener,
    COUNT(cgm.id) as tiene_en_bd
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
GROUP BY cg.id, cg.name, cg.jid, cg.participants_count
HAVING tiene_en_bd = 0
ORDER BY cg.name;

-- Ver diferencia entre participants_count y miembros guardados
SELECT
    cg.name as grupo,
    cg.participants_count as total_real_whatsapp,
    COUNT(cgm.id) as guardados_en_bd,
    (cg.participants_count - COUNT(cgm.id)) as diferencia,
    CASE
        WHEN COUNT(cgm.id) > cg.participants_count THEN '⚠️ Más miembros de los esperados'
        WHEN COUNT(cgm.id) < cg.participants_count THEN '⚠️ Faltan miembros'
        ELSE '✅ Coincide'
    END as estado
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
GROUP BY cg.id, cg.name, cg.participants_count
ORDER BY diferencia DESC;

