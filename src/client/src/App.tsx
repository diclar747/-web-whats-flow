import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CssBaseline, Box, Typography } from '@mui/material';
import { ThemeProvider as CustomThemeProvider } from './contexts/ThemeContext';
import { WhatsAppProvider } from './context/WhatsAppContext';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import WhatsFlowDashboard from './pages/WhatsFlowDashboard';
import Login from './pages/Login'; // 🆕 Email/password login
import Register from './pages/Register'; // 🆕 Registration page
import LandingPage from './components/LandingPageComplete'; // 🆕 Complete landing with services/pricing
import AdminLogin from './pages/admin/AdminLogin';
// import AdminDashboard from './pages/admin/AdminDashboard'; // Removed as per request
import AgentLogin from './pages/AgentLogin';
import AgentDashboard from './pages/AgentDashboard';
import AgentDashboardPro from './pages/AgentDashboardPro';
import ModernAgentChat from './components/ModernAgentChat';
import AdminChatAssignment from './pages/AdminChatAssignment';
import AdminAgentManagement from './components/AdminAgentManagement';
import AgentPermissionsManager from './components/AgentPermissionsManager';
import { TransferNotificationListener } from './components/TransferNotificationListener';
// ✅ ELIMINADO: import FloatingWhatsAppButton - Ya no se usa
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { MobileStatusPublisher } from './modules/MobileStatusPublisher';
import { setupFetchInterceptor } from './utils/fetchInterceptor';
import { initSilentLogs } from './utils/silenceLogs';

// Silenciar logs verbosos al iniciar
initSilentLogs();



