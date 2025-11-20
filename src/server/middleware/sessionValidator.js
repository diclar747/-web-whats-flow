const crypto = require('crypto');

// Mapa de sesiones activas: sessionToken -> { userId, deviceId, email, createdAt, lastActivity }
const activeSessions = new Map();

// Tiempo de expiración de sesión: 24 horas
const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * Middleware para validar que la sesión sea única por dispositivo
 */
const validateUniqueSession = (req, res, next) => {
    const sessionToken = req.headers['x-session-token'] || req.query.sessionToken;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;

    if (!sessionToken || !deviceId) {
        return res.status(401).json({ 
            success: false, 
            error: 'Session token y device ID requeridos',
            requiresReauth: true
        });
    }

    const session = activeSessions.get(sessionToken);

    if (!session) {
        return res.status(401).json({ 
            success: false, 
            error: 'Sesión no válida o expirada',
            requiresReauth: true
        });
    }

    // Verificar que el deviceId coincida
    if (session.deviceId !== deviceId) {
        console.log(`[SESSION] 🚫 Intento de acceso desde otro dispositivo bloqueado`);
        console.log(`  - Session: ${session.email}`);
        console.log(`  - Device esperado: ${session.deviceId.substr(0, 20)}...`);
        console.log(`  - Device recibido: ${deviceId.substr(0, 20)}...`);
        
        return res.status(403).json({ 
            success: false, 
            error: 'Esta sesión está activa en otro dispositivo',
            requiresReauth: true
        });
    }

    // Verificar expiración
    const now = Date.now();
    if (now - session.lastActivity > SESSION_EXPIRY) {
        activeSessions.delete(sessionToken);
        return res.status(401).json({ 
            success: false, 
            error: 'Sesión expirada',
            requiresReauth: true
        });
    }

    // Actualizar última actividad
    session.lastActivity = now;
    
    // Adjuntar info de sesión al request
    req.session = session;
    req.sessionToken = sessionToken;
    
    next();
};

/**
 * Crear una nueva sesión única
 */
const createUniqueSession = (userId, deviceId, email, role) => {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    
    activeSessions.set(sessionToken, {
        userId,
        deviceId,
        email,
        role,
        createdAt: now,
        lastActivity: now
    });

    console.log(`[SESSION] ✅ Sesión única creada: ${email} en ${deviceId.substr(0, 20)}...`);
    
    return sessionToken;
};

/**
 * Cerrar sesión
 */
const destroySession = (sessionToken) => {
    const session = activeSessions.get(sessionToken);
    if (session) {
        console.log(`[SESSION] 👋 Sesión cerrada: ${session.email}`);
        activeSessions.delete(sessionToken);
        return true;
    }
    return false;
};

/**
 * Limpiar sesiones expiradas (ejecutar periódicamente)
 */
const cleanupExpiredSessions = () => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, session] of activeSessions.entries()) {
        if (now - session.lastActivity > SESSION_EXPIRY) {
            activeSessions.delete(token);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`[SESSION] 🧹 Limpiadas ${cleaned} sesiones expiradas`);
    }
};

// Limpiar sesiones cada hora
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

/**
 * Obtener info de todas las sesiones activas (para admin)
 */
const getActiveSessions = () => {
    const sessions = [];
    for (const [token, session] of activeSessions.entries()) {
        sessions.push({
            token: token.substr(0, 10) + '...',
            email: session.email,
            role: session.role,
            deviceId: session.deviceId.substr(0, 20) + '...',
            createdAt: new Date(session.createdAt).toISOString(),
            lastActivity: new Date(session.lastActivity).toISOString()
        });
    }
    return sessions;
};

module.exports = {
    validateUniqueSession,
    createUniqueSession,
    destroySession,
    cleanupExpiredSessions,
    getActiveSessions,
    activeSessions
};
