const {
    hashPassword,
    verifyPassword,
    generateToken,
    authenticateJWT,
    requireSuperAdmin
} = require('./auth-utils');
const { authenticateToken: authMiddleware } = require('./middleware/auth');

/**
 * Registrar endpoints de autenticación
 */
function registerAuthEndpoints(app, pool) {
    // FIX: Fallback to global.dbPool if pool is not passed correctly (initialization race condition)
    if (!pool && global.dbPool) {
        pool = global.dbPool;
        console.log('[AUTH] ⚠️ Using global.dbPool fallback');
    }

    // ==================== REGISTRO ====================
    app.post('/api/auth/register', async (req, res) => {
        const { full_name, email, phone, password, confirm_password } = req.body;

        try {
            // Validaciones
            if (!full_name || !email || !phone || !password || !confirm_password) {
                return res.status(400).json({
                    success: false,
                    error: 'Todos los campos son requeridos'
                });
            }

            if (password !== confirm_password) {
                return res.status(400).json({
                    success: false,
                    error: 'Las contraseñas no coinciden'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'La contraseña debe tener al menos 6 caracteres'
                });
            }

            // Validar formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Formato de email inválido'
                });
            }

            const dbPool = pool || global.dbPool;
            if (!dbPool) {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Verificar si email ya existe
                const [existing] = await connection.execute(
                    'SELECT id FROM users WHERE email = ?',
                    [email]
                );

                if (existing.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'El email ya está registrado'
                    });
                }

                // Hash de contraseña
                const password_hash = await hashPassword(password);

                // Insertar usuario en tabla users con role=admin (clientes se manejan como admin aquí)
                const [result] = await connection.execute(
                    `INSERT INTO users (name, email, phone, password, role, status) 
                     VALUES (?, ?, ?, ?, 'admin', 'active')`,
                    [full_name, email, phone, password_hash]
                );

                const newUserId = result.insertId || result[0]?.id;
                console.log(`[AUTH] Nuevo cliente registrado: ${email} (ID: ${newUserId})`);

                res.json({
                    success: true,
                    message: 'Usuario registrado exitosamente. Inicia sesión para comenzar.',
                    userId: newUserId
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH] Error en registro:', error);
            res.status(500).json({
                success: false,
                error: 'Error al registrar usuario'
            });
        }
    });

    // ==================== LOGIN ====================
    app.post('/api/auth/login', async (req, res) => {
        let { email, password } = req.body;

        // HOTFIX: Auto-corregir error común de tipeo para este usuario específico
        if (email === 'claudio@cnid.om.py') {
            console.log('[AUTH-FIX] 🔧 Auto-corrigiendo email claudio@cnid.om.py -> claudio@cnid.com.py');
            email = 'claudio@cnid.com.py';
        }

        try {
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email y contraseña son requeridos'
                });
            }

            const dbPool = pool || global.dbPool;
            if (!dbPool) {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar usuario en tabla 'users' (email/password login)
                const [users] = await connection.execute(
                    `SELECT id, name as full_name, email, phone as phone_number, password, role, status, is_super_admin
                     FROM users WHERE email = ?`,
                    [email]
                );

                if (users.length === 0) {
                    console.log(`[AUTH-DEBUG] ❌ Login fallido: Usuario no encontrado para email '${email}'`);
                    return res.status(401).json({
                        success: false,
                        error: 'Credenciales inválidas'
                    });
                }

                const user = users[0];
                console.log(`[AUTH] 👤 Usuario encontrado:`, email, `| Role:`, user.role);


                // Verificar contraseña
                const isValid = await verifyPassword(password, user.password);

                if (!isValid) {
                    console.log(`[AUTH-DEBUG] ❌ Login fallido: Contraseña incorrecta para email '${email}'`);
                    return res.status(401).json({
                        success: false,
                        error: 'Credenciales inválidas'
                    });
                }

                // Actualizar last_login
                await connection.execute(
                    'UPDATE user_sessions SET last_login = NOW() WHERE id = ?',
                    [user.id]
                );

                // Marcar users.session = 1 al iniciar sesión
                await connection.execute(
                    'UPDATE users SET session = 1, last_login = NOW() WHERE id = ?',
                    [user.id]
                );
                console.log(`[AUTH] ✅ users.session=1 para user_id=${user.id}`);

                // Usar rol de la BD
                const userRole = user.role || 'admin';
                console.log(`[AUTH] 👤 Rol de ${email}:`, userRole);

                // Generar token JWT con el rol correcto
                const token = generateToken(user, userRole);

                console.log(`[AUTH] Login exitoso: ${email} | Role: ${userRole}`);

                // 🔥 AUTO-LEVANTAR SESIÓN: Si el usuario tiene sesión guardada, levantarla automáticamente
                const sessions = global.sessions;
                if (sessions && user.phone_number) {
                    const userSessionId = String(user.id);
                    
                    // Verificar si ya existe en memoria
                    if (!sessions.has(userSessionId)) {
                        // Buscar si tiene archivos de credenciales guardados
                        const path = require('path');
                        const fs = require('fs');
                        const authPath = path.join(process.cwd(), 'auth_info_multi', userSessionId);
                        const credsPath = path.join(authPath, 'creds.json');
                        
                        if (fs.existsSync(credsPath)) {
                            console.log(`[AUTH] 🚀 Levantando sesión automáticamente para usuario ${user.id} (${user.phone_number})`);
                            
                            // Levantar sesión de forma asíncrona (no esperar para responder rápido)
                            const createSession = global.createSession;
                            if (createSession) {
                                createSession(userSessionId, false, true).then(() => {
                                    console.log(`[AUTH] ✅ Sesión ${userSessionId} levantada exitosamente`);
                                }).catch(err => {
                                    console.error(`[AUTH] ❌ Error levantando sesión ${userSessionId}:`, err.message);
                                });
                            }
                        } else {
                            console.log(`[AUTH] ℹ️ Usuario ${user.id} no tiene sesión guardada (necesitará escanear QR)`);
                        }
                    } else {
                        console.log(`[AUTH] ✅ Sesión ${userSessionId} ya está activa en memoria`);
                    }
                }

                res.json({
                    success: true,
                    token,
                    sessionId: String(user.id), // sessionId es el user.id para usuarios normales
                    user: {
                        id: user.id,
                        full_name: user.full_name,
                        email: user.email,
                        phone_number: user.phone_number,
                        role: userRole
                    }
                });
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH] Error en login:', error.message, error.stack);
            res.status(500).json({
                success: false,
                error: 'Error al iniciar sesión: ' + error.message
            });
        }
    });

    // ==================== VERIFICAR TOKEN ====================
    app.get('/api/auth/verify', authenticateJWT, async (req, res) => {
        try {
            const dbPool = pool || global.dbPool;
            if (!dbPool) {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar usuario en tabla 'users' y verificar campo session
                const [users] = await connection.execute(
                    `SELECT id, name as full_name, email, phone as phone_number, is_super_admin, is_admin, session
                     FROM users WHERE id = ?`,
                    [req.user.userId]
                );

                if (users.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Usuario no encontrado',
                        requiresReauth: true
                    });
                }

                const user = users[0];

                // ✅ VERIFICAR CAMPO SESSION - Si es 0, la sesión fue cerrada
                if (user.session === 0 || user.session === '0') {
                    console.log(`[AUTH-VERIFY] ❌ Sesión cerrada para usuario ${user.email} (session=0)`);
                    return res.status(401).json({
                        success: false,
                        error: 'Sesión cerrada. Por favor, inicia sesión nuevamente.',
                        requiresReauth: true,
                        sessionClosed: true
                    });
                }

                // Determinar rol del usuario
                let userRole = 'user';
                if (user.is_super_admin === 1 || user.is_super_admin === true) {
                    userRole = 'super_admin';
                } else if (user.is_admin === 1 || user.is_admin === true) {
                    userRole = 'admin';
                }

                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        full_name: user.full_name,
                        email: user.email,
                        phone_number: user.phone_number,
                        role: userRole
                    }
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH] Error verificando token:', error);
            res.status(500).json({
                success: false,
                error: 'Error al verificar token'
            });
        }
    });

    // ==================== LOGOUT ====================
    app.post('/api/auth/logout', async (req, res) => {
        // IMPORTANTE: NO requerir authenticateJWT porque el token puede ser inválido
        // y aún así queremos permitir el logout
        console.log(`[AUTH-LOGOUT] 🔴 Iniciando logout...`);

        try {
            const dbPool = pool || global.dbPool;

            // Intentar obtener userId del token (incluso si es inválido)
            let userId = null;
            const authHeader = req.headers.authorization;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    // Decodificar sin verificar (para obtener userId incluso si expiró)
                    const decoded = jwt.decode(token);
                    userId = decoded?.userId || decoded?.id;
                    console.log(`[AUTH-LOGOUT] Token decodificado, userId: ${userId}`);
                } catch (err) {
                    console.log(`[AUTH-LOGOUT] No se pudo decodificar token:`, err.message);
                }
            }

            // Si tenemos userId, actualizar en BD
            if (userId && dbPool) {
                const connection = await dbPool.getConnection();
                try {
                    // Actualizar session = 0 y agent_status = 'offline' para agentes
                    await connection.execute(
                        `UPDATE users 
                         SET session = 0, 
                             agent_status = CASE 
                                 WHEN role IN ('agent', 'supervisor') THEN 'offline' 
                                 ELSE agent_status 
                             END 
                         WHERE id = ?`,
                        [userId]
                    );
                    console.log(`[AUTH-LOGOUT] ✅ Session cerrada y estado actualizado para usuario ID ${userId}`);
                } finally {
                    connection.release();
                }
            } else {
                console.log(`[AUTH-LOGOUT] ⚠️ No se pudo obtener userId o DB no disponible`);
            }

        } catch (err) {
            console.error('[AUTH-LOGOUT] ❌ Error:', err.message);
        }

        // SIEMPRE retornar success para permitir logout en frontend
        res.json({ success: true, message: 'Sesión cerrada exitosamente' });
    });

    console.log('[AUTH] ✅ Endpoints de autenticación registrados');
    // ==================== LINK WHATSAPP SESSION ====================
    app.post('/api/auth/link-whatsapp-session', authMiddleware, async (req, res) => {
        const { whatsappSessionId } = req.body;

        console.log('[AUTH] 🔗 Vinculando WhatsApp:', {
            whatsappSessionId,
            userId: req.user?.id,
            userEmail: req.user?.email
        });

        try {
            if (!whatsappSessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp sessionId requerido'
                });
            }

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'No autenticado'
                });
            }

            const dbPool = pool || global.dbPool;
            if (!dbPool) {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // El userId viene del JWT (users.id)
                const userId = req.user.id;

                if (!userId) {
                    connection.release();
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario no identificado'
                    });
                }

                // 🔥 LÓGICA CORRECTA:
                // - session_id en user_sessions = users.id (userId) ← CRÍTICO
                // - is_active = 1 mientras hay conexión WhatsApp activa en memoria

                // Buscar si ya existe user_sessions para este usuario
                const [existingRows] = await connection.execute(
                    'SELECT id FROM user_sessions WHERE session_id = ? LIMIT 1',
                    [userId]
                );

                let result;
                if (existingRows.length > 0) {
                    // Actualizar existente: marcar como activo
                    [result] = await connection.execute(
                        `UPDATE user_sessions 
                         SET is_active = 1,
                             updated_at = NOW(),
                             last_activity = NOW()
                         WHERE session_id = ?`,
                        [userId]
                    );
                    console.log(`[AUTH-LINK] ✅ Sesión WhatsApp activada para usuario ${userId}`);
                } else {
                    // Crear nueva entrada con session_id = user.id
                    [result] = await connection.execute(
                        `INSERT INTO user_sessions (session_id, email, is_active, updated_at, last_activity)
                         VALUES (?, ?, 1, NOW(), NOW())`,
                        [userId, req.user.email]
                    );
                    console.log(`[AUTH-LINK] ✅ Nueva sesión creada para usuario ${userId}`);
                }

                if (result.affectedRows === 0) {
                    connection.release();
                    return res.status(404).json({
                        success: false,
                        error: 'Usuario no encontrado'
                    });
                }

                connection.release();

                // 🔥 ACTUALIZAR SESIÓN EN MEMORIA
                // Buscar la sesión en memoria por el whatsappSessionId y guardar el userId
                const sessions = global.sessions || new Map();
                const sessionInfo = sessions.get(whatsappSessionId);
                if (sessionInfo) {
                    sessionInfo.userId = userId;  // ← Guardar userId en la sesión de memoria
                    
                    // Obtener el teléfono de la BD (users.phone)
                    const dbPool = pool || global.dbPool;
                    if (dbPool) {
                        try {
                            const userConn = await dbPool.getConnection();
                            const [userRows] = await userConn.execute(
                                'SELECT phone FROM users WHERE id = ? LIMIT 1',
                                [userId]
                            );
                            userConn.release();
                            
                            if (userRows.length > 0 && userRows[0].phone) {
                                sessionInfo.phoneNumber = userRows[0].phone;
                                console.log(`[AUTH-LINK] ✅ phoneNumber guardado: ${userRows[0].phone}`);
                            }
                        } catch (phoneErr) {
                            console.warn('[AUTH-LINK] ⚠️ Error obteniendo teléfono:', phoneErr.message);
                        }
                    }
                    
                    console.log(`[AUTH-LINK] 🔄 Sesión en memoria actualizada: sessionId=${whatsappSessionId}, userId=${userId}, isConnected=${sessionInfo.isConnected}`);
                } else {
                    console.warn(`[AUTH-LINK] ⚠️ Sesión en memoria NO encontrada para ${whatsappSessionId}`);
                }

                // Responder confirmando que la sesión está lista
                return res.json({
                    success: true,
                    message: 'WhatsApp sesión activada',
                    sessionId: userId,  // ← Devolver user.id, no el hex de Baileys
                    userId: userId,
                    userEmail: req.user.email,
                    shouldReload: false
                });

            } catch (dbError) {
                connection.release();
                throw dbError;
            }

        } catch (error) {
            console.error('[AUTH] Error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Error al vincular'
            });
        }
    });
};

module.exports = { registerAuthEndpoints };
