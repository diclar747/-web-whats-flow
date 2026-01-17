// ============================================
// SISTEMA MULTI-AGENTE - ENDPOINTS BACKEND
// Gestión completa de roles, permisos y asignación de chats
// ============================================

module.exports = function (app, pool) {
    console.log('📢 [MULTIAGENT] Cargando endpoints de multi-agente...');


    app.get('/api/health-multiagent', (req, res) => {
        res.json({ success: true, message: 'Multiagent module loaded' });
    });

    /**
     * Resuelve el ownerSessionId (users.id) a partir de un sessionId (phone, uuid, etc)
     */
    async function getOwnerSessionId(sessionId) {
        if (!sessionId) return null;
        if (pool) {
            try {
                const connection = await pool.getConnection();
                try {
                    // 1. Si es numérico (1-999999), intentar usarlo directamente
                    const numericId = parseInt(sessionId);
                    if (!isNaN(numericId) && numericId > 0 && numericId < 1000000 && String(sessionId) === String(numericId)) {
                        return String(numericId);
                    }

                    // 2. Buscar en user_sessions y obtener su session_id real (que puede ser el ID numérico o el UUID)
                    const [sessionRows] = await connection.execute(
                        'SELECT us.session_id, us.phone, u.id as user_id FROM user_sessions us LEFT JOIN users u ON u.phone = us.phone WHERE us.session_id = ? OR us.phone = ? LIMIT 1',
                        [sessionId, sessionId]
                    );
                    if (sessionRows.length > 0) {
                        return String(sessionRows[0].session_id);
                    }

                    // 3. Buscar en users por phone
                    const cleanPhone = sessionId.replace(/\D/g, '');
                    const [userRows] = await connection.execute(
                        'SELECT id FROM users WHERE phone = ? OR phone LIKE ? LIMIT 1',
                        [sessionId, `%${cleanPhone}`]
                    );
                    if (userRows.length > 0) {
                        return String(userRows[0].id);
                    }
                } finally {
                    connection.release();
                }
            } catch (err) {
                console.error('[MULTIAGENT-RESOLVE] Error resolving ownerId:', err);
            }
        }
        return sessionId; // Fallback
    }

    /**
     * Obtiene el número de teléfono de una sesión
     */
    async function getUserPhoneNumber(sessionId) {
        if (!sessionId) return null;

        // Si sessionId ya parece un teléfono (10-15 dígitos), devolverlo
        if (/^\d{10,15}$/.test(sessionId)) {
            return sessionId;
        }

        if (pool) {
            try {
                const connection = await pool.getConnection();
                try {
                    // Buscar en user_sessions
                    const [rows] = await connection.execute(
                        'SELECT phone FROM user_sessions WHERE session_id = ? OR phone = ? OR id = ? LIMIT 1',
                        [sessionId, sessionId, sessionId]
                    );
                    if (rows.length > 0 && rows[0].phone) {
                        return rows[0].phone;
                    }

                    // Buscar en users
                    const [userRows] = await connection.execute(
                        'SELECT phone FROM users WHERE id = ? LIMIT 1',
                        [sessionId]
                    );
                    if (userRows.length > 0 && userRows[0].phone) {
                        return userRows[0].phone;
                    }
                } finally {
                    connection.release();
                }
            } catch (err) {
                console.error('[getUserPhoneNumber] Error:', err.message);
            }
        }
        return sessionId;
    }

    // Middleware para verificar autenticación (compatible con sistema base64)
    const authenticateToken = async (req, res, next) => {
        console.log(`[AUTH-MIDDLEWARE] Route: ${req.path}, Method: ${req.method}`);
        const authHeader = req.headers['authorization'];
        console.log(`[AUTH-DEBUG] Header received: ${authHeader ? 'YES' : 'NO'}`);
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.log('[AUTH-DEBUG] No token provided');
            return res.status(401).json({ success: false, error: 'Token requerido' });
        }

        try {
            // Primero intentar decodificar como JWT
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || '0927450953d52b804a8e511e5a7f2f35bbd20f6c4c156902b4e0902214795eb4c6dafffc36e40489d6eda1ae3963ac42c2d043ab3a4a6382bc62c70fe8ed3a7b';

            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                console.log(`[AUTH-DEBUG] JWT Decoded:`, decoded);

                // CASO ESPECIAL: ADMIN (Token basado en sesión/teléfono, no ID de tabla users)
                if (decoded.role === 'admin' && decoded.phone) {
                    console.log('[AUTH-DEBUG] Access granted to ADMIN');
                    // Intentar buscar ID numérico real si existe
                    // ... (Simplificación: Asumimos null para operaciones de BD si no es Agente)
                    req.user = {
                        id: decoded.id || ('admin_' + decoded.phone),
                        permissions_id: null, // Admin no tiene row, so NULL 
                        dbId: decoded.id || null, // Para FKs que requieran INT
                        name: 'Admin',
                        email: null,
                        role: 'admin',
                        status: 'active',
                        phone: decoded.phone
                    };
                    return next();
                }

                // CASO AGENTE/USUARIO (Token con ID de base de datos)
                // Verificar que el usuario existe y está activo
                const connection = await pool.getConnection();
                try {
                    console.log(`[AUTH-DEBUG] Buscando usuario con id=${decoded.id} (type=${typeof decoded.id})`);
                    const [rows] = await connection.execute('SELECT id, email, status, role FROM users WHERE id = ?', [decoded.id]);
                    console.log(`[AUTH-DEBUG] Query result: ${rows.length} filas encontradas`);
                    if (rows.length > 0) {
                        console.log(`[AUTH-DEBUG] Usuario encontrado: id=${rows[0].id}, email=${rows[0].email}, status=${rows[0].status}`);
                    }
                    if (rows.length === 0 || rows[0].status !== 'active') {
                        return res.status(403).json({ success: false, error: 'Usuario no válido o inactivo' });
                    }
                    req.user = rows[0];
                    req.user.dbId = rows[0].id; // Uniformidad
                    next();
                } finally {
                    connection.release();
                }
            } catch (jwtError) {
                // Si falla JWT, intentar decodificar como base64 (formato legacy)
                const decoded = Buffer.from(token, 'base64').toString('utf-8');
                const [userId, email, timestamp] = decoded.split(':');

                if (!userId || !email) {
                    return res.status(403).json({ success: false, error: 'Token inválido' });
                }

                const connection = await pool.getConnection();
                try {
                    const [users] = await connection.execute(
                        'SELECT id, name, email, role, status FROM users WHERE id = ? AND email = ?',
                        [userId, email]
                    );

                    if (users.length === 0 || users[0].status !== 'active') {
                        connection.release();
                        return res.status(403).json({ success: false, error: 'Token inválido o usuario inactivo' });
                    }

                    req.user = users[0];
                    connection.release();
                    next();
                } catch (error) {
                    connection.release();
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error validando token:', error);
            return res.status(403).json({ success: false, error: 'Token inválido' });
        }
    };

    // ==================== PERMISOS ====================

    // Obtener todos los permisos del sistema
    app.get('/api/permissions', authenticateToken, async (req, res) => {
        try {
            const connection = await pool.getConnection();
            try {
                const [permissions] = await connection.execute(`
                    SELECT p.*, 
                        COUNT(DISTINCT rp.id) as roles_assigned
                    FROM permissions p
                    LEFT JOIN role_permissions rp ON p.id = rp.permission_id
                    GROUP BY p.id
                    ORDER BY p.module, p.name
                `);
                res.json({ success: true, permissions });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo permisos:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo permisos' });
        }
    });

    // Obtener permisos del usuario actual
    app.get('/api/user/permissions', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const connection = await pool.getConnection();
            try {
                // Verificar en BD si es super admin
                const [userCheck] = await connection.execute(
                    'SELECT is_super_admin, is_admin FROM users WHERE id = ? OR email = ?',
                    [userId, req.user.email]
                );

                const isSuperAdmin = userCheck.length > 0 && userCheck[0].is_super_admin === 1;
                const isAdmin = userCheck.length > 0 && userCheck[0].is_admin === 1;

                if (isSuperAdmin || isAdmin) {
                    console.log('[PERMISSIONS] Super admin/admin detectado en BD - Retornando permisos totales');
                    // Super admin tiene acceso a TODO
                    const allPermissions = [
                        { permission_name: 'analytics', module: 'analytics', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'chat', module: 'chat', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'campaign', module: 'campaign', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'agents', module: 'agents', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'settings', module: 'settings', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'clients', module: 'clients', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'plans', module: 'plans', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'kanban', module: 'kanban', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 },
                        { permission_name: 'calendar', module: 'calendar', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1 }
                    ];

                    const grouped = allPermissions.reduce((acc, perm) => {
                        if (!acc[perm.module]) acc[perm.module] = [];
                        acc[perm.module].push(perm);
                        return acc;
                    }, {});

                    return res.json({ success: true, permissions: allPermissions, grouped });
                }

                // Para agentes normales, usar la vista de permisos
                const [permissions] = await connection.execute(`
                    SELECT 
                        permission_name,
                        module,
                        can_view,
                        can_create,
                        can_edit,
                        can_delete
                    FROM v_user_permissions
                    WHERE user_id = ?
                `, [userId]);

                // Agrupar por módulo
                const grouped = permissions.reduce((acc, perm) => {
                    if (!acc[perm.module]) acc[perm.module] = [];
                    acc[perm.module].push(perm);
                    return acc;
                }, {});

                res.json({ success: true, permissions, grouped });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo permisos de usuario:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo permisos' });
        }
    });

    // Verificar permiso específico
    app.post('/api/user/check-permission', authenticateToken, async (req, res) => {
        try {
            const { permission, action } = req.body; // action: view, create, edit, delete
            const userId = req.user.id;
            const connection = await pool.getConnection();

            try {
                // Verificar en BD si es super admin
                const [userCheck] = await connection.execute(
                    'SELECT is_super_admin, is_admin FROM users WHERE id = ? OR email = ?',
                    [userId, req.user.email]
                );

                const isSuperAdmin = userCheck.length > 0 && userCheck[0].is_super_admin === 1;

                // Si es super admin, siempre retornar permiso = true
                if (isSuperAdmin) {
                    console.log(`[CHECK-PERMISSION] Super admin - Permiso ${permission}/${action} = GRANTED`);
                    return res.json({ success: true, has_permission: true });
                }

                const [result] = await connection.execute(`
                    SELECT 
                        CASE 
                            WHEN ? = 'view' THEN can_view
                            WHEN ? = 'create' THEN can_create
                            WHEN ? = 'edit' THEN can_edit
                            WHEN ? = 'delete' THEN can_delete
                            ELSE FALSE
                        END as has_permission
                    FROM v_user_permissions
                    WHERE user_id = ? AND permission_name = ?
                `, [action, action, action, action, userId, permission]);

                const hasPermission = result.length > 0 && result[0].has_permission === 1;
                res.json({ success: true, has_permission: hasPermission });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error verificando permiso:', error);
            res.status(500).json({ success: false, error: 'Error verificando permiso' });
        }
    });

    // Actualizar permisos de un rol
    app.put('/api/roles/:role/permissions', authenticateToken, async (req, res) => {
        try {
            // Solo admin puede modificar permisos
            if (req.user.userType !== 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Sin permisos para esta acción' });
            }

            const { role } = req.params;
            const { permissions } = req.body; // Array de { permission_id, can_view, can_create, can_edit, can_delete }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                for (const perm of permissions) {
                    await connection.execute(`
                        INSERT INTO role_permissions (role, permission_id, can_view, can_create, can_edit, can_delete)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            can_view = VALUES(can_view),
                            can_create = VALUES(can_create),
                            can_edit = VALUES(can_edit),
                            can_delete = VALUES(can_delete)
                    `, [role, perm.permission_id, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete]);
                }

                await connection.commit();
                res.json({ success: true, message: 'Permisos actualizados correctamente' });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error actualizando permisos:', error);
            res.status(500).json({ success: false, error: 'Error actualizando permisos' });
        }
    });

    // ==================== ASIGNACIÓN DE CHATS ====================

    // Obtener chats del agente actual
    app.get('/api/agent/chats', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { sessionId } = req.query;
            const connection = await pool.getConnection();

            try {
                console.log('[AGENT-CHATS] 🔍 Buscando chats para agente:', userId, 'sessionId:', sessionId);

                // Query directa sin vista para mayor control
                let query = `
                    SELECT DISTINCT
                        ca.chat_jid,
                        ca.session_id,
                        ca.user_id,
                        ca.assigned_at,
                        COALESCE(c.name, cg.name, ca.chat_jid) as contact_name,
                        COALESCE(c.avatar_url, cg.avatar_url) as avatar_url,
                        COALESCE(c.is_group, 1, 0) as is_group,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND m.session_id = ca.session_id) as total_messages,
                        (SELECT MAX(timestamp) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND m.session_id = ca.session_id) as last_message_time,
                        (SELECT text_content FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND m.session_id = ca.session_id 
                         ORDER BY timestamp DESC LIMIT 1) as last_message,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND m.session_id = ca.session_id 
                         AND m.from_me = 0 
                         AND m.is_read = 0) as unread_count
                    FROM chat_assignments ca
                    LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                    LEFT JOIN contact_groups cg ON ca.chat_jid = cg.jid AND ca.session_id = cg.session_id
                    WHERE ca.user_id = ? AND ca.status IN ('active', 'pending')
                `;
                const params = [userId];

                if (sessionId) {
                    query += ' AND ca.session_id = ?';
                    params.push(sessionId);
                }

                query += ' ORDER BY last_message_time DESC';

                const [chats] = await connection.execute(query, params);

                console.log('[AGENT-CHATS] ✅ Chats encontrados:', chats.length);

                // Si no hay sessionId en query, intentar obtenerlo del primer chat
                let finalSessionId = sessionId;
                if (!finalSessionId && chats.length > 0) {
                    finalSessionId = chats[0].session_id;
                    console.log('[AGENT-CHATS] 📋 SessionId detectado:', finalSessionId);
                }

                res.json({
                    success: true,
                    chats,
                    sessionId: finalSessionId,
                    count: chats.length
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo chats del agente:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo chats' });
        }
    });

    // Obtener todos los chats sin asignar (solo admin/supervisor)
    app.get('/api/chats/unassigned', authenticateToken, async (req, res) => {
        try {
            // Verificar que sea admin o supervisor
            if (!['admin', 'supervisor'].includes(req.user.role)) {
                return res.status(403).json({ success: false, error: 'Sin permisos' });
            }

            const { sessionId } = req.query;
            const connection = await pool.getConnection();

            try {
                const [chats] = await connection.execute(`
                    SELECT 
                        jid as chat_jid,
                        session_id,
                        name as contact_name,
                        avatar_url,
                        is_group,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = jid 
                         AND m.session_id = session_id) as total_messages,
                        (SELECT MAX(timestamp) FROM messages m 
                         WHERE m.chat_jid = jid 
                         AND m.session_id = session_id) as last_message_time,
                        (SELECT text_content FROM messages m 
                         WHERE m.chat_jid = jid 
                         AND m.session_id = session_id 
                         ORDER BY timestamp DESC LIMIT 1) as last_message
                    FROM (
                        SELECT jid, session_id, name, avatar_url, is_group FROM contacts WHERE session_id = ?
                        UNION ALL
                        SELECT jid, session_id, name, avatar_url, 1 as is_group FROM contact_groups WHERE session_id = ?
                    ) AS all_contacts
                    WHERE NOT EXISTS (
                        SELECT 1 FROM chat_assignments ca 
                        WHERE ca.chat_jid = jid 
                        AND ca.session_id = session_id 
                        AND ca.status = 'active'
                    )
                    AND EXISTS (
                        SELECT 1 FROM messages m 
                        WHERE m.chat_jid = jid 
                        AND m.session_id = session_id
                    )
                    ORDER BY last_message_time DESC
                `, [sessionId, sessionId]);

                res.json({ success: true, chats });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo chats sin asignar:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo chats' });
        }
    });

    // Asignar chat a un agente
    app.post('/api/chats/assign', authenticateToken, async (req, res) => {
        try {
            // Verificar que sea admin o supervisor
            if (!['admin', 'supervisor'].includes(req.user.role)) {
                return res.status(403).json({ success: false, error: 'Sin permisos' });
            }

            const { chat_jid, session_id, user_id, notes } = req.body;

            if (!chat_jid || !session_id || !user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'chat_jid, session_id y user_id son requeridos'
                });
            }

            const connection = await pool.getConnection();
            try {
                // Verificar si ya está asignado
                const [existing] = await connection.execute(`
                    SELECT id FROM chat_assignments 
                    WHERE chat_jid = ? AND session_id = ? AND status = 'active'
                `, [chat_jid, session_id]);

                if (existing.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'El chat ya está asignado a un agente'
                    });
                }

                // Crear asignación
                const [result] = await connection.execute(`
                    INSERT INTO chat_assignments 
                    (chat_jid, session_id, user_id, assigned_by, notes, status)
                    VALUES (?, ?, ?, ?, ?, 'active')
                `, [chat_jid, session_id, user_id, req.user.id, notes || null]);

                // Actualizar assigned_user_id en mensajes
                await connection.execute(`
                    UPDATE messages 
                    SET assigned_user_id = ? 
                    WHERE chat_jid = ? AND session_id = ?
                `, [user_id, chat_jid, session_id]);

                console.log(`✅ Chat ${chat_jid} asignado a usuario ${user_id}`);

                res.json({
                    success: true,
                    message: 'Chat asignado correctamente',
                    assignment_id: result.insertId
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error asignando chat:', error);
            res.status(500).json({ success: false, error: 'Error asignando chat' });
        }
    });

    // Transferir chat a otro agente
    app.post('/api/chats/transfer', authenticateToken, async (req, res) => {
        try {
            const { session_id, chat_jid, to_user_id, from_user_id, reason, note } = req.body;

            // Use 'note' if provided, otherwise 'reason', otherwise default
            const transferReason = note || reason || 'Transferencia de chat';

            if (!chat_jid || !session_id || !to_user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Datos incompletos. Se requiere: chat_jid, session_id, to_user_id'
                });
            }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                // Cerrar asignación actual si existe
                await connection.execute(`
                        UPDATE chat_assignments 
                        SET status = 'transferred'
                        WHERE chat_jid = ? AND session_id = ? AND status = 'active'
                    `, [chat_jid, session_id]);

                // Crear nueva asignación con status 'pending' para indicar nueva transferencia
                await connection.execute(`
                        INSERT INTO chat_assignments 
                        (chat_jid, session_id, user_id, assigned_by, status)
                        VALUES (?, ?, ?, ?, 'pending')
                    `, [chat_jid, session_id, to_user_id, req.user.dbId]);

                // Registrar transferencia
                await connection.execute(`
                        INSERT INTO chat_transfers 
                        (chat_jid, session_id, from_user_id, to_user_id, transferred_by, reason)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [chat_jid, session_id, from_user_id || null, to_user_id, req.user.dbId, transferReason]);

                await connection.commit();

                console.log(`✅ Chat ${chat_jid} transferido a usuario ${to_user_id} por ${req.user.name}`);

                // Emitir eventos Socket.IO para notificar al agente
                try {
                    const io = app.get('io');
                    if (io) {
                        // Obtener nombre del contacto para la notificación
                        const [contactInfo] = await connection.execute(`
                                SELECT COALESCE(c.name, cg.name, SUBSTRING_INDEX(?, '@', 1)) as contact_name
                                FROM (SELECT 1) as dummy
                                LEFT JOIN contacts c ON c.jid = ? AND c.session_id = ?
                                LEFT JOIN contact_groups cg ON cg.jid = ? AND cg.session_id = ?
                                LIMIT 1
                            `, [chat_jid, chat_jid, session_id, chat_jid, session_id]);

                        const chatName = contactInfo[0]?.contact_name || chat_jid.replace('@s.whatsapp.net', '');

                        const eventData = {
                            chatJid: chat_jid,
                            chatName: chatName,
                            sessionId: session_id,
                            agentId: to_user_id,
                            assignedBy: req.user.name,
                            assignedById: req.user.id,
                            timestamp: new Date().toISOString(),
                            note: transferReason // Include note for frontend display
                        };


                        // Emitir múltiples eventos para asegurar que el frontend los capture
                        io.emit('chat_transferred', eventData); // Evento general
                        io.emit(`agent-${to_user_id}-new-chat`, eventData); // Evento específico del agente
                        io.emit('chat:assigned', eventData); // Evento alternativo
                        io.emit('chat-assignment-changed', eventData); // Evento de cambio

                        console.log(`📡 Eventos de transferencia emitidos para agente ${to_user_id} (chat: ${chatName})`);
                    }
                } catch (ioError) {
                    console.warn('⚠️ Error emitiendo evento Socket.IO:', ioError);
                }

                res.json({
                    success: true,
                    message: 'Chat transferido exitosamente al agente'
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error transfiriendo chat:', error);
            res.status(500).json({ success: false, error: 'Error transfiriendo chat' });
        }
    });

    // Cerrar/completar chat
    app.post('/api/chats/close', authenticateToken, async (req, res) => {
        try {
            const { chat_jid, session_id } = req.body;

            const connection = await pool.getConnection();
            try {
                await connection.execute(`
                    UPDATE chat_assignments 
                    SET status = 'closed', completed_at = NOW()
                    WHERE chat_jid = ? AND session_id = ? AND status = 'active'
                `, [chat_jid, session_id]);

                // Obtener nombre del contacto
                const [contactInfo] = await connection.execute(`
                    SELECT COALESCE(c.name, cg.name, SUBSTRING_INDEX(?, '@', 1)) as contact_name
                    FROM (SELECT 1) as dummy
                    LEFT JOIN contacts c ON c.jid = ? AND c.session_id = ?
                    LEFT JOIN contact_groups cg ON cg.jid = ? AND cg.session_id = ?
                    LIMIT 1
                `, [chat_jid, chat_jid, session_id, chat_jid, session_id]);

                const chatName = contactInfo[0]?.contact_name || chat_jid.replace('@s.whatsapp.net', '');

                // Insertar mensaje de sistema
                const systemMessageId = 'SYS-CLOSE-' + Date.now();
                const systemContent = `🛑 Conversación finalizada por ${req.user.name}`;

                await connection.execute(`
                    INSERT INTO messages 
                    (id, session_id, chat_jid, sender, content, timestamp, from_me, status, type)
                    VALUES (?, ?, ?, ?, ?, ?, 1, 'sent', 'system')
                `, [systemMessageId, session_id, chat_jid, 'system', systemContent, new Date()]);

                // Emitir mensaje de sistema
                const io = app.get('io');
                io.emit('message', {
                    id: systemMessageId,
                    session_id: session_id,
                    chatJid: chat_jid,
                    message: systemContent,
                    from: 'system',
                    type: 'system',
                    timestamp: new Date(),
                    isFromMe: true
                });

                // Emitir evento de cierre a la sala del admin
                const closeEventData = {
                    chatJid: chat_jid,
                    chatName: chatName,
                    sessionId: session_id,
                    closedBy: req.user.name,
                    closedById: req.user.id || req.user.dbId,
                    timestamp: new Date().toISOString(),
                    message: `${req.user.name} cerró la conversación con ${chatName}`
                };

                io.to(`session-${session_id}`).emit('conversation-closed', closeEventData);
                io.emit('chat-closed', { chatJid: chat_jid, by: req.user.name }); // Legacy event

                console.log(`✅ Chat ${chat_jid} cerrado por ${req.user.name}, evento emitido a session-${session_id}`);

                res.json({ success: true, message: 'Chat cerrado correctamente' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error cerrando chat:', error);
            res.status(500).json({ success: false, error: 'Error cerrando chat' });
        }
    });

    // ==================== ESTADÍSTICAS Y REPORTES ====================

    // Dashboard admin: estadísticas generales
    app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
        try {
            if (!['admin', 'supervisor'].includes(req.user.role)) {
                return res.status(403).json({ success: false, error: 'Sin permisos' });
            }

            const connection = await pool.getConnection();
            try {
                // Total de agentes
                const [agents] = await connection.execute(`
                    SELECT COUNT(*) as total FROM users WHERE role = 'agent' AND status = 'active'
                `);

                // Chats activos por agente
                const [activeChats] = await connection.execute(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        COUNT(ca.assignment_id) as active_chats,
                        SUM(COALESCE(ca.unread_count, 0)) as total_unread
                    FROM users u
                    LEFT JOIN v_agent_chats ca ON u.id = ca.user_id
                    WHERE u.role = 'agent' AND u.status = 'active'
                    GROUP BY u.id, u.name, u.email
                    ORDER BY active_chats DESC
                `);

                // Chats sin asignar
                const [unassigned] = await connection.execute(`
                    SELECT COUNT(DISTINCT c.jid) as total
                    FROM contacts c
                    WHERE NOT EXISTS (
                        SELECT 1 FROM chat_assignments ca 
                        WHERE ca.chat_jid = c.jid 
                        AND ca.session_id = c.session_id 
                        AND ca.status = 'active'
                    )
                    AND EXISTS (
                        SELECT 1 FROM messages m 
                        WHERE m.chat_jid = c.jid 
                        AND m.session_id = c.session_id
                    )
                `);

                // Mensajes hoy
                const [messagestoday] = await connection.execute(`
                    SELECT COUNT(*) as total 
                    FROM messages 
                    WHERE DATE(timestamp) = CURDATE()
                `);

                res.json({
                    success: true,
                    stats: {
                        total_agents: agents[0].total,
                        unassigned_chats: unassigned[0].total,
                        messages_today: messagestoday[0].total,
                        agents: activeChats
                    }
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo dashboard:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo estadísticas' });
        }
    });

    // Historial de chats por agente
    app.get('/api/admin/agent/:userId/history', authenticateToken, async (req, res) => {
        try {
            if (!['admin', 'supervisor'].includes(req.user.role)) {
                return res.status(403).json({ success: false, error: 'Sin permisos' });
            }

            const { userId } = req.params;
            const connection = await pool.getConnection();

            try {
                const [history] = await connection.execute(`
                    SELECT 
                        ca.*,
                        c.name as contact_name,
                        c.avatar_url,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND m.session_id = ca.session_id
                         AND m.timestamp BETWEEN ca.assigned_at AND COALESCE(ca.completed_at, NOW())) as messages_count
                    FROM chat_assignments ca
                    LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                    WHERE ca.user_id = ?
                    ORDER BY ca.assigned_at DESC
                `, [userId]);

                res.json({ success: true, history });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo historial:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo historial' });
        }
    });

    // ==================== SOLICITUDES DE TRANSFERENCIA ====================

    // Obtener solicitudes de transferencia pendientes para un agente
    app.get('/api/transfer-requests/:userId', authenticateToken, async (req, res) => {
        try {
            const { userId } = req.params;

            // Verificar que el usuario puede ver sus propias solicitudes o es admin
            if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: 'No autorizado' });
            }

            const connection = await pool.getConnection();
            try {
                const [requests] = await connection.execute(`
                    SELECT 
                        tr.*,
                        c.name as contact_name,
                        uf.name as from_agent_name,
                        ut.name as to_agent_name
                    FROM transfer_requests tr
                    LEFT JOIN contacts c ON tr.chat_jid = c.jid AND tr.session_id = c.session_id
                    LEFT JOIN users uf ON tr.from_user_id = uf.id
                    LEFT JOIN users ut ON tr.to_user_id = ut.id
                    WHERE tr.to_user_id = ? AND tr.status = 'pending'
                    ORDER BY tr.created_at DESC
                `, [userId]);

                res.json({ success: true, requests });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo solicitudes:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo solicitudes' });
        }
    });

    // Responder a solicitud de transferencia
    app.post('/api/transfer-requests/:requestId/respond', authenticateToken, async (req, res) => {
        try {
            const { requestId } = req.params;
            const { accept } = req.body;

            const connection = await pool.getConnection();
            try {
                // Obtener la solicitud
                const [requests] = await connection.execute(
                    'SELECT * FROM transfer_requests WHERE id = ?',
                    [requestId]
                );

                if (requests.length === 0) {
                    return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
                }

                const request = requests[0];

                // Verificar que el usuario es el destinatario
                if (req.user.id !== request.to_user_id) {
                    return res.status(403).json({ success: false, error: 'No autorizado' });
                }

                await connection.beginTransaction();

                if (accept) {
                    // Aceptar: Actualizar asignación del chat
                    await connection.execute(`
                        UPDATE chat_assignments 
                        SET status = 'transferred', completed_at = NOW()
                        WHERE chat_jid = ? AND session_id = ? AND user_id = ? AND status = 'active'
                    `, [request.chat_jid, request.session_id, request.from_user_id]);

                    // Crear nueva asignación
                    await connection.execute(`
                        INSERT INTO chat_assignments 
                        (chat_jid, session_id, user_id, assigned_by, notes, status)
                        VALUES (?, ?, ?, ?, ?, 'active')
                    `, [
                        request.chat_jid,
                        request.session_id,
                        request.to_user_id,
                        request.from_user_id,
                        'Transferido por aceptación de solicitud'
                    ]);

                    // Registrar en historial
                    await connection.execute(`
                        INSERT INTO chat_transfers 
                        (chat_jid, session_id, from_user_id, to_user_id, transferred_by, reason)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        request.chat_jid,
                        request.session_id,
                        request.from_user_id,
                        request.to_user_id,
                        request.from_user_id,
                        `Aceptada: ${request.reason}`
                    ]);

                    // Actualizar estado de la solicitud
                    await connection.execute(
                        'UPDATE transfer_requests SET status = ?, responded_at = NOW() WHERE id = ?',
                        ['accepted', requestId]
                    );

                    await connection.commit();

                    // Insertar mensaje de sistema
                    const systemMessageId = 'SYS-ACC-' + Date.now();
                    const systemContent = `✅ Solicitud de transferencia aceptada por ${req.user.name}`;

                    /* Se debe insertar fuera de la transacción anterior si ya se commiteó, o idealmente dentro. 
                       Aquí lo hacemos después para simplificar, ya que la asignación es lo crítico */
                    await pool.execute(`
                        INSERT INTO messages 
                        (id, session_id, chat_jid, sender, content, timestamp, from_me, status, type)
                        VALUES (?, ?, ?, ?, ?, ?, 1, 'sent', 'system')
                    `, [systemMessageId, request.session_id, request.chat_jid, 'system', systemContent, new Date()]);

                    // Notificar cambios
                    const io = app.get('io');
                    io.emit('transfer-request-update', {
                        requestId,
                        status: 'accepted',
                        chatJid: request.chat_jid,
                        by: req.user.name
                    });

                    // Emitir mensaje de sistema
                    io.emit('message', {
                        id: systemMessageId,
                        session_id: request.session_id,
                        chatJid: request.chat_jid,
                        message: systemContent,
                        from: 'system',
                        type: 'system',
                        timestamp: new Date(),
                        isFromMe: true
                    });

                    res.json({ success: true, message: 'Chat aceptado y transferido' });
                } else {
                    // Rechazar: Solo actualizar estado de la solicitud
                    await connection.execute(
                        'UPDATE transfer_requests SET status = ?, responded_at = NOW() WHERE id = ?',
                        ['rejected', requestId]
                    );

                    await connection.commit();

                    // Insertar mensaje de sistema
                    const systemMessageId = 'SYS-REJ-' + Date.now();
                    const systemContent = `🚫 Solicitud de transferencia rechazada por ${req.user.name}`;

                    await pool.execute(`
                        INSERT INTO messages 
                        (id, session_id, chat_jid, sender, content, timestamp, from_me, status, type)
                        VALUES (?, ?, ?, ?, ?, ?, 1, 'sent', 'system')
                    `, [systemMessageId, request.session_id, request.chat_jid, 'system', systemContent, new Date()]);

                    // Notificar cambios
                    const io = app.get('io');
                    io.emit('transfer-request-update', {
                        requestId,
                        status: 'rejected',
                        chatJid: request.chat_jid,
                        by: req.user.name
                    });

                    // Emitir mensaje de sistema
                    io.emit('message', {
                        id: systemMessageId,
                        session_id: request.session_id,
                        chatJid: request.chat_jid,
                        message: systemContent,
                        from: 'system',
                        type: 'system',
                        timestamp: new Date(),
                        isFromMe: true
                    });

                    res.json({ success: true, message: 'Solicitud rechazada' });
                }
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error respondiendo solicitud:', error);
            res.status(500).json({ success: false, error: 'Error procesando respuesta' });
        }
    });

    // Modificar endpoint de transferencia para soportar solicitudes
    app.post('/api/chats/transfer-with-request', authenticateToken, async (req, res) => {
        try {
            const { chat_jid, session_id, from_user_id, to_user_id, reason, request_acceptance } = req.body;

            if (!chat_jid || !session_id || !to_user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Faltan datos requeridos'
                });
            }

            const connection = await pool.getConnection();
            try {
                // Verificar que el chat esté asignado al usuario origen
                const [assignments] = await connection.execute(
                    'SELECT * FROM chat_assignments WHERE chat_jid = ? AND session_id = ? AND user_id = ? AND status = ?',
                    [chat_jid, session_id, from_user_id || req.user.id, 'active']
                );

                if (assignments.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'El chat no está asignado al usuario origen'
                    });
                }

                if (request_acceptance) {
                    // Crear solicitud de transferencia
                    const [result] = await connection.execute(`
                        INSERT INTO transfer_requests 
                        (chat_jid, session_id, from_user_id, to_user_id, reason, status)
                        VALUES (?, ?, ?, ?, ?, 'pending')
                    `, [
                        chat_jid,
                        session_id,
                        from_user_id || req.user.id,
                        to_user_id,
                        reason || 'Transferencia solicitada'
                    ]);

                    res.json({
                        success: true,
                        message: 'Solicitud de transferencia enviada',
                        request_id: result.insertId
                    });

                    // Notificar al agente destino
                    const io = app.get('io');
                    const [fromUser] = await connection.execute('SELECT name FROM users WHERE id = ?', [from_user_id || req.user.id]);
                    const requestData = {
                        id: result.insertId,
                        chatJid: chat_jid,
                        sessionId: session_id,
                        fromUserName: fromUser[0]?.name || 'Admin',
                        reason: reason || 'Transferencia solicitada',
                        timestamp: new Date()
                    };

                    console.log(`📡 Emitiendo incoming-transfer-request a agente ${to_user_id}`);
                    io.emit(`agent-${to_user_id}-transfer-request`, requestData);

                } else {
                    // Transferencia directa (admin/supervisor)
                    await connection.beginTransaction();

                    await connection.execute(`
                        UPDATE chat_assignments 
                        SET status = 'transferred', completed_at = NOW()
                        WHERE chat_jid = ? AND session_id = ? AND status = 'active'
                    `, [chat_jid, session_id]);

                    await connection.execute(`
                        INSERT INTO chat_assignments 
                        (chat_jid, session_id, user_id, assigned_by, notes)
                        VALUES (?, ?, ?, ?, 'Transferencia directa')
                    `, [chat_jid, session_id, to_user_id, req.user.id]);

                    const transferReason = reason || 'Transferencia directa';

                    // Registrar transferencia
                    await connection.execute(`
                        INSERT INTO chat_transfers 
                        (chat_jid, session_id, from_user_id, to_user_id, transferred_by, reason)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [chat_jid, session_id, from_user_id, to_user_id, req.user.dbId, transferReason]);

                    // Insertar mensaje de sistema en el chat
                    // Usamos un ID random para el mensaje
                    const systemMessageId = 'SYS-' + Date.now();
                    const systemMessageContent = `🔄 Chat transferido por administración.\nNota: ${transferReason}`;

                    // Intentar insertar mensaje visible en el chat localmente
                    await connection.execute(`
                    INSERT INTO messages 
                    (id, session_id, chat_jid, sender, content, timestamp, from_me, status, type)
                    VALUES (?, ?, ?, ?, ?, ?, 1, 'sent', 'chat')
                `, [systemMessageId, session_id, chat_jid, 'system', systemMessageContent, new Date(), 'chat']);


                    await connection.commit();

                    // Obtener datos del destino para notificar
                    const [targetUser] = await connection.execute('SELECT * FROM users WHERE id = ?', [to_user_id]);
                    const targetAgent = targetUser[0];

                    const eventData = {
                        chatJid: chat_jid,
                        sessionId: session_id,
                        agentId: to_user_id,
                        assignedBy: req.user.id,
                        assignedById: req.user.dbId,
                        note: transferReason // Incluir la nota en el evento
                    };

                    const io = app.get('io');
                    io.emit('chat_transferred', eventData); // Evento general
                    io.emit(`agent-${to_user_id}-new-chat`, eventData); // Evento específico del agente
                    io.emit('chat:assigned', eventData); // Evento alternativo
                    io.emit('chat-assignment-changed', eventData); // Evento de cambio

                    // 🆕 Emitir al room específico del agente para notificación inmediata
                    io.to(`agent-${to_user_id}`).emit('chat-assigned', {
                        chatJid: chat_jid,
                        sessionId: session_id,
                        reason: transferReason,
                        assignedBy: req.user.name || 'Admin',
                        timestamp: new Date()
                    });

                    // Emitir nuevo mensaje al socket para que aparezca en tiempo real
                    io.emit('message', {
                        id: systemMessageId,
                        session_id: session_id,
                        chat_jid: chat_jid,
                        sender: 'system',
                        content: systemMessageContent,
                        timestamp: new Date().toISOString(),
                        from_me: true,
                        type: 'chat'
                    });

                    res.json({ success: true, message: 'Chat transferido correctamente' });
                } // Close else block

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error transfiriendo chat:', error);
            res.status(500).json({ success: false, error: 'Error transfiriendo chat' });
        }
    });

    // 🆕 Cerrar chat asignado (Agente cierra conversación)
    app.post('/api/chats/:chatJid/close', authenticateToken, async (req, res) => {
        const { chatJid } = req.params;
        const { sessionId, reason } = req.body;
        const agentId = req.user.dbId; // ID numérico de la tabla users

        if (!agentId) {
            return res.status(400).json({ success: false, error: 'ID de agente no identificado' });
        }

        try {
            const connection = await pool.getConnection();
            try {
                // 1. Actualizar estado en chat_assignments
                const [result] = await connection.execute(
                    `UPDATE chat_assignments 
                     SET status = 'closed', closed_at = NOW(), close_reason = ?
                     WHERE chat_jid = ? AND user_id = ? AND status != 'closed'`,
                    [reason || 'Cerrado por agente', chatJid, agentId]
                );

                // 2. Obtener datos del contacto para la notificación
                const [chatData] = await connection.execute(
                    `SELECT name, notify_name FROM contacts WHERE jid = ? LIMIT 1`,
                    [chatJid]
                );
                const contactName = chatData[0]?.name || chatData[0]?.notify_name || chatJid.split('@')[0];

                // 3. Notificar al Admin via Socket.IO
                const io = app.get('io');

                const eventPayload = {
                    chatJid,
                    agentName: req.user.name,
                    agentId: req.user.id,
                    contactName,
                    reason: reason || 'Cerrado manualmente',
                    sessionId,
                    timestamp: new Date()
                };

                // Evento global y específico de sesión
                io.emit('chat-closed-by-agent', eventPayload);
                if (sessionId) {
                    io.to(`session-${sessionId}`).emit('chat-closed-by-agent', eventPayload);
                }

                res.json({ success: true, message: 'Chat cerrado exitosamente' });

            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error cerrando chat:', error);
            res.status(500).json({ success: false, error: 'Error interno cerrando chat' });
        }
    });

    // Nuevo: Obtener chats activos de un agente
    app.get('/api/agents/:id/active-chats', authenticateToken, async (req, res) => {
        try {
            const agentId = req.params.id;
            const { sessionId } = req.query; // Puede venir el UUID o el Phone
            const connection = await pool.getConnection();

            try {
                // 🚀 Obtener TODOS los posibles identificadores de sesión (UUID y Phone)
                let sessionIds = [];
                if (sessionId) {
                    sessionIds.push(sessionId);

                    // Buscar el otro par (si enviaron UUID, buscar Phone; si enviaron Phone, buscar UUID)
                    const [sessionInfo] = await connection.execute(
                        `SELECT session_id, phone FROM user_sessions WHERE session_id = ? OR phone = ? LIMIT 1`,
                        [sessionId, sessionId]
                    );

                    if (sessionInfo.length > 0) {
                        if (sessionInfo[0].session_id) sessionIds.push(sessionInfo[0].session_id);
                        if (sessionInfo[0].phone) sessionIds.push(sessionInfo[0].phone);
                    }
                }

                // Eliminar duplicados
                sessionIds = [...new Set(sessionIds)];

                let query = `
                    SELECT 
                        ca.id as assignment_id,
                        ca.chat_jid,
                        ca.session_id,
                        COALESCE(c.name, cg.name, SUBSTRING_INDEX(ca.chat_jid, '@', 1)) as chat_name,
                        COALESCE(c.avatar_url, cg.avatar_url, '') as avatar,
                        ca.assigned_at,
                        ca.status,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND (m.session_id = ca.session_id OR m.session_id IN (SELECT session_id FROM user_sessions WHERE phone = ca.session_id))
                         AND m.from_me = 0 
                         AND (m.is_read = 0 OR m.is_read IS NULL)) as unread_count,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND (m.session_id = ca.session_id OR m.session_id IN (SELECT session_id FROM user_sessions WHERE phone = ca.session_id))
                         AND m.from_me = 1) as sent_count,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND (m.session_id = ca.session_id OR m.session_id IN (SELECT session_id FROM user_sessions WHERE phone = ca.session_id))
                         AND m.from_me = 0) as received_count,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND (m.session_id = ca.session_id OR m.session_id IN (SELECT session_id FROM user_sessions WHERE phone = ca.session_id))
                         AND m.from_me = 1 
                         AND (m.status = 'sent' OR m.status = 'delivered')) as delivered_count,
                        (SELECT COUNT(*) FROM messages m 
                         WHERE m.chat_jid = ca.chat_jid 
                         AND (m.session_id = ca.session_id OR m.session_id IN (SELECT session_id FROM user_sessions WHERE phone = ca.session_id))
                         AND m.from_me = 1 
                         AND (m.status = 'read' OR m.status = 'seen')) as read_count
                    FROM chat_assignments ca
                    LEFT JOIN contacts c ON c.jid = ca.chat_jid AND (c.session_id = ca.session_id OR c.session_id IN (SELECT phone FROM user_sessions WHERE session_id = ca.session_id))
                    LEFT JOIN contact_groups cg ON cg.jid = ca.chat_jid AND (cg.session_id = ca.session_id OR cg.session_id IN (SELECT phone FROM user_sessions WHERE session_id = ca.session_id))
                    WHERE ca.user_id = ? AND ca.status = 'active'
                `;

                const params = [agentId];

                if (sessionIds.length > 0) {
                    query += ` AND ca.session_id IN (${sessionIds.map(() => '?').join(',')})`;
                    params.push(...sessionIds);
                }

                query += ' ORDER BY ca.assigned_at DESC';

                const [rows] = await connection.execute(query, params);

                console.log(`[ACTIVE-CHATS] ✅ Agente ${agentId} para sessionIds [${sessionIds.join(', ')}] tiene ${rows.length} chats activos`);
                res.json({ success: true, chats: rows });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[ACTIVE-CHATS] Error obteniendo chats activos:', error);
            res.status(500).json({ success: false, error: 'Error interno' });
        }
    });

    // Nuevo: Revocar asignación (Admin cancela transferencia)
    app.post('/api/chats/assignment/revoke', authenticateToken, async (req, res) => {
        try {
            // Solo admins deberían poder hacer esto, o el propio agente
            // Por simplicidad, asumimos auth token checks
            const { assignment_id, chat_jid, agent_id } = req.body;

            const connection = await pool.getConnection();
            try {
                await connection.execute(`
                    UPDATE chat_assignments 
                    SET status = 'revoked' 
                    WHERE id = ? OR (chat_jid = ? AND user_id = ? AND status = 'active')
                `, [assignment_id, chat_jid, agent_id]);

                res.json({ success: true, message: 'Asignación revocada' });

                // Notificar cambio
                const io = app.get('io');
                io.emit('chat-assignment-changed', { chatJid: chat_jid, agentId: agent_id });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error revocando chat:', error);
            res.status(500).json({ success: false, error: 'Error revocando chat' });
        }
    });

    // ==================== ENDPOINT PARA OBTENER AGENTES DISPONIBLES ====================

    app.get('/api/users/agents', authenticateToken, async (req, res) => {
        try {
            const connection = await pool.getConnection();
            try {
                const [agents] = await connection.execute(`
                    SELECT id, name, email, role, department, status
                    FROM users 
                    WHERE role IN ('agent', 'supervisor', 'admin') 
                    AND status = 'active'
                    ORDER BY name ASC
                `);

                console.log(`✅ Agentes disponibles solicitados: ${agents.length}`);
                res.json({ success: true, agents });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo agentes:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo agentes' });
        }
    });

    // ==================== ENDPOINT PARA ENVIAR MENSAJES DE AGENTES ====================

    app.post('/api/agent/messages/send', authenticateToken, async (req, res) => {
        try {
            const { sessionId, chatJid, message } = req.body;
            const agentId = req.user.id;

            console.log('[AGENT-SEND] 📤 Solicitud de envío:', {
                agentId,
                sessionId,
                chatJid,
                message: message?.substring(0, 50) + '...'
            });

            if (!sessionId || !chatJid || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Faltan parámetros: sessionId, chatJid, message'
                });
            }

            // Verificar que el chat está asignado al agente
            const connection = await pool.getConnection();
            try {
                const [assignments] = await connection.execute(
                    'SELECT * FROM chat_assignments WHERE chat_jid = ? AND session_id = ? AND user_id = ? AND status = "active"',
                    [chatJid, sessionId, agentId]
                );

                if (assignments.length === 0) {
                    console.log('[AGENT-SEND] ❌ Chat no asignado al agente');
                    return res.status(403).json({
                        success: false,
                        error: 'No tienes permiso para enviar mensajes a este chat'
                    });
                }

                console.log('[AGENT-SEND] ✅ Chat asignado verificado, delegando envío...');
                connection.release();
            } catch (error) {
                connection.release();
                throw error;
            }

            // Enviar el mensaje usando el endpoint interno de envío
            // (esto reutiliza la lógica existente de envío)
            res.json({
                success: true,
                message: 'Solicitud recibida',
                useMainEndpoint: true
            });

        } catch (error) {
            console.error('[AGENT-SEND] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error procesando envío de mensaje'
            });
        }
    });

    // ==================== MENSAJES ====================

    // Obtener mensajes de un chat específico
    app.get('/api/messages/:sessionId/:chatJid', authenticateToken, async (req, res) => {
        try {
            const { sessionId, chatJid } = req.params;
            const { limit = 50, offset = 0, dateFilter, beforeTimestamp } = req.query;

            console.log('[MESSAGES-GET] 📥 Obteniendo mensajes:', { sessionId, chatJid, limit, offset, dateFilter, beforeTimestamp });

            const connection = await pool.getConnection();
            try {
                // ✅ Obtener ownerSessionId y phoneNumber
                const ownerSessionId = await getOwnerSessionId(sessionId);
                const phoneNumber = await getUserPhoneNumber(sessionId);

                let query = `
                    SELECT
                        m.id,
                        m.chat_jid,
                        m.sender_jid,
                        m.from_me,
                        m.message_type,
                        m.text_content,
                        m.media_url,
                        m.caption,
                        m.timestamp,
                        m.status,
                        m.sender_name,
                        m.sender_avatar,
                        m.agent_id,
                        m.agent_name
                    FROM messages m
                    WHERE (m.session_id = ? AND (m.phone = ? OR m.phone IS NULL))
                      AND m.chat_jid = ?
                `;

                const params = [ownerSessionId, phoneNumber, chatJid];

                // Filtro por fecha (hoy)
                if (dateFilter === 'today') {
                    query += ` AND DATE(m.timestamp) = CURDATE()`;
                }

                // Paginación por cursor (mensajes anteriores a...)
                if (beforeTimestamp) {
                    query += ` AND m.timestamp < ?`;
                    params.push(new Date(beforeTimestamp));
                }

                query += ` ORDER BY m.timestamp DESC LIMIT ?`;
                params.push(parseInt(limit) || 50);

                // Si no es cursor, usar offset (para compatibilidad o primera carga sin filtro fecha)
                if (!beforeTimestamp && !dateFilter) {
                    query += ` OFFSET ?`;
                    params.push(parseInt(offset) || 0);
                }

                const [messages] = await connection.execute(query, params);

                console.log('[MESSAGES-GET] ✅ Mensajes obtenidos:', messages ? messages.length : 0);

                res.json({
                    success: true,
                    messages: (messages || []).reverse(), // Invertir para orden cronológico
                    count: messages ? messages.length : 0
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[MESSAGES-GET] ❌ Error obteniendo mensajes:', error.message);
            // Fallback: devolver array vacío en lugar de 500
            res.json({
                success: true,
                messages: [],
                count: 0
            });
        }
    });

    // NUEVO: Endpoint simplificado para obtener chats del agente por ID
    // Endpoint para obtener chats de un agente - VERSIÓN ULTRA-SIMPLE
    app.get('/api/agents/:agentId/chats', async (req, res) => {
        let connection;
        try {
            const agentId = parseInt(req.params.agentId);
            const { sessionId, dateFilter, limit = 500, offset = 0 } = req.query;

            if (!agentId || isNaN(agentId)) {
                return res.status(400).json({ success: false, error: 'AgentId inválido' });
            }

            if (!sessionId) {
                return res.status(400).json({ success: false, error: 'SessionId es requerido' });
            }

            if (!pool) {
                return res.json({ success: true, sessionId, chats: [], count: 0 });
            }

            try {
                connection = await pool.getConnection();
                if (!connection) {
                    console.error('[AGENT-CHATS] Pool connection returned undefined');
                    return res.json({ success: true, sessionId, chats: [], count: 0 });
                }
            } catch (connErr) {
                console.error('[AGENT-CHATS] Failed to get connection:', connErr.message);
                return res.json({ success: true, sessionId, chats: [], count: 0 });
            }

            // Build date filter - FILTRAR POR FECHA DE ASIGNACIÓN (más flexible)
            let dateWhereClause = '';
            if (dateFilter === 'today') {
                dateWhereClause = 'AND DATE(ca.assigned_at) = CURDATE()';
            } else if (dateFilter === 'limit_24h') {
                dateWhereClause = 'AND ca.assigned_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
            }
            // Si no hay filtro de fecha, mostrar todos los chats asignados

            console.log(`[AGENT-CHATS] 📥 GET /api/agents/${agentId}/chats - sessionId: ${sessionId}, dateFilter: ${dateFilter}, dateWhereClause: "${dateWhereClause || 'SIN FILTRO'}"`);

            try {
                // ✅ FIXED: Removemos la dependencia de ownerSessionId/phoneNumber
                // Los agentes deben ver TODOS sus chats asignados sin importar el session_id

                // Query mejorada con LEFT JOIN para incluir chats sin mensajes
                const [chats] = await connection.execute(
                    `SELECT
                        ca.chat_jid as id,
                        ca.chat_jid as chatJid,
                        ca.session_id,
                        ca.status,
                        ca.assigned_at as assignedAt,
                        COALESCE(MAX(m.timestamp), ca.assigned_at) as lastMessageTime,
                        COALESCE(c.name, cg.name, SUBSTRING_INDEX(ca.chat_jid, '@', 1)) as name,
                        COALESCE(c.avatar_url, cg.avatar_url) as avatar,
                        COUNT(DISTINCT m.id) as message_count,
                        SUM(CASE WHEN m.from_me = 0 AND m.is_read = 0 THEN 1 ELSE 0 END) as unreadCount
                     FROM chat_assignments ca
                     LEFT JOIN messages m ON m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id
                     LEFT JOIN contacts c ON c.jid = ca.chat_jid AND c.session_id = ca.session_id
                     LEFT JOIN contact_groups cg ON cg.jid = ca.chat_jid AND cg.session_id = ca.session_id
                     WHERE ca.user_id = ?
                       AND ca.status IN ('pending', 'active')
                       ${dateWhereClause}
                     GROUP BY ca.chat_jid, ca.session_id, ca.status, ca.assigned_at, c.name, cg.name, c.avatar_url, cg.avatar_url
                     ORDER BY ca.status = 'pending' DESC, lastMessageTime DESC
                     LIMIT ? OFFSET ?`,
                    [agentId, parseInt(limit), parseInt(offset)]
                );

                console.log(`[AGENT-CHATS] ✅ Retornando ${chats ? chats.length : 0} chats para agente ${agentId} (status: pending/active)`);

                // Procesar chats - ahora incluyen nombre, avatar y otros datos
                const processedChats = (chats || []).map(chat => ({
                    id: chat.id,
                    chatJid: chat.chatJid,
                    name: chat.name || chat.chatJid.split('@')[0] || 'Sin nombre',
                    avatar: chat.avatar || '',
                    isGroup: chat.chatJid.includes('@g.us'),
                    status: chat.status,
                    assignedAt: chat.assignedAt,
                    lastMessageTime: chat.lastMessageTime,
                    lastMessage: '', // Se puede agregar después si es necesario
                    unreadCount: parseInt(chat.unreadCount) || 0,
                    message_count: parseInt(chat.message_count) || 0,
                    sessionId: chat.session_id
                }));

                res.json({
                    success: true,
                    sessionId: sessionId,
                    chats: processedChats,
                    count: processedChats.length
                });
            } catch (execErr) {
                console.error('[AGENT-CHATS] Query execution error:', execErr.message, execErr.code);
                res.json({
                    success: true,
                    sessionId: sessionId,
                    chats: [],
                    count: 0
                });
            }
        } catch (error) {
            console.error('[AGENT-CHATS] Outer error:', error.message, error.stack);
            res.status(500).json({
                success: false,
                error: 'Error fetching agent chats',
                chats: [],
                count: 0
            });
        } finally {
            if (connection) {
                try {
                    connection.release();
                } catch (releaseErr) {
                    console.error('[AGENT-CHATS] Error releasing connection:', releaseErr.message);
                }
            }
        }
    });

    // Endpoint para marcar chat como activo (cuando el agente abre un chat pendiente)
    app.post('/api/chats/mark-active', authenticateToken, async (req, res) => {
        try {
            const { chat_jid, session_id } = req.body;
            const agentId = req.user.id;

            if (!chat_jid || !session_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere chat_jid y session_id'
                });
            }

            const connection = await pool.getConnection();
            try {
                // Actualizar status de pending a active
                const [result] = await connection.execute(`
                    UPDATE chat_assignments 
                    SET status = 'active'
                    WHERE chat_jid = ? 
                    AND session_id = ? 
                    AND user_id = ? 
                    AND status = 'pending'
                `, [chat_jid, session_id, agentId]);

                if (result.affectedRows > 0) {
                    console.log(`✅ Chat ${chat_jid} marcado como activo por agente ${agentId}`);
                    res.json({ success: true, message: 'Chat marcado como activo' });
                } else {
                    res.json({ success: false, message: 'Chat no encontrado o ya activo' });
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('❌ Error marcando chat como activo:', error);
            res.status(500).json({
                success: false,
                error: 'Error al marcar chat como activo'
            });
        }
    });

    console.log('✅ Sistema multi-agente endpoints cargados correctamente');
};
