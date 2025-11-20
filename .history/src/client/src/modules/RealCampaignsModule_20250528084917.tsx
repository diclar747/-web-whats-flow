import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Paper,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stack,
  Tab,
  Tabs,
  Switch,
  Checkbox,
  ListItemButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CampaignOutlined,
  Add,
  Send,
  Schedule,
  People,
  PlayArrow,
  Pause,
  Delete,
  Error,
  CheckCircle,
  Smartphone,
  Bolt,
  AccessTime,
  Group,
  Folder,
  ExpandMore,
  PersonAdd,
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { io, Socket } from 'socket.io-client';

interface RealCampaignsModuleProps {
  sessionId: string;
}

interface Contact {
  id: string;
  phone: string;
  name: string;
  category: string;
  tags: string[];
  groupIds: string[];
  addedAt: string;
}

interface ContactGroup {
  id: string;
  name: string;
  description: string;
  contactIds: string[];
  createdAt: string;
  color: string;
}

interface CampaignContact {
  phone: string;
  name: string;
  variables?: { [key: string]: string };
}

interface CampaignMessage {
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
}

interface CampaignData {
  id: string;
  name: string;
  type: 'direct' | 'scheduled';
  status: 'draft' | 'sending' | 'completed' | 'failed' | 'paused' | 'scheduled';
  message: CampaignMessage;
  contacts: CampaignContact[];
  scheduledAt?: string;
  progress: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTime?: string;
  useIdFlow?: boolean;
  useRandomTiming?: boolean;
  flowConfig?: {
    messagesCount: number;
    timeSpanMinutes: number;
  };
}

