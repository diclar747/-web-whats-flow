const jwt = require('jsonwebtoken');
const { validateDeviceFingerprint } = require('../utils/deviceFingerprint');

// Middleware para proteger rutas que requieren autenticación
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Acceso denegado. Token no proporcionado.'
            });
        }

        const { verifyToken } = require('../utils/tokenManager');

        try {
            const user = verifyToken(token);
            console.log('[AUTH-MIDDLEWARE] Token verified:', user); // DEBUG LOG

            // CASO ESPECIAL: ADMIN (Token basado en sesión/teléfono, no ID de tabla users)
            if ((user.role === 'admin' || user.role === 'supervisor') && user.phone) {
                // Admin "es" la sesión, no depende de ella
                // Si no tiene ID numérico, asignamos uno temporal
                if (!user.id) {
                    user.id = 'admin_' + user.phone;
                    user.dbId = null; // No hay row en users para FKs
                }
                req.user = user;
                return next();
            }

            // 🔒 VALIDACIÓN DE DISPOSITIVO: Verificar que el token se use en el mismo dispositivo
            if (user.deviceFingerprint && !validateDeviceFingerprint(req, user.deviceFingerprint)) {
                console.warn(`⚠️ Intento de uso de token desde dispositivo diferente: User ${user.id} (${user.email})`);
                return res.status(403).json({
                    success: false,
                    error: 'Sesión inválida. Este token fue generado en otro dispositivo. Por favor, inicia sesión nuevamente.',
                    requireReauth: true
                });
            }

            // 🔒 VALIDACIÓN DE DEPENDENCIA DE SESIÓN (Solo para Agentes)
            if (user.role === 'agent') {
                // Obtener el mapa de sesiones activas desde la app
                const sessions = req.app.get('sessions');
                if (sessions) {
                    const adminSessionId = user.session_id || user.phone; // Asumiendo que session_id es el teléfono del admin
                    // Verificar si la sesión del admin está activa (conectada)
                    // Nota: sessions es un Map donde la key es el sessionId y el valor es el objeto de sesión
                    // Necesitamos verificar si existe Y si está conectado
                    const adminSession = sessions.get(adminSessionId);

                    // Si no hay sesión activa del admin, denegar acceso
                    // EXCEPCIÓN: Si el sistema está en modo "sin conexión requerida" (opcional, por ahora estricto)
                    if (!adminSession || !adminSession.sock) {
                        console.warn(`⚠️ Agente ${user.email} intentó acceder pero Admin ${adminSessionId} no está conectado.`);
                        return res.status(403).json({
                            success: false,
                            error: 'La sesión del Administrador no está activa. No se pueden realizar acciones.',
                            code: 'ADMIN_SESSION_INACTIVE'
                        });
                    }
                }
            }

            req.user = user;
            next();
        } catch (err) {
            console.error('[AUTH-MIDDLEWARE] Token Verification Failed:', err.message);
            console.log('[AUTH-DEBUG] Received Token:', token.substring(0, 15) + '...', 'Length:', token.length);

            // FALLBACK: Intentar decodificar como token Legacy (Base64)
            try {
                const decoded = Buffer.from(token, 'base64').toString('utf-8');
                console.log('[AUTH-DEBUG] Fallback Decoded:', decoded);
                const [userId, email, timestamp, tokenHash] = decoded.split(':');

                if ((userId || email) && (userId.length > 5 || email.length > 5)) {
                    console.log('[AUTH-MIDDLEWARE] Legacy Token accepted (Relaxed):', { userId, email });

                    const user = {
                        id: userId || 'legacy_' + Date.now(),
                        dbId: null, // Legacy tokens typically don't map to new ID schema instantly
                        email: email,
                        role: 'agent', // Default to agent
                        status: 'active',
                        session_id: null,
                        phone: email && !email.includes('@') ? email : null
                    };

                    // Si parece ser admin (telefono como email)
                    if (user.phone) {
                        user.role = 'admin';
                        user.id = 'admin_' + user.phone;
                        user.name = 'Admin Legacy';
                    }

                    req.user = user;
                    return next();
                } else {
                    console.warn('[AUTH-DEBUG] Legacy fallback rejected: userId/email too short or missing', { userId, email });
                }
            } catch (legacyError) {
                console.error('[AUTH-MIDDLEWARE] Legacy fallback failed:', legacyError.message);
            }

            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({
                    success: false,
                    error: 'Token expirado. Por favor, inicia sesión nuevamente.'
                });
            }
            return res.status(403).json({
                success: false,
                error: `Token inválido: ${err.message}. Fallback rejected.`
            });
        }
    } catch (error) {
        console.error('[AUTH] Error en authenticateToken:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor.'
        });
    }
};

// Middleware para verificar roles específicos
const authorizeRole = (...roles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Acceso denegado. Usuario no autenticado.'
                });
            }

            if (!roles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: 'Acceso denegado. No tienes permisos suficientes.',
                    requiredRole: roles,
                    currentRole: req.user.role
                });
            }

            next();
        } catch (error) {
            console.error('[AUTH] Error en authorizeRole:', error);
            return res.status(500).json({
                success: false,
                error: 'Error interno del servidor.'
            });
        }
    };
};

module.exports = {
    authenticateToken,
    authorizeRole
};