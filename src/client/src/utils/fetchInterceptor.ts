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
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Si es ruta pública, usar fetch original sin headers
    if (isPublicRoute(url)) {
      console.log('[FETCH-INTERCEPTOR] ✅ Ruta pública, sin validación:', url);
      return originalFetch(input, init);
    }

    // Obtener credenciales de sesión
    const sessionToken = sessionStorage.getItem('sessionToken');
    const deviceId = sessionStorage.getItem('device_id');
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('whatsflow_token');

    // Si no hay sessionToken o deviceId, hacer fetch sin headers (dejar que el backend maneje)
    // Esto permite que el dashboard funcione mientras se escanea el QR
    if (!sessionToken || !deviceId) {
      // Detectar si estamos en modo Admin por QR
      const isAdminQRMode = window.location.pathname.startsWith('/dashboard');
      const userRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
      const hasToken = sessionStorage.getItem('token') || localStorage.getItem('token');

      // NO mostrar advertencias para:
      // 1. Admin por QR (con o sin token todavía)
      // 2. Endpoints públicos que no requieren autenticación
      const url = typeof input === 'string' ? input : (input as Request).url;

      // Solo advertir si es endpoint crítico Y NO es admin Y NO tiene token
      if ((url.includes('/api/auth/') || url.includes('/api/admin/'))
          && !isAdminQRMode
          && userRole !== 'admin'
          && !hasToken) {
        console.warn('[FETCH-INTERCEPTOR] ⚠️ No hay sessionToken/deviceId para endpoint crítico:', url);
      } else {
        console.log('[FETCH-INTERCEPTOR] ℹ️ Sin sessionToken/deviceId, pero permitido para:', url);
      }

      return originalFetch(input, init);
    }

    // Agregar headers de autenticación
    const headers = new Headers(init?.headers);
    headers.set('X-Session-Token', sessionToken);
    headers.set('X-Device-Id', deviceId);
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Hacer petición con headers actualizados
    try {
      const response = await originalFetch(input, {
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

            // Limpiar sessionStorage
            sessionStorage.clear();

            // Mostrar alerta
            alert(data.error || 'Tu sesión ha expirado o está activa en otro dispositivo. Por favor, inicia sesión nuevamente.');

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
    } catch (error) {
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
