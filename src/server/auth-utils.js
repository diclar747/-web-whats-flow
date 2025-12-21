const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// JWT Secret - En producción debe estar en .env
const JWT_SECRET = process.env.JWT_SECRET || 'WhatsFlow2025!SecretKey';
const JWT_EXPIRES_IN = '7d'; // Token válido por 7 días

/**
 * Generar hash de contraseña
 */
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Verificar contraseña
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Generar JWT token
 */
function generateToken(user, customRole = null) {
    // Determinar rol del usuario
    let userRole = customRole || user.role || 'admin';

    const payload = {
        id: user.id,
        userId: user.id,
        email: user.email,
        phone: user.phone_number || user.phone,
        phoneNumber: user.phone_number || user.phone,
        role: userRole
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verificar JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Middleware de autenticación
 */
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Token no proporcionado'
        });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            error: 'Token inválido o expirado'
        });
    }

    req.user = decoded;
    next();
}

/**
 * Middleware para super admin
 */
function requireSuperAdmin(req, res, next) {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            error: 'Acceso denegado: Se requieren permisos de super admin'
        });
    }
    next();
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    authenticateJWT,
    requireSuperAdmin
};
