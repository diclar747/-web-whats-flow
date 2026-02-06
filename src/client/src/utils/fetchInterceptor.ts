/**
 * Interceptor global de fetch para agregar automáticamente
 * headers de sesión única (sessionToken y deviceId)
 */

// Guardar referencia al fetch original
const originalFetch = window.fetch;

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/admin/login',
  '/api/generate-device-id',
  '/api/qr-status',
  '/api/qr-code',
  '/api/session-status',
  '/api/whatsapp-status',
  '/api/create-session',
  '/api/register-session',
  '/api/logout-session',
  '/health'
];

/**
 * Verificar si una URL es pública (no requiere autenticación)
 */
const isPublicRoute = (url: string): boolean => {
  return PUBLIC_ROUTES.some(route => url.includes(route));
};

/**
 * Interceptor de fetch que agrega automáticamente headers de sesión
 */
export const setupFetchInterceptor = (): void => {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Normalizar sessionId/phone que vengan con sufijos tipo ":1"
    let normalizedUrl = rawUrl;
    try {
      const urlObj = new URL(rawUrl, window.location.origin);

      // 1. Limpiar sufijos ":<num>" en pathname - Dividir cada segmento por ':' y tomar el primero
      const segments = urlObj.pathname.split('/');
      const cleanSegments = segments.map(seg => seg.includes(':') ? seg.split(':')[0] : seg);
      urlObj.pathname = cleanSegments.join('/');

      // 2. Normalizar todos los query params que puedan tener ":X"
      const keysToClean = Array.from(urlObj.searchParams.keys());
      keysToClean.forEach((key) => {
        const val = urlObj.searchParams.get(key);
        if (val !== null && val.includes(':')) {
          const clean = val.split(':')[0];
          if (clean) {
            urlObj.searchParams.set(key, clean);
          } else {
            urlObj.searchParams.delete(key);
          }
        }
      });

      normalizedUrl = urlObj.pathname + urlObj.search + urlObj.hash;
    } catch (e) {
      // Fallback si falla el parseo de URL
      normalizedUrl = rawUrl.replace(/:(\d+)(?=@|$|\/|\?|&)/g, '');
    }

    // Si es ruta pública, usar fetch original sin headers
    if (isPublicRoute(normalizedUrl)) {
      console.log('[FETCH-INTERCEPTOR] ✅ Ruta pública, sin validación:', normalizedUrl);
      return originalFetch(normalizedUrl, init);
    }

    // Obtener credenciales de sesión (con múltiples fallbacks para claves previas)
    const sessionToken = sessionStorage.getItem('sessionToken')
      || localStorage.getItem('sessionToken')
      || sessionStorage.getItem('whinsap_session_token')
      || localStorage.getItem('whinsap_session_token');

    const deviceId = sessionStorage.getItem('device_id')
      || localStorage.getItem('device_id')
      || sessionStorage.getItem('deviceId')
      || localStorage.getItem('deviceId')
      || sessionStorage.getItem('whinsap_device_id')
      || localStorage.getItem('whinsap_device_id')
      || sessionStorage.getItem('whinsap_session_device_id')
      || localStorage.getItem('whinsap_session_device_id');

    const token = sessionStorage.getItem('token')
      || localStorage.getItem('token')
      || sessionStorage.getItem('whinsap_token')
      || localStorage.getItem('whinsap_token');

    // Agregar headers de autenticación (usar los que existan; no omitir Authorization si falta deviceId)
    const headers = new Headers(init?.headers);

    if (sessionToken) {
      headers.set('X-Session-Token', sessionToken);
    }

    if (deviceId) {
      headers.set('X-Device-Id', deviceId);
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Hacer petición con headers actualizados
    try {
      const response = await originalFetch(normalizedUrl, {
        ...init,
        headers
      });

      // Manejar respuestas de sesión inválida
      if (response.status === 401 || response.status === 403) {
        try {
          const data = await response.clone().json();

          // ✅ NO limpiar sesión si estamos en modo Admin por QR esperando token
          const isAdminQRMode = window.location.pathname.startsWith('/dashboard/');
          const userRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');

          if (isAdminQRMode || userRole === 'admin') {
            console.log('[FETCH-INTERCEPTOR] ⚠️ Error 401/403 pero en modo Admin por QR - NO limpiar sesión');
            console.log('[FETCH-INTERCEPTOR] ℹ️ Token JWT se recibirá via Socket.IO cuando WhatsApp conecte');
            return response; // Retornar respuesta sin limpiar sesión
          }

          if (data.requiresReauth) {
            console.error('[FETCH-INTERCEPTOR] 🚫 Sesión inválida:', data.error);

            // ⛔ VERIFICAR SI EL USUARIO ESTÁ BLOQUEADO
            if (data.isBlocked) {
              console.log('[FETCH-INTERCEPTOR] 🚫 Usuario bloqueado, redirigiendo a AccountBlocked');
              sessionStorage.clear();
              // Usar window.location para forzar la navegación fuera del interceptor
              window.location.href = `/account-blocked?supportPhone=${data.supportPhone || '595994854167'}`;
              return response;
            }

            // Limpiar sessionStorage Y localStorage de tokens
            sessionStorage.clear();
            localStorage.removeItem('token');
            localStorage.removeItem('whinsap_token');
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('whinsap_session_token');
            localStorage.removeItem('deviceId');
            localStorage.removeItem('device_id');
            localStorage.removeItem('whinsap_device_id');
            localStorage.removeItem('whinsap_session_device_id');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('userEmail');

            // Redirigir a login
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
        } catch (err) {
          // Ignorar errores de parsing
        }
      }

      return response;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('[FETCH-INTERCEPTOR] ⛔ Petición abortada (no es error):', normalizedUrl);
        throw error; // Mantener semántica de fetch: promesa rechazada por aborto
      }
      console.error('[FETCH-INTERCEPTOR] ❌ Error en petición:', error);
      throw error;
    }
  };

  console.log('[FETCH-INTERCEPTOR] ✅ Interceptor de fetch activado');
};

/**
 * Restaurar fetch original (útil para testing)
 */
export const restoreFetch = (): void => {
  window.fetch = originalFetch;
  console.log('[FETCH-INTERCEPTOR] 🔄 Fetch original restaurado');
};
