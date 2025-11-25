import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { sessionFetch } from '../utils/sessionFetch';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useWhatsApp } from '../context/WhatsAppContext';
import { useTheme } from '../contexts/ThemeContext';
import { frontendLogger } from '../utils/frontendLogger';
import ProtectedRoute from '../components/ProtectedRoute';
import { usePermissions } from '../hooks/usePermissions';
import { useSyncProgress } from '../hooks/useSyncProgress';
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
  Button
} from '@mui/material';
import {
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
  Sync,
  CheckCircle
} from '@mui/icons-material';

// Componente de llamada entrante (cargado inmediatamente por ser crítico)
import IncomingCall from '../components/IncomingCall';
import SyncProgressBar from '../components/SyncProgressBar';
import AgentChatView from '../components/AgentChatView';
import ModernAlert from '../components/ModernAlert';

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
const AgentsStatusModule = lazy(() => import('../modules/AgentsStatusModule'));
const KanbanContactsModule = lazy(() => import('../modules/KanbanContactsModule'));
const AgentPermissionsManager = lazy(() => import('../components/AgentPermissionsManager'));
const WhatsAppStatusModule = lazy(() => import('../modules/WhatsAppStatusModule'));

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

interface WhatsFlowDashboardProps {
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

const WhatsFlowDashboard: React.FC<WhatsFlowDashboardProps> = ({ sessionId, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { chats } = useWhatsApp();
  const { toggleTheme, isDarkMode } = useTheme();
  const { hasModuleAccess, userRole: permUserRole } = usePermissions();
  const syncProgress = useSyncProgress(sessionId); // 🔄 Hook de sincronización
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerMinimized, setDrawerMinimized] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // Calcular notificaciones dinámicamente desde chats con mensajes no leídos
  const notifications = useMemo(() => {
    return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
  }, [chats]);
  const [whatsappStatus, setWhatsappStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastConnectionCheck, setLastConnectionCheck] = useState(new Date());
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false); // Nuevo estado para evitar race conditions

