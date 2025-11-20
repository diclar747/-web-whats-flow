const crypto = require('crypto');

/**
 * Genera un fingerprint único basado en información del cliente
 * @param {Object} req - Request object de Express
 * @returns {string} - Hash único del dispositivo
 */
function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.ip || req.connection.remoteAddress || '',
    // No incluimos cookies ni headers que cambien frecuentemente
  ];
  
  const fingerprint = components.join('|');
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

/**
 * Valida que el fingerprint del request coincida con el del token
 * @param {Object} req - Request object
 * @param {string} tokenFingerprint - Fingerprint guardado en el token
 * @returns {boolean} - true si coinciden
 */
function validateDeviceFingerprint(req, tokenFingerprint) {
  const currentFingerprint = generateDeviceFingerprint(req);
  return currentFingerprint === tokenFingerprint;
}

/**
 * Extrae información adicional del dispositivo para logs
 * @param {Object} req - Request object
 * @returns {Object} - Info del dispositivo
 */
function getDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Detectar tipo de dispositivo
  let deviceType = 'desktop';
  if (/mobile/i.test(userAgent)) deviceType = 'mobile';
  if (/tablet/i.test(userAgent)) deviceType = 'tablet';
  
  // Detectar navegador
  let browser = 'Unknown';
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/edge/i.test(userAgent)) browser = 'Edge';
  else if (/opera|opr/i.test(userAgent)) browser = 'Opera';
  
  // Detectar OS
  let os = 'Unknown';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/ios|iphone|ipad/i.test(userAgent)) os = 'iOS';
  
  return {
    deviceType,
    browser,
    os,
    ip: req.ip || req.connection.remoteAddress || 'Unknown',
    userAgent: userAgent.substring(0, 100) // Limitar longitud
  };
}

module.exports = {
  generateDeviceFingerprint,
  validateDeviceFingerprint,
  getDeviceInfo
};
