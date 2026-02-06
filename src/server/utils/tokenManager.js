const jwt = require('jsonwebtoken');

// Ensure JWT_SECRET is available
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('[SECURITY] JWT_SECRET no está configurado en variables de entorno. El servidor no puede iniciar sin esta configuración.');
}

/**
 * Generate a JWT token for a user (Admin or Agent)
 * @param {Object} payload - User data to include in the token
 * @param {string} expiresIn - Token expiration time (default: '24h')
 * @returns {string} - The generated JWT token
 */
function generateToken(payload, expiresIn = '24h') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify a JWT token
 * @param {string} token - The token to verify
 * @returns {Object} - The decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = {
    generateToken,
    verifyToken
};
