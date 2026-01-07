import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { sessionFetch } from '../utils/sessionFetch';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useWhatsApp } from '../context/WhatsAppContext';
import { useTheme } from '../contexts/ThemeContext';
import { frontendLogger } from '../utils/frontendLogger';
import ProtectedRoute from '../components/ProtectedRoute';
import { usePermissions } from '../hooks/usePermissions';
import { useSyncProgress } from '../hooks/useSyncProgress';
import { useSocket } from '../context/SocketContext';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Tooltip,
  CircularProgress,
  Fade,
  Grow,
  Slide,
  Zoom,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Telegram,
  WhatsApp,
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  History as HistoryIcon,
  Contacts as ContactsIcon,
  Campaign as CampaignIcon,
  SmartToy as BotIcon,
  Schedule as CalendarIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
  PeopleAlt as PeopleIcon,
  TrendingUp as TrendingIcon,
  Business as BusinessIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Error as ErrorIcon,
  QrCode,
  SupervisorAccount as AgentsIcon,
  ViewKanban as KanbanIcon,
  Security as SecurityIcon,
  Brightness4,
  Brightness7,
  Schedule,
  CheckCircle
} from '@mui/icons-material';

// Componente de llamada entrante (cargado inmediatamente por ser crítico)
import IncomingCall from '../components/IncomingCall';
import AgentChatView from '../components/AgentChatView';
import ModernAlert from '../components/ModernAlert';
import RequiresWhatsApp from '../components/RequiresWhatsApp';
import WhinsapLogo from '../components/WhinsapLogo';

// Lazy loading de módulos para mejor rendimiento
const WhatsAppWebChat = lazy(() => import('../modules/WhatsAppWebChat'));
const RealCampaignsModule = lazy(() => import('../modules/RealCampaignsModule'));
const ContactsManagerModule = lazy(() => import('../modules/ContactsManagerModule'));
const HistoryModule = lazy(() => import('../modules/HistoryModule'));
const ChatbotModule = lazy(() => import('../modules/ChatbotModule'));
const CalendarModule = lazy(() => import('../modules/CalendarModule'));
const AnalyticsModule = lazy(() => import('../modules/AnalyticsModule'));
const SettingsModule = lazy(() => import('../modules/SettingsModule'));
const DashboardOverview = lazy(() => import('../modules/DashboardOverview'));
const UsersModule = lazy(() => import('../modules/UsersModule'));
const AgentsManagementModule = lazy(() => import('../modules/AgentsManagementModule'));
const KanbanContactsModule = lazy(() => import('../modules/KanbanContactsModule'));
const AgentPermissionsManager = lazy(() => import('../components/AgentPermissionsManager'));
const WhatsAppStatusModule = lazy(() => import('../modules/WhatsAppStatusModule'));
const WhatsAppConnectionModule = lazy(() => import('../modules/WhatsAppConnectionModule'));

// Componente de loading para Suspense con animación mejorada
const ModuleLoadingFallback = () => (
  <Box sx={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    borderRadius: 3,
    mx: 2,
    my: 4
  }}>
    <Zoom in={true} timeout={600}>
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress
          size={80}
          thickness={4}
          sx={{
            color: '#00a884',
            mb: 3,
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round'
            }
          }}
        />
        <Typography
          variant="h5"
          sx={{
            color: '#1e293b',
            fontWeight: 600,
            mb: 1
          }}
        >
          Cargando módulo...
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b' }}>
          Preparando la mejor experiencia para ti
        </Typography>
      </Box>
    </Zoom>
  </Box>
);

interface WhinsapDashboardProps {
  sessionId: string;
  onLogout: () => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  path: string;
  badge?: number;
  color?: string;
}

