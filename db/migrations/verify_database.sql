-- Script de verificación de base de datos para grupos y miembros
-- Ejecutar este script para diagnosticar problemas

-- 1. Verificar estructura de tabla contact_groups
DESCRIBE contact_groups;

-- 2. Verificar estructura de tabla contact_group_members
DESCRIBE contact_group_members;

-- 3. Contar grupos guardados
SELECT COUNT(*) as total_grupos FROM contact_groups;

-- 4. Contar miembros guardados
SELECT COUNT(*) as total_miembros FROM contact_group_members;

-- 5. Ver grupos con cantidad de miembros
SELECT
    cg.id,
    cg.jid,
    cg.name,
    cg.participants_count as conteo_reportado,
    COUNT(cgm.id) as miembros_en_bd,
    cg.created_at
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
GROUP BY cg.id, cg.jid, cg.name, cg.participants_count, cg.created_at
ORDER BY cg.name;

-- 6. Ver grupos sin miembros
SELECT
    cg.id,
    cg.jid,
    cg.name,
    cg.participants_count
FROM contact_groups cg
LEFT JOIN contact_group_members cgm ON cg.jid = cgm.group_jid
WHERE cgm.id IS NULL
ORDER BY cg.name;

-- 7. Ver miembros de un grupo específico (cambiar el nombre)
SELECT
    cgm.contact_jid,
    cgm.name,
    cgm.phone_number,
    cgm.is_admin,
    cgm.is_super_admin,
    cgm.avatar_url,
    cgm.created_at
FROM contact_group_members cgm
JOIN contact_groups cg ON cgm.group_jid = cg.jid
WHERE cg.name LIKE '%Alabanza%'
ORDER BY cgm.is_super_admin DESC, cgm.is_admin DESC, cgm.name;

-- 8. Verificar índices de contact_group_members
SHOW INDEX FROM contact_group_members;

-- 9. Ver últimos grupos creados
SELECT
    jid,
    name,
    participants_count,
    created_at,
    updated_at
FROM contact_groups
ORDER BY created_at DESC
LIMIT 10;

-- 10. Ver últimos miembros agregados
SELECT
    cgm.contact_jid,
    cgm.name,
    cgm.phone_number,
    cg.name as grupo,
    cgm.created_at
FROM contact_group_members cgm
JOIN contact_groups cg ON cgm.group_jid = cg.jid
ORDER BY cgm.created_at DESC
LIMIT 20;
