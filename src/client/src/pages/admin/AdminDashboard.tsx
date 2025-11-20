import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar
} from '@mui/material';
import {
  AdminPanelSettings,
  People,
  Subscriptions,
  Add,
  Edit,
  Delete,
  Block,
  CheckCircle,
  Logout,
  Business,
  TrendingUp
} from '@mui/icons-material';
import { getAPIBaseURL } from '../../utils/socketConfig';

interface AdminDashboardProps {
  onLogout: () => void;
  admin: any;
  adminToken: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, admin, adminToken }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [agents, setAgents] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Agent Dialog States
  const [agentDialog, setAgentDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [agentForm, setAgentForm] = useState({
    name: '',
    email: '',
    phone: '',
    sessionId: '',
    maxConcurrentChats: 10
  });

  // Subscription Dialog States
  const [subscriptionDialog, setSubscriptionDialog] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    sessionId: '',
    planType: 'basic',
    days: 30,
    maxCampaigns: 10,
    maxContacts: 1000,
    notes: ''
  });

  useEffect(() => {
    if (currentTab === 0) {
      loadAgents();
    } else if (currentTab === 1) {
      loadSubscriptions();
    }
  }, [currentTab]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Obtener sessionId actual del usuario
      const sessionId = sessionStorage.getItem('whatsflow_session');
      const url = sessionId 
        ? `${getAPIBaseURL()}/api/agents?sessionId=${sessionId}`
        : `${getAPIBaseURL()}/api/agents`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setAgents(data.agents || []);
      } else {
        setError(data.error || 'Error cargando agentes');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSubscriptions(data.subscriptions || []);
      } else {
        setError(data.error || 'Error cargando suscripciones');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (currentTab === 0) {
      loadAgents();
    } else if (currentTab === 1) {
      loadSubscriptions();
    }
  }, [currentTab, loadAgents, loadSubscriptions]);

  const handleCreateAgent = async () => {
    try {
      // Obtener sessionId actual del usuario
      const sessionId = sessionStorage.getItem('whatsflow_session');
      const agentData = {
        ...agentForm,
        sessionId: sessionId // Asociar agente a la sesión actual
      };
      
      const response = await fetch(`${getAPIBaseURL()}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(agentData)
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Agente creado exitosamente');
        setAgentDialog(false);
        resetAgentForm();
        loadAgents();
      } else {
        setError(data.error || 'Error creando agente');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleUpdateAgent = async () => {
    if (!editingAgent) return;
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${editingAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(agentForm)
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Agente actualizado exitosamente');
        setAgentDialog(false);
        setEditingAgent(null);
        resetAgentForm();
        loadAgents();
      } else {
        setError(data.error || 'Error actualizando agente');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este agente?')) return;
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Agente eliminado exitosamente');
        loadAgents();
      } else {
        setError(data.error || 'Error eliminando agente');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleActivateSubscription = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          ...subscriptionForm,
          features: {
            campaigns: true,
            kanban: true,
            agents: subscriptionForm.planType !== 'free'
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Plan activado exitosamente hasta ${data.endDate}`);
        setSubscriptionDialog(false);
        resetSubscriptionForm();
        loadSubscriptions();
      } else {
        setError(data.error || 'Error activando suscripción');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleDeactivateSubscription = async (sessionId: string) => {
    if (!window.confirm('¿Estás seguro de desactivar este usuario?')) return;
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sessionId,
          reason: 'Desactivado por administrador'
        })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Usuario desactivado exitosamente');
        loadSubscriptions();
      } else {
        setError(data.error || 'Error desactivando usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleDeleteSubscription = async (subscriptionId: number) => {
    if (!window.confirm('¿Estás seguro de eliminar esta suscripción? Esta acción no se puede deshacer.')) return;
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Suscripción eliminada exitosamente');
        loadSubscriptions();
      } else {
        setError(data.error || 'Error eliminando suscripción');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const openEditAgent = (agent: any) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      email: agent.email || '',
      phone: agent.phone || '',
      sessionId: agent.session_id,
      maxConcurrentChats: agent.max_concurrent_chats || 10
    });
    setAgentDialog(true);
  };

  const resetAgentForm = () => {
    setAgentForm({
      name: '',
      email: '',
      phone: '',
      sessionId: '',
      maxConcurrentChats: 10
    });
    setEditingAgent(null);
  };

  const resetSubscriptionForm = () => {
    setSubscriptionForm({
      sessionId: '',
      planType: 'basic',
      days: 30,
      maxCampaigns: 10,
      maxContacts: 1000,
      notes: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'busy': return 'warning';
      case 'away': return 'info';
      case 'offline': return 'default';
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'suspended': return 'error';
      case 'expired': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#667eea' }}>
        <Toolbar>
          <AdminPanelSettings sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Panel de Administración - WhatsFlow
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">
              {admin.name} ({admin.role})
            </Typography>
            <Button
              color="inherit"
              startIcon={<Logout />}
              onClick={onLogout}
              sx={{ textTransform: 'none' }}
            >
              Cerrar Sesión
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <People sx={{ fontSize: 40, color: '#667eea' }} />
                  <Box>
                    <Typography variant="h4">{agents.length}</Typography>
                    <Typography color="textSecondary">Agentes</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Subscriptions sx={{ fontSize: 40, color: '#00a884' }} />
                  <Box>
                    <Typography variant="h4">{subscriptions.length}</Typography>
                    <Typography color="textSecondary">Suscripciones</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircle sx={{ fontSize: 40, color: '#16a34a' }} />
                  <Box>
                    <Typography variant="h4">
                      {subscriptions.filter(s => s.status === 'active').length}
                    </Typography>
                    <Typography color="textSecondary">Activas</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TrendingUp sx={{ fontSize: 40, color: '#d97706' }} />
                  <Box>
                    <Typography variant="h4">
                      {agents.filter(a => a.status === 'available').length}
                    </Typography>
                    <Typography color="textSecondary">Disponibles</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ borderRadius: 2 }}>
          <Tabs
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<People />} label="Agentes / Usuarios" iconPosition="start" />
            <Tab icon={<Subscriptions />} label="Suscripciones" iconPosition="start" />
          </Tabs>

          {/* Tab Panel 1: Agentes */}
          <TabPanel value={currentTab} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">Gestión de Agentes</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  resetAgentForm();
                  setAgentDialog(true);
                }}
                sx={{ bgcolor: '#667eea' }}
              >
                Nuevo Agente
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Teléfono</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Chats Activos</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>{agent.name}</TableCell>
                        <TableCell>{agent.email || '-'}</TableCell>
                        <TableCell>{agent.phone || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={agent.status}
                            color={getStatusColor(agent.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {agent.current_chats || 0} / {agent.max_concurrent_chats}
                        </TableCell>
                        <TableCell>
                          <IconButton onClick={() => openEditAgent(agent)} size="small">
                            <Edit />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteAgent(agent.id)}
                            size="small"
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {agents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No hay agentes registrados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Tab Panel 2: Suscripciones */}
          <TabPanel value={currentTab} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">Gestión de Suscripciones</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  resetSubscriptionForm();
                  setSubscriptionDialog(true);
                }}
                sx={{ bgcolor: '#00a884' }}
              >
                Activar Plan
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Session ID</TableCell>
                      <TableCell>Plan</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Fecha Inicio</TableCell>
                      <TableCell>Fecha Fin</TableCell>
                      <TableCell>Días Otorgados</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>{sub.session_id}</TableCell>
                        <TableCell>
                          <Chip label={sub.plan_type} size="small" color="primary" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={sub.status}
                            color={getStatusColor(sub.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(sub.start_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(sub.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{sub.days_granted} días</TableCell>
                        <TableCell>
                          {sub.status === 'active' && (
                            <IconButton
                              onClick={() => handleDeactivateSubscription(sub.session_id)}
                              size="small"
                              color="error"
                            >
                              <Block />
                            </IconButton>
                          )}
                          <IconButton
                            onClick={() => handleDeleteSubscription(sub.id)}
                            size="small"
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {subscriptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No hay suscripciones registradas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </Paper>
      </Container>

      {/* Agent Dialog */}
      <Dialog open={agentDialog} onClose={() => setAgentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAgent ? 'Editar Agente' : 'Nuevo Agente'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Nombre"
              value={agentForm.name}
              onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={agentForm.email}
              onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Teléfono"
              value={agentForm.phone}
              onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
              fullWidth
            />
            <TextField
              label="Session ID (Número de WhatsApp del negocio)"
              value={agentForm.sessionId}
              onChange={(e) => setAgentForm({ ...agentForm, sessionId: e.target.value })}
              fullWidth
              required
              disabled={!!editingAgent}
            />
            <TextField
              label="Máximo de Chats Concurrentes"
              type="number"
              value={agentForm.maxConcurrentChats}
              onChange={(e) => setAgentForm({ ...agentForm, maxConcurrentChats: parseInt(e.target.value) })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgentDialog(false)}>Cancelar</Button>
          <Button
            onClick={editingAgent ? handleUpdateAgent : handleCreateAgent}
            variant="contained"
            disabled={!agentForm.name || !agentForm.sessionId}
          >
            {editingAgent ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Subscription Dialog */}
      <Dialog open={subscriptionDialog} onClose={() => setSubscriptionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Activar Plan de Suscripción</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Session ID (Número de WhatsApp)"
              value={subscriptionForm.sessionId}
              onChange={(e) => setSubscriptionForm({ ...subscriptionForm, sessionId: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Tipo de Plan</InputLabel>
              <Select
                value={subscriptionForm.planType}
                onChange={(e) => setSubscriptionForm({ ...subscriptionForm, planType: e.target.value })}
                label="Tipo de Plan"
              >
                <MenuItem value="free">Gratis</MenuItem>
                <MenuItem value="basic">Básico</MenuItem>
                <MenuItem value="pro">Pro</MenuItem>
                <MenuItem value="enterprise">Enterprise</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Días de Duración"
              type="number"
              value={subscriptionForm.days}
              onChange={(e) => setSubscriptionForm({ ...subscriptionForm, days: parseInt(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Máximo de Campañas"
              type="number"
              value={subscriptionForm.maxCampaigns}
              onChange={(e) => setSubscriptionForm({ ...subscriptionForm, maxCampaigns: parseInt(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Máximo de Contactos"
              type="number"
              value={subscriptionForm.maxContacts}
              onChange={(e) => setSubscriptionForm({ ...subscriptionForm, maxContacts: parseInt(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Notas"
              multiline
              rows={3}
              value={subscriptionForm.notes}
              onChange={(e) => setSubscriptionForm({ ...subscriptionForm, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubscriptionDialog(false)}>Cancelar</Button>
          <Button
            onClick={handleActivateSubscription}
            variant="contained"
            disabled={!subscriptionForm.sessionId}
          >
            Activar Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;
