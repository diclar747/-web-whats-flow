const jwt = require('jsonwebtoken');
const { validateDeviceFingerprint } = require('../utils/deviceFingerprint');

// Middleware para proteger rutas que requieren autenticación
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        // Alternativas: sessionId en headers o query
        const sessionIdHeader = req.headers['x-session-id'];
        const sessionIdQuery = req.query.sessionId || req.body.sessionId;
        const sessionId = sessionIdHeader || sessionIdQuery;

        // Si hay token JWT, usarlo (usuarios con login normal)
        if (token) {
            jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-this', (err, user) => {
                if (err) {
                    if (err.name === 'TokenExpiredError') {
                        return res.status(403).json({ 
                            success: false, 
                            error: 'Token expirado. Por favor, inicia sesión nuevamente.' 
                        });
                    }
                    if (err.name === 'JsonWebTokenError') {
                        return res.status(403).json({ 
                            success: false, 
                            error: 'Token inválido.' 
                        });
                    }
                    return res.status(403).json({ 
                        success: false, 
                        error: 'Error al verificar token.' 
                    });
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
                
                req.user = user;
                next();
            });
        }
        // Si no hay token pero hay sessionId, permitir acceso (usuarios de WhatsApp)
        else if (sessionId) {
            console.log(`[AUTH] Autenticación por sessionId: ${sessionId}`);
            req.user = {
                id: sessionId,
                phone: sessionId,
                role: 'admin', // Los usuarios de WhatsApp son admin por defecto
                authenticatedBy: 'whatsapp-qr'
            };
            next();
        }
        // Si no hay ni token ni sessionId, denegar acceso
        else {
            return res.status(401).json({ 
                success: false, 
                error: 'Acceso denegado. Token o sessionId no proporcionado.' 
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