import React, { useState, useEffect, useCallback } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Badge,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Tab,
  Tabs,
  Autocomplete,
  InputAdornment,
  Switch,
  FormControlLabel,
  Slider,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  WhatsApp as WhatsAppIcon,
  Payment as PaymentIcon,
  Notifications as NotificationIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  AccessTime as TimeIcon,
  Send as SendIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { es } from 'date-fns/locale';
import { format, addMonths, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

// Tipos
interface Contact {
  id: number;
  jid: string;
  name: string;
  phone?: string;
  avatar_url?: string;
}

interface Installment {
  id: number;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  reminder_sent: boolean;
  reminder_sent_at: string | null;
  overdue_notification_sent: boolean;
  notes: string | null;
  notification_count: number;
  last_notification_at: string | null;
  days_overdue: number;
  interest_amount: number;
  total_with_interest: number;
}

interface Credit {
  id: number;
  contact_id: number;
  contact_jid: string;
  contact_name: string;
  contact_avatar?: string;
  total_amount: number;
  installment_count: number;
  installment_amount: number;
  start_date: string;
  due_day: number;
  interest_rate: number;
  status: 'active' | 'completed' | 'cancelled' | 'defaulted';
  reminder_days_before: number;
  description?: string;
  total_installments?: number;
  paid_installments?: number;
  pending_installments?: number;
  overdue_installments?: number;
  next_due_date?: string;
  total_paid?: number;
  created_at: string;
}

interface CreditTemplate {
  id: string;
  name: string;
  description?: string;
  message_text: string;
  reminder_type: 'before_due' | 'on_due' | 'overdue';
  days_before: number;
  is_default: boolean;
}

interface DashboardStats {
  credits: {
    total_credits: number;
    active_credits: number;
    completed_credits: number;
    total_portfolio: number;
    active_portfolio: number;
  };
  installments: {
    total_installments: number;
    pending_installments: number;
    paid_installments: number;
    overdue_installments: number;
    pending_amount: number;
    overdue_amount: number;
  };
  upcomingDue: number;
  reminders: {
    total_sent: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
  };
}

// Utilidades
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return format(new Date(dateString), 'dd MMM yyyy', { locale: es });
};

// Limpiar número de teléfono (quitar @s.whatsapp.net)
const cleanPhoneNumber = (jid: string) => {
  if (!jid) return '';
  return jid.replace(/@s\.whatsapp\.net$/i, '').replace(/@c\.us$/i, '');
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return 'success';
    case 'pending': return 'warning';
    case 'overdue': return 'error';
    case 'active': return 'info';
    case 'completed': return 'success';
    case 'cancelled': return 'default';
    default: return 'default';
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    paid: 'Pagado',
    pending: 'Pendiente',
    overdue: 'Vencido',
    cancelled: 'Cancelado',
    active: 'Activo',
    completed: 'Completado',
    defaulted: 'En mora'
  };
  return labels[status] || status;
};

