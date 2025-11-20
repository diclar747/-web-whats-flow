const rateLimit = require('express-rate-limit');

// Rate limiter general para todas las rutas (MUY PERMISIVO)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // Máximo 1000 requests por ventana (aumentado de 100)
    message: {
        success: false,
        error: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Permitir requests desde localhost y IPs privadas
        const ip = req.ip || req.connection.remoteAddress;
        return ip === '127.0.0.1' || 
               ip === '::1' || 
               ip === 'localhost' ||
               ip?.startsWith('192.168.') ||
               ip?.startsWith('10.') ||
               ip?.startsWith('172.');
    }
});

// Rate limiter para autenticación (menos estricto)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // Máximo 20 intentos de login (aumentado de 5)
    message: {
        success: false,
        error: 'Demasiados intentos de autenticación. Por favor intenta en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // No contar requests exitosos
});

// Rate limiter para envío de mensajes por API
const apiMessageLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 120, // Máximo 120 mensajes por minuto (aumentado de 30)
    message: {
        success: false,
        error: 'Límite de envío de mensajes alcanzado. Máximo 120 mensajes por minuto.'
    },
    standardHeaders: true,
    legacyHeaders: false
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
    legacyHeaders: false
});

// Rate limiter para QR code generation
const qrLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 30, // Máximo 30 QR codes en 5 minutos (aumentado de 10)
    message: {
        success: false,
        error: 'Demasiadas solicitudes de código QR. Intenta más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    generalLimiter,
    authLimiter,
    apiMessageLimiter,
    webhookLimiter,
    qrLimiter
};
