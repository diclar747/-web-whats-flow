/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- ============================================
    -- SCRIPT: Sincronizar Miembros desde Contacts
    -- ============================================
    -- Este script sincroniza miembros de grupos usando los datos de la tabla contacts
    -- SOLUCIÓN ALTERNATIVA cuando los participantes vienen con formato @lid
    --
    -- IMPORTANTE: Este script agrega TODOS los contactos a TODOS los grupos
    -- Es un workaround porque con @lid no podemos saber qué contacto pertenece a qué grupo
    -- ============================================


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
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Reverting this change is not straightforward as it involves complex data insertion based on specific conditions.
  // Therefore, the down function is left empty.
};