// Componente principal
const CreditManagement: React.FC<{ sessionId: string; userId?: string; apiUrl: string }> = ({ sessionId, userId, apiUrl }) => {
  // Usar userId (ID numérico) para API de créditos, sessionId (teléfono) para WhatsApp/contactos
  const creditSessionId = userId || sessionId;

  const [activeTab, setActiveTab] = useState(0);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [templates, setTemplates] = useState<CreditTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [creditDetails, setCreditDetails] = useState<any>(null);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [sendReminderDialogOpen, setSendReminderDialogOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [editInstallmentDialogOpen, setEditInstallmentDialogOpen] = useState(false);
  const [deleteInstallmentDialogOpen, setDeleteInstallmentDialogOpen] = useState(false);
  const [editInstallmentForm, setEditInstallmentForm] = useState({ amount: '', dueDate: '', notes: '' });

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Formulario de creación
  const [createForm, setCreateForm] = useState({
    contact: null as Contact | null,
    totalAmount: '',
    installmentCount: 6,
    startDate: new Date(),
    dueDay: 5,
    interestRate: 0,
    reminderDaysBefore: 2,
    reminderTemplateId: '',
    description: ''
  });
  const [createStep, setCreateStep] = useState(0);

  // Helper para obtener token actualizado
  const getToken = () => {
    return localStorage.getItem('token') ||
      localStorage.getItem('whinsap_token') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('whinsap_token');
  };

  const [whatsappDisconnectedDialogOpen, setWhatsappDisconnectedDialogOpen] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  const [customMessageText, setCustomMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);


  // Cargar datos
  const loadCredits = useCallback(async () => {
    try {
      setLoading(true);
      const currentToken = getToken();
      if (!currentToken) {
        console.warn('No token found for CreditManagement');
        return;
      }

      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setCredits(data.data);
      }
    } catch (error) {
      console.error('Error cargando créditos:', error);
    } finally {
      setLoading(false);
    }
  }, [creditSessionId, apiUrl]);

  const loadStats = useCallback(async () => {
    try {
      const currentToken = getToken();
      if (!currentToken) return;

      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/stats/dashboard`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }, [creditSessionId, apiUrl]);

  const loadTemplates = useCallback(async () => {
    try {
      const currentToken = getToken();
      if (!currentToken) return;

      const response = await fetch(`${apiUrl}/api/credit-templates/${creditSessionId}`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error);
    }
  }, [creditSessionId, apiUrl]);

  const loadContacts = useCallback(async () => {
    try {
      const currentToken = getToken();
      if (!currentToken) return;

      const response = await fetch(`${apiUrl}/api/contacts/${sessionId}?limit=1000`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Error cargando contactos:', error);
    }
  }, [sessionId, apiUrl]);

  const checkWhatsAppStatus = useCallback(async () => {
    try {
      const currentToken = getToken();
      // Si no tenemos token, asumimos desconectado
      if (!currentToken) {
        setWhatsappStatus('disconnected');
        return;
      }

      const response = await fetch(`${apiUrl}/api/sessions/active?sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Buscamos si hay alguna sesión conectada
        const isConnected = data.sessions && data.sessions.some((s: any) => s.isConnected);
        setWhatsappStatus(isConnected ? 'connected' : 'disconnected');
      } else {
        setWhatsappStatus('disconnected');
      }
    } catch (error) {
      console.error('Error verificando estado de WhatsApp:', error);
      setWhatsappStatus('disconnected');
    }
  }, [sessionId, apiUrl]);

  useEffect(() => {
    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [checkWhatsAppStatus]);

  useEffect(() => {
    loadCredits();
    loadStats();
    loadTemplates();
    loadContacts();
  }, [loadCredits, loadStats, loadTemplates, loadContacts]);

  // Crear crédito
  const handleCreateCredit = async () => {
    try {
      if (!createForm.contact) return;

      const currentToken = getToken();
      if (!currentToken) {
        setSnackbar({ open: true, message: 'Sesión no válida. Recarga la página.', severity: 'error' });
        return;
      }

      const installmentAmount = Math.round(parseFloat(createForm.totalAmount) / createForm.installmentCount);

      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          contactId: createForm.contact.id,
          contactJid: createForm.contact.jid,
          contactName: createForm.contact.name,
          totalAmount: parseFloat(createForm.totalAmount),
          installmentCount: createForm.installmentCount,
          installmentAmount,
          startDate: format(createForm.startDate, 'yyyy-MM-dd'),
          dueDay: createForm.dueDay,
          interestRate: createForm.interestRate,
          reminderDaysBefore: createForm.reminderDaysBefore,
          reminderTemplateId: createForm.reminderTemplateId || null,
          description: createForm.description
        })
      });

      const data = await response.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Crédito creado exitosamente', severity: 'success' });
        setCreateDialogOpen(false);
        setCreateStep(0);
        setCreateForm({
          contact: null,
          totalAmount: '',
          installmentCount: 6,
          startDate: new Date(),
          dueDay: 5,
          interestRate: 0,
          reminderDaysBefore: 2,
          reminderTemplateId: '',
          description: ''
        });
        loadCredits();
        loadStats();
      } else {
        setSnackbar({ open: true, message: data.error || 'Error al crear crédito', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al crear crédito', severity: 'error' });
    }
  };

  // Eliminar crédito
  // Eliminar crédito
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditToDelete, setCreditToDelete] = useState<number | null>(null);

  const confirmDeleteCredit = (creditId: number) => {
    setCreditToDelete(creditId);
    setDeleteDialogOpen(true);
  };

  const executeDeleteCredit = async () => {
    if (!creditToDelete) return;

    try {
      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/${creditToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSnackbar({ open: true, message: 'Crédito eliminado exitosamente', severity: 'success' });
        loadCredits();
        loadStats();
        setDeleteDialogOpen(false);
        setCreditToDelete(null);
      } else {
        setSnackbar({ open: true, message: data.error || 'Error al eliminar el crédito', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error de conexión al eliminar', severity: 'error' });
    }
  };

  // Ver detalles
  const handleViewDetails = async (credit: Credit) => {
    try {
      setSelectedCredit(credit);
      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/${credit.id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      if (data.success) {
        setCreditDetails(data.data);
        setDetailsDialogOpen(true);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al cargar detalles', severity: 'error' });
    }
  };

  // Marcar cuota como pagada
  const handlePayInstallment = async () => {
    if (!selectedInstallment || !selectedCredit) return;

    try {
      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/installments/${selectedInstallment.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          paidDate: format(new Date(), 'yyyy-MM-dd'),
          notes: `Pagado el ${format(new Date(), 'dd/MM/yyyy')}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Cuota marcada como pagada', severity: 'success' });
        setPaymentDialogOpen(false);
        // Recargar detalles
        handleViewDetails(selectedCredit);
        loadCredits();
        loadStats();
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al pagar cuota', severity: 'error' });
    }
  };

  // Enviar recordatorio manual
  const handleSendReminder = async (templateType?: string) => {
    if (!selectedInstallment) return;

    try {
      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/installments/${selectedInstallment.id}/send-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          templateType: templateType || 'default',
          customMessage: templateType === 'custom' ? customMessageText : null
        })
      });

      const data = await response.json();

      if (response.status === 503 || (data.error && data.error.includes('conexión'))) {
        setWhatsappDisconnectedDialogOpen(true);
        setSnackbar({ open: false, message: '', severity: 'error' });
        return;
      }

      if (data.success) {
        setSnackbar({ open: true, message: 'Recordatorio enviado exitosamente', severity: 'success' });
        setSendReminderDialogOpen(false);
      } else {
        setSnackbar({ open: true, message: data.error || 'Error al enviar recordatorio', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al enviar recordatorio', severity: 'error' });
    }
  };

  // Recargar detalles del crédito seleccionado
  const reloadCreditDetails = async () => {
    if (!selectedCredit) return;
    try {
      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/${selectedCredit.id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      if (data.success) {
        setCreditDetails(data.data);
      }
    } catch (error) {
      console.error('Error reloading credit details:', error);
    }
  };

  // Editar cuota
  const handleEditInstallment = async () => {
    if (!selectedInstallment) return;

    try {
      const body: any = {};
      if (editInstallmentForm.amount) body.amount = parseFloat(editInstallmentForm.amount);
      if (editInstallmentForm.dueDate) body.dueDate = editInstallmentForm.dueDate;
      if (editInstallmentForm.notes !== undefined) body.notes = editInstallmentForm.notes;

      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/installments/${selectedInstallment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Cuota actualizada exitosamente', severity: 'success' });
        setEditInstallmentDialogOpen(false);
        reloadCreditDetails();
      } else {
        setSnackbar({ open: true, message: data.error || 'Error al actualizar cuota', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al actualizar cuota', severity: 'error' });
    }
  };

  // Eliminar cuota
  const handleDeleteInstallment = async () => {
    if (!selectedInstallment) return;

    try {
      const response = await fetch(`${apiUrl}/api/credits/${creditSessionId}/installments/${selectedInstallment.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Cuota eliminada exitosamente', severity: 'success' });
        setDeleteInstallmentDialogOpen(false);
        reloadCreditDetails();
        loadCredits();
      } else {
        setSnackbar({ open: true, message: data.error || 'Error al eliminar cuota', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al eliminar cuota', severity: 'error' });
    }
  };

  // Calcular preview de cuotas
  const calculateInstallmentsPreview = () => {
    if (!createForm.totalAmount || !createForm.installmentCount) return [];

    const amount = parseFloat(createForm.totalAmount);
    const count = createForm.installmentCount;
    const installmentAmount = Math.round(amount / count);
    const start = createForm.startDate;

    const installments = [];
    for (let i = 0; i < count; i++) {
      const dueDate = addMonths(start, i);
      // Ajustar al día de vencimiento seleccionado
      dueDate.setDate(createForm.dueDay);

      installments.push({
        number: i + 1,
        amount: installmentAmount,
        dueDate
      });
    }

    return installments;
  };

  // Renderizado de pasos del formulario
  const renderCreateStep = () => {
    switch (createStep) {
      case 0:
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium">
              Seleccionar Contacto
            </Typography>
            <Autocomplete
              options={contacts}
              getOptionLabel={(option) => option.name || cleanPhoneNumber(option.jid)}
              value={createForm.contact}
              onChange={(_, value) => setCreateForm({ ...createForm, contact: value })}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={option.avatar_url} sx={{ width: 32, height: 32 }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2">{option.name || 'Sin nombre'}</Typography>
                    <Typography variant="caption" color="text.secondary">{cleanPhoneNumber(option.jid)}</Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar contacto"
                  placeholder="Escribe para buscar..."
                  fullWidth
                />
              )}
              sx={{ mb: 2 }}
            />
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium">
              Configuración del Crédito
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Monto Total"
                  type="number"
                  value={createForm.totalAmount}
                  onChange={(e) => setCreateForm({ ...createForm, totalAmount: e.target.value })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">Gs.</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Cantidad de Cuotas"
                  type="number"
                  value={createForm.installmentCount}
                  onChange={(e) => setCreateForm({ ...createForm, installmentCount: parseInt(e.target.value) || 1 })}
                  inputProps={{ min: 1, max: 36 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Fecha de Inicio"
                  value={createForm.startDate}
                  onChange={(date) => date && setCreateForm({ ...createForm, startDate: date })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Día de Vencimiento"
                  type="number"
                  value={createForm.dueDay}
                  onChange={(e) => setCreateForm({ ...createForm, dueDay: parseInt(e.target.value) || 5 })}
                  inputProps={{ min: 1, max: 31 }}
                  helperText="Día del mes para vencimiento"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Interés por mora (%)"
                  type="number"
                  value={createForm.interestRate}
                  onChange={(e) => setCreateForm({ ...createForm, interestRate: parseFloat(e.target.value) || 0 })}
                  inputProps={{ min: 0, max: 100, step: 0.5 }}
                  helperText="% diario aplicado desde el vencimiento"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descripción (opcional)"
                  multiline
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </Grid>
            </Grid>

            {createForm.totalAmount && createForm.installmentCount > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Monto por cuota: <strong>{formatCurrency(parseFloat(createForm.totalAmount) / createForm.installmentCount)}</strong>
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium">
              Configuración de Recordatorios
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography gutterBottom>
                  Enviar recordatorio:
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={createForm.reminderDaysBefore}
                    onChange={(e) => setCreateForm({ ...createForm, reminderDaysBefore: e.target.value as number })}
                  >
                    <MenuItem value={0}>El mismo día del vencimiento</MenuItem>
                    <MenuItem value={1}>1 día antes</MenuItem>
                    <MenuItem value={2}>2 días antes</MenuItem>
                    <MenuItem value={3}>3 días antes</MenuItem>
                    <MenuItem value={5}>5 días antes</MenuItem>
                    <MenuItem value={7}>1 semana antes</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Plantilla de Mensaje</InputLabel>
                  <Select
                    value={createForm.reminderTemplateId}
                    onChange={(e) => setCreateForm({ ...createForm, reminderTemplateId: e.target.value })}
                    label="Plantilla de Mensaje"
                  >
                    <MenuItem value="">
                      <em>Usar plantilla predeterminada</em>
                    </MenuItem>
                    {templates.filter(t => t.reminder_type === 'before_due').map(template => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        const preview = calculateInstallmentsPreview();
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium">
              Vista Previa de Cuotas
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Cuota</TableCell>
                    <TableCell align="right">Monto</TableCell>
                    <TableCell>Vencimiento</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.map((inst) => (
                    <TableRow key={inst.number}>
                      <TableCell>{inst.number}</TableCell>
                      <TableCell align="right">{formatCurrency(inst.amount)}</TableCell>
                      <TableCell>{format(inst.dueDate, 'dd/MM/yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );

      default:
        return null;
    }
  };

  // Dashboard Stats Cards
  const renderStatsCards = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MoneyIcon color="primary" />
              <Typography variant="body2" color="text.secondary">Cartera Activa</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold">
              {stats ? formatCurrency(stats.credits.active_portfolio || 0) : '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats?.credits.active_credits || 0} créditos activos
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUpIcon color="success" />
              <Typography variant="body2" color="text.secondary">Total Cobrado</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold">
              {stats ? formatCurrency(stats.installments.paid_installments * (stats.credits.total_portfolio / (stats.credits.total_credits || 1)) || 0) : '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats?.installments.paid_installments || 0} cuotas pagadas
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <WarningIcon color="error" />
              <Typography variant="body2" color="text.secondary">Monto Vencido</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold" color="error">
              {stats ? formatCurrency(stats.installments.overdue_amount || 0) : '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats?.installments.overdue_installments || 0} cuotas vencidas
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ScheduleIcon color="info" />
              <Typography variant="body2" color="text.secondary">Por Vencer (7 días)</Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold">
              {stats?.upcomingDue || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              cuotas próximas a vencer
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight="bold">
              Gestión de Créditos
            </Typography>
            <Chip
              icon={<WhatsAppIcon />}
              label={whatsappStatus === 'connected' ? 'WhatsApp Online' : whatsappStatus === 'loading' ? 'Verificando...' : 'WhatsApp Offline'}
              color={whatsappStatus === 'connected' ? 'success' : whatsappStatus === 'loading' ? 'default' : 'error'}
              variant={whatsappStatus === 'connected' ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 'bold',
                animation: whatsappStatus === 'connected' ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.4)' },
                  '70%': { boxShadow: '0 0 0 10px rgba(76, 175, 80, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)' }
                }
              }}
            />
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Nuevo Crédito
          </Button>
        </Box>

        {/* Stats */}
        {renderStatsCards()}

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Créditos Activos" />
          <Tab label="Completados" />
          <Tab label="Cuotas Vencidas" />
          <Tab label="Plantillas" />
        </Tabs>

        {/* Lista de Créditos */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Monto Total</TableCell>
                <TableCell>Cuotas</TableCell>
                <TableCell>Progreso</TableCell>
                <TableCell>Próximo Vencimiento</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : credits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay créditos registrados
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                credits.map((credit) => (
                  <TableRow key={credit.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar src={credit.contact_avatar} sx={{ width: 32, height: 32 }}>
                          <PersonIcon />
                        </Avatar>
                        <Typography variant="body2">{credit.contact_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{formatCurrency(credit.total_amount)}</TableCell>
                    <TableCell>
                      {credit.paid_installments || 0} / {credit.installment_count} pagadas
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          flex: 1,
                          height: 8,
                          bgcolor: 'grey.200',
                          borderRadius: 4,
                          overflow: 'hidden'
                        }}>
                          <Box sx={{
                            width: `${((credit.paid_installments || 0) / credit.installment_count) * 100}%`,
                            height: '100%',
                            bgcolor: 'success.main',
                            transition: 'width 0.3s'
                          }} />
                        </Box>
                        <Typography variant="caption">
                          {Math.round(((credit.paid_installments || 0) / credit.installment_count) * 100)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {credit.next_due_date ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarIcon fontSize="small" color="action" />
                          {formatDate(credit.next_due_date)}
                        </Box>
                      ) : (
                        <Chip size="small" label="Completado" color="success" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={getStatusLabel(credit.status)}
                        color={getStatusColor(credit.status) as any}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver detalles">
                        <IconButton size="small" onClick={() => handleViewDetails(credit)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Enviar recordatorio">
                        <IconButton size="small" color="success">
                          <WhatsAppIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar crédito">
                        <IconButton size="small" color="error" onClick={() => confirmDeleteCredit(credit.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Dialog Crear Crédito */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Nuevo Crédito
              <IconButton onClick={() => setCreateDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stepper activeStep={createStep} sx={{ mb: 3, mt: 1 }}>
              <Step>
                <StepLabel>Contacto</StepLabel>
              </Step>
              <Step>
                <StepLabel>Crédito</StepLabel>
              </Step>
              <Step>
                <StepLabel>Recordatorios</StepLabel>
              </Step>
              <Step>
                <StepLabel>Confirmar</StepLabel>
              </Step>
            </Stepper>

            {renderCreateStep()}
          </DialogContent>
          <DialogActions>
            <Button
              disabled={createStep === 0}
              onClick={() => setCreateStep(createStep - 1)}
            >
              Anterior
            </Button>
            {createStep < 3 ? (
              <Button
                variant="contained"
                onClick={() => setCreateStep(createStep + 1)}
                disabled={createStep === 0 && !createForm.contact}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreateCredit}
                disabled={!createForm.totalAmount || parseFloat(createForm.totalAmount) <= 0}
              >
                Crear Crédito
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Dialog Detalles */}
        <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="xl" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Detalles del Crédito
              <IconButton onClick={() => setDetailsDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {creditDetails && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Info del contacto - fila horizontal compacta */}
                <Card variant="outlined">
                  <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar src={creditDetails.contact_avatar} sx={{ width: 48, height: 48 }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{creditDetails.contact_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {cleanPhoneNumber(creditDetails.contact_jid)}
                        </Typography>
                      </Box>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Monto Total</Typography>
                      <Typography variant="h5" fontWeight="bold">{formatCurrency(creditDetails.total_amount)}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Cuotas</Typography>
                      <Typography variant="h6" fontWeight="bold">{creditDetails.installment_count} x {formatCurrency(creditDetails.installment_amount)}</Typography>
                    </Box>
                    {creditDetails.interest_rate > 0 && (
                      <>
                        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Interes Mora</Typography>
                          <Typography variant="h6" fontWeight="bold" color="warning.main">{creditDetails.interest_rate}%</Typography>
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Tabla de cuotas - ancho completo */}
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Cuotas
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: creditDetails.interest_rate > 0 ? 1100 : 850 }}>
                      <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 700, whiteSpace: 'nowrap' } }}>
                          <TableCell>#</TableCell>
                          <TableCell>Monto</TableCell>
                          <TableCell>Vencimiento</TableCell>
                          <TableCell>Estado</TableCell>
                          {creditDetails.interest_rate > 0 && <TableCell>Interés</TableCell>}
                          {creditDetails.interest_rate > 0 && <TableCell>Total</TableCell>}
                          <TableCell>Recordatorio</TableCell>
                          <TableCell align="center">Notif.</TableCell>
                          <TableCell align="center" sx={{ minWidth: 160 }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {creditDetails.installments?.map((inst: Installment) => (
                          <TableRow key={inst.id}>
                            <TableCell>{inst.installment_number}</TableCell>
                            <TableCell>{formatCurrency(inst.amount)}</TableCell>
                            <TableCell>
                              {isPast(new Date(inst.due_date)) && !isToday(new Date(inst.due_date)) ? (
                                <Typography color="error" variant="body2">
                                  {formatDate(inst.due_date)} ⚠️
                                </Typography>
                              ) : isToday(new Date(inst.due_date)) ? (
                                <Typography color="warning.main" variant="body2">
                                  {formatDate(inst.due_date)} (Hoy)
                                </Typography>
                              ) : isTomorrow(new Date(inst.due_date)) ? (
                                <Typography color="info.main" variant="body2">
                                  {formatDate(inst.due_date)} (Mañana)
                                </Typography>
                              ) : (
                                formatDate(inst.due_date)
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={getStatusLabel(inst.status)}
                                color={getStatusColor(inst.status) as any}
                              />
                            </TableCell>
                            {creditDetails.interest_rate > 0 && (
                              <TableCell>
                                {inst.interest_amount > 0 ? (
                                  <Tooltip title={`${inst.days_overdue} día(s) de mora × ${creditDetails.interest_rate}%`}>
                                    <Typography variant="body2" color="error" fontWeight={600}>
                                      {formatCurrency(inst.interest_amount)}
                                    </Typography>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">-</Typography>
                                )}
                              </TableCell>
                            )}
                            {creditDetails.interest_rate > 0 && (
                              <TableCell>
                                {inst.interest_amount > 0 ? (
                                  <Typography variant="body2" fontWeight={700} color="warning.main">
                                    {formatCurrency(inst.total_with_interest)}
                                  </Typography>
                                ) : (
                                  <Typography variant="body2">{formatCurrency(inst.amount)}</Typography>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              {inst.reminder_sent ? (
                                <Tooltip title={`Enviado el ${formatDate(inst.reminder_sent_at || '')}`}>
                                  <CheckCircleIcon color="success" fontSize="small" />
                                </Tooltip>
                              ) : (
                                <TimeIcon color="disabled" fontSize="small" />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title={inst.notification_count > 0
                                ? `Última: ${inst.last_notification_at ? formatDate(inst.last_notification_at) : 'N/A'}`
                                : 'Sin notificaciones enviadas'
                              }>
                                <Chip
                                  size="small"
                                  label={inst.notification_count || 0}
                                  color={inst.notification_count > 0 ? 'primary' : 'default'}
                                  variant={inst.notification_count > 0 ? 'filled' : 'outlined'}
                                  sx={{ minWidth: 32, fontWeight: 700 }}
                                />
                              </Tooltip>
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'center', flexWrap: 'nowrap' }}>
                                {inst.status !== 'paid' && inst.status !== 'cancelled' && (
                                  <Tooltip title="Marcar como pagado">
                                    <IconButton
                                      size="small"
                                      color="success"
                                      onClick={() => {
                                        setSelectedInstallment(inst);
                                        setSelectedCredit(selectedCredit);
                                        setPaymentDialogOpen(true);
                                      }}
                                    >
                                      <PaymentIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Enviar recordatorio">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setSelectedInstallment(inst);
                                      setSendReminderDialogOpen(true);
                                    }}
                                  >
                                    <SendIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Editar cuota">
                                  <IconButton
                                    size="small"
                                    color="info"
                                    onClick={() => {
                                      setSelectedInstallment(inst);
                                      setEditInstallmentForm({
                                        amount: inst.amount.toString(),
                                        dueDate: inst.due_date.split('T')[0],
                                        notes: inst.notes || ''
                                      });
                                      setEditInstallmentDialogOpen(true);
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Eliminar cuota">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      setSelectedInstallment(inst);
                                      setDeleteInstallmentDialogOpen(true);
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Pagar Cuota */}
        <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Confirmar Pago</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              ¿Confirmar el pago de la cuota <strong>#{selectedInstallment?.installment_number}</strong>?
            </Typography>
            <Typography variant="h6" color="primary" gutterBottom>
              {selectedInstallment && formatCurrency(selectedInstallment.amount)}
            </Typography>
            <TextField
              fullWidth
              label="Notas (opcional)"
              multiline
              rows={2}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" color="success" onClick={handlePayInstallment}>
              Confirmar Pago
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog Enviar Recordatorio */}
        <Dialog open={sendReminderDialogOpen} onClose={() => setSendReminderDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Enviar Recordatorio
              <IconButton onClick={() => setSendReminderDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="subtitle1" gutterBottom>
              Cuota #{selectedInstallment?.installment_number} - {formatCurrency(selectedInstallment?.amount || 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Vencimiento: {formatDate(selectedInstallment?.due_date || '')}
            </Typography>

            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
              Seleccionar Plantilla:
            </Typography>

            <Grid container spacing={2}>
              {/* Plantilla Amigable */}
              <Grid item xs={12} md={4}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'primary.main', boxShadow: 2 }
                  }}
                  onClick={() => handleSendReminder('amigable')}
                >
                  <CardContent>
                    <Typography variant="h6" color="primary" gutterBottom>
                      😊 Amigable
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      "Hola {'{nombre}'}! 👋 Te recordamos que tienes una cuota pendiente..."
                    </Typography>
                    <Chip size="small" label="2 días antes" color="info" />
                  </CardContent>
                </Card>
              </Grid>

              {/* Plantilla Formal */}
              <Grid item xs={12} md={4}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'primary.main', boxShadow: 2 }
                  }}
                  onClick={() => handleSendReminder('formal')}
                >
                  <CardContent>
                    <Typography variant="h6" color="primary" gutterBottom>
                      📋 Formal
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      "Estimado/a {'{nombre}'}, Por medio de este mensaje le recordamos..."
                    </Typography>
                    <Chip size="small" label="3 días antes" color="info" />
                  </CardContent>
                </Card>
              </Grid>

              {/* Plantilla Urgente */}
              <Grid item xs={12} md={4}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'warning.main', boxShadow: 2, borderWidth: 2 }
                  }}
                  onClick={() => handleSendReminder('urgente')}
                >
                  <CardContent>
                    <Typography variant="h6" color="warning.main" gutterBottom>
                      ⚠️ Urgente
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      "⚠️ RECORDATORIO URGENTE ⚠️ {'{nombre}'}, su pago vence..."
                    </Typography>
                    <Chip size="small" label="Día del vencimiento" color="warning" />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle2" gutterBottom>
              Mensaje Personalizado (opcional):
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={customMessageText}
                onChange={(e) => setCustomMessageText(e.target.value)}
                placeholder="Escribe tu mensaje personalizado aquí..."
                sx={{ mt: 1 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ position: 'absolute', bottom: 16, right: 16 }}>
                      <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                        😊
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: '100%', right: 0, zIndex: 10 }}>
                  <EmojiPicker
                    onEmojiClick={(emojiData: EmojiClickData) => {
                      setCustomMessageText(prev => prev + emojiData.emoji);
                      setShowEmojiPicker(false);
                    }}
                    width={300}
                    height={400}
                  />
                </Box>
              )}
            </Box>
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              startIcon={<SendIcon />}
              onClick={() => handleSendReminder('custom')}
            >
              Enviar Mensaje Personalizado
            </Button>
          </DialogContent>
        </Dialog>

        {/* Dialog Confirmar Eliminación */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              bgcolor: 'background.paper',
              backgroundImage: 'linear-gradient(rgba(239, 68, 68, 0.05), rgba(239, 68, 68, 0.05))'
            }
          }}
        >
          <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" /> Confirmar Eliminación
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mt: 1 }}>
              ¿Estás seguro de que deseas eliminar este crédito?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Esta acción eliminará el crédito, todas sus cuotas y el historial de pagos.
              <strong> Esta acción no se puede deshacer.</strong>
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              variant="outlined"
              color="inherit"
            >
              Cancelar
            </Button>
            <Button
              onClick={executeDeleteCredit}
              variant="contained"
              color="error"
              autoFocus
              startIcon={<DeleteIcon />}
            >
              Eliminar Definitivamente
            </Button>
          </DialogActions>
        </Dialog>



        {/* Dialog Editar Cuota */}
        <Dialog open={editInstallmentDialogOpen} onClose={() => setEditInstallmentDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon color="info" /> Editar Cuota #{selectedInstallment?.installment_number}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                fullWidth
                label="Monto"
                type="number"
                value={editInstallmentForm.amount}
                onChange={(e) => setEditInstallmentForm({ ...editInstallmentForm, amount: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">Gs.</InputAdornment>
                }}
              />
              <TextField
                fullWidth
                label="Fecha de Vencimiento"
                type="date"
                value={editInstallmentForm.dueDate}
                onChange={(e) => setEditInstallmentForm({ ...editInstallmentForm, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="Notas"
                multiline
                rows={2}
                value={editInstallmentForm.notes}
                onChange={(e) => setEditInstallmentForm({ ...editInstallmentForm, notes: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditInstallmentDialogOpen(false)} variant="outlined" color="inherit">
              Cancelar
            </Button>
            <Button onClick={handleEditInstallment} variant="contained" color="primary" startIcon={<EditIcon />}>
              Guardar Cambios
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog Confirmar Eliminacion de Cuota */}
        <Dialog open={deleteInstallmentDialogOpen} onClose={() => setDeleteInstallmentDialogOpen(false)} maxWidth="sm" fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              backgroundImage: 'linear-gradient(rgba(239, 68, 68, 0.03), rgba(239, 68, 68, 0.03))'
            }
          }}
        >
          <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" /> Eliminar Cuota
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mt: 1 }}>
              ¿Eliminar la cuota <strong>#{selectedInstallment?.installment_number}</strong> por{' '}
              <strong>{selectedInstallment && formatCurrency(selectedInstallment.amount)}</strong>?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Se eliminaran los recordatorios asociados y se renumeraran las cuotas restantes.
              <strong> Esta accion no se puede deshacer.</strong>
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDeleteInstallmentDialogOpen(false)} variant="outlined" color="inherit">
              Cancelar
            </Button>
            <Button onClick={handleDeleteInstallment} variant="contained" color="error" startIcon={<DeleteIcon />}>
              Eliminar Cuota
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog WhatsApp Desconectado */}
        <Dialog
          open={whatsappDisconnectedDialogOpen}
          onClose={() => setWhatsappDisconnectedDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              border: '1px solid rgba(255, 152, 0, 0.3)',
              bgcolor: 'background.paper',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }
          }}
        >
          <DialogTitle sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: 4 }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 152, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <WhatsAppIcon sx={{ fontSize: 48, color: 'warning.main' }} />
            </Box>
            <Typography variant="h5" component="span" sx={{ fontWeight: 'bold' }}>
              WhatsApp Desconectado
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center', px: 4, pb: 1 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              No podemos enviar el recordatorio porque tu sesión de WhatsApp aparece como cerrada o inestable.
            </Typography>
            <Alert severity="warning" variant="outlined" sx={{ textAlign: 'left', mb: 2 }}>
              Por favor, ve a la sección de Conexión, cierra la sesión actual si existe, y escanea el código QR nuevamente.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ p: 4, pt: 2, justifyContent: 'center', gap: 2 }}>
            <Button
              onClick={() => setWhatsappDisconnectedDialogOpen(false)}
              variant="outlined"
              color="inherit"
              size="large"
            >
              Cerrar
            </Button>
            <Button
              component={Link}
              to="/connection"
              variant="contained"
              color="warning"
              size="large"
              startIcon={<WhatsAppIcon />}
              onClick={() => setWhatsappDisconnectedDialogOpen(false)}
            >
              Ir a Conexión
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider >
  );
};

export default CreditManagement;
