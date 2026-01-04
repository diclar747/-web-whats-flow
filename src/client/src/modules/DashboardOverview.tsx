import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
  Stack,
  Alert
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  WhatsApp,
  Message,
  People,
  Campaign,
  TrendingUp,
  TrendingDown,
  Schedule,
  CheckCircle,
  Warning,
  Info,
  Phone,
  VideoCall,
  Analytics,
  Refresh,
  Speed,
  Timer,
  Star,
  Notifications,
  Send,
  Reply,
  Group,
  PersonAdd,
  ThumbUp,
  Block,
  SignalCellularAlt,
  BatteryFull,
  SignalWifi4Bar,
  CloudDone,
  Error as ErrorIcon,
  SmartToy,
  PlayArrow,
  Pause,
  Stop,
  AccessTime,
  DoneAll,
  CalendarToday,
  Contacts as ContactsIcon,
  ViewKanban
} from '@mui/icons-material';

interface DashboardOverviewProps {
  sessionId: string;
}

interface MetricCard {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  gradient?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  subtitle?: string;
}

interface RecentActivity {
  id: string;
  type: 'message' | 'campaign' | 'agent' | 'system' | 'contact';
  title: string;
  description: string;
  timestamp: string;
  avatar?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'success' | 'warning' | 'error' | 'info';
}

interface QuickStat {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ReactElement;
}

interface TopAgent {
  id: string;
  name: string;
  avatar: string;
  messages: number;
  responseTime: string;
  satisfaction: number;
  status: 'online' | 'away' | 'busy' | 'offline';
}

