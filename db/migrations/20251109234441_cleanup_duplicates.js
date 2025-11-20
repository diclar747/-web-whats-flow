/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.raw(`
    -- Script para limpiar duplicados en la base de datos WhatsFlow
    -- Ejecutar este script UNA VEZ después de aplicar las migraciones
    -- ⚠️ IMPORTANTE: Hacer backup de la base de datos ANTES de ejecutar

    -- ========================================
    -- 1. LIMPIEZA DE DUPLICADOS EN CONTACTS
    -- ========================================

    -- Identificar duplicados en contacts (mismo jid y session_id)
    SELECT
        jid,
        session_id,
        COUNT(*) as duplicados
    FROM contacts
    GROUP BY jid, session_id
    HAVING COUNT(*) > 1;

    -- Eliminar duplicados manteniendo solo el registro más reciente
    DELETE c1 FROM contacts c1
    INNER JOIN contacts c2
    WHERE
        c1.jid = c2.jid
        AND c1.session_id = c2.session_id
        AND c1.id < c2.id;  -- Mantener el ID más alto (más reciente)

    -- Verificar que no quedan duplicados
    SELECT
        jid,
        session_id,
        COUNT(*) as duplicados
    FROM contacts
    GROUP BY jid, session_id
    HAVING COUNT(*) > 1;


    -- ========================================
    -- 2. LIMPIEZA DE DUPLICADOS EN CONTACT_GROUPS
    -- ========================================

    -- Identificar duplicados en contact_groups (mismo jid y session_id)
    SELECT
        jid,
        session_id,
        COUNT(*) as duplicados
    FROM contact_groups
    WHERE jid IS NOT NULL AND session_id IS NOT NULL
    GROUP BY jid, session_id
    HAVING COUNT(*) > 1;

    -- Eliminar duplicados manteniendo solo el registro más reciente
    DELETE cg1 FROM contact_groups cg1
    INNER JOIN contact_groups cg2
    WHERE
        cg1.jid = cg2.jid
        AND cg1.session_id = cg2.session_id
        AND cg1.jid IS NOT NULL
        AND cg1.session_id IS NOT NULL
        AND cg1.id < cg2.id;  -- Mantener el ID más alto (más reciente)

    -- Verificar que no quedan duplicados
    SELECT
        jid,
        session_id,
        COUNT(*) as duplicados
    FROM contact_groups
    WHERE jid IS NOT NULL AND session_id IS NOT NULL
    GROUP BY jid, session_id
    HAVING COUNT(*) > 1;


    -- ========================================
    -- 3. LIMPIEZA DE DUPLICADOS EN BROADCASTS
    -- ========================================

    -- Identificar duplicados en broadcasts (mismo jid y session_id)
    SELECT
        jid,
        session_id,
        COUNT(*) as duplicados
    FROM broadcasts
    GROUP BY jid, session_id
    HAVING COUNT(*) > 1;

    -- Eliminar duplicados manteniendo solo el registro más reciente
    DELETE b1 FROM broadcasts b1
    INNER JOIN broadcasts b2
    WHERE
        b1.jid = b2.jid
        AND b1.session_id = b2.session_id
        AND b1.id < b2.id;  -- Mantener el ID más alto (más reciente)

    -- Verificar que no quedan duplicados
    SELECT
        jid,
        session_id,
        COUNT(*) as duplicados
    FROM broadcasts
    GROUP BY jid, session_id
    HAVING COUNT(*) > 1;


    -- ========================================
    -- 4. VERIFICACIÓN FINAL
    -- ========================================

    -- Contar registros en cada tabla
    SELECT
        'contacts' as tabla,
        COUNT(*) as total_registros,
        COUNT(DISTINCT CONCAT(jid, '|', session_id)) as registros_unicos
    FROM contacts
    UNION ALL
    SELECT
        'contact_groups' as tabla,
        COUNT(*) as total_registros,
        COUNT(DISTINCT CONCAT(IFNULL(jid, ''), '|', IFNULL(session_id, ''))) as registros_unicos
    FROM contact_groups
    WHERE jid IS NOT NULL AND session_id IS NOT NULL
    UNION ALL
    SELECT
        'broadcasts' as tabla,
        COUNT(*) as total_registros,
        COUNT(DISTINCT CONCAT(jid, '|', session_id)) as registros_unicos
    FROM broadcasts;

    -- Si total_registros = registros_unicos, no hay duplicados ✅

    SELECT '✅ Limpieza completada. Verifica los resultados arriba.' as Resultado;
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
