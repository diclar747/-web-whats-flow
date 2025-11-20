import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Grid, 
  TextField, 
  FormControl, 
  InputLabel, 
  MenuItem, 
  Select,
  Divider,
  Card,
  CardContent,
  CardActions,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Snackbar,
  Stack,
  useTheme,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  Send as SendIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  Campaign as CampaignIcon,
  FileUpload as FileUploadIcon,
  ArrowBack as ArrowBackIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { schedulingService } from '../services/api';

interface CampaignsProps {
  onLogout: () => void;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  recipientsCount: number;
  scheduledTime: string;
  status?: string;
  sentCount?: number;
  deliveredCount?: number;
  readCount?: number;
  responseCount?: number;
}

interface Recipient {
  name: string;
  number: string;
}

const Campaigns: React.FC<CampaignsProps> = ({ onLogout }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [openNewCampaign, setOpenNewCampaign] = useState(false);
  const [openViewCampaign, setOpenViewCampaign] = useState(false);
  const [openEditCampaign, setOpenEditCampaign] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scheduledTime, setScheduledTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [recipientInput, setRecipientInput] = useState({ name: '', number: '' });
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Estado de ejemplo
  React.useEffect(() => {
    // En un sistema real, aquí cargaríamos campañas desde la API
    setCampaigns([
      {
        id: '1',
        name: 'Campaña de Bienvenida',
        message: 'Hola {nombre}, bienvenido a nuestro servicio. Estamos encantados de tenerte con nosotros. No dudes en contactarnos si necesitas ayuda.',
        recipientsCount: 120,
        scheduledTime: '2023-08-01T09:00:00',
        status: 'Completada',
        sentCount: 120,
        deliveredCount: 118,
        readCount: 95,
        responseCount: 42
      },
      {
        id: '2',
        name: 'Promoción de Verano',
        message: 'Hola {nombre}, no te pierdas nuestras ofertas de verano con descuentos de hasta el 50%. ¡Válido solo hasta fin de mes!',
        recipientsCount: 250,
        scheduledTime: '2023-08-15T10:30:00',
        status: 'Pendiente'
      },
      {
        id: '3',
        name: 'Recordatorio de Cita',
        message: 'Hola {nombre}, te recordamos tu cita programada para mañana a las 10:00 AM. Por favor confirma tu asistencia.',
        recipientsCount: 45,
        scheduledTime: '2023-08-10T08:00:00',
        status: 'Completada',
        sentCount: 45,
        deliveredCount: 45,
        readCount: 40,
        responseCount: 38
      }
    ]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls', '.xlsx']
    },
    onDrop: (acceptedFiles) => {
      setSelectedFile(acceptedFiles[0]);
      // En un sistema real, aquí procesaríamos el archivo para extraer destinatarios
      // Simulamos agregar destinatarios de ejemplo
      const newRecipients: Recipient[] = [
        { name: 'Juan Pérez', number: '5521234567' },
        { name: 'María García', number: '5587654321' },
        { name: 'Carlos López', number: '5599887766' },
      ];
      setRecipients([...recipients, ...newRecipients]);
    }
  });

  const handleAddRecipient = () => {
    if (recipientInput.name && recipientInput.number) {
      setRecipients([...recipients, { ...recipientInput }]);
      setRecipientInput({ name: '', number: '' });
    }
  };

  const handleRemoveRecipient = (index: number) => {
    const updatedRecipients = [...recipients];
    updatedRecipients.splice(index, 1);
    setRecipients(updatedRecipients);
  };

  const handleViewCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setOpenViewCampaign(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCampaignName(campaign.name);
    setMessage(campaign.message);
    setScheduledTime(campaign.scheduledTime);
    // En un sistema real, cargaríamos los destinatarios de esta campaña
    setRecipients([
      { name: 'Juan Pérez', number: '5521234567' },
      { name: 'María García', number: '5587654321' }
    ]);
    setOpenEditCampaign(true);
  };

  const handleDeleteCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setOpenDeleteConfirm(true);
  };

  const confirmDeleteCampaign = () => {
    if (selectedCampaign) {
      // En un sistema real, llamaríamos a la API para eliminar la campaña
      setCampaigns(campaigns.filter(c => c.id !== selectedCampaign.id));
      setAlertMessage('Campaña eliminada con éxito');
      setAlertSeverity('success');
      setShowAlert(true);
      setOpenDeleteConfirm(false);
    }
  };

  const handleDuplicateCampaign = (campaign: Campaign) => {
    const newCampaign: Campaign = {
      ...campaign,
      id: Math.random().toString(36).substring(2, 9),
      name: `${campaign.name} (Copia)`,
      status: 'Pendiente',
      scheduledTime: new Date(Date.now() + 86400000).toISOString() // Mañana
    };
    
    setCampaigns([...campaigns, newCampaign]);
    setAlertMessage('Campaña duplicada con éxito');
    setAlertSeverity('success');
    setShowAlert(true);
  };

  const handleUpdateCampaign = async () => {
    if (!selectedCampaign || !campaignName || !message || recipients.length === 0) {
      setAlertMessage('Por favor completa todos los campos requeridos');
      setAlertSeverity('error');
      setShowAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      // En un sistema real, llamaríamos a la API para actualizar la campaña
      const updatedCampaign: Campaign = {
        ...selectedCampaign,
        name: campaignName,
        message: message,
        recipientsCount: recipients.length,
        scheduledTime: scheduledTime || new Date().toISOString()
      };
      
      setCampaigns(campaigns.map(c =>
        c.id === selectedCampaign.id ? updatedCampaign : c
      ));
      
      // Resetear el formulario
      setCampaignName('');
      setMessage('');
      setRecipients([]);
      setSelectedFile(null);
      setScheduledTime('');
      
      // Cerrar el diálogo
      setOpenEditCampaign(false);
      
      // Mostrar mensaje de éxito
      setAlertMessage('Campaña actualizada con éxito');
      setAlertSeverity('success');
      setShowAlert(true);
    } catch (error) {
      console.error('Error al actualizar campaña:', error);
      setAlertMessage('Error al actualizar la campaña');
      setAlertSeverity('error');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || !message || recipients.length === 0) {
      setAlertMessage('Por favor completa todos los campos requeridos');
      setAlertSeverity('error');
      setShowAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      // Preparar números para la API
      const recipientNumbers = recipients.map(r => r.number);
      
      const response = await schedulingService.createCampaign(
        campaignName,
        message,
        recipientNumbers,
        scheduledTime || undefined
      );

      if (response.success) {
        // Agregar la nueva campaña a la lista
        const newCampaign: Campaign = {
          id: response.campaign.id,
          name: campaignName,
          message: message,
          recipientsCount: recipients.length,
          scheduledTime: scheduledTime || new Date().toISOString(),
          status: 'Pendiente'
        };
        
        setCampaigns([...campaigns, newCampaign]);
        
        // Resetear el formulario
        setCampaignName('');
        setMessage('');
        setRecipients([]);
        setSelectedFile(null);
        setScheduledTime('');
        
        // Cerrar el diálogo
        setOpenNewCampaign(false);
        
        // Mostrar mensaje de éxito
        setAlertMessage('Campaña creada con éxito');
        setAlertSeverity('success');
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error al crear campaña:', error);
      setAlertMessage('Error al crear la campaña');
      setAlertSeverity('error');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton 
            color="inherit" 
            edge="start" 
            sx={{ mr: 2 }}
            onClick={() => navigate('/dashboard')}
          >
            <ArrowBackIcon />
          </IconButton>
          <CampaignIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Campañas de WhatsApp
          </Typography>
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 5, mb: 5 }}>
        <Paper sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">Gestión de Campañas</Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => setOpenNewCampaign(true)}
            >
              Nueva Campaña
            </Button>
          </Box>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Crea, gestiona y programa campañas de WhatsApp para envíos masivos a tus contactos.
          </Typography>

          {campaigns.length > 0 ? (
            <TableContainer component={Paper} sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
                    <TableCell sx={{ color: 'white' }}>Nombre</TableCell>
                    <TableCell sx={{ color: 'white' }}>Destinatarios</TableCell>
                    <TableCell sx={{ color: 'white' }}>Programada para</TableCell>
                    <TableCell sx={{ color: 'white' }}>Estado</TableCell>
                    <TableCell sx={{ color: 'white' }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id} hover>
                      <TableCell>{campaign.name}</TableCell>
                      <TableCell>{campaign.recipientsCount}</TableCell>
                      <TableCell>{formatDateTime(campaign.scheduledTime)}</TableCell>
                      <TableCell>
                        <Chip
                          label={campaign.status}
                          color={campaign.status === 'Completada' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleViewCampaign(campaign)}
                          title="Ver detalles"
                        >
                          <SearchIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditCampaign(campaign)}
                          title="Editar campaña"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handleDuplicateCampaign(campaign)}
                          title="Duplicar campaña"
                        >
                          <ContentCopyIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteCampaign(campaign)}
                          title="Eliminar campaña"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <CampaignIcon sx={{ fontSize: 60, color: 'primary.main', opacity: 0.4, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No hay campañas creadas
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Crea tu primera campaña para comenzar a enviar mensajes masivos
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => setOpenNewCampaign(true)}
              >
                Nueva Campaña
              </Button>
            </Box>
          )}

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Consejos para Campañas</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography paragraph>
                Las campañas son una forma efectiva de enviar mensajes masivos a tus contactos. Aquí tienes algunos consejos:
              </Typography>
              <ul>
                <li>Personaliza los mensajes incluyendo el nombre del destinatario</li>
                <li>Evita enviar demasiadas campañas en un corto período de tiempo</li>
                <li>Programa tus campañas en horarios adecuados para tu audiencia</li>
                <li>Mantén mensajes concisos y directos para mayor efectividad</li>
              </ul>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Container>

      {/* Diálogo para crear nueva campaña */}
      <Dialog 
        open={openNewCampaign}
        onClose={() => !isLoading && setOpenNewCampaign(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CampaignIcon sx={{ mr: 1 }} />
            Crear Nueva Campaña
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Nombre de la Campaña"
                fullWidth
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Mensaje"
                fullWidth
                multiline
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder="Escribe el mensaje que se enviará a todos los destinatarios..."
                helperText="Tip: Usa {nombre} para personalizar el mensaje con el nombre del destinatario"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fecha y Hora de Envío"
                type="datetime-local"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                helperText="Dejar en blanco para envío inmediato"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Chip label="Destinatarios" />
              </Divider>
            </Grid>

            <Grid item xs={12}>
              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  mb: 2
                }}
              >
                <input {...getInputProps()} />
                <FileUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Arrastra un archivo CSV o Excel con los contactos
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  O haz clic para seleccionar un archivo
                </Typography>
                {selectedFile && (
                  <Chip 
                    label={selectedFile.name} 
                    variant="outlined" 
                    color="primary" 
                    sx={{ mt: 2 }} 
                  />
                )}
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Nombre"
                fullWidth
                value={recipientInput.name}
                onChange={(e) => setRecipientInput({ ...recipientInput, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex' }}>
                <TextField
                  label="Número de Teléfono"
                  fullWidth
                  value={recipientInput.number}
                  onChange={(e) => setRecipientInput({ ...recipientInput, number: e.target.value })}
                  placeholder="Ej: 5521234567"
                />
                <Button 
                  variant="contained" 
                  sx={{ ml: 1 }} 
                  onClick={handleAddRecipient}
                >
                  <AddIcon />
                </Button>
              </Box>
            </Grid>

            {recipients.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Destinatarios ({recipients.length})
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                  {recipients.map((recipient, index) => (
                    <Chip
                      key={index}
                      label={`${recipient.name} (${recipient.number})`}
                      onDelete={() => handleRemoveRecipient(index)}
                      sx={{ m: 0.5 }}
                    />
                  ))}
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenNewCampaign(false)} 
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            startIcon={isLoading ? <CircularProgress size={20} /> : <SendIcon />}
            onClick={handleCreateCampaign}
            disabled={isLoading || !campaignName || !message || recipients.length === 0}
          >
            {isLoading ? 'Creando...' : 'Crear Campaña'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para ver detalles de campaña */}
      <Dialog
        open={openViewCampaign}
        onClose={() => setOpenViewCampaign(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedCampaign && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CampaignIcon sx={{ mr: 1 }} />
                Detalles de Campaña: {selectedCampaign.name}
                <Box sx={{ ml: 2 }}>
                  <Chip
                    label={selectedCampaign.status}
                    color={selectedCampaign.status === 'Completada' ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>Mensaje:</Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body1">{selectedCampaign.message}</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" gutterBottom>Programada para:</Typography>
                  <Typography variant="body1">{formatDateTime(selectedCampaign.scheduledTime)}</Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle1" gutterBottom>Destinatarios:</Typography>
                  <Typography variant="body1">{selectedCampaign.recipientsCount}</Typography>
                </Grid>
                
                {selectedCampaign.status === 'Completada' && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Estadísticas</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Paper sx={{ p: 2, textAlign: 'center', flexGrow: 1, mx: 1 }}>
                        <Typography variant="h4" color="primary">{selectedCampaign.sentCount}</Typography>
                        <Typography variant="body2">Enviados</Typography>
                      </Paper>
                      <Paper sx={{ p: 2, textAlign: 'center', flexGrow: 1, mx: 1 }}>
                        <Typography variant="h4" color="primary">{selectedCampaign.deliveredCount}</Typography>
                        <Typography variant="body2">Entregados</Typography>
                      </Paper>
                      <Paper sx={{ p: 2, textAlign: 'center', flexGrow: 1, mx: 1 }}>
                        <Typography variant="h4" color="primary">{selectedCampaign.readCount}</Typography>
                        <Typography variant="body2">Leídos</Typography>
                      </Paper>
                      <Paper sx={{ p: 2, textAlign: 'center', flexGrow: 1, mx: 1 }}>
                        <Typography variant="h4" color="primary">{selectedCampaign.responseCount}</Typography>
                        <Typography variant="body2">Respuestas</Typography>
                      </Paper>
                    </Box>
                    
                    {/* Gráfico de tasa de apertura (simulado) */}
                    <Box sx={{ mt: 4, p: 2, border: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: 1 }}>
                      <Typography variant="subtitle1" gutterBottom>Tasa de apertura</Typography>
                      <Box sx={{ height: 20, bgcolor: 'background.default', borderRadius: 1, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${(selectedCampaign.readCount || 0) / (selectedCampaign.sentCount || 1) * 100}%`,
                            bgcolor: 'primary.main'
                          }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {Math.round((selectedCampaign.readCount || 0) / (selectedCampaign.sentCount || 1) * 100)}% de mensajes leídos
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenViewCampaign(false)}>Cerrar</Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setOpenViewCampaign(false);
                  handleEditCampaign(selectedCampaign);
                }}
              >
                Editar Campaña
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Diálogo para editar campaña */}
      <Dialog
        open={openEditCampaign}
        onClose={() => !isLoading && setOpenEditCampaign(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <EditIcon sx={{ mr: 1 }} />
            Editar Campaña
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Nombre de la Campaña"
                fullWidth
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Mensaje"
                fullWidth
                multiline
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder="Escribe el mensaje que se enviará a todos los destinatarios..."
                helperText="Tip: Usa {nombre} para personalizar el mensaje con el nombre del destinatario"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fecha y Hora de Envío"
                type="datetime-local"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                helperText="Dejar en blanco para envío inmediato"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Chip label="Destinatarios" />
              </Divider>
            </Grid>

            <Grid item xs={12}>
              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  mb: 2
                }}
              >
                <input {...getInputProps()} />
                <FileUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Arrastra un archivo CSV o Excel con los contactos
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  O haz clic para seleccionar un archivo
                </Typography>
                {selectedFile && (
                  <Chip
                    label={selectedFile.name}
                    variant="outlined"
                    color="primary"
                    sx={{ mt: 2 }}
                  />
                )}
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Nombre"
                fullWidth
                value={recipientInput.name}
                onChange={(e) => setRecipientInput({ ...recipientInput, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex' }}>
                <TextField
                  label="Número de Teléfono"
                  fullWidth
                  value={recipientInput.number}
                  onChange={(e) => setRecipientInput({ ...recipientInput, number: e.target.value })}
                  placeholder="Ej: 5521234567"
                />
                <Button
                  variant="contained"
                  sx={{ ml: 1 }}
                  onClick={handleAddRecipient}
                >
                  <AddIcon />
                </Button>
              </Box>
            </Grid>

            {recipients.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Destinatarios ({recipients.length})
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                  {recipients.map((recipient, index) => (
                    <Chip
                      key={index}
                      label={`${recipient.name} (${recipient.number})`}
                      onDelete={() => handleRemoveRecipient(index)}
                      sx={{ m: 0.5 }}
                    />
                  ))}
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenEditCampaign(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleUpdateCampaign}
            disabled={isLoading || !campaignName || !message || recipients.length === 0}
          >
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <Dialog
        open={openDeleteConfirm}
        onClose={() => setOpenDeleteConfirm(false)}
      >
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que deseas eliminar la campaña "{selectedCampaign?.name}"? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteCampaign}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={showAlert} 
        autoHideDuration={6000} 
        onClose={() => setShowAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowAlert(false)} 
          severity={alertSeverity}
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Campaigns;