const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateDeviceFingerprint, getDeviceInfo } = require('./utils/deviceFingerprint');

module.exports = function (app, pool) {
    // FIX: Fallback to global.dbPool if pool is not passed correctly
    if (!pool && global.dbPool) {
        pool = global.dbPool;
        console.log('[USERS] ⚠️ Using global.dbPool fallback');
    }
    // Resolver sessionId cuando viene como owner_phone_number (hex) o phone (numérico)
    const resolveSessionId = async (rawId) => {
        if (!rawId) return rawId;
        try {
            // Si parece un owner_phone_number (16 hex)
            if (typeof rawId === 'string' && rawId.length === 16 && /^[a-f0-9]{16}$/i.test(rawId)) {
                const [rows] = await pool.query(
                    'SELECT session_id FROM user_sessions WHERE owner_phone_number = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1',
                    [rawId]
                );
                if (rows.length > 0 && rows[0].session_id) {
                    console.log(`[USERS] 🔄 owner_phone_number ${rawId} → session_id ${rows[0].session_id}`);
                    return rows[0].session_id;
                }
            }

            // Si parece un número de teléfono, mapear a session_id
            if (/^\d{6,}$/.test(String(rawId))) {
                const [rows] = await pool.query(
                    'SELECT session_id FROM user_sessions WHERE phone = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1',
                    [String(rawId)]
                );
                if (rows.length > 0 && rows[0].session_id) {
                    console.log(`[USERS] 🔄 phone ${rawId} → session_id ${rows[0].session_id}`);
                    return rows[0].session_id;
                }
            }

            return rawId;
        } catch (err) {
            console.warn('[USERS] ⚠️ Error resolviendo sessionId:', err.message);
            return rawId;
        }
    };

    // ==================== AUTENTICACIÓN ====================
    // ⚠️ ENDPOINTS MOVIDOS A: src/server/auth-endpoints.js
    // Se eliminaron de aquí para evitar conflictos de rutas duplicadas y errores 401.

    // ==================== GESTIÓN DE USUARIOS ====================


    // Obtener todos los usuarios
    app.get('/api/users', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }
            const { role, department, status } = req.query;
            const sessionIdRaw = req.query.sessionId;
            const sessionId = await resolveSessionId(sessionIdRaw);
            const dbPool = pool || global.dbPool;
            if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
            const connection = await dbPool.getConnection();

            try {
                let query = 'SELECT id, name, email, role, department, category, status, agent_status, avatar_url, phone, last_login, created_at, session_id FROM users WHERE 1=1';
                const params = [];

                // FILTRO OBLIGATORIO: Cada usuario solo ve sus propios agentes
                if (sessionId) {
                    query += ' AND session_id = ?';
                    params.push(sessionId);
                }

                if (role) {
                    query += ' AND role = ?';
                    params.push(role);
                }
                if (department) {
                    query += ' AND department = ?';
                    params.push(department);
                }
                if (status) {
                    query += ' AND status = ?';
                    params.push(status);
                }

                query += ' ORDER BY created_at DESC';

                const [users] = await connection.execute(query, params);
                res.json({ success: true, users });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo usuarios' });
        }
    });

    // Obtener perfil de un usuario específico
    app.get('/api/users/:id/profile', async (req, res) => {
        try {
            const { id } = req.params;
            const dbPool = pool || global.dbPool;
            if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
            const connection = await dbPool.getConnection();

            try {
                'SELECT id, name, email, role, department, category, status, avatar_url, phone, last_login, created_at, session_id FROM users WHERE id = ?',
                    [id]
                );

    if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    res.json({ success: true, user: users[0] });
} finally {
    connection.release();
}
        } catch (error) {
    console.error('Error obteniendo perfil de usuario:', error);
    res.status(500).json({ success: false, error: 'Error obteniendo perfil de usuario' });
}
    });

// Crear nuevo usuario
app.post('/api/users', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }
        const { name, email, password, role, department, category, phone } = req.body;
        const sessionIdRaw = req.body.sessionId;
        const sessionId = await resolveSessionId(sessionIdRaw);

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Nombre, email y contraseña son requeridos' });
        }

        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'sessionId es requerido' });
        }

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Verificar si el email ya existe para este sessionId
            const [existing] = await connection.execute(
                'SELECT id FROM users WHERE email = ? AND session_id = ?',
                [email, sessionId]
            );

            if (existing.length > 0) {
                return res.status(400).json({ success: false, error: 'El email ya está registrado' });
            }

            // Hash de la contraseña
            const hashedPassword = await bcrypt.hash(password, 10);

            // Si es agente, obtener el admin_phone del sessionId
            let adminPhone = null;
            if (role === 'agent' || !role) {
                const [session] = await connection.execute(
                    'SELECT phone_number FROM user_sessions WHERE session_id = ? LIMIT 1',
                    [sessionId]
                );
                if (session.length > 0) {
                    adminPhone = session[0].phone_number;
                }
            }

            // Insertar usuario con session_id y admin_phone
            const [result] = await connection.execute(`
                INSERT INTO users (name, email, password, role, department, category, phone, status, session_id, admin_phone)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
            `, [name, email, hashedPassword, role || 'agent', department || null, category || null, phone || null, sessionId, adminPhone]);

            // Obtener el usuario creado
            const [newUser] = await connection.execute(
                'SELECT id, name, email, role, department, category, status, phone, created_at, session_id, admin_phone FROM users WHERE id = ?',
                [result.insertId]
            );

            console.log(`✅ Usuario creado: ${email} (${role || 'agent'}) para sessionId: ${sessionId}, admin_phone: ${adminPhone}`);
            res.json({ success: true, user: newUser[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ success: false, error: 'Error creando usuario' });
    }
});

// Actualizar usuario
app.put('/api/users/:id', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { id } = req.params;
        const { name, email, password, role, department, category, status, phone } = req.body;

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Verificar si el usuario existe
            const [existing] = await connection.execute('SELECT id FROM users WHERE id = ?', [id]);
            if (existing.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            // Construir query dinámicamente
            const updates = [];
            const params = [];

            if (name) {
                updates.push('name = ?');
                params.push(name);
            }
            if (email) {
                updates.push('email = ?');
                params.push(email);
            }
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                updates.push('password = ?');
                params.push(hashedPassword);
            }
            if (role) {
                updates.push('role = ?');
                params.push(role);
            }
            if (department !== undefined) {
                updates.push('department = ?');
                params.push(department);
            }
            if (category !== undefined) {
                updates.push('category = ?');
                params.push(category);
            }
            if (status) {
                updates.push('status = ?');
                params.push(status);
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                params.push(phone);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
            }

            params.push(id);
            await connection.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            // Obtener el usuario actualizado
            const [updatedUser] = await connection.execute(
                'SELECT id, name, email, role, department, category, status, phone, created_at FROM users WHERE id = ?',
                [id]
            );

            console.log(`✅ Usuario actualizado: ${id}`);
            res.json({ success: true, user: updatedUser[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ success: false, error: 'Error actualizando usuario' });
    }
});