interface ChatbotAnalytics {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'paused';
  totalInteractions: number;
  successfulResponses: number;
  failedResponses: number;
  avgResponseTime: string;
  deliveryRate: number;
  responseRate: number;
  lastActivity: string;
  keywords: string[];
  color: string;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ sessionId }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);
  const [chatbotAnalytics, setChatbotAnalytics] = useState<ChatbotAnalytics[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { on, off, socket } = useSocket();

  useEffect(() => {
    loadDashboardData();
    loadSystemMetrics();

    // Auto-refresh system metrics every 30 seconds
    const metricsInterval = setInterval(loadSystemMetrics, 30000);

    return () => clearInterval(metricsInterval);
  }, [sessionId]);

  // Sincronización de estados de agentes en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleAgentStatusChange = (data: any) => {
      console.log('📊 [Dashboard] Actualizando estado de agente:', data);
      setTopAgents(prev => {
        return prev.map(agent => {
          if (String(agent.id) === String(data.agentId)) {
            // Mapear agent_status (online/offline/busy/paused) a formato del dashboard (online/away/busy)
            let dashboardStatus: 'online' | 'away' | 'busy' | 'offline' = 'offline';
            if (data.agent_status === 'online') {
              dashboardStatus = 'online';
            } else if (data.agent_status === 'busy') {
              dashboardStatus = 'busy';
            } else if (data.agent_status === 'paused') {
              dashboardStatus = 'away';
            } else if (data.agent_status === 'offline') {
              dashboardStatus = 'offline';
            }

            return { ...agent, status: dashboardStatus as any };
          }
          return agent;
        });
      });
    };

    on('agent-status-changed', handleAgentStatusChange);

    return () => {
      off('agent-status-changed');
    };
  }, [socket, on, off]);

  const loadSystemMetrics = async () => {
    try {
      const response = await fetch('/api/system/metrics');
      const data = await response.json();
      if (data.success) {
        setSystemMetrics(data);
        console.log('📊 Métricas del sistema actualizadas:', data);
      }
    } catch (error) {
      console.error('❌ Error cargando métricas del sistema:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 🆕 VERIFICAR si sessionId es válido (o recuperar de localStorage)
      let activeSessionId = sessionId;
      if (!activeSessionId || activeSessionId.trim() === '') {
        activeSessionId = localStorage.getItem('whinsap_session') || '';
        if (activeSessionId) {
          console.log('✅ [Dashboard] Recuperado sessionId de localStorage:', activeSessionId);
        }
      }

      if (!activeSessionId || activeSessionId.trim() === '') {
        console.log('ℹ️ SessionId vacío - Mostrando datos por defecto (sin WhatsApp conectado)');
        setMetrics([]);
        setLoading(false);
        return;
      }

      // Cargar estadísticas reales desde la API
      console.log('🔄 Cargando estadísticas del dashboard desde:', `/api/dashboard/stats/${activeSessionId}`);
      const response = await fetch(`/api/dashboard/stats/${activeSessionId}`);
      const data = await response.json();
      console.log('📊 Respuesta del servidor:', data);

      if (data.success) {
        // ✅ CORRECCIÓN: Usar data.messages y data.stats directamente
        const messages = data.messages || {};
        const stats = data.stats || {};

        const realMetrics: MetricCard[] = [
          {
            title: 'Mensajes Totales',
            value: (messages.total || 0).toLocaleString(),
            subtitle: `${messages.sent || 0} enviados, ${messages.received || 0} recibidos`,
            icon: <Message />,
            color: '#00a884',
            gradient: 'linear-gradient(135deg, #00a884 0%, #25d366 100%)',
            trend: { value: 0, isPositive: true, period: 'total' }
          },
          {
            title: 'Mensajes Hoy',
            value: (messages.today || 0).toLocaleString(),
            subtitle: `Esta semana: ${messages.thisWeek || 0}`,
            icon: <WhatsApp />,
            color: '#25d366',
            gradient: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
            trend: { value: 0, isPositive: true, period: 'hoy' }
          },
          {
            title: 'Pendientes',
            value: (messages.pending || 0).toLocaleString(),
            subtitle: 'Mensajes en cola',
            icon: <Timer />,
            color: '#ff9800',
            gradient: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            trend: { value: 0, isPositive: false, period: 'pendientes' }
          },
          {
            title: 'Entregados',
            value: (messages.delivered || 0).toLocaleString(),
            subtitle: 'Mensajes enviados',
            icon: <Send />,
            color: '#2196f3',
            gradient: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
            trend: { value: 0, isPositive: true, period: 'entregados' }
          },
          {
            title: 'Leídos',
            value: (messages.read || 0).toLocaleString(),
            subtitle: messages.sent ? `${((messages.read || 0) / (messages.sent || 1) * 100).toFixed(1)}% tasa de lectura` : 'Mensajes leídos',
            icon: <CheckCircle />,
            color: '#4caf50',
            gradient: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
            trend: { value: 0, isPositive: true, period: 'vistos' }
          },
          {
            title: 'Fallidos',
            value: (messages.failed || 0).toLocaleString(),
            subtitle: 'Requieren atención',
            icon: <ErrorIcon />,
            color: '#f44336',
            gradient: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            trend: { value: 0, isPositive: false, period: 'errores' }
          },
          // ✨ NUEVAS TARJETAS
          {
            title: 'Bots Activos',
            value: (stats.chatbots || 0).toLocaleString(),
            subtitle: 'Automatización activa',
            icon: <SmartToy />,
            color: '#9c27b0',
            gradient: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
            trend: { value: 0, isPositive: true, period: 'activos' }
          },
          {
            title: 'Campañas',
            value: (stats.campaigns || 0).toLocaleString(),
            subtitle: 'Activas y programadas',
            icon: <Campaign />,
            color: '#e91e63',
            gradient: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)',
            trend: { value: 0, isPositive: true, period: 'activas' }
          },
          {
            title: 'Agenda',
            value: (stats.appointments || 0).toLocaleString(),
            subtitle: 'Citas programadas',
            icon: <CalendarToday />,
            color: '#3f51b5',
            gradient: 'linear-gradient(135deg, #3f51b5 0%, #303f9f 100%)',
            trend: { value: 0, isPositive: true, period: 'citas' }
          },
          {
            title: 'Contactos',
            value: (stats.contacts || 0).toLocaleString(),
            subtitle: 'Base de datos',
            icon: <ContactsIcon />,
            color: '#ff5722',
            gradient: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)',
            trend: { value: 0, isPositive: true, period: 'total' }
          },
          {
            title: 'Agentes',
            value: (stats.agents || 0).toLocaleString(),
            subtitle: 'Operadores activos',
            icon: <People />,
            color: '#009688',
            gradient: 'linear-gradient(135deg, #009688 0%, #00796b 100%)',
            trend: { value: 0, isPositive: true, period: 'activos' }
          },
          {
            title: 'Tableros Kanban',
            value: (stats.kanbans || 0).toLocaleString(),
            subtitle: 'Organización visual',
            icon: <ViewKanban />,
            color: '#607d8b',
            gradient: 'linear-gradient(135deg, #607d8b 0%, #455a64 100%)',
            trend: { value: 0, isPositive: true, period: 'activos' }
          }
        ];

        const realQuickStats: QuickStat[] = [
          { label: 'Enviados', value: messages.sent || 0, total: messages.total || 1, color: '#00a884', icon: <Send /> },
          { label: 'Recibidos', value: messages.received || 0, total: messages.total || 1, color: '#2196f3', icon: <Reply /> },
          { label: 'Leídos', value: messages.read || 0, total: messages.sent || 1, color: '#4caf50', icon: <CheckCircle /> },
          { label: 'Pendientes', value: messages.pending || 0, total: messages.sent || 1, color: '#ff9800', icon: <Timer /> }
        ];

        setMetrics(realMetrics);
        setQuickStats(realQuickStats);
      } else {
        // Fallback a datos mock si falla la API
        const fallbackMetrics: MetricCard[] = [
          { title: 'Mensajes Totales', value: 0, subtitle: 'Sin datos', icon: <Message />, color: '#00a884', gradient: 'linear-gradient(135deg, #00a884 0%, #25d366 100%)' },
          { title: 'Mensajes Hoy', value: 0, subtitle: 'Sin datos', icon: <WhatsApp />, color: '#25d366', gradient: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)' },
          { title: 'Pendientes', value: 0, subtitle: 'Sin datos', icon: <Timer />, color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' },
          { title: 'Entregados', value: 0, subtitle: 'Sin datos', icon: <Send />, color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)' },
          { title: 'Leídos', value: 0, subtitle: 'Sin datos', icon: <CheckCircle />, color: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' },
          { title: 'Fallidos', value: 0, subtitle: 'Sin datos', icon: <ErrorIcon />, color: '#f44336', gradient: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)' },
          { title: 'Bots Activos', value: 0, subtitle: 'Sin datos', icon: <SmartToy />, color: '#9c27b0', gradient: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)' },
          { title: 'Campañas', value: 0, subtitle: 'Sin datos', icon: <Campaign />, color: '#e91e63', gradient: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)' },
          { title: 'Agenda', value: 0, subtitle: 'Sin datos', icon: <CalendarToday />, color: '#3f51b5', gradient: 'linear-gradient(135deg, #3f51b5 0%, #303f9f 100%)' },
          { title: 'Contactos', value: 0, subtitle: 'Sin datos', icon: <ContactsIcon />, color: '#ff5722', gradient: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)' },
          { title: 'Agentes', value: 0, subtitle: 'Sin datos', icon: <People />, color: '#009688', gradient: 'linear-gradient(135deg, #009688 0%, #00796b 100%)' },
          { title: 'Tableros Kanban', value: 0, subtitle: 'Sin datos', icon: <ViewKanban />, color: '#607d8b', gradient: 'linear-gradient(135deg, #607d8b 0%, #455a64 100%)' }
        ];

        const fallbackQuickStats: QuickStat[] = [
          { label: 'Enviados', value: 0, total: 0, color: '#00a884', icon: <Send /> },
          { label: 'Recibidos', value: 0, total: 0, color: '#2196f3', icon: <Reply /> },
          { label: 'Grupos', value: 0, total: 0, color: '#9c27b0', icon: <Group /> },
          { label: 'Contactos', value: 0, total: 0, color: '#ff9800', icon: <PersonAdd /> }
        ];

        setMetrics(fallbackMetrics);
        setQuickStats(fallbackQuickStats);
      }

      const mockTopAgents: TopAgent[] = [
        {
          id: '1',
          name: 'María González',
          avatar: 'MG',
          messages: 147,
          responseTime: '45s',
          satisfaction: 4.9,
          status: 'online'
        },
        {
          id: '2',
          name: 'Carlos Rivera',
          avatar: 'CR',
          messages: 132,
          responseTime: '1.2m',
          satisfaction: 4.7,
          status: 'online'
        },
        {
          id: '3',
          name: 'Ana Martínez',
          avatar: 'AM',
          messages: 118,
          responseTime: '2.1m',
          satisfaction: 4.8,
          status: 'busy'
        },
        {
          id: '4',
          name: 'Luis Hernández',
          avatar: 'LH',
          messages: 95,
          responseTime: '1.8m',
          satisfaction: 4.6,
          status: 'away'
        }
      ];

      const mockActivities: RecentActivity[] = [
        {
          id: '1',
          type: 'message',
          title: 'Mensaje urgente de Premium Client',
          description: 'Requiere atención inmediata - Problema técnico',
          timestamp: '2 min',
          avatar: 'PC',
          priority: 'high',
          status: 'error'
        },
        {
          id: '2',
          type: 'campaign',
          title: 'Campaña "Black Friday" - 98% completada',
          description: '4,850 de 4,950 mensajes enviados exitosamente',
          timestamp: '8 min',
          priority: 'medium',
          status: 'success'
        },
        {
          id: '3',
          type: 'agent',
          title: 'Agente María G. superó meta diaria',
          description: '150 conversaciones atendidas (meta: 120)',
          timestamp: '15 min',
          avatar: 'MG',
          priority: 'low',
          status: 'success'
        },
        {
          id: '4',
          type: 'system',
          title: 'Línea secundaria reconectada',
          description: 'WhatsApp Business API - Conexión estable',
          timestamp: '32 min',
          priority: 'medium',
          status: 'info'
        },
        {
          id: '5',
          type: 'contact',
          title: '47 nuevos contactos agregados',
          description: 'Importación desde CSV completada',
          timestamp: '1 hora',
          priority: 'low',
          status: 'success'
        }
      ];

      // Cargar analíticas reales de chatbots
      try {
        // 🆕 VERIFICAR sessionId antes de hacer petición
        if (!activeSessionId || activeSessionId.trim() === '') {
          console.log('ℹ️ SessionId vacío - Saltando carga de analíticas de chatbots');
          setChatbotAnalytics([]);
        } else {
          const chatbotResponse = await fetch(`/api/chatbot/analytics/${activeSessionId}`);
          const chatbotData = await chatbotResponse.json();

          if (chatbotData.success && chatbotData.analytics) {
            console.log('📊 Chatbots cargados:', chatbotData.analytics.length);
            setChatbotAnalytics(chatbotData.analytics);
          } else {
            console.log('⚠️ No hay chatbots configurados');
            setChatbotAnalytics([]);
          }
        }
      } catch (error) {
        console.error('❌ Error cargando chatbots:', error);
        setChatbotAnalytics([]);
      }

      // Cargar usuarios reales (agentes/operadores) desde la base de datos
      try {
        // 🆕 VERIFICAR sessionId antes de hacer petición
        if (!activeSessionId || activeSessionId.trim() === '') {
          console.log('ℹ️ SessionId vacío - Saltando carga de usuarios');
          setTopAgents([]);
        } else {
          const usersResponse = await fetch(`/api/users?sessionId=${activeSessionId}`);
          const usersData = await usersResponse.json();

          if (usersData.success && usersData.users && usersData.users.length > 0) {
            console.log('👥 Usuarios reales cargados:', usersData.users.length);

            // Convertir usuarios de BD al formato del dashboard
            const realAgents: TopAgent[] = usersData.users.slice(0, 4).map((user: any) => {
              // Calcular iniciales del nombre
              const nameParts = user.name?.split(' ') || ['Usuario'];
              const initials = nameParts.length >= 2
                ? `${nameParts[0][0]}${nameParts[1][0]}`
                : nameParts[0].substring(0, 2);

              // 🔧 FIX: Usar el agent_status REAL de la base de datos
              // No calcular basado en last_login, usar el estado actual del agente
              const agentStatus = user.agent_status || 'offline';

              // Mapear agent_status (online/offline/busy/paused) a formato del dashboard (online/away/busy)
              let dashboardStatus: 'online' | 'away' | 'busy' = 'away';
              if (agentStatus === 'online') {
                dashboardStatus = 'online';
              } else if (agentStatus === 'busy') {
                dashboardStatus = 'busy';
              } else if (agentStatus === 'paused' || agentStatus === 'offline') {
                dashboardStatus = 'away';
              }

              console.log(`[DASHBOARD] Agente ${user.name}: agent_status=${agentStatus}, dashboardStatus=${dashboardStatus}`);

              return {
                id: user.id.toString(),
                name: user.name || `Usuario ${user.phone}`,
                avatar: user.avatar_url || initials.toUpperCase(),
                messages: 0, // Se puede calcular desde mensajes enviados
                responseTime: '< 1m',
                satisfaction: 4.5,
                status: dashboardStatus
              };
            });

            setTopAgents(realAgents);
          } else {
            console.log('⚠️ No hay usuarios registrados');
            setTopAgents([]); // Mostrar vacío en lugar de datos falsos
          }
        }
      } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        setTopAgents([]);
      }

      setActivities(mockActivities);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);

      // Mostrar tarjetas con valores en 0 si hay error
      const errorMetrics: MetricCard[] = [
        { title: 'Mensajes Totales', value: '0', subtitle: 'Error cargando datos', icon: <Message />, color: '#00a884', gradient: 'linear-gradient(135deg, #00a884 0%, #25d366 100%)' },
        { title: 'Mensajes Hoy', value: '0', subtitle: 'Error cargando datos', icon: <WhatsApp />, color: '#25d366', gradient: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)' },
        { title: 'Pendientes', value: '0', subtitle: 'Error cargando datos', icon: <Timer />, color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' },
        { title: 'Entregados', value: '0', subtitle: 'Error cargando datos', icon: <Send />, color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)' },
        { title: 'Leídos', value: '0', subtitle: 'Error cargando datos', icon: <CheckCircle />, color: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' },
        { title: 'Fallidos', value: '0', subtitle: 'Error cargando datos', icon: <ErrorIcon />, color: '#f44336', gradient: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)' },
        { title: 'Bots Activos', value: '0', subtitle: 'Error cargando datos', icon: <SmartToy />, color: '#9c27b0', gradient: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)' },
        { title: 'Campañas', value: '0', subtitle: 'Error cargando datos', icon: <Campaign />, color: '#e91e63', gradient: 'linear-gradient(135deg, #e91e63 0%, #c2185b 100%)' },
        { title: 'Agenda', value: '0', subtitle: 'Error cargando datos', icon: <CalendarToday />, color: '#3f51b5', gradient: 'linear-gradient(135deg, #3f51b5 0%, #303f9f 100%)' },
        { title: 'Contactos', value: '0', subtitle: 'Error cargando datos', icon: <ContactsIcon />, color: '#ff5722', gradient: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)' },
        { title: 'Agentes', value: '0', subtitle: 'Error cargando datos', icon: <People />, color: '#009688', gradient: 'linear-gradient(135deg, #009688 0%, #00796b 100%)' },
        { title: 'Tableros Kanban', value: '0', subtitle: 'Error cargando datos', icon: <ViewKanban />, color: '#607d8b', gradient: 'linear-gradient(135deg, #607d8b 0%, #455a64 100%)' }
      ];
      setMetrics(errorMetrics);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string, status?: string) => {
    const iconProps = { sx: { fontSize: 20 } };
    switch (type) {
      case 'message':
        return status === 'error' ? <ErrorIcon {...iconProps} sx={{ color: '#f44336' }} /> :
          <Message {...iconProps} sx={{ color: '#00a884' }} />;
      case 'campaign': return <Campaign {...iconProps} sx={{ color: '#e91e63' }} />;
      case 'agent': return <People {...iconProps} sx={{ color: '#2196f3' }} />;
      case 'system': return <CloudDone {...iconProps} sx={{ color: '#4caf50' }} />;
      case 'contact': return <PersonAdd {...iconProps} sx={{ color: '#ff9800' }} />;
      default: return <Info {...iconProps} sx={{ color: '#9e9e9e' }} />;
    }
  };

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'away': return '#ff9800';
      case 'busy': return '#f44336';
      case 'offline': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  const getAgentStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'En línea';
      case 'away': return 'Ausente';
      case 'busy': return 'Ocupado';
      case 'offline': return 'Desconectado';
      default: return 'Desconocido';
    }
  };

  const getChatbotStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'paused': return '#ff9800';
      case 'inactive': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getChatbotStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'paused': return 'Pausado';
      case 'inactive': return 'Inactivo';
      default: return 'Desconocido';
    }
  };

  if (loading) {
    return (
      <Box sx={{
        p: 3,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '60vh'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ color: '#00a884', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#64748b' }}>
            Cargando dashboard empresarial...
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Obteniendo métricas en tiempo real
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Mejorado */}
      <Box sx={{
        mb: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: 3,
        p: 3,
        color: 'white'
      }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Dashboard Whinsap Enterprise
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>
            Centro de comando y control • Sesión: {sessionId?.slice(-8)}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
            Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            startIcon={<Refresh />}
            variant="contained"
            onClick={loadDashboardData}
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
              borderRadius: 2
            }}
          >
            Actualizar
          </Button>
        </Stack>
      </Box>

      {/* Tarjetas de métricas mejoradas */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
            <Card
              elevation={4}
              sx={{
                height: '100%',
                borderRadius: 4,
                background: metric.gradient || metric.color,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px) scale(1.02)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '100px',
                  height: '100px',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '50%',
                  transform: 'translate(50%, -50%)'
                }
              }}
            >
              <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                  <Avatar sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    mr: 2,
                    width: 56,
                    height: 56,
                    color: 'white'
                  }}>
                    {metric.icon}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, mb: 0.5, lineHeight: 1 }}>
                      {metric.value}
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                      {metric.title}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {metric.subtitle}
                    </Typography>
                  </Box>
                </Box>

                {metric.trend && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                    {metric.trend.isPositive ? (
                      <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                    ) : (
                      <TrendingDown sx={{ fontSize: 16, mr: 0.5 }} />
                    )}
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, opacity: 0.9 }}
                    >
                      {metric.trend.value}% {metric.trend.period}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Estadísticas rápidas */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 4, p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Resumen de Actividad Diaria
            </Typography>
            <Grid container spacing={3}>
              {quickStats.map((stat, index) => (
                <Grid item xs={6} md={3} key={index}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Avatar sx={{
                      bgcolor: stat.color,
                      width: 64,
                      height: 64,
                      mx: 'auto',
                      mb: 2
                    }}>
                      {stat.icon}
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color }}>
                      {stat.value.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {stat.label}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(stat.value / stat.total) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: theme => alpha(stat.color as any, 0.15),
                        '& .MuiLinearProgress-bar': { bgcolor: stat.color }
                      }}
                    />
                    <Typography variant="caption" sx={{ mt: 0.5 }}>
                      {Math.round((stat.value / stat.total) * 100)}% de {stat.total.toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Chatbots Activos y Analíticas */}
        <Grid item xs={12} lg={8}>
          <Card elevation={3} sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{
                p: 3,
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'white' }}>
                      🤖 Chatbots Activos
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      Análisis de entrega y respuesta en tiempo real
                    </Typography>
                  </Box>
                  <Badge
                    badgeContent={
                      chatbotAnalytics.filter(c => c.status === 'active').length > 0
                        ? chatbotAnalytics.filter(c => c.status === 'active').length
                        : null
                    }
                    color="success"
                  >
                    <SmartToy sx={{ color: 'white', fontSize: 32 }} />
                  </Badge>
                </Box>
              </Box>

              <Box sx={{ p: 3, maxHeight: '600px', overflow: 'auto' }}>
                {chatbotAnalytics.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <SmartToy sx={{ fontSize: 80, color: '#cbd5e1', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                      No hay chatbots configurados
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
                      Crea flujos de chatbot para automatizar respuestas
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<SmartToy />}
                      onClick={() => navigate('/dashboard/chatbot')}
                      sx={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: 'white'
                      }}
                    >
                      Crear Primer Chatbot
                    </Button>
                  </Box>
                ) : (
                  <Stack spacing={3}>
                    {chatbotAnalytics.map((chatbot) => (
                      <Card
                        key={chatbot.id}
                        elevation={2}
                        sx={{
                          borderRadius: 3,
                          border: `2px solid ${chatbot.color}20`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: `0 8px 24px ${chatbot.color}30`
                          }
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          {/* Header del Chatbot */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Avatar sx={{
                              bgcolor: chatbot.color,
                              width: 56,
                              height: 56,
                              mr: 2
                            }}>
                              <SmartToy sx={{ fontSize: 32 }} />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {chatbot.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={getChatbotStatusLabel(chatbot.status)}
                                  size="small"
                                  icon={
                                    chatbot.status === 'active' ? <PlayArrow /> :
                                      chatbot.status === 'paused' ? <Pause /> : <Stop />
                                  }
                                  sx={{
                                    bgcolor: `${getChatbotStatusColor(chatbot.status)}20`,
                                    color: getChatbotStatusColor(chatbot.status),
                                    fontWeight: 600
                                  }}
                                />
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Última actividad: {chatbot.lastActivity}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="h4" sx={{ fontWeight: 700, color: chatbot.color }}>
                                {chatbot.totalInteractions}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Interacciones
                              </Typography>
                            </Box>
                          </Box>

                          {/* Métricas de Rendimiento */}
                          <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={6} md={3}>
                              <Paper
                                sx={theme => ({
                                  p: 2,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  bgcolor: alpha(theme.palette.info.main, 0.12),
                                  border: '1px solid',
                                  borderColor: alpha(theme.palette.info.main, 0.24)
                                })}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                  <DoneAll sx={{ color: '#2196f3', mr: 0.5, fontSize: 20 }} />
                                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2196f3' }}>
                                    {chatbot.deliveryRate}%
                                  </Typography>
                                </Box>
                                <Typography variant="caption">
                                  Tasa de Entrega
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} md={3}>
                              <Paper
                                sx={theme => ({
                                  p: 2,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  bgcolor: alpha(theme.palette.success.main, 0.12),
                                  border: '1px solid',
                                  borderColor: alpha(theme.palette.success.main, 0.24)
                                })}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                  <Reply sx={{ color: '#4caf50', mr: 0.5, fontSize: 20 }} />
                                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#4caf50' }}>
                                    {chatbot.responseRate}%
                                  </Typography>
                                </Box>
                                <Typography variant="caption">
                                  Tasa de Respuesta
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} md={3}>
                              <Paper
                                sx={theme => ({
                                  p: 2,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  bgcolor: alpha(theme.palette.warning.main, 0.12),
                                  border: '1px solid',
                                  borderColor: alpha(theme.palette.warning.main, 0.24)
                                })}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                  <AccessTime sx={{ color: '#ff9800', mr: 0.5, fontSize: 20 }} />
                                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                                    {chatbot.avgResponseTime}
                                  </Typography>
                                </Box>
                                <Typography variant="caption">
                                  Tiempo Promedio
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6} md={3}>
                              <Paper
                                sx={theme => ({
                                  p: 2,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  bgcolor: alpha(theme.palette.error.main, 0.12),
                                  border: '1px solid',
                                  borderColor: alpha(theme.palette.error.main, 0.24)
                                })}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                  <ErrorIcon sx={{ color: '#f44336', mr: 0.5, fontSize: 20 }} />
                                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f44336' }}>
                                    {chatbot.failedResponses}
                                  </Typography>
                                </Box>
                                <Typography variant="caption">
                                  Fallos
                                </Typography>
                              </Paper>
                            </Grid>
                          </Grid>

                          {/* Palabras Clave */}
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block', fontWeight: 600 }}>
                              Palabras clave activadoras:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {chatbot.keywords.map((keyword, idx) => (
                                <Chip
                                  key={idx}
                                  label={keyword}
                                  size="small"
                                  sx={{
                                    bgcolor: `${chatbot.color}15`,
                                    color: chatbot.color,
                                    fontWeight: 500,
                                    fontSize: '0.75rem'
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>

                          {/* Barra de Progreso de Éxito */}
                          <Box sx={{ mt: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                Respuestas exitosas
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {chatbot.successfulResponses} / {chatbot.totalInteractions}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(chatbot.successfulResponses / chatbot.totalInteractions) * 100}
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: theme => alpha(chatbot.color as any, 0.18),
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: chatbot.color,
                                  borderRadius: 4
                                }
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel derecho mejorado */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {/* Top Agents */}
            <Card elevation={3} sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  🏆 Top Agentes Hoy
                </Typography>

                {topAgents.map((agent, index) => (
                  <Box key={agent.id} sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: theme => index === 0 ? alpha(theme.palette.info.main, 0.08) : 'transparent',
                    border: index === 0 ? theme => `1px solid ${alpha(theme.palette.info.main, 0.25)}` : 'none'
                  }}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Box sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: getAgentStatusColor(agent.status),
                          border: theme => `2px solid ${theme.palette.background.paper}`
                        }} />
                      }
                    >
                      <Avatar
                        src={typeof agent.avatar === 'string' && agent.avatar.startsWith('http') ? agent.avatar : undefined}
                        sx={{ bgcolor: '#00a884', mr: 2, width: 48, height: 48 }}
                      >
                        {(!agent.avatar || !agent.avatar.startsWith('http')) && agent.avatar}
                      </Avatar>
                    </Badge>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {agent.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {agent.messages} mensajes • {agent.responseTime} promedio
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Star sx={{ fontSize: 14, color: '#ffc107', mr: 0.5 }} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {agent.satisfaction}
                        </Typography>
                        <Chip
                          label={getAgentStatusLabel(agent.status)}
                          size="small"
                          sx={{
                            ml: 1,
                            bgcolor: theme => alpha(getAgentStatusColor(agent.status) as any, 0.15),
                            color: getAgentStatusColor(agent.status),
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>
                    </Box>
                    {index === 0 && (
                      <Typography sx={{ fontSize: '1.5rem' }}>👑</Typography>
                    )}
                  </Box>
                ))}
              </CardContent>
            </Card>

            {/* Estado del Sistema Avanzado - Datos Reales */}
            <Card elevation={3} sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  🛡️ Estado del Sistema {systemMetrics && <Chip label="EN VIVO" size="small" color="success" sx={{ ml: 1 }} />}
                </Typography>

                <Stack spacing={2}>
                  {/* WhatsApp API */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                        <SignalCellularAlt sx={{ fontSize: 16, mr: 1, color: systemMetrics?.whatsappAPI?.status === 'ACTIVO' ? '#4caf50' : '#f44336' }} />
                        WhatsApp API
                      </Typography>
                      <Chip
                        label={systemMetrics?.whatsappAPI?.status || 'CARGANDO'}
                        size="small"
                        sx={theme => ({
                          bgcolor: alpha(systemMetrics?.whatsappAPI?.status === 'ACTIVO' ? theme.palette.success.main : theme.palette.error.main, 0.15),
                          color: systemMetrics?.whatsappAPI?.status === 'ACTIVO' ? theme.palette.success.light : theme.palette.error.light,
                          border: '1px solid',
                          borderColor: alpha(systemMetrics?.whatsappAPI?.status === 'ACTIVO' ? theme.palette.success.main : theme.palette.error.main, 0.3)
                        })}
                      />
                    </Box>
                    <LinearProgress
                      value={systemMetrics?.whatsappAPI?.status === 'ACTIVO' ? 100 : 0}
                      variant="determinate"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {systemMetrics ? `Latencia: ${systemMetrics.whatsappAPI.latency} • Uptime: ${systemMetrics.whatsappAPI.uptime} • Sesiones: ${systemMetrics.whatsappAPI.activeSessions}` : 'Cargando...'}
                    </Typography>
                  </Box>

                  {/* Servidores */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                        <BatteryFull sx={{ fontSize: 16, mr: 1, color: '#4caf50' }} />
                        Servidores
                      </Typography>
                      <Chip
                        label={systemMetrics?.servers?.status || 'CARGANDO'}
                        size="small"
                        sx={theme => ({
                          bgcolor: alpha(theme.palette.success.main, 0.15),
                          color: theme.palette.success.light,
                          border: '1px solid',
                          borderColor: alpha(theme.palette.success.main, 0.3)
                        })}
                      />
                    </Box>
                    <LinearProgress
                      value={systemMetrics?.servers?.cpu?.usage || 0}
                      variant="determinate"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {systemMetrics ? `CPU: ${systemMetrics.servers.cpu.usage}% (${systemMetrics.servers.cpu.cores} cores) • RAM: ${systemMetrics.servers.ram.usage}% (${systemMetrics.servers.ram.used}/${systemMetrics.servers.ram.total}) • Disco: ${systemMetrics.servers.disk.usage}%` : 'Cargando...'}
                    </Typography>
                  </Box>

                  {/* Base de Datos */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                        <CloudDone sx={{ fontSize: 16, mr: 1, color: '#2196f3' }} />
                        Base de Datos
                      </Typography>
                      <Chip
                        label={systemMetrics?.database?.status || 'CARGANDO'}
                        size="small"
                        sx={theme => ({
                          bgcolor: alpha(theme.palette.info.main, 0.15),
                          color: theme.palette.info.light,
                          border: '1px solid',
                          borderColor: alpha(theme.palette.info.main, 0.3)
                        })}
                      />
                    </Box>
                    <LinearProgress
                      value={systemMetrics?.database?.connections?.usage || 0}
                      variant="determinate"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {systemMetrics?.database?.connections ? `${systemMetrics.database.lastBackup} • Conexiones: ${systemMetrics.database.connections.active}/${systemMetrics.database.connections.max} (${systemMetrics.database.connections.usage}%)` : 'Cargando...'}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Accesos Rápidos Mejorados */}
            <Card elevation={3} sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1e293b' }}>
                  ⚡ Acciones Rápidas
                </Typography>

                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    startIcon={<Campaign />}
                    variant="contained"
                    sx={{
                      justifyContent: 'flex-start',
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #e91e63 0%, #ad1457 100%)',
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    Crear Campaña Masiva
                  </Button>
                  <Button
                    fullWidth
                    startIcon={<Analytics />}
                    variant="contained"
                    sx={{
                      justifyContent: 'flex-start',
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #ff5722 0%, #d84315 100%)',
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                  >
                    Generar Reporte
                  </Button>
                  <Button
                    fullWidth
                    startIcon={<People />}
                    variant="outlined"
                    sx={{
                      justifyContent: 'flex-start',
                      borderRadius: 3,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: '#00a884',
                      color: '#00a884',
                      '&:hover': { bgcolor: '#00a88410' }
                    }}
                  >
                    Gestionar Equipos
                  </Button>
                  <Button
                    fullWidth
                    startIcon={<PersonAdd />}
                    variant="outlined"
                    sx={{
                      justifyContent: 'flex-start',
                      borderRadius: 3,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: '#2196f3',
                      color: '#2196f3',
                      '&:hover': { bgcolor: '#2196f310' }
                    }}
                  >
                    Importar Contactos
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardOverview; 
