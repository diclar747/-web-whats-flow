const jwt = require('jsonwebtoken');

// Ensure JWT_SECRET is available
const JWT_SECRET = process.env.JWT_SECRET || '0927450953d52b804a8e511e5a7f2f35bbd20f6c4c156902b4e0902214795eb4c6dafffc36e40489d6eda1ae3963ac42c2d043ab3a4a6382bc62c70fe8ed3a7b';

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
