const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sendWhatsAppMessage } = require('./whatsapp-loader');

module.exports = function (app, pool) {

    // Importar middleware de autenticación
    const { authenticateToken } = require('./middleware/auth');
    const { checkActivePlan } = require('./middleware/checkActivePlan');

    // ==================== GESTIÓN DE AGENTES CON PRIVILEGIOS ====================

    /**
     * Obtener todos los agentes creados por el usuario actual
     * GET /api/agents/list
     */
    // Middleware flexible: Requiere JWT O sessionId válido
    const authenticateTokenOrSession = (req, res, next) => {
        try {
            console.log('[AGENTS-AUTH-DEBUG] Headers:', Object.keys(req.headers));
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            const sessionId = req.query.sessionId;

            console.log('[AGENTS-AUTH-DEBUG] authHeader:', authHeader ? 'present' : 'missing', 'token:', token ? 'present' : 'missing', 'sessionId:', sessionId);

            // Opción 1: JWT Token
            if (token) {
                try {
                    const { verifyToken } = require('./utils/tokenManager');
                    const user = verifyToken(token);
                    console.log('[AGENTS-AUTH] ✅ Token JWT verificado para:', user.email || user.phone);
                    req.user = user;
                    return next();
                } catch (err) {
                    console.log('[AGENTS-AUTH] ⚠️ JWT inválido:', err.message);
                }
            }

            // Opción 2: SessionId (QR/WhatsApp login)
            if (sessionId) {
                console.log('[AGENTS-AUTH] 📱 Usando sessionId para autenticación:', sessionId);
                // Crear usuario fake con el sessionId
                req.user = {
                    id: 'session_' + sessionId,
                    phone: sessionId,
                    email: null,
                    role: 'admin'
                };
                return next();
            }

            // Sin token ni sessionId
            return res.status(401).json({
                success: false,
                error: 'Token o SessionId requerido'
            });
        } catch (error) {
            console.error('[AGENTS-AUTH] Error:', error);
            return res.status(401).json({
                success: false,
                error: 'Error de autenticación'
            });
        }
    };

    app.get('/api/agents/list', authenticateTokenOrSession, async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const connection = await pool.getConnection();

            try {
                // El middleware authenticateToken ya verificó la autenticación
                // El usuario autenticado está disponible en req.user
                const user = req.user;

                console.log('[AGENTS-LIST] 🔍 Usuario autenticado:', {
                    id: user.id,
                    phone: user.phone,
                    email: user.email,
                    role: user.role
                });

                // Obtener identificador del admin (puede ser phone o email)
                // - Si login por QR: phone del admin
                // - Si login por email/password: email del admin
                const adminPhone = user.phone;
                const adminEmail = user.email;

                if (!adminPhone && !adminEmail) {
                    connection.release();
                    console.log('[AGENTS-LIST] ❌ Error: No se pudo obtener phone ni email del usuario autenticado');
                    return res.status(401).json({
                        success: false,
                        error: 'Usuario no válido'
                    });
                }

                // Obtener agentes del admin actual
                // Buscar donde admin_phone sea el phone O el email del admin
                const query = `
                    SELECT
                        id,
                        name,
                        email,
                        phone,
                        avatar_url,
                        status,
                        COALESCE(agent_status, 'offline') as agent_status,
                        last_activity,
                        COALESCE(max_concurrent_chats, 5) as max_concurrent_chats,
                        (
                            SELECT COUNT(*)
                            FROM chat_assignments ca
                            WHERE ca.user_id = users.id
                            AND ca.status = 'active'
                        ) as active_chats_count,
                        created_at,
                        updated_at
                    FROM users
                    WHERE role = 'agent'
                    AND (admin_phone = ? OR admin_phone = ? OR session_id = ?)
                    ORDER BY created_at DESC
                `;

                console.log('[AGENTS-LIST] 🔍 Ejecutando query para admin:', { phone: adminPhone, email: adminEmail, id: user.id });
                const [agents] = await connection.execute(query, [adminPhone || '', adminEmail || '', user.id || null]);
                console.log('✅ [AGENTS-LIST] Agentes obtenidos para admin', adminPhone + ':', agents.length);
                res.json({ success: true, agents });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo agentes:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo agentes' });
        }
    });

    /**
     * Crear nuevo agente con privilegios
     * POST /api/agents/create
     */
    app.post(['/api/agents/create', '/api/agents-create'], authenticateToken, checkActivePlan, async (req, res) => {
        try {
            console.log('🔍 [AGENT-CREATE] ===== INICIO DE PETICIÓN =====');
            console.log('🔍 [AGENT-CREATE] Headers:', {
                authorization: req.headers.authorization ? 'Present' : 'Missing',
                contentType: req.headers['content-type']
            });
            console.log('🔍 [AGENT-CREATE] Body recibido:', JSON.stringify(req.body, null, 2));

            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { name, email, password, phone, avatar_url, sendWhatsApp, permissions, sessionId: userSessionId } = req.body;

            console.log('🔍 [AGENT-CREATE] Campos extraídos:', {
                name: name || 'MISSING',
                email: email || 'MISSING',
                password: password ? 'PROVIDED' : 'NOT PROVIDED',
                phone: phone || 'NOT PROVIDED',
                avatar_url: avatar_url || 'NOT PROVIDED',
                sendWhatsApp: sendWhatsApp ? 'YES' : 'NO',
                sessionId: userSessionId || 'NOT PROVIDED'
            });

            if (!name || !email) {
                console.log('❌ [AGENT-CREATE] Validación fallida: name o email faltantes');
                return res.status(400).json({
                    success: false,
                    error: 'Nombre y email son requeridos',
                    received: { name: !!name, email: !!email }
                });
            }

            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                let adminPhone = null;
                let adminUserId = null; // ✅ NUEVO: ID del usuario admin

                // Intentar autenticación por JWT token
                const authHeader = req.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    try {
                        const token = authHeader.split(' ')[1];
                        const jwt = require('jsonwebtoken');
                        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'whatsflow_jwt_secret');

                        console.log('🔍 [AGENT-CREATE] JWT decodificado:', {
                            phone: decoded.phone,
                            role: decoded.role,
                            sessionId: decoded.sessionId
                        });

                        // ✅ El JWT contiene directamente el phone
                        if (decoded.phone) {
                            adminPhone = decoded.phone;
                            console.log('✅ [AGENT-CREATE] Autenticación por JWT exitosa. Admin:', adminPhone);

                            // ✅ NUEVO: Obtener el ID del usuario admin
                            const [adminUser] = await connection.execute(
                                'SELECT id FROM users WHERE phone = ?',
                                [decoded.phone]
                            );
                            if (adminUser.length > 0) {
                                adminUserId = String(adminUser[0].id);
                                console.log('✅ [AGENT-CREATE] Admin user ID obtenido:', adminUserId);
                            }
                        } else if (decoded.id) {
                            // Fallback: Si tiene ID, buscar el phone
                            const [users] = await connection.execute(
                                'SELECT id, phone FROM users WHERE id = ?',
                                [decoded.id]
                            );

                            if (users.length > 0) {
                                adminPhone = users[0].phone;
                                adminUserId = String(users[0].id); // ✅ NUEVO
                                console.log('✅ [AGENT-CREATE] Autenticación por JWT (ID) exitosa. Admin:', adminPhone, 'ID:', adminUserId);
                            }
                        }
                    } catch (jwtError) {
                        console.log('⚠️ [AGENT-CREATE] JWT inválido:', jwtError.message);
                    }
                }

                // Fallback 1: Verificar si hay un header X-Admin-Phone directo
                if (!adminPhone && req.headers['x-admin-phone']) {
                    const headerPhone = req.headers['x-admin-phone'];
                    const [users] = await connection.execute(
                        'SELECT id, phone FROM users WHERE phone = ? AND role IN ("admin", "supervisor")',
                        [headerPhone]
                    );
                    if (users.length > 0) {
                        adminPhone = users[0].phone;
                        adminUserId = String(users[0].id); // ✅ NUEVO
                        console.log('✅ [AGENT-CREATE] Autenticación por header X-Admin-Phone exitosa. Admin:', adminPhone, 'ID:', adminUserId);
                    }
                }

                // Si no hay JWT válido, intentar con sessionId
                if (!adminPhone && userSessionId) {
                    console.log('🔍 [AGENT-CREATE] Buscando admin por sessionId:', userSessionId);

                    // ✅ NUEVO: Si sessionId es un email, mapear a user ID
                    if (userSessionId.includes('@')) {
                        const [emailUser] = await connection.execute(
                            'SELECT id, phone FROM users WHERE email = ? AND role IN ("admin", "supervisor")',
                            [userSessionId]
                        );
                        if (emailUser.length > 0) {
                            adminPhone = emailUser[0].phone;
                            adminUserId = String(emailUser[0].id);
                            console.log('✅ [AGENT-CREATE] Email mapeado a admin. Phone:', adminPhone, 'ID:', adminUserId);
                        }
                    } else {
                        // Intentar buscar por phone o ID
                        let [users] = await connection.execute(
                            'SELECT id, phone FROM users WHERE (phone = ? OR id = ?) AND role IN ("admin", "supervisor")',
                            [userSessionId, parseInt(userSessionId) || 0]
                        );

                        if (users.length > 0) {
                            adminPhone = users[0].phone;
                            adminUserId = String(users[0].id); // ✅ NUEVO
                            console.log('✅ Autenticación por sessionId (phone/id) exitosa. Admin:', adminPhone, 'ID:', adminUserId);
                        } else {
                            // Intentar buscar en user_sessions por session_id UUID
                            const [sessionRows] = await connection.execute(
                                'SELECT phone FROM user_sessions WHERE session_id = ? OR phone = ?',
                                [userSessionId, userSessionId]
                            );

                            if (sessionRows.length > 0) {
                                adminPhone = sessionRows[0].phone;
                                // Obtener el ID del usuario
                                const [adminUser] = await connection.execute(
                                    'SELECT id FROM users WHERE phone = ?',
                                    [adminPhone]
                                );
                                if (adminUser.length > 0) {
                                    adminUserId = String(adminUser[0].id);
                                }
                                console.log('✅ Autenticación por user_sessions exitosa. Admin:', adminPhone, 'ID:', adminUserId);
                            } else {
                                // Si aún no encuentra, buscar cualquier admin activo (como fallback)
                                [users] = await connection.execute(
                                    'SELECT id, phone FROM users WHERE role = "admin" AND status = "active" LIMIT 1'
                                );
                                if (users.length > 0) {
                                    adminPhone = users[0].phone;
                                    adminUserId = String(users[0].id); // ✅ NUEVO
                                    console.log('⚠️ [AGENT-CREATE] Usando primer admin disponible:', adminPhone, 'ID:', adminUserId);
                                }
                            }
                        }
                    }
                }

                // Si no se pudo autenticar de ninguna manera
                if (!adminPhone) {
                    await connection.rollback();
                    connection.release();
                    console.log('❌ No se pudo autenticar. JWT:', !!authHeader, 'SessionId:', !!userSessionId);
                    return res.status(401).json({
                        success: false,
                        error: 'No autorizado. Debe iniciar sesión primero.'
                    });
                }

                // Verificar si el email ya existe
                const [existingUsers] = await connection.execute(
                    'SELECT id FROM users WHERE email = ?',
                    [email]
                );

                if (existingUsers.length > 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({ success: false, error: 'El email ya está registrado' });
                }

                // Generar contraseña si no se proporciona
                const finalPassword = password || `Agent${Math.random().toString(36).slice(-8)}`;

                // Hashear contraseña
                const hashedPassword = await bcrypt.hash(finalPassword, 12);

                // ✅ Crear agente en tabla users (usando adminUserId como session_id)
                const [result] = await connection.execute(`
                INSERT INTO users (
                    name, email, phone, password, role,
                    status, agent_status, max_concurrent_chats, admin_phone,
                    created_at, updated_at,
                    department, category, session_id, avatar_url
                ) VALUES (?, ?, ?, ?, 'agent', 'active', 'offline', ?, ?, NOW(), NOW(), ?, ?, ?, ?)
            `, [
                    name,
                    email,
                    phone || null,
                    hashedPassword,
                    req.body.max_concurrent_chats || 5,
                    adminPhone,
                    null, // department
                    null, // category
                    adminUserId || null, // ✅ session_id = ID del usuario admin
                    avatar_url || null // avatar_url
                ]);

                const agentId = result.insertId;

                // ✅ NUEVO: Insertar también en la tabla agents
                await connection.execute(`
                    INSERT INTO agents (
                        session_id, name, email, phone, status,
                        max_concurrent_chats, current_chats, is_active,
                        avatar_url, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 'offline', ?, 0, 1, ?, NOW(), NOW())
                `, [
                    adminUserId || null, // session_id = ID del usuario admin
                    name,
                    email,
                    phone || null,
                    req.body.max_concurrent_chats || 5,
                    avatar_url || null
                ]);

                console.log(`✅ Agente insertado en tabla users (ID: ${agentId}) y tabla agents (session_id: ${adminUserId})`);

                await connection.commit();

                console.log(`✅ Agente creado: ${email}`);

                // Variable para trackear si el WhatsApp fue enviado exitosamente
                let whatsappSent = false;
                let whatsappError = null;

                // Enviar credenciales por WhatsApp si se solicita (sin bloquear la respuesta)
                if (sendWhatsApp) {
                    // Validar que se proporcionó teléfono
                    if (!phone) {
                        console.log('⚠️ [AGENT-CREATE] sendWhatsApp solicitado pero no se proporcionó teléfono');
                        whatsappError = 'No se proporcionó número de teléfono';
                    } else {
                        // Validar formato del teléfono
                        const phoneDigits = phone.replace(/[^0-9]/g, '');
                        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
                            console.log(`⚠️ [AGENT-CREATE] Formato de teléfono inválido: ${phone} (dígitos: ${phoneDigits.length})`);
                            whatsappError = 'Formato de teléfono inválido';
                        } else {
                            // Hacer el envío en background
                            setImmediate(async () => {
                                try {
                                    console.log(`📱 [AGENT-CREATE] ===== INICIO ENVÍO WHATSAPP =====`);
                                    console.log(`📱 [AGENT-CREATE] Destinatario: ${phone} (${phoneDigits})`);
                                    console.log(`📡 [AGENT-CREATE] AdminPhone: ${adminPhone || 'N/A'}`);
                                    console.log(`📡 [AGENT-CREATE] SessionId: ${userSessionId || 'N/A'}`);

                                    // Mensaje con credenciales elegante y profesional
                                    const message = `🎉 *¡Bienvenido/a ${name}!* 🎉

✨ Has sido registrado como *AGENTE* en WhatsFlow ✨

━━━━━━━━━━━━━━━━━━━━

🔐 *CREDENCIALES DE ACCESO*

👤 *Usuario:* ${email}
🔑 *Contraseña:* ${finalPassword}
🌐 *URL:* https://web.whats-flow.com/login

━━━━━━━━━━━━━━━━━━━━

📱 *INSTRUCCIONES:*

1️⃣ Ingresa al link de arriba
2️⃣ Usa tu email como usuario
3️⃣ Ingresa la contraseña
4️⃣ ¡Listo para trabajar!

━━━━━━━━━━━━━━━━━━━━

⚠️ *IMPORTANTE:*

✅ Guarda estas credenciales
✅ Cambia tu contraseña al primer acceso
✅ No compartas tus credenciales
✅ Contacta al admin si necesitas ayuda

━━━━━━━━━━━━━━━━━━━━

💼 *Como agente podrás:*
• Gestionar chats asignados
• Responder en tiempo real
• Ver historial completo
• Organizar tu trabajo

¡Bienvenido al equipo! 💪

🚀 *WhatsFlow* - Gestión Inteligente de WhatsApp`;

                                    // Buscar sesión activa del admin en global.sessions
                                    const sessions = global.sessions || new Map();
                                    console.log(`🔍 [AGENT-CREATE] Sesiones disponibles: ${sessions.size}`);
                                    console.log(`🔍 [AGENT-CREATE] IDs de sesiones:`, Array.from(sessions.keys()));

                                    let activeSock = null;
                                    let activeSessionId = null;

                                    // 1. Intentar buscar por adminPhone
                                    if (adminPhone) {
                                        console.log(`🔎 [AGENT-CREATE] Buscando sesión para adminPhone: ${adminPhone}`);
                                        for (const [sid, sessionData] of sessions.entries()) {
                                            if (sessionData.sock && sessionData.phoneNumber === adminPhone) {
                                                activeSock = sessionData.sock;
                                                activeSessionId = sid;
                                                console.log(`✅ [AGENT-CREATE] Sesión encontrada por adminPhone: ${sid}`);
                                                break;
                                            }
                                        }
                                    }

                                    // 2. Si no encuentra por adminPhone, intentar con userSessionId
                                    if (!activeSock && userSessionId) {
                                        console.log(`🔎 [AGENT-CREATE] Buscando sesión por userSessionId: ${userSessionId}`);
                                        if (sessions.has(userSessionId)) {
                                            const sessionData = sessions.get(userSessionId);
                                            if (sessionData && sessionData.sock) {
                                                activeSock = sessionData.sock;
                                                activeSessionId = userSessionId;
                                                console.log(`✅ [AGENT-CREATE] Sesión encontrada por userSessionId: ${userSessionId}`);
                                            }
                                        }
                                    }

                                    // 3. Si aún no encuentra, intentar con la primera sesión activa disponible
                                    if (!activeSock) {
                                        console.log(`🔎 [AGENT-CREATE] Buscando cualquier sesión activa disponible...`);
                                        for (const [sid, sessionData] of sessions.entries()) {
                                            if (sessionData.sock) {
                                                activeSock = sessionData.sock;
                                                activeSessionId = sid;
                                                console.log(`✅ [AGENT-CREATE] Usando sesión activa encontrada (Fallback): ${sid}`);
                                                // Priorizar la sesión que coincida con el admin si es posible, si no, cualquiera sirve.
                                                if (sid === adminUserId || sid === adminPhone) {
                                                    break; // Encontramos una ideal
                                                }
                                                // Si no es la ideal, seguimos buscando pero ya tenemos una "activeSock" por si acaso.
                                                // O mejor, hacemos break en la primera que funcione para no demorar.
                                                break;
                                            }
                                        }
                                    }

                                    // Intentar enviar el mensaje
                                    if (activeSock) {
                                        const whatsappNumber = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
                                        console.log(`📤 [AGENT-CREATE] Enviando mensaje a: ${whatsappNumber}`);
                                        console.log(`📤 [AGENT-CREATE] Usando sesión: ${activeSessionId}`);

                                        try {
                                            await activeSock.sendMessage(whatsappNumber, { text: message });
                                            console.log(`✅✅✅ [AGENT-CREATE] ¡MENSAJE ENVIADO EXITOSAMENTE! ✅✅✅`);
                                            console.log(`📱 [AGENT-CREATE] Credenciales enviadas a ${phone} vía sesión ${activeSessionId}`);
                                            whatsappSent = true;
                                        } catch (sendError) {
                                            console.error(`❌ [AGENT-CREATE] Error al enviar mensaje:`, sendError.message);
                                            console.error(`❌ [AGENT-CREATE] Stack:`, sendError.stack);
                                            whatsappError = `Error al enviar WhatsApp: ${sendError.message}`;
                                        }
                                    } else {
                                        console.error(`❌ [AGENT-CREATE] No se encontró ninguna sesión activa de WhatsApp`);
                                        console.error(`💡 [AGENT-CREATE] Asegúrate de que el admin tenga una sesión de WhatsApp conectada`);
                                        console.log(`📊 [AGENT-CREATE] Debug - Sesiones exploradas:`, {
                                            totalSessions: sessions.size,
                                            sessionIds: Array.from(sessions.keys()),
                                            adminPhone,
                                            userSessionId
                                        });
                                        whatsappError = 'No se encontró sesión activa de WhatsApp para enviar el mensaje.';
                                    }

                                    console.log(`📱 [AGENT-CREATE] ===== FIN ENVÍO WHATSAPP =====`);

                                } catch (whatsappCritError) {
                                    console.error(`❌ [AGENT-CREATE] Error crítico enviando WhatsApp:`, whatsappCritError.message);
                                    console.error(`❌ [AGENT-CREATE] Stack:`, whatsappCritError.stack);
                                    whatsappError = `Error crítico en el proceso de envío de WhatsApp: ${whatsappCritError.message}`;
                                }
                            });
                        }
                    }
                }


                console.log(`✅ [AGENT-CREATE] Agente ${agentId} creado exitosamente`);
                console.log(`📤 [AGENT-CREATE] Retornando respuesta al cliente...`);

                res.json({
                    success: true,
                    agentId,
                    message: 'Agente creado exitosamente' + (sendWhatsApp && phone ? ' y credenciales enviadas por WhatsApp' : '')
                });

                console.log(`✅ [AGENT-CREATE] Respuesta enviada al cliente`);
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[AGENT-CREATE] ❌ Critical Error:', {
                message: error.message,
                code: error.code,
                sqlMessage: error.sqlMessage,
                sql: error.sql,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                error: error.message || 'Error creando agente',
                debugCode: error.code,
                debugSqlMessage: error.sqlMessage
            });
        }
    });

    /**
     * Obtener permisos de un agente específico
     * GET /api/agents/:agentId/permissions
     */
    app.get('/api/agents/:agentId/permissions', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { agentId } = req.params;
            const connection = await pool.getConnection();

            try {
                const [permissions] = await connection.execute(`
                SELECT 
                    p.id as permission_id,
                    p.name as permission_name,
                    p.description,
                    p.module,
                    COALESCE(ap.can_view, 0) as can_view,
                    COALESCE(ap.can_create, 0) as can_create,
                    COALESCE(ap.can_edit, 0) as can_edit,
                    COALESCE(ap.can_delete, 0) as can_delete
                FROM permissions p
                LEFT JOIN agent_permissions ap ON p.id = ap.permission_id AND ap.agent_id = ?
                ORDER BY p.module, p.name
            `, [agentId]);

                // Agrupar por módulo
                const permissionsByModule = {};
                permissions.forEach(perm => {
                    if (!permissionsByModule[perm.module]) {
                        permissionsByModule[perm.module] = [];
                    }
                    permissionsByModule[perm.module].push(perm);
                });

                res.json({
                    success: true,
                    permissions,
                    permissionsByModule
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo permisos:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo permisos' });
        }
    });

    /**
     * Actualizar permisos de un agente
     * PUT /api/agents/:agentId/permissions
     */
    app.put('/api/agents/:agentId/permissions', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { agentId } = req.params;
            const { permissions } = req.body;

            if (!permissions || !Array.isArray(permissions)) {
                return res.status(400).json({ success: false, error: 'Permisos inválidos' });
            }

            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // Eliminar permisos existentes
                await connection.execute(
                    'DELETE FROM agent_permissions WHERE agent_id = ?',
                    [agentId]
                );

                // Insertar nuevos permisos
                for (const perm of permissions) {
                    if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete) {
                        await connection.execute(`
                        INSERT INTO agent_permissions (
                            agent_id, permission_id, can_view, can_create, can_edit, can_delete
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                            agentId,
                            perm.permission_id,
                            perm.can_view ? 1 : 0,
                            perm.can_create ? 1 : 0,
                            perm.can_edit ? 1 : 0,
                            perm.can_delete ? 1 : 0
                        ]);
                    }
                }

                await connection.commit();

                console.log(`✅ Permisos actualizados para agente: ${agentId}`);
                res.json({
                    success: true,
                    message: 'Permisos actualizados exitosamente'
                });
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

    /**
     * Actualizar información de un agente
     * PUT /api/agents/:agentId
     */
    app.put('/api/agents/:agentId', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { agentId } = req.params;
            const { name, email, phone, password, is_active, max_concurrent_chats } = req.body;

            const connection = await pool.getConnection();

            try {
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
                if (phone !== undefined) {
                    updates.push('phone = ?');
                    params.push(phone);
                }
                if (password) {
                    const hashedPassword = await bcrypt.hash(password, 12);
                    updates.push('password = ?');
                    params.push(hashedPassword);
                }
                if (is_active !== undefined) {
                    updates.push('status = ?');
                    params.push(is_active ? 'active' : 'inactive');
                }
                if (max_concurrent_chats !== undefined) {
                    updates.push('max_concurrent_chats = ?');
                    params.push(max_concurrent_chats);
                }

                if (updates.length === 0) {
                    return res.status(400).json({ success: false, error: 'No hay datos para actualizar' });
                }

                params.push(agentId);

                await connection.execute(
                    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND role = 'agent'`,
                    params
                );

                console.log(`✅ Agente actualizado: ${agentId}`);
                res.json({
                    success: true,
                    message: 'Agente actualizado exitosamente'
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error actualizando agente:', error);
            res.status(500).json({ success: false, error: 'Error actualizando agente' });
        }
    });

    /**
     * Eliminar un agente
     * DELETE /api/agents/:agentId
     */
    app.delete('/api/agents/:agentId', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { agentId } = req.params;
            const connection = await pool.getConnection();

            try {
                await connection.execute(
                    'DELETE FROM users WHERE id = ? AND role = \'agent\'',
                    [agentId]
                );

                console.log(`✅ Agente eliminado: ${agentId}`);
                res.json({
                    success: true,
                    message: 'Agente eliminado exitosamente'
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error eliminando agente:', error);
            res.status(500).json({ success: false, error: 'Error eliminando agente' });
        }
    });

    /**
     * Cambiar acceso de un agente (bloquear/desbloquear)
     * PUT /api/agents/:agentId/access
     */
    app.put('/api/agents/:agentId/access', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { agentId } = req.params;
            const { status } = req.body;

            // Validar el estado
            const validStatuses = ['active', 'inactive'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`
                });
            }

            const connection = await pool.getConnection();

            try {
                // Actualizar estado de acceso del agente en tabla users
                const [result] = await connection.execute(
                    'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ? AND role = \'agent\'',
                    [status, agentId]
                );

                if (result.affectedRows === 0) {
                    console.warn(`⚠️ Intento de cambiar estado a agente no encontrado o no agente: ID ${agentId}`);
                    return res.status(404).json({ success: false, error: 'Agente no encontrado' });
                }

                console.log(`✅ Acceso de agente actualizado: ${agentId} -> ${status}`);

                // Emitir evento por Socket.IO si está disponible
                if (global.io) {
                    global.io.emit('agent-access-changed', {
                        agentId,
                        status
                    });
                }

                res.json({
                    success: true,
                    message: 'Acceso actualizado exitosamente',
                    status
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error actualizando acceso de agente:', error);
            res.status(500).json({ success: false, error: 'Error actualizando acceso' });
        }
    });

    /**
     * Obtener todos los módulos y permisos disponibles
     * GET /api/permissions/modules
     */
    app.get('/api/permissions/modules', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const connection = await pool.getConnection();

            try {
                const [permissions] = await connection.execute(`
                SELECT 
                    id as permission_id,
                    name,
                    description,
                    module
                FROM permissions
                ORDER BY module, name
            `);

                // Agrupar por módulo
                const modules = {};
                permissions.forEach(perm => {
                    if (!modules[perm.module]) {
                        modules[perm.module] = {
                            name: perm.module,
                            permissions: []
                        };
                    }
                    modules[perm.module].permissions.push(perm);
                });

                res.json({
                    success: true,
                    modules: Object.values(modules),
                    permissions
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo módulos:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo módulos' });
        }
    });

    /**
     * Login de agente (con email y contraseña)
     * POST /api/agents/login
     */
    app.post('/api/agents/login', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ success: false, error: 'Email y contraseña son requeridos' });
            }

            const connection = await pool.getConnection();

            try {
                // Buscar agente por email
                const [agents] = await connection.execute(
                    'SELECT * FROM users WHERE email = ? AND role = "agent" AND status = "active"',
                    [email]
                );

                if (agents.length === 0) {
                    return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
                }

                const agent = agents[0];

                // Verificar contraseña
                if (!agent.password) {
                    return res.status(401).json({ success: false, error: 'Este agente no tiene contraseña configurada' });
                }

                const isValidPassword = await bcrypt.compare(password, agent.password);
                if (!isValidPassword) {
                    return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
                }

                // Generar token JWT
                const jwt = require('jsonwebtoken');
                const token = jwt.sign(
                    {
                        id: agent.id,
                        email: agent.email,
                        type: 'agent',
                        name: agent.name
                    },
                    process.env.JWT_SECRET || 'whatsflow_jwt_secret',
                    { expiresIn: '24h' }
                );

                // Actualizar última actividad
                await connection.execute(
                    'UPDATE users SET agent_status = "online", last_activity = NOW() WHERE id = ?',
                    [agent.id]
                );

                // Emitir evento de cambio de estado
                if (global.io) {
                    global.io.emit('agent-status-changed', {
                        agentId: agent.id,
                        agent_status: 'online', // Corrected property name
                        agentName: agent.name
                    });
                }

                // Obtener permisos del agente
                const [permissions] = await connection.execute(`
                SELECT 
                    p.module,
                    p.name as permission_name,
                    ap.can_view,
                    ap.can_create,
                    ap.can_edit,
                    ap.can_delete
                FROM agent_permissions ap
                INNER JOIN permissions p ON ap.permission_id = p.id
                WHERE ap.agent_id = ?
            `, [agent.id]);

                const { password: _, ...agentWithoutPassword } = agent;

                console.log(`✅ Agent Login: ${email}`);
                res.json({
                    success: true,
                    token,
                    agent: agentWithoutPassword,
                    permissions,
                    message: 'Login exitoso'
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error en login de agente:', error);
            res.status(500).json({ success: false, error: 'Error en el proceso de login' });
        }
    });

    /**
     * Verificar permisos de un agente para una acción específica
     * POST /api/agents/check-permission
     */
    app.post('/api/agents/check-permission', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { agentId, module, action } = req.body; // action: 'view', 'create', 'edit', 'delete'

            if (!agentId || !module || !action) {
                return res.status(400).json({ success: false, error: 'Datos incompletos' });
            }

            const connection = await pool.getConnection();

            try {
                const columnName = `can_${action}`;

                const [result] = await connection.execute(`
                SELECT COUNT(*) as has_permission
                FROM agent_permissions ap
                INNER JOIN permissions p ON ap.permission_id = p.id
                WHERE ap.agent_id = ? 
                AND p.module = ? 
                AND ap.${columnName} = 1
            `, [agentId, module]);

                const hasPermission = result[0].has_permission > 0;

                res.json({
                    success: true,
                    hasPermission,
                    module,
                    action
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error verificando permisos:', error);
            res.status(500).json({ success: false, error: 'Error verificando permisos' });
        }
    });

    /**
     * Obtener agentes en línea
     * GET /api/agents/online
     */
    app.get('/api/agents/online', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const connection = await pool.getConnection();

            try {
                // ✅ IMPORTANTE: Filtrar agentes según el usuario autenticado
                let adminPhone = null;
                const { sessionId } = req.query;

                // Opción 1: Obtener admin_phone desde sessionId
                if (sessionId) {
                    const cleanSessionId = sessionId.replace(/\D/g, '');
                    if (cleanSessionId.length >= 7 && cleanSessionId === sessionId) {
                        adminPhone = sessionId;
                    } else {
                        const [sessions] = await connection.execute(
                            'SELECT phone_number FROM user_sessions WHERE session_id = ? AND is_active = TRUE LIMIT 1',
                            [sessionId]
                        );
                        if (sessions.length > 0) {
                            adminPhone = sessions[0].phone_number;
                        }
                    }
                }

                // Opción 2: Intentar desde JWT token
                if (!adminPhone && req.headers.authorization) {
                    try {
                        const token = req.headers.authorization.split(' ')[1];
                        const jwt = require('jsonwebtoken');
                        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'whatsflow_jwt_secret');
                        if (decoded.phone) {
                            adminPhone = decoded.phone;
                        }
                    } catch (jwtErr) {
                        console.log(`[AGENTS-ONLINE] ⚠️ JWT inválido o no presente`);
                    }
                }

                // ✅ Construir query con filtro
                let query = `
                    SELECT
                        id as userId,
                        name as userName,
                        email,
                        phone,
                        role,
                        agent_status as status,
                        last_activity as lastActivity
                    FROM users
                    WHERE role IN ('agent', 'supervisor', 'admin')
                `;
                let params = [];

                // ✅ FILTRO CRÍTICO: Solo mostrar agentes del admin autenticado
                if (adminPhone) {
                    query += ` AND admin_phone = ?`;
                    params.push(adminPhone);
                    console.log(`[AGENTS-ONLINE] 🔍 Filtrando agentes para admin: ${adminPhone}`);
                } else {
                    // Si no hay adminPhone, NO devolver ningún agente
                    console.log(`[AGENTS-ONLINE] ⚠️ No se pudo determinar adminPhone. No se devolverán agentes.`);
                    return res.json({ success: true, agents: [], total: 0 });
                }

                query += `
                    ORDER BY
                        CASE
                            WHEN agent_status = 'online' THEN 1
                            WHEN agent_status = 'available' THEN 2
                            WHEN agent_status = 'busy' THEN 3
                            ELSE 4
                        END,
                        name ASC
                `;

                const [agents] = await connection.execute(query, params);

                console.log(`[AGENTS-ONLINE] ✅ ${agents.length} agentes encontrados para admin ${adminPhone}`);

                res.json({
                    success: true,
                    agents,
                    total: agents.length
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[AGENTS-ONLINE] ❌ Error obteniendo agentes:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo lista de agentes' });
        }
    });

    /**
     * Cambiar estado de un agente
     * PUT /api/agents/:agentId/status
     */
    app.put('/api/agents/:agentId/status', authenticateToken, async (req, res) => {
        try {
            console.log('[AGENT-STATUS] 📥 Request recibido:', {
                agentId: req.params.agentId,
                body: req.body
            });

            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { agentId } = req.params;
            const { status } = req.body;

            console.log('[AGENT-STATUS] 🔍 Validando status:', status);

            // Validar el estado
            const validStatuses = ['online', 'offline', 'paused', 'busy', 'available'];
            if (!status) {
                console.log('[AGENT-STATUS] ❌ Status no proporcionado');
                return res.status(400).json({
                    success: false,
                    error: 'El campo "status" es requerido'
                });
            }

            if (!validStatuses.includes(status)) {
                console.log('[AGENT-STATUS] ❌ Status inválido:', status);
                return res.status(400).json({
                    success: false,
                    error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`,
                    received: status
                });
            }

            const connection = await pool.getConnection();

            try {
                // Verificar que el agente existe
                const [agents] = await connection.execute(
                    'SELECT id, name, email, role FROM users WHERE id = ?',
                    [agentId]
                );

                if (agents.length === 0) {
                    console.log('[AGENT-STATUS] ❌ Agente no encontrado:', agentId);
                    return res.status(404).json({
                        success: false,
                        error: 'Agente no encontrado'
                    });
                }

                console.log('[AGENT-STATUS] ✅ Agente encontrado:', agents[0]);

                // Actualizar estado del agente en tabla users
                const [result] = await connection.execute(
                    'UPDATE users SET agent_status = ?, last_activity = NOW() WHERE id = ?',
                    [status, agentId]
                );

                console.log('[AGENT-STATUS] ✅ Estado actualizado:', {
                    agentId,
                    status,
                    affectedRows: result.affectedRows
                });

                // Emitir evento por Socket.IO si está disponible
                if (global.io) {
                    const eventData = {
                        agentId,
                        agent_status: status, // Frontend expects 'agent_status', not 'status'
                        agentName: agents[0].name
                    };

                    // Obtener información de sockets conectados
                    const connectedSockets = global.io.sockets.sockets.size;
                    const socketsArray = Array.from(global.io.sockets.sockets.values());
                    const adminSockets = socketsArray.filter(s => s.userRole === 'admin').length;
                    const agentSockets = socketsArray.filter(s => s.userRole === 'agent').length;

                    console.log('[AGENT-STATUS] 📡 Emitiendo evento Socket.IO:', {
                        event: 'agent-status-changed',
                        data: eventData,
                        connectedSockets,
                        adminSockets,
                        agentSockets,
                        socketIds: socketsArray.map(s => ({ id: s.id, role: s.userRole }))
                    });

                    global.io.emit('agent-status-changed', eventData);
                    console.log('[AGENT-STATUS] ✅ Evento emitido a todos los sockets');
                }

                res.json({
                    success: true,
                    message: 'Estado actualizado exitosamente',
                    status,
                    agent: agents[0]
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[AGENT-STATUS] ❌ Error:', error);
            // Log full error details for debugging
            if (error.code) console.error('[AGENT-STATUS] Error Code:', error.code);
            if (error.sqlMessage) console.error('[AGENT-STATUS] SQL Message:', error.sqlMessage);
            if (error.sql) console.error('[AGENT-STATUS] Failed SQL:', error.sql);

            res.status(500).json({
                success: false,
                error: 'Error actualizando estado',
                details: error.message,
                code: error.code || 'UNKNOWN'
            });
        }
    });

    console.log('✅ Endpoints de gestión de agentes con privilegios cargados');

};