// Componente interno que maneja la navegación
const AppContent: React.FC<{
  sessionId: string | null;
  user: any;
  token: string | null;
  userType: 'admin' | 'agent' | null;
  admin: any;
  adminToken: string | null;
  loading: boolean;
  handleLoginSuccess: (userData: any, authToken: string) => void;
  handleAdminLogin: (adminData: any) => void;
  handleLogout: () => void;
  handleQRSuccess: (newSessionId: string) => void;
  onNavigate?: (path: string) => void;
}> = ({ sessionId, user, token, userType, admin, adminToken, loading, handleLoginSuccess, handleAdminLogin, handleLogout, handleQRSuccess, onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Exponer navigate al componente padre
  React.useEffect(() => {
    if (onNavigate) {
      (window as any).__reactNavigate = navigate;
      console.log('✅ [AppContent] __reactNavigate asignado', navigate);
    } else {
      console.warn('⚠️ [AppContent] onNavigate no está definido, __reactNavigate no se asignará');
    }
  }, [navigate, onNavigate]);

  return (
    <DndProvider backend={HTML5Backend}>
      <Routes>
        {/* Ruta principal - Landing page con servicios y precios */}
        <Route path="/" element={
          (sessionId || (token && user)) ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LandingPage />
          )
        } />

        {/* Ruta por defecto - igual que la raíz */}
        <Route path="/home" element={
          sessionId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LandingPage />
          )
        } />

        {/* Ruta de login con email/contraseña */}
        <Route path="/login" element={
          (sessionId || (token && user)) ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )
        } />

        {/* 🆕 Ruta de registro */}
        <Route path="/register" element={
          (sessionId || (token && user)) ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Register />
          )
        } />

        {/* Dashboard - Requiere sessionId para todos */}
        <Route path="/admin/agents" element={
          user && token && user.role === 'admin' ? (
            <AdminAgentManagement />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        } />

        {/* Gestión de Agentes con Privilegios */}
        <Route path="/agents-permissions" element={
          user && token ? (
            <AgentPermissionsManager />
          ) : (
            <Navigate to="/login" replace />
          )
        } />

        {/* Dashboard - Admin con QR (solo sessionId) o Agentes con login (sessionId + user) */}
        <Route path="/dashboard/*" element={
          (() => {
            console.log('🔍 [DASHBOARD-ROUTE] Evaluando acceso:');
            console.log('  - sessionId:', sessionId);
            console.log('  - token:', token);
            console.log('  - user:', user);
            console.log('  - user.role:', user?.role);

            // Permitir acceso si:
            // 1. Tiene sessionId (QR login)
            // 2. Tiene token Y user (Email/Password login)
            // 3. Es agente/supervisor con credenciales
            const hasAccess = sessionId ||
              (token && user) ||
              (user && (user.role === 'agent' || user.role === 'supervisor'));

            return hasAccess ? (
              <>
                {user && (user.role === 'agent' || user.role === 'supervisor') ? (
                  // Dashboard simplificado para agentes (requiere user pero NO requiere sessionId inmediato)
                  (() => {
                    console.log('✅ [DASHBOARD-ROUTE] Cargando AgentDashboard para:', user.name);
                    return (
                      <WhatsAppProvider
                        userId={user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : undefined}
                        userRole={user?.role}
                      >
                        <AgentDashboardPro onLogout={handleLogout} />
                      </WhatsAppProvider>
                    );
                  })()
                ) : sessionId ? (
                  // Dashboard completo para admin (requiere sessionId del QR)
                  (() => {
                    console.log('✅ [DASHBOARD-ROUTE] Cargando WhatsFlowDashboard (admin) con sessionId:', sessionId);
                    return (
                      <WhatsAppProvider
                        userId={user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : undefined}
                        userRole={user?.role || 'admin'}
                      >
                        <WhatsFlowDashboard
                          sessionId={sessionId}
                          onLogout={handleLogout}
                        />
                      </WhatsAppProvider>
                    );
                  })()
                ) : (
                  // 🆕 Dashboard SIN autenticación (modo QR) - permitir acceso para generar QR
                  (() => {
                    console.log('✅ [DASHBOARD-ROUTE] Cargando Dashboard en modo QR (sin auth)');
                    return (
                      <WhatsAppProvider
                        userId={undefined}
                        userRole="admin"
                      >
                        <WhatsFlowDashboard
                          sessionId="" // Sin sessionId, permitirá generar QR
                          onLogout={handleLogout}
                        />
                      </WhatsAppProvider>
                    );
                  })()
                )}
              </>
            ) : loading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <CircularProgress />
                <p>Cargando sesión...</p>
              </div>
            ) : (
              // Redirigir a inicio (landing con QR) si no hay ni sessionId ni user agent
              <Navigate to="/" replace />
            );
          })()
        } />

        {/* Ruta de login de admin - evitar interferencia con sesiones QR */}
        <Route path="/admin" element={
          userType === 'admin' && sessionId ? (
            // Si ya hay un usuario admin con sesión QR, ir al dashboard principal
            <Navigate to="/dashboard" replace />
          ) : admin && adminToken ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <AdminLogin onLogin={handleAdminLogin} />
          )
        } />

        {/* Ruta de login específico de admin */}
        <Route path="/admin/login" element={
          userType === 'admin' && sessionId ? (
            // Si ya hay un usuario admin con sesión QR, ir al dashboard principal
            <Navigate to="/dashboard" replace />
          ) : admin && adminToken ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <AdminLogin onLogin={handleAdminLogin} />
          )
        } />

        {/* Dashboard de administrador */}
        {/* Route removed as per request */}

        {/* Ruta para PWA Móvil - Publicador de Estados */}
        <Route path="/mobile/status-publisher" element={<MobileStatusPublisher />} />

        {/* Ruta por defecto - para cualquier otra ruta no definida */}
        <Route path="*" element={
          // Si hay sessionId, ir al dashboard
          sessionId ? (
            <Navigate to="/dashboard" replace />
          ) : (
            // Si no hay sessionId, verificar si estamos en una ruta protegida
            // Si intentamos acceder a dashboard sin sessionId, ir a la página principal
            <Navigate to="/" replace />
          )
        } />
      </Routes>
    </DndProvider>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<'admin' | 'agent' | null>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [sessionClosedDialog, setSessionClosedDialog] = useState<{ open: boolean; reason: string }>({ open: false, reason: '' });

  // 🔐 Inicializar interceptor de fetch al cargar la app
  useEffect(() => {
    setupFetchInterceptor();
    console.log('[APP] 🔐 Interceptor de sesión única inicializado');
  }, []);

  useEffect(() => {
    // Función para generar un ID de dispositivo ÚNICO usando UUID
    const generateDeviceId = () => {
      // Generar UUID v4 único (imposible de duplicar)
      if (crypto.randomUUID) {
        return crypto.randomUUID();
      }
      // Fallback para navegadores antiguos
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    // Helper para retry con backoff exponencial
    const fetchWithRetry = async (url: string, options: any, retries = 3, delay = 1000): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, options);
          // Si es error de servidor (5xx), lanzar error para reintentar
          if (response.status >= 500 && response.status < 600) {
            throw new Error(`Server error: ${response.status}`);
          }
          return response;
        } catch (err) {
          console.log(`⚠️ Fetch attempt ${i + 1} failed:`, err);
          if (i === retries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
        }
      }
      throw new Error('Max retries reached');
    };

    const initializeSession = async () => {
      // 🔒 MODIFICACIÓN: Preservar localStorage para mantener la sesión al recargar
      // Anteriormente se limpiaba para forzar "sesiones únicas", pero el usuario requiere persistencia
      // al recargar la página.
      console.log('🔄 [APP-INIT] Iniciando validación de sesión (Persistencia habilitada)');


      // Generar ID de dispositivo ÚNICO para esta pestaña/sesión del navegador
      let deviceId = sessionStorage.getItem('whatsflow_device_id') || localStorage.getItem('whatsflow_device_id');
      if (!deviceId) {
        deviceId = generateDeviceId();
      }

      // Normalizar claves de deviceId para que los interceptores encuentren el valor
      ['device_id', 'deviceId', 'whatsflow_device_id', 'whatsflow_session_device_id'].forEach((key) => {
        sessionStorage.setItem(key, deviceId as string);
        localStorage.setItem(key, deviceId as string);
      });

      // Intentar recuperar de sessionStorage (primero) O localStorage (segundo, para persistencia)
      const savedToken = sessionStorage.getItem('token') || localStorage.getItem('token');
      const savedSessionId = sessionStorage.getItem('whatsflow_session') || localStorage.getItem('whatsflow_session');
      const savedUserType = (sessionStorage.getItem('whatsflow_user_type') || localStorage.getItem('whatsflow_user_type')) as 'admin' | 'agent' | null;
      const savedUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
      const savedUserName = sessionStorage.getItem('userName') || localStorage.getItem('userName');
      const savedUserRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
      const savedDeviceId = sessionStorage.getItem('whatsflow_session_device_id')
        || sessionStorage.getItem('device_id')
        || sessionStorage.getItem('deviceId')
        || sessionStorage.getItem('whatsflow_device_id')
        || localStorage.getItem('whatsflow_session_device_id')
        || localStorage.getItem('device_id')
        || localStorage.getItem('deviceId')
        || localStorage.getItem('whatsflow_device_id');
      const savedSessionToken = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');

      console.log('🔍 [APP-INIT] Verificando sesión guardada en sessionStorage (sesión única)...');
      console.log('Token:', savedToken ? 'Existe' : 'No');
      console.log('UserId:', savedUserId);
      console.log('SessionId:', savedSessionId);
      console.log('UserType:', savedUserType);
      console.log('Current Device ID:', deviceId?.substring(0, 20) + '...');
      console.log('Saved Device ID:', savedDeviceId?.substring(0, 20) + '...');
      console.log('SessionToken:', savedSessionToken ? 'Existe' : 'No');

      // 🔒 SEGURIDAD CRÍTICA: Si NO hay token ni sessionId, NO permitir acceso
      if (!savedToken && !savedSessionId) {
        console.log('🚫 [APP-INIT] NO hay credenciales guardadas - Esta pestaña NO está autenticada');
        setLoading(false);
        return; // Salir aquí - no cargar nada, mostrar página de login
      }

      // ✅ PRIORIDAD: Si hay token de email/password, restaurar INMEDIATAMENTE
      if (savedToken && savedUserId) {
        const restoredUser = {
          id: parseInt(savedUserId),
          name: savedUserName || 'Usuario',
          role: savedUserRole || 'user',
          email: (sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail')) || ''
        };

        setUser(restoredUser);
        setToken(savedToken);
        setUserType(savedUserType as 'admin' | 'agent' || 'agent');

        console.log('✅ [APP-INIT] Usuario autenticado con JWT restaurado:', restoredUser.email);

        // 🔧 FIX: Priorizar sessionId guardado, luego verificar con backend
        // Si hay sessionId guardado, usarlo inmediatamente para evitar pantalla en blanco
        if (savedSessionId) {
          console.log('✅ Usando sessionId guardado:', savedSessionId);
          setSessionId(savedSessionId);
        }

        // Luego verificar en background si hay una sesión más reciente
        console.log('🔄 Verificando sessionId con el backend en background...');
        try {
          const sessionsResp = await fetch('/api/sessions/active', {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          });
          const sessionsData = await sessionsResp.json();
          console.log('📡 Respuesta de /api/sessions/active:', sessionsData);

          if (sessionsData.success && sessionsData.sessions && sessionsData.sessions.length > 0) {
            const activeSession = sessionsData.sessions[0];
            const foundSessionId = activeSession.sessionId;

            // Si el sessionId del backend es diferente, actualizarlo
            if (savedSessionId !== foundSessionId) {
              console.log(`🔄 Actualizando sessionId: ${savedSessionId} → ${foundSessionId}`);
              sessionStorage.setItem('whatsflow_session', foundSessionId);
              localStorage.setItem('whatsflow_session', foundSessionId);
              setSessionId(foundSessionId);
            } else {
              console.log('✅ SessionId confirmado con backend:', foundSessionId);
            }
          } else {
            // Backend no tiene sesiones activas, pero mantenemos el guardado
            console.log('⚠️ Backend sin sesiones activas, manteniendo sessionId guardado:', savedSessionId);
          }
        } catch (fetchError) {
          console.error('❌ Error verificando sessionId:', fetchError);
          // En caso de error, ya tenemos el sessionId guardado establecido
          console.log('⚠️ Manteniendo sessionId guardado por error de red:', savedSessionId);
        }

        setLoading(false);
        return; // Sesión JWT restaurada
      }

      try {
        // Si hay sessionId guardado, verificar dispositivo
        if (savedSessionId) {
          // 🔒 SEGURIDAD: Verificar que no sea un navegador/dispositivo diferente
          // sessionStorage es único por pestaña/navegador, así que si hay deviceId diferente
          // o falta deviceId, es sospechoso

          if (!savedDeviceId) {
            console.log('🚫 Sesión sin deviceId - posible navegador diferente. Limpiando...');
            sessionStorage.clear();
            setLoading(false);
            return;
          }

          // Verificar que el deviceId coincida
          if (savedDeviceId !== deviceId) {
            console.log('🚫 DeviceId no coincide - navegador diferente detectado. Limpiando...');
            sessionStorage.clear();
            setLoading(false);
            return;
          }

          console.log('✅ Dispositivo verificado correctamente');

          // Ahora sí, verificar si la sesión está activa
          console.log('🔍 Verificando sessionId guardado:', savedSessionId);

          // Obtener sessionToken guardado (puede no existir para sesiones antiguas)
          const savedSessionToken = sessionStorage.getItem('whatsflow_session_token');
          if (!savedSessionToken) {
            console.log('⚠️ No hay sessionToken guardado (sesión antigua, continuando con validación básica)');
          }

          try {
            const headers: any = {
              'X-Device-Id': deviceId
            };

            // Solo agregar sessionToken si existe
            if (savedSessionToken) {
              headers['X-Session-Token'] = savedSessionToken;
            }

            // Enviar también sessionToken si existe para validación completa
            // Usar fetchWithRetry para manejar reinicios del servidor
            const response = await fetchWithRetry(`/api/session/${savedSessionId}/status`, {
              headers: {
                'x-device-id': deviceId,
                'x-session-token': savedSessionToken || ''
              }
            });

            // Si la sesión no existe (404), limpiar completamente
            if (response.status === 404) {
              console.log('🗑️ [APP-INIT] Sesión no encontrada (404), limpiando todo');
              // Limpiar sessionStorage
              sessionStorage.removeItem('whatsflow_session');
              sessionStorage.removeItem('whatsflow_session_token');
              sessionStorage.removeItem('whatsflow_session_device_id');
              sessionStorage.removeItem('whatsflow_user_type');
              sessionStorage.removeItem('sessionToken');
              sessionStorage.removeItem('token');
              // Limpiar también localStorage por si acaso
              localStorage.removeItem('whatsflow_session');
              localStorage.removeItem('whatsflow_session_token');
              // Resetear estados
              setSessionId(null);
              setUser(null);
              setToken(null);
              setUserType(null);
              setLoading(false);
              console.log('✅ Sesión limpiada, listo para nueva conexión');
              return;
            }

            const checkData = await response.json();

            console.log('📊 [APP-INIT] Respuesta de verificación:', checkData);

            // Si no hay sesión activa (is_active=0), redirigir a inicio para login
            if (checkData.requiresAuth || (checkData.success === false && checkData.message === 'Sin sesión activa')) {
              console.log('🚫 [APP-INIT] Sin sesión activa - Redirigiendo a inicio');

              // Limpiar sesión
              sessionStorage.removeItem('whatsflow_session');
              localStorage.removeItem('whatsflow_session');

              // Resetear estados
              setSessionId(null);
              setLoading(false);

              // Redirigir a inicio (sin recarga de página)
              const nav = (window as any).__reactNavigate;
              if (nav) {
                nav('/');
              }
              // ✅ ELIMINADO: window.location.href - Usar solo navigate de React Router
              return;
            }

            if (checkData.success && checkData.isConnected) {
              console.log('✅ SessionId guardado sigue activo');

              // 🔒 SEGURIDAD: Verificar que tenga token de autenticación válido
              // ADMIN (QR): Necesita sessionToken de la sesión QR
              // AGENTE: Necesita token de usuario (login)

              if (savedUserType === 'admin') {
                // Admin debe tener sessionToken (prueba de que escaneó QR)
                if (savedSessionToken) {
                  setSessionId(savedSessionId);
                  setUserType('admin');
                  console.log('✅ Usuario admin (QR) restaurado con sessionId:', savedSessionId);
                } else {
                  console.log('🚫 Admin sin sessionToken - requiere escanear QR nuevamente');
                  sessionStorage.clear();
                  setLoading(false);
                  return;
                }
              } else if (savedToken && savedUserId) {
                // Usuario agente necesita tanto token como sessionId
                const restoredUser = {
                  id: parseInt(savedUserId),
                  name: savedUserName || 'Usuario',
                  role: savedUserRole || 'agent',
                  email: (sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail')) || ''
                };

                setUser(restoredUser);
                setToken(savedToken);

                // Si NO tiene sessionId, buscar automáticamente en el backend
                if (!savedSessionId) {
                  console.log('⚠️ Usuario sin sessionId, buscando sesión activa de WhatsApp...');
                  try {
                    const sessionsResp = await fetch('/api/sessions/active', {
                      headers: {
                        'Authorization': `Bearer ${savedToken}`
                      }
                    });
                    const sessionsData = await sessionsResp.json();
                    if (sessionsData.success && sessionsData.sessions && sessionsData.sessions.length > 0) {
                      const activeSession = sessionsData.sessions[0];
                      const foundSessionId = activeSession.sessionId;
                      console.log('✅ SessionId encontrado automáticamente:', foundSessionId);
                      sessionStorage.setItem('whatsflow_session', foundSessionId);
                      localStorage.setItem('whatsflow_session', foundSessionId);
                      setSessionId(foundSessionId);
                    } else {
                      console.log('⚠️ No se encontró sesión activa de WhatsApp');
                      setSessionId(null);
                    }
                  } catch (fetchError) {
                    console.error('Error buscando sessionId:', fetchError);
                    setSessionId(savedSessionId);
                  }
                } else {
                  setSessionId(savedSessionId);
                }

                setUserType('agent');

                console.log('✅ Usuario agente restaurado:', restoredUser.name);
              } else {
                // Sin credenciales válidas - requiere autenticación
                // Sin credenciales válidas - requiere autenticación
                console.log('🚫 Sin credenciales de autenticación válidas');
                sessionStorage.clear();
                // No limpiar localStorage aquí automáticamente para evitar loops si el servidor falla, 
                // pero si falla la autenticación real, se limpiará en el catch o login.
                // localStorage.clear(); 
                setLoading(false);
                return;
              }

              console.log('✅ Sesión de WhatsApp activa, manteniendo sesión');
              setLoading(false);
              return;
            } else {
              console.log('⚠️ SessionId guardado ya no está activo');
              console.log('📊 [APP-INIT] Datos recibidos:', JSON.stringify(checkData));
              // NO LIMPIAR INMEDIATAMENTE - Dar tiempo a que el servidor reconecte
              // Solo limpiar si definitivamente no está conectado
              if (checkData.success === false) {
                console.log('❌ API reporta error, limpiando sesión');
                sessionStorage.removeItem('whatsflow_session');
                sessionStorage.removeItem('whatsflow_session_device_id');
              } else {
                console.log('⚠️ Sesión no conectada pero API responde OK - mantener y recargar');
                // Mantener la sesión y permitir que el usuario intente de nuevo
                setSessionId(savedSessionId);
                setUserType(savedUserType || 'admin');
              }
            }
          } catch (verifyError) {
            console.error('❌ [APP-INIT] Error verificando sesión:', verifyError);
            // Si hay error de red, mantener la sesión y permitir retry
            console.log('⚠️ Error de red, manteniendo sesión para retry');
            setSessionId(savedSessionId);
            setUserType(savedUserType || 'admin');
            setLoading(false); // IMPORTANTE: Dejar de cargar para mostrar UI (aunque sea desconectada)
          }
        } else {
          console.log('⚠️ No hay sessionId guardado');
        }

        console.log('⚠️ No hay sesión activa de WhatsApp - Mostrando página de inicio');
      } catch (error) {
        console.error('❌ Error verificando sesión de WhatsApp:', error);
        // En caso de error, limpiar sesión
        sessionStorage.removeItem('whatsflow_session');
        sessionStorage.removeItem('whatsflow_session_device_id');
      }

      // Si llegamos aquí, NO hay sesión activa de WhatsApp
      // Restaurar datos de usuario solo si existen (para agentes con login)
      if (savedToken && savedUserId) {
        const restoredUser = {
          id: parseInt(savedUserId),
          name: savedUserName || 'Usuario',
          role: savedUserRole || 'agent',

          email: (sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail')) || ''
        };

        setUser(restoredUser);
        setToken(savedToken);
        setUserType('agent'); // For agent users, we know they have login credentials

        console.log('✅ Usuario agente restaurado (sin WhatsApp activo):', restoredUser.name);
      } else {
        // Si no hay token de usuario pero hay tipo guardado (admin),
        // no necesitamos forzar login
        if (savedUserType === 'admin') {
          setUserType('admin');
          console.log('✅ Tipo de usuario admin identificado (QR mode)');
        }
      }

      setLoading(false);
    };

    initializeSession();
  }, []);

  // ✅ DESACTIVADO: Permitir múltiples sesiones del mismo usuario
  // Las aplicaciones modernas (WhatsApp Web, Gmail, etc.) permiten múltiples sesiones simultaneas
  // El usuario puede estar conectado desde varios navegadores/dispositivos a la vez
  /*
  useEffect(() => {
    // Solo activar si hay usuario logueado
    const userId = sessionStorage.getItem('userId');
    if (!userId) return;

    // Importar socket.io-client
    import('socket.io-client').then(({ io }) => {
      const API_BASE = process.env.REACT_APP_API_URL || 'https://web.whats-flow.com';
      const sessionSocket = io(API_BASE, {
        transports: ['websocket', 'polling'],
        reconnection: true
      });

      const handleSessionClosed = (data: any) => {
        console.log('🔐 [APP] Sesión cerrada en otro dispositivo:', data);

        // Verificar si es nuestra sesión la que fue cerrada
        const currentUserId = parseInt(sessionStorage.getItem('userId') || '0');
        const currentSessionToken = sessionStorage.getItem('sessionToken');

        if (data.userId === currentUserId || (data.oldTokens && data.oldTokens.includes(currentSessionToken))) {
          // Mostrar dialog en lugar de alert
          setSessionClosedDialog({
            open: true,
            reason: data.reason || 'Iniciaste sesión en otro dispositivo'
          });
        }
      };

      sessionSocket.on('session-closed', handleSessionClosed);

      return () => {
        sessionSocket.off('session-closed', handleSessionClosed);
        sessionSocket.disconnect();
      };
    });
  }, [user]);
  */

  // Listener para eventos de sesión invalidada desde SocketContext
  useEffect(() => {
    const handleSessionInvalidated = (event: any) => {
      setSessionClosedDialog({
        open: true,
        reason: event.detail.reason
      });
    };

    window.addEventListener('session-invalidated', handleSessionInvalidated);
    return () => {
      window.removeEventListener('session-invalidated', handleSessionInvalidated);
    };
  }, []);

  // FUNCIÓN ELIMINADA POR SEGURIDAD
  // fetchActiveSession permitía acceder a sesiones de otros usuarios
  // Ahora cada usuario debe escanear su propio QR code

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setToken(token);
        setUserType('agent');

        // Verificar si tiene sessionId guardado
        const savedSessionId = sessionStorage.getItem('whatsflow_session');

        if (savedSessionId) {
          // Ya tiene sessionId, usarlo
          setSessionId(savedSessionId);
          console.log('✅ Usando sessionId guardado:', savedSessionId);
        } else {
          // No hay sessionId guardado, el usuario debe hacer login nuevamente
          console.log('⚠️ No hay sessionId guardado, requiere login');
        }
      } else if (data.requiresReauth || data.sessionClosed) {
        // ✅ Sesión cerrada (session=0) o token inválido - redirigir a login
        console.log('❌ Sesión cerrada o token inválido, redirigiendo...');
        handleLogout();
        window.location.href = 'https://web.whats-flow.com/';
      } else {
        // Token inválido, limpiar
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('userRole');
      }
    } catch (error) {
      console.error('Error verificando token:', error);
      sessionStorage.removeItem('whatsflow_token');
      sessionStorage.removeItem('whatsflow_user_type');
    } finally {
      setLoading(false);
    }
  };

  const verifyAdminToken = async (token: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success && data.admin) {
        setAdmin(data.admin);
        setAdminToken(token);
      } else {
        // Token inválido, limpiar
        sessionStorage.removeItem('whatsflow_admin_token');
      }
    } catch (error) {
      console.error('Error verificando token de admin:', error);
      sessionStorage.removeItem('whatsflow_admin_token');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = (adminData: any) => {
    setAdmin(adminData.admin);
    setAdminToken(adminData.token);
    sessionStorage.setItem('whatsflow_admin_token', adminData.token);
  };

  const handleLoginSuccess = (userData: any, authToken?: string, sessionIdFromLogin?: string) => {
    // 🆕 Nuevo flujo: Login con email/password retorna usuario + JWT token
    if (authToken) {
      // Email/password login
      setUser(userData);
      setToken(authToken);
      setUserType(userData.role === 'super_admin' ? 'admin' : 'agent');

      // ✅ CRÍTICO: Establecer sessionId = user.id (string) si no viene explícito
      const effectiveSessionId = sessionIdFromLogin || String(userData.id);

      // Guardar datos en localStorage y sessionStorage
      const storageKeys = [
        { key: 'token', value: authToken },
        { key: 'user', value: JSON.stringify(userData) },
        { key: 'userRole', value: userData.role },
        { key: 'userName', value: userData.full_name },
        { key: 'userId', value: userData.id.toString() },
        { key: 'userEmail', value: userData.email },
        { key: 'whatsflow_user_type', value: userData.role === 'super_admin' ? 'admin' : 'agent' },
        { key: 'whatsflow_session', value: effectiveSessionId }, // ✅ Guardar sessionId
        { key: 'sessionId', value: effectiveSessionId } // ✅ Compatibilidad
      ];

      storageKeys.forEach(({ key, value }) => {
        localStorage.setItem(key, value);
        sessionStorage.setItem(key, value);
      });

      setSessionId(effectiveSessionId); // ✅ Establecer en estado

      try {
        window.dispatchEvent(new CustomEvent('whatsflow-session-established', {
          detail: {
            sessionId: effectiveSessionId,
            userId: userData.id,
            userRole: userData.role
          }
        }));
        console.log('📣 Evento whatsflow-session-established emitido (login)');
      } catch { }

      console.log('✅ Usuario autenticado con JWT:', userData.full_name, '| sessionId:', effectiveSessionId);

      // ✅ NAVEGACIÓN: Redirigir al dashboard después del login exitoso
      setTimeout(() => {
        const nav = (window as any).__reactNavigate;
        if (nav) {
          console.log('🔄 Redirigiendo a /dashboard...');
          nav('/dashboard');
        } else {
          console.warn('⚠️ __reactNavigate no disponible, usando window.location');
          window.location.href = '/dashboard';
        }
      }, 100); // Pequeño delay para asegurar que el estado se actualice primero

      return;
    }

    // Flujo antiguo para compatibilidad (agentes con login de usuario/contraseña viejo)
    setUser(userData);
    setToken(authToken || '');

    // Determinar userType según el rol
    if (userData.role === 'admin') {
      setUserType('admin');
    } else {
      setUserType('agent');
    }

    // Guardar en sessionStorage (sesión actual) y localStorage (persistencia)
    const storageKeys = [
      { key: 'whatsflow_token', value: authToken },
      { key: 'whatsflow_user_type', value: userData.role === 'admin' ? 'admin' : 'agent' },
      { key: 'token', value: authToken },
      { key: 'userRole', value: userData.role },
      { key: 'userName', value: userData.name },
      { key: 'userId', value: userData.id },
      { key: 'userEmail', value: userData.email || '' }
    ];

    storageKeys.forEach(({ key, value }) => {
      sessionStorage.setItem(key, String(value));
      localStorage.setItem(key, String(value));
    });

    // Si viene sessionId desde el login, guardarlo
    if (sessionIdFromLogin) {
      sessionStorage.setItem('whatsflow_session', sessionIdFromLogin);
      localStorage.setItem('whatsflow_session', sessionIdFromLogin);
      setSessionId(sessionIdFromLogin);
      console.log('✅ SessionId recibido del backend:', sessionIdFromLogin);
      try {
        window.dispatchEvent(new CustomEvent('whatsflow-session-established', {
          detail: {
            sessionId: sessionIdFromLogin,
            userId: userData.id,
            userRole: userData.role
          }
        }));
        console.log('📣 Evento whatsflow-session-established emitido (login compat)');
      } catch { }
    } else {
      // Verificar si hay sessionId guardado previamente
      const savedSessionId = sessionStorage.getItem('whatsflow_session') || localStorage.getItem('whatsflow_session');
      if (savedSessionId) {
        setSessionId(savedSessionId);
        console.log('✅ SessionId establecido desde sessionStorage:', savedSessionId);
      } else {
        console.log('⚠️ No hay sessionId, el usuario verá mensaje de conexión pendiente');
      }
    }
  };

  const handleLogout = () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');

    console.log('[LOGOUT] 🔴 Cerrando sesión...');

    // ✅ Llamar al endpoint correcto con autenticación
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }).then(res => res.json()).then(data => {
        console.log('✅ Logout exitoso:', data);
      }).catch(err => {
        console.error('❌ Error en logout:', err);
      });
    }

    setUser(null);
    setToken(null);
    setSessionId(null);
    setUserType(null);
    setAdmin(null);
    setAdminToken(null);

    // Limpiar TODOS los tokens y datos de sesión (solo sessionStorage)
    sessionStorage.clear();

    // También limpiar localStorage por si había datos viejos
    localStorage.removeItem('whatsflow_token');
    localStorage.removeItem('whatsflow_session');
    localStorage.removeItem('whatsflow_session_device_id');
    localStorage.removeItem('whatsflow_user_type');
    localStorage.removeItem('whatsflow_admin_token');
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');

    console.log('✅ Logout completado, todas las sesiones limpiadas');

    // ✅ Redirigir a la página principal
    window.location.href = '/';
  };

  const handleQRSuccess = (newSessionId: string) => {
    console.log('🎯 [APP] handleQRSuccess llamado con sessionId:', newSessionId);

    setSessionId(newSessionId);
    setUserType('admin');

    // Generar sessionToken ÚNICO (diferente del sessionId de WhatsApp)
    const sessionToken = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36);

    // Obtener o generar deviceId ÚNICO
    // Obtener o generar deviceId ÚNICO
    let deviceId = localStorage.getItem('whatsflow_device_id') || sessionStorage.getItem('whatsflow_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36);
      localStorage.setItem('whatsflow_device_id', deviceId);
      sessionStorage.setItem('whatsflow_device_id', deviceId);
    }

    // Guardar en sessionStorage (sesión actual) y localStorage (persistencia)
    const sessionData = [
      { key: 'whatsflow_session', value: newSessionId },
      { key: 'whatsflow_session_token', value: sessionToken },
      { key: 'whatsflow_session_device_id', value: deviceId },
      { key: 'whatsflow_user_type', value: 'admin' },
      { key: 'userRole', value: 'admin' }
    ];

    sessionData.forEach(({ key, value }) => {
      sessionStorage.setItem(key, value);
      localStorage.setItem(key, value);
    });

    try {
      window.dispatchEvent(new CustomEvent('whatsflow-session-established', {
        detail: {
          sessionId: newSessionId,
          userRole: 'admin'
        }
      }));
      console.log('📣 Evento whatsflow-session-established emitido (QR)');
    } catch { }

    console.log('✅ [APP] Sesión guardada, datos listos para redirección');
    // La navegación la maneja LandingPage.tsx, pero confirmamos que el estado está listo

    console.log('✅ [APP] SessionId, SessionToken y Device ID guardados (sesión única)');
    console.log('📊 [APP] Datos guardados:');
    console.log('   - whatsflow_session:', newSessionId);
    console.log('   - whatsflow_session_token:', sessionToken.substring(0, 20) + '...');
    console.log('   - whatsflow_device_id:', deviceId.substring(0, 20) + '...');
    console.log('   - whatsflow_user_type:', 'admin');
    console.log('   - userRole:', 'admin');

    // Registrar sesión en el servidor
    fetch('/api/register-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: newSessionId,
        sessionToken: sessionToken,
        deviceId: deviceId,
        userType: 'admin'
      })
    }).then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log('✅ [APP] Sesión registrada en el servidor');
          // Navegación fluida al dashboard (sin recarga)
          console.log('🚀 [APP] Navegando al dashboard...');
          const nav = (window as any).__reactNavigate;
          if (nav) {
            console.log('✅ [APP] Usando __reactNavigate');
            nav('/dashboard');
          } else {
            console.warn('⚠️ [APP] __reactNavigate no definido, forzando recarga para ir al dashboard');
            // Usar reload para asegurar que el estado de sesión se tome limpio desde storage
            window.location.href = '/dashboard';
            // Si href no funciona por alguna razón SPA, reload forzado
            setTimeout(() => window.location.reload(), 500);
          }
        } else {
          console.error('❌ [APP] Error registrando sesión:', data.error);
          alert('Error al iniciar sesión. Por favor, intenta de nuevo.');
        }
      })
      .catch(error => {
        console.error('❌ [APP] Error al registrar sesión:', error);
        alert('Error de conexión. Por favor, intenta de nuevo.');
      });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div>Cargando...</div>
      </div>
    );
  }

  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <CustomThemeProvider>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              {/* Toaster para notificaciones visuales */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 15000,
                  style: {
                    background: '#fff',
                    color: '#363636',
                  },
                  success: {
                    duration: 5000,
                  },
                }}
              />

              {/* Listener de notificaciones de transferencia */}
              {user && <TransferNotificationListener />}

              {/* ✅ ELIMINADO: Botón flotante de WhatsApp - Optimización de rendimiento */}

              <AppContent
                sessionId={sessionId}
                user={user}
                token={token}
                userType={userType}
                admin={admin}
                adminToken={adminToken}
                loading={loading}
                handleLoginSuccess={handleLoginSuccess}
                handleAdminLogin={handleAdminLogin}
                handleLogout={handleLogout}
                handleQRSuccess={handleQRSuccess}
                onNavigate={() => { }}
              />

              {/* Dialog de sesión cerrada - Diseño mejorado Dark Mode */}
              <Dialog
                open={sessionClosedDialog.open}
                onClose={() => { }}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                  sx: {
                    borderRadius: 3,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    bgcolor: '#1e293b', // Slate 800
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }
                }}
              >
                <DialogTitle
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', // Indigo gradient
                    color: 'white',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    pb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  🔒 Sesión Cerrada
                </DialogTitle>
                <DialogContent sx={{ mt: 3, pb: 2 }}>
                  <DialogContentText sx={{ fontSize: '1rem', color: 'rgba(255,255,255,0.9)', mb: 2 }}>
                    Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo o navegador.
                  </DialogContentText>
                  <Box sx={{
                    bgcolor: 'rgba(0,0,0,0.2)',
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 500, mb: 0.5 }}>
                      Razón:
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'white' }}>
                      {sessionClosedDialog.reason}
                    </Typography>
                  </Box>
                  <DialogContentText sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', mt: 3 }}>
                    Por seguridad, solo puedes tener una sesión activa a la vez. Serás redirigido a la página de inicio.
                  </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                  <Button
                    onClick={() => {
                      sessionStorage.clear();
                      localStorage.clear();
                      window.location.href = '/';
                    }}
                    variant="contained"
                    size="large"
                    fullWidth
                    sx={{
                      background: 'white',
                      color: '#0f172a',
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: 2,
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.9)',
                      }
                    }}
                  >
                    Ir a Página Principal
                  </Button>
                </DialogActions>
              </Dialog>
            </LocalizationProvider>
          </CustomThemeProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
