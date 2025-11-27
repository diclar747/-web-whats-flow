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
 * IMPORTANTE: Permite múltiples sesiones por usuario (no cierra sesiones previas)
 */
const createUniqueSession = (userId, deviceId, email, role, io = null) => {
    // NO cerrar sesiones previas - Permitir múltiples sesiones por usuario
    console.log(`[SESSION] 🔐 Creando nueva sesión para ${email} en dispositivo ${deviceId.substr(0, 20)}...`);
    
    // Verificar si ya existe una sesión para este dispositivo específico
    let existingSessionForDevice = null;
    for (const [token, session] of activeSessions.entries()) {
        if (session.userId === userId && session.deviceId === deviceId) {
            existingSessionForDevice = token;
            break;
        }
    }
    
    // Si ya existe una sesión para este dispositivo, reutilizarla
    if (existingSessionForDevice) {
        console.log(`[SESSION] 🔄 Reutilizando sesión existente para dispositivo ${deviceId.substr(0, 20)}...`);
        activeSessions.get(existingSessionForDevice).lastActivity = Date.now();
        return existingSessionForDevice;
    }
    
    // SEGUNDO: Crear la nueva sesión
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
