const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('[SECURITY] JWT_SECRET no está configurado en variables de entorno.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Función para hashear contraseña
async function hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

// Función para verificar contraseña
async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

// Función para generar token JWT
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            userType: user.user_type,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token de acceso requerido'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Token inválido o expirado'
            });
        }
        req.user = user;
        next();
    });
}

// Middleware para verificar tipo de usuario
function requireUserType(userTypes) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Autenticación requerida'
            });
        }

        if (!userTypes.includes(req.user.userType)) {
            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para esta acción'
            });
        }

        next();
    };
}

// Middleware para verificar si es admin
function requireAdmin(req, res, next) {
    return requireUserType(['admin'])(req, res, next);
}

// Middleware para verificar si es anunciante o admin
function requireAdvertiserOrAdmin(req, res, next) {
    return requireUserType(['advertiser', 'admin'])(req, res, next);
}

// Función para obtener usuario por ID
async function getUserById(userId) {
    if (!pool) {
        throw new Error('Base de datos no disponible');
    }

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            'SELECT id, name, email, user_type, country, city, phone, avatar_url, is_active, email_verified, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );

        return rows[0] || null;
    } finally {
        connection.release();
    }
}

// Función para obtener usuario por email
async function getUserByEmail(email) {
    if (!pool) {
        throw new Error('Base de datos no disponible');
    }

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            'SELECT id, name, email, password, user_type, country, city, phone, avatar_url, is_active, email_verified, created_at, updated_at FROM users WHERE email = ?',
            [email]
        );

        return rows[0] || null;
    } finally {
        connection.release();
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    authenticateToken,
    requireUserType,
    requireAdmin,
    requireAdvertiserOrAdmin,
    getUserById,
    getUserByEmail,
    JWT_SECRET,
    JWT_EXPIRES_IN
};