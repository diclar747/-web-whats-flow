/**
 * Session ID Resolver
 * Convierte session_id (puede ser phoneNumber, email, o user.id) a user.id (session_id en user_sessions)
 * 
 * El objetivo es garantizar que todas las tablas usen user.id en el campo session_id
 * en lugar de números de teléfono o emails.
 */

/**
 * Resuelve un session_id a user.id (session_id de user_sessions)
 * Maneja múltiples formatos: email, phoneNumber, user.id directo
 * 
 * @param {string} rawSessionId - Puede ser email, phoneNumber, user.id o sessionId hash
 * @returns {Promise<string|null>} user.id (session_id en user_sessions) o null si no se encuentra
 */
async function resolveToUserId(rawSessionId) {
    if (!rawSessionId || typeof rawSessionId !== 'string') {
        return null;
    }

    try {
        // Caso 1: Es un email
        if (rawSessionId.includes('@')) {
            if (!global.dbPool) return rawSessionId;
            const conn = await global.dbPool.getConnection();
            try {
                const [rows] = await conn.query(
                    'SELECT id FROM users WHERE email = ? LIMIT 1',
                    [rawSessionId]
                );
                if (rows.length > 0) {
                    return String(rows[0].id);
                }
            } finally {
                conn.release();
            }
        }

        // Caso 2: Buscar en user_sessions (puede ser phoneNumber, session_id directo, o owner_phone_number)
        if (global.dbPool) {
            const conn = await global.dbPool.getConnection();
            try {
                // Buscar por session_id directo (caso ideal)
                const [directRows] = await conn.query(
                    'SELECT session_id FROM user_sessions WHERE session_id = ? LIMIT 1',
                    [rawSessionId]
                );
                if (directRows.length > 0) {
                    return directRows[0].session_id;
                }

                // Buscar por phone (si es número de teléfono)
                if (/^\d{6,15}$/.test(rawSessionId)) {
                    const [phoneRows] = await conn.query(
                        'SELECT session_id FROM user_sessions WHERE phone = ? ORDER BY updated_at DESC LIMIT 1',
                        [rawSessionId]
                    );
                    if (phoneRows.length > 0) {
                        return phoneRows[0].session_id;
                    }
                }

                // Buscar por owner_phone_number (hex)
                const [ownerRows] = await conn.query(
                    'SELECT session_id FROM user_sessions WHERE owner_phone_number = ? ORDER BY updated_at DESC LIMIT 1',
                    [rawSessionId]
                );
                if (ownerRows.length > 0) {
                    return ownerRows[0].session_id;
                }
            } finally {
                conn.release();
            }
        }

        // Caso 3: Si parece un user.id (número pequeño < 1000000), usarlo directo
        if (/^\d{1,6}$/.test(rawSessionId)) {
            return rawSessionId;
        }

        // Fallback: retornar el rawSessionId tal cual
        return rawSessionId;
    } catch (error) {
        console.error('[RESOLVER] Error resolviendo session_id:', error.message);
        return rawSessionId;
    }
}

/**
 * Resuelve múltiples formatos a un array de user.ids válidos
 * @param {string|string[]} rawSessionIds - Un o múltiples session_ids
 * @returns {Promise<string[]>} Array de user.ids resueltos
 */
async function resolveToUserIds(rawSessionIds) {
    const ids = Array.isArray(rawSessionIds) ? rawSessionIds : [rawSessionIds];
    const resolved = [];

    for (const id of ids) {
        const userId = await resolveToUserId(id);
        if (userId && !resolved.includes(userId)) {
            resolved.push(userId);
        }
    }

    return resolved;
}

/**
 * Verifica si un session_id es válido (existe en user_sessions)
 * @param {string} sessionId - El session_id a verificar
 * @returns {Promise<boolean>}
 */
async function isValidSessionId(sessionId) {
    try {
        if (!global.dbPool) return false;
        const conn = await global.dbPool.getConnection();
        try {
            const [rows] = await conn.query(
                'SELECT id FROM user_sessions WHERE session_id = ? LIMIT 1',
                [sessionId]
            );
            return rows.length > 0;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('[RESOLVER] Error checking valid session_id:', error);
        return false;
    }
}

module.exports = {
    resolveToUserId,
    resolveToUserIds,
    isValidSessionId
};
