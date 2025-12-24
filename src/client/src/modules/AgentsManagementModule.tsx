import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { getSocketURL } from '../utils/socketConfig';
import { io } from 'socket.io-client';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Stack,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Tabs,
  Tab,
  InputAdornment,
  CircularProgress,
  Divider,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  PersonAdd,
  Edit,
  Delete,
  Block,
  Circle,
  Refresh,
  Search,
  CheckCircle,
  Cancel,
  Pause,
  Phone,
  Email,
  LockOpen,
  Lock,
  Visibility,
  VisibilityOff,
  Person,
  SupervisorAccount,
  AdminPanelSettings,
  Save,
  Close as CloseIcon,
  WhatsApp
} from '@mui/icons-material';

interface AgentsManagementModuleProps {
  sessionId: string;
}

type AgentStatus = 'online' | 'offline' | 'paused' | 'busy';
type AgentAccess = 'active' | 'inactive' | 'suspended';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: AgentAccess;            // ✅ ACCESO: active/inactive (control del admin)
  agent_status: AgentStatus;      // ✅ ACTIVIDAD: online/offline/paused/busy
  created_at: string;
  createdAt?: string;
  last_activity?: string;
  avatar_url?: string;
  max_concurrent_chats?: number;
  role?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

const AgentsManagementModule: React.FC<AgentsManagementModuleProps> = ({ sessionId }) => {
  // Estados principales
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AgentStatus>('all');
  const [selectedTab, setSelectedTab] = useState(0);

  // Socket para actualizaciones en tiempo real
  const [socket, setSocket] = useState<any>(null);

  // Estados del diálogo de crear/editar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    avatar_url: '',
    password: '',
    max_concurrent_chats: 5,
    sendWhatsApp: true
  });
  const [showPassword, setShowPassword] = useState(false);

  // Estados para búsqueda de contactos
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Estados del diálogo de confirmación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  // Snackbar para notificaciones
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Cargar agentes al montar el componente
  useEffect(() => {
    loadAgents();
    setupSocketConnection();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Filtrar agentes cuando cambian los filtros
  useEffect(() => {
    let filtered = agents;

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agent.phone && agent.phone.includes(searchTerm))
      );
    }

    // Filtrar por estado de ACTIVIDAD (online/offline/paused/busy)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(agent => agent.agent_status === statusFilter as AgentStatus);
    }

    setFilteredAgents(filtered);
  }, [agents, searchTerm, statusFilter]);

  // Configurar conexión Socket.IO
  const setupSocketConnection = () => {
    const socketURL = getSocketURL();
    const newSocket = io(socketURL);
    setSocket(newSocket);

    // ✅ Escuchar actualizaciones de ACTIVIDAD (online/offline/paused/busy)
    newSocket.on('agent-status-changed', (data: { agentId: string; agent_status: AgentStatus }) => {
      console.log('🔔 [AGENTS-MODULE] Estado de actividad cambiado:', data);
      setAgents(prev => prev.map(agent =>
        String(agent.id) === String(data.agentId) ? { ...agent, agent_status: data.agent_status } : agent
      ));
    });

    // ✅ Escuchar actualizaciones de ACCESO (bloqueado/desbloqueado)
    newSocket.on('agent-access-changed', (data: { agentId: string; status: AgentAccess }) => {
      console.log('🔔 [AGENTS-MODULE] Acceso cambió:', data);
      setAgents(prev => prev.map(agent =>
        String(agent.id) === String(data.agentId) ? { ...agent, status: data.status } : agent
      ));
    });

    newSocket.on('agents-status-update', () => {
      loadAgents();
    });
  };

  // Cargar lista de agentes
  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getAPIBaseURL()}/api/agents/list?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('agentToken') || sessionStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        let loadedAgents: Agent[] = data.agents || [];

        // Enriquecer con avatar desde contactos si falta
        const agentsNeedingAvatar = loadedAgents.filter(a => !a.avatar_url && a.phone);
        if (agentsNeedingAvatar.length > 0) {
          try {
            const updated = await Promise.all(loadedAgents.map(async (a) => {
              if (a.avatar_url || !a.phone) return a;
              const phoneDigits = String(a.phone).replace(/[^0-9]/g, '');
              try {
                const res = await fetch(`${getAPIBaseURL()}/api/contacts/search/${sessionId}/${encodeURIComponent(phoneDigits)}`);
                const json = await res.json();
                if (json && json.success && json.contact) {
                  const avatar = json.contact.avatar_url || json.contact.avatarUrl || null;
                  if (avatar) return { ...a, avatar_url: avatar } as Agent;
                }
              } catch (e) {
                console.warn('[AGENTS] No se pudo enriquecer avatar para', a.email);
              }
              return a;
            }));
            loadedAgents = updated as Agent[];
          } catch (_) {
            // Ignorar errores de enriquecimiento
          }
        }

        setAgents(loadedAgents);
      } else {
        console.error('Error al cargar agentes', data);
        showSnackbar(data.error || 'Error al cargar agentes', 'error');
      }
    } catch (error: any) {
      console.error('Error al cargar agentes:', error);
      let errorMsg = 'Error desconocido al cargar agentes';

      if (typeof error === 'string') {
        errorMsg = error;
      } else if (error?.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error?.message) {
        errorMsg = error.message;
      }

      setSnackbar({
        open: true,
        message: errorMsg,
        severity: 'error'
      });

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        // Optional: redirect to login or show detailed auth error
        console.warn('Auth error detected - Token might be invalid');
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar contactos desde el backend
  const loadContacts = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      console.log('[LOAD-CONTACTS] 💡 Búsqueda muy corta, se necesitan al menos 2 caracteres');
      setContacts([]);
      return;
    }

    console.log(`[LOAD-CONTACTS] 🔍 Buscando contactos para sesión: ${sessionId}`);
    console.log(`[LOAD-CONTACTS] 🔎 Término de búsqueda: "${searchTerm}"`);

    try {
      setLoadingContacts(true);
      const url = `${getAPIBaseURL()}/api/contacts/${sessionId}?limit=100&search=${encodeURIComponent(searchTerm)}`;
      console.log(`[LOAD-CONTACTS] 📡 URL de petición: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('agentToken') || sessionStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      console.log('[LOAD-CONTACTS] ✅ Respuesta recibida:', data);

      // La API responde con "contacts" (y algunos módulos antiguos con "contactos")
      const rawContacts = (data && (data.contacts || data.contactos)) || [];

      if (data.success && Array.isArray(rawContacts)) {
        // Normalizar campos y filtrar solo individuales
        const normalized = rawContacts
          .map((c: any) => ({
            ...c,
            name: c.name || c.notify_name || c.notify || c.jid?.split('@')[0] || '',
            avatar_url: c.avatar_url || c.avatarUrl || c.avatar || null,
            jid: c.jid,
          }))
          .filter((c: any) => c && c.jid && !String(c.jid).includes('@g.us'));

        console.log(`[LOAD-CONTACTS] 📋 Contactos individuales filtrados: ${normalized.length}`);
        setContacts(normalized);
      } else {
        console.log('[LOAD-CONTACTS] ⚠️ No se encontraron contactos o respuesta inválida');
        setContacts([]);
      }
    } catch (error) {
      console.error('[LOAD-CONTACTS] ❌ Error al cargar contactos:', error);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Abrir diálogo para crear o editar agente
  const handleOpenDialog = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      setFormData({
        name: agent.name,
        email: agent.email,
        phone: agent.phone || '',
        avatar_url: (agent as any).avatar_url || '',
        password: '',
        max_concurrent_chats: agent.max_concurrent_chats || 5,
        sendWhatsApp: true
      });
    } else {
      setEditingAgent(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        avatar_url: '',
        password: '',
        max_concurrent_chats: 5,
        sendWhatsApp: true
      });
    }
    setDialogOpen(true);
  };

  // Cerrar diálogo
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAgent(null);
    setShowPassword(false);
  };

  // Guardar agente (crear o actualizar)
  const handleSaveAgent = async () => {
    console.log('🚀 [FRONTEND-AGENT] Iniciando handleSaveAgent...');

    // Validaciones
    if (!formData.name || !formData.email) {
      showSnackbar('Por favor completa nombre y email', 'warning');
      return;
    }

    if (!editingAgent && !formData.password) {
      showSnackbar('La contraseña es requerida para nuevos agentes', 'warning');
      return;
    }

    try {
      const url = editingAgent
        ? `${getAPIBaseURL()}/api/agents/${editingAgent.id}`
        : `${getAPIBaseURL()}/api/agents-create`; // ✅ Ruta plana para evitar 404

      const method = editingAgent ? 'PUT' : 'POST';

      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        avatar_url: formData.avatar_url || undefined,
        max_concurrent_chats: formData.max_concurrent_chats,
        // Enviar credenciales por WhatsApp si se solicita
        sendWhatsApp: formData.sendWhatsApp,
        sessionId: sessionId || sessionStorage.getItem('sessionId') || localStorage.getItem('sessionId') || localStorage.getItem('whatsflow_session') || sessionStorage.getItem('whatsflow_session')
      };

      // Solo incluir password si se está editando y se proporcionó uno nuevo, o si es creación
      if (formData.password) {
        payload.password = formData.password;
      }

      console.log('🌐 [FRONTEND-AGENT] Enviando request:', {
        url,
        method,
        payload: { ...payload, password: payload.password ? '***' : undefined }
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('agentToken') || sessionStorage.getItem('token')}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 [FRONTEND-AGENT] Response recibido:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();
      console.log('📦 [FRONTEND-AGENT] Data parseado:', data);

      if (data.success) {
        showSnackbar(
          editingAgent ? 'Agente actualizado correctamente' : 'Agente creado correctamente',
          'success'
        );
        handleCloseDialog();
        loadAgents();
      } else {
        showSnackbar(data.error || 'Error al guardar agente', 'error');
      }
    } catch (error) {
      console.error('❌ [FRONTEND-AGENT] Error guardando agente:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          showSnackbar('Timeout: El servidor tardó demasiado en responder', 'error');
        } else {
          showSnackbar(`Error: ${error.message}`, 'error');
        }
      } else {
        showSnackbar('Error de conexión al guardar agente', 'error');
      }
    }
  };

  // Abrir diálogo de confirmación para eliminar
  const handleOpenDeleteDialog = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${agentToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('agentToken') || sessionStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        showSnackbar('Agente eliminado correctamente', 'success');
        setDeleteDialogOpen(false);
        setAgentToDelete(null);
        loadAgents();
      } else {
        showSnackbar(data.error || 'Error al eliminar agente', 'error');
      }
    } catch (error) {
      console.error('Error eliminando agente:', error);
      showSnackbar('Error de conexión al eliminar agente', 'error');
    }
  };

  // Bloquear/Desbloquear agente
  const handleToggleBlockAgent = async (agent: Agent) => {
    try {
      // ✅ USAR ENDPOINT CORRECTO: /api/agents/:id/access
      // Cambiar entre 'active' (permitir) e 'inactive' (bloquear)
      const newStatus = agent.status === 'active' ? 'inactive' : 'active';

      const response = await fetch(`${getAPIBaseURL()}/api/agents/${agent.id}/access`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('agentToken') || sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

      const data = await response.json();

      if (data.success) {
        // ✅ Actualizar estado local INMEDIATAMENTE para evitar race conditions
        setAgents(prev => prev.map(a =>
          String(a.id) === String(agent.id) ? { ...a, status: newStatus } : a
        ));

        showSnackbar(
          newStatus === 'inactive' ? 'Agente bloqueado' : 'Agente desbloqueado',
          'success'
        );

        // Recargar para asegurar sincronización con el servidor
        loadAgents();
      } else {
        showSnackbar(data.error || 'Error al cambiar acceso del agente', 'error');
      }
    } catch (error) {
      console.error('Error cambiando acceso de agente:', error);
      showSnackbar('Error de conexión', 'error');
    }
  };

  // Mostrar snackbar
  const showSnackbar = (message: string, severity: SnackbarState['severity']) => {
    setSnackbar({ open: true, message, severity });
  };

  // Obtener color del estado
  const getStatusColor = (status: AgentStatus): string => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'busy': return '#f44336';
      case 'paused': return '#ff9800';
      case 'offline': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  // Obtener label del estado
  const getStatusLabel = (status: AgentStatus): string => {
    switch (status) {
      case 'online': return 'En línea';
      case 'busy': return 'Ocupado';
      case 'paused': return 'En pausa';
      case 'offline': return 'Desconectado';
      default: return `Desconocido (${status})`;
    }
  };

  // Obtener icono del estado
  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'online': return <CheckCircle />;
      case 'busy': return <Cancel />;
      case 'paused': return <Pause />;
      case 'offline': return <Circle />;
      default: return <Circle />;
    }
  };

  // Estadísticas de agentes
  const stats = {
    total: agents.length,
    online: agents.filter(a => a.agent_status === 'online').length,
    busy: agents.filter(a => a.agent_status === 'busy').length,
    paused: agents.filter(a => a.agent_status === 'paused').length,
    offline: agents.filter(a => a.agent_status === 'offline').length,
    blocked: agents.filter(a => a.status === 'inactive').length
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#0f172a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#f1f5f9' }}>
            Gestión de Agentes
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Administra tus agentes y monitorea su estado en tiempo real
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Tooltip title="Actualizar">
            <IconButton onClick={loadAgents} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => handleOpenDialog()}
            sx={{
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' }
            }}
          >
            Crear Agente
          </Button>
        </Stack>
      </Box>

      {/* Estadísticas */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #6366f1', border: '1px solid rgba(255,255,255,0.05)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#6366f1' }}>
                {stats.total}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Total Agentes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #10b981', border: '1px solid rgba(255,255,255,0.05)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#10b981' }}>
                {stats.online}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                En línea
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #ef4444', border: '1px solid rgba(255,255,255,0.05)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#ef4444' }}>
                {stats.busy}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Ocupados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #f59e0b', border: '1px solid rgba(255,255,255,0.05)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                {stats.paused}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                En pausa
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #64748b', border: '1px solid rgba(255,255,255,0.05)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#64748b' }}>
                {stats.offline}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Desconectados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #e91e63', border: '1px solid rgba(255,255,255,0.05)' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#e91e63' }}>
                {stats.blocked}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Bloqueados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtros y búsqueda */}
      <Card sx={{ mb: 3, bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.05)' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por estado</InputLabel>
                <Select
                  value={statusFilter}
                  label="Filtrar por estado"
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <MenuItem value="all">Todos los estados</MenuItem>
                  <MenuItem value="online">🟢 En línea</MenuItem>
                  <MenuItem value="busy">🔴 Ocupado</MenuItem>
                  <MenuItem value="paused">🟡 En pausa</MenuItem>
                  <MenuItem value="offline">⚫ Desconectado</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabla de agentes */}
      <Card sx={{ bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.05)' }}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredAgents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No se encontraron agentes
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {searchTerm || statusFilter !== 'all'
                  ? 'Prueba con otros filtros de búsqueda'
                  : 'Crea tu primer agente para comenzar'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Agente</TableCell>
                    <TableCell>Contacto</TableCell>
                    <TableCell align="center">Estado</TableCell>
                    <TableCell align="center">Última actividad</TableCell>
                    <TableCell align="center">Chats máx.</TableCell>
                    <TableCell align="center">Estado cuenta</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            badgeContent={
                              <Circle
                                sx={{
                                  fontSize: 14,
                                  color: getStatusColor(agent.agent_status)
                                }}
                              />
                            }
                          >
                            <Avatar
                              src={(agent as any).avatar_url || undefined}
                              sx={{ mr: 2, bgcolor: (agent as any).avatar_url ? 'transparent' : '#00a884' }}
                              imgProps={{ referrerPolicy: 'no-referrer' }}
                            >
                              {agent.name.charAt(0).toUpperCase()}
                            </Avatar>
                          </Badge>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {agent.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              ID: {String(agent.id || '').substring(0, 8)}...
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Email sx={{ fontSize: 14, color: '#64748b' }} />
                            <Typography variant="body2">{agent.email}</Typography>
                          </Box>
                          {agent.phone && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Phone sx={{ fontSize: 14, color: '#64748b' }} />
                              <Typography variant="body2">{agent.phone}</Typography>
                            </Box>
                          )}
                        </Stack>
                      </TableCell>
                      {/* ✅ MOSTRAR ESTADO DE ACTIVIDAD (online/offline/paused/busy) */}
                      <TableCell align="center">
                        <Chip
                          icon={getStatusIcon(agent.agent_status)}
                          label={getStatusLabel(agent.agent_status)}
                          size="small"
                          sx={{
                            bgcolor: `${getStatusColor(agent.agent_status)}20`,
                            color: getStatusColor(agent.agent_status),
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {agent.last_activity
                            ? new Date(agent.last_activity).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            : 'Nunca'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={agent.max_concurrent_chats || 5}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {/* ✅ MOSTRAR STATUS DE ACCESO (bloqueado/activo) - Controlado por admin */}
                        <Chip
                          label={agent.status === 'active' ? 'Activo' : 'Bloqueado'}
                          size="small"
                          color={agent.status === 'active' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenDialog(agent)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          {/* ✅ BLOQUEAR/DESBLOQUEAR - Cambiar status de acceso */}
                          <Tooltip title={agent.status === 'active' ? 'Bloquear acceso' : 'Permitir acceso'}>
                            <IconButton
                              size="small"
                              color={agent.status === 'active' ? 'warning' : 'success'}
                              onClick={() => handleToggleBlockAgent(agent)}
                            >
                              {agent.status === 'active' ? <Lock /> : <LockOpen />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleOpenDeleteDialog(agent)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de crear/editar agente */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAgent ? 'Editar Agente' : 'Crear Nuevo Agente'}
        </DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); handleSaveAgent(); }}>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Autocomplete
                fullWidth
                freeSolo
                options={contacts}
                loading={loadingContacts}
                getOptionLabel={(option: any) => {
                  if (typeof option === 'string') return option;
                  return option?.name || option?.notify_name || '';
                }}
                filterOptions={(x) => x}
                value={formData.name}
                onChange={(event, newValue) => {
                  console.log('[AUTOCOMPLETE] Contacto seleccionado:', newValue);
                  if (typeof newValue === 'string') {
                    setFormData({ ...formData, name: newValue });
                  } else if (newValue && newValue.name) {
                    let phone = newValue.phone || '';
                    if (!phone && newValue.jid) {
                      phone = newValue.jid.split('@')[0];
                    }
                    const avatarUrl = newValue.avatar_url || newValue.avatarUrl || null;
                    console.log(`[AUTOCOMPLETE] 📱 Auto-llenando teléfono: ${phone}`);
                    setFormData({
                      ...formData,
                      name: newValue.name,
                      phone: phone,
                      avatar_url: avatarUrl || ''
                    });
                  }
                }}
                onInputChange={(event, value, reason) => {
                  console.log(`[AUTOCOMPLETE] onInputChange: {value: "${value}", reason: "${reason}"}`);
                  setSearchInput(value);
                  setFormData({ ...formData, name: value });
                  if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                  }
                  if (value && value.length >= 2) {
                    console.log(`[AUTOCOMPLETE] 🔍 Ejecutando búsqueda para: "${value}"`);
                    searchTimeoutRef.current = setTimeout(() => {
                      loadContacts(value);
                    }, 500);
                  } else {
                    setContacts([]);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Nombre completo"
                    required
                    placeholder="Escribe al menos 2 letras para buscar..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingContacts ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                    helperText={
                      loadingContacts
                        ? '🔍 Buscando contactos...'
                        : contacts.length > 0
                          ? `✅ ${contacts.length} contacto(s) encontrado(s)`
                          : searchInput && searchInput.length >= 2
                            ? '⚠️ No se encontraron contactos con ese nombre'
                            : '💡 Escribe al menos 2 letras para buscar en tus contactos'
                    }
                  />
                )}
                renderOption={(props, option: any) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                    <Avatar
                      src={option.avatar_url}
                      alt={option.name}
                      sx={{ width: 40, height: 40 }}
                    >
                      {option.name?.[0]?.toUpperCase() || '?'}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {option.name || option.notify_name}
                      </Typography>
                      {option.jid && (
                        <Typography variant="caption" color="text.secondary">
                          📱 {option.jid.split('@')[0]}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                noOptionsText={
                  searchInput.length < 2
                    ? "Escribe al menos 2 letras para buscar"
                    : loadingContacts
                      ? "Buscando..."
                      : "No se encontraron contactos con ese nombre"
                }
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
              />
              <TextField
                fullWidth
                label="Teléfono (opcional)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                autoComplete="tel"
              />
              <TextField
                fullWidth
                label={editingAgent ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingAgent}
                autoComplete={editingAgent ? 'new-password' : 'new-password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                fullWidth
                label="Avatar URL (Opcional)"
                value={formData.avatar_url}
                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                placeholder="https://example.com/avatar.jpg"
                helperText="URL de la imagen de perfil del agente"
              />
              {!editingAgent && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.sendWhatsApp}
                      onChange={(e) => setFormData({ ...formData, sendWhatsApp: e.target.checked })}
                      color="success"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WhatsApp color="success" fontSize="small" />
                      <Typography variant="body2">
                        Enviar credenciales de acceso al WhatsApp del agente
                      </Typography>
                    </Box>
                  }
                />
              )}
              <TextField
                fullWidth
                label="Máximo de chats concurrentes"
                type="number"
                value={formData.max_concurrent_chats}
                onChange={(e) => setFormData({ ...formData, max_concurrent_chats: parseInt(e.target.value) || 5 })}
                inputProps={{ min: 1, max: 50 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} startIcon={<CloseIcon />} type="button">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008c6d' } }}
            >
              {editingAgent ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro que deseas eliminar al agente <strong>{agentToDelete?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AgentsManagementModule;