const WhinsapDashboard: React.FC<WhinsapDashboardProps> = ({ sessionId, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Guardar sessionId en localStorage para que SocketContext pueda acceder
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('whinsap_session', sessionId);
      sessionStorage.setItem('whinsap_session', sessionId);
      console.log('[DASHBOARD] 💾 SessionId guardado para Socket.IO:', sessionId);
      console.log('[DASHBOARD-DEBUG] 🔍 SessionId completo:', {
        sessionId,
        length: sessionId.length,
        type: typeof sessionId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('[DASHBOARD-DEBUG] ⚠️ SessionId es NULL o undefined!');
    }
  }, [sessionId]);
  const { chats } = useWhatsApp();
  const { toggleTheme, isDarkMode } = useTheme();
  const { hasModuleAccess, userRole: permUserRole } = usePermissions();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerMinimized, setDrawerMinimized] = useState(false); // false = maximizado por defecto
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // Calcular notificaciones dinámicamente desde chats con mensajes no leídos
  const notifications = useMemo(() => {
    return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
  }, [chats]);
  const [whatsappStatus, setWhatsappStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastConnectionCheck, setLastConnectionCheck] = useState(new Date());

  // Estado de sincronización
  const [syncProgress, setSyncProgress] = useState<{
    status: 'idle' | 'syncing' | 'completed';
    percentage: number;
    message: string;
  }>({
    status: 'idle',
    percentage: 0,
    message: ''
  });

  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false); // Nuevo estado para evitar race conditions
  const [primarySessionId, setPrimarySessionId] = useState<string | null>(null); // 🆕 Primary Session (oldest)

  // Detectar rol del usuario (priorizar el del hook de permisos)
  const userRole = permUserRole || sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || 'admin';
  const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
  const userName = sessionStorage.getItem('userName') || localStorage.getItem('userName');
  const isAgent = userRole === 'agent';
  const isSupervisor = userRole === 'supervisor';
  const isAdmin = userRole === 'admin';

  // 🆕 Determinar Primary Session (Oldest Active Session)
  useEffect(() => {
    const fetchPrimarySession = async () => {
      try {
        const response = await fetch(`${window.location.origin}/api/sessions/active`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();

        if (data.success && data.sessions && data.sessions.length > 0) {
          // Filtrar primero por sesiones que parecen validas
          // Prioridad: 1. Strict Oldest (Principal) - Connection status does NOT change selection
          const sortedSessions = [...data.sessions].sort((a, b) => {
            // Usar fecha de creación (más antiguo primero)
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeA - timeB;
          });

          if (sortedSessions.length > 0) {
            const primary = sortedSessions[0];
            console.log('[DASHBOARD] 🏆 Primary Session Determinado:', {
              sessionId: primary.sessionId,
              created_at: primary.created_at,
              isConnected: primary.isConnected,
              phone: primary.phoneNumber
            });
            setPrimarySessionId(primary.sessionId);
          }
        }
      } catch (err) {
        console.error('[DASHBOARD] Error fetching primary session:', err);
      }
    };

    if (sessionId || localStorage.getItem('token')) {
      fetchPrimarySession();
    }
  }, [sessionId]);

  // Dashboard statistics state
  const [dashboardStats, setDashboardStats] = useState({
    contacts: 0,
    groups: 0,
    messages: 0,
    messagesToday: 0,
    agents: 0,
    activeLines: 0,
    unreadMessages: 0,
    chatbots: 0,
    campaigns: 0,
    kanbans: 0,
    appointments: 0
  });

  // 🔍 DEBUG: Loguear cambios en dashboardStats
  useEffect(() => {
    console.log('%c[DASHBOARD] 📊 dashboardStats CAMBIÓ:', 'background: red; color: white; font-weight: bold; padding: 5px;', {
      agents: dashboardStats.agents,
      chatbots: dashboardStats.chatbots,
      kanbans: dashboardStats.kanbans,
      contacts: dashboardStats.contacts,
      STACK: new Error().stack
    });
  }, [dashboardStats]);

  // Estado para ModernAlert
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    onConfirm: () => { }
  });

  // Estado para diálogo de confirmación de logout
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Calcular mensajes no leídos totales
  const totalUnreadMessages = chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);

  // Mapeo de items del menú a módulos de permisos
  const moduleMap: { [key: string]: string } = {
    'dashboard': 'dashboard',
    'chat': 'chat',
    'history': 'chat',
    'crm': 'contacts',
    'campaigns': 'campaign',
    'chatbot': 'chat',
    'calendar': 'calendar',
    'analytics': 'analytics',
    'agents': 'users',
    'kanban': 'kanban',
    'permissions': 'users'
  };

  // Elementos de navegación principal
  const allNavigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      color: '#00a884'
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: <ChatIcon />,
      path: '/dashboard/chat',
      color: '#25d366',
      badge: totalUnreadMessages
    },
    {
      id: 'history',
      label: 'Historial',
      icon: <HistoryIcon />,
      path: '/dashboard/history',
      color: '#667781'
    },
    {
      id: 'crm',
      label: 'Contactos',
      icon: <ContactsIcon />,
      path: '/dashboard/crm',
      color: '#ff9800'
    },
    {
      id: 'campaigns',
      label: 'Campañas',
      icon: <CampaignIcon />,
      path: '/dashboard/campaigns',
      color: '#e91e63'
    },
    {
      id: 'chatbot',
      label: 'Chatbot',
      icon: <BotIcon />,
      path: '/dashboard/chatbot',
      color: '#9c27b0'
    },
    {
      id: 'calendar',
      label: 'Calendario',
      icon: <CalendarIcon />,
      path: '/dashboard/calendar',
      color: '#2196f3'
    },
    // Estados de WhatsApp removido - funcionalidad no soportada por WhatsApp Web/Baileys
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <AnalyticsIcon />,
      path: '/dashboard/analytics',
      color: '#ff5722'
    },
    {
      id: 'agents',
      label: 'Agentes',
      icon: <AgentsIcon />,
      path: '/dashboard/agents',
      color: '#00bcd4'
    },
    {
      id: 'kanban',
      label: 'Kanban Contactos',
      icon: <KanbanIcon />,
      path: '/dashboard/kanban',
      color: '#673ab7'
    },
    {
      id: 'connection',
      label: 'Conexión',
      icon: <WhatsApp />,
      path: '/dashboard/connection',
      color: '#25d366'
    }
  ];

  // Filtrar items según permisos del usuario
  const navigationItems = useMemo(() => {
    // Si no hay userRole pero hay sessionId, es usuario con QR - mostrar todo
    const hasQRSession = sessionId && !permUserRole;
    // Si hay token JWT, es usuario autenticado con email/password
    const hasJWTAuth = localStorage.getItem('token') || sessionStorage.getItem('token');

    return allNavigationItems.filter(item => {
      const module = moduleMap[item.id];
      // Dashboard siempre visible
      if (item.id === 'dashboard') return true;
      // Usuario con QR (sin login email/password) ve todo
      if (hasQRSession) return true;
      // Usuario con JWT autenticado ve todo (mostrará mensaje en módulos que requieren WhatsApp)
      if (hasJWTAuth) return true;
      // Admin ve todo
      if (userRole === 'admin' || userRole === 'super_admin') return true;
      // Otros usuarios solo ven lo que tienen permiso
      return hasModuleAccess(module);
    });
  }, [userRole, hasModuleAccess, sessionId, permUserRole]);


  // Detectar ruta activa
  const activeItem = navigationItems.find(item =>
    location.pathname === item.path ||
    (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
  ) || navigationItems[0];

  // Detectar si estamos en la página de chat para aplicar modo oscuro completo
  // IMPORTANTE: Solo /dashboard/chat, NO /dashboard/chatbot
  const isInChatPage = location.pathname === '/dashboard/chat' || location.pathname.startsWith('/dashboard/chat/');


  // Configurar logger con sessionId
  useEffect(() => {
    if (sessionId) {
      frontendLogger.setSessionId(sessionId);
      frontendLogger.log('DASHBOARD_MOUNTED', {
        path: location.pathname,
        userRole,
        userId
      });
    }
  }, [sessionId, location.pathname, userRole, userId]);



  // Función para verificar si la sesión es válida
  const checkSessionValidity = useCallback(async (currentSessionId: string) => {
    if (!currentSessionId) {
      frontendLogger.log('SESSION_INVALID', { reason: 'No sessionId provided' });
      setSessionValid(false);
      return;
    }

    try {
      frontendLogger.log('CHECKING_SESSION_VALIDITY', { sessionId: currentSessionId });

      const response = await sessionFetch(`/api/session/${currentSessionId}/status`);
      const data = await response.json();

      if (data.success && data.isConnected && data.phoneNumber) {
        frontendLogger.log('SESSION_VALID', {
          phoneNumber: data.phoneNumber,
          isConnected: data.isConnected
        });

        // ✅ WhatsApp está conectado - marcar sesión como válida
        setSessionValid(true);
        setWhatsappStatus('connected');
        setUserPhoneNumber(data.phoneNumber);
        setUserProfilePic(`/api/avatar/${currentSessionId}/${data.phoneNumber}@s.whatsapp.net`);

        // ℹ️ Token JWT se recibirá automáticamente via Socket.IO (evento 'auth_token')
        // No es necesario validarlo aquí, el servidor lo envía cuando conecta WhatsApp
        console.log('[AUTH] ✅ Sesión WhatsApp válida. Token JWT se recibirá via Socket.IO si es necesario.');
      } else {
        frontendLogger.log('SESSION_INVALID', {
          reason: 'Not connected or no phone number',
          data
        });

        setSessionValid(false);
        setWhatsappStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking session validity:', error);
      frontendLogger.log('SESSION_CHECK_ERROR', {
        error: error instanceof Error ? error.message : String(error)
      });

      setSessionValid(false);
      setWhatsappStatus('disconnected');
    }
  }, []);



  const checkWhatsappStatus = useCallback(async () => {
    if (sessionValid === false) return;

    // Si estamos autenticando (esperando token), NO verificar estado aún
    if (isAuthenticating) {
      console.log('[AUTH] ⏳ Autenticando... saltando verificación de estado');
      return;
    }

    // La validación de token ya no es necesaria aquí
    // Token JWT se recibe automáticamente via Socket.IO (evento 'auth_token')
    // Solo verificamos que la sesión de WhatsApp esté activa

    // ... (resto de la función)
  }, [sessionValid, isAuthenticating]);

  // Función para obtener estadísticas del dashboard
  const fetchDashboardStats = useCallback(async () => {
    console.log('[STATS-DEBUG] 🔍 === INICIANDO fetchDashboardStats ===');
    console.log('[STATS-DEBUG] 📋 Estado actual:', {
      sessionId: sessionId || 'NULL',
      sessionIdLength: sessionId?.length,
      sessionValid,
      timestamp: new Date().toISOString()
    });

    // Si no hay sessionId, verificar si hay JWT token
    const hasJWTAuth = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!sessionId && !hasJWTAuth) {
      console.warn('[STATS-DEBUG] ⚠️ ABORTANDO - sin sessionId ni JWT token');
      return;
    }

    // Si es usuario JWT sin WhatsApp, no hay stats que cargar (todo será 0)
    if (!sessionId && hasJWTAuth) {
      console.log('[STATS-DEBUG] ℹ️ Usuario JWT sin WhatsApp - stats predeterminados en 0');
      // No abortamos, permitimos que siga para mostrar el dashboard vacío pero con UI funcional
    }

    // 🔥 MODIFICADO: No abortar si sessionValid es false pero tenemos JWT
    if (sessionValid === false && !hasJWTAuth) {
      console.warn('[STATS-DEBUG] ⚠️ ABORTANDO - sessionValid es false y no hay JWT token');
      return;
    }

    try {
      const url = `/api/dashboard/stats/${sessionId}`;
      console.log('[STATS-DEBUG] 📡 Haciendo fetch a:', url);
      console.log('[STATS] 🔄 Obteniendo estadísticas desde API para sessionId:', sessionId);

      const response = await fetch(url);
      console.log('[STATS-DEBUG] 📥 Respuesta HTTP:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();

      console.log('[STATS-DEBUG] 📦 Datos parseados:', {
        success: data.success,
        tieneStats: !!data.stats,
        stats: data.stats
      });

      console.log('[STATS] 📦 Respuesta API recibida:', {
        success: data.success,
        agents: data.stats?.agents,
        chatbots: data.stats?.chatbots,
        kanbans: data.stats?.kanbans,
        fullStats: data.stats
      });

      if (data.success && data.stats) {
        // Estructurar los datos correctamente para el dashboard
        const stats = {
          contacts: data.stats.contacts || 0,
          groups: data.stats.groups || 0,
          messages: data.stats.messages || 0,
          messagesToday: data.stats.messagesToday || 0,
          agents: data.stats.agents || 0,
          activeLines: data.stats.activeLines || 0,
          unreadMessages: data.stats.unreadMessages || 0,
          chatbots: data.stats.chatbots || 0,
          campaigns: data.stats.campaigns || 0,
          kanbans: data.stats.kanbans || 0,
          appointments: data.stats.appointments || 0
        };

        console.log('%c[STATS-DEBUG] ✅ Stats estructuradas:', 'background: green; color: white; padding: 5px;', stats);
        console.log('%c[STATS-DEBUG] 🎯 KANBANS RECIBIDOS DEL SERVIDOR:', 'background: yellow; color: black; font-weight: bold; padding: 5px;', {
          recibidoDelServidor: data.stats.kanbans,
          procesado: stats.kanbans,
          tipo: typeof stats.kanbans,
          esNumero: typeof stats.kanbans === 'number',
          esCero: stats.kanbans === 0
        });

        console.log('%c[STATS] 🚀 LLAMANDO setDashboardStats con kanbans=' + stats.kanbans, 'background: blue; color: white; font-weight: bold; padding: 5px;');
        setDashboardStats(stats);
        console.log('[STATS] 📊 Estadísticas actualizadas:', stats);
        console.log('[STATS-DEBUG] === FIN fetchDashboardStats ===');
        // Las notificaciones se calculan automáticamente desde chats.unreadCount
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  }, [sessionId]); // ✅ Removed sessionValid dependency

  // Actualizar título de página con mensajes no leídos
  useEffect(() => {
    if (totalUnreadMessages > 0) {
      document.title = `(${totalUnreadMessages}) Whinsap - Mensajes nuevos`;
    } else {
      document.title = 'Whinsap - Plataforma Empresarial';
    }
  }, [totalUnreadMessages]);

  // ✅ FIX: Memoizar handlers de Socket.IO para evitar recrearlos en cada render
  const handleStatsUpdate = useCallback((stats: any) => {
    console.log('%c[SOCKET] 🚫 BLOQUEADO - Socket.IO intentó actualizar stats pero está DESHABILITADO', 'background: red; color: white; font-weight: bold; padding: 5px;');
    console.log('[SOCKET] Stats que intentó enviar:', stats);
    console.log('[SOCKET] ℹ️ Solo el fetch inicial actualiza los stats, Socket.IO está deshabilitado para evitar sobrescribir con 0');

    // 🚫 DESHABILITADO: Socket.IO sobrescribe los stats con 0
    // Solo usamos el fetch inicial de fetchDashboardStats()
    // NO actualizar dashboardStats desde Socket.IO

    /* BLOQUEADO
    const updatedStats = {
      contacts: stats.contacts?.total || 0,
      groups: stats.contacts?.groups || 0,
      messages: stats.messages?.total || 0,
      messagesToday: stats.messages?.today || 0,
      agents: stats.agents || 0,
      activeLines: stats.activeLines || 0,
      unreadMessages: stats.unreadMessages || 0,
      chatbots: stats.chatbots || 0,
      campaigns: stats.campaigns || 0,
      kanbans: stats.kanbans || 0,
      appointments: stats.appointments || 0
    };
    setDashboardStats(updatedStats);
    */
  }, []);

  const handleConnectionUpdate = useCallback((data: any) => {
    console.log('[SOCKET] 📱 Estado de conexión actualizado:', data);
    if (data.status === 'connected' || data.isConnected === true) {
      setWhatsappStatus('connected');

      const localToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (localToken) {
        setSessionValid(true);
        setIsAuthenticating(false);
      } else {
        console.log('[SOCKET] ⏳ Conectado pero esperando token de autenticación... (Activando modo autenticación)');
        setIsAuthenticating(true);
      }

      // ✅ ACTUALIZAR STATS - Importante para reflejar líneas activas y límites
      setTimeout(() => {
        fetchDashboardStats();
      }, 1000);
    } else if (data.status === 'disconnected' || data.isConnected === false) {
      setWhatsappStatus('disconnected');
      setIsAuthenticating(false);
      // Actualizar stats para reflejar que hay menos líneas activas
      fetchDashboardStats();
    } else {
      setWhatsappStatus('connecting');
    }
    setLastConnectionCheck(new Date());
  }, [fetchDashboardStats]);

  const handleSessionLoggedOut = useCallback((data: any) => {
    console.log('[SOCKET] 👋 Sesión cerrada desde el teléfono:', data);

    // ✅ Verificar que el evento pertenece a ESTA sesión
    const isMySession = data.sessionId === sessionId ||
      data.phoneNumber === userPhoneNumber;

    if (!isMySession) {
      console.log('[SOCKET] ⚠️ Evento de logout para otra sesión, ignorando:', {
        eventSessionId: data.sessionId,
        mySessionId: sessionId,
        eventPhone: data.phoneNumber,
        myPhone: userPhoneNumber
      });
      return; // ✅ IGNORAR evento de otras sesiones
    }

    frontendLogger.log('LOGOUT_EVENT_RECEIVED', {
      eventData: data,
      triggeredBy: 'socket.io session-logged-out',
      verified: true,
      willClearStorage: true,
      willRedirect: true,
      currentUrl: window.location.href
    });

    sessionStorage.clear();
    localStorage.clear();

    frontendLogger.log('STORAGE_CLEARED', {
      action: 'sessionStorage and localStorage cleared'
    });

    setAlertConfig({
      title: 'Conexión de WhatsApp Cerrada',
      message: 'Tu conexión con WhatsApp se ha cerrado. Debes escanear un nuevo código QR para reconectar.',
      type: 'info',
      onConfirm: () => {
        setAlertOpen(false);
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = '/';
      }
    });
    setAlertOpen(true);
  }, [sessionId, userPhoneNumber]); // ✅ Agregar dependencias

  const handleAuthToken = useCallback((data: any) => {
    console.log('[SOCKET] 🔐 Token recibido:', data);
    if (data.token) {
      // Guardar token en localStorage y sessionStorage
      localStorage.setItem('token', data.token);
      sessionStorage.setItem('token', data.token);

      // Guardar rol del usuario
      if (data.user && data.user.role) {
        localStorage.setItem('userRole', data.user.role);
        sessionStorage.setItem('userRole', data.user.role);
        console.log('[SOCKET] 👤 Rol guardado:', data.user.role);
      } else {
        // Si no hay role en data.user, asumir que es admin (login por QR)
        localStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('userRole', 'admin');
        console.log('[SOCKET] 👤 Asumiendo rol admin (login por QR)');
      }

      // ✅ FIX RACE CONDITION: Ahora que tenemos el token, marcamos la sesión como válida
      console.log('[SOCKET] ✅ Token guardado, activando sesión');
      setSessionValid(true);
      setWhatsappStatus('connected');
      setIsAuthenticating(false);

      // Recargar estadísticas ahora que tenemos autenticación válida
      fetchDashboardStats();
    }
  }, [fetchDashboardStats]);

  const handleAgentForceLogout = useCallback((data: any) => {
    console.log('[SOCKET] 🚫 Logout forzado de agente:', data);
    const currentRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
    if (currentRole === 'agent') {
      handleSessionLoggedOut(data);
    }
  }, [handleSessionLoggedOut]);

  // ✅ Inicialización: Ejecutar una sola vez cuando cambia sessionId
  useEffect(() => {
    // Redirigir a dashboard si estamos en la ruta base
    if (location.pathname === '/dashboard') {
      navigate('/dashboard', { replace: true });
    }

    // Reset session validity when sessionId changes
    if (sessionId) {
      // Verificar si ya hay token antes de resetear
      const existingToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (existingToken) {
        console.log('[AUTH] ✅ Token encontrado, marcando sesión como válida inmediatamente');
        setSessionValid(true);
      } else {
        setSessionValid(null); // Reset to null when sessionId changes
      }
      checkSessionValidity(sessionId);
    } else {
      setSessionValid(false);
    }

    // Verificar estado de WhatsApp inicialmente (sin polling!)
    checkWhatsappStatus();
  }, [sessionId, checkSessionValidity, checkWhatsappStatus]); // ✅ Removed fetchDashboardStats

  // ✅ Obtener estadísticas cuando sessionId o sessionValid cambien a true
  useEffect(() => {
    if (sessionId && sessionValid !== false) {
      fetchDashboardStats();
    }
  }, [sessionId, sessionValid, fetchDashboardStats]);

  // ✅ Usar Socket.IO del contexto global (evitar conexiones duplicadas)
  const { socket, isConnected } = useSocket();

  // ✅ Socket.IO: Configurar listeners en tiempo real usando el contexto global
  useEffect(() => {
    if (!socket || !sessionId) return;

    console.log(`[SOCKET] 📡 Configurando listeners para sesión: ${sessionId}`);

    // Unirse a la sala de la sesión para recibir eventos específicos
    if (isConnected) {
      socket.emit('join-session', sessionId);
      console.log(`[SOCKET] 🔗 Unido a sala de sesión: ${sessionId}`);
    }

    // Suscribirse a eventos con handlers memoizados
    socket.on(`dashboard-stats-${sessionId}`, handleStatsUpdate);
    socket.on(`connection-${sessionId}`, handleConnectionUpdate);
    socket.on('connection-update', handleConnectionUpdate);
    // COMENTADO: Ya NO escuchamos eventos de logout de WhatsApp - No afectan la sesión web
    // socket.on('session-logged-out', handleSessionLoggedOut);
    // socket.on(`session-logged-out-${sessionId}`, handleSessionLoggedOut);
    socket.on('auth_token', handleAuthToken);
    socket.on('agent-force-logout', handleAgentForceLogout);

    // Listener para progreso de sincronización
    socket.on('sync-progress', (data: any) => {
      console.log('📊 Progreso de sincronización:', data);
      setSyncProgress({
        status: data.status,
        percentage: data.percentage,
        message: data.message
      });

      // Auto-ocultar después de completar
      if (data.status === 'completed') {
        setTimeout(() => {
          setSyncProgress({ status: 'idle', percentage: 0, message: '' });
        }, 3000);
      }
    });

    console.log(`[SOCKET] ✅ Escuchando actualizaciones en tiempo real para sesión: ${sessionId}`);

    return () => {
      console.log(`[SOCKET] 🔌 Desconectando listeners para sesión: ${sessionId}`);
      socket.off(`dashboard-stats-${sessionId}`, handleStatsUpdate);
      socket.off(`connection-${sessionId}`, handleConnectionUpdate);
      socket.off('connection-update', handleConnectionUpdate);
      // COMENTADO: Ya NO escuchamos eventos de logout de WhatsApp
      // socket.off('session-logged-out', handleSessionLoggedOut);
      // socket.off(`session-logged-out-${sessionId}`, handleSessionLoggedOut);
      socket.off('auth_token', handleAuthToken);
      socket.off('agent-force-logout', handleAgentForceLogout);
      socket.off('sync-progress');
      // NO desconectar el socket, es compartido globalmente
    };
  }, [socket, isConnected, sessionId, handleStatsUpdate, handleConnectionUpdate, handleSessionLoggedOut, handleAuthToken, handleAgentForceLogout]);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (window.innerWidth < 1200) {
      setDrawerOpen(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Handler para mostrar diálogo de confirmación de logout
  const handleLogoutClick = () => {
    handleMenuClose();
    setLogoutDialogOpen(true);
  };

  // Handler para confirmar logout
  const handleLogoutConfirm = () => {
    setLogoutDialogOpen(false);
    onLogout();
  };

  const drawerWidth = drawerMinimized ? 72 : 280;

  return (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      bgcolor: '#0f172a', // Deep Slate
      overflow: 'hidden',
      color: 'text.primary'
    }}>
      <IncomingCall />

      {/* Sidebar Moderno "Floating Rail" - Template Oscuro */}
      <Box
        component="nav"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(15, 23, 42, 0.6)', // Semi-transparente
          backdropFilter: 'blur(12px)',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1200
        }}
      >
        {/* Logo Area */}
        <Box sx={{
          p: 3,
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: drawerMinimized ? 'center' : 'space-between'
        }}>
          {!drawerMinimized ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)'
              }}>
                {/* El logo ya tiene gradiente interno, usamos fondo neutro o transparente */}
                <WhinsapLogo sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: 'white' }}>
                Whinsap
              </Typography>
            </Box>
          ) : (
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }} onClick={() => setDrawerMinimized(false)}>
              <WhinsapLogo sx={{ fontSize: 32 }} />
            </Box>
          )}

          {!drawerMinimized && (
            <IconButton
              onClick={() => setDrawerMinimized(true)}
              sx={{
                color: 'rgba(255,255,255,0.4)',
                '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
          )}
        </Box>

        {/* Navigation List */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 2, py: 2 }}>
          <List>
            {navigationItems.map((item) => {
              const isActive = activeItem.id === item.id;
              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
                  <Tooltip title={drawerMinimized ? item.label : ''} placement="right" arrow>
                    <ListItemButton
                      onClick={() => handleNavigation(item.path)}
                      selected={isActive}
                      sx={{
                        borderRadius: 3,
                        minHeight: 52,
                        justifyContent: drawerMinimized ? 'center' : 'initial',
                        px: 2.5,
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                        background: isActive ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0) 100%)' : 'transparent',
                        '&:before': isActive ? {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: '15%',
                          bottom: '15%',
                          width: 3,
                          borderRadius: '0 4px 4px 0',
                          backgroundColor: '#6366f1'
                        } : {},
                        '&:hover': {
                          background: 'rgba(255,255,255,0.05)',
                          color: 'white',
                          transform: 'translateX(4px)'
                        },
                        '&.Mui-selected': {
                          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)',
                          '&:hover': {
                            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%)',
                          }
                        }
                      }}
                    >
                      <ListItemIcon sx={{
                        minWidth: 0,
                        mr: drawerMinimized ? 0 : 2,
                        justifyContent: 'center',
                        color: isActive ? '#818cf8' : 'inherit',
                        filter: isActive ? 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))' : 'none',
                        transition: 'all 0.2s'
                      }}>
                        {item.badge ? (
                          <Badge badgeContent={item.badge} color="error" variant="dot">
                            {item.icon}
                          </Badge>
                        ) : item.icon}
                      </ListItemIcon>

                      {!drawerMinimized && (
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '0.95rem'
                          }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Footer Actions */}
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Configuración */}
          <ListItemButton
            onClick={() => handleNavigation('/dashboard/settings')}
            sx={{
              borderRadius: 3,
              mb: 1,
              justifyContent: drawerMinimized ? 'center' : 'flex-start',
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: drawerMinimized ? 0 : 2, color: 'inherit' }}>
              <SettingsIcon />
            </ListItemIcon>
            {!drawerMinimized && (
              <ListItemText primary="Configuración" primaryTypographyProps={{ fontWeight: 500 }} />
            )}
          </ListItemButton>

          {/* Logout */}
          <ListItemButton
            onClick={onLogout}
            sx={{
              borderRadius: 3,
              justifyContent: drawerMinimized ? 'center' : 'flex-start',
              color: 'rgba(239, 68, 68, 0.8)',
              '&:hover': {
                color: '#ef4444',
                bgcolor: 'rgba(239, 68, 68, 0.1)'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, mr: drawerMinimized ? 0 : 2, color: 'inherit' }}>
              <LogoutIcon />
            </ListItemIcon>
            {!drawerMinimized && (
              <ListItemText primary="Cerrar Sesión" primaryTypographyProps={{ fontWeight: 500 }} />
            )}
          </ListItemButton>
        </Box>
      </Box>

      {/* Main Content Area con Header Oscuro */}
      <Box sx={{
        flexGrow: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'radial-gradient(circle at top right, #1e293b 0%, #0f172a 40%)',
        overflow: 'hidden'
      }}>

        {/* Header integrado (Top Bar) con Stats */}
        <Box sx={{
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 4,
          position: 'relative',
          zIndex: 10
        }}>
          {/* Breadcrumbs / Page Title */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
              {activeItem.label}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              {userRole === 'admin' ? 'Administrador' : isAgent ? 'Agente de Soporte' : 'Supervisor'}
            </Typography>
          </Box>

          {/* Middle Stats Bar - PESTAÑAS SOLICITADAS */}
          <Box sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 1.5,
            bgcolor: 'rgba(255,255,255,0.03)',
            px: 2,
            py: 0.8,
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.05)',
            mx: 2
          }}>
            {/* 1. Estado Conexión */}
            <Tooltip title="Estado de WhatsApp">
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 0.5,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: dashboardStats.activeLines > 0 ? 'success.main' : 'error.main',
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  Estado
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: dashboardStats.activeLines > 0 ? 'success.main' : 'error.main' }}>
                  {dashboardStats.activeLines > 0 ? 'Conectado' : 'Desconectado'}
                </Typography>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

            {/* 2. Sincronización - Solo mostrar si hay sincronización activa */}
            {syncProgress.status === 'syncing' && (
              <>
                <Tooltip title={syncProgress.message || 'Sincronizando datos...'}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} sx={{ color: '#4f46e5' }} thickness={6} />
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 0.8, mb: 0.3 }}>
                        Sincro
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.8rem', lineHeight: 1 }}>
                        {syncProgress.percentage || 0}%
                      </Typography>
                    </Box>
                  </Box>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />
              </>
            )}

            {/* 3. Contactos */}
            <Tooltip title={`Total de contactos: ${dashboardStats.contacts || 0}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ContactsIcon sx={{ fontSize: 18, color: '#00bcd4' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 0.8, mb: 0.3 }}>
                    Contactos
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.8rem', lineHeight: 1 }}>
                    {dashboardStats.contacts || 0}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

            {/* 4. Mensajes */}
            <Tooltip title={`Mensajes totales: ${dashboardStats.messages || 0} (${dashboardStats.messagesToday || 0} hoy)`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MessageIcon sx={{ fontSize: 18, color: '#10b981' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 0.8, mb: 0.3 }}>
                    Mensajes
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.8rem', lineHeight: 1 }}>
                    {dashboardStats.messages || 0}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

            {/* 5. Agentes */}
            <Tooltip title={`Agentes activos: ${dashboardStats.agents || 0}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AgentsIcon sx={{ fontSize: 18, color: '#2196f3' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 0.8, mb: 0.3 }}>
                    Agentes
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.8rem', lineHeight: 1 }}>
                    {dashboardStats.agents || 0}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

            {/* 6. Bots */}
            <Tooltip title={`Chatbots activos: ${dashboardStats.chatbots || 0}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BotIcon sx={{ fontSize: 18, color: '#e91e63' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 0.8, mb: 0.3 }}>
                    Bots
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.8rem', lineHeight: 1 }}>
                    {dashboardStats.chatbots || 0}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

            {/* 7. Campañas */}
            <Tooltip title={`Campañas activas: ${dashboardStats.campaigns || 0}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CampaignIcon sx={{ fontSize: 18, color: '#ff9800' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 0.8, mb: 0.3 }}>
                    Campañas
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.8rem', lineHeight: 1 }}>
                    {dashboardStats.campaigns || 0}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />

            {/* 8. Agenda */}
            <Tooltip title={`Citas agendadas: ${dashboardStats.appointments || 0}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 0.8, mb: 0.3 }}>
                    Agenda
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.8rem', lineHeight: 1 }}>
                    {dashboardStats.appointments || 0}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          </Box>

          {/* Right Side - User Menu & Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Notifications Icon */}
            <Tooltip title="Notificaciones">
              <IconButton sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <Badge badgeContent={totalUnreadMessages} color="error" variant="dot">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* User Avatar & Menu */}
            <IconButton onClick={handleMenuOpen} sx={{ p: 0.5, border: '2px solid rgba(255,255,255,0.1)', '&:hover': { borderColor: 'rgba(255,255,255,0.3)' } }}>
              <Avatar
                src={userProfilePic || undefined}
                sx={{ width: 34, height: 34 }}
              >
                {(userName || 'U').charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
        </Box>

        {/* User Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            elevation: 0,
            sx: {
              mt: 1.5,
              bgcolor: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 3,
              minWidth: 200,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              '& .MuiMenuItem-root': {
                py: 1.5,
                color: '#e2e8f0',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
              }
            }
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" sx={{ color: 'white' }}>{userName || 'Usuario'}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{userPhoneNumber}</Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <MenuItem onClick={() => { handleMenuClose(); handleNavigation('/dashboard/settings'); }}>
            <ListItemIcon sx={{ color: '#94a3b8' }}><SettingsIcon fontSize="small" /></ListItemIcon>
            Configuración
          </MenuItem>
          <MenuItem onClick={handleLogoutClick} sx={{ color: '#ef4444 !important' }}>
            <ListItemIcon sx={{ color: '#ef4444' }}><LogoutIcon fontSize="small" /></ListItemIcon>
            Cerrar Sesión
          </MenuItem>
        </Menu>

        {/* Scrollable Content Area */}
        <Box
          id="main-content-area"
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 0,
            position: 'relative'
          }}
        >
          <Fade in={true} timeout={800}>
            <Box>
              {/* Verificar si la sesión es válida O si es usuario JWT autenticado */}
              {sessionValid === false && !localStorage.getItem('token') ? (
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '60vh',
                  flexDirection: 'column',
                  textAlign: 'center',
                  p: 4
                }}>
                  <WhatsApp sx={{ fontSize: 80, color: '#ccc', mb: 3 }} />
                  <Typography variant="h4" sx={{ mb: 2, color: '#666' }}>
                    Sesión no válida
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3, color: '#888', maxWidth: 500 }}>
                    Tu sesión de WhatsApp no está activa. Necesitas conectar tu teléfono para acceder al historial y otras funciones.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<QrCode />}
                    onClick={() => {
                      // Redirigir al inicio para reconectar (sin recarga de página)
                      navigate('/');
                    }}
                    sx={{
                      bgcolor: '#00a884',
                      '&:hover': { bgcolor: '#008069' },
                      px: 4,
                      py: 2
                    }}
                  >
                    Conectar WhatsApp
                  </Button>
                </Box>
              ) : (
                <Suspense fallback={<ModuleLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={
                      <ProtectedRoute module="analytics" action="view">
                        <AnalyticsModule sessionId={sessionId} />
                      </ProtectedRoute>
                    } />
                    <Route path="/chat/*" element={
                      <ProtectedRoute module="chat" action="view">
                        <RequiresWhatsApp sessionId={sessionId} moduleName="Chat">
                          <Suspense fallback={<ModuleLoadingFallback />}>
                            {isAgent ? (
                              <Box sx={{ p: 3 }}>
                                <AgentChatView
                                  userId={userId || ''}
                                  sessionId={primarySessionId || sessionId}
                                  onChatSelect={(chatJid) => {
                                    navigate(`/dashboard/chat/${chatJid}`);
                                  }}
                                />
                              </Box>
                            ) : (
                              <WhatsAppWebChat sessionId={primarySessionId || sessionId} />
                            )}
                          </Suspense>
                        </RequiresWhatsApp>
                      </ProtectedRoute>
                    } />
                    <Route path="/history/*" element={
                      <ProtectedRoute module="chat" action="view">
                        <RequiresWhatsApp sessionId={sessionId} moduleName="Historial">
                          <HistoryModule sessionId={sessionId} />
                        </RequiresWhatsApp>
                      </ProtectedRoute>
                    } />
                    <Route path="/messages/*" element={
                      <ProtectedRoute module="chat" action="view">
                        <Suspense fallback={<ModuleLoadingFallback />}>
                          <div style={{ padding: '20px', textAlign: 'center' }}>
                            <Typography variant="h6" color="textSecondary">
                              El módulo de mensajes está disponible en el módulo de Chat
                            </Typography>
                          </div>
                        </Suspense>
                      </ProtectedRoute>
                    } />
                    <Route path="/crm/*" element={
                      <ProtectedRoute module="contacts" action="view">
                        <RequiresWhatsApp sessionId={sessionId} moduleName="Contactos">
                          <ContactsManagerModule sessionId={sessionId} />
                        </RequiresWhatsApp>
                      </ProtectedRoute>
                    } />
                    <Route path="/campaigns/*" element={
                      <ProtectedRoute module="campaign" action="view">
                        <RequiresWhatsApp sessionId={sessionId} moduleName="Campañas">
                          <RealCampaignsModule sessionId={sessionId} />
                        </RequiresWhatsApp>
                      </ProtectedRoute>
                    } />
                    <Route path="/chatbot/*" element={
                      <ProtectedRoute module="chat" action="view">
                        <ChatbotModule sessionId={sessionId} />
                      </ProtectedRoute>
                    } />
                    <Route path="/calendar/*" element={
                      <ProtectedRoute module="calendar" action="view">
                        <CalendarModule sessionId={sessionId} />
                      </ProtectedRoute>
                    } />
                    <Route path="/whatsapp-status/*" element={
                      <WhatsAppStatusModule sessionId={sessionId} />
                    } />
                    <Route path="/analytics/*" element={
                      <ProtectedRoute module="analytics" action="view">
                        <AnalyticsModule sessionId={sessionId} />
                      </ProtectedRoute>
                    } />
                    <Route path="/agents/*" element={
                      <ProtectedRoute module="users" action="view">
                        <AgentsManagementModule sessionId={sessionId} />
                      </ProtectedRoute>
                    } />
                    <Route path="/kanban/*" element={
                      <ProtectedRoute module="kanban" action="view">
                        <KanbanContactsModule sessionId={sessionId} />
                      </ProtectedRoute>
                    } />
                    <Route path="/connection/*" element={
                      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>}>
                        <WhatsAppConnectionModule sessionId={sessionId} />
                      </Suspense>
                    } />
                    <Route path="/settings/*" element={
                      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>}>
                        <SettingsModule sessionId={sessionId} />
                      </Suspense>
                    } />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              )}
            </Box>
          </Fade>
        </Box>
      </Box >

      {/* Alert moderno para notificaciones importantes */}
      < ModernAlert
        open={alertOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => {
          if (alertConfig.type !== 'info') {
            setAlertOpen(false);
          }
        }}
        onConfirm={alertConfig.onConfirm}
      />

      {/* Diálogo de Confirmación de Logout */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1e293b',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }
        }}
      >
        <DialogTitle sx={{
          color: 'white',
          fontSize: '1.25rem',
          fontWeight: 600,
          pb: 1
        }}>
          Confirmar Cierre de Sesión
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgba(255,255,255,0.7)' }}>
            ¿Está seguro que desea cerrar sesión?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setLogoutDialogOpen(false)}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleLogoutConfirm}
            variant="contained"
            sx={{
              bgcolor: '#ef4444',
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              '&:hover': {
                bgcolor: '#dc2626',
                boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)'
              }
            }}
          >
            Cerrar Sesión
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
};

export default WhinsapDashboard;