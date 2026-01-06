/**
 * Middleware para validar que un sessionId pertenece al usuario autenticado
 * CRÍTICO PARA SEGURIDAD: Evita que un usuario acceda a datos de otros usuarios
 */

const jwt = require('jsonwebtoken');

/**
 * Valida que el sessionId pertenece al usuario autenticado
 * Requiere que authenticateToken haya sido ejecutado antes
 */
const validateSessionBelongsToUser = async (req, res, next) => {
    try {
        // El middleware authenticateToken debe haber puesto req.user
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'No autenticado. Token requerido.'
            });
        }

        // Obtener sessionId del parámetro o query
        const sessionId = req.params.sessionId || req.query.sessionId;

        if (!sessionId) {
            // Si no hay sessionId en parámetro, podría estar en body (para POST)
            if (req.body && req.body.sessionId) {
                req.params.sessionId = req.body.sessionId;
                return validateSessionBelongsToUser(req, res, next);
            }

            return res.status(400).json({
                success: false,
                error: 'sessionId requerido'
            });
        }

        console.log(`[SESSION-VALIDATION] 🔐 Validando sessionId=${sessionId} para usuario=${req.user.email}`);

        // Obtener pool de DB desde req.app
        const pool = req.app.get('dbPool') || global.dbPool;

        if (!pool) {
            console.error('[SESSION-VALIDATION] ❌ DB Pool no disponible');
            return res.status(500).json({
                success: false,
                error: 'Error del servidor: DB no disponible'
            });
        }

        try {
            // Llamar a getOwnerSessionId para convertir sessionId a users.id
            // (está definida en index.js, pero haremos la lógica aquí)

            const connection = await pool.getConnection();
            try {
                // 1. Si sessionId es numérico pequeño, asumir que es users.id
                const numericId = parseInt(sessionId);
                let userId = null;

                if (!isNaN(numericId) && numericId > 0 && numericId < 1000000 && sessionId == numericId) {
                    userId = numericId;
                } else {
                    // 2. Buscar en user_sessions por session_id, phone, o owner_phone_number
                    // Se agrega OR u.email = us.email para vincular por email si el teléfono aún no está sincronizado
                    const [sessionRows] = await connection.execute(
                        `SELECT us.session_id, u.id as user_id, us.email as session_email 
                         FROM user_sessions us
                         LEFT JOIN users u ON (u.phone = us.phone OR u.email = us.email)
                         WHERE us.session_id = ? OR us.phone = ? OR us.owner_phone_number = ? 
                         ORDER BY us.is_active DESC, us.created_at DESC LIMIT 1`,
                        [sessionId, sessionId, sessionId]
                    );

                    if (sessionRows.length > 0) {
                        userId = sessionRows[0].user_id;
                    }
                }

                if (!userId) {
                    // Buscar por teléfono si parece un teléfono
                    if (sessionId.match(/^\+?\d{10,15}$/)) {
                        const [phoneRows] = await connection.execute(
                            'SELECT id FROM users WHERE phone LIKE ? LIMIT 1',
                            [`%${sessionId.replace(/\+/g, '')}%`]
                        );
                        if (phoneRows.length > 0) {
                            userId = phoneRows[0].id;
                        }
                    }
                }

                if (!userId) {
                    console.warn(`[SESSION-VALIDATION] ⚠️ No se pudo resolver sessionId a users.id: ${sessionId}`);
                    return res.status(403).json({
                        success: false,
                        error: 'Sesión inválida o no encontrada'
                    });
                }

                // 3. Verificar que el usuario del token es el dueño de la sesión
                const [userRows] = await connection.execute(
                    'SELECT id, email, phone FROM users WHERE id = ?',
                    [userId]
                );

                if (userRows.length === 0) {
                    console.warn(`[SESSION-VALIDATION] ⚠️ Usuario no encontrado: id=${userId}`);
                    return res.status(403).json({
                        success: false,
                        error: 'Usuario no encontrado'
                    });
                }

                const sessionOwner = userRows[0];

                // Si req.user no tiene email (caso admin con solo phone), cargar desde BD
                if (!req.user.email && req.user.phone) {
                    const [tokenUserRows] = await connection.execute(
                        'SELECT email FROM users WHERE phone = ? LIMIT 1',
                        [req.user.phone]
                    );
                    if (tokenUserRows.length > 0) {
                        req.user.email = tokenUserRows[0].email;
                        console.log(`[SESSION-VALIDATION] Email cargado desde BD: ${req.user.email}`);
                    }
                }

                // Comparar email del token con email del dueño de la sesión
                // Si alguno de los dos no tiene email, comparar por user ID
                let isAuthorized = (req.user.email && req.user.email === sessionOwner.email) ||
                    (req.user.id && String(req.user.id) === String(userId)) ||
                    (req.user.phone && req.user.phone === sessionOwner.email);

                // ✅ NUEVO: Permitir Agentes/Supervisores acceder a la sesión de su Admin
                if (!isAuthorized && (req.user.role === 'agent' || req.user.role === 'supervisor')) {
                    // Obtener el admin_phone del usuario actual (si no viene en el token)
                    let adminPhone = req.user.admin_phone;

                    if (!adminPhone) {
                        const [tokenUserRows] = await connection.execute(
                            'SELECT admin_phone FROM users WHERE id = ? LIMIT 1',
                            [req.user.id]
                        );
                        if (tokenUserRows.length > 0) {
                            adminPhone = tokenUserRows[0].admin_phone;
                        }
                    }

                    // Si el admin_phone del agente coincide con el phone del dueño de la sesión, autorizar
                    if (adminPhone && sessionOwner.phone && adminPhone === sessionOwner.phone) {
                        console.log(`[SESSION-VALIDATION] ✅ Agente autorizado por admin_phone: ${adminPhone}`);
                        isAuthorized = true;
                    }
                }

                if (!isAuthorized) {
                    console.warn(
                        `[SESSION-VALIDATION] ⚠️ INTENTO DE ACCESO NO AUTORIZADO: ` +
                        `Usuario ${req.user.email || req.user.phone || req.user.id} intentó acceder a sesión de ${sessionOwner.email} (sessionId=${sessionId})`
                    );

                    // Log de seguridad en la BD (solo si la tabla existe)
                    try {
                        await connection.execute(
                            `INSERT INTO security_logs (event_type, user_id, details) VALUES (?, ?, ?)`,
                            ['UNAUTHORIZED_SESSION_ACCESS', userId || 'unknown',
                                `User ${req.user.email || req.user.phone} attempted to access session of ${sessionOwner.email}`]
                        );
                    } catch (logErr) {
                        // Ignorar si la tabla no existe
                        if (!logErr.message.includes("doesn't exist")) {
                            console.error('[SESSION-VALIDATION] Error logging security event:', logErr.message);
                        }
                    }

                    return res.status(403).json({
                        success: false,
                        error: 'No tienes permiso para acceder a esta sesión'
                    });
                }

                console.log(`[SESSION-VALIDATION] ✅ Validación exitosa: usuario ${req.user.email} accediendo a su sesión ${sessionId}`);

                // Agregar el userId resuelto a req para uso posterior
                req.sessionUserId = userId;
                req.validatedSessionId = sessionId;

                next();

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[SESSION-VALIDATION] Error en validación:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al validar sesión'
            });
        }

    } catch (error) {
        console.error('[SESSION-VALIDATION] Error crítico:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
};

module.exports = {
    validateSessionBelongsToUser
};
