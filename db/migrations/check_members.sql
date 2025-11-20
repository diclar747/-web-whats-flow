-- ============================================
-- CONSULTA RÁPIDA: Verificar Miembros de Grupos
-- ============================================

-- 1. RESUMEN GENERAL
SELECT
    '=== RESUMEN GENERAL ===' as info;

SELECT
    (SELECT COUNT(*) FROM contact_groups) as total_grupos,
    (SELECT COUNT(*) FROM contact_group_members) as total_miembros;

-- 2. GRUPOS CON CANTIDAD DE MIEMBROS
SELECT
    '=== GRUPOS Y CANTIDAD DE MIEMBROS ===' as info;

SELECT
    cg.name as nombre_grupo,
    cg.participants_count as reportado_whatsapp,
    COUNT(cgm.id) as guardado_en_bd,
    CASE
        WHEN COUNT(cgm.id) = 0 THEN '❌ SIN MIEMBROS'
        WHEN COUNT(cgm.id) < cg.participants_count THEN '⚠️ FALTAN MIEMBROS'
        ELSE '✅ OK'
    END as estado
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
GROUP BY cg.id, cg.name, cg.participants_count
ORDER BY cg.name;

-- 3. ÚLTIMOS 20 MIEMBROS GUARDADOS (PARA VERIFICAR QUE SE ESTÁ GUARDANDO)
SELECT
    '=== ÚLTIMOS 20 MIEMBROS GUARDADOS ===' as info;

SELECT
    cgm.id,
    cg.name as grupo,
    cgm.name as miembro_nombre,
    cgm.phone_number as telefono,
    cgm.contact_jid,
    cgm.is_admin,
    cgm.created_at
FROM contact_group_members cgm
JOIN contact_groups cg ON cgm.group_jid = cg.jid
ORDER BY cgm.created_at DESC
LIMIT 20;

-- 4. GRUPOS SIN MIEMBROS (PROBLEMA)
SELECT
    '=== GRUPOS SIN MIEMBROS (PROBLEMA) ===' as info;

SELECT
    cg.name as nombre_grupo,
    cg.jid,
    cg.participants_count as deberia_tener,
    cg.created_at
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
WHERE cgm.id IS NULL
ORDER BY cg.name;

-- 5. MIEMBROS DEL GRUPO "Alabanza y Adoración IDD" (ejemplo específico)
SELECT
    '=== MIEMBROS DEL GRUPO ALABANZA Y ADORACIÓN ===' as info;

SELECT
    cgm.name as nombre,
    cgm.phone_number as telefono,
    cgm.contact_jid,
    CASE
        WHEN cgm.is_super_admin = 1 THEN 'Super Admin'
        WHEN cgm.is_admin = 1 THEN 'Admin'
        ELSE 'Miembro'
    END as rol,
    cgm.created_at
FROM contact_group_members cgm
JOIN contact_groups cg ON cgm.group_jid = cg.jid
WHERE cg.name LIKE '%Alabanza%'
ORDER BY cgm.is_super_admin DESC, cgm.is_admin DESC, cgm.name;

-- 6. CONTAR CUÁNTOS MIEMBROS HAY POR GRUPO
SELECT
    '=== CONTEO DE MIEMBROS POR GRUPO ===' as info;

SELECT
    cg.name as grupo,
    COUNT(cgm.id) as total_miembros
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
GROUP BY cg.id, cg.name
HAVING COUNT(cgm.id) > 0
ORDER BY COUNT(cgm.id) DESC;
