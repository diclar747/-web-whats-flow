/**
 * Fetch wrapper que incluye automáticamente sessionToken y deviceId
 * para validación de sesiones únicas
 */

interface SessionFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export const sessionFetch = async (url: string, options: SessionFetchOptions = {}): Promise<Response> => {
  const { skipAuth, ...fetchOptions } = options;

  // Si no se debe incluir autenticación, hacer fetch normal
  if (skipAuth) {
    return fetch(url, fetchOptions);
  }

  // Obtener credenciales de sesión desde sessionStorage
  const sessionToken = sessionStorage.getItem('sessionToken');
  const deviceId = sessionStorage.getItem('device_id');
  const token = sessionStorage.getItem('token') || sessionStorage.getItem('whatsflow_token');

  // Preparar headers
  const headers = new Headers(fetchOptions.headers);
  
  if (sessionToken) {
    headers.set('X-Session-Token', sessionToken);
  }
  
  if (deviceId) {
    headers.set('X-Device-Id', deviceId);
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Hacer petición con headers de sesión
  const response = await fetch(url, {
    ...fetchOptions,
    headers
  });

  // Si la respuesta indica que se requiere re-autenticación, limpiar sesión y redirigir
  if (response.status === 401 || response.status === 403) {
    try {
      const data = await response.clone().json();
      if (data.requiresReauth) {
        console.warn('🚫 Sesión inválida detectada, limpiando y redirigiendo...');
        sessionStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      // Ignorar errores de parsing JSON
    }
  }

  return response;
};

/**
 * Verificar si hay una sesión activa válida
 */
export const hasValidSession = (): boolean => {
  const sessionToken = sessionStorage.getItem('sessionToken');
  const deviceId = sessionStorage.getItem('device_id');
  const token = sessionStorage.getItem('token') || sessionStorage.getItem('whatsflow_token');
  
  return !!(sessionToken && deviceId && token);
};

/**
 * Limpiar sesión completamente
 */
export const clearSession = (): void => {
  sessionStorage.clear();
  console.log('🧹 Sesión limpiada completamente');
};