// Eliminar usuario
// Actualizar estado del usuario
app.put('/api/users/:id/status', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { id } = req.params;
        const { status } = req.body;
        const sessionIdRaw = req.body.sessionId;
        const sessionId = await resolveSessionId(sessionIdRaw);

        if (!status || !sessionId) {
            return res.status(400).json({ success: false, error: 'Status y sessionId son requeridos' });
        }

        // Validar que el status sea válido
        if (!['active', 'inactive', 'suspended'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Status inválido' });
        }

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Verificar si el usuario existe
            const [existing] = await connection.execute(
                'SELECT id, session_id FROM users WHERE id = ?',
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const user = existing[0];

            // Verificar que el usuario pertenece a la sesión correcta
            if (user.session_id !== sessionId) {
                return res.status(403).json({ success: false, error: 'No autorizado para modificar este usuario' });
            }

            // Actualizar estado del usuario
            await connection.execute(
                'UPDATE users SET status = ? WHERE id = ?',
                [status, id]
            );

            // Obtener el usuario actualizado
            const [updatedUser] = await connection.execute(
                'SELECT id, name, email, role, department, category, status, phone, created_at FROM users WHERE id = ?',
                [id]
            );

            console.log(`✅ Estado del usuario actualizado: ${id} -> ${status}`);
            res.json({ success: true, user: updatedUser[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error actualizando estado del usuario:', error);
        res.status(500).json({ success: false, error: 'Error actualizando estado del usuario' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        console.log('🎯 Solicitud DELETE recibida para /api/users/:id');
        console.log('🆔 ID del usuario a eliminar:', req.params.id);

        if (!pool) {
            console.log('❌ Pool de base de datos no disponible');
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { id } = req.params;
        console.log(`🔍 Intentando eliminar usuario con ID: ${id}`);

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Primero verificar si el usuario existe
            const [existing] = await connection.execute('SELECT id FROM users WHERE id = ?', [id]);
            console.log(`📊 Usuario encontrado: ${existing.length > 0 ? 'Sí' : 'No'}`);

            if (existing.length === 0) {
                console.log(`⚠️ Usuario con ID ${id} no encontrado`);
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            await connection.execute('DELETE FROM users WHERE id = ?', [id]);
            console.log(`✅ Usuario eliminado: ${id}`);
            res.json({ success: true, message: 'Usuario eliminado' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ success: false, error: 'Error eliminando usuario' });
    }
});

// ==================== CHATS ASIGNADOS ====================

// Obtener chats asignados a un usuario
app.get('/api/users/:userId/chats', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { userId } = req.params;
        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Obtener chats asignados al usuario con información de contacto y mensajes
            const [chats] = await connection.execute(`
                SELECT 
                    ca.id,
                    ca.chat_jid,
                    ca.session_id,
                    ca.user_id,
                    ca.assigned_at,
                    ca.status,
                    COALESCE(c.name, cg.name) as contact_name,
                    c.phone as contact_phone,
                    COALESCE(c.avatar_url, cg.avatar_url) as avatar_url,
                    (SELECT text_content FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id ORDER BY m.timestamp DESC LIMIT 1) as last_message,
                    (SELECT timestamp FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id ORDER BY m.timestamp DESC LIMIT 1) as last_message_time,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as message_count,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id AND m.status = 'unread') as unread_count
                FROM chat_assignments ca
                LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                LEFT JOIN contact_groups cg ON ca.chat_jid = cg.jid AND ca.session_id = cg.session_id
                WHERE ca.user_id = ? AND ca.status = 'active'
                ORDER BY ca.assigned_at DESC
            `, [userId]);

            console.log(`[AGENTS-CHATS] Agente ${userId} solicitó chats. Encontrados: ${chats.length}`);

            res.json({ success: true, chats });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo chats asignados:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo chats asignados' });
    }
});

// ==================== TRANSFERENCIA DE CHATS ====================

// Transferir chat entre usuarios
app.post('/api/chats/transfer-legacy-1', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { sessionId, chatJid, fromUserId, toUserId, reason, transferredBy } = req.body;

        if (!sessionId || !chatJid || !fromUserId || !toUserId) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos' });
        }

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Verificar que el chat esté asignado al usuario de origen
            const [currentAssignment] = await connection.execute(
                'SELECT id FROM chat_assignments WHERE chat_jid = ? AND session_id = ? AND user_id = ? AND status = ?',
                [chatJid, sessionId, fromUserId, 'active']
            );

            if (currentAssignment.length === 0) {
                return res.status(404).json({ success: false, error: 'Chat no encontrado o no asignado al usuario' });
            }

            // Registrar la transferencia
            await connection.execute(`
                INSERT INTO chat_transfers 
                (chat_jid, session_id, from_user_id, to_user_id, transferred_by, reason, transferred_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [chatJid, sessionId, fromUserId, toUserId, transferredBy || fromUserId, reason || null]);

            // Cerrar asignación actual
            await connection.execute(`
                UPDATE chat_assignments 
                SET status = 'transferred', closed_at = NOW()
                WHERE chat_jid = ? AND session_id = ? AND user_id = ? AND status = 'active'
            `, [chatJid, sessionId, fromUserId]);

            // Crear nueva asignación
            await connection.execute(`
                INSERT INTO chat_assignments 
                (chat_jid, session_id, user_id, assigned_by, assigned_at, status)
                VALUES (?, ?, ?, ?, NOW(), 'active')
            `, [chatJid, sessionId, toUserId, transferredBy || fromUserId]);

            console.log(`✅ Chat ${chatJid} transferido de usuario ${fromUserId} a ${toUserId}`);
            res.json({ success: true, message: 'Chat transferido correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error transfiriendo chat:', error);
        res.status(500).json({ success: false, error: 'Error transfiriendo chat' });
    }
});

// ==================== GESTIÓN DE USUARIOS ====================

// ==================== ASIGNACIÓN DE CHATS ====================

// Asignar chat a agente
app.post('/api/chats/assign', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { chatJid, sessionId, userId, assignedBy, notes } = req.body;

        if (!chatJid || !sessionId || !userId) {
            return res.status(400).json({ success: false, error: 'chatJid, sessionId y userId son requeridos' });
        }

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Cerrar asignación anterior si existe
            await connection.execute(`
                UPDATE chat_assignments
                SET status = 'transferred'
                WHERE chat_jid = ? AND session_id = ? AND status = 'active'
            `, [chatJid, sessionId]);

            // Crear nueva asignación
            await connection.execute(`
                INSERT INTO chat_assignments (chat_jid, session_id, user_id, assigned_by, notes, status)
                VALUES (?, ?, ?, ?, ?, 'active')
            `, [chatJid, sessionId, userId, assignedBy || null, notes || null]);

            console.log(`✅ Chat ${chatJid} asignado al usuario ${userId}`);
            res.json({ success: true, message: 'Chat asignado correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error asignando chat:', error);
        res.status(500).json({ success: false, error: 'Error asignando chat' });
    }
});

// Actualizar estado de conversación (Open/Pending/Closed)
app.post('/api/chats/status', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { chatJid, sessionId, status, userId } = req.body;

        if (!chatJid || !sessionId || !status) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos' });
        }

        if (!['open', 'pending', 'closed'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Estado inválido' });
        }

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Actualizar estado en chat_assignments
            // Si el status es 'closed', también podríamos querer actualizar el status de la asignación a 'inactive' o mantenerlo 'active' pero con conversation_status 'closed'
            // Según requerimiento: "cuando el agente cierra la conversacion solo cierra la sesion de su espacio nomas" -> Interpretación: Cierra el ticket/conversación visualmente

            await connection.execute(`
                UPDATE chat_assignments
                SET conversation_status = ?
                WHERE chat_jid = ? AND session_id = ? AND status = 'active'
            `, [status, chatJid, sessionId]);

            console.log(`✅ Estado de conversación actualizado: ${chatJid} -> ${status}`);
            res.json({ success: true, message: 'Estado actualizado correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error actualizando estado de conversación:', error);
        res.status(500).json({ success: false, error: 'Error actualizando estado' });
    }
});

// Transferir chat entre agentes
app.post('/api/chats/transfer-legacy-2', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { chatJid, sessionId, fromUserId, toUserId, transferredBy, reason } = req.body;

        if (!chatJid || !sessionId || !fromUserId || !toUserId) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos' });
        }

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // Registrar transferencia
            await connection.execute(`
                INSERT INTO chat_transfers (chat_jid, session_id, from_user_id, to_user_id, transferred_by, reason)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [chatJid, sessionId, fromUserId, toUserId, transferredBy || fromUserId, reason || null]);

            // Cerrar asignación anterior
            await connection.execute(`
                UPDATE chat_assignments
                SET status = 'transferred'
                WHERE chat_jid = ? AND session_id = ? AND user_id = ? AND status = 'active'
            `, [chatJid, sessionId, fromUserId]);

            // Crear nueva asignación (Resetear conversation_status a 'open' al transferir)
            await connection.execute(`
                INSERT INTO chat_assignments (chat_jid, session_id, user_id, assigned_by, notes, status, conversation_status)
                VALUES (?, ?, ?, ?, ?, 'active', 'open')
            `, [chatJid, sessionId, toUserId, transferredBy || fromUserId, reason || 'Transferido de otro agente']);

            console.log(`✅ Chat ${chatJid} transferido de usuario ${fromUserId} a ${toUserId}`);
            res.json({ success: true, message: 'Chat transferido correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error transfiriendo chat:', error);
        res.status(500).json({ success: false, error: 'Error transfiriendo chat' });
    }
});

// Obtener chats asignados a un agente
app.get('/api/users/:userId/chats', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { userId } = req.params;
        const { sessionId } = req.query;

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            let query = `
                SELECT
                    ca.chat_jid,
                    ca.session_id,
                    ca.assigned_at,
                    ca.notes,
                    ca.conversation_status,
                    COALESCE(c.name, cg.name) as contact_name,
                    COALESCE(c.avatar_url, cg.avatar_url) as avatar_url,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as message_count,
                    (SELECT MAX(timestamp) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as last_message_time,
                    (SELECT text_content FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id ORDER BY m.timestamp DESC LIMIT 1) as last_message
                FROM chat_assignments ca
                LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                LEFT JOIN contact_groups cg ON ca.chat_jid = cg.jid AND ca.session_id = cg.session_id
                WHERE ca.user_id = ? AND ca.status = 'active'
            `;

            const params = [userId];

            if (sessionId) {
                query += ' AND ca.session_id = ?';
                params.push(sessionId);
            }

            query += ' ORDER BY last_message_time DESC';

            const [chats] = await connection.execute(query, params);
            res.json({ success: true, chats });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo chats del usuario:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo chats' });
    }
});

// Obtener datos para el dashboard de gestión de usuarios
app.get('/api/users/dashboard', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            // 1. Obtener todos los usuarios
            const [users] = await connection.execute(
                'SELECT id, name, email, role, department, status, avatar_url, phone, last_login, created_at FROM users ORDER BY created_at DESC'
            );

            // 2. Obtener estadísticas de agentes
            const [stats] = await connection.execute(`
                SELECT
                    u.id as userId,
                    COUNT(DISTINCT ca.chat_jid) as assigned_chats,
                    COUNT(DISTINCT m.id) as total_messages_sent
                FROM users u
                LEFT JOIN chat_assignments ca ON u.id = ca.user_id AND ca.status = 'active'
                LEFT JOIN messages m ON ca.chat_jid = m.chat_jid AND ca.session_id = m.session_id AND m.from_me = 1
                WHERE u.status = 'active'
                GROUP BY u.id
            `);

            // 3. Obtener asignaciones recientes
            const [assignments] = await connection.execute(`
                SELECT
                    ca.chat_jid,
                    ca.user_id,
                    ca.assigned_at,
                    c.name as contact_name,
                    u.name as agent_name
                FROM chat_assignments ca
                LEFT JOIN contacts c ON ca.chat_jid = c.jid
                LEFT JOIN users u ON ca.user_id = u.id
                WHERE ca.status = 'active'
                ORDER BY ca.assigned_at DESC
                LIMIT 10
            `);

            // Combinar estadísticas con usuarios
            const userStatsMap = stats.reduce((acc, item) => {
                acc[item.userId] = {
                    assigned_chats: item.assigned_chats || 0,
                    total_messages_sent: item.total_messages_sent || 0
                };
                return acc;
            }, {});

            const usersWithStats = users.map(user => ({
                ...user,
                stats: userStatsMap[user.id] || { assigned_chats: 0, total_messages_sent: 0 }
            }));

            res.json({
                success: true,
                users: usersWithStats,
                recent_assignments: assignments
            });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo datos del dashboard de usuarios:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo datos del dashboard' });
    }
});

