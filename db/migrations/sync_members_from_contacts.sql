-- ============================================
-- SCRIPT: Sincronizar Miembros desde Contacts
-- ============================================
-- Este script toma TODOS los contactos de la tabla contacts
-- y los agrega como miembros de los grupos
--
-- IMPORTANTE: Esto es un workaround porque @lid no tiene info real

-- 1. Ver cuántos contactos hay disponibles
SELECT
    COUNT(*) as total_contactos,
    COUNT(CASE WHEN is_group = 0 THEN 1 END) as contactos_personas,
    COUNT(CASE WHEN is_group = 1 THEN 1 END) as contactos_grupos
FROM contacts;

-- 2. Ver contactos que NO están en ningún grupo
SELECT
    c.jid,
    c.name,
    c.notify_name,
    c.session_id
FROM contacts c
WHERE c.is_group = 0  -- Solo personas, no grupos
  AND c.jid LIKE '%@s.whatsapp.net'  -- Solo formato válido
  AND NOT EXISTS (
      SELECT 1 FROM contact_group_members cgm
      WHERE cgm.contact_jid = c.jid
  )
ORDER BY c.name
LIMIT 20;

-- 3. MANUAL: Agregar contacto específico a un grupo
-- REEMPLAZA LOS VALORES:
--   - contact_jid: JID del contacto (ej: 595985768793@s.whatsapp.net)
--   - group_jid: JID del grupo (ej: 120363324185196535@g.us)
--   - name: Nombre del contacto
--   - phone_number: Número de teléfono
--   - session_id: Tu número de WhatsApp
--   - user_session_id: Tu ID de sesión

/*
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
    c.jid,                          -- contact_jid
    '120363324185196535@g.us',      -- group_jid (CAMBIA ESTO)
    0,                              -- is_admin (0 = no admin)
    0,                              -- is_super_admin
    REPLACE(c.jid, '@s.whatsapp.net', ''),  -- phone_number
    c.name,                         -- name
    c.notify_name,                  -- notify_name
    c.avatar_url,                   -- avatar_url
    1,                              -- user_session_id (CAMBIA ESTO)
    c.session_id                    -- session_id
FROM contacts c
WHERE c.jid = '595985768793@s.whatsapp.net'  -- CAMBIA ESTO por el contacto que quieres agregar
  AND NOT EXISTS (
      SELECT 1 FROM contact_group_members cgm
      WHERE cgm.contact_jid = c.jid
        AND cgm.group_jid = '120363324185196535@g.us'  -- CAMBIA ESTO
  );
*/

-- 4. Ver grupos sin miembros
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

-- 5. Eliminar miembros con @lid (datos inútiles)
-- CUIDADO: Esto eliminará todos los miembros con @lid
/*
DELETE FROM contact_group_members
WHERE contact_jid LIKE '%@lid';
*/

SELECT 'Total de miembros con @lid que serían eliminados:' as mensaje,
       COUNT(*) as total
FROM contact_group_members
WHERE contact_jid LIKE '%@lid';
