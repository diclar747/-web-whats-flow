const {
    hashPassword,
    verifyPassword,
    generateToken,
    authenticateJWT,
    requireSuperAdmin
} = require('./auth-utils');
const { authenticateToken: authMiddleware } = require('./middleware/auth');
const { createUniqueSession, validateUniqueSession } = require('./middleware/sessionValidator');

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

            if (password.length < 8) {
                return res.status(400).json({
                    success: false,
                    error: 'La contraseña debe tener al menos 8 caracteres'
                });
            }

            // Validar complejidad de contraseña
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
                return res.status(400).json({
                    success: false,
                    error: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
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

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
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

                // Generar token de verificación de email
                const crypto = require('crypto');
                const emailVerificationToken = crypto.randomBytes(32).toString('hex');
                const emailVerificationExpires = new Date(Date.now() + 24 * 3600000); // 24 horas

                // Insertar usuario en tabla users con email_verified = 0
                const [result] = await connection.execute(
                    `INSERT INTO users (name, email, phone, password, role, status, email_verified, email_verification_token, email_verification_expires) 
                     VALUES (?, ?, ?, ?, 'admin', 'active', 0, ?, ?)`,
                    [full_name, email, phone, password_hash, emailVerificationToken, emailVerificationExpires]
                );

                const newUserId = result.insertId || result[0]?.id;
                console.log(`[AUTH] Nuevo cliente registrado: ${email} (ID: ${newUserId}) - Email NO verificado`);

                // 🏗️ KANBAN: Crear tableros por defecto
                const { createDefaultKanbanBoards } = require('./kanban-utils');
                await createDefaultKanbanBoards(global.dbPool || pool, newUserId);

                // 📧 Enviar email de bienvenida con enlace de activación
                const { sendWelcomeEmail } = require('./utils/emailService');
                const emailSent = await sendWelcomeEmail(email, full_name, emailVerificationToken);

                if (!emailSent) {
                    console.warn('[AUTH-REGISTER] ⚠️ No se pudo enviar email de bienvenida, pero usuario creado');
                }

                res.json({
                    success: true,
                    message: 'Registro exitoso. Revisa tu correo para activar tu cuenta.',
                    requiresEmailVerification: true,
                    email: email
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
        if (email === 'domingo@cnid.om.py') {
            console.log('[AUTH-FIX] 🔧 Auto-corrigiendo email domingo@cnid.om.py -> domingo@cnid.com.py');
            email = 'domingo@cnid.com.py';
        }

        try {
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email y contraseña son requeridos'
                });
            }

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar usuario en tabla 'users' (email/password login)
                const [users] = await connection.execute(
                    `SELECT id, name as full_name, email, phone as phone_number, password, role, status, is_super_admin, email_verified, is_blocked
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
                console.log(`[AUTH] 👤 Usuario encontrado:`, email, `| Role:`, user.role, `| Verified:`, user.email_verified);

                // Verificar que el email esté verificado
                if (user.email_verified === 0) {
                    console.log(`[AUTH-DEBUG] ❌ Login fallido: Email no verificado para '${email}'`);
                    return res.status(403).json({
                        success: false,
                        error: 'Debes activar tu cuenta desde el correo electrónico',
                        requiresEmailVerification: true,
                        email: email
                    });
                }

                // ⛔ VERIFICAR SI EL USUARIO ESTÁ BLOQUEADO
                if (user.is_blocked === 1 || user.is_blocked === true) {
                    console.log(`[AUTH-DEBUG] ❌ Login bloqueado: Usuario bloqueado '${email}'`);
                    return res.status(403).json({
                        success: false,
                        error: 'Tu cuenta ha sido suspendida',
                        isBlocked: true,
                        supportPhone: '595994854167'
                    });
                }

                // Verificar contraseña
                const isValid = await verifyPassword(password, user.password);

                if (!isValid) {
                    console.log(`[AUTH-DEBUG] ❌ Login fallido: Contraseña incorrecta para email '${email}'`);
                    return res.status(401).json({
                        success: false,
                        error: 'Credenciales inválidas'
                    });
                }

                // Actualizar estado de sesión y last_login en la tabla users
                await connection.execute(
                    'UPDATE users SET session = 1, last_login = NOW() WHERE id = ?',
                    [user.id]
                );
                console.log(`[AUTH] ✅ users.session=1 y last_login actualizado para user_id=${user.id}`);

                // Actualizar last_login en user_sessions si existe (session_id es el id del usuario)
                connection.execute(
                    'UPDATE user_sessions SET last_login = NOW() WHERE session_id = ? OR id = ? OR phone = ?',
                    [String(user.id), user.id, user.phone_number]
                ).catch(err => console.error('[AUTH-WARN] Error al actualizar user_sessions:', err.message));

                // Usar rol de la BD
                const userRole = user.role || 'admin';
                console.log(`[AUTH] 👤 Rol de ${email}:`, userRole);

                // Generar token JWT con el rol correcto
                const token = generateToken(user, userRole);

                // 🔐 Crear sesión única para validación por dispositivo
                const deviceId = req.body.deviceId || 'unknown_device';
                const sessionToken = createUniqueSession(user.id, deviceId, user.email, userRole);

                console.log(`[AUTH] Login exitoso: ${email} | Role: ${userRole} | Device: ${deviceId.substr(0, 10)}...`);

                // 🔥 AUTO-LEVANTAR SESIÓN: Si el usuario tiene sesión guardada, levantarla automáticamente
                const sessions = global.sessions;
                if (sessions && user.phone_number) {
                    const userSessionId = String(user.id);
                    const phoneNumber = user.phone_number;

                    // Verificar si ya existe en memoria (buscar por ambas claves: userSessionId y phoneNumber)
                    const sessionExistsById = sessions.has(userSessionId);
                    const sessionExistsByPhone = sessions.has(phoneNumber);

                    if (!sessionExistsById && !sessionExistsByPhone) {
                        // Buscar si tiene archivos de credenciales guardados
                        const path = require('path');
                        const fs = require('fs');
                        const authPath = path.join(process.cwd(), 'auth_info_multi', userSessionId);
                        const credsPath = path.join(authPath, 'creds.json');

                        if (fs.existsSync(credsPath)) {
                            console.log(`[AUTH] 🚀 Levantando sesión automáticamente para usuario ${user.id} (${phoneNumber})`);

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
                        if (sessionExistsById) {
                            console.log(`[AUTH] ✅ Sesión ${userSessionId} ya está activa en memoria (por ID)`);
                        } else {
                            console.log(`[AUTH] ✅ Sesión ${phoneNumber} ya está activa en memoria (por phone)`);
                        }
                    }
                }

                // 🏗️ KANBAN: Asegurar que existan tableros por defecto
                const { createDefaultKanbanBoards } = require('./kanban-utils');
                // No esperar a que termine para no bloquear respuesta
                createDefaultKanbanBoards(global.dbPool || pool, user.id).catch(err => {
                    console.error('[AUTH] ❌ Error creando tableros kanban en login:', err);
                });

                res.json({
                    success: true,
                    token,
                    sessionToken, // 🔐 Importante para el fetchInterceptor
                    sessionId: user.phone_number || String(user.id), // Priorizar phoneNumber si existe
                    whatsappSessionId: user.phone_number,
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
    // ✅ CORREGIDO: Hacer validateUniqueSession opcional para permitir reconexión
    app.get('/api/auth/verify', authenticateJWT, async (req, res) => {
        try {
            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }

            // 🆕 Validar sesión única solo si se proporcionan las credenciales
            const sessionToken = req.headers['x-session-token'];
            const deviceId = req.headers['x-device-id'];

            if (sessionToken && deviceId) {
                console.log('[AUTH-VERIFY] ✅ Validando sesión única (X-Session-Token y X-Device-Id presentes)');
                // Llamar manualmente al middleware de validación
                const { validateUniqueSession } = require('./middleware/sessionValidator');
                try {
                    await new Promise((resolve, reject) => {
                        validateUniqueSession(req, res, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                } catch (validationError) {
                    console.log('[AUTH-VERIFY] ⚠️ Validación de sesión falló:', validationError.message);
                    // NO retornar error 401 - permitir continuar sin sesión única
                }
            } else {
                console.log('[AUTH-VERIFY] ℹ️ Sin X-Session-Token/X-Device-Id - saltando validación de sesión única');
            }

            const connection = await dbPool.getConnection();

            try {
                // Buscar usuario en tabla 'users' y verificar campo session
                const userId = req.user.userId || req.user.id;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        error: 'Token inválido: ID de usuario no encontrado',
                        requiresReauth: true
                    });
                }

                const [users] = await connection.execute(
                    `SELECT id, name as full_name, email, phone as phone_number, role, is_super_admin, is_admin, session, is_blocked
                     FROM users WHERE id = ?`,
                    [userId]
                );

                if (users.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Usuario no encontrado',
                        requiresReauth: true
                    });
                }

                const user = users[0];

                // ⛔ VERIFICAR SI EL USUARIO ESTÁ BLOQUEADO
                if (user.is_blocked === 1 || user.is_blocked === true) {
                    console.log(`[AUTH-VERIFY] ❌ Usuario bloqueado: ${user.email}`);
                    return res.status(403).json({
                        success: false,
                        error: 'Tu cuenta ha sido suspendida',
                        isBlocked: true,
                        supportPhone: '595994854167',
                        requiresReauth: true
                    });
                }

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

                // Determinar rol del usuario - PRIORIZAR EL CAMPO role DE LA BD
                let userRole = user.role || 'user'; // ✅ Usar el campo role directamente
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
            const dbPool = global.dbPool || pool;
            const { blacklistToken } = require('./utils/tokenBlacklist');

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

                    // Revocar el token agregándolo a la blacklist
                    blacklistToken(token);
                    console.log(`[AUTH-LOGOUT] Token agregado a blacklist`);
                } catch (err) {
                    console.log(`[AUTH-LOGOUT] No se pudo decodificar token:`, err.message);
                }
            }

            // Si tenemos userId, actualizar en BD
            if (userId && dbPool && typeof dbPool.getConnection === 'function') {
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

    // ==================== FORGOT PASSWORD ====================
    app.post('/api/auth/forgot-password', async (req, res) => {
        const { email } = req.body;

        try {
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email es requerido'
                });
            }

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar usuario por email
                const [users] = await connection.execute(
                    'SELECT id, name, email FROM users WHERE email = ?',
                    [email]
                );

                if (users.length === 0) {
                    // Por seguridad, no revelar si el email existe o no
                    console.log(`[AUTH-FORGOT-PASSWORD] Email no encontrado: ${email}`);
                    return res.json({
                        success: true,
                        message: 'Si el correo existe, recibirás un enlace de recuperación'
                    });
                }

                const user = users[0];
                console.log(`[AUTH-FORGOT-PASSWORD] Usuario encontrado: ${user.email}`);

                // Generar token único
                const crypto = require('crypto');
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 3600000); // 1 hora desde ahora

                // Guardar token en la base de datos
                await connection.execute(
                    `INSERT INTO password_reset_tokens (user_id, token, expires_at, used) 
                     VALUES (?, ?, ?, 0)`,
                    [user.id, token, expiresAt]
                );

                console.log(`[AUTH-FORGOT-PASSWORD] Token generado para usuario ${user.id}`);

                // Enviar correo con el token
                const { sendPasswordResetEmail } = require('./utils/emailService');
                const emailSent = await sendPasswordResetEmail(user.email, token);

                if (!emailSent) {
                    console.error('[AUTH-FORGOT-PASSWORD] Error enviando correo');
                    return res.status(500).json({
                        success: false,
                        error: 'Error al enviar el correo. Intente nuevamente.'
                    });
                }

                console.log(`[AUTH-FORGOT-PASSWORD] ✅ Correo enviado exitosamente a ${user.email}`);

                res.json({
                    success: true,
                    message: 'Te hemos enviado un correo con instrucciones para recuperar tu contraseña'
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH-FORGOT-PASSWORD] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al procesar la solicitud'
            });
        }
    });

    // ==================== VERIFY RESET TOKEN ====================
    app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
        const { token } = req.params;

        try {
            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'Token es requerido'
                });
            }

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar token en la base de datos
                const [tokens] = await connection.execute(
                    `SELECT t.id, t.user_id, t.expires_at, t.used, u.email 
                     FROM password_reset_tokens t
                     JOIN users u ON t.user_id = u.id
                     WHERE t.token = ?`,
                    [token]
                );

                if (tokens.length === 0) {
                    console.log(`[AUTH-VERIFY-TOKEN] Token no encontrado: ${token.substring(0, 10)}...`);
                    return res.status(400).json({
                        success: false,
                        error: 'El enlace de recuperación no es válido'
                    });
                }

                const tokenData = tokens[0];

                // Verificar si el token ya fue usado
                if (tokenData.used === 1) {
                    console.log(`[AUTH-VERIFY-TOKEN] Token ya usado: ${token.substring(0, 10)}...`);
                    return res.status(400).json({
                        success: false,
                        error: 'Este enlace ya fue utilizado'
                    });
                }

                // Verificar si el token expiró
                const now = new Date();
                const expiresAt = new Date(tokenData.expires_at);
                if (now > expiresAt) {
                    console.log(`[AUTH-VERIFY-TOKEN] Token expirado: ${token.substring(0, 10)}...`);
                    return res.status(400).json({
                        success: false,
                        error: 'El enlace de recuperación ha expirado'
                    });
                }

                console.log(`[AUTH-VERIFY-TOKEN] ✅ Token válido para usuario: ${tokenData.email}`);

                res.json({
                    success: true,
                    email: tokenData.email
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH-VERIFY-TOKEN] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al verificar el token'
            });
        }
    });

    // ==================== RESET PASSWORD ====================
    app.post('/api/auth/reset-password', async (req, res) => {
        const { token, newPassword, confirmPassword } = req.body;

        try {
            // Validaciones
            if (!token || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Todos los campos son requeridos'
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Las contraseñas no coinciden'
                });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    error: 'La contraseña debe tener al menos 8 caracteres'
                });
            }

            // Validar complejidad
            if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
                return res.status(400).json({
                    success: false,
                    error: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
                });
            }

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar y validar token
                const [tokens] = await connection.execute(
                    `SELECT id, user_id, expires_at, used 
                     FROM password_reset_tokens 
                     WHERE token = ?`,
                    [token]
                );

                if (tokens.length === 0) {
                    console.log(`[AUTH-RESET-PASSWORD] Token no encontrado: ${token.substring(0, 10)}...`);
                    return res.status(400).json({
                        success: false,
                        error: 'El enlace de recuperación no es válido'
                    });
                }

                const tokenData = tokens[0];

                // Verificar si el token ya fue usado
                if (tokenData.used === 1) {
                    console.log(`[AUTH-RESET-PASSWORD] Token ya usado: ${token.substring(0, 10)}...`);
                    return res.status(400).json({
                        success: false,
                        error: 'Este enlace ya fue utilizado'
                    });
                }

                // Verificar si el token expiró
                const now = new Date();
                const expiresAt = new Date(tokenData.expires_at);
                if (now > expiresAt) {
                    console.log(`[AUTH-RESET-PASSWORD] Token expirado: ${token.substring(0, 10)}...`);
                    return res.status(400).json({
                        success: false,
                        error: 'El enlace de recuperación ha expirado'
                    });
                }

                // Hashear nueva contraseña
                const newPasswordHash = await hashPassword(newPassword);

                // Actualizar contraseña del usuario
                await connection.execute(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [newPasswordHash, tokenData.user_id]
                );

                // Marcar token como usado
                await connection.execute(
                    'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
                    [tokenData.id]
                );

                console.log(`[AUTH-RESET-PASSWORD] ✅ Contraseña actualizada para usuario ${tokenData.user_id}`);

                res.json({
                    success: true,
                    message: 'Tu contraseña ha sido actualizada exitosamente'
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH-RESET-PASSWORD] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar la contraseña'
            });
        }
    });

    // ==================== ACCOUNT ACTIVATION ====================
    app.get('/api/auth/activate/:token', async (req, res) => {
        const { token } = req.params;

        try {
            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'Token de activación requerido'
                });
            }

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar usuario con este token
                const [users] = await connection.execute(
                    'SELECT id, email, name, email_verification_expires FROM users WHERE email_verification_token = ?',
                    [token]
                );

                if (users.length === 0) {
                    console.log(`[AUTH-ACTIVATE] Token no encontrado: ${token.substring(0, 10)}...`);
                    return res.status(400).json({
                        success: false,
                        error: 'El enlace de activación no es válido'
                    });
                }

                const user = users[0];

                // Verificar si el token expiró
                const now = new Date();
                const expiresAt = new Date(user.email_verification_expires);
                if (now > expiresAt) {
                    console.log(`[AUTH-ACTIVATE] Token expirado para: ${user.email}`);
                    return res.status(400).json({
                        success: false,
                        error: 'El enlace de activación ha expirado',
                        expired: true,
                        email: user.email
                    });
                }

                // Activar cuenta
                await connection.execute(
                    'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
                    [user.id]
                );

                console.log(`[AUTH-ACTIVATE] ✅ Cuenta activada: ${user.email}`);

                res.json({
                    success: true,
                    message: 'Tu cuenta ha sido activada exitosamente',
                    email: user.email,
                    name: user.name
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH-ACTIVATE] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al activar la cuenta'
            });
        }
    });

    // ==================== RESEND ACTIVATION EMAIL ====================
    app.post('/api/auth/resend-activation', async (req, res) => {
        const { email } = req.body;

        try {
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email es requerido'
                });
            }

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
                return res.status(503).json({ success: false, error: 'Database not initialized' });
            }
            const connection = await dbPool.getConnection();

            try {
                // Buscar usuario
                const [users] = await connection.execute(
                    'SELECT id, name, email, email_verified FROM users WHERE email = ?',
                    [email]
                );

                if (users.length === 0) {
                    // Por seguridad, no revelar si el email existe
                    console.log(`[AUTH-RESEND] Email no encontrado: ${email}`);
                    return res.json({
                        success: true,
                        message: 'Si el correo existe y no está activado, recibirás un nuevo enlace'
                    });
                }

                const user = users[0];

                // Verificar si ya está activado
                if (user.email_verified === 1) {
                    console.log(`[AUTH-RESEND] Cuenta ya activada: ${email}`);
                    return res.json({
                        success: true,
                        message: 'Tu cuenta ya está activada. Puedes iniciar sesión.'
                    });
                }

                // Generar nuevo token
                const crypto = require('crypto');
                const emailVerificationToken = crypto.randomBytes(32).toString('hex');
                const emailVerificationExpires = new Date(Date.now() + 24 * 3600000); // 24 horas

                // Actualizar token en BD
                await connection.execute(
                    'UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?',
                    [emailVerificationToken, emailVerificationExpires, user.id]
                );

                console.log(`[AUTH-RESEND] Nuevo token generado para: ${email}`);

                // Reenviar email
                const { sendWelcomeEmail } = require('./utils/emailService');
                const emailSent = await sendWelcomeEmail(email, user.name, emailVerificationToken);

                if (!emailSent) {
                    console.error('[AUTH-RESEND] Error enviando correo');
                    return res.status(500).json({
                        success: false,
                        error: 'Error al enviar el correo. Intente nuevamente.'
                    });
                }

                console.log(`[AUTH-RESEND] ✅ Correo reenviado a: ${email}`);

                res.json({
                    success: true,
                    message: 'Te hemos enviado un nuevo correo de activación'
                });

            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('[AUTH-RESEND] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Error al reenviar el correo'
            });
        }
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

            const dbPool = global.dbPool || pool;
            if (!dbPool || typeof dbPool.getConnection !== 'function') {
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
                    const dbPool = global.dbPool || pool;
                    if (!dbPool || typeof dbPool.getConnection !== 'function') {
                        return res.status(503).json({ success: false, error: 'Database not initialized' });
                    }

                    let userConn;
                    try {
                        userConn = await dbPool.getConnection();
                        const [userRows] = await userConn.execute(
                            'SELECT phone FROM users WHERE id = ? LIMIT 1',
                            [userId]
                        );

                        if (userRows.length > 0 && userRows[0].phone) {
                            sessionInfo.phoneNumber = userRows[0].phone;
                            console.log(`[AUTH-LINK] ✅ phoneNumber guardado: ${userRows[0].phone}`);
                        }
                    } catch (phoneErr) {
                        console.warn('[AUTH-LINK] ⚠️ Error obteniendo teléfono:', phoneErr.message);
                    } finally {
                        if (userConn) {
                            userConn.release();
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
