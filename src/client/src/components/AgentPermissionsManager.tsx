import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Badge,
  Switch,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  VpnKey as VpnKeyIcon,
  Chat as ChatIcon,
  Campaign as CampaignIcon,
  CalendarMonth as CalendarIcon,
  ViewKanban as KanbanIcon,
  Contacts as ContactsIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAPIBaseURL } from '../utils/socketConfig';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'online' | 'offline' | 'busy';
  is_active: boolean;
  created_at: string;
  total_permissions: number;
  admin_phone?: string;
  role?: string;
}

interface Permission {
  permission_id: number;
  permission_name: string;
  description: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Module {
  name: string;
  permissions: Permission[];
}

const AgentPermissionsManager: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Dialogs
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [agentPermissions, setAgentPermissions] = useState<Permission[]>([]);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    is_active: true
  });

  // Module icons
  const moduleIcons: { [key: string]: React.ReactNode } = {
    chat: <ChatIcon />,
    campaign: <CampaignIcon />,
    calendar: <CalendarIcon />,
    kanban: <KanbanIcon />,
    contacts: <ContactsIcon />,
    analytics: <AnalyticsIcon />,
    settings: <SettingsIcon />,
    users: <PeopleIcon />
  };

  // Module names in Spanish
  const moduleNames: { [key: string]: string } = {
    chat: 'Chat',
    campaign: 'Campañas',
    calendar: 'Calendario/Agenda',
    kanban: 'Kanban',
    contacts: 'Contactos',
    analytics: 'Analíticas',
    settings: 'Configuración',
    users: 'Usuarios/Agentes'
  };

  useEffect(() => {
    loadAgents();
    loadModules();
  }, []);

  const getAuthHeaders = (): HeadersInit => {
    // Buscar token y sessionId en sessionStorage principalmente
    const token = sessionStorage.getItem('whatsflow_token') || 
                  sessionStorage.getItem('token') || 
                  localStorage.getItem('whatsflow_token') ||
                  localStorage.getItem('token');
    
    const sessionId = sessionStorage.getItem('whatsflow_session') ||
                     sessionStorage.getItem('sessionId');
    
    const sessionToken = sessionStorage.getItem('sessionToken');
    const deviceId = sessionStorage.getItem('device_id');

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (token) {
      console.log('✅ Token JWT encontrado');
      headers['Authorization'] = `Bearer ${token}`;
    } else if (sessionId) {
      console.log('✅ Usando sessionId para autenticación');
      headers['X-Session-Id'] = sessionId;
    } else {
      console.error('❌ No se encontró token de autenticación');
    }
    
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken;
    }
    
    if (deviceId) {
      headers['X-Device-Id'] = deviceId;
    }

    return headers;
  };

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      // Obtener sessionId como fallback
      const sessionId = sessionStorage.getItem('whatsflow_session') ||
                       sessionStorage.getItem('sessionId') ||
                       localStorage.getItem('whatsflow_session');

      // Construir URL con sessionId si no hay token
      const url = new URL(`${getAPIBaseURL()}/api/agents/list`);
      if (sessionId) {
        url.searchParams.append('sessionId', sessionId);
      }

      console.log('📋 Cargando agentes con URL:', url.toString());

      // Usar el endpoint correcto que filtra por admin_phone
      const response = await fetch(url.toString(), {
        headers: getAuthHeaders()
      });

      // Check if the response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got ${contentType}. Status: ${response.status}`);
      }

      const data = await response.json();
      if (response.ok && data.success) {
        console.log('✅ Agentes cargados:', data.agents.length);
        // Los agentes ya vienen en el formato correcto del backend
        setAgents(data.agents);
      } else {
        // Handle error responses properly
        const errorMessage = data?.error || `Error ${response.status}: ${response.statusText}`;
        setError(errorMessage);
        console.error('Error loading agents:', errorMessage);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Handle malformed JSON (the "Unexpected token '<'" error)
        setError('Error de respuesta del servidor: El servidor no devolvió datos JSON válidos');
        console.error('JSON parsing error:', err);
      } else if (err instanceof TypeError) {
        // Handle network errors
        setError('Error de conexión: No se pudo conectar con el servidor');
        console.error('Network error:', err);
      } else {
        // Handle other errors
        setError(err instanceof Error ? err.message : 'Error desconocido al cargar agentes');
        console.error('Other error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/permissions/modules`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setModules(data.modules);
      }
    } catch (err) {
      console.error('Error cargando módulos:', err);
    }
  };

  const loadAgentPermissions = async (agentId: string) => {
    try {
      // Usar el endpoint correcto para obtener permisos de agentes
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${agentId}/permissions`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setAgentPermissions(data.permissions);
      }
    } catch (err) {
      console.error('Error cargando permisos del agente:', err);
    }
  };

  const handleCreateAgent = async () => {
    if (!formData.name || !formData.email) {
      setError('Nombre y email son requeridos');
      return;
    }

    if (!formData.password) {
      setError('La contraseña es requerida para que el usuario pueda iniciar sesión');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const headersObj = headers as Record<string, string>;
      console.log('📤 Enviando petición para crear agente:', {
        url: `${getAPIBaseURL()}/api/agents/create`,
        hasAuth: !!headersObj['Authorization'],
        body: { ...formData, password: '***' }
      });

      // Obtener sessionId del usuario actual como fallback
      const sessionId = sessionStorage.getItem('whatsflow_session') || 
                       sessionStorage.getItem('sessionId') ||
                       localStorage.getItem('whatsflow_session');
      
      console.log('📱 SessionId del usuario:', sessionId);

      // Usar el endpoint correcto que crea la relación admin-agente
      const response = await fetch(`${getAPIBaseURL()}/api/agents/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          sessionId, // Enviar sessionId como autenticación alternativa
          permissions: [] // Inicialmente sin permisos, se asignan después
        })
      });
      
      console.log('📥 Respuesta del servidor:', response.status, response.statusText);
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Error en respuesta:', data);
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      if (data.success) {
        console.log('✅ Agente creado exitosamente:', data);
        setSuccess('Agente creado exitosamente');
        setOpenCreateDialog(false);
        resetForm();
        loadAgents();
      } else {
        setError(data.error || 'Error creando agente');
      }
    } catch (err) {
      setError('Error de conexión al crear agente');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAgent = async () => {
    if (!selectedAgent) return;

    setLoading(true);
    setError(null);
    try {
      // Usar el endpoint correcto para actualizar agentes
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${selectedAgent.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          is_active: formData.is_active
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Agente actualizado exitosamente');
        setOpenEditDialog(false);
        resetForm();
        loadAgents();
      } else {
        setError(data.error || 'Error actualizando agente');
      }
    } catch (err) {
      setError('Error de conexión al actualizar agente');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Usar el endpoint correcto para eliminar agentes
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Agente eliminado exitosamente');
        setOpenDeleteDialog(false);
        setAgentToDelete(null);
        loadAgents();
      } else {
        setError(data.error || 'Error eliminando agente');
      }
    } catch (err) {
      setError('Error de conexión al eliminar agente');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteConfirmation = (agent: Agent) => {
    setAgentToDelete(agent);
    setOpenDeleteDialog(true);
  };

  const handleUpdatePermissions = async () => {
    if (!selectedAgent) return;

    setLoading(true);
    setError(null);
    try {
      // Usar el endpoint correcto para actualizar permisos de agentes
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${selectedAgent.id}/permissions`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ permissions: agentPermissions })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Permisos actualizados exitosamente');
        setOpenPermissionsDialog(false);
        loadAgents();
      } else {
        setError(data.error || 'Error actualizando permisos');
      }
    } catch (err) {
      setError('Error de conexión al actualizar permisos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permissionId: number, field: string, value: boolean) => {
    setAgentPermissions(prev => 
      prev.map(perm => 
        perm.permission_id === permissionId 
          ? { ...perm, [field]: value }
          : perm
      )
    );
  };

  const handleSelectAllPermissions = (module: string, field: string, value: boolean) => {
    setAgentPermissions(prev =>
      prev.map(perm =>
        perm.module === module
          ? { ...perm, [field]: value }
          : perm
      )
    );
  };

  const openPermissions = async (agent: Agent) => {
    setSelectedAgent(agent);
    await loadAgentPermissions(agent.id);
    setOpenPermissionsDialog(true);
  };

  const openEdit = (agent: Agent) => {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      password: '',
      phone: agent.phone || '',
      is_active: agent.is_active
    });
    setOpenEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      is_active: true
    });
    setSelectedAgent(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success';
      case 'busy': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'En línea';
      case 'busy': return 'Ocupado';
      default: return 'Desconectado';
    }
  };

  // Agrupar permisos por módulo
  const permissionsByModule = agentPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {} as { [key: string]: Permission[] });

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon fontSize="large" />
            Gestión de Usuarios y Permisos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crea usuarios y asigna permisos específicos para cada módulo. Los usuarios inician sesión con email y contraseña.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Actualizar lista">
            <IconButton onClick={loadAgents} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenCreateDialog(true)}
          >
            Crear Usuario
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Agents Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Agente</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Permisos</TableCell>
                    <TableCell>Creado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: agent.is_active ? 'primary.main' : 'grey.400' }}>
                            {agent.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {agent.name}
                            </Typography>
                            {!agent.is_active && (
                              <Chip label="Inactivo" size="small" color="default" />
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{agent.email}</TableCell>
                      <TableCell>{agent.phone || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(agent.status)}
                          color={getStatusColor(agent.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${agent.total_permissions} permisos`}
                          size="small"
                          color="info"
                          icon={<VpnKeyIcon />}
                        />
                      </TableCell>
                      <TableCell>
                        {format(new Date(agent.created_at), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Gestionar permisos">
                          <IconButton
                            size="small"
                            onClick={() => openPermissions(agent)}
                            color="primary"
                          >
                            <SecurityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => openEdit(agent)}
                            color="info"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            onClick={() => openDeleteConfirmation(agent)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {agents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          No hay agentes registrados
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Agent Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear Nuevo Usuario / Agente</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Nombre completo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Contraseña"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              required
              helperText="El usuario usará esta contraseña para iniciar sesión"
            />
            <TextField
              label="Teléfono"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              helperText="Opcional - número de contacto del usuario"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Activo"
            />
            <Alert severity="info">
              <strong>Inicio de sesión:</strong> El usuario usará su email y contraseña en <strong>https://web.whats-flow.com/login</strong>
            </Alert>
            <Alert severity="warning">
              Después de crear el usuario, debes asignarle permisos para los módulos que podrá acceder.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancelar</Button>
          <Button onClick={handleCreateAgent} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Crear Usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Usuario</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Nombre completo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Nueva contraseña"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              helperText="Dejar vacío para mantener la contraseña actual"
            />
            <TextField
              label="Teléfono"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              helperText="Opcional"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Activo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button>
          <Button onClick={handleUpdateAgent} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Actualizar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog
        open={openPermissionsDialog}
        onClose={() => setOpenPermissionsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon />
            Gestionar Permisos - {selectedAgent?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {Object.keys(permissionsByModule).map((moduleName) => (
              <Accordion key={moduleName} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {moduleIcons[moduleName] || <SecurityIcon />}
                    <Typography variant="h6">
                      {moduleNames[moduleName] || moduleName}
                    </Typography>
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                      <Chip
                        label={`${permissionsByModule[moduleName].filter(p => p.can_view).length} permisos`}
                        size="small"
                        color="primary"
                      />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      onClick={() => handleSelectAllPermissions(moduleName, 'can_view', true)}
                    >
                      Seleccionar Ver Todo
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        handleSelectAllPermissions(moduleName, 'can_view', false);
                        handleSelectAllPermissions(moduleName, 'can_create', false);
                        handleSelectAllPermissions(moduleName, 'can_edit', false);
                        handleSelectAllPermissions(moduleName, 'can_delete', false);
                      }}
                    >
                      Desmarcar Todo
                    </Button>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Permiso</TableCell>
                          <TableCell align="center">Ver</TableCell>
                          <TableCell align="center">Crear</TableCell>
                          <TableCell align="center">Editar</TableCell>
                          <TableCell align="center">Eliminar</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {permissionsByModule[moduleName].map((perm) => (
                          <TableRow key={perm.permission_id}>
                            <TableCell>
                              <Typography variant="body2">{perm.description}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Checkbox
                                checked={perm.can_view}
                                onChange={(e) =>
                                  handlePermissionChange(perm.permission_id, 'can_view', e.target.checked)
                                }
                                color="primary"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Checkbox
                                checked={perm.can_create}
                                onChange={(e) =>
                                  handlePermissionChange(perm.permission_id, 'can_create', e.target.checked)
                                }
                                color="success"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Checkbox
                                checked={perm.can_edit}
                                onChange={(e) =>
                                  handlePermissionChange(perm.permission_id, 'can_edit', e.target.checked)
                                }
                                color="warning"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Checkbox
                                checked={perm.can_delete}
                                onChange={(e) =>
                                  handlePermissionChange(perm.permission_id, 'can_delete', e.target.checked)
                                }
                                color="error"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPermissionsDialog(false)}>Cancelar</Button>
          <Button onClick={handleUpdatePermissions} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Guardar Permisos'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={() => !loading && setOpenDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          bgcolor: 'error.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DeleteIcon />
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta acción no se puede deshacer
          </Alert>
          <Typography variant="body1" gutterBottom>
            ¿Estás seguro de eliminar este usuario?
          </Typography>
          {agentToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Usuario a eliminar:
              </Typography>
              <Typography variant="h6" sx={{ mt: 1 }}>
                {agentToDelete.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {agentToDelete.email}
              </Typography>
              <Chip 
                label={agentToDelete.role} 
                size="small" 
                color="primary" 
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setOpenDeleteDialog(false)}
            disabled={loading}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button 
            onClick={() => agentToDelete && handleDeleteAgent(agentToDelete.id)}
            disabled={loading}
            variant="contained"
            color="error"
            startIcon={loading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {loading ? 'Eliminando...' : 'Eliminar Usuario'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentPermissionsManager;