  // Detectar rol del usuario (priorizar el del hook de permisos)
  const userRole = permUserRole || sessionStorage.getItem('userRole') || localStorage.getItem('userRole') || 'admin';
  const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
  const userName = sessionStorage.getItem('userName') || localStorage.getItem('userName');
  const isAgent = userRole === 'agent';
  const isSupervisor = userRole === 'supervisor';
  const isAdmin = userRole === 'admin';

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
    kanbans: 0
  });

  // Estado para ModernAlert
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    onConfirm: () => { }
  });

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
      label: 'Agentes en Línea',
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
      id: 'permissions',
      label: 'Gestión de Usuarios',
      icon: <SecurityIcon />,
      path: '/dashboard/settings',
      color: '#f44336'
    }
  ];

  // Filtrar items según permisos del usuario
  const navigationItems = useMemo(() => {
    // Si no hay userRole pero hay sessionId, es usuario con QR - mostrar todo
    const hasQRSession = sessionId && !permUserRole;

    return allNavigationItems.filter(item => {
      const module = moduleMap[item.id];
      // Dashboard siempre visible
      if (item.id === 'dashboard') return true;
      // Usuario con QR (sin login email/password) ve todo
      if (hasQRSession) return true;
      // Admin ve todo
      if (userRole === 'admin') return true;
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

    // 🔒 VALIDACIÓN DE TOKEN LOCAL (Fix Auto-login)
    // IMPORTANTE: Admin por QR NO requiere token de usuario, solo sessionId de WhatsApp
    const localToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userType = sessionStorage.getItem('whatsflow_user_type') || localStorage.getItem('whatsflow_user_type');
    
    if (!localToken) {
      console.warn('[AUTH] 🚫 Sin token local. Verificando tipo de usuario...');
      
      // Si es admin por QR, NO requiere token de usuario
      if (userType === 'admin' && !isAgent) {
        console.log('[AUTH] ✅ Admin por QR - No requiere token de usuario, validando sessionId...');
        // Continuar con la validación del sessionId de WhatsApp
      } else {
        // Para agentes/supervisores SÍ se requiere token
        console.warn('[AUTH] 🚫 Usuario agente/supervisor sin token. Verificando si acabamos de hacer login...');
        
        // Dar un pequeño delay para que el token se guarde después del login
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const tokenAfterDelay = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!tokenAfterDelay) {
          console.warn('[AUTH] 🚫 Sesión sin token local. Bloqueando acceso.');
          frontendLogger.log('SESSION_INVALID', { reason: 'No local token found (Auto-login prevention)' });
          setSessionValid(false);
          setWhatsappStatus('disconnected');
          return;
        }
      }
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

        setSessionValid(true);
        setWhatsappStatus('connected');
        setUserPhoneNumber(data.phoneNumber);
        setUserProfilePic(`/api/avatar/${currentSessionId}/${data.phoneNumber}@s.whatsapp.net`);
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



  // ... (dentro de checkWhatsappStatus)
  const checkWhatsappStatus = useCallback(async () => {
    if (sessionValid === false) return;

    // Si estamos autenticando (esperando token), NO verificar estado aún
    if (isAuthenticating) {
      console.log('[AUTH] ⏳ Autenticando... saltando verificación de estado');
      return;
    }

    // 🔒 VALIDACIÓN DE TOKEN LOCAL (Fix Auto-login)
    // IMPORTANTE: Admin por QR NO requiere token de usuario
    const localToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userType = sessionStorage.getItem('whatsflow_user_type') || localStorage.getItem('whatsflow_user_type');
    
    if (!localToken) {
      // Si es admin por QR, NO requiere token
      if (userType === 'admin' && !isAgent) {
        console.log('[AUTH] ✅ Admin por QR - No requiere token, continuando...');
        // Continuar sin validar token
      } else {
        console.warn('[AUTH] ⏳ Token no encontrado, esperando...');
        
        // Dar tiempo para que el token se guarde después del login
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const tokenAfterDelay = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!tokenAfterDelay) {
          console.warn('[AUTH] 🚫 Sin token después del delay');
          setSessionValid(false);
          setWhatsappStatus('disconnected');
          return;
        }
      }
    }

    // ... (resto de la función)
  }, [sessionId, sessionValid, isAuthenticating, isAgent]);

  // ... (dentro de handleConnectionUpdate)
  const handleConnectionUpdate = (data: any) => {
    console.log('[SOCKET] 📱 Estado de conexión actualizado:', data);
    if (data.status === 'connected') {
      setWhatsappStatus('connected');

      const localToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (localToken) {
        setSessionValid(true);
        setIsAuthenticating(false); // Ya tenemos token, fin de autenticación
      } else {
        // Conectado pero sin token -> Estamos autenticando (QR escaneado)
        console.log('[SOCKET] ⏳ Conectado, esperando token... (Activando modo autenticación)');
        setIsAuthenticating(true);
        // NO setSessionValid(true) todavía
      }
    } else if (data.status === 'disconnected') {
      setWhatsappStatus('disconnected');
      setIsAuthenticating(false);
    } else {
      setWhatsappStatus('connecting');
    }
    setLastConnectionCheck(new Date());
  };

  // Función para obtener estadísticas del dashboard
const fetchDashboardStats = useCallback(async () => {
  if (!sessionId || sessionValid === false) return;

  try {
    const response = await fetch(`/api/dashboard/stats/${sessionId}`);
    const data = await response.json();

    if (data.success && data.stats) {
      // Estructurar los datos correctamente para el dashboard
      const stats = {
        contacts: data.stats.contacts?.total || 0,
        groups: data.stats.contacts?.groups || 0,
        messages: data.stats.messages?.total || 0,
        messagesToday: data.stats.messages?.today || 0,
        agents: data.stats.agents || 0,
        activeLines: data.stats.activeLines || 0,
        unreadMessages: data.stats.unreadMessages || 0,
        chatbots: data.stats.chatbots || 0,
        campaigns: data.stats.campaigns || 0,
        kanbans: data.stats.kanbans || 0
      };
      setDashboardStats(stats);
      // Las notificaciones se calculan automáticamente desde chats.unreadCount
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
  }
}, [sessionId, sessionValid]);

// Actualizar título de página con mensajes no leídos
useEffect(() => {
  if (totalUnreadMessages > 0) {
    document.title = `(${totalUnreadMessages}) WhatsFlow - Mensajes nuevos`;
  } else {
    document.title = 'WhatsFlow - Plataforma Empresarial';
  }
}, [totalUnreadMessages]);

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

  // Obtener estadísticas iniciales (solo una vez)
  fetchDashboardStats();

  // Usar Socket.IO para actualizaciones en tiempo real (SIN POLLING)
  const handleStatsUpdate = (stats: any) => {
    console.log('[SOCKET] 📊 Estadísticas actualizadas en tiempo real:', stats);
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
      kanbans: stats.kanbans || 0
    };
    setDashboardStats(updatedStats);
  };

  // Handler para actualizaciones de conexión de WhatsApp en tiempo real
  const handleConnectionUpdate = (data: any) => {
    console.log('[SOCKET] 📱 Estado de conexión actualizado:', data);
    if (data.status === 'connected') {
      setWhatsappStatus('connected');

      const localToken = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (localToken) {
        setSessionValid(true);
        setIsAuthenticating(false);
      } else {
        console.log('[SOCKET] ⏳ Conectado pero esperando token de autenticación... (Activando modo autenticación)');
        setIsAuthenticating(true);
      }
    } else if (data.status === 'disconnected') {
      setWhatsappStatus('disconnected');
      setIsAuthenticating(false);
    } else {
      setWhatsappStatus('connecting');
    }
    setLastConnectionCheck(new Date());
  };

  // Handler para cuando se cierra sesión desde el teléfono
  const handleSessionLoggedOut = (data: any) => {
    console.log('[SOCKET] 👋 Sesión cerrada desde el teléfono:', data);

    frontendLogger.log('LOGOUT_EVENT_RECEIVED', {
      eventData: data,
      triggeredBy: 'socket.io session-logged-out',
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
      title: 'Sesión Cerrada',
      message: 'Sesión cerrada desde el dispositivo móvil. Será redirigido a la página principal.',
      type: 'info',
      onConfirm: () => {
        setAlertOpen(false);
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'https://web.whats-flow.com/';
      }
    });
    setAlertOpen(true);
  };

  // Escuchar eventos de Socket.IO para estadísticas y conexión en tiempo real
  const socketIo = (window as any).io || require('socket.io-client');
  if (!socketIo || !sessionId) return;
  
  const ioSocket = socketIo();

  // Unirse a la sala de la sesión para recibir eventos específicos
  ioSocket.emit('join-session', sessionId);
  console.log(`[SOCKET] 🔗 Unido a sala de sesión: ${sessionId}`);

  // Suscribirse al evento de estadísticas para esta sesión
  ioSocket.on(`dashboard-stats-${sessionId}`, handleStatsUpdate);
  // Suscribirse al evento de conexión para esta sesión
  ioSocket.on(`connection-${sessionId}`, handleConnectionUpdate);
  ioSocket.on('connection-update', handleConnectionUpdate);
  // Escuchar evento de sesión cerrada desde el teléfono
  ioSocket.on('session-logged-out', handleSessionLoggedOut);
  ioSocket.on(`session-logged-out-${sessionId}`, handleSessionLoggedOut);

  // Escuchar evento de token de autenticación (Admin)
  ioSocket.on('auth_token', (data: any) => {
    console.log('[SOCKET] 🔐 Token recibido:', data);
    if (data.token) {
      localStorage.setItem('token', data.token);
      sessionStorage.setItem('token', data.token);
      if (data.user) {
        localStorage.setItem('userRole', data.user.role);
        sessionStorage.setItem('userRole', data.user.role);
      }

      // ✅ FIX RACE CONDITION: Ahora que tenemos el token, marcamos la sesión como válida
      console.log('[SOCKET] ✅ Token guardado, activando sesión');
      setSessionValid(true);
      setWhatsappStatus('connected');
      setIsAuthenticating(false);
    }
  });

  // Escuchar evento de logout forzado para agentes
  ioSocket.on('agent-force-logout', (data: any) => {
    console.log('[SOCKET] 🚫 Logout forzado de agente:', data);
    const currentRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
    if (currentRole === 'agent') {
      handleSessionLoggedOut(data);
    }
  });

  console.log(`[SOCKET] ✅ Escuchando actualizaciones en tiempo real para sesión: ${sessionId}`);
  console.log('[SOCKET] 🚫 POLLING ELIMINADO - Solo eventos de socket en tiempo real');

  return () => {
    ioSocket.off(`dashboard-stats-${sessionId}`, handleStatsUpdate);
    ioSocket.off(`connection-${sessionId}`, handleConnectionUpdate);
    ioSocket.off('connection-update', handleConnectionUpdate);
    ioSocket.off('session-logged-out', handleSessionLoggedOut);
    ioSocket.off(`session-logged-out-${sessionId}`, handleSessionLoggedOut);
    ioSocket.off('auth_token');
    ioSocket.off('agent-force-logout');
    ioSocket.disconnect();
  };
}, [sessionId]); // Solo depender de sessionId, las funciones se ejecutan internamente

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

const drawerWidth = drawerMinimized ? 72 : 280;

return (
  <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
    <IncomingCall />
    <SyncProgressBar sessionId={sessionId} />
    {/* Drawer lateral */}
    <Drawer
      variant="permanent"
      open={drawerOpen}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #25D366 0%, #128C7E 100%)',
          color: 'white',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowX: 'hidden',
          backdropFilter: 'blur(20px)',
          boxShadow: '2px 0 12px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      {/* Header del Drawer */}
      <Box sx={{ p: drawerMinimized ? 1 : 3, textAlign: 'center' }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: drawerMinimized ? 'center' : 'space-between',
          mb: drawerMinimized ? 1 : 2
        }}>
          {!drawerMinimized && (
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <WhatsApp sx={{ fontSize: 40, mr: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                WhatsFlow
              </Typography>
            </Box>
          )}
          {drawerMinimized && (
            <WhatsApp sx={{ fontSize: 32 }} />
          )}
          <IconButton
            onClick={() => setDrawerMinimized(!drawerMinimized)}
            sx={{
              color: 'white',
              padding: '4px',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            {drawerMinimized ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Box>
        {!drawerMinimized && (
          <>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Plataforma Empresarial
            </Typography>
            <Chip
              label="CONECTADO"
              size="small"
              sx={{
                mt: 1,
                bgcolor: '#25d366',
                color: 'white',
                fontWeight: 600
              }}
            />
          </>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

      {/* Lista de navegación */}
      <List sx={{ flex: 1, px: 1 }}>
        {navigationItems.map((item, index) => (
          <Grow
            key={item.id}
            in={true}
            timeout={300 + (index * 100)}
            style={{ transformOrigin: '0 0 0' }}
          >
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={drawerMinimized ? item.label : ''} placement="right">
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={activeItem.id === item.id}
                  sx={{
                    borderRadius: 2,
                    mx: drawerMinimized ? 0.5 : 1,
                    justifyContent: drawerMinimized ? 'center' : 'flex-start',
                    minHeight: 48,
                    px: drawerMinimized ? 1 : 2,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(255,255,255,0.2)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.3)',
                      }
                    },
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <ListItemIcon sx={{
                    color: 'white',
                    minWidth: drawerMinimized ? 'auto' : 40,
                    justifyContent: 'center'
                  }}>
                    {item.badge ? (
                      <Badge badgeContent={item.badge} color="error">
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  {!drawerMinimized && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: activeItem.id === item.id ? 600 : 400
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          </Grow>
        ))}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

      {/* Configuración y logout */}
      <List sx={{ px: 1, pb: 2 }}>
        <ListItem disablePadding>
          <Tooltip title={drawerMinimized ? 'Configuración' : ''} placement="right">
            <ListItemButton
              onClick={() => handleNavigation('/dashboard/settings')}
              sx={{
                borderRadius: 2,
                mx: drawerMinimized ? 0.5 : 1,
                justifyContent: drawerMinimized ? 'center' : 'flex-start',
                minHeight: 48,
                px: drawerMinimized ? 1 : 2,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                }
              }}
            >
              <ListItemIcon sx={{
                color: 'white',
                minWidth: drawerMinimized ? 'auto' : 40,
                justifyContent: 'center'
              }}>
                <SettingsIcon />
              </ListItemIcon>
              {!drawerMinimized && <ListItemText primary="Configuración" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
        <ListItem disablePadding>
          <Tooltip title={drawerMinimized ? 'Cerrar Sesión' : ''} placement="right">
            <ListItemButton
              onClick={onLogout}
              sx={{
                borderRadius: 2,
                mx: drawerMinimized ? 0.5 : 1,
                justifyContent: drawerMinimized ? 'center' : 'flex-start',
                minHeight: 48,
                px: drawerMinimized ? 1 : 2,
                '&:hover': {
                  bgcolor: 'rgba(255,0,0,0.2)',
                }
              }}
            >
              <ListItemIcon sx={{
                color: 'white',
                minWidth: drawerMinimized ? 'auto' : 40,
                justifyContent: 'center'
              }}>
                <LogoutIcon />
              </ListItemIcon>
              {!drawerMinimized && <ListItemText primary="Cerrar Sesión" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Drawer>

    {/* Contenido principal */}
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(20px) saturate(180%)',
          backgroundColor: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(32, 44, 51, 0.8)'
            : 'rgba(255, 255, 255, 0.8)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <Toolbar sx={{ gap: 2, justifyContent: 'flex-end' }}>
          {/* Indicadores de estado - Compactos y organizados */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Estado de WhatsApp */}
            <Tooltip title={`WhatsApp ${whatsappStatus === 'connected' ? 'Conectado' : whatsappStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}`}>
              <Chip
                icon={
                  whatsappStatus === 'connected' ? <WhatsApp sx={{ fontSize: 16 }} /> :
                    whatsappStatus === 'connecting' ? <CircularProgress size={16} /> :
                      <ErrorIcon sx={{ fontSize: 16 }} />
                }
                label={whatsappStatus === 'connected' ? 'Conectado' : whatsappStatus === 'connecting' ? 'Conectando' : 'Offline'}
                size="small"
                color={
                  whatsappStatus === 'connected' ? 'success' :
                    whatsappStatus === 'connecting' ? 'warning' :
                      'error'
                }
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28
                }}
              />
            </Tooltip>

            {/* 🔄 Indicador de Sincronización - Siempre visible */}
            <Tooltip title={
              syncProgress.status === 'syncing' 
                ? `${syncProgress.message} (${syncProgress.progress}%)` 
                : syncProgress.status === 'completed'
                ? 'Sincronización completada'
                : 'Sistema listo'
            }>
              <Chip
                icon={
                  syncProgress.status === 'syncing' ? (
                    <Sync sx={{ 
                      fontSize: 16, 
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }} />
                  ) : syncProgress.status === 'completed' ? (
                    <CheckCircle sx={{ fontSize: 16 }} />
                  ) : (
                    <Sync sx={{ fontSize: 16 }} />
                  )
                }
                label={
                  syncProgress.status === 'syncing' 
                    ? `Sincronizando ${syncProgress.progress}%`
                    : syncProgress.status === 'completed'
                    ? 'Sincronizado'
                    : 'Sincronizar'
                }
                size="small"
                color={
                  syncProgress.status === 'syncing' 
                    ? 'info' 
                    : syncProgress.status === 'completed'
                    ? 'success'
                    : 'default'
                }
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28,
                  cursor: 'pointer',
                  '&:hover': {
                    opacity: 0.8
                  }
                }}
                onClick={() => {
                  // Forzar sincronización manual
                  console.log('[SYNC] Sincronización manual solicitada');
                }}
              />
            </Tooltip>

            {/* Contactos */}
            <Tooltip title={`Total de contactos: ${dashboardStats.contacts || 0}`}>
              <Chip
                icon={<ContactsIcon sx={{ fontSize: 16 }} />}
                label={`${dashboardStats.contacts || 0} Contactos`}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28,
                  borderColor: '#00bcd4',
                  color: '#00bcd4'
                }}
              />
            </Tooltip>

            {/* Mensajes hoy */}
            <Tooltip title={`Mensajes hoy: ${dashboardStats.messagesToday || 0} | Total: ${dashboardStats.messages || 0}`}>
              <Chip
                icon={<MessageIcon sx={{ fontSize: 16 }} />}
                label={`${dashboardStats.messagesToday || 0} Mensajes`}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28,
                  borderColor: '#4caf50',
                  color: '#4caf50'
                }}
              />
            </Tooltip>

            {/* Agentes en línea */}
            <Tooltip title={`Agentes activos: ${dashboardStats.agents || 0}`}>
              <Chip
                icon={<AgentsIcon sx={{ fontSize: 16 }} />}
                label={`${dashboardStats.agents || 0} Agentes`}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28,
                  borderColor: '#2196f3',
                  color: '#2196f3'
                }}
              />
            </Tooltip>

            {/* Bots activos */}
            <Tooltip title={`Chatbots activos: ${dashboardStats.chatbots || 0}`}>
              <Chip
                icon={<BotIcon sx={{ fontSize: 16 }} />}
                label={`${dashboardStats.chatbots || 0} Bots`}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28,
                  borderColor: '#9c27b0',
                  color: '#9c27b0'
                }}
              />
            </Tooltip>

            {/* Campañas activas */}
            <Tooltip title={`Campañas activas: ${dashboardStats.campaigns || 0}`}>
              <Chip
                icon={<CampaignIcon sx={{ fontSize: 16 }} />}
                label={`${dashboardStats.campaigns || 0} Campañas`}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28,
                  borderColor: '#ff9800',
                  color: '#ff9800'
                }}
              />
            </Tooltip>

            {/* Kanbans activos */}
            <Tooltip title={`Tableros Kanban: ${dashboardStats.kanbans || 0}`}>
              <Chip
                icon={<KanbanIcon sx={{ fontSize: 16 }} />}
                label={`${dashboardStats.kanbans || 0} Kanbans`}
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: 28,
                  borderColor: '#673ab7',
                  color: '#673ab7'
                }}
              />
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* Toggle de Tema */}
            <Tooltip title={isDarkMode ? "Modo claro" : "Modo oscuro"}>
              <IconButton onClick={toggleTheme} size="small" color="inherit">
                {isDarkMode ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Notificaciones */}
            <IconButton onClick={handleMenuOpen} size="small">
              <Badge badgeContent={notifications} color="error">
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>

            {/* Perfil de usuario */}
            <Tooltip title={userPhoneNumber || 'Perfil'}>
              <Avatar
                src={userProfilePic || undefined}
                sx={{
                  bgcolor: '#25d366',
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: 'divider',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    borderColor: '#25d366'
                  }
                }}
              >
                {!userProfilePic && <BusinessIcon sx={{ fontSize: 20 }} />}
              </Avatar>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Menu de notificaciones */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleMenuClose}>
          <MessageIcon sx={{ mr: 2 }} />
          Nuevo mensaje de Cliente #1
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <CampaignIcon sx={{ mr: 2 }} />
          Campaña "Promo Abril" completada
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <TrendingIcon sx={{ mr: 2 }} />
          Reporte semanal disponible
        </MenuItem>
      </Menu>

      {/* Área de contenido */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#fafafa' }}>
        <Fade in={true} timeout={800}>
          <Box>
            {/* Verificar si la sesión es válida */}
            {sessionValid === false ? (
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
                  <Route path="/" element={<DashboardOverview sessionId={sessionId} />} />
                  <Route path="/chat/*" element={
                    <ProtectedRoute module="chat" action="view">
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        {isAgent ? (
                          <Box sx={{ p: 3 }}>
                            <AgentChatView
                              userId={userId || ''}
                              sessionId={sessionId}
                              onChatSelect={(chatJid) => {
                                navigate(`/dashboard/chat/${chatJid}`);
                              }}
                            />
                          </Box>
                        ) : (
                          <WhatsAppWebChat sessionId={sessionId} />
                        )}
                      </Suspense>
                    </ProtectedRoute>
                  } />
                  <Route path="/history/*" element={
                    <ProtectedRoute module="chat" action="view">
                      <HistoryModule sessionId={sessionId} />
                    </ProtectedRoute>
                  } />
                  <Route path="/crm/*" element={
                    <ProtectedRoute module="contacts" action="view">
                      <ContactsManagerModule sessionId={sessionId} />
                    </ProtectedRoute>
                  } />
                  <Route path="/campaigns/*" element={
                    <ProtectedRoute module="campaign" action="view">
                      <RealCampaignsModule sessionId={sessionId} />
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
                      <AgentsStatusModule sessionId={sessionId} />
                    </ProtectedRoute>
                  } />
                  <Route path="/kanban/*" element={
                    <ProtectedRoute module="kanban" action="view">
                      <KanbanContactsModule sessionId={sessionId} />
                    </ProtectedRoute>
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
    </Box>

    {/* Alert moderno para notificaciones importantes */}
    <ModernAlert
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
  </Box>
);
};

export default WhatsFlowDashboard;