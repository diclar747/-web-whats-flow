/**
 * Token Blacklist - Almacena tokens JWT revocados en memoria
 * Los tokens se eliminan automáticamente después de expirar (limpieza cada hora)
 */

// Map de tokens revocados: token -> timestamp de expiración
const blacklistedTokens = new Map();

// Intervalo de limpieza: cada hora eliminar tokens expirados
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [token, expiresAt] of blacklistedTokens.entries()) {
        if (expiresAt < now) {
            blacklistedTokens.delete(token);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`[TOKEN-BLACKLIST] Limpiados ${cleaned} tokens expirados. Total activos: ${blacklistedTokens.size}`);
    }
}, 60 * 60 * 1000); // Cada hora

/**
 * Agregar token a la blacklist
 * @param {string} token - JWT token a revocar
 * @param {number} expiresInMs - Tiempo en ms hasta que expire (default 7 días)
 */
function blacklistToken(token, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
    if (!token) return;
    blacklistedTokens.set(token, Date.now() + expiresInMs);
}

/**
 * Verificar si un token está en la blacklist
 * @param {string} token - JWT token a verificar
 * @returns {boolean} true si está revocado
 */
function isTokenBlacklisted(token) {
    if (!token) return false;

    const expiresAt = blacklistedTokens.get(token);
    if (!expiresAt) return false;

    // Si ya expiró, eliminar y retornar false
    if (expiresAt < Date.now()) {
        blacklistedTokens.delete(token);
        return false;
    }

    return true;
}

/**
 * Obtener cantidad de tokens en blacklist
 */
function getBlacklistSize() {
    return blacklistedTokens.size;
}

module.exports = {
    blacklistToken,
    isTokenBlacklisted,
    getBlacklistSize
};
