const rateLimit = require('express-rate-limit');

// Rate limiter general para todas las rutas
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 300, // Máximo 300 requests por ventana
    message: {
        success: false,
        error: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    skip: (req) => {
        // Solo permitir localhost (no toda la red privada)
        const ip = req.ip || req.connection.remoteAddress;
        return ip === '127.0.0.1' || ip === '::1';
    }
});

// Rate limiter para autenticación (estricto contra fuerza bruta)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 intentos de login
    message: {
        success: false,
        error: 'Demasiados intentos de autenticación. Por favor intenta en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    skipSuccessfulRequests: true // No contar requests exitosos
});

// Rate limiter para envío de mensajes por API
const apiMessageLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 120, // Máximo 120 mensajes por minuto
    message: {
        success: false,
        error: 'Límite de envío de mensajes alcanzado. Máximo 120 mensajes por minuto.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
});

// Rate limiter para webhooks
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60, // Máximo 60 webhooks por minuto
    message: {
        success: false,
        error: 'Límite de webhooks alcanzado.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
});

// Rate limiter para QR code generation
const qrLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 15, // Máximo 15 QR codes en 5 minutos
    message: {
        success: false,
        error: 'Demasiadas solicitudes de código QR. Intenta más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }
});

module.exports = {
    generalLimiter,
    authLimiter,
    apiMessageLimiter,
    webhookLimiter,
    qrLimiter
};
