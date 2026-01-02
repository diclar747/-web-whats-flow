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

  // Obtener credenciales de sesión desde storage (aceptar claves históricas)
  const sessionToken = sessionStorage.getItem('sessionToken')
    || localStorage.getItem('sessionToken')
    || sessionStorage.getItem('whatsflow_session_token')
    || localStorage.getItem('whatsflow_session_token');

  const deviceId = sessionStorage.getItem('device_id')
    || localStorage.getItem('device_id')
    || sessionStorage.getItem('deviceId')
    || localStorage.getItem('deviceId')
    || sessionStorage.getItem('whatsflow_device_id')
    || localStorage.getItem('whatsflow_device_id')
    || sessionStorage.getItem('whatsflow_session_device_id')
    || localStorage.getItem('whatsflow_session_device_id');

  const token = sessionStorage.getItem('token')
    || localStorage.getItem('token')
    || sessionStorage.getItem('whatsflow_token')
    || localStorage.getItem('whatsflow_token');

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
    console.warn(`⚠️ [sessionFetch] Error ${response.status} en: ${url}`);
    try {
      const data = await response.clone().json();
      console.warn('[sessionFetch] Response data:', data);

      // Solo redirigir si explícitamente se requiere re-autenticación
      // NO redirigir para admins conectados por QR sin token
      if (data.requiresReauth || data.requireReauth) {
        console.warn('🚫 Sesión inválida detectada (requiresReauth=true), limpiando y redirigiendo...');
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = '/';
      } else {
        console.warn('[sessionFetch] Error de autorización pero NO se requiere reauth. Continuando...');
      }
    } catch (err) {
      console.error('[sessionFetch] Error parsing JSON response:', err);
    }
  }

  return response;
};

/**
 * Verificar si hay una sesión activa válida
 */
export const hasValidSession = (): boolean => {
  const sessionToken = sessionStorage.getItem('sessionToken')
    || localStorage.getItem('sessionToken')
    || sessionStorage.getItem('whatsflow_session_token')
    || localStorage.getItem('whatsflow_session_token');

  const deviceId = sessionStorage.getItem('device_id')
    || localStorage.getItem('device_id')
    || sessionStorage.getItem('deviceId')
    || localStorage.getItem('deviceId')
    || sessionStorage.getItem('whatsflow_device_id')
    || localStorage.getItem('whatsflow_device_id')
    || sessionStorage.getItem('whatsflow_session_device_id')
    || localStorage.getItem('whatsflow_session_device_id');

  const token = sessionStorage.getItem('token')
    || localStorage.getItem('token')
    || sessionStorage.getItem('whatsflow_token')
    || localStorage.getItem('whatsflow_token');
  
  return !!(sessionToken && deviceId && token);
};

/**
 * Limpiar sesión completamente
 */
export const clearSession = (): void => {
  sessionStorage.clear();
  console.log('🧹 Sesión limpiada completamente');
};
