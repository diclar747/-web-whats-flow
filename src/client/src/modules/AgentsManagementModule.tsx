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
  Divider
} from '@mui/material';
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
  Close as CloseIcon
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
    password: '',
    max_concurrent_chats: 5
  });
  const [showPassword, setShowPassword] = useState(false);

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
        setAgents(data.agents || []);
      } else {
        console.error('Error al cargar agentes', data);
        showSnackbar(data.error || 'Error al cargar agentes', 'error');
      }
    } catch (error) {
      console.error('Error cargando agentes:', error);
      showSnackbar('Error de conexión al cargar agentes', 'error');
    } finally {
      setLoading(false);
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
        password: '',
        max_concurrent_chats: agent.max_concurrent_chats || 5
      });
    } else {
      setEditingAgent(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        max_concurrent_chats: 5
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
        : `${getAPIBaseURL()}/api/agents/create`;

      const method = editingAgent ? 'PUT' : 'POST';

      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        max_concurrent_chats: formData.max_concurrent_chats
      };

      // Solo incluir password si se está editando y se proporcionó uno nuevo, o si es creación
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('agentToken') || sessionStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

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
      console.error('Error guardando agente:', error);
      showSnackbar('Error de conexión al guardar agente', 'error');
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
        showSnackbar(
          newStatus === 'inactive' ? 'Agente bloqueado' : 'Agente desbloqueado',
          'success'
        );
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
      default: return 'Desconocido';
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
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#1a1a1a' }}>
            Gestión de Agentes
          </Typography>
          <Typography variant="body2" color="textSecondary">
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
              bgcolor: '#00a884',
              '&:hover': { bgcolor: '#008c6d' }
            }}
          >
            Crear Agente
          </Button>
        </Stack>
      </Box>

      {/* Estadísticas */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#f5f5f5', borderLeft: '4px solid #2196f3' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3' }}>
                {stats.total}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Agentes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
                {stats.online}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                En línea
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#ffebee', borderLeft: '4px solid #f44336' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#f44336' }}>
                {stats.busy}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Ocupados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
                {stats.paused}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                En pausa
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#fafafa', borderLeft: '4px solid #9e9e9e' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#9e9e9e' }}>
                {stats.offline}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Desconectados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#fce4ec', borderLeft: '4px solid #e91e63' }}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#e91e63' }}>
                {stats.blocked}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Bloqueados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtros y búsqueda */}
      <Card sx={{ mb: 3 }}>
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
      <Card>
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
                            <Avatar sx={{ mr: 2, bgcolor: '#00a884' }}>
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
              <TextField
                fullWidth
                label="Nombre completo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                autoComplete="name"
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
