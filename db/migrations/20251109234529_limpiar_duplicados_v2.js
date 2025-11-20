/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Script para limpiar duplicados en la base de datos WhatsFlow
    -- EJECUTAR ESTE SCRIPT ANTES DE RECONECTAR EL SISTEMA


    -- 1. Backup de datos antes de limpiar
    CREATE TABLE IF NOT EXISTS contacts_backup_20251103 AS SELECT * FROM contacts;
    CREATE TABLE IF NOT EXISTS contact_groups_backup_20251103 AS SELECT * FROM contact_groups;
    CREATE TABLE IF NOT EXISTS messages_backup_20251103 AS SELECT * FROM messages;

    -- 2. Eliminar contactos duplicados (mantener el más reciente)
    DELETE c1 FROM contacts c1
    INNER JOIN contacts c2 
    WHERE 
        c1.jid = c2.jid 
        AND c1.session_id = c2.session_id
        AND c1.id < c2.id;

    -- 3. Eliminar grupos duplicados (mantener el más reciente)
    DELETE g1 FROM contact_groups g1
    INNER JOIN contact_groups g2 
    WHERE 
        g1.jid = g2.jid 
        AND g1.session_id = g2.session_id
        AND g1.id < g2.id;

    -- 4. Eliminar mensajes duplicados (mantener el más reciente)
    DELETE m1 FROM messages m1
    INNER JOIN messages m2 
    WHERE 
        m1.id = m2.id 
        AND m1.session_id = m2.session_id
        AND m1.created_at < m2.created_at;

    -- 5. Verificar la limpieza
    SELECT 'Contactos' as tabla, COUNT(*) as total FROM contacts
    UNION ALL
    SELECT 'Grupos', COUNT(*) FROM contact_groups
    UNION ALL
    SELECT 'Mensajes', COUNT(*) FROM messages;

    -- 6. Verificar duplicados restantes (debe devolver 0)
    SELECT 'Contactos duplicados' as tipo, COUNT(*) as total FROM (
        SELECT jid, session_id, COUNT(*) as cnt 
        FROM contacts 
        GROUP BY jid, session_id 
        HAVING cnt > 1
    ) as dups
    UNION ALL
    SELECT 'Grupos duplicados', COUNT(*) FROM (
        SELECT jid, session_id, COUNT(*) as cnt 
        FROM contact_groups 
        GROUP BY jid, session_id 
        HAVING cnt > 1
    ) as dups
    UNION ALL
    SELECT 'Mensajes duplicados', COUNT(*) FROM (
        SELECT id, session_id, COUNT(*) as cnt 
        FROM messages 
        GROUP BY id, session_id 
        HAVING cnt > 1
    ) as dups;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Reverting DELETE operations is not straightforward and can be problematic.
  // This migration is intended for cleanup and should ideally not be rolled back.
  // Therefore, the down function is left empty.
};
