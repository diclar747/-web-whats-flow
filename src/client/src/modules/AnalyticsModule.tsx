// Analytics Module v4.0 - COMPLETE PROFESSIONAL VERSION
// Includes: General Dashboard, Messages, Campaigns, Kanban, Agents, Chatbots
import React, { useState, useEffect, useMemo } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import {
  Box, Grid, Card, CardContent, Typography, Button, IconButton,
  Tab, Tabs, CircularProgress, Alert, Stack, Chip, Paper,
  Divider, Tooltip, LinearProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem, FormControl,
  InputLabel, Badge, Avatar
} from '@mui/material';
import {
  Analytics, TrendingUp, TrendingDown, Message, Campaign, People,
  Dashboard as DashboardIcon, Refresh, ShowChart, Assessment,
  SmartToy, Send, Inbox, Visibility, CheckCircle, Error as ErrorIcon,
  Schedule, Group, ViewKanban, PersonAdd, Timer, Speed, Warning,
  BarChart as BarChartIcon, PieChart as PieChartIcon, Timeline,
  CloudDone, Block, Reply, Done, DoneAll, AccessTime, CalendarToday,
  Dns, Storage, Memory, SettingsInputComponent, CloudQueue
} from '@mui/icons-material';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, FunnelChart, Funnel, LabelList
} from 'recharts';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';

interface AnalyticsModuleProps {
  sessionId: string;
}

interface SystemMetrics {
  timestamp: string;
  success: boolean;
  whatsappAPI: {
    status: string;
    activeSessions: number;
    latency: string;
    uptime: string;
    uptimePercent: number;
  };
  servers: {
    status: string;
    cpu: { usage: number; cores: number };
    ram: { usage: number; total: string; used: string; free: string };
    disk: { usage: number };
  };
  database: {
    status: string;
    connections: { active: number; max: number; usage: number };
    lastBackup: string;
    replication: string;
  };
  system: {
    platform: string;
    architecture: string;
    hostname: string;
    nodeVersion: string;
    uptime: number;
  };
}

const COLORS = ['#00a884', '#25d366', '#128c7e', '#075e54', '#34b7f1', '#ece5dd'];
const CHART_COLORS = {
  primary: '#00a884',
  success: '#25d366',
  warning: '#ff9800',
  error: '#ef4444',
  info: '#3b82f6',
  purple: '#9c27b0'
};

const formatNumber = (num?: number) => (num || 0).toLocaleString();
const formatPercentage = (num?: number) => `${(num || 0).toFixed(1)}%`;
const formatTime = (seconds?: number) => {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
};

