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
  Tooltip,
  Stack,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Send,
  Schedule,
  Edit,
  Refresh,
  AttachFile,
  InsertEmoticon,
  Check,
  Error as ErrorIcon,
  Pending,
  Download,
  Replay,
  Search,
  Clear,
  CheckCircle,
  HourglassEmpty,
  Cancel
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useModernNotification } from '../hooks/useModernNotification';
import ModernNotification from '../components/ModernNotification';
import ModernAlert from '../components/ModernAlert';

interface PersonalizedContact {
  numero: string;
  nombre: string;
  dato1: string;
  dato2: string;
  dato3: string;
  fecha: string;
  hora: string;
  estado: 'pendiente' | 'enviado' | 'error';
  errorMessage?: string;
}

interface PersonalizedCampaign {
  id: string;
  nombre: string;
  mensaje: string;
  archivo?: string;
  archivoNombre?: string;
  contactos: PersonalizedContact[];
  createdAt: string;
  estado: 'activa' | 'completada' | 'pausada';
  totalContactos: number;
  enviados: number;
  pendientes: number;
  errores: number;
}

interface PersonalizedCampaignModuleProps {
  sessionId: string;
}

const PersonalizedCampaignModule: React.FC<PersonalizedCampaignModuleProps> = ({ sessionId }) => {
  // Hook de notificaciones modernas
  const {
    notification,
    alert: modernAlert,
    showSuccess,
    showError,
    showWarning,
    showConfirm,
    closeNotification,
    closeAlert
  } = useModernNotification();

  const [campaigns, setCampaigns] = useState<PersonalizedCampaign[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Estados para crear campaña
  const [campaignName, setCampaignName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [contacts, setContacts] = useState<PersonalizedContact[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Estados para vista de campaña
  const [selectedCampaign, setSelectedCampaign] = useState<PersonalizedCampaign | null>(null);
  const [showCampaignDetail, setShowCampaignDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'enviado' | 'error'>('todos');
  const [editingContact, setEditingContact] = useState<PersonalizedContact | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    loadCampaigns();
    // Configurar intervalo para enviar mensajes programados
    const interval = setInterval(() => {
      checkScheduledMessages();
    }, 60000); // Revisar cada minuto

    return () => clearInterval(interval);
  }, [sessionId]);

  const loadCampaigns = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/personalized-campaigns/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
    }
  };

  const checkScheduledMessages = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/personalized-campaigns/check-scheduled/${sessionId}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.sent > 0) {
        loadCampaigns(); // Recargar campañas si se enviaron mensajes
      }
    } catch (error) {
      console.error('Error verificando mensajes programados:', error);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        handleExcelFile(file);
      }
    }
  }, []);

  const handleExcelFile = async (file: File) => {
    setExcelFile(file);
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const parsedContacts: PersonalizedContact[] = jsonData.map((row): PersonalizedContact => ({
        numero: String(row.numero || row.Numero || row.NUMERO || '').trim(),
        nombre: String(row.nombre || row.Nombre || row.NOMBRE || '').trim(),
        dato1: String(row.dato1 || row.Dato1 || row.DATO1 || '').trim(),
        dato2: String(row.dato2 || row.Dato2 || row.DATO2 || '').trim(),
        dato3: String(row.dato3 || row.Dato3 || row.DATO3 || '').trim(),
        fecha: String(row.fecha || row.Fecha || row.FECHA || '').trim(),
        hora: String(row.hora || row.Hora || row.HORA || '00:00').trim(),
        estado: 'pendiente' as const
      })).filter(contact => contact.numero && contact.fecha);

      setContacts(parsedContacts);
      setLoading(false);
    } catch (error) {
      console.error('Error procesando Excel:', error);
      showError('Verifica que el archivo tenga las columnas correctas (numero, nombre, dato1, dato2, dato3, fecha).', 'Error al procesar Excel');
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleExcelFile(e.target.files[0]);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessageTemplate(messageTemplate + emoji);
    setShowEmojiPicker(false);
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate(messageTemplate + `{${variable}}`);
  };

  const updateContactInCampaign = async (campaignId: string, updatedContact: PersonalizedContact) => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/personalized-campaigns/${campaignId}/contact`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          contact: updatedContact
        })
      });

      const data = await response.json();
      if (data.success) {
        showSuccess('Contacto actualizado correctamente', 'Guardado');
        return true;
      } else {
        showError(data.error || 'Error al actualizar contacto', 'Error');
        return false;
      }
    } catch (error) {
      console.error('Error actualizando contacto:', error);
      showError('Error de conexión al actualizar contacto', 'Error');
      return false;
    }
  };

  const deleteContactFromCampaign = async (campaignId: string, phoneNumber: string) => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/personalized-campaigns/${campaignId}/contact/${phoneNumber}?sessionId=${sessionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        showSuccess('Contacto eliminado correctamente', 'Eliminado');
        return true;
      } else {
        showError(data.error || 'Error al eliminar contacto', 'Error');
        return false;
      }
    } catch (error) {
      console.error('Error eliminando contacto:', error);
      showError('Error de conexión al eliminar contacto', 'Error');
      return false;
    }
  };

  const createCampaign = async () => {
    if (!campaignName || !messageTemplate || contacts.length === 0) {
      showWarning('Por favor completa el nombre de la campaña, el mensaje y carga los contactos desde Excel.', 'Campos incompletos');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('nombre', campaignName);
      formData.append('mensaje', messageTemplate);
      formData.append('contactos', JSON.stringify(contacts));
      
      if (mediaFile) {
        formData.append('archivo', mediaFile);
      }

      const response = await fetch(`${getAPIBaseURL()}/api/personalized-campaigns/create`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('La campaña ha sido creada y los mensajes se enviarán en las fechas programadas.', 'Campaña creada exitosamente');
        resetForm();
        setShowCreateDialog(false);
        loadCampaigns();
      } else {
        showError(data.error || 'No se pudo crear la campaña. Intenta nuevamente.', 'Error al crear campaña');
      }
    } catch (error) {
      console.error('Error creando campaña:', error);
      showError('Ocurrió un error al crear la campaña. Verifica tu conexión e intenta nuevamente.', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCampaignName('');
    setMessageTemplate('');
    setContacts([]);
    setMediaFile(null);
    setMediaPreview(null);
    setExcelFile(null);
  };

  const reprogramCampaign = async (campaignId: string) => {
    showConfirm(
      'Reprogramar campaña',
      'Los contactos enviados cambiarán a pendiente y se enviarán nuevamente en las fechas programadas. ¿Deseas continuar?',
      async () => {
        try {
          const response = await fetch(`${getAPIBaseURL()}/api/personalized-campaigns/reprogram/${campaignId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });

          const data = await response.json();
          if (data.success) {
            showSuccess('Todos los contactos han sido reprogramados correctamente.', 'Campaña reprogramada');
            loadCampaigns();
          } else {
            showError('No se pudo reprogramar la campaña.', 'Error');
          }
        } catch (error) {
          console.error('Error reprogramando campaña:', error);
          showError('Ocurrió un error al reprogramar la campaña.', 'Error de conexión');
        }
      },
      'Reprogramar',
      'Cancelar'
    );
  };

  const deleteCampaign = async (campaignId: string) => {
    showConfirm(
      'Eliminar campaña',
      'Esta acción no se puede deshacer. Se eliminarán todos los contactos y el historial de la campaña. ¿Estás seguro?',
      async () => {
        try {
          const response = await fetch(`${getAPIBaseURL()}/api/personalized-campaigns/${campaignId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });

          const data = await response.json();
          if (data.success) {
            showSuccess('La campaña ha sido eliminada correctamente.', 'Campaña eliminada');
            loadCampaigns();
          } else {
            showError('No se pudo eliminar la campaña.', 'Error');
          }
        } catch (error) {
          console.error('Error eliminando campaña:', error);
          showError('Ocurrió un error al eliminar la campaña.', 'Error de conexión');
        }
      },
      'Eliminar',
      'Cancelar'
    );
  };

  const downloadExcelTemplate = () => {
    const template = [
      {
        numero: '573001234567',
        nombre: 'Juan Pérez',
        dato1: 'Valor 1',
        dato2: 'Valor 2',
        dato3: 'Valor 3',
        fecha: '2025-01-15',
        hora: '09:00'
      },
      {
        numero: '573007654321',
        nombre: 'María García',
        dato1: 'Valor A',
        dato2: 'Valor B',
        dato3: 'Valor C',
        fecha: '2025-01-15',
        hora: '14:30'
      },
      {
        numero: '573009876543',
        nombre: 'Carlos López',
        dato1: 'Dato Ejemplo 1',
        dato2: 'Dato Ejemplo 2',
        dato3: 'Dato Ejemplo 3',
        fecha: '2025-02-05',
        hora: '10:15'
      },
      {
        numero: '573001111111',
        nombre: 'Ana Torres',
        dato1: 'Info 1',
        dato2: 'Info 2',
        dato3: 'Info 3',
        fecha: '2025-02-05',
        hora: '16:45'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    
    // Ajustar ancho de columnas para mejor visualización
    ws['!cols'] = [
      { wch: 15 }, // numero
      { wch: 20 }, // nombre
      { wch: 15 }, // dato1
      { wch: 15 }, // dato2
      { wch: 15 }, // dato3
      { wch: 12 }, // fecha
      { wch: 8 }   // hora
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    XLSX.writeFile(wb, 'plantilla_campana_personalizada.xlsx');
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'enviado': return 'success';
      case 'pendiente': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'enviado': return <Check />;
      case 'pendiente': return <Pending />;
      case 'error': return <ErrorIcon />;
      default: return null;
    }
  };

  const commonEmojis = ['😊', '👍', '🎉', '❤️', '🔥', '✅', '⚡', '🌟', '💡', '📱', '💰', '🎁', '📅', '⏰', '✨', '🚀'];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          📅 Envíos Personalizados
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadExcelTemplate}
          >
            Descargar Plantilla Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={() => setShowCreateDialog(true)}
          >
            Nueva Campaña
          </Button>
        </Stack>
      </Box>

      {/* Descripción */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Envíos programados con fecha y hora:</strong> Carga un Excel con contactos, fechas y horas de envío. 
          El sistema enviará automáticamente los mensajes en las fechas y horas programadas (formato fecha: YYYY-MM-DD, hora: HH:MM). 
          Puedes reprogramar las campañas completadas.
        </Typography>
      </Alert>

      {/* Lista de Campañas */}
      <Grid container spacing={3}>
        {campaigns.map((campaign) => (
          <Grid item xs={12} md={6} key={campaign.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {campaign.nombre}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Creada: {new Date(campaign.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip 
                    label={campaign.estado} 
                    color={campaign.estado === 'activa' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {campaign.mensaje.substring(0, 100)}...
                  </Typography>
                </Box>

                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="h6" fontWeight="bold">{campaign.totalContactos}</Typography>
                      <Typography variant="caption">Total</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                        color: 'white',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="h6" fontWeight="bold">{campaign.enviados}</Typography>
                      <Typography variant="caption">Enviados</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        color: 'white',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="h6" fontWeight="bold">{campaign.pendientes}</Typography>
                      <Typography variant="caption">Pendientes</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        color: 'white',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="h6" fontWeight="bold">{campaign.errores}</Typography>
                      <Typography variant="caption">Errores</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <LinearProgress 
                  variant="determinate" 
                  value={(campaign.enviados / campaign.totalContactos) * 100} 
                  sx={{ mb: 2 }}
                />

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setSelectedCampaign(campaign);
                      setShowCampaignDetail(true);
                    }}
                  >
                    Ver Detalles
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Replay />}
                    onClick={() => reprogramCampaign(campaign.id)}
                  >
                    Reprogramar
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => deleteCampaign(campaign.id)}
                  >
                    <Delete />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {campaigns.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Schedule sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No hay campañas personalizadas
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Crea tu primera campaña con envíos programados
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setShowCreateDialog(true)}
            >
              Crear Primera Campaña
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog Crear Campaña */}
      <Dialog 
        open={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            📅 Nueva Campaña Personalizada
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Nombre de Campaña */}
            <TextField
              label="Nombre de la Campaña"
              fullWidth
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ej: Recordatorios de pago mensuales"
            />

            {/* Carga de Excel */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                1. Cargar Contactos desde Excel con Fecha y Hora
              </Typography>
              <Alert severity="info" sx={{ mb: 2, fontSize: '0.85rem' }}>
                <strong>Formato del Excel:</strong><br />
                • <strong>numero:</strong> Número con código de país (ej: 573001234567)<br />
                • <strong>nombre:</strong> Nombre del contacto<br />
                • <strong>dato1, dato2, dato3:</strong> Datos personalizados para usar en el mensaje<br />
                • <strong>fecha:</strong> Formato YYYY-MM-DD (ej: 2025-01-15)<br />
                • <strong>hora:</strong> Formato HH:MM en formato 24 horas (ej: 09:30, 14:45)
              </Alert>
              <Box
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                sx={{
                  border: '2px dashed',
                  borderColor: dragActive ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  bgcolor: dragActive ? 'action.hover' : 'background.paper',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onClick={() => document.getElementById('excel-input')?.click()}
              >
                <input
                  id="excel-input"
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" fontWeight="bold">
                  {excelFile ? excelFile.name : 'Arrastra o haz clic para cargar Excel'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Columnas requeridas: numero, nombre, dato1, dato2, dato3, fecha, hora
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Formato fecha: YYYY-MM-DD (ej: 2025-01-15) | Formato hora: HH:MM (ej: 09:30)
                </Typography>
              </Box>

              {contacts.length > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {contacts.length} contactos cargados correctamente
                </Alert>
              )}
            </Box>

            {/* Mensaje Template */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                2. Mensaje (usa variables)
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button size="small" onClick={() => insertVariable('nombre')}>
                  {'{nombre}'}
                </Button>
                <Button size="small" onClick={() => insertVariable('dato1')}>
                  {'{dato1}'}
                </Button>
                <Button size="small" onClick={() => insertVariable('dato2')}>
                  {'{dato2}'}
                </Button>
                <Button size="small" onClick={() => insertVariable('dato3')}>
                  {'{dato3}'}
                </Button>
                <Button
                  size="small"
                  startIcon={<InsertEmoticon />}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  Emojis
                </Button>
              </Stack>

              {showEmojiPicker && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {commonEmojis.map((emoji) => (
                      <Button
                        key={emoji}
                        size="small"
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              )}

              <TextField
                multiline
                rows={6}
                fullWidth
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Hola {nombre}, te recordamos que tu pago de {dato1} vence el día {dato2}. Gracias por tu preferencia 😊"
              />
            </Box>

            {/* Archivo Adjunto */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                3. Archivo Adjunto (Opcional)
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AttachFile />}
                component="label"
                fullWidth
              >
                {mediaFile ? mediaFile.name : 'Seleccionar Archivo'}
                <input
                  type="file"
                  hidden
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleMediaSelect}
                />
              </Button>
              {mediaPreview && mediaFile?.type.startsWith('image/') && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <img src={mediaPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200 }} />
                </Box>
              )}
            </Box>

            {/* Vista previa de contactos */}
            {contacts.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Vista Previa de Contactos
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Número</TableCell>
                        <TableCell>Nombre</TableCell>
                        <TableCell>Dato1</TableCell>
                        <TableCell>Dato2</TableCell>
                        <TableCell>Dato3</TableCell>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Hora</TableCell>
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contacts.slice(0, 5).map((contact, index) => (
                        <TableRow key={index}>
                          <TableCell>{contact.numero}</TableCell>
                          <TableCell>{contact.nombre}</TableCell>
                          <TableCell>{contact.dato1}</TableCell>
                          <TableCell>{contact.dato2}</TableCell>
                          <TableCell>{contact.dato3}</TableCell>
                          <TableCell>{contact.fecha}</TableCell>
                          <TableCell>{contact.hora}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={contact.estado}
                              color={getStatusColor(contact.estado)}
                              {...(getStatusIcon(contact.estado) ? { icon: getStatusIcon(contact.estado)! } : {})}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {contacts.length > 5 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Mostrando 5 de {contacts.length} contactos
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={createCampaign}
            disabled={loading || !campaignName || !messageTemplate || contacts.length === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <Send />}
          >
            {loading ? 'Creando...' : 'Crear Campaña'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Detalle de Campaña */}
      <Dialog
        open={showCampaignDetail}
        onClose={() => {
          setShowCampaignDetail(false);
          setSearchTerm('');
          setStatusFilter('todos');
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              {selectedCampaign?.nombre}
            </Typography>
            <Chip
              label={selectedCampaign?.estado}
              color={selectedCampaign?.estado === 'activa' ? 'success' : 'default'}
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedCampaign && (
            <Box>
              {/* Tarjetas de Estadísticas Modernas */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      borderRadius: 3,
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <Typography variant="h4" fontWeight="bold">{selectedCampaign.totalContactos}</Typography>
                    <Typography variant="body2">Total Contactos</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                      color: 'white',
                      borderRadius: 3,
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <CheckCircle sx={{ fontSize: 28, mb: 0.5 }} />
                    <Typography variant="h4" fontWeight="bold">{selectedCampaign.enviados}</Typography>
                    <Typography variant="body2">Enviados</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: 'white',
                      borderRadius: 3,
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <HourglassEmpty sx={{ fontSize: 28, mb: 0.5 }} />
                    <Typography variant="h4" fontWeight="bold">{selectedCampaign.pendientes}</Typography>
                    <Typography variant="body2">Pendientes</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                      color: 'white',
                      borderRadius: 3,
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-4px)' }
                    }}
                  >
                    <Cancel sx={{ fontSize: 28, mb: 0.5 }} />
                    <Typography variant="h4" fontWeight="bold">{selectedCampaign.errores}</Typography>
                    <Typography variant="body2">Errores</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Mensaje:</strong> {selectedCampaign.mensaje}
                </Typography>
              </Alert>

              {/* Buscador y Filtros */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="Buscar por nombre, número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                    endAdornment: searchTerm && (
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <Clear fontSize="small" />
                      </IconButton>
                    )
                  }}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Estado</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Estado"
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <MenuItem value="todos">Todos</MenuItem>
                    <MenuItem value="pendiente">Pendientes</MenuItem>
                    <MenuItem value="enviado">Enviados</MenuItem>
                    <MenuItem value="error">Errores</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Número</TableCell>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Dato1</TableCell>
                      <TableCell>Dato2</TableCell>
                      <TableCell>Dato3</TableCell>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Hora</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell align="center">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedCampaign.contactos
                      .filter((contact) => {
                        const matchesSearch =
                          contact.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          contact.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          contact.dato1.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesStatus = statusFilter === 'todos' || contact.estado === statusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .map((contact, index) => (
                        <TableRow
                          key={index}
                          sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <TableCell>{contact.numero}</TableCell>
                          <TableCell>{contact.nombre}</TableCell>
                          <TableCell>{contact.dato1}</TableCell>
                          <TableCell>{contact.dato2}</TableCell>
                          <TableCell>{contact.dato3}</TableCell>
                          <TableCell>{contact.fecha}</TableCell>
                          <TableCell>{contact.hora}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={contact.estado}
                              color={getStatusColor(contact.estado)}
                              {...(getStatusIcon(contact.estado) ? { icon: getStatusIcon(contact.estado)! } : {})}
                            />
                            {contact.errorMessage && (
                              <Tooltip title={contact.errorMessage}>
                                <ErrorIcon fontSize="small" color="error" sx={{ ml: 0.5 }} />
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Editar">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {
                                    setEditingContact(contact);
                                    setShowEditDialog(true);
                                  }}
                                  disabled={contact.estado === 'enviado'}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    showConfirm(
                                      'Eliminar contacto',
                                      '¿Estás seguro de eliminar este contacto de la campaña?',
                                      async () => {
                                        const success = await deleteContactFromCampaign(selectedCampaign.id, contact.numero);
                                        if (success) {
                                          const updatedContacts = selectedCampaign.contactos.filter((_, i) => i !== index);
                                          setSelectedCampaign({
                                            ...selectedCampaign,
                                            contactos: updatedContacts,
                                            totalContactos: updatedContacts.length,
                                            pendientes: updatedContacts.filter(c => c.estado === 'pendiente').length,
                                            enviados: updatedContacts.filter(c => c.estado === 'enviado').length,
                                            errores: updatedContacts.filter(c => c.estado === 'error').length
                                          });
                                        }
                                      },
                                      'Eliminar',
                                      'Cancelar'
                                    );
                                  }}
                                  disabled={contact.estado === 'enviado'}
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

              {selectedCampaign.contactos.filter((contact) => {
                const matchesSearch = 
                  contact.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  contact.nombre.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesStatus = statusFilter === 'todos' || contact.estado === statusFilter;
                return matchesSearch && matchesStatus;
              }).length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    No se encontraron contactos con los filtros aplicados
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowCampaignDetail(false);
            setSearchTerm('');
            setStatusFilter('todos');
          }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Editar Contacto */}
      <Dialog
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingContact(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar Contacto</DialogTitle>
        <DialogContent>
          {editingContact && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Número"
                value={editingContact.numero}
                onChange={(e) => setEditingContact({ ...editingContact, numero: e.target.value })}
                fullWidth
              />
              <TextField
                label="Nombre"
                value={editingContact.nombre}
                onChange={(e) => setEditingContact({ ...editingContact, nombre: e.target.value })}
                fullWidth
              />
              <TextField
                label="Dato 1"
                value={editingContact.dato1}
                onChange={(e) => setEditingContact({ ...editingContact, dato1: e.target.value })}
                fullWidth
              />
              <TextField
                label="Dato 2"
                value={editingContact.dato2}
                onChange={(e) => setEditingContact({ ...editingContact, dato2: e.target.value })}
                fullWidth
              />
              <TextField
                label="Dato 3"
                value={editingContact.dato3}
                onChange={(e) => setEditingContact({ ...editingContact, dato3: e.target.value })}
                fullWidth
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Fecha de Envío"
                    type="date"
                    value={editingContact.fecha}
                    onChange={(e) => setEditingContact({ ...editingContact, fecha: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Hora de Envío"
                    type="time"
                    value={editingContact.hora}
                    onChange={(e) => setEditingContact({ ...editingContact, hora: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEditDialog(false);
            setEditingContact(null);
          }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (editingContact && selectedCampaign) {
                // Actualizar en el servidor
                const success = await updateContactInCampaign(selectedCampaign.id, editingContact);
                
                if (success) {
                  // Actualizar estado local solo si el servidor confirma
                  const updatedContacts = selectedCampaign.contactos.map(c =>
                    c.numero === editingContact.numero ? editingContact : c
                  );
                  setSelectedCampaign({
                    ...selectedCampaign,
                    contactos: updatedContacts
                  });
                  setShowEditDialog(false);
                  setEditingContact(null);
                  
                  // Recargar campañas para reflejar cambios
                  loadCampaigns();
                }
              }
            }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Guardar Cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Componentes de notificaciones modernas */}
      <ModernNotification
        open={notification.open}
        onClose={closeNotification}
        message={notification.message}
        title={notification.title}
        type={notification.type}
        duration={notification.duration}
      />

      <ModernAlert
        open={modernAlert.open}
        onClose={closeAlert}
        onConfirm={modernAlert.onConfirm}
        title={modernAlert.title}
        message={modernAlert.message}
        type={modernAlert.type}
        confirmText={modernAlert.confirmText}
        cancelText={modernAlert.cancelText}
        confirmColor={modernAlert.confirmColor}
      />
    </Box>
  );
};

export default PersonalizedCampaignModule;