// Obtener estadísticas de agentes
app.get('/api/users/stats', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { sessionId } = req.query;
        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            let query = `
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.role,
                    u.department,
                    COUNT(DISTINCT ca.chat_jid) as assigned_chats,
                    COUNT(DISTINCT m.id) as total_messages_sent,
                    MAX(m.timestamp) as last_message_time
                FROM users u
                LEFT JOIN chat_assignments ca ON u.id = ca.user_id AND ca.status = 'active'
                LEFT JOIN messages m ON ca.chat_jid = m.chat_jid AND ca.session_id = m.session_id AND m.from_me = 1
                WHERE u.status = 'active'`;

            const params = [];

            // FILTRO OBLIGATORIO: Solo estadísticas de usuarios del mismo session_id
            if (sessionId) {
                query += ' AND u.session_id = ?';
                params.push(sessionId);
            }

            query += `
                GROUP BY u.id
                ORDER BY assigned_chats DESC
            `;

            const [stats] = await connection.execute(query, params);

            res.json({ success: true, stats });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo estadísticas' });
    }
});

// Obtener asignaciones de chats por sesión
app.get('/api/chat-assignments/:sessionId', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { sessionId } = req.params;
        const dbPool = pool || global.dbPool;
        if (!dbPool) return res.status(503).json({ success: false, error: 'Database not initialized' });
        const connection = await dbPool.getConnection();

        try {
            const [assignments] = await connection.execute(`
                SELECT
                    ca.id,
                    ca.chat_jid,
                    ca.session_id,
                    ca.user_id,
                    ca.assigned_at,
                    ca.notes,
                    ca.status,
                    c.name as contact_name,
                    c.avatar_url,
                    u.name as agent_name,
                    u.role as agent_role,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as message_count,
                    (SELECT MAX(timestamp) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as last_message_time
                FROM chat_assignments ca
                LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                LEFT JOIN users u ON ca.user_id = u.id
                WHERE ca.session_id = ? AND ca.status = 'active'
                ORDER BY ca.assigned_at DESC
            `, [sessionId]);

            res.json({ success: true, assignments });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo asignaciones de chats:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo asignaciones' });
    }
});

console.log('✅ Endpoints de usuarios y asignaciones cargados correctamente');

}; // Fin del módulo