const RealCampaignsModule: React.FC<RealCampaignsModuleProps> = ({ sessionId }) => {
  const { isDarkMode } = useTheme();
  
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendingProgress, setSendingProgress] = useState<{[key: string]: number}>({});
  const [currentTab, setCurrentTab] = useState(0);
  
  // Estados para manejo de contactos y grupos
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [contactSelectionMode, setContactSelectionMode] = useState<'manual' | 'groups'>('manual');
  
  const [newCampaign, setNewCampaign] = useState<Partial<CampaignData>>({
    name: '',
    type: 'direct',
    message: { text: 'Hola {nombre}, como estas?' },
    contacts: [],
    status: 'draft',
    useIdFlow: false,
    useRandomTiming: false,
    flowConfig: {
      messagesCount: 5,
      timeSpanMinutes: 5
    }
  });
  
  const [contactsInput, setContactsInput] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');

  const loadCampaigns = useCallback(() => {
    try {
      const savedCampaigns = localStorage.getItem(`campaigns_${sessionId}`);
      if (savedCampaigns) {
        setCampaigns(JSON.parse(savedCampaigns));
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
    }
  }, [sessionId]);

  const loadContacts = useCallback(() => {
    try {
      const savedContacts = localStorage.getItem(`contacts_${sessionId}`);
      if (savedContacts) {
        setContacts(JSON.parse(savedContacts));
      }
    } catch (error) {
      console.error('Error cargando contactos:', error);
    }
  }, [sessionId]);

  const loadContactGroups = useCallback(() => {
    try {
      const savedGroups = localStorage.getItem(`groups_${sessionId}`);
      if (savedGroups) {
        setContactGroups(JSON.parse(savedGroups));
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  }, [sessionId]);

  const updateMessagePreview = useCallback(() => {
    if (newCampaign.message?.text && newCampaign.contacts && newCampaign.contacts.length > 0) {
      const firstContact = newCampaign.contacts[0];
      let preview = newCampaign.message.text;
      
      if (firstContact.variables) {
        Object.keys(firstContact.variables).forEach(key => {
          const regex = new RegExp(`{${key}}`, 'g');
          preview = preview.replace(regex, firstContact.variables![key]);
        });
      }
      
      setPreviewMessage(preview);
    } else {
      setPreviewMessage(newCampaign.message?.text || '');
    }
  }, [newCampaign.message?.text, newCampaign.contacts]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    loadContactGroups();
  }, [loadContactGroups]);

  useEffect(() => {
    updateMessagePreview();
  }, [updateMessagePreview]);

  const saveCampaigns = (campaignsToSave: CampaignData[]) => {
    localStorage.setItem(`campaigns_${sessionId}`, JSON.stringify(campaignsToSave));
  };

  // Función para generar ID FLOW de tamaño variable
  const generateIdFlow = (size: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < size; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Función para generar tamaños de ID FLOW variables
  const getIdFlowSizes = (totalMessages: number): number[] => {
    const baseSizes = [64, 45, 32, 28, 56, 40, 35, 48, 52, 38];
    const sizes: number[] = [];
    
    for (let i = 0; i < totalMessages; i++) {
      if (i < baseSizes.length) {
        sizes.push(baseSizes[i]);
      } else {
        // Generar tamaños aleatorios entre 20 y 64
        sizes.push(Math.floor(Math.random() * (64 - 20 + 1)) + 20);
      }
    }
    return sizes;
  };

  // Función para calcular distribución temporal aleatoria
  const calculateTimeDistribution = (messagesCount: number, timeSpanMinutes: number): number[] => {
    const delays: number[] = [];
    const totalTimeMs = timeSpanMinutes * 60 * 1000; // Convertir a millisegundos
    
    // Generar tiempos aleatorios dentro del rango
    for (let i = 0; i < messagesCount; i++) {
      const randomDelay = Math.random() * totalTimeMs;
      delays.push(randomDelay);
    }
    
    // Ordenar para envío secuencial
    return delays.sort((a, b) => a - b);
  };

  const parseContacts = (input: string): CampaignContact[] => {
    const lines = input.trim().split('\n');
    const contacts: CampaignContact[] = [];
    
    lines.forEach((line, index) => {
      if (line.trim()) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const phone = parts[0];
          const name = parts[1];
          
          if (phone.match(/^\+?[1-9]\d{1,14}$/)) {
            contacts.push({
              phone: phone.startsWith('+') ? phone : `+${phone}`,
              name: name,
              variables: { nombre: name }
            });
          } else {
            console.warn(`Línea ${index + 1}: Número inválido: ${phone}`);
          }
        } else {
          console.warn(`Línea ${index + 1}: Formato incorrecto. Use: numero,nombre`);
        }
      }
    });
    
    return contacts;
  };

  const handleContactsInput = (input: string) => {
    setContactsInput(input);
    const contacts = parseContacts(input);
    setNewCampaign(prev => ({ ...prev, contacts }));
  };

  const handleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      const newSelection = prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId];
      
      // Convertir grupos seleccionados a contactos de campaña
      const groupContacts: CampaignContact[] = [];
      newSelection.forEach(gId => {
        const group = contactGroups.find(g => g.id === gId);
        if (group) {
          group.contactIds.forEach(contactId => {
            const contact = contacts.find(c => c.id === contactId);
            if (contact) {
              groupContacts.push({
                phone: contact.phone,
                name: contact.name,
                variables: { nombre: contact.name }
              });
            }
          });
        }
      });
      
      // Eliminar duplicados
      const uniqueContacts = groupContacts.filter((contact, index, self) => 
        index === self.findIndex(c => c.phone === contact.phone)
      );
      
      setNewCampaign(prev => ({ ...prev, contacts: uniqueContacts }));
      return newSelection;
    });
  };

  const getSelectedContactsCount = (): number => {
    if (contactSelectionMode === 'groups') {
      let totalContacts = 0;
      selectedGroups.forEach(groupId => {
        const group = contactGroups.find(g => g.id === groupId);
        if (group) {
          totalContacts += group.contactIds.length;
        }
      });
      return totalContacts;
    }
    return newCampaign.contacts?.length || 0;
  };

  const createCampaign = () => {
    if (!newCampaign.name || !newCampaign.message?.text || !newCampaign.contacts?.length) {
      setError('Complete todos los campos requeridos');
      return;
    }

    const campaign: CampaignData = {
      id: Date.now().toString(),
      name: newCampaign.name,
      type: newCampaign.type || 'direct',
      status: 'draft',
      message: newCampaign.message,
      contacts: newCampaign.contacts,
      scheduledAt: newCampaign.scheduledAt,
      progress: {
        total: newCampaign.contacts.length,
        sent: 0,
        delivered: 0,
        failed: 0
      },
      createdAt: new Date().toISOString(),
      useIdFlow: newCampaign.useIdFlow || false,
      useRandomTiming: newCampaign.useRandomTiming || false,
      flowConfig: newCampaign.flowConfig
    };

    const updatedCampaigns = [...campaigns, campaign];
    setCampaigns(updatedCampaigns);
    saveCampaigns(updatedCampaigns);

    // Limpiar formulario
    resetCampaignForm();
    setShowCreateDialog(false);
    setSuccess(`Campaña "${campaign.name}" creada exitosamente`);
  };

  const resetCampaignForm = () => {
    setNewCampaign({
      name: '',
      type: 'direct',
      message: { text: 'Hola {nombre}, como estas?' },
      contacts: [],
      status: 'draft',
      useIdFlow: false,
      useRandomTiming: false,
      flowConfig: {
        messagesCount: 5,
        timeSpanMinutes: 5
      }
    });
    setContactsInput('');
    setSelectedGroups([]);
    setContactSelectionMode('manual');
    setActiveStep(0);
    setPreviewMessage('');
  };

  const startCampaign = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    const updatedCampaigns = campaigns.map(c => 
      c.id === campaignId 
        ? { ...c, status: 'sending' as const, startedAt: new Date().toISOString() }
        : c
    );
    setCampaigns(updatedCampaigns);
    saveCampaigns(updatedCampaigns);

    let sent = 0;
    let failed = 0;

    try {
      // Configurar distribución temporal si usa flow
      let timeDistribution: number[] = [];
      let idFlowSizes: number[] = [];
      
      if (campaign.useRandomTiming && campaign.flowConfig) {
        timeDistribution = calculateTimeDistribution(
          campaign.flowConfig.messagesCount, 
          campaign.flowConfig.timeSpanMinutes
        );
      }
      
      if (campaign.useIdFlow) {
        idFlowSizes = getIdFlowSizes(campaign.contacts.length);
      }

      const startTime = Date.now();

      for (let i = 0; i < campaign.contacts.length; i++) {
        const contact = campaign.contacts[i];
        
        try {
          // Personalizar mensaje
          let personalizedMessage = campaign.message.text;
          if (contact.variables) {
            Object.keys(contact.variables).forEach(key => {
              const regex = new RegExp(`{${key}}`, 'g');
              personalizedMessage = personalizedMessage.replace(regex, contact.variables![key]);
            });
          }

          // Agregar ID FLOW si está habilitado
          if (campaign.useIdFlow && idFlowSizes[i]) {
            const idFlow = generateIdFlow(idFlowSizes[i]);
            personalizedMessage += `\n\nID: ${idFlow}`;
          }

          // Calcular delay
          let delayMs = 0;
          if (campaign.useRandomTiming && campaign.flowConfig && timeDistribution[i]) {
            // Usar distribución temporal aleatoria
            delayMs = timeDistribution[i];
          } else {
            // Usar delay fijo de 3 segundos por defecto
            delayMs = i * 3000; // 3 segundos entre cada mensaje
          }

          // Esperar el tiempo calculado
          if (i > 0) {
            const currentTime = Date.now();
            const expectedTime = startTime + delayMs;
            const waitTime = Math.max(0, expectedTime - currentTime);
            
            if (waitTime > 0) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }

          // Enviar mensaje
          const response = await fetch('http://localhost:3002/api/send/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId,
              number: contact.phone.replace('+', '') + '@c.us',
              message: personalizedMessage
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            sent++;
            console.log(`✅ Mensaje enviado a ${contact.name} (${contact.phone})${campaign.useIdFlow ? ` - ID Flow: ${idFlowSizes[i]} chars` : ''}`);
          } else {
            failed++;
            console.error(`❌ Error enviando a ${contact.name}: ${data.message}`);
          }

          // Actualizar progreso
          const progress = Math.round(((sent + failed) / campaign.contacts.length) * 100);
          setSendingProgress(prev => ({ ...prev, [campaignId]: progress }));

          // Actualizar campaña con progreso
          const currentCampaigns = [...campaigns];
          const campaignIndex = currentCampaigns.findIndex(c => c.id === campaignId);
          if (campaignIndex !== -1) {
            currentCampaigns[campaignIndex].progress = {
              total: campaign.contacts.length,
              sent,
              delivered: sent,
              failed
            };
            setCampaigns(currentCampaigns);
            saveCampaigns(currentCampaigns);
          }

        } catch (error) {
          failed++;
          console.error(`Error enviando mensaje a ${contact.name}:`, error);
        }
      }

      // Campaña completada
      const finalCampaigns = campaigns.map(c => 
        c.id === campaignId 
          ? { 
              ...c, 
              status: 'completed' as const, 
              completedAt: new Date().toISOString(),
              progress: { total: campaign.contacts.length, sent, delivered: sent, failed }
            }
          : c
      );
      setCampaigns(finalCampaigns);
      saveCampaigns(finalCampaigns);
      
      setSendingProgress(prev => ({ ...prev, [campaignId]: 100 }));
      const options = [];
      if (campaign.useIdFlow) options.push('ID Flow');
      if (campaign.useRandomTiming) options.push('Envío Aleatorio');
      const optionsText = options.length > 0 ? ` (con ${options.join(' + ')})` : '';
      setSuccess(`Campaña completada: ${sent} enviados, ${failed} fallidos${optionsText}`);

    } catch (error) {
      console.error('Error en campaña:', error);
      setError('Error durante el envío de la campaña');
      
      const failedCampaigns = campaigns.map(c => 
        c.id === campaignId ? { ...c, status: 'failed' as const } : c
      );
      setCampaigns(failedCampaigns);
      saveCampaigns(failedCampaigns);
    }
  };

  const deleteCampaign = (campaignId: string) => {
    const updatedCampaigns = campaigns.filter(c => c.id !== campaignId);
    setCampaigns(updatedCampaigns);
    saveCampaigns(updatedCampaigns);
    setSuccess('Campaña eliminada');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'sending': return 'info';
      case 'failed': return 'error';
      case 'paused': return 'warning';
      case 'scheduled': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'sending': return <Send />;
      case 'failed': return <Error />;
      case 'paused': return <Pause />;
      case 'scheduled': return <Schedule />;
      default: return <CampaignOutlined />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              📢 Campañas WhatsApp
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Envía mensajes personalizados masivos a tus contactos
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowCreateDialog(true)}
            sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008069' } }}
          >
            Nueva Campaña
          </Button>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Chip
            icon={<CampaignOutlined />}
            label={`${campaigns.length} campañas`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<Send />}
            label={`${campaigns.filter(c => c.status === 'completed').length} completadas`}
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<Schedule />}
            label={`${campaigns.filter(c => c.status === 'scheduled').length} programadas`}
            color="secondary"
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          <Tab label="Todas las Campañas" />
          <Tab label="Directas" />
          <Tab label="Programadas" />
        </Tabs>
      </Paper>

      {/* Campaigns List */}
      <Grid container spacing={3}>
        {campaigns
          .filter(campaign => {
            if (currentTab === 1) return campaign.type === 'direct';
            if (currentTab === 2) return campaign.type === 'scheduled';
            return true;
          })
          .map((campaign) => (
            <Grid item xs={12} md={6} lg={4} key={campaign.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {campaign.name}
                      </Typography>
                    </Box>
                    <Chip
                      icon={getStatusIcon(campaign.status)}
                      label={campaign.status.toUpperCase()}
                      color={getStatusColor(campaign.status) as any}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2">
                        Progreso: {campaign.progress.sent}/{campaign.progress.total}
                      </Typography>
                      <Typography variant="body2">
                        {Math.round((campaign.progress.sent / campaign.progress.total) * 100)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={(campaign.progress.sent / campaign.progress.total) * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip
                      icon={campaign.type === 'direct' ? <Bolt /> : <AccessTime />}
                      label={campaign.type === 'direct' ? 'Directa' : 'Programada'}
                      size="small"
                      color={campaign.type === 'direct' ? 'primary' : 'secondary'}
                    />
                    <Chip
                      icon={<People />}
                      label={`${campaign.contacts.length} contactos`}
                      size="small"
                      variant="outlined"
                    />
                    {campaign.useIdFlow && (
                      <Chip
                        icon={<Bolt />}
                        label="ID FLOW"
                        size="small"
                        color="warning"
                        sx={{ 
                          bgcolor: isDarkMode ? '#ff9800' : '#fff3e0',
                          color: isDarkMode ? '#000' : '#e65100' 
                        }}
                      />
                    )}
                    {campaign.useRandomTiming && (
                      <Chip
                        icon={<AccessTime />}
                        label="Envío Aleatorio"
                        size="small"
                        color="secondary"
                        sx={{ 
                          bgcolor: isDarkMode ? '#9c27b0' : '#f3e5f5',
                          color: isDarkMode ? '#fff' : '#4a148c' 
                        }}
                      />
                    )}
                  </Box>

                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    <strong>Mensaje:</strong> {campaign.message.text.substring(0, 100)}...
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                    {campaign.status === 'draft' || campaign.status === 'scheduled' ? (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlayArrow />}
                        onClick={() => startCampaign(campaign.id)}
                        sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008069' } }}
                      >
                        Iniciar
                      </Button>
                    ) : campaign.status === 'sending' ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2">
                          Enviando... {sendingProgress[campaign.id] || 0}%
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Completada el {new Date(campaign.completedAt!).toLocaleDateString()}
                      </Typography>
                    )}

                    <IconButton
                      onClick={() => deleteCampaign(campaign.id)}
                      size="small"
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
      </Grid>

      {campaigns.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CampaignOutlined sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No hay campañas creadas
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Crea tu primera campaña para enviar mensajes personalizados masivos
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowCreateDialog(true)}
            sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008069' } }}
          >
            Crear Primera Campaña
          </Button>
        </Paper>
      )}

      {/* Create Campaign Dialog */}
      <Dialog 
        open={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          ✉️ Crear Nueva Campaña
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Información Básica</StepLabel>
              <StepContent>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Nombre de la Campaña"
                    value={newCampaign.name || ''}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <FormControl fullWidth>
                    <InputLabel>Tipo de Campaña</InputLabel>
                    <Select
                      value={newCampaign.type || 'direct'}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, type: e.target.value as 'direct' | 'scheduled' }))}
                    >
                      <MenuItem value="direct">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Bolt /> Directa (Envío Inmediato)
                        </Box>
                      </MenuItem>
                      <MenuItem value="scheduled">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AccessTime /> Programada
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  {newCampaign.type === 'scheduled' && (
                    <TextField
                      fullWidth
                      label="Fecha y Hora"
                      type="datetime-local"
                      value={newCampaign.scheduledAt || ''}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, scheduledAt: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                  {/* Configuración de Envíos Aleatorios */}
                  <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      ⏰ Envíos Aleatorios
                    </Typography>
                    <FormControl component="fieldset">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Switch
                          checked={newCampaign.useRandomTiming || false}
                          onChange={(e) => setNewCampaign(prev => ({ 
                            ...prev, 
                            useRandomTiming: e.target.checked 
                          }))}
                        />
                        <Typography>Usar Envíos Aleatorios</Typography>
                      </Box>
                      
                      {newCampaign.useRandomTiming && (
                        <Stack spacing={2}>
                          <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              <strong>Envíos Aleatorios:</strong> Distribuye los envíos aleatoriamente en el tiempo especificado en lugar de usar delays fijos.
                            </Typography>
                          </Alert>
                          
                          <TextField
                            fullWidth
                            label="Cantidad de mensajes por lote"
                            type="number"
                            value={newCampaign.flowConfig?.messagesCount || 5}
                            onChange={(e) => setNewCampaign(prev => ({ 
                              ...prev, 
                              flowConfig: { 
                                messagesCount: parseInt(e.target.value),
                                timeSpanMinutes: prev.flowConfig?.timeSpanMinutes || 5
                              } 
                            }))}
                            inputProps={{ min: 1, max: 1000 }}
                            helperText="Número de mensajes a enviar por lote"
                          />
                          
                          <TextField
                            fullWidth
                            label="Tiempo total (minutos)"
                            type="number"
                            value={newCampaign.flowConfig?.timeSpanMinutes || 5}
                            onChange={(e) => setNewCampaign(prev => ({ 
                              ...prev, 
                              flowConfig: { 
                                messagesCount: prev.flowConfig?.messagesCount || 5,
                                timeSpanMinutes: parseInt(e.target.value)
                              } 
                            }))}
                            inputProps={{ min: 1, max: 1440 }}
                            helperText="Los mensajes se distribuirán aleatoriamente en este tiempo"
                          />
                          
                          <Typography variant="body2" color="textSecondary">
                            Ejemplo: 5 mensajes en 5 minutos = envíos aleatorios entre 0-5 min
                          </Typography>
                        </Stack>
                      )}
                    </FormControl>
                  </Box>

                  {/* Configuración de ID FLOW */}
                  <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      📊 ID FLOW (Sistema Avanzado)
                    </Typography>
                    <FormControl component="fieldset">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Switch
                          checked={newCampaign.useIdFlow || false}
                          onChange={(e) => setNewCampaign(prev => ({ 
                            ...prev, 
                            useIdFlow: e.target.checked 
                          }))}
                        />
                        <Typography>Habilitar ID FLOW</Typography>
                      </Box>
                      
                      {newCampaign.useIdFlow && (
                        <Stack spacing={2}>
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              <strong>ID FLOW:</strong> Genera códigos únicos de diferentes tamaños (64, 45, 32, etc. caracteres) para cada mensaje. Cada mensaje tendrá un ID único de longitud variable.
                            </Typography>
                          </Alert>
                          
                          <Typography variant="body2" color="textSecondary">
                            ✅ Se generarán IDs automáticamente con tamaños: 64, 45, 32, 28, 56, 40, 35, 48, 52, 38 caracteres (etc.)
                          </Typography>
                        </Stack>
                      )}
                    </FormControl>
                  </Box>

                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(1)}
                    disabled={!newCampaign.name}
                  >
                    Siguiente
                  </Button>
                </Stack>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Contactos</StepLabel>
              <StepContent>
                <Stack spacing={2}>
                  {/* Selector de modo de contactos */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      📋 Selección de Contactos
                    </Typography>
                    <Tabs 
                      value={contactSelectionMode} 
                      onChange={(e, newValue) => {
                        setContactSelectionMode(newValue);
                        if (newValue === 'manual') {
                          setSelectedGroups([]);
                        } else {
                          setContactsInput('');
                        }
                        setNewCampaign(prev => ({ ...prev, contacts: [] }));
                      }}
                    >
                      <Tab 
                        value="manual" 
                        label="Ingreso Manual" 
                        icon={<PersonAdd />}
                      />
                      <Tab 
                        value="groups" 
                        label="Grupos de Contactos" 
                        icon={<Group />}
                      />
                    </Tabs>
                  </Paper>

                  {contactSelectionMode === 'manual' ? (
                    // Modo manual (existente)
                    <>
                      <Alert severity="info">
                        <Typography variant="body2">
                          <strong>Formato:</strong> numero,nombre<br/>
                          <strong>Ejemplo:</strong><br/>
                          +5491234567890,Juan Pérez<br/>
                          +5491234567891,María González<br/>
                          +5491234567892,Carlos López
                        </Typography>
                      </Alert>
                      <TextField
                        fullWidth
                        label="Lista de Contactos"
                        multiline
                        rows={8}
                        value={contactsInput}
                        onChange={(e) => handleContactsInput(e.target.value)}
                        placeholder={"+5491234567890,Juan Pérez\n+5491234567891,María González\n+5491234567892,Carlos López"}
                        helperText={`${newCampaign.contacts?.length || 0} contactos válidos`}
                      />
                    </>
                  ) : (
                    // Modo grupos
                    <>
                      <Alert severity="success">
                        <Typography variant="body2">
                          <strong>Selecciona los grupos</strong> de contactos que quieres incluir en la campaña. Los contactos de todos los grupos seleccionados se combinarán automáticamente.
                        </Typography>
                      </Alert>
                      
                      {contactGroups.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                          <Group sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            No hay grupos creados
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                            Ve al módulo de Contactos para crear grupos primero
                          </Typography>
                        </Paper>
                      ) : (
                        <Box>
                          <Typography variant="subtitle1" gutterBottom>
                            Grupos Disponibles ({contactGroups.length}):
                          </Typography>
                          <List>
                            {contactGroups.map(group => (
                              <ListItem key={group.id} disablePadding>
                                <ListItemButton
                                  onClick={() => handleGroupSelection(group.id)}
                                  sx={{ borderRadius: 1, mb: 1 }}
                                >
                                  <Checkbox
                                    checked={selectedGroups.includes(group.id)}
                                    tabIndex={-1}
                                    disableRipple
                                  />
                                  <ListItemIcon>
                                    <Folder sx={{ color: group.color }} />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={group.name}
                                    secondary={
                                      <Box>
                                        <Typography variant="body2" color="textSecondary">
                                          {group.description}
                                        </Typography>
                                        <Chip
                                          label={`${group.contactIds.length} contactos`}
                                          size="small"
                                          sx={{ mt: 0.5 }}
                                        />
                                      </Box>
                                    }
                                  />
                                </ListItemButton>
                              </ListItem>
                            ))}
                          </List>
                          
                          {selectedGroups.length > 0 && (
                            <Paper sx={{ p: 2, mt: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                              <Typography variant="subtitle2">
                                📊 Resumen de Selección:
                              </Typography>
                              <Typography variant="body2">
                                • {selectedGroups.length} grupos seleccionados
                              </Typography>
                              <Typography variant="body2">
                                • {getSelectedContactsCount()} contactos únicos
                              </Typography>
                            </Paper>
                          )}
                        </Box>
                      )}
                    </>
                  )}

                  {/* Vista previa de contactos */}
                  {newCampaign.contacts && newCampaign.contacts.length > 0 && (
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="subtitle2">
                          📱 Vista Previa de Contactos ({newCampaign.contacts.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                          {newCampaign.contacts.slice(0, 10).map((contact, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <Smartphone />
                              </ListItemIcon>
                              <ListItemText
                                primary={contact.name}
                                secondary={contact.phone}
                              />
                            </ListItem>
                          ))}
                          {newCampaign.contacts.length > 10 && (
                            <Typography variant="caption" color="textSecondary" sx={{ px: 2 }}>
                              ... y {newCampaign.contacts.length - 10} contactos más
                            </Typography>
                          )}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={() => setActiveStep(0)}>
                      Anterior
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(2)}
                      disabled={!newCampaign.contacts?.length}
                    >
                      Siguiente ({getSelectedContactsCount()} contactos)
                    </Button>
                  </Box>
                </Stack>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Mensaje</StepLabel>
              <StepContent>
                <Stack spacing={2}>
                  <Alert severity="success">
                    <Typography variant="body2">
                      <strong>Variables disponibles:</strong><br/>
                      {'{nombre}'} - Se reemplaza por el nombre del contacto<br/>
                      <strong>Ejemplo:</strong> "Hola {'{nombre}'}, como estas?"
                    </Typography>
                  </Alert>
                  <TextField
                    fullWidth
                    label="Mensaje de la Campaña"
                    multiline
                    rows={4}
                    value={newCampaign.message?.text || ''}
                    onChange={(e) => setNewCampaign(prev => ({
                      ...prev,
                      message: { text: e.target.value }
                    }))}
                    placeholder="Hola {nombre}, como estas?"
                    required
                  />
                  {previewMessage && (
                    <Paper sx={{ p: 2, bgcolor: isDarkMode ? '#1e1e1e' : '#e3f2fd' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Vista Previa:
                      </Typography>
                      <Typography variant="body2">
                        {previewMessage}
                      </Typography>
                    </Paper>
                  )}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={() => setActiveStep(1)}>
                      Anterior
                    </Button>
                    <Button
                      variant="contained"
                      onClick={createCampaign}
                      disabled={!newCampaign.message?.text}
                    >
                      Crear Campaña
                    </Button>
                  </Box>
                </Stack>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default RealCampaignsModule; 