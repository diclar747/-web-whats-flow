// ============================================
// SISTEMA MULTI-AGENTE - ENDPOINTS BACKEND
// Gestión completa de roles, permisos y asignación de chats
// ============================================

module.exports = function (app, pool) {
    console.log('📢 [MULTIAGENT] Cargando endpoints de multi-agente...');


    app.get('/api/health-multiagent', (req, res) => {
        res.json({ success: true, message: 'Multiagent module loaded' });
    });

    // Middleware para verificar autenticación (compatible con sistema base64)
    const authenticateToken = async (req, res, next) => {
        const authHeader = req.headers['authorization'];
        console.log(`[AUTH-DEBUG] Header received: ${authHeader}`); // DEBUG LOG
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.log('[AUTH-DEBUG] No token provided');
            return res.status(401).json({ success: false, error: 'Token requerido' });
        }

        try {
            // Primero intentar decodificar como JWT
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'whatsflow_jwt_secret';

            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                console.log(`[AUTH-DEBUG] JWT Decoded:`, decoded);

                // CASO ESPECIAL: ADMIN (Token basado en sesión/teléfono, no ID de tabla users)
                if (decoded.role === 'admin' && decoded.phone) {
                    console.log('[AUTH-DEBUG] Access granted to ADMIN');
                    // Intentar buscar ID numérico real si existe
                    // ... (Simplificación: Asumimos null para operaciones de BD si no es Agente)
                    req.user = {
                        id: 'admin_' + decoded.phone,
                        permissions_id: null, // Admin no tiene row, so NULL 
                        dbId: null, // Para FKs que requieran INT
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
                    const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [decoded.id]);
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
                    WHERE ca.user_id = ? AND ca.status = 'active'
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
                    res.json({ success: true, message: 'Chat aceptado y transferido' });
                } else {
                    // Rechazar: Solo actualizar estado de la solicitud
                    await connection.execute(
                        'UPDATE transfer_requests SET status = ?, responded_at = NOW() WHERE id = ?',
                        ['rejected', requestId]
                    );

                    await connection.commit();
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

    // Nuevo: Obtener chats activos de un agente
    app.get('/api/agents/:id/active-chats', authenticateToken, async (req, res) => {
        try {
            const agentId = req.params.id;
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.execute(`
                    SELECT 
                        ca.id as assignment_id,
                        ca.chat_jid,
                        c.name as chat_name,
                        ca.assigned_at
                    FROM chat_assignments ca
                    LEFT JOIN chats c ON c.id = ca.chat_jid
                    WHERE ca.user_id = ? AND ca.status = 'active'
                    ORDER BY ca.assigned_at DESC
                `, [agentId]);
                res.json({ success: true, chats: rows });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo chats activos:', error);
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
                // Obtener phoneNumber del sessionId
                const [sessionInfo] = await connection.execute(
                    `SELECT phone_number FROM user_sessions WHERE session_id = ? LIMIT 1`,
                    [sessionId]
                );
                const phoneNumber = sessionInfo[0]?.phone_number || null;

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
                        m.quoted_message_id,
                        c.name as contact_name,
                        c.avatar_url as contact_avatar
                    FROM messages m
                    LEFT JOIN contacts c ON m.sender_jid = c.jid AND c.session_id = ?
                    WHERE m.session_id = ? AND m.chat_jid = ?
                `;

                const params = [phoneNumber, sessionId, chatJid];

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
                params.push(parseInt(limit));

                // Si no es cursor, usar offset (para compatibilidad o primera carga sin filtro fecha)
                if (!beforeTimestamp && !dateFilter) {
                    query += ` OFFSET ?`;
                    params.push(parseInt(offset));
                }

                const [messages] = await connection.execute(query, params);

                console.log('[MESSAGES-GET] ✅ Mensajes obtenidos:', messages.length);

                res.json({
                    success: true,
                    messages: messages.reverse(), // Invertir para orden cronológico
                    count: messages.length
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[MESSAGES-GET] ❌ Error obteniendo mensajes:', error);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo mensajes',
                details: error.message
            });
        }
    });

    // NUEVO: Endpoint simplificado para obtener chats del agente por ID
    app.get('/api/agents/:agentId/chats', authenticateToken, async (req, res) => {
        try {
            const agentId = parseInt(req.params.agentId);
            const { sessionId } = req.query;

            // Verificar que el usuario tiene permiso (es el agente mismo o es admin/supervisor)
            if (req.user.id !== agentId && !['admin', 'supervisor'].includes(req.user.role)) {
                return res.status(403).json({ success: false, error: 'Sin permisos' });
            }

            const connection = await pool.getConnection();
            try {
                console.log('[AGENT-CHATS-BY-ID] 🔍 Agente:', agentId, 'SessionId:', sessionId);

                // IMPORTANTE: Resolver sessionId (UUID) a phoneNumber
                // En user_sessions: session_id es UUID (ej: "4cb89fbf75edf117")
                // En chat_assignments: session_id es phoneNumber (ej: "595985768793")
                let phoneNumberForQuery = sessionId;

                if (sessionId) {
                    // Intentar obtener phoneNumber desde user_sessions usando el UUID
                    const [sessionInfo] = await connection.execute(
                        `SELECT phone_number FROM user_sessions WHERE session_id = ? AND is_active = 1 LIMIT 1`,
                        [sessionId]
                    );

                    if (sessionInfo.length > 0) {
                        phoneNumberForQuery = sessionInfo[0].phone_number;
                        console.log('[AGENT-CHATS-BY-ID] ✅ SessionId UUID resuelto a phoneNumber:', phoneNumberForQuery);
                    } else {
                        // Si no se encuentra, asumir que sessionId ya es el phoneNumber
                        console.log('[AGENT-CHATS-BY-ID] ⚠️ No se encontró UUID, usando como phoneNumber:', sessionId);
                    }
                }

                // Obtener chats asignados con información completa
                let query = `
                    SELECT
                        ca.chat_jid as chatJid,
                        ca.session_id,
                        ca.user_id,
                        ca.assigned_at as assignedAt,
                        ca.status,
                        COALESCE(c.name, cg.name, SUBSTRING_INDEX(ca.chat_jid, '@', 1)) as name,
                        COALESCE(c.avatar_url, cg.avatar_url, '') as avatar,
                        COALESCE(c.is_group, cg.jid IS NOT NULL, 0) as isGroup,
                        (SELECT MAX(m.timestamp) FROM messages m
                         WHERE m.chat_jid = ca.chat_jid
                         AND m.session_id = ca.session_id) as lastMessageTimestamp,
                        (SELECT m.text_content FROM messages m
                         WHERE m.chat_jid = ca.chat_jid
                         AND m.session_id = ca.session_id
                         ORDER BY m.timestamp DESC LIMIT 1) as lastMessage,
                        (SELECT COUNT(*) FROM messages m
                         WHERE m.chat_jid = ca.chat_jid
                         AND m.session_id = ca.session_id
                         AND m.from_me = 0
                         AND (m.is_read = 0 OR m.is_read IS NULL)) as unreadCount
                    FROM chat_assignments ca
                    LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                    LEFT JOIN contact_groups cg ON ca.chat_jid = cg.jid AND ca.session_id = cg.session_id
                    WHERE ca.user_id = ? AND ca.status IN ('active', 'pending')
                `;

                const params = [agentId];

                if (phoneNumberForQuery) {
                    query += ' AND ca.session_id = ?';
                    params.push(phoneNumberForQuery);
                }

                query += ' ORDER BY lastMessageTimestamp DESC';

                console.log('[AGENT-CHATS-BY-ID] 📝 Query final:', query);
                console.log('[AGENT-CHATS-BY-ID] 📝 Params:', params);

                const [chats] = await connection.execute(query, params);

                console.log('[AGENT-CHATS-BY-ID] ✅ Chats encontrados:', chats.length);
                if (chats.length > 0) {
                    console.log('[AGENT-CHATS-BY-ID] 📋 Primer chat:', JSON.stringify(chats[0]));
                } else {
                    console.log('[AGENT-CHATS-BY-ID] ⚠️ No se encontraron chats');
                    // Verificar si hay assignments sin filtro de session_id
                    const [allAssignments] = await connection.execute(
                        'SELECT COUNT(*) as total FROM chat_assignments WHERE user_id = ? AND status = ?',
                        [agentId, 'active']
                    );
                    console.log('[AGENT-CHATS-BY-ID] 🔍 Total assignments sin filtro de session:', allAssignments[0].total);
                }

                // Retornar el sessionId UUID original para compatibilidad con frontend
                res.json({
                    success: true,
                    sessionId: sessionId, // Mantener el UUID original
                    chats: chats,
                    count: chats.length
                });

            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[AGENT-CHATS-BY-ID] ❌ Error:', error);
            try {
                const fs = require('fs');
                fs.appendFileSync('debug_error.log', `[${new Date().toISOString()}] Error in GET /api/agents/${req.params.agentId}/chats: ${error.message}\nStack: ${error.stack}\n`);
            } catch (err) {
                console.error('Error writing to debug log:', err);
            }
            res.status(500).json({
                success: false,
                error: 'Error obteniendo chats del agente',
                details: error.message
            });
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
