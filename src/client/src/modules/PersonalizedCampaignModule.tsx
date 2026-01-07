import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Stack,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  Tooltip
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Send,
  Edit,
  Refresh,
  Download,
  CheckCircle,
  HourglassEmpty,
  Cancel,
  Add,
  AttachMoney,
  CalendarToday,
  Person,
  Phone,
  Done,
  Close,
  Visibility
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { useDropzone } from 'react-dropzone';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useModernNotification } from '../hooks/useModernNotification';
import ModernNotification from '../components/ModernNotification';

// ==========================================
// INTERFACES
// ==========================================

interface Recipient {
  id?: number;
  phone_number: string;
  name: string;
  amount: number;
  due_day: number;
  installments: number;
  paid: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
}

interface Campaign {
  id: number;
  name: string;
  message_template: string;
  template_id?: number;
  excel_filename?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  pending_count: number;
  paid_count: number;
  recipients: Recipient[];
  created_at: string;
}

interface PredefinedTemplate {
  id: number;
  name: string;
  category: string;
  message_text: string;
  variables: string[];
}

interface PersonalizedCampaignModuleProps {
  sessionId: string;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

const PersonalizedCampaignModule: React.FC<PersonalizedCampaignModuleProps> = ({ sessionId }) => {
  // Hook de notificaciones modernas
  const {
    notification,
    showSuccess,
    showError,
    showWarning,
    showConfirm,
    closeNotification
  } = useModernNotification();

  // Estados principales
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [predefinedTemplates, setPredefinedTemplates] = useState<PredefinedTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Estados para crear campaña
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelErrors, setExcelErrors] = useState<string[]>([]);

