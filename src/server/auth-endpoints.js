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
                    'SELECT id FROM user_sessions WHERE email = ?',
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

                // Generar session_id único para el usuario
                const session_id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // Insertar usuario
                const [result] = await connection.execute(
                    `INSERT INTO user_sessions (session_id, full_name, email, phone_number, password_hash, is_active) 
                     VALUES (?, ?, ?, ?, ?, 1)`,
                    [session_id, full_name, email, phone, password_hash]
                );

                console.log(`[AUTH] Nuevo usuario registrado: ${email}`);

                res.json({
                    success: true,
                    message: 'Usuario registrado exitosamente',
                    userId: result.insertId
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
                // Buscar usuario
                const [users] = await connection.execute(
                    `SELECT id, full_name, email, phone_number, password_hash, is_active 
                     FROM user_sessions WHERE email = ?`,
                    [email]
                );

                if (users.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Credenciales inválidas'
                    });
                }

                const user = users[0];


                // Verificar contraseña
                const isValid = await verifyPassword(password, user.password_hash);

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

                // Generar token
                const token = generateToken(user);

                console.log(`[AUTH] Login exitoso: ${email}`);

                res.json({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        full_name: user.full_name,
                        email: user.email,
                        phone_number: user.phone_number,
                        role: user.phone_number === '595994854167' ? 'super_admin' : 'user'
                    }
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH] Error en login:', error);
            res.status(500).json({
                success: false,
                error: 'Error al iniciar sesión'
            });
        }
    });

    // ==================== VERIFICAR TOKEN ====================
    app.get('/api/auth/verify', authenticateJWT, async (req, res) => {
        try {
            const connection = await pool.getConnection();

            try {
                const [users] = await connection.execute(
                    `SELECT id, full_name, email, phone_number 
                     FROM user_sessions WHERE id = ? AND is_active = 1`,
                    [req.user.userId]
                );

                if (users.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Usuario no encontrado'
                    });
                }

                const user = users[0];

                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        full_name: user.full_name,
                        email: user.email,
                        phone_number: user.phone_number,
                        role: user.phone_number === '595994854167' ? 'super_admin' : 'user'
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
