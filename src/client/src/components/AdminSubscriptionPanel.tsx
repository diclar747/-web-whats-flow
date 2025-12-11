import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  Tab,
  Tabs
} from '@mui/material';
import {
  AdminPanelSettings,
  Edit,
  Block,
  CheckCircle,
  History,
  Add,
  Refresh,
  Circle as CircleIcon
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/socketConfig';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_start_date: string;
  subscription_end_date: string;
  subscription_days: number;
  days_remaining: number;
  is_admin: boolean;
  plan_display_name: string;
  price: number;
}

interface Plan {
  id: number;
  name: string;
  plan_name?: string;
  plan_display_name?: string;
  description: string;
  price: number;
  duration_days?: number;
  modules: string[];
  max_agents: number;
  max_sessions: number;
  max_channels: number;
  max_messages: number;
  max_users?: number;
  max_messages_per_month?: number;
  max_campaigns?: number;
  max_integrations?: number;
  max_contacts?: number;
  bot_enabled: boolean;
  api_enabled: boolean;
}

interface ConnectionSession {
  sessionId: string;
  phoneNumber: string;
  isConnected: boolean;
  timestamp: string;
}

interface PlanRequest {
  id: number;
  phone_number: string;
  session_id: string;
  plan_id: number;
  plan_name: string;
  plan_display_name: string;
  plan_price: number;
  duration_days: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
}

interface AdminSubscriptionPanelProps {
  sessionId: string;
  userPhone: string;
}

const AdminSubscriptionPanel: React.FC<AdminSubscriptionPanelProps> = ({ userPhone }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [connections, setConnections] = useState<ConnectionSession[]>([]);
  const [planRequests, setPlanRequests] = useState<PlanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PlanRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState<User | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [requestToApprove, setRequestToApprove] = useState<PlanRequest | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    planName: 'basic',
    days: 30,
    customEndDate: ''
  });

  // Plan form state
  const [planFormData, setPlanFormData] = useState({
    name: '',
    plan_name: '',
    plan_display_name: '',
    description: '',
    price: 0,
    duration_days: 30,
    max_agents: 1,
    max_sessions: 1,
    max_channels: 1,
    max_messages: 1000,
    max_users: 1,
    max_messages_per_month: 1000,
    max_campaigns: 10,
    max_contacts: 1000,
    bot_enabled: false,
    api_enabled: false,
    modules: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar planes
      const plansResponse = await fetch(`${getAPIBaseURL()}/api/plans`);
      const plansData = await plansResponse.json();

      if (plansData.success) {
        setPlans(plansData.plans.map((p: any) => ({
          ...p,
          plan_name: p.name?.toLowerCase().replace(/\s+/g, '_') || 'basic', // Básico -> basico
          plan_display_name: p.name || 'Plan Básico',
          duration_days: 30, // Por defecto 30 días
          modules: typeof p.modules === 'string' ? JSON.parse(p.modules) : p.modules || []
        })));
        console.log(`[AdminSubscriptionPanel] Planes cargados:`, plansData.plans.length);
      }

      // Cargar usuarios (solo si es admin) - usar POST con phone en body para asegurar middleware
      try {
        const usersResponse = await fetch(`${getAPIBaseURL()}/api/subscriptions/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: userPhone })
        });
        const usersData = await usersResponse.json();
        if (usersResponse.ok && usersData.success) {
          setUsers(usersData.users);
        } else {
          setError(usersData.error || 'No tienes permisos de administrador');
        }
      } catch (err) {
        setError('Error al cargar usuarios. Verifica tus permisos de administrador.');
      }

      // Cargar sesiones activas (conexiones)
      try {
        const connResponse = await fetch(`${getAPIBaseURL()}/api/sessions/active`);
        const connData = await connResponse.json();
        if (connData.success && Array.isArray(connData.sessions)) {
          setConnections(connData.sessions);
        }
      } catch (err) {
        // No bloquear el panel por error de conexiones
        console.warn('Error al cargar conexiones activas:', err);
      }

      // Cargar solicitudes de planes
      try {
        const requestsResponse = await fetch(`${getAPIBaseURL()}/api/plan-requests?status=pending`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const requestsData = await requestsResponse.json();
        if (requestsData.success) {
          setPlanRequests(requestsData.requests || []);
          console.log(`[AdminSubscriptionPanel] Solicitudes cargadas:`, requestsData.requests?.length || 0);
        }
      } catch (err) {
        console.warn('Error al cargar solicitudes de planes:', err);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      planName: user.subscription_plan || 'basic',
      days: 30,
      customEndDate: ''
    });
    setDialogOpen(true);
  };

  const handleActivateSubscription = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      setError(null);

      // 🔴 USAR EL TELÉFONO DEL USUARIO SELECCIONADO, NO DEL ADMIN
      console.log(`[AdminSubscriptionPanel] Activando plan para usuario: ${selectedUser.phone}`);
      console.log(`[AdminSubscriptionPanel] Plan: ${formData.planName}, Días: ${formData.days}`);

      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/activate?phone=${selectedUser.phone}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: selectedUser.phone, // También en el body
          planType: formData.planName,
          days: formData.days,
          customEndDate: formData.customEndDate || undefined
        })
      });

      const data = await response.json();
      console.log(`[AdminSubscriptionPanel] Respuesta del servidor:`, data);

      if (data.success) {
        setSuccess('Suscripción activada exitosamente');
        setDialogOpen(false);
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al activar suscripción');
      }
    } catch (error) {
      console.error('Error activating subscription:', error);
      setError('Error al activar suscripción');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBlockDialog = (user: User) => {
    setUserToBlock(user);
    setBlockDialogOpen(true);
  };

  const handleDeactivateSubscription = async () => {
    if (!userToBlock) return;

    try {
      setLoading(true);
      setError(null);
      setBlockDialogOpen(false);

      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/deactivate?phone=${userPhone}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: userToBlock.phone
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Suscripción desactivada exitosamente');
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al desactivar suscripción');
      }
    } catch (error) {
      console.error('Error deactivating subscription:', error);
      setError('Error al desactivar suscripción');
    } finally {
      setLoading(false);
      setUserToBlock(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'trial': return 'info';
      case 'expired': return 'error';
      case 'inactive': return 'default';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  // Función para filtrar usuarios
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(search) ||
      user.phone?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search)
    );
  });

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise': return '#9c27b0';
      case 'professional': return '#2196f3';
      case 'basic': return '#4caf50';
      case 'free': return '#9e9e9e';
      default: return '#757575';
    }
  };

  const isUserOnline = (userPhone: string) => {
    return connections.some(conn => conn.phoneNumber === userPhone && conn.isConnected);
  };

  const handleOpenPlanDialog = (plan?: Plan) => {
    if (plan) {
      setSelectedPlan(plan);
      setPlanFormData({
        name: plan.name,
        plan_name: plan.plan_name || '',
        plan_display_name: plan.plan_display_name || '',
        description: plan.description,
        price: plan.price,
        duration_days: plan.duration_days || 30,
        max_agents: plan.max_agents,
        max_sessions: plan.max_sessions,
        max_channels: plan.max_channels,
        max_messages: plan.max_messages,
        max_users: plan.max_users || 1,
        max_messages_per_month: plan.max_messages_per_month || 1000,
        max_campaigns: plan.max_campaigns || 10,
        max_contacts: plan.max_contacts || 1000,
        bot_enabled: plan.bot_enabled,
        api_enabled: plan.api_enabled,
        modules: plan.modules || []
      });
    } else {
      setSelectedPlan(null);
      setPlanFormData({
        name: '',
        plan_name: '',
        plan_display_name: '',
        description: '',
        price: 0,
        duration_days: 30,
        max_agents: 1,
        max_sessions: 1,
        max_channels: 1,
        max_messages: 1000,
        max_users: 1,
        max_messages_per_month: 1000,
        max_campaigns: 10,
        max_contacts: 1000,
        bot_enabled: false,
        api_enabled: false,
        modules: []
      });
    }
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = selectedPlan
        ? `${getAPIBaseURL()}/api/plans/${selectedPlan.id}`
        : `${getAPIBaseURL()}/api/plans`;

      const response = await fetch(url, {
        method: selectedPlan ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(planFormData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(selectedPlan ? 'Plan actualizado exitosamente' : 'Plan creado exitosamente');
        setPlanDialogOpen(false);
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al guardar plan');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      setError('Error al guardar plan');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (plan: Plan) => {
    if (!window.confirm(`¿Eliminar el plan ${plan.name}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${getAPIBaseURL()}/api/plans/${plan.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Plan eliminado exitosamente');
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al eliminar plan');
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      setError('Error al eliminar plan');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApproveDialog = (request: PlanRequest) => {
    setRequestToApprove(request);
    setApproveDialogOpen(true);
  };

  const handleApproveRequest = async () => {
    if (!requestToApprove) return;

    try {
      setLoading(true);
      setError(null);
      setApproveDialogOpen(false);

      const response = await fetch(`${getAPIBaseURL()}/api/plan-requests/${requestToApprove.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ adminPhone: userPhone })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Solicitud aprobada y plan activado exitosamente');
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al aprobar solicitud');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      setError('Error al aprobar solicitud');
    } finally {
      setLoading(false);
      setRequestToApprove(null);
    }
  };

  const handleOpenRejectDialog = (request: PlanRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${getAPIBaseURL()}/api/plan-requests/${selectedRequest.id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reason: rejectionReason,
          adminPhone: userPhone
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Solicitud rechazada');
        setRejectDialogOpen(false);
        loadData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al rechazar solicitud');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      setError('Error al rechazar solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && users.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Card sx={{
        mb: 3,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                <AdminPanelSettings sx={{ mr: 1, verticalAlign: 'middle' }} />
                Panel de Administrador
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Gestión de suscripciones y planes de usuarios
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={loadData}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
            >
              Actualizar
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Alerts */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)}>
          <Tab label={`Usuarios (${users.length})`} />
          <Tab label={`Planes (${plans.length})`} />
          <Tab label={`Solicitudes (${planRequests.length})`} />
          <Tab label={`Conexiones (${connections.length})`} />
        </Tabs>
      </Paper>

      {/* Tab: Usuarios */}
      {selectedTab === 0 && (
        <Card>
          <CardContent>
            {/* Buscador */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Buscar por usuario o número de teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.paper'
                  }
                }}
              />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Usuario</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>En Línea</TableCell>
                    <TableCell>Inicio</TableCell>
                    <TableCell>Vencimiento</TableCell>
                    <TableCell>Días Restantes</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {user.name}
                            {user.is_admin && (
                              <Chip
                                label="ADMIN"
                                size="small"
                                color="error"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {user.email}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.plan_display_name || user.subscription_plan}
                          size="small"
                          sx={{
                            bgcolor: `${getPlanColor(user.subscription_plan)}20`,
                            color: getPlanColor(user.subscription_plan),
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.subscription_status}
                          size="small"
                          color={getStatusColor(user.subscription_status) as any}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CircleIcon
                            sx={{
                              fontSize: 12,
                              color: isUserOnline(user.phone) ? '#4caf50' : '#9e9e9e'
                            }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {isUserOnline(user.phone) ? 'En línea' : 'Desconectado'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {user.subscription_start_date
                          ? new Date(user.subscription_start_date).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {user.subscription_end_date
                          ? new Date(user.subscription_end_date).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            color: user.days_remaining < 7 ? '#f44336' : user.days_remaining < 15 ? '#ff9800' : '#4caf50',
                            fontWeight: 600
                          }}
                        >
                          {user.days_remaining > 0 ? `${user.days_remaining} días` : 'Expirado'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Activar/Renovar">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenDialog(user)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          {user.subscription_status === 'active' && (
                            <Tooltip title="Desactivar">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleOpenBlockDialog(user)}
                              >
                                <Block />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab: Planes */}
      {selectedTab === 1 && (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenPlanDialog()}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #5568d3 0%, #653a8b 100%)' }
              }}
            >
              Crear Nuevo Plan
            </Button>
          </Box>
          <Grid container spacing={3}>
            {plans.map((plan) => (
              <Grid item xs={12} md={6} lg={3} key={plan.id}>
                <Card sx={{
                  height: '100%',
                  border: `2px solid ${getPlanColor(plan.plan_name || plan.name)}`,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: getPlanColor(plan.plan_name || plan.name) }}>
                        {plan.plan_display_name}
                      </Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleOpenPlanDialog(plan)} color="primary">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeletePlan(plan)} color="error">
                          <Block fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                      ${plan.price}
                      <Typography component="span" variant="body2" sx={{ color: '#64748b' }}>
                        /{plan.duration_days} días
                      </Typography>
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="textSecondary">
                        ✓ {(plan.max_users || 0) === 999999 ? 'Usuarios ilimitados' : `Hasta ${plan.max_users || 0} usuarios`}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ✓ {(plan.max_messages_per_month || 0) === 999999 ? 'Mensajes ilimitados' : `${(plan.max_messages_per_month || 0).toLocaleString()} mensajes/mes`}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ✓ {(plan.max_campaigns || 0) === 999999 ? 'Campañas ilimitadas' : `${plan.max_campaigns || 0} campañas`}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ✓ {(plan.max_contacts || 0) === 999999 ? 'Contactos ilimitados' : `${(plan.max_contacts || 0).toLocaleString()} contactos`}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Tab: Solicitudes de Planes */}
      {selectedTab === 2 && (
        <Card>
          <CardContent>
            {planRequests.length === 0 ? (
              <Alert severity="info">No hay solicitudes pendientes en este momento.</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Teléfono</TableCell>
                      <TableCell>Plan Solicitado</TableCell>
                      <TableCell>Precio</TableCell>
                      <TableCell>Duración</TableCell>
                      <TableCell>Fecha Solicitud</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {planRequests.map((request) => (
                      <TableRow key={request.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {request.phone_number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={request.plan_display_name || request.plan_name}
                            size="small"
                            sx={{
                              bgcolor: '#667eea20',
                              color: '#667eea',
                              fontWeight: 600
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Gs. {request.plan_price.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>{request.duration_days} días</TableCell>
                        <TableCell>
                          {new Date(request.requested_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                            size="small"
                            color={request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="Aprobar">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleOpenApproveDialog(request)}
                                >
                                  <CheckCircle />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Rechazar">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleOpenRejectDialog(request)}
                                >
                                  <Block />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                          {request.status !== 'pending' && (
                            <Typography variant="caption" color="textSecondary">
                              {request.status === 'approved' ? 'Aprobada' : `Rechazada: ${request.rejection_reason || 'Sin motivo'}`}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Conexiones */}
      {selectedTab === 3 && (
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Session ID</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Último Registro</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {connections.map((c) => (
                    <TableRow key={`${c.sessionId}-${c.timestamp}`} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.phoneNumber || '-'}</Typography>
                      </TableCell>
                      <TableCell>{c.sessionId}</TableCell>
                      <TableCell>
                        <Chip
                          label={c.isConnected ? 'Conectado' : 'Desconectado'}
                          size="small"
                          color={c.isConnected ? 'success' as any : 'default' as any}
                        />
                      </TableCell>
                      <TableCell>
                        {c.timestamp ? new Date(c.timestamp).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {connections.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Alert severity="info">No hay conexiones activas en este momento.</Alert>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Dialog para crear/editar plan */}
      <Dialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedPlan ? 'Editar Plan' : 'Crear Nuevo Plan'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre del Plan"
                  value={planFormData.name}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  helperText="Nombre del plan (ej: Básico, Estándar, Premium)"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descripción"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  multiline
                  rows={2}
                  helperText="Descripción del plan"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Precio"
                  type="number"
                  value={planFormData.price}
                  onChange={(e) => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) || 0 })}
                  InputProps={{
                    startAdornment: <Typography>Gs. </Typography>
                  }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Máximo de Agentes"
                  type="number"
                  value={planFormData.max_agents}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_agents: parseInt(e.target.value) || 0 })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Máximo de Sesiones"
                  type="number"
                  value={planFormData.max_sessions}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_sessions: parseInt(e.target.value) || 0 })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Máximo de Canales"
                  type="number"
                  value={planFormData.max_channels}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_channels: parseInt(e.target.value) || 0 })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Mensajes por Mes"
                  type="number"
                  value={planFormData.max_messages}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_messages: parseInt(e.target.value) || 0 })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>BOT IA</InputLabel>
                  <Select
                    value={planFormData.bot_enabled ? 'true' : 'false'}
                    onChange={(e) => setPlanFormData({ ...planFormData, bot_enabled: e.target.value === 'true' })}
                    label="BOT IA"
                  >
                    <MenuItem value="true">Habilitado</MenuItem>
                    <MenuItem value="false">Deshabilitado</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>API REST</InputLabel>
                  <Select
                    value={planFormData.api_enabled ? 'true' : 'false'}
                    onChange={(e) => setPlanFormData({ ...planFormData, api_enabled: e.target.value === 'true' })}
                    label="API REST"
                  >
                    <MenuItem value="true">Habilitada</MenuItem>
                    <MenuItem value="false">Deshabilitada</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePlan}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <CheckCircle />}
          >
            {loading ? 'Guardando...' : (selectedPlan ? 'Actualizar Plan' : 'Crear Plan')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para activar/renovar suscripción */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Activar/Renovar Suscripción
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body1" sx={{ mb: 3 }}>
                <strong>Usuario:</strong> {selectedUser.name} ({selectedUser.phone})
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Plan</InputLabel>
                    <Select
                      value={formData.planName}
                      onChange={(e) => {
                        const plan = plans.find(p => p.plan_name === e.target.value);
                        setFormData({
                          ...formData,
                          planName: e.target.value,
                          days: plan?.duration_days || 30
                        });
                      }}
                      label="Plan"
                    >
                      {plans.map((plan) => (
                        <MenuItem key={plan.id} value={plan.plan_name}>
                          {plan.plan_display_name} - ${plan.price}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Días de duración"
                    type="number"
                    value={formData.days}
                    onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 0 })}
                    helperText="Número de días que durará la suscripción"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Fecha de vencimiento personalizada (opcional)"
                    type="date"
                    value={formData.customEndDate}
                    onChange={(e) => setFormData({ ...formData, customEndDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    helperText="Si se especifica, se usará esta fecha en lugar de calcular por días"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Alert severity="info">
                    {formData.customEndDate
                      ? `La suscripción vencerá el ${new Date(formData.customEndDate).toLocaleDateString()}`
                      : `La suscripción durará ${formData.days} días desde hoy`
                    }
                  </Alert>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleActivateSubscription}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <CheckCircle />}
          >
            {loading ? 'Activando...' : 'Activar Suscripción'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para rechazar solicitud */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Rechazar Solicitud
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body1" sx={{ mb: 3 }}>
                <strong>Usuario:</strong> {selectedRequest.phone_number}
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                <strong>Plan:</strong> {selectedRequest.plan_display_name || selectedRequest.plan_name}
              </Typography>

              <TextField
                fullWidth
                label="Motivo del rechazo"
                multiline
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                helperText="Explica por qué se rechaza esta solicitud"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectRequest}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Block />}
          >
            {loading ? 'Rechazando...' : 'Rechazar Solicitud'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de confirmación de aprobación */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: 'white',
            borderRadius: 3,
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }
        }}
      >
        <DialogTitle sx={{
          color: 'white',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <CheckCircle sx={{ color: '#4caf50' }} />
          Confirmar Aprobación
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 3 }}>
            <Alert
              severity="success"
              sx={{
                mb: 3,
                bgcolor: 'rgba(76, 175, 80, 0.2)',
                color: 'white',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                '& .MuiAlert-icon': {
                  color: '#4caf50'
                }
              }}
            >
              Esta acción activará el plan solicitado
            </Alert>

            <Box sx={{
              p: 3,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)',
              mb: 2
            }}>
              <Typography variant="body1" sx={{ color: 'white', mb: 2, fontSize: '1.1rem' }}>
                ¿Aprobar solicitud de <strong>{requestToApprove?.phone_number}</strong> para el plan <strong>{requestToApprove?.plan_display_name || requestToApprove?.plan_name}</strong>?
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                • El plan será activado inmediatamente
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                • Duración: {requestToApprove?.duration_days} días
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                • Precio: Gs. {requestToApprove?.plan_price.toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button
            onClick={() => setApproveDialogOpen(false)}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApproveRequest}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <CheckCircle />}
            sx={{
              background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #388e3c 0%, #4caf50 100%)'
              }
            }}
          >
            {loading ? 'Aprobando...' : 'Sí, Aprobar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de confirmación de bloqueo */}
      <Dialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: 'white',
            borderRadius: 3,
            border: '1px solid rgba(244, 67, 54, 0.3)'
          }
        }}
      >
        <DialogTitle sx={{
          color: 'white',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Block sx={{ color: '#f44336' }} />
          Confirmar Desactivación
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 3 }}>
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                bgcolor: 'rgba(255, 152, 0, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 152, 0, 0.4)',
                '& .MuiAlert-icon': {
                  color: '#ff9800'
                }
              }}
            >
              Esta acción desactivará la suscripción del usuario
            </Alert>

            <Box sx={{
              p: 3,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)',
              mb: 2
            }}>
              <Typography variant="body1" sx={{ color: 'white', mb: 2, fontSize: '1.1rem' }}>
                ¿Desactivar suscripción de <strong>{userToBlock?.phone}</strong>?
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                • El usuario perderá acceso al sistema
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                • No podrá iniciar sesión hasta reactivar su plan
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                • Sus datos se mantendrán guardados
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button
            onClick={() => setBlockDialogOpen(false)}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeactivateSubscription}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Block />}
            sx={{
              background: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d32f2f 0%, #c2185b 100%)'
              }
            }}
          >
            {loading ? 'Desactivando...' : 'Sí, Desactivar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminSubscriptionPanel;