  // Estados para ver campaña
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCampaignDetail, setShowCampaignDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPaid, setFilterPaid] = useState<string>('all');

  // Estados para editar destinatario
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    amount: 0,
    due_day: 1,
    installments: 1,
    paid: false
  });

  // Lista de emojis comunes
  const commonEmojis = [
    '😊', '👍', '❤️', '🎉', '✅', '⚡', '🌟', '💡',
    '📱', '💰', '🎁', '📅', '⏰', '✨', '🚀', '🔥',
    '👋', '🙏', '💳', '📞', '⚠️', '📊', '📋', '🏦'
  ];

  // ==========================================
  // EFECTOS
  // ==========================================

  useEffect(() => {
    loadCampaigns();
    loadPredefinedTemplates();
  }, [sessionId]);

  // ==========================================
  // FUNCIONES DE CARGA
  // ==========================================

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/list?sessionId=${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPredefinedTemplates = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/templates/predefined`);
      const data = await response.json();
      if (data.success) {
        setPredefinedTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error);
    }
  };

  // ==========================================
  // DRAG & DROP EXCEL
  // ==========================================

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleExcelUpload(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleExcelUpload = async (file: File) => {
    setLoading(true);
    setExcelFile(file);

    try {
      const formData = new FormData();
      formData.append('excel', file);

      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/upload-excel`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setExcelData(data.preview || []);
        setExcelErrors(data.errors || []);

        if (data.errors && data.errors.length > 0) {
          showWarning(
            `Se encontraron ${data.errors.length} errores en el Excel. Revisa los registros.`,
            'Excel procesado con errores'
          );
        } else {
          showSuccess(
            `${data.validRecords} registros cargados correctamente`,
            '✅ Excel procesado'
          );
        }
      }
      else {
        showError(data.error || 'Error desconocido', 'Error al procesar Excel');
        setExcelData([]);
        setExcelErrors([]);
      }
    } catch (error) {
      console.error('Error subiendo Excel:', error);
      showError('Verifica tu archivo e intenta nuevamente', 'Error al subir Excel');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // CREAR CAMPAÑA
  // ==========================================

  const handleCreateCampaign = async () => {
    if (!campaignName || !messageTemplate || excelData.length === 0) {
      showWarning('Por favor completa el nombre, mensaje y carga el Excel', 'Campos incompletos');
      return;
    }

    setLoading(true);

    try {
      const recipients = excelData.map(row => ({
        phoneNumber: row.numero,
        name: row.nombre,
        amount: parseFloat(row.monto) || 0,
        dueDay: parseInt(row.fecha_vencimiento) || 1,
        installments: parseInt(row.cuotas) || 1
      }));

      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: campaignName,
          messageTemplate,
          templateId: selectedTemplateId,
          recipients
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(
          `${data.totalRecipients} destinatarios agregados. La campaña se activará automáticamente.`,
          '🎉 Campaña creada'
        );
        resetForm();
        setShowCreateDialog(false);
        loadCampaigns();
      } else {
        showError(data.error || 'Error desconocido', 'Error al crear campaña');
      }
    } catch (error) {
      console.error('Error creando campaña:', error);
      showError('Verifica tu conexión e intenta nuevamente', 'Error al crear campaña');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCampaignName('');
    setMessageTemplate('');
    setSelectedTemplateId(null);
    setExcelData([]);
    setExcelFile(null);
    setExcelErrors([]);
  };

  // ==========================================
  // EDITAR DESTINATARIO
  // ==========================================

  const openEditRecipient = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    setEditForm({
      name: recipient.name,
      amount: recipient.amount,
      due_day: recipient.due_day,
      installments: recipient.installments,
      paid: recipient.paid
    });
    setShowEditDialog(true);
  };

  const handleUpdateRecipient = async () => {
    if (!editingRecipient) return;

    setLoading(true);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/recipient/${editingRecipient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          amount: editForm.amount,
          due_day: editForm.due_day,
          installments: editForm.installments
        })
      });

      // Si se marcó como pagado, hacer llamada adicional
      if (editForm.paid && !editingRecipient.paid) {
        await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/recipient/${editingRecipient.id}/mark-paid`, {
          method: 'POST'
        });
      }

      const data = await response.json();

      if (data.success) {
        showSuccess('Los cambios se han guardado correctamente', 'Destinatario actualizado');
        setShowEditDialog(false);
        loadCampaigns();
        if (selectedCampaign) {
          viewCampaign(selectedCampaign.id);
        }
      } else {
        showError(data.error || 'Error desconocido', 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error actualizando destinatario:', error);
      showError('Verifica tu conexión', 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // ELIMINAR DESTINATARIO
  // ==========================================

  const handleDeleteRecipient = async (recipientId: number) => {
    showConfirm(
      'Eliminar destinatario',
      '¿Estás seguro de eliminar este destinatario? Esta acción no se puede deshacer.',
      async () => {
        await executeDeleteRecipient(recipientId);
      },
      'Eliminar',
      'Cancelar'
    );
  };

  const executeDeleteRecipient = async (recipientId: number) => {

    setLoading(true);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/recipient/${recipientId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('El destinatario ha sido eliminado', 'Eliminado correctamente');
        loadCampaigns();
        if (selectedCampaign) {
          viewCampaign(selectedCampaign.id);
        }
      } else {
        showError(data.error || 'Error desconocido', 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error eliminando destinatario:', error);
      showError('Verifica tu conexión', 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // MARCAR COMO PAGADO
  // ==========================================

  const handleMarkAsPaid = async (recipientId: number) => {
    setLoading(true);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/recipient/${recipientId}/mark-paid`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(
          'Este destinatario ya no recibirá más mensajes de cobranza',
          '✅ Marcado como pagado'
        );
        loadCampaigns();
        if (selectedCampaign) {
          viewCampaign(selectedCampaign.id);
        }
      } else {
        showError(data.error || 'Error desconocido', 'Error');
      }
    } catch (error) {
      console.error('Error marcando como pagado:', error);
      showError('Verifica tu conexión', 'Error');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // ACTIVAR/PAUSAR CAMPAÑA
  // ==========================================

  const handleToggleCampaignStatus = async (campaignId: number, newStatus: 'active' | 'paused') => {
    setLoading(true);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(
          `La campaña está ahora ${newStatus === 'active' ? 'activa y enviando' : 'pausada'}`,
          newStatus === 'active' ? '✅ Campaña Activada' : '⏸️ Campaña Pausada'
        );
        loadCampaigns();
      } else {
        showError(data.error || 'Error desconocido', 'Error');
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showError('Verifica tu conexión', 'Error');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // ELIMINAR CAMPAÑA
  // ==========================================

  const handleDeleteCampaign = async (campaignId: number) => {
    showConfirm(
      'Eliminar campaña',
      '¿Estás seguro de eliminar esta campaña? Se eliminarán todos los destinatarios y esta acción no se puede deshacer.',
      async () => {
        await executeDeleteCampaign(campaignId);
      },
      'Eliminar',
      'Cancelar'
    );
  };

  const executeDeleteCampaign = async (campaignId: number) => {

    setLoading(true);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/${campaignId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('La campaña y todos sus destinatarios han sido eliminados', 'Campaña eliminada');
        setShowCampaignDetail(false);
        loadCampaigns();
      } else {
        showError(data.error || 'Error desconocido', 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error eliminando campaña:', error);
      showError('Verifica tu conexión', 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // VER DETALLE DE CAMPAÑA
  // ==========================================

  const viewCampaign = async (campaignId: number) => {
    setLoading(true);

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/personalized/${campaignId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedCampaign(data.campaign);
        setShowCampaignDetail(true);
      } else {
        showError(data.error || 'Error desconocido', 'Error al cargar campaña');
      }
    } catch (error) {
      console.error('Error cargando campaña:', error);
      showError('Verifica tu conexión', 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // DESCARGAR PLANTILLA EXCEL
  // ==========================================

  const insertEmoji = (emoji: string) => {
    setMessageTemplate(prev => prev + emoji);
  };

  const downloadExcelTemplate = () => {
    const template = [
      {
        Número: '595994854167',
        Nombre: 'Juan Pérez',
        Monto: 150000,
        'Fecha Vencimiento': 5,
        Cuotas: 3
      },
      {
        Número: '595981234567',
        Nombre: 'María López',
        Monto: 200000,
        'Fecha Vencimiento': 10,
        Cuotas: 1
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_cobranza.xlsx');
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'info';
      case 'delivered': return 'primary';
      case 'read': return 'success';
      case 'failed': return 'error';
      default: return 'warning';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'read': return 'Visto';
      case 'failed': return 'Fallido';
      default: return 'Pendiente';
    }
  };

  const filteredRecipients = selectedCampaign?.recipients.filter(r => {
    const statusMatch = filterStatus === 'all' || r.status === filterStatus;
    const paidMatch = filterPaid === 'all' ||
      (filterPaid === 'paid' && r.paid) ||
      (filterPaid === 'unpaid' && !r.paid);
    return statusMatch && paidMatch;
  }) || [];

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          📊 Campañas Personalizadas
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadExcelTemplate}
          >
            Plantilla Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowCreateDialog(true)}
          >
            Nueva Campaña
          </Button>
        </Stack>
      </Box>

      {/* Info */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Las campañas se envían automáticamente según la fecha de vencimiento de cada destinatario.
        Los mensajes se programan para el día del mes especificado en el Excel.
      </Alert>

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Todas las Campañas" />
        <Tab label="Activas" />
        <Tab label="Pausadas" />
      </Tabs>

      {/* Lista de Campañas */}
      <Grid container spacing={3}>
        {campaigns
          .filter(c =>
            activeTab === 0 ? true :
              activeTab === 1 ? c.status === 'active' :
                c.status === 'paused'
          )
          .map(campaign => (
            <Grid item xs={12} md={6} lg={4} key={campaign.id}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.4)'
                  }
                }}
              >
                <CardContent>
                  {/* Header con nombre y estado */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold" color="primary.light">
                      {campaign.name}
                    </Typography>
                    <Chip
                      label={campaign.status.toUpperCase()}
                      color={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'default'}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>

                  <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

                  {/* Estadísticas en Grid */}
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 1, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                        <Typography variant="h6" fontWeight="bold">{campaign.total_recipients}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 1, bgcolor: 'rgba(34, 197, 94, 0.1)', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" display="block">Enviados</Typography>
                        <Typography variant="h6" fontWeight="bold" color="info.main">{campaign.sent_count}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 1, bgcolor: 'rgba(34, 197, 94, 0.1)', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" display="block">Vistos</Typography>
                        <Typography variant="h6" fontWeight="bold" color="success.main">{campaign.read_count}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 1, bgcolor: 'rgba(251, 191, 36, 0.1)', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" display="block">Pagados</Typography>
                        <Typography variant="h6" fontWeight="bold" color="warning.main">{campaign.paid_count}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Progreso */}
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Progreso</Typography>
                      <Typography variant="caption" fontWeight="bold" color="primary.light">
                        {Math.round((campaign.sent_count / campaign.total_recipients) * 100)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(campaign.sent_count / campaign.total_recipients) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.1)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)'
                        }
                      }}
                    />
                  </Box>

                  {/* Acciones */}
                  <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Visibility />}
                      onClick={() => viewCampaign(campaign.id)}
                      fullWidth
                      sx={{
                        background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                        '&:hover': {
                          background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)'
                        }
                      }}
                    >
                      Ver Detalle
                    </Button>
                    <Tooltip title={campaign.status === 'active' ? 'Pausar' : 'Activar'}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCampaignStatus(
                            campaign.id,
                            campaign.status === 'active' ? 'paused' : 'active'
                          );
                        }}
                        sx={{
                          bgcolor: campaign.status === 'active' ? 'warning.main' : 'success.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: campaign.status === 'active' ? 'warning.dark' : 'success.dark'
                          }
                        }}
                      >
                        {campaign.status === 'active' ? <Cancel /> : <CheckCircle />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCampaign(campaign.id);
                        }}
                        sx={{
                          bgcolor: 'error.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'error.dark'
                          }
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}

        {campaigns.length === 0 && !loading && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No hay campañas creadas. Crea tu primera campaña para comenzar.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* ====================  DIALOG: CREAR CAMPAÑA ==================== */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Nueva Campaña de Cobranza</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Nombre de campaña */}
            <TextField
              label="Nombre de la Campaña"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              fullWidth
              placeholder="Ej: Cobranza Enero 2025"
            />

            {/* Selector de plantilla */}
            <FormControl fullWidth>
              <InputLabel>Plantilla Predefinida</InputLabel>
              <Select
                value={selectedTemplateId || ''}
                onChange={(e) => {
                  const templateId = e.target.value as number;
                  setSelectedTemplateId(templateId);
                  const template = predefinedTemplates.find(t => t.id === templateId);
                  if (template) {
                    setMessageTemplate(template.message_text);
                  }
                }}
                label="Plantilla Predefinida"
              >
                <MenuItem value="">-- Seleccionar plantilla --</MenuItem>
                {predefinedTemplates.map(t => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Mensaje */}
            <Box>
              <TextField
                label="Mensaje"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                multiline
                rows={6}
                fullWidth
                sx={{
                  '& .MuiInputBase-root': {
                    bgcolor: 'background.paper',
                    color: 'text.primary'
                  }
                }}
                placeholder="Escribe tu mensaje aquí. Usa {nombre}, {monto}, {fecha_vencimiento}, {cuotas_pendientes}"
                helperText="Variables disponibles: {nombre}, {monto}, {fecha_vencimiento}, {cuotas_pendientes}"
              />

              {/* Selector de Emojis */}
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Emojis rápidos:
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {commonEmojis.map((emoji, i) => (
                    <Button
                      key={i}
                      size="small"
                      variant="outlined"
                      onClick={() => insertEmoji(emoji)}
                      sx={{ minWidth: 40, fontSize: '1.2rem' }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </Stack>
              </Box>
            </Box>

            {/* Drag & Drop Excel */}
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragActive ? 'action.hover' : 'background.paper'
              }}
            >
              <input {...getInputProps()} />
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {excelFile ? `📄 ${excelFile.name}` : 'Arrastra tu Excel aquí'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {excelFile
                  ? `${excelData.length} registros cargados`
                  : 'o haz clic para seleccionar'
                }
              </Typography>
            </Box>

            {/* Errores de Excel */}
            {excelErrors.length > 0 && (
              <Alert severity="warning">
                {excelErrors.length} errores encontrados. Revisa el Excel.
              </Alert>
            )}

            {/* Vista previa */}
            {excelData.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Vista Previa (primeros 5 registros):
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Nombre</TableCell>
                        <TableCell>Teléfono</TableCell>
                        <TableCell>Monto</TableCell>
                        <TableCell>Vence</TableCell>
                        <TableCell>Cuotas</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {excelData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.nombre}</TableCell>
                          <TableCell>{row.numero}</TableCell>
                          <TableCell>Gs. {row.monto?.toLocaleString()}</TableCell>
                          <TableCell>Día {row.fecha_vencimiento}</TableCell>
                          <TableCell>{row.cuotas || 1}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
          <Button
            onClick={handleCreateCampaign}
            variant="contained"
            disabled={loading || !campaignName || !messageTemplate || excelData.length === 0}
          >
            {loading ? <CircularProgress size={24} /> : 'Crear Campaña'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== DIALOG: VER CAMPAÑA ==================== */}
      <Dialog
        open={showCampaignDetail}
        onClose={() => setShowCampaignDetail(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box sx={{
            p: 3,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}>
                  {selectedCampaign?.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarToday sx={{ fontSize: 14 }} />
                  {selectedCampaign?.created_at && new Date(selectedCampaign.created_at).toLocaleDateString('es-ES', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </Typography>
              </Box>
              <Chip
                label={selectedCampaign?.status === 'active' ? 'ACTIVA' :
                  selectedCampaign?.status === 'paused' ? 'PAUSADA' :
                    selectedCampaign?.status === 'completed' ? 'COMPLETADA' :
                      selectedCampaign?.status.toUpperCase()}
                color={selectedCampaign?.status === 'active' ? 'success' : selectedCampaign?.status === 'paused' ? 'warning' : 'default'}
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedCampaign && (
            <Stack spacing={3}>
              {/* Dashboard de estadísticas - Diseño Compacto */}
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={3}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
                  }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                          Total
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaign.total_recipients}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                        Destinatarios
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
                  }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Send sx={{ color: 'white', mr: 0.5, fontSize: 16 }} />
                        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                          Enviados
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaign.sent_count}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                        Mensajes
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #00c853 0%, #00e676 100%)',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
                  }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Visibility sx={{ color: 'white', mr: 0.5, fontSize: 16 }} />
                        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                          Vistos
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaign.read_count}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                        Confirmados
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
                  }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <AttachMoney sx={{ color: 'white', mr: 0.5, fontSize: 16 }} />
                        <Typography variant="body2" sx={{ color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                          Pagados
                        </Typography>
                      </Box>
                      <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaign.paid_count}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>
                        Cobranzas
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Mensaje de la campaña */}
              <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom color="primary">Mensaje:</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>
                  {selectedCampaign.message_template}
                </Typography>
              </Paper>

              {/* Filtros */}
              <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Estado</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Estado"
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="pending">Pendientes</MenuItem>
                    <MenuItem value="sent">Enviados</MenuItem>
                    <MenuItem value="delivered">Entregados</MenuItem>
                    <MenuItem value="read">Vistos</MenuItem>
                    <MenuItem value="failed">Fallidos</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Pagado</InputLabel>
                  <Select
                    value={filterPaid}
                    onChange={(e) => setFilterPaid(e.target.value)}
                    label="Pagado"
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="paid">Pagados</MenuItem>
                    <MenuItem value="unpaid">No Pagados</MenuItem>
                  </Select>
                </FormControl>

                <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
                  Mostrando {filteredRecipients.length} de {selectedCampaign.recipients.length}
                </Typography>
              </Stack>

              {/* Tabla de destinatarios */}
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Teléfono</TableCell>
                      <TableCell>Monto</TableCell>
                      <TableCell>Vence</TableCell>
                      <TableCell>Cuotas</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Pagado</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRecipients.map(recipient => (
                      <TableRow key={recipient.id}>
                        <TableCell>{recipient.name}</TableCell>
                        <TableCell>{recipient.phone_number}</TableCell>
                        <TableCell>Gs. {recipient.amount.toLocaleString()}</TableCell>
                        <TableCell>Día {recipient.due_day}</TableCell>
                        <TableCell>{recipient.installments}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              recipient.status === 'read' ? 'VISTO' :
                                recipient.status === 'delivered' ? 'ENTREGADO' :
                                  recipient.status === 'sent' ? 'ENVIADO' :
                                    recipient.status === 'failed' ? 'FALLIDO' :
                                      'PENDIENTE'
                            }
                            color={
                              recipient.status === 'read' ? 'success' :
                                recipient.status === 'delivered' ? 'info' :
                                  recipient.status === 'sent' ? 'primary' :
                                    recipient.status === 'failed' ? 'error' :
                                      'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              recipient.paid ? 'PAGADO' : 'PENDIENTE'
                            }
                            color={recipient.paid ? 'success' : 'default'}
                            size="small"
                            icon={recipient.paid ? <Done /> : undefined}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Editar">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => openEditRecipient(recipient)}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {!recipient.paid && (
                              <Tooltip title="Marcar Pagado">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleMarkAsPaid(recipient.id!)}
                                >
                                  <Done fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Eliminar">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRecipient(recipient.id!);
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCampaignDetail(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* ==================== DIALOG: EDITAR DESTINATARIO ==================== */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)}>
        <DialogTitle>Editar Destinatario</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
            <TextField
              label="Nombre"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Monto"
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Día de Vencimiento (1-31)"
              type="number"
              value={editForm.due_day}
              onChange={(e) => setEditForm({ ...editForm, due_day: parseInt(e.target.value) })}
              fullWidth
              inputProps={{ min: 1, max: 31 }}
            />
            <TextField
              label="Cuotas"
              type="number"
              value={editForm.installments}
              onChange={(e) => setEditForm({ ...editForm, installments: parseInt(e.target.value) })}
              fullWidth
              inputProps={{ min: 1 }}
            />

            {/* Checkbox para marcar como pagado */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: editForm.paid ? 'success.light' : 'background.default', borderRadius: 1 }}>
              <input
                type="checkbox"
                checked={editForm.paid}
                onChange={(e) => setEditForm({ ...editForm, paid: e.target.checked })}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
              <Typography variant="body2" fontWeight="bold" color={editForm.paid ? 'success.dark' : 'text.secondary'}>
                ✅ Marcar como PAGADO (dejará de recibir mensajes)
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancelar</Button>
          <Button onClick={handleUpdateRecipient} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Componente de Notificaciones Modernas */}
      {notification && notification.open && (
        <ModernNotification
          message={notification.message}
          type={notification.type}
          title={notification.title}
          open={notification.open}
          onClose={closeNotification}
        />
      )}
    </Box>
  );
};

export default PersonalizedCampaignModule;
