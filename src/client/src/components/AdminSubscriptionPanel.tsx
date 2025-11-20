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
  plan_name: string;
  plan_display_name: string;
  duration_days: number;
  price: number;
  max_users: number;
  max_messages_per_month: number;
  max_campaigns: number;
  max_contacts: number;
}

interface ConnectionSession {
  sessionId: string;
  phoneNumber: string;
  isConnected: boolean;
  timestamp: string;
}

interface AdminSubscriptionPanelProps {
  sessionId: string;
  userPhone: string;
}

const AdminSubscriptionPanel: React.FC<AdminSubscriptionPanelProps> = ({ sessionId, userPhone }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [connections, setConnections] = useState<ConnectionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    planName: 'basic',
    days: 30,
    customEndDate: ''
  });

  // Plan form state
  const [planFormData, setPlanFormData] = useState({
    plan_name: '',
    plan_display_name: '',
    duration_days: 30,
    price: 0,
    max_users: 1,
    max_messages_per_month: 1000,
    max_campaigns: 10,
    max_contacts: 1000
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar planes
      const plansResponse = await fetch(`${getAPIBaseURL()}/api/subscriptions/plans`);
      const plansData = await plansResponse.json();
      
      if (plansData.success) {
        setPlans(plansData.plans);
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

      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/activate?phone=${userPhone}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          planName: formData.planName,
          days: formData.days,
          customEndDate: formData.customEndDate || undefined
        })
      });

      const data = await response.json();

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

  const handleDeactivateSubscription = async (user: User) => {
    if (!window.confirm(`¿Desactivar suscripción de ${user.name}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/deactivate?phone=${userPhone}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id
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
        plan_name: plan.plan_name,
        plan_display_name: plan.plan_display_name,
        duration_days: plan.duration_days,
        price: plan.price,
        max_users: plan.max_users,
        max_messages_per_month: plan.max_messages_per_month,
        max_campaigns: plan.max_campaigns,
        max_contacts: plan.max_contacts
      });
    } else {
      setSelectedPlan(null);
      setPlanFormData({
        plan_name: '',
        plan_display_name: '',
        duration_days: 30,
        price: 0,
        max_users: 1,
        max_messages_per_month: 1000,
        max_campaigns: 10,
        max_contacts: 1000
      });
    }
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = selectedPlan
        ? `${getAPIBaseURL()}/api/subscriptions/plans/${selectedPlan.id}?phone=${userPhone}`
        : `${getAPIBaseURL()}/api/subscriptions/plans?phone=${userPhone}`;

      const response = await fetch(url, {
        method: selectedPlan ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (!window.confirm(`¿Eliminar el plan ${plan.plan_display_name}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${getAPIBaseURL()}/api/subscriptions/plans/${plan.id}?phone=${userPhone}`, {
        method: 'DELETE'
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
          <Tab label={`Conexiones (${connections.length})`} />
        </Tabs>
      </Paper>

      {/* Tab: Usuarios */}
      {selectedTab === 0 && (
        <Card>
          <CardContent>
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
                  {users.map((user) => (
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
                                onClick={() => handleDeactivateSubscription(user)}
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
                  border: `2px solid ${getPlanColor(plan.plan_name)}`,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: getPlanColor(plan.plan_name) }}>
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
                        ✓ {plan.max_users === 999999 ? 'Usuarios ilimitados' : `Hasta ${plan.max_users} usuarios`}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ✓ {plan.max_messages_per_month === 999999 ? 'Mensajes ilimitados' : `${plan.max_messages_per_month.toLocaleString()} mensajes/mes`}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ✓ {plan.max_campaigns === 999999 ? 'Campañas ilimitadas' : `${plan.max_campaigns} campañas`}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        ✓ {plan.max_contacts === 999999 ? 'Contactos ilimitados' : `${plan.max_contacts.toLocaleString()} contactos`}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Tab: Conexiones */}
      {selectedTab === 2 && (
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
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nombre del Plan (ID)"
                  value={planFormData.plan_name}
                  onChange={(e) => setPlanFormData({ ...planFormData, plan_name: e.target.value })}
                  helperText="Identificador único (ej: premium, enterprise)"
                  disabled={!!selectedPlan}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nombre para Mostrar"
                  value={planFormData.plan_display_name}
                  onChange={(e) => setPlanFormData({ ...planFormData, plan_display_name: e.target.value })}
                  helperText="Nombre visible para usuarios"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Duración (días)"
                  type="number"
                  value={planFormData.duration_days}
                  onChange={(e) => setPlanFormData({ ...planFormData, duration_days: parseInt(e.target.value) || 0 })}
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
                    startAdornment: <Typography>$</Typography>
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Máximo de Usuarios"
                  type="number"
                  value={planFormData.max_users}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_users: parseInt(e.target.value) || 0 })}
                  helperText="999999 = ilimitado"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Mensajes por Mes"
                  type="number"
                  value={planFormData.max_messages_per_month}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_messages_per_month: parseInt(e.target.value) || 0 })}
                  helperText="999999 = ilimitado"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Máximo de Campañas"
                  type="number"
                  value={planFormData.max_campaigns}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_campaigns: parseInt(e.target.value) || 0 })}
                  helperText="999999 = ilimitado"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Máximo de Contactos"
                  type="number"
                  value={planFormData.max_contacts}
                  onChange={(e) => setPlanFormData({ ...planFormData, max_contacts: parseInt(e.target.value) || 0 })}
                  helperText="999999 = ilimitado"
                />
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
    </Box>
  );
};

export default AdminSubscriptionPanel;