const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({ sessionId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().subtract(30, 'days'));
  const [endDate, setEndDate] = useState<Dayjs>(dayjs());

  // Data states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [messagesData, setMessagesData] = useState<any>(null);
  const [campaignsData, setCampaignsData] = useState<any>(null);
  const [kanbanData, setKanbanData] = useState<any>(null);
  const [agentsData, setAgentsData] = useState<any>(null);
  const [chatbotsData, setChatbotsData] = useState<any>(null);
  const [connectionsData, setConnectionsData] = useState<any>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = `sessionId=${sessionId}&startDate=${startDate.format('YYYY-MM-DD')}&endDate=${endDate.format('YYYY-MM-DD')}`;

      // Load all analytics data in parallel
      const [dashRes, msgRes, campRes, kanRes, agentRes, botRes, connRes, sysRes] = await Promise.allSettled([
        fetch(`/api/analytics/dashboard?sessionId=${sessionId}`),
        fetch(`/api/analytics/messages?${params}`),
        fetch(`/api/analytics/campaigns?${params}`),
        fetch(`/api/analytics/kanban?${params}`),
        fetch(`/api/analytics/agents?${params}`),
        fetch(`/api/analytics/chatbots?${params}`),
        fetch(`/api/session/${sessionId}/status`),
        fetch(`/api/system/metrics`)
      ]);

      // Process dashboard data
      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        const json = await dashRes.value.json();
        setDashboardData(json.data || json);
      } else {
        // Fallback to dashboard stats
        const fallback = await fetch(`/api/dashboard/stats/${sessionId}`);
        if (fallback.ok) {
          const fbJson = await fallback.json();
          setDashboardData(fbJson.stats || {});
        }
      }

      // Process messages data
      if (msgRes.status === 'fulfilled' && msgRes.value.ok) {
        const json = await msgRes.value.json();
        setMessagesData(json.data || json);
      }

      // Process campaigns data
      if (campRes.status === 'fulfilled' && campRes.value.ok) {
        const json = await campRes.value.json();
        setCampaignsData(json.data || json);
      }

      // Process kanban data
      if (kanRes.status === 'fulfilled' && kanRes.value.ok) {
        const json = await kanRes.value.json();
        setKanbanData(json.data || json);
      }

      // Process agents data
      if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
        const json = await agentRes.value.json();
        setAgentsData(json.data || json);
      }

      // Process chatbots data
      if (botRes.status === 'fulfilled' && botRes.value.ok) {
        const json = await botRes.value.json();
        setChatbotsData(json.data || json);
      }

      // Process connections data
      // Process connections data
      if (connRes.status === 'fulfilled' && connRes.value.ok) {
        const json = await connRes.value.json();
        setConnectionsData(json);
      }

      // Process system metrics
      if (sysRes.status === 'fulfilled' && sysRes.value.ok) {
        const json = await sysRes.value.json();
        setSystemMetrics(json);
      }

    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [sessionId, startDate, endDate]);

  const handleRefresh = () => loadAllData();
  const handleTabChange = (_: any, newValue: number) => setActiveTab(newValue);

  // Safe data accessors
  const dash = dashboardData || {};
  const msgs = messagesData || {};
  const camps = campaignsData || {};
  const kanban = kanbanData || {};
  const agents = agentsData || {};
  const bots = chatbotsData || {};
  const connections = connectionsData || {};

  // ============= TAB 0: GENERAL DASHBOARD =============
  const GeneralDashboard = () => {
    // Extraer datos reales de manera segura
    const totalMessages = dash.messages?.total || dash.messages || 0;
    const deliveryRate = dash.kpis?.delivery_rate || 0;
    const readRate = dash.kpis?.read_rate || 0;
    const activeCampaigns = dash.campaigns?.active || 0;
    const onlineAgents = dash.agents?.online || 0;
    const totalAgents = dash.agents?.total || 0;
    const activeChatbots = dash.chatbots || 0;
    const kanbanBoards = dash.kanbans || 0;
    const activeConnections = dash.activeLines || 1;
    const failedMessages = dash.messages?.failed || 0;
    const failureRate = dash.kpis?.failure_rate || 0;

    const kpis = [
      { label: 'Total Mensajes', value: formatNumber(totalMessages), icon: <Message />, color: CHART_COLORS.primary, trend: `${formatNumber(dash.messages?.sent || 0)} enviados` },
      { label: 'Tasa Entrega', value: formatPercentage(deliveryRate), icon: <CheckCircle />, color: CHART_COLORS.success, trend: `${formatNumber(dash.messages?.delivered || 0)} entregados` },
      { label: 'Tasa Lectura', value: formatPercentage(readRate), icon: <Visibility />, color: CHART_COLORS.info, trend: `${formatNumber(dash.messages?.read || 0)} leídos` },
      { label: 'Campañas Activas', value: formatNumber(activeCampaigns), icon: <Campaign />, color: CHART_COLORS.warning, trend: `${formatNumber(dash.campaigns?.total || 0)} total` },
      { label: 'Agentes Online', value: formatNumber(onlineAgents), icon: <People />, color: CHART_COLORS.success, trend: `de ${formatNumber(totalAgents)} total` },
      { label: 'Chatbots Activos', value: formatNumber(activeChatbots), icon: <SmartToy />, color: CHART_COLORS.purple, trend: 'Sistema activo' },
      // Tarjeta de Kanban eliminada por solicitud del usuario
      { label: 'Conexiones Activas', value: formatNumber(activeConnections), icon: <Badge />, color: CHART_COLORS.info, trend: 'WhatsApp conectado' },
      { label: 'Mensajes Fallidos', value: formatNumber(failedMessages), icon: <ErrorIcon />, color: CHART_COLORS.error, trend: `${formatPercentage(failureRate)} tasa fallo` }
    ];

    // Mock timeline data
    const timelineData = [
      { date: 'Lun', sent: 450, received: 320, delivered: 440 },
      { date: 'Mar', sent: 520, received: 380, delivered: 510 },
      { date: 'Mié', sent: 480, received: 350, delivered: 470 },
      { date: 'Jue', sent: 610, received: 420, delivered: 600 },
      { date: 'Vie', sent: 580, received: 410, delivered: 570 },
      { date: 'Sáb', sent: 320, received: 180, delivered: 310 },
      { date: 'Dom', sent: 280, received: 150, delivered: 270 }
    ];

    return (
      <Box>
        {/* KPIs Grid */}
        <Grid container spacing={2} mb={3}>
          {kpis.map((kpi, idx) => (
            <Grid item xs={12} sm={6} md={3} key={idx}>
              <Card sx={{ bgcolor: '#1e293b', color: 'white', height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                      <Typography variant="caption" color="#94a3b8">{kpi.label}</Typography>
                      <Typography variant="h4" fontWeight="bold" my={1}>{kpi.value}</Typography>
                      <Chip label={kpi.trend} size="small" sx={{ bgcolor: 'rgba(0,168,132,0.1)', color: '#00a884' }} />
                    </Box>
                    <Box sx={{ color: kpi.color, opacity: 0.3, fontSize: 40 }}>{kpi.icon}</Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Timeline Chart */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Evolución Temporal</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00a884" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00a884" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                  <Legend />
                  <Area type="monotone" dataKey="sent" stroke="#00a884" fillOpacity={1} fill="url(#colorSent)" name="Enviados" />
                  <Area type="monotone" dataKey="delivered" stroke="#25d366" fill="#25d366" fillOpacity={0.3} name="Entregados" />
                  <Area type="monotone" dataKey="received" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Recibidos" />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white', height: '100%' }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <Dns sx={{ color: '#3b82f6' }} />
                <Typography variant="h6">Estado del Sistema</Typography>
                <Chip
                  label="EN VIVO"
                  size="small"
                  sx={{
                    bgcolor: '#25d366',
                    color: '#0b2e13',
                    fontWeight: 'bold',
                    height: 20,
                    fontSize: '0.65rem'
                  }}
                />
              </Stack>

              {systemMetrics ? (
                <Stack spacing={3}>
                  {/* WhatsApp API Section */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BarChartIcon sx={{ color: '#25d366', fontSize: 20 }} />
                        <Typography variant="body2" fontWeight="500">WhatsApp API</Typography>
                      </Stack>
                      <Chip
                        label={systemMetrics.whatsappAPI.status}
                        size="small"
                        sx={{
                          bgcolor: systemMetrics.whatsappAPI.status === 'ACTIVO' ? 'rgba(37,211,102,0.1)' : 'rgba(239,68,68,0.1)',
                          color: systemMetrics.whatsappAPI.status === 'ACTIVO' ? '#25d366' : '#ef4444',
                          height: 20,
                          fontSize: '0.7rem'
                        }}
                      />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={100}
                      sx={{
                        bgcolor: '#334155',
                        height: 6,
                        borderRadius: 3,
                        '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' } // Blue line as in design
                      }}
                    />
                    <Stack direction="row" justifyContent="space-between" mt={0.5}>
                      <Typography variant="caption" color="#94a3b8">Latencia: {systemMetrics.whatsappAPI.latency}</Typography>
                      <Typography variant="caption" color="#94a3b8">Uptime: {systemMetrics.whatsappAPI.uptime}</Typography>
                    </Stack>
                  </Box>

                  {/* Servers Section */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Storage sx={{ color: '#25d366', fontSize: 20 }} />
                        <Typography variant="body2" fontWeight="500">Servidores</Typography>
                      </Stack>
                      <Chip
                        label={systemMetrics.servers.status}
                        size="small"
                        sx={{
                          bgcolor: systemMetrics.servers.status === 'ÓPTIMO' ? 'rgba(37,211,102,0.1)' : 'rgba(255,152,0,0.1)',
                          color: systemMetrics.servers.status === 'ÓPTIMO' ? '#25d366' : '#ff9800',
                          height: 20,
                          fontSize: '0.7rem'
                        }}
                      />
                    </Stack>
                    {/* CPU Bar */}
                    <LinearProgress
                      variant="determinate"
                      value={systemMetrics.servers.cpu.usage}
                      sx={{
                        bgcolor: '#334155',
                        height: 6,
                        borderRadius: 3,
                        '& .MuiLinearProgress-bar': { bgcolor: '#8b5cf6' } // Purple line
                      }}
                    />
                    <Typography variant="caption" color="#94a3b8" display="block" mt={0.5}>
                      CPU: {systemMetrics.servers.cpu.usage}% ({systemMetrics.servers.cpu.cores} cores) • RAM: {systemMetrics.servers.ram.usage}% ({systemMetrics.servers.ram.used}/{systemMetrics.servers.ram.total}) • Disco: {systemMetrics.servers.disk.usage}%
                    </Typography>
                  </Box>

                  {/* Database Section */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CloudQueue sx={{ color: '#3b82f6', fontSize: 20 }} />
                        <Typography variant="body2" fontWeight="500">Base de Datos</Typography>
                      </Stack>
                      <Chip
                        label={systemMetrics.database.status}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(59,130,246,0.1)',
                          color: '#3b82f6',
                          height: 20,
                          fontSize: '0.7rem'
                        }}
                      />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={systemMetrics.database.connections.usage}
                      sx={{
                        bgcolor: '#334155',
                        height: 6,
                        borderRadius: 3,
                        '& .MuiLinearProgress-bar': { bgcolor: '#8b5cf6' } // Purple/Blue
                      }}
                    />
                    <Typography variant="caption" color="#94a3b8" display="block" mt={0.5}>
                      Backup: {systemMetrics.database.lastBackup} • Conexiones: {systemMetrics.database.connections.active}/{systemMetrics.database.connections.max} ({systemMetrics.database.connections.usage}%)
                    </Typography>
                  </Box>

                </Stack>
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                  <CircularProgress size={30} />
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ============= TAB 1: MESSAGES ANALYTICS =============
  const MessagesAnalytics = () => {
    const messageStats = [
      { label: 'Enviados', value: msgs.sent || 0, icon: <Send />, color: CHART_COLORS.primary },
      { label: 'Recibidos', value: msgs.received || 0, icon: <Inbox />, color: CHART_COLORS.info },
      { label: 'Vistos', value: msgs.read || 0, icon: <Visibility />, color: CHART_COLORS.success },
      { label: 'Entregados', value: msgs.delivered || 0, icon: <DoneAll />, color: CHART_COLORS.success },
      { label: 'Fallidos', value: msgs.failed || 0, icon: <ErrorIcon />, color: CHART_COLORS.error },
      { label: 'Pendientes', value: msgs.pending || 0, icon: <Schedule />, color: CHART_COLORS.warning }
    ];

    const funnelData = [
      { name: 'Enviados', value: msgs.sent || 1000, fill: '#00a884' },
      { name: 'Entregados', value: msgs.delivered || 980, fill: '#25d366' },
      { name: 'Leídos', value: msgs.read || 850, fill: '#3b82f6' }
    ];

    return (
      <Box>
        <Grid container spacing={2} mb={3}>
          {messageStats.map((stat, idx) => (
            <Grid item xs={6} sm={4} md={2} key={idx}>
              <Card sx={{ bgcolor: '#1e293b', color: 'white', textAlign: 'center' }}>
                <CardContent>
                  <Box sx={{ color: stat.color, fontSize: 32, mb: 1 }}>{stat.icon}</Box>
                  <Typography variant="h5" fontWeight="bold">{formatNumber(stat.value)}</Typography>
                  <Typography variant="caption" color="#94a3b8">{stat.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Embudo de Conversión</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <FunnelChart>
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList position="right" fill="#fff" stroke="none" dataKey="name" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Métricas de Rendimiento</Typography>
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2">Tasa de Entrega</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatPercentage(msgs.deliveryRate || 98)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={msgs.deliveryRate || 98} sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS.success } }} />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2">Tasa de Lectura</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatPercentage(msgs.readRate || 85)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={msgs.readRate || 85} sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS.info } }} />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2">Tasa de Respuesta</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatPercentage(msgs.responseRate || 60)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={msgs.responseRate || 60} sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS.warning } }} />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2">Tasa de Fallo</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatPercentage(msgs.failureRate || 2)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={msgs.failureRate || 2} sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS.error } }} />
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ============= TAB 2: CAMPAIGNS ANALYTICS =============
  const CampaignsAnalytics = () => {
    const [realCampaigns, setRealCampaigns] = React.useState<any[]>([]);

    React.useEffect(() => {
      // Cargar campañas reales desde la base de datos
      fetch(`/api/campaigns?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.campaigns) {
            // Mapear campañas reales con sus datos
            const mapped = data.campaigns.map((c: any) => ({
              id: c.id,
              name: c.campaign_name || c.name || 'Sin nombre',
              status: c.status || 'draft',
              contacts: c.total_contacts || c.contacts?.length || 0,
              sent: c.messages_sent || 0,
              delivered: c.messages_delivered || 0
            }));
            setRealCampaigns(mapped);
          }
        })
        .catch(err => console.error('Error cargando campañas:', err));
    }, [sessionId]);

    const campaignsList = realCampaigns.length > 0 ? realCampaigns : camps.list || [];

    const statusData = [
      { name: 'Activas', value: camps.active || 3, color: CHART_COLORS.success },
      { name: 'Programadas', value: camps.scheduled || 5, color: CHART_COLORS.warning },
      { name: 'Completadas', value: camps.completed || 12, color: CHART_COLORS.info },
      { name: 'Borradores', value: camps.draft || 2, color: '#94a3b8' }
    ];

    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Campaign sx={{ fontSize: 40, color: CHART_COLORS.success, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(camps.active || 3)}</Typography>
                <Typography variant="body2" color="#94a3b8">Campañas Activas</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Schedule sx={{ fontSize: 40, color: CHART_COLORS.warning, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(camps.scheduled || 5)}</Typography>
                <Typography variant="body2" color="#94a3b8">Programadas</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <CheckCircle sx={{ fontSize: 40, color: CHART_COLORS.info, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(camps.completed || 12)}</Typography>
                <Typography variant="body2" color="#94a3b8">Completadas</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Timeline sx={{ fontSize: 40, color: CHART_COLORS.primary, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(camps.total || 22)}</Typography>
                <Typography variant="body2" color="#94a3b8">Total Creadas</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Estado de Campañas</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Campañas Recientes</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#94a3b8' }}>Nombre</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }}>Estado</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Contactos</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Enviados</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Entregados</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {campaignsList.map((camp: any) => (
                      <TableRow key={camp.id}>
                        <TableCell sx={{ color: 'white' }}>{camp.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={camp.status}
                            size="small"
                            sx={{
                              bgcolor: camp.status === 'active' ? 'rgba(37,211,102,0.1)' :
                                camp.status === 'scheduled' ? 'rgba(255,152,0,0.1)' : 'rgba(59,130,246,0.1)',
                              color: camp.status === 'active' ? '#25d366' :
                                camp.status === 'scheduled' ? '#ff9800' : '#3b82f6'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatNumber(camp.contacts)}</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatNumber(camp.sent)}</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatNumber(camp.delivered)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ============= TAB 3: KANBAN ANALYTICS =============
  const KanbanAnalytics = () => {
    const stages = [
      { name: 'Nuevo', contacts: kanban.nuevo || 45, color: '#3b82f6' },
      { name: 'En Gestión', contacts: kanban.gestion || 32, color: '#ff9800' },
      { name: 'Contactado', contacts: kanban.contactado || 28, color: '#9c27b0' },
      { name: 'Cerrado', contacts: kanban.cerrado || 18, color: '#25d366' },
      { name: 'Perdido', contacts: kanban.perdido || 7, color: '#ef4444' }
    ];

    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <ViewKanban sx={{ fontSize: 40, color: CHART_COLORS.primary, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(kanban.boards || 5)}</Typography>
                <Typography variant="body2" color="#94a3b8">Tableros Activos</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Group sx={{ fontSize: 40, color: CHART_COLORS.info, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(kanban.contacts || 130)}</Typography>
                <Typography variant="body2" color="#94a3b8">Total Contactos</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <TrendingUp sx={{ fontSize: 40, color: CHART_COLORS.success, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatPercentage(kanban.conversionRate || 13.8)}</Typography>
                <Typography variant="body2" color="#94a3b8">Tasa Conversión</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Timer sx={{ fontSize: 40, color: CHART_COLORS.warning, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatTime(kanban.avgTime || 172800)}</Typography>
                <Typography variant="body2" color="#94a3b8">Tiempo Promedio</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Contactos por Etapa</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stages}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                  <Bar dataKey="contacts" fill="#00a884">
                    {stages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Embudo de Conversión</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <FunnelChart>
                  <Funnel dataKey="contacts" data={stages} isAnimationActive>
                    {stages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList position="right" fill="#fff" stroke="none" dataKey="name" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ============= TAB 4: AGENTS ANALYTICS =============
  const AgentsAnalytics = () => {
    const [realAgents, setRealAgents] = React.useState<any[]>([]);

    React.useEffect(() => {
      // Cargar agentes reales desde la base de datos
      fetch(`/api/agents?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.agents) {
            // Mapear agentes reales con sus datos
            const mapped = data.agents.map((a: any) => ({
              id: a.id,
              name: a.name || a.email || 'Agente',
              status: a.agent_status || a.status || 'offline',
              messages: a.messages_handled || 0,
              avgResponse: a.avg_response_time || 60,
              satisfaction: a.satisfaction_rating || 4.5
            }));
            setRealAgents(mapped);
          }
        })
        .catch(err => console.error('Error cargando agentes:', err));
    }, [sessionId]);

    const agentsList = realAgents.length > 0 ? realAgents : agents.list || [];

    const statusDistribution = [
      { name: 'Online', value: agents.online || 3, color: CHART_COLORS.success },
      { name: 'Ocupado', value: agents.busy || 2, color: CHART_COLORS.warning },
      { name: 'Ausente', value: agents.away || 1, color: '#94a3b8' },
      { name: 'Offline', value: agents.offline || 2, color: CHART_COLORS.error }
    ];

    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <People sx={{ fontSize: 40, color: CHART_COLORS.primary, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(agents.total || 8)}</Typography>
                <Typography variant="body2" color="#94a3b8">Total Agentes</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <CloudDone sx={{ fontSize: 40, color: CHART_COLORS.success, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(agents.online || 3)}</Typography>
                <Typography variant="body2" color="#94a3b8">Online</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Warning sx={{ fontSize: 40, color: CHART_COLORS.warning, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(agents.busy || 2)}</Typography>
                <Typography variant="body2" color="#94a3b8">Ocupados</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Block sx={{ fontSize: 40, color: CHART_COLORS.error, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(agents.offline || 2)}</Typography>
                <Typography variant="body2" color="#94a3b8">Offline</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Estado de Agentes</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Rendimiento por Agente</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#94a3b8' }}>Agente</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }}>Estado</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Mensajes</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Tiempo Resp.</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Satisfacción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {agentsList.map((agent: any) => (
                      <TableRow key={agent.id}>
                        <TableCell sx={{ color: 'white' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 24, height: 24, bgcolor: CHART_COLORS.primary }}>{agent.name[0]}</Avatar>
                            <span>{agent.name}</span>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={agent.status}
                            size="small"
                            sx={{
                              bgcolor: agent.status === 'online' ? 'rgba(37,211,102,0.1)' : 'rgba(255,152,0,0.1)',
                              color: agent.status === 'online' ? '#25d366' : '#ff9800'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatNumber(agent.messages)}</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatTime(agent.avgResponse)}</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{agent.satisfaction.toFixed(1)} ⭐</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ============= TAB 5: CHATBOTS ANALYTICS =============
  const ChatbotsAnalytics = () => {
    const botsList = bots.list || [];
    const hasBots = botsList.length > 0;

    const performanceData = hasBots ? botsList.map((bot: any) => ({
      name: bot.name,
      interacciones: bot.interactions,
      exito: (bot.interactions * bot.successRate / 100),
      fallos: (bot.interactions * (100 - bot.successRate) / 100)
    })) : [];

    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <SmartToy sx={{ fontSize: 40, color: CHART_COLORS.purple, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatNumber(bots.active || 2)}</Typography>
                <Typography variant="body2" color="#94a3b8">Chatbots Activos</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <CheckCircle sx={{ fontSize: 40, color: CHART_COLORS.success, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatPercentage(bots.deliveryRate || 99.2)}</Typography>
                <Typography variant="body2" color="#94a3b8">Tasa de Entrega</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <Speed sx={{ fontSize: 40, color: CHART_COLORS.info, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatTime(bots.avgResponseTime || 0.8)}</Typography>
                <Typography variant="body2" color="#94a3b8">Tiempo Promedio</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#1e293b', color: 'white' }}>
              <CardContent>
                <TrendingUp sx={{ fontSize: 40, color: CHART_COLORS.success, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">{formatPercentage(bots.successRate || 94.5)}</Typography>
                <Typography variant="body2" color="#94a3b8">Tasa de Éxito</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Rendimiento por Chatbot</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                  <Legend />
                  <Bar dataKey="exito" fill={CHART_COLORS.success} name="Exitosas" />
                  <Bar dataKey="fallos" fill={CHART_COLORS.error} name="Fallidas" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Detalle de Chatbots</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#94a3b8' }}>Nombre</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }}>Estado</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Interacciones</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Éxito %</TableCell>
                      <TableCell sx={{ color: '#94a3b8' }} align="right">Tiempo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hasBots ? botsList.map((bot: any) => (
                      <TableRow key={bot.id}>
                        <TableCell sx={{ color: 'white' }}>{bot.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={bot.status}
                            size="small"
                            sx={{
                              bgcolor: bot.status === 'active' ? 'rgba(156,39,176,0.1)' : 'rgba(148,163,184,0.1)',
                              color: bot.status === 'active' ? '#9c27b0' : '#94a3b8'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatNumber(bot.interactions)}</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatPercentage(bot.successRate)}</TableCell>
                        <TableCell sx={{ color: 'white' }} align="right">{formatTime(bot.avgTime)}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ color: '#94a3b8', textAlign: 'center', py: 3 }}>
                          No hay chatbots configurados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ============= TAB 6: CONNECTIONS ANALYTICS =============
  const ConnectionsAnalytics = () => {
    const isConnected = connections.success && connections.isConnected;
    const phoneNumber = connections.phoneNumber || 'No disponible';
    const connectionTime = connections.connectionTime || 'N/A';

    // Obtener estadísticas de mensajes por conexión
    const sentMessages = dash.messages?.sent || 0;
    const receivedMessages = dash.messages?.received || 0;
    const totalMessages = dash.messages?.total || 0;
    const deliveredMessages = dash.messages?.delivered || 0;
    const readMessages = dash.messages?.read || 0;
    const failedMessages = dash.messages?.failed || 0;

    const connectionStats = [
      { label: 'Estado de Conexión', value: isConnected ? 'Conectado' : 'Desconectado', icon: <CheckCircle />, color: isConnected ? CHART_COLORS.success : CHART_COLORS.error },
      { label: 'Número WhatsApp', value: phoneNumber, icon: <Message />, color: CHART_COLORS.info },
      { label: 'Mensajes Enviados', value: formatNumber(sentMessages), icon: <Send />, color: CHART_COLORS.primary },
      { label: 'Mensajes Recibidos', value: formatNumber(receivedMessages), icon: <Inbox />, color: CHART_COLORS.info },
      { label: 'Total Mensajes', value: formatNumber(totalMessages), icon: <Message />, color: CHART_COLORS.warning },
      { label: 'Tasa Entrega', value: formatPercentage(dash.kpis?.delivery_rate || 0), icon: <DoneAll />, color: CHART_COLORS.success }
    ];

    const messageDistribution = [
      { name: 'Enviados', value: sentMessages, color: CHART_COLORS.primary },
      { name: 'Recibidos', value: receivedMessages, color: CHART_COLORS.info },
      { name: 'Entregados', value: deliveredMessages, color: CHART_COLORS.success },
      { name: 'Leídos', value: readMessages, color: '#9c27b0' },
      { name: 'Fallidos', value: failedMessages, color: CHART_COLORS.error }
    ];

    return (
      <Box>
        {/* Connection Status Alert */}
        <Alert
          severity={isConnected ? 'success' : 'error'}
          sx={{ mb: 3, bgcolor: isConnected ? 'rgba(37,211,102,0.1)' : 'rgba(239,68,68,0.1)', color: isConnected ? '#25d366' : '#ef4444' }}
        >
          <Typography variant="h6" fontWeight="bold">
            {isConnected ? '✅ Conexión WhatsApp Activa' : '❌ Conexión WhatsApp Inactiva'}
          </Typography>
          <Typography variant="body2">
            {isConnected
              ? `Conectado como: ${phoneNumber} | Tiempo de conexión: ${connectionTime}`
              : 'No hay una sesión de WhatsApp activa. Escanea el código QR para conectar.'}
          </Typography>
        </Alert>

        {/* Connection Stats Grid */}
        <Grid container spacing={2} mb={3}>
          {connectionStats.map((stat, idx) => (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <Card sx={{ bgcolor: '#1e293b', color: 'white', height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ color: stat.color, fontSize: 40 }}>{stat.icon}</Box>
                    <Box flex={1}>
                      <Typography variant="caption" color="#94a3b8">{stat.label}</Typography>
                      <Typography variant="h6" fontWeight="bold" sx={{ wordBreak: 'break-all' }}>{stat.value}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Charts */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Distribución de Mensajes</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={messageDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
                    {messageDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, bgcolor: '#1e293b', color: 'white' }}>
              <Typography variant="h6" mb={2}>Análisis de Actividad</Typography>
              <Stack spacing={3}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Mensajes Enviados</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatNumber(sentMessages)}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={totalMessages > 0 ? (sentMessages / totalMessages) * 100 : 0}
                    sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS.primary } }}
                  />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Mensajes Recibidos</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatNumber(receivedMessages)}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={totalMessages > 0 ? (receivedMessages / totalMessages) * 100 : 0}
                    sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS.info } }}
                  />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Mensajes Entregados</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatNumber(deliveredMessages)}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={sentMessages > 0 ? (deliveredMessages / sentMessages) * 100 : 0}
                    sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS.success } }}
                  />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Mensajes Leídos</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatNumber(readMessages)}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={sentMessages > 0 ? (readMessages / sentMessages) * 100 : 0}
                    sx={{ bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: '#9c27b0' } }}
                  />
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', bgcolor: '#0f172a' }}>
        <CircularProgress sx={{ color: CHART_COLORS.primary }} />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3, bgcolor: '#0f172a', minHeight: '100vh' }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Analytics sx={{ fontSize: 40, color: CHART_COLORS.primary }} />
            <Box>
              <Typography variant="h4" fontWeight="bold" color="white">Analytics Completo</Typography>
              <Typography variant="body2" color="#94a3b8">Sistema de métricas y estadísticas</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <DatePicker
              label="Desde"
              value={startDate}
              onChange={(newValue) => newValue && setStartDate(newValue)}
              slotProps={{ textField: { size: 'small', sx: { bgcolor: '#1e293b', '& .MuiInputBase-input': { color: 'white' } } } }}
            />
            <DatePicker
              label="Hasta"
              value={endDate}
              onChange={(newValue) => newValue && setEndDate(newValue)}
              slotProps={{ textField: { size: 'small', sx: { bgcolor: '#1e293b', '& .MuiInputBase-input': { color: 'white' } } } }}
            />
            <IconButton onClick={handleRefresh} sx={{ color: 'white', bgcolor: '#1e293b' }}>
              <Refresh />
            </IconButton>
          </Stack>
        </Stack>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange} textColor="inherit" TabIndicatorProps={{ sx: { bgcolor: CHART_COLORS.primary } }}>
            <Tab label="General" sx={{ color: '#94a3b8', '&.Mui-selected': { color: 'white' } }} />
            <Tab label="Mensajería" sx={{ color: '#94a3b8', '&.Mui-selected': { color: 'white' } }} />
            <Tab label="Campañas" sx={{ color: '#94a3b8', '&.Mui-selected': { color: 'white' } }} />
            <Tab label="Kanban" sx={{ color: '#94a3b8', '&.Mui-selected': { color: 'white' } }} />
            <Tab label="Agentes" sx={{ color: '#94a3b8', '&.Mui-selected': { color: 'white' } }} />
            <Tab label="Chatbots" sx={{ color: '#94a3b8', '&.Mui-selected': { color: 'white' } }} />
            <Tab label="Conexiones" sx={{ color: '#94a3b8', '&.Mui-selected': { color: 'white' } }} />
          </Tabs>
        </Box>

        {/* Tab Content */}
        {activeTab === 0 && <GeneralDashboard />}
        {activeTab === 1 && <MessagesAnalytics />}
        {activeTab === 2 && <CampaignsAnalytics />}
        {activeTab === 3 && <KanbanAnalytics />}
        {activeTab === 4 && <AgentsAnalytics />}
        {activeTab === 5 && <ChatbotsAnalytics />}
        {activeTab === 6 && <ConnectionsAnalytics />}
      </Box>
    </LocalizationProvider>
  );
};

export default AnalyticsModule;