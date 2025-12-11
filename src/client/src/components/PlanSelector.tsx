import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton
} from '@mui/material';
import {
  CheckCircle,
  Star,
  Info,
  Close
} from '@mui/icons-material';
import { getAPIBaseURL } from '../utils/socketConfig';

interface Plan {
  id: number;
  name: string;
  description: string;
  price: number;
  modules: string[];
  max_agents: number;
  max_sessions: number;
  max_channels: number;
  max_messages: number;
  bot_enabled: boolean;
  api_enabled: boolean;
}

interface PlanRequest {
  id: number;
  phone_number: string;
  plan_id: number;
  plan_name: string;
  plan_price: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  rejection_reason: string | null;
}

interface PlanSelectorProps {
  userPhone: string;
}

const PlanSelector: React.FC<PlanSelectorProps> = ({ userPhone }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [myRequest, setMyRequest] = useState<PlanRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ amount: number; alias: string; bank: string } | null>(null);

  useEffect(() => {
    if (userPhone) {
      loadData();
    }
  }, [userPhone]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[PlanSelector] Loading data for phone:', userPhone);

      // Cargar planes
      const plansResponse = await fetch(`${getAPIBaseURL()}/api/plans`);
      const plansData = await plansResponse.json();

      if (plansData.success) {
        setPlans(plansData.plans);
        console.log('[PlanSelector] Planes cargados:', plansData.plans.length);
      }

      // Cargar mi solicitud
      const requestResponse = await fetch(`${getAPIBaseURL()}/api/plan-requests/my-request?phone=${userPhone}`);
      const requestData = await requestResponse.json();

      console.log('[PlanSelector] Request data:', requestData);

      if (requestData.success) {
        // Siempre actualizar el estado, incluso si request es null
        setMyRequest(requestData.request || null);
        console.log('[PlanSelector] Mi solicitud:', requestData.request);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan: Plan) => {
    console.log('[PlanSelector] Opening dialog for plan:', plan);
    setSelectedPlan(plan);
    setDialogOpen(true);
    console.log('[PlanSelector] Dialog state set to true');
  };

  const handleRequestPlan = async () => {
    if (!selectedPlan) return;

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`${getAPIBaseURL()}/api/plan-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: userPhone,
          planId: selectedPlan.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Solicitud enviada exitosamente. ${data.paymentInfo ? `Por favor deposita Gs. ${data.paymentInfo.amount.toLocaleString()} al alias ${data.paymentInfo.alias} - ${data.paymentInfo.bank}` : ''}`);
        setDialogOpen(false);
        
        // Mostrar dialog elegante con información de pago
        if (data.paymentInfo) {
          setPaymentInfo(data.paymentInfo);
          setPaymentDialogOpen(true);
        }
        
        loadData();
      } else {
        setError(data.error || 'Error al solicitar plan');
      }
    } catch (error) {
      console.error('Error requesting plan:', error);
      setError('Error al solicitar plan');
    } finally {
      setSubmitting(false);
    }
  };

  const getPlanColor = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('premium') || name.includes('enterprise')) return '#9c27b0';
    if (name.includes('professional') || name.includes('pro')) return '#2196f3';
    if (name.includes('basic') || name.includes('basico') || name.includes('estandar')) return '#4caf50';
    return '#757575';
  };

  if (loading && plans.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  console.log('[PlanSelector] Rendering with myRequest:', myRequest);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
          Selecciona tu Plan
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Elige el plan que mejor se adapte a tus necesidades
        </Typography>
      </Box>

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

      {/* Solicitud pendiente */}
      {myRequest && (
        <Alert
          severity={myRequest.status === 'pending' ? 'info' : myRequest.status === 'approved' ? 'success' : 'warning'}
          sx={{ mb: 3 }}
        >
          {myRequest.status === 'pending' && (
            <>
              <strong>Solicitud Pendiente:</strong> Tienes una solicitud pendiente para el plan {myRequest.plan_name}.
              El administrador la revisará pronto.
            </>
          )}
          {myRequest.status === 'approved' && (
            <>
              <strong>Solicitud Aprobada:</strong> Tu plan {myRequest.plan_name} ha sido activado.
            </>
          )}
          {myRequest.status === 'rejected' && (
            <>
              <strong>Solicitud Rechazada:</strong> Tu solicitud fue rechazada.
              {myRequest.rejection_reason && ` Motivo: ${myRequest.rejection_reason}`}
            </>
          )}
        </Alert>
      )}

      {/* Planes */}
      <Grid container spacing={3}>
        {plans.map((plan) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={plan.id}>
            <Card sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              border: `2px solid ${getPlanColor(plan.name)}`,
              borderRadius: 2,
              transition: 'all 0.3s',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: `0 12px 24px ${getPlanColor(plan.name)}40`
              }
            }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Star sx={{ fontSize: 48, color: getPlanColor(plan.name), mb: 1 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700, color: getPlanColor(plan.name), mb: 1 }}>
                    {plan.name}
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: getPlanColor(plan.name) }}>
                    Gs. {plan.price.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    /mes
                  </Typography>
                </Box>

                <Box sx={{ flexGrow: 1, mb: 2 }}>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckCircle sx={{ color: getPlanColor(plan.name), fontSize: 20 }} /></ListItemIcon>
                      <ListItemText primary={`${plan.max_agents} agentes`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle sx={{ color: getPlanColor(plan.name), fontSize: 20 }} /></ListItemIcon>
                      <ListItemText primary={`${plan.max_sessions} sesiones`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle sx={{ color: getPlanColor(plan.name), fontSize: 20 }} /></ListItemIcon>
                      <ListItemText primary={`${plan.max_channels} canales`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle sx={{ color: getPlanColor(plan.name), fontSize: 20 }} /></ListItemIcon>
                      <ListItemText primary={`${plan.max_messages.toLocaleString()} mensajes/mes`} />
                    </ListItem>
                    {plan.bot_enabled && (
                      <ListItem>
                        <ListItemIcon><CheckCircle sx={{ color: getPlanColor(plan.name), fontSize: 20 }} /></ListItemIcon>
                        <ListItemText primary="Bot IA incluido" />
                      </ListItem>
                    )}
                    {plan.api_enabled && (
                      <ListItem>
                        <ListItemIcon><CheckCircle sx={{ color: getPlanColor(plan.name), fontSize: 20 }} /></ListItemIcon>
                        <ListItemText primary="API REST" />
                      </ListItem>
                    )}
                  </List>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    console.log('[PlanSelector] Button clicked for plan:', plan.name);
                    console.log('[PlanSelector] myRequest:', myRequest);
                    handleOpenDialog(plan);
                  }}
                  disabled={myRequest?.status === 'pending' && myRequest?.plan_id === plan.id}
                  sx={{
                    background: `linear-gradient(135deg, ${getPlanColor(plan.name)} 0%, ${getPlanColor(plan.name)}dd 100%)`,
                    color: 'white !important',
                    fontWeight: 600,
                    fontSize: '14px',
                    '&:hover': {
                      background: `linear-gradient(135deg, ${getPlanColor(plan.name)}dd 0%, ${getPlanColor(plan.name)}bb 100%)`
                    },
                    '&.Mui-disabled': {
                      background: `linear-gradient(135deg, ${getPlanColor(plan.name)}88 0%, ${getPlanColor(plan.name)}66 100%)`,
                      color: 'white !important',
                      opacity: 0.8
                    }
                  }}
                >
                  {(myRequest?.status === 'pending' && myRequest?.plan_id === plan.id) ? 'Solicitud Pendiente' : 'Solicitar Plan'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {plans.length === 0 && !loading && (
        <Alert severity="info">
          No hay planes disponibles en este momento. Por favor contacta al administrador.
        </Alert>
      )}

      {/* Dialog de confirmación */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: 'white',
            borderRadius: 3,
            border: '1px solid rgba(102, 126, 234, 0.3)'
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          💎 Confirmar Solicitud de Plan
        </DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <Box sx={{ pt: 2 }}>
              <Alert
                severity="info"
                icon={<Info />}
                sx={{
                  mb: 3,
                  bgcolor: 'rgba(102, 126, 234, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(102, 126, 234, 0.4)',
                  '& .MuiAlert-icon': {
                    color: '#667eea'
                  }
                }}
              >
                📱 Al confirmar, recibirás las instrucciones de pago por WhatsApp
              </Alert>

              <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'white' }}>
                {selectedPlan.name}
              </Typography>

              <Typography variant="h3" sx={{ fontWeight: 700, color: '#667eea', mb: 1 }}>
                Gs. {selectedPlan.price.toLocaleString()}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                por mes
              </Typography>

              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 3 }}>
                {selectedPlan.description}
              </Typography>

              <Box sx={{
                bgcolor: 'rgba(255,255,255,0.05)',
                p: 2.5,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 2, color: '#667eea' }}>
                  ✨ Incluye:
                </Typography>
                <List dense>
                  <ListItem sx={{ color: 'white' }}>
                    <ListItemIcon><CheckCircle sx={{ fontSize: 20, color: '#4ade80' }} /></ListItemIcon>
                    <ListItemText primary={`${selectedPlan.max_agents} agentes`} />
                  </ListItem>
                  <ListItem sx={{ color: 'white' }}>
                    <ListItemIcon><CheckCircle sx={{ fontSize: 20, color: '#4ade80' }} /></ListItemIcon>
                    <ListItemText primary={`${selectedPlan.max_sessions} sesiones simultáneas`} />
                  </ListItem>
                  <ListItem sx={{ color: 'white' }}>
                    <ListItemIcon><CheckCircle sx={{ fontSize: 20, color: '#4ade80' }} /></ListItemIcon>
                    <ListItemText primary={`${selectedPlan.max_messages.toLocaleString()} mensajes por mes`} />
                  </ListItem>
                </List>
              </Box>

              <Box sx={{
                mt: 3,
                p: 2.5,
                bgcolor: 'rgba(102, 126, 234, 0.15)',
                borderRadius: 2,
                border: '1px solid rgba(102, 126, 234, 0.3)'
              }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#667eea', mb: 1.5 }}>
                  💳 Instrucciones de Pago:
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>
                  • Realiza tu depósito de <strong>Gs. {selectedPlan.price.toLocaleString()}</strong>
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mb: 1 }}>
                  • Al <strong>Alias: 3626142</strong> - Banco UENO
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  • Guarda tu comprobante de pago
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleRequestPlan}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <CheckCircle />}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #66428a 100%)'
              }
            }}
          >
            {submitting ? 'Enviando...' : 'Confirmar Solicitud'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmación de pago */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
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
        <DialogTitle sx={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle sx={{ color: '#4ade80', fontSize: 28 }} />
            <span>Solicitud Enviada</span>
          </Box>
          <IconButton
            onClick={() => setPaymentDialogOpen(false)}
            sx={{ color: 'white' }}
            size="small"
          >
            <Close />
          </IconButton>
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
                  color: '#4ade80'
                }
              }}
            >
              ¡Tu solicitud ha sido registrada exitosamente!
            </Alert>

            <Box sx={{
              p: 3,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              border: '2px solid rgba(76, 175, 80, 0.3)',
              mb: 3
            }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                Para completar tu solicitud, realiza el siguiente depósito:
              </Typography>

              <Box sx={{ 
                textAlign: 'center', 
                py: 2.5,
                bgcolor: 'rgba(102, 126, 234, 0.1)',
                borderRadius: 2,
                border: '1px solid rgba(102, 126, 234, 0.3)',
                mb: 2.5
              }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                  Monto a transferir
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#4ade80', mb: 1 }}>
                  Gs. {paymentInfo?.amount.toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  al alias <strong>{paymentInfo?.alias}</strong>
                </Typography>
              </Box>

              <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 2, borderRadius: 2, mb: 2.5 }}>
                <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 600, mb: 1 }}>
                  🏦 Banco
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: 'white', mb: 2 }}>
                  {paymentInfo?.bank}
                </Typography>

                <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 600, mb: 1 }}>
                  💳 Alias
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: 'white', mb: 2, fontFamily: 'monospace' }}>
                  {paymentInfo?.alias}
                </Typography>
              </Box>

              <Box sx={{ 
                p: 2.5, 
                bgcolor: 'rgba(255, 193, 7, 0.1)', 
                borderRadius: 2,
                border: '1px solid rgba(255, 193, 7, 0.3)'
              }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  📸 <strong>Importante:</strong> Guarda tu comprobante de pago. Lo necesitarás para completar tu solicitud.
                </Typography>
              </Box>
            </Box>

            <Alert
              severity="info"
              sx={{
                bgcolor: 'rgba(102, 126, 234, 0.2)',
                color: 'white',
                border: '1px solid rgba(102, 126, 234, 0.4)',
                '& .MuiAlert-icon': {
                  color: '#667eea'
                }
              }}
            >
              El administrador revisará tu solicitud y te confirmará la activación en breve.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5 }}>
          <Button
            variant="contained"
            onClick={() => setPaymentDialogOpen(false)}
            fullWidth
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #66428a 100%)'
              }
            }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlanSelector;
