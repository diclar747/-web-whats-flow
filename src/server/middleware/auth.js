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
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({
                    success: false,
                    error: 'Token expirado. Por favor, inicia sesión nuevamente.'
                });
            }
            return res.status(403).json({
                success: false,
                error: 'Token inválido.'
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