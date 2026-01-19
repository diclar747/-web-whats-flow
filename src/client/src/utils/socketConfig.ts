/**
 * Obtiene la URL del servidor Socket.IO según el entorno
 * En desarrollo: usa localhost
 * En producción: nginx maneja SSL termination y proxy
 */
export const getSocketURL = (): string => {
  // En desarrollo, usar localhost puerto 3002 (backend)
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  // En producción, usar el mismo protocolo y hostname que la página actual
  // Nginx se encargará de hacer proxy de /socket.io/ al backend
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.host}`;
};

/**
 * Obtiene la URL base de la API
 */
export const getAPIBaseURL = (): string => {
  // Verificar si estamos en un entorno de desarrollo con proxy
  // Si REACT_APP_API_BASE_URL está definida, usarla (útil para pruebas)
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  // Si la URL actual contiene localhost o 127.0.0.1, probablemente estamos en desarrollo
  // o un entorno donde necesitamos conectar directamente al backend
  const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

  // En desarrollo local o cuando se accede directamente al frontend en localhost
  if (process.env.NODE_ENV === 'development' || isLocalhost) {
    return 'http://localhost:3000';
  }

  // En producción o cuando se accede a través del dominio configurado
  // Usar URL relativa para que el proxy de nginx maneje las solicitudes
  return '';
};
