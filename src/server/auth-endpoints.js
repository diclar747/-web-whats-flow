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

            const connection = await pool.getConnection();

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
        const { email, password } = req.body;

        try {
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email y contraseña son requeridos'
                });
            }

            const connection = await pool.getConnection();

            try {
                // Buscar usuario en tabla 'users' (email/password login)
                const [users] = await connection.execute(
                    `SELECT id, name as full_name, email, phone as phone_number, password, role, status
                     FROM users WHERE email = ?`,
                    [email]
                );

                if (users.length === 0) {
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

                // Usar rol de la BD
                const userRole = user.role || 'admin';
                console.log(`[AUTH] 👤 Rol de ${email}:`, userRole);

                // Generar token JWT con el rol correcto
                const token = generateToken(user, userRole);

                // Crear/actualizar user_sessions con session_id = user.id (como string)
                let whatsappSessionId = String(user.id); // SIEMPRE asignar sessionId = user.id
                try {
                    const sessionId = String(user.id);
                    
                    // Eliminar sessions antiguas para este usuario
                    await connection.execute(
                        `DELETE FROM user_sessions WHERE email = ? AND session_id != ?`,
                        [email, sessionId]
                    );
                    
                    // Crear/actualizar user_sessions con session_id = user.id
                    const [checkSession] = await connection.execute(
                        `SELECT id FROM user_sessions WHERE session_id = ?`,
                        [sessionId]
                    );
                    
                    if (checkSession.length === 0) {
                        // Insertar nueva sesión
                        await connection.execute(
                            `INSERT INTO user_sessions (session_id, email, phone, full_name, is_active, status) 
                             VALUES (?, ?, ?, ?, 1, 'active')`,
                            [sessionId, email, user.phone_number, user.full_name]
                        );
                        console.log(`[AUTH] ✅ Sesión creada para usuario: ${email} (session_id: ${sessionId})`);
                    } else {
                        // Actualizar sesión existente
                        await connection.execute(
                            `UPDATE user_sessions SET email = ?, phone = ?, full_name = ?, is_active = 1, status = 'active' WHERE session_id = ?`,
                            [email, user.phone_number, user.full_name, sessionId]
                        );
                        console.log(`[AUTH] ✅ Sesión actualizada para usuario: ${email} (session_id: ${sessionId})`);
                    }
                    
                    whatsappSessionId = sessionId; // Asegurar que se devuelva
                } catch (err) {
                    console.log('[AUTH] ⚠️ Error al crear/actualizar sesión:', err.message);
                }

                console.log(`[AUTH] Login exitoso: ${email} | sessionId: ${whatsappSessionId}`);

                res.json({
                    success: true,
                    token,
                    sessionId: whatsappSessionId, // ✅ Devolver sessionId al frontend
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
            const connection = await pool.getConnection();

            try {
                // Buscar usuario en tabla 'users'
                const [users] = await connection.execute(
                    `SELECT id, name as full_name, email, phone as phone_number, is_super_admin, is_admin
                     FROM users WHERE id = ? AND is_active = 1`,
                    [req.user.userId]
                );

                if (users.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Usuario no encontrado'
                    });
                }

                const user = users[0];

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
    app.post('/api/auth/logout', authenticateJWT, (req, res) => {
        // En JWT, el logout es del lado del cliente (eliminar token)
        // Aquí solo confirmamos
        console.log(`[AUTH] Logout: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });
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

            const connection = await pool.getConnection();

            try {
                let userId = req.user.id;
                
                // Buscar usuario por email si no hay ID
                if (!userId && req.user.email) {
                    console.log('[AUTH] 🔍 Buscando usuario por email:', req.user.email);
                    const [users] = await connection.execute(
                        'SELECT id FROM user_sessions WHERE email = ? LIMIT 1',
                        [req.user.email]
                    );
                    
                    if (users.length > 0) {
                        userId = users[0].id;
                    }
                }
                
                if (!userId) {
                    connection.release();
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario no identificado'
                    });
                }

                // Actualizar session_id en user_sessions
                const [result] = await connection.execute(
                    `UPDATE user_sessions 
                     SET session_id = ?, 
                         is_active = 1,
                         updated_at = NOW(),
                         last_activity = NOW()
                     WHERE id = ?`,
                    [whatsappSessionId, userId]
                );

                if (result.affectedRows === 0) {
                    connection.release();
                    return res.status(404).json({
                        success: false,
                        error: 'Usuario no encontrado'
                    });
                }

                console.log(`[AUTH] ✅ WhatsApp vinculado para usuario ${userId}`);
                connection.release();

                // Responder SIN RECARGAR - el cliente continuará el polling
                return res.json({
                    success: true,
                    message: 'WhatsApp vinculado',
                    sessionId: whatsappSessionId,
                    shouldReload: false // Indicar explícitamente NO recargar
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
