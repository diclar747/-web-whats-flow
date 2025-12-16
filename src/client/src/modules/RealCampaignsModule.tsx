import React, { useState, useEffect, useCallback } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import PersonalizedCampaignModule from './PersonalizedCampaignModule';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { SubscriptionGuard } from '../components/SubscriptionGuard';
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
  Stop,
  Delete,
  Edit,
  Visibility,
  Error as ErrorIcon,
  CheckCircle,
  Smartphone,
  Bolt,
  AccessTime,
  Group,
  Folder,
  ExpandMore,
  PersonAdd,
  WhatsApp,
  ViewColumn,
  CheckBoxOutlineBlank,
  CheckBox,
  AttachFile,
  EmojiEmotions,
  Image,
  VideoFile,
  Close,
  Refresh,
  Search,
  Settings,
  Description,
  ContentCopy,
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

interface WhatsAppContact {
  id: string;
  jid: string;
  name: string;
  notify_name?: string;
  phone?: string;
}

interface WhatsAppGroup {
  id: string;
  jid: string;
  name: string;
  subject?: string;
  memberCount: number;
  avatar_url?: string;
}

interface KanbanBoard {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface LocalGroup {
  id: string;
  name: string;
  description: string | null;
  count: number;
  contact_count: number;
  created_at: string;
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
  mediaUrl?: string | null;
  mediaType?: string | null;
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

  // SubscriptionGuard temporalmente deshabilitado para debugging
  return <RealCampaignsModuleContent sessionId={sessionId} />;
};

const RealCampaignsModuleContent: React.FC<RealCampaignsModuleProps> = ({ sessionId }) => {
  const { isDarkMode } = useTheme();

  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendingProgress, setSendingProgress] = useState<{ [key: string]: number }>({});
  const [currentTab, setCurrentTab] = useState(0);

  // Estados para manejo de contactos y grupos
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [contactSelectionMode, setContactSelectionMode] = useState<'manual' | 'groups'>('manual');

  // Estados para WhatsApp Contacts, Groups y Kanban
  const [whatsappContacts, setWhatsappContacts] = useState<WhatsAppContact[]>([]);
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [kanbanBoards, setKanbanBoards] = useState<KanbanBoard[]>([]);
  const [kanbanContacts, setKanbanContacts] = useState<{ [key: string]: Contact[] }>({});
  const [localGroups, setLocalGroups] = useState<LocalGroup[]>([]);
  const [selectedWhatsAppContacts, setSelectedWhatsAppContacts] = useState<string[]>([]);
  const [selectedWhatsAppGroups, setSelectedWhatsAppGroups] = useState<string[]>([]);
  const [selectedKanbanBoards, setSelectedKanbanBoards] = useState<string[]>([]);
  const [selectedLocalGroups, setSelectedLocalGroups] = useState<string[]>([]);
  const [contactSelectionTab, setContactSelectionTab] = useState(0);

  // Estados para paginación y búsqueda de contactos
  const [contactsPage, setContactsPage] = useState(0);
  const [contactsHasMore, setContactsHasMore] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [totalContacts, setTotalContacts] = useState(0);

  // Estados para plantillas
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', message: '', category: 'general' });
  const [showTemplateEmojiPicker, setShowTemplateEmojiPicker] = useState(false);
  const [showDeleteTemplateConfirm, setShowDeleteTemplateConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any>(null);
  const [showDeleteCampaignConfirm, setShowDeleteCampaignConfirm] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignData | null>(null);
  const [contactSearchTerm, setContactSearchTerm] = useState('');

  // Estados para sesiones de envío (líneas conectadas)
  const [senderSessions, setSenderSessions] = useState<Array<{ sessionId: string; phoneNumber?: string }>>([]);
  const [senderSessionId, setSenderSessionId] = useState<string>(sessionId);
  const [senderLoading, setSenderLoading] = useState(false);
  const [senderError, setSenderError] = useState('');

  const [newCampaign, setNewCampaign] = useState<Partial<CampaignData>>({
    name: '',
    type: 'direct',
    message: { text: 'Hola {nombre}, como estas?' },
    contacts: [],
    status: 'draft',
    useIdFlow: true, // ✅ Activado por defecto (Sistema Avanzado)
    useRandomTiming: false,
    flowConfig: {
      messagesCount: 1, // ✅ 1 mensaje por minuto por defecto
      timeSpanMinutes: 1 // ✅ Cada 1 minuto
    }
  });

  const [contactsInput, setContactsInput] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Estados para historial detallado
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para filtros de historial
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');

  // Estados para edición de campañas
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignData | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      
      // Cargar solo campañas del sessionId principal del usuario (no de otras líneas de otros usuarios)
      console.log(`📋 Cargando campañas del usuario actual: ${sessionId}`);
      
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${sessionId}`);
      const data = await response.json();

      if (data.success && data.data && data.data.campaigns) {
        // Mapear datos del backend al formato del frontend
        const mappedCampaigns: CampaignData[] = data.data.campaigns.map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.scheduled_at ? 'scheduled' : 'direct',
          status: c.status,
          message: { text: c.message_template },
          mediaUrl: null,
          mediaType: null,
          contacts: Array(c.total_recipients).fill({}),
          scheduledAt: c.scheduled_at,
          completedAt: c.completed_at,
          progress: {
            total: c.total_recipients,
            sent: c.sent_count,
            delivered: c.sent_count,
            failed: c.failed_count
          },
          createdAt: c.created_at,
          useIdFlow: c.use_id_flow === 1,
          useRandomTiming: c.use_random_timing === 1,
          flowConfig: {
            messagesCount: c.random_timing_msg_count,
            timeSpanMinutes: c.random_timing_time_span_minutes
          }
        }));
        setCampaigns(mappedCampaigns);
        console.log(`✅ ${mappedCampaigns.length} campañas cargadas`);
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
      const savedCampaigns = localStorage.getItem(`campaigns_${sessionId}`);
      if (savedCampaigns) {
        setCampaigns(JSON.parse(savedCampaigns));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Restaurar campañas programadas después de cargar
  const restoreScheduledCampaigns = useCallback(() => {
    // Client-side scheduling removed in favor of server-side scheduler
    // The server checks every minute for scheduled campaigns that are due
    // This prevents double execution and ensures reliability even if browser is closed
    console.log('📅 Client-side scheduler check skipped (Server-side scheduler active)');
  }, [campaigns]);

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

  // Cargar plantillas
  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaign-templates/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error);
    }
  }, [sessionId]);

  const loadSenderSessions = async () => {
    setSenderLoading(true);
    setSenderError('');

    try {
      // ✅ Obtener sessionId del usuario actual
      const currentSessionId = sessionStorage.getItem('whatsflow_session') || 
                               localStorage.getItem('whatsflow_session') || 
                               sessionId;
      
      console.log('[CAMPAIGNS] Cargando sesiones para:', currentSessionId);
      
      // ✅ Pasar sessionId en el query
      const response = await fetch(`${getAPIBaseURL()}/api/sessions/active?sessionId=${currentSessionId}`);
      const data = await response.json();

      console.log('[CAMPAIGNS] Sesiones recibidas:', data.sessions?.length || 0);

      if (data.success) {
        const mapped = (data.sessions || []).map((s: any) => ({
          sessionId: s.sessionId,
          phoneNumber: s.phoneNumber
        }));

        setSenderSessions(mapped);

        if (mapped.length > 0 && !mapped.some((s: { sessionId: string; phoneNumber?: string }) => s.sessionId === senderSessionId)) {
          setSenderSessionId(mapped[0].sessionId);
        }
      } else {
        setSenderError(data.error || 'No se pudieron cargar las sesiones activas');
      }
    } catch (error) {
      console.error('❌ Error cargando sesiones activas:', error);
      setSenderError('No se pudieron cargar las sesiones activas');
    } finally {
      setSenderLoading(false);
    }
  };

  // Crear plantilla
  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.message) {
      setError('Complete todos los campos de la plantilla');
      return;
    }

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaign-templates/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplate.name,
          message_template: newTemplate.message,
          category: newTemplate.category
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Plantilla creada exitosamente');
        setShowCreateTemplateDialog(false);
        setShowTemplateEmojiPicker(false);
        setNewTemplate({ name: '', message: '', category: 'general' });
        loadTemplates();
      } else {
        setError(data.error || 'Error al crear plantilla');
      }
    } catch (error) {
      console.error('Error creando plantilla:', error);
      setError('Error de conexión');
    }
  };

  // Mostrar confirmación para eliminar plantilla
  const confirmDeleteTemplate = (template: any) => {
    setTemplateToDelete(template);
    setShowDeleteTemplateConfirm(true);
  };

  // Eliminar plantilla
  const deleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaign-templates/${sessionId}/${templateToDelete.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Plantilla eliminada exitosamente');
        setShowDeleteTemplateConfirm(false);
        setTemplateToDelete(null);
        loadTemplates();
      } else {
        setError(data.error || 'Error al eliminar plantilla');
      }
    } catch (error) {
      console.error('Error eliminando plantilla:', error);
      setError('Error de conexión');
    }
  };

  // Aplicar plantilla
  const applyTemplate = (template: any) => {
    setNewCampaign(prev => ({
      ...prev,
      message: { text: template.message_template }
    }));
    setShowTemplatesDialog(false);
    setSuccess(`Plantilla "${template.name}" aplicada`);
  };

  const loadWhatsAppContacts = useCallback(async (resetContacts = true) => {
    try {
      setContactsLoading(true);

      const page = resetContacts ? 0 : contactsPage;
      const limit = 20;
      const search = contactSearchTerm;

      const response = await fetch(
        `${getAPIBaseURL()}/api/contacts/${sessionId}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
      );
      const data = await response.json();

      if (data.success && data.contacts) {
        if (resetContacts) {
          setWhatsappContacts(data.contacts);
          setContactsPage(0);
        } else {
          setWhatsappContacts(prev => [...prev, ...data.contacts]);
        }

        setContactsHasMore(data.hasMore || false);
        setTotalContacts(data.total || 0);
      }

      setContactsLoading(false);
    } catch (error) {
      console.error('Error cargando contactos de WhatsApp:', error);
      setContactsLoading(false);
    }
  }, [sessionId, contactsPage, contactSearchTerm]);

  // Función para cargar más contactos
  const loadMoreWhatsAppContacts = useCallback(async () => {
    if (contactsLoading || !contactsHasMore) return;

    const nextPage = contactsPage + 1;
    setContactsPage(nextPage);

    try {
      setContactsLoading(true);
      const limit = 20;
      const search = contactSearchTerm;

      const response = await fetch(
        `${getAPIBaseURL()}/api/contacts/${sessionId}?page=${nextPage}&limit=${limit}&search=${encodeURIComponent(search)}`
      );
      const data = await response.json();

      if (data.success && data.contacts) {
        setWhatsappContacts(prev => [...prev, ...data.contacts]);
        setContactsHasMore(data.hasMore || false);
        setTotalContacts(data.total || 0);
      }

      setContactsLoading(false);
    } catch (error) {
      console.error('Error cargando más contactos de WhatsApp:', error);
      setContactsLoading(false);
    }
  }, [sessionId, contactsPage, contactSearchTerm, contactsLoading, contactsHasMore]);

  const loadWhatsAppGroups = useCallback(async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/groups/${sessionId}`);
      const data = await response.json();
      if (data.success && data.groups) {
        setWhatsappGroups(data.groups);
      }
    } catch (error) {
      console.error('Error cargando grupos de WhatsApp:', error);
    }
  }, [sessionId]);

  const loadKanbanBoards = useCallback(async () => {
    try {
      const boardsResponse = await fetch(`${getAPIBaseURL()}/api/kanban/boards/${sessionId}`);
      const boardsData = await boardsResponse.json();
      if (boardsData.success && boardsData.boards) {
        setKanbanBoards(boardsData.boards);
      }

      const contactsResponse = await fetch(`${getAPIBaseURL()}/api/contacts/by-category/${sessionId}`);
      const contactsData = await contactsResponse.json();
      if (contactsData.success && contactsData.data?.contacts) {
        setKanbanContacts(contactsData.data.contacts);
      }
    } catch (error) {
      console.error('Error cargando tableros Kanban:', error);
    }
  }, [sessionId]);

  const loadLocalGroups = useCallback(async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/local-groups/${sessionId}`);
      const data = await response.json();
      if (data.success && data.localGroups) {
        setLocalGroups(data.localGroups);
      }
    } catch (error) {
      console.error('Error cargando grupos locales:', error);
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

  // Cargar sesiones activas de envío
  useEffect(() => {
    loadSenderSessions();
  }, [sessionId]);

  // Restaurar campañas programadas solo una vez al cargar
  useEffect(() => {
    if (campaigns.length > 0) {
      const hasScheduled = campaigns.some(c => c.status === 'scheduled');
      if (hasScheduled) {
        restoreScheduledCampaigns();
      }
    }
    // Solo ejecutar una vez al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    loadContactGroups();
  }, [loadContactGroups]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    updateMessagePreview();
  }, [updateMessagePreview]);

  useEffect(() => {
    if (showCreateDialog) {
      loadWhatsAppContacts();
      loadWhatsAppGroups();
      loadKanbanBoards();
      loadLocalGroups();
    }
  }, [showCreateDialog, loadWhatsAppContacts, loadWhatsAppGroups, loadKanbanBoards, loadLocalGroups]);

  // Effect para buscar contactos cuando cambia el término de búsqueda
  useEffect(() => {
    if (contactSelectionTab === 1 && showCreateDialog) {
      const delayDebounce = setTimeout(() => {
        loadWhatsAppContacts(true);
      }, 500);

      return () => clearTimeout(delayDebounce);
    }
    return undefined;
  }, [contactSearchTerm, contactSelectionTab, showCreateDialog]);

  // Socket.IO para actualizaciones en tiempo real del historial
  useEffect(() => {
    if (!showHistoryDialog || !selectedCampaignDetails) return;

    const socket = io(getAPIBaseURL(), {
      query: { sessionId }
    });

    // Escuchar actualizaciones de estado de mensajes
    socket.on('message-status-update', (update: any) => {
      console.log('📩 Actualización de estado de mensaje recibida:', update);

      // Si el mensaje pertenece a la campaña actual, actualizar el destinatario
      setSelectedCampaignDetails((prev: any) => {
        if (!prev || !prev.recipients) return prev;

        const updatedRecipients = prev.recipients.map((r: any) => {
          if (r.message_id === update.messageId || r.message_id === update.id) {
            return { ...r, status: update.status };
          }
          return r;
        });

        return { ...prev, recipients: updatedRecipients };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [showHistoryDialog, selectedCampaignDetails, sessionId]);

  // Socket.IO para progreso de campañas en tiempo real
  useEffect(() => {
    const socket = io(getAPIBaseURL(), {
      query: { sessionId },
      transports: ['websocket', 'polling']
    });

    // Unirse a la sala de sesión
    socket.emit('join-session', sessionId);

    // Escuchar progreso de campañas
    socket.on('campaign-progress', (data: any) => {
      console.log('📊 Progreso de campaña:', data);
      const { campaignId, sent, failed, total } = data;

      const percentage = Math.round(((sent + failed) / total) * 100);

      setSendingProgress(prev => ({
        ...prev,
        [campaignId]: percentage
      }));

      // Actualizar el estado de la campaña en la lista
      setCampaigns(prev => prev.map(c => {
        if (c.id === campaignId.toString()) {
          return {
            ...c,
            progress: {
              ...c.progress,
              sent,
              failed,
              total
            }
          };
        }
        return c;
      }));
    });

    // Escuchar cuando la campaña se completa
    socket.on('campaign-completed', (data: any) => {
      console.log('✅ Campaña completada:', data);
      const { campaignId } = data;

      setSendingProgress(prev => ({
        ...prev,
        [campaignId]: 100
      }));

      // Actualizar estado a completado
      setCampaigns(prev => prev.map(c => {
        if (c.id === campaignId.toString()) {
          return {
            ...c,
            status: 'completed' as const,
            completedAt: new Date().toISOString()
          };
        }
        return c;
      }));

      setSuccess('Campaña completada exitosamente');

      // Recargar campañas desde el servidor
      setTimeout(() => loadCampaigns(), 2000);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, loadCampaigns]);

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

  // Función para formatear números de teléfono con código 595
  const formatPhoneNumber = (phone: string): string => {
    // Si ya viene con @s.whatsapp.net, extraer solo el número
    if (phone.includes('@')) {
      phone = phone.split('@')[0];
    }

    // Limpiar el número: remover espacios, guiones, paréntesis, puntos, etc.
    let cleaned = phone.replace(/[\s\-\(\)\.\+]/g, '');

    // Si empieza con 0, removerlo (números locales)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Si ya empieza con 595 (Paraguay) y tiene 12 dígitos, retornar así
    if (cleaned.startsWith('595') && cleaned.length === 12) {
      return cleaned;
    }

    // Si tiene 9 dígitos (número local sin código de país), agregar 595
    if (cleaned.length === 9 && /^\d{9}$/.test(cleaned)) {
      return `595${cleaned}`;
    }

    // Si ya tiene código de país (11-15 dígitos), retornar tal cual
    if (cleaned.length >= 11 && cleaned.length <= 15 && /^\d+$/.test(cleaned)) {
      return cleaned;
    }

    // Si tiene menos de 9 dígitos, asumir que es local y agregar 595
    if (cleaned.length < 9 && /^\d+$/.test(cleaned)) {
      return `595${cleaned}`;
    }

    // Por defecto, retornar el número limpio
    return cleaned;
  };

  const parseContacts = (input: string): CampaignContact[] => {
    const lines = input.trim().split('\n');
    const contacts: CampaignContact[] = [];

    lines.forEach((line, index) => {
      if (line.trim()) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const rawPhone = parts[0];
          const name = parts[1];

          // Formatear el número con código 595
          const formattedPhone = formatPhoneNumber(rawPhone);

          // Validar que el número formateado sea válido
          const phoneDigits = formattedPhone.replace(/^\+/, '');
          if (/^\d{10,15}$/.test(phoneDigits)) {
            contacts.push({
              phone: formattedPhone,
              name: name,
              variables: { nombre: name }
            });
            console.log(`✅ Número formateado: ${rawPhone} → ${formattedPhone}`);
          } else {
            console.warn(`❌ Línea ${index + 1}: Número inválido después de formatear: ${rawPhone} → ${formattedPhone}`);
          }
        } else {
          console.warn(`❌ Línea ${index + 1}: Formato incorrecto. Use: numero,nombre`);
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

  const handleWhatsAppContactSelection = (contactId: string) => {
    setSelectedWhatsAppContacts(prev => {
      const isSelected = prev.includes(contactId);
      const newSelection = isSelected
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId];

      // Actualizar contactos de campaña
      updateCampaignContactsFromSelection(newSelection, selectedWhatsAppGroups, selectedKanbanBoards, selectedLocalGroups);
      return newSelection;
    });
  };

  const handleWhatsAppGroupSelection = (groupId: string) => {
    setSelectedWhatsAppGroups(prev => {
      const isSelected = prev.includes(groupId);
      const newSelection = isSelected
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId];

      updateCampaignContactsFromSelection(selectedWhatsAppContacts, newSelection, selectedKanbanBoards, selectedLocalGroups);
      return newSelection;
    });
  };

  const handleKanbanBoardSelection = (boardName: string) => {
    setSelectedKanbanBoards(prev => {
      const isSelected = prev.includes(boardName);
      const newSelection = isSelected
        ? prev.filter(name => name !== boardName)
        : [...prev, boardName];

      updateCampaignContactsFromSelection(selectedWhatsAppContacts, selectedWhatsAppGroups, newSelection, selectedLocalGroups);
      return newSelection;
    });
  };

  const handleSelectAllWhatsAppContacts = () => {
    if (selectedWhatsAppContacts.length === whatsappContacts.length) {
      setSelectedWhatsAppContacts([]);
      updateCampaignContactsFromSelection([], selectedWhatsAppGroups, selectedKanbanBoards, selectedLocalGroups);
    } else {
      const allIds = whatsappContacts.map(c => c.id);
      setSelectedWhatsAppContacts(allIds);
      updateCampaignContactsFromSelection(allIds, selectedWhatsAppGroups, selectedKanbanBoards, selectedLocalGroups);
    }
  };

  const handleSelectAllWhatsAppGroups = () => {
    if (selectedWhatsAppGroups.length === whatsappGroups.length) {
      setSelectedWhatsAppGroups([]);
      updateCampaignContactsFromSelection(selectedWhatsAppContacts, [], selectedKanbanBoards, selectedLocalGroups);
    } else {
      const allIds = whatsappGroups.map(g => g.id);
      setSelectedWhatsAppGroups(allIds);
      updateCampaignContactsFromSelection(selectedWhatsAppContacts, allIds, selectedKanbanBoards, selectedLocalGroups);
    }
  };

  const handleSelectAllKanbanBoards = () => {
    if (selectedKanbanBoards.length === kanbanBoards.length) {
      setSelectedKanbanBoards([]);
      updateCampaignContactsFromSelection(selectedWhatsAppContacts, selectedWhatsAppGroups, [], selectedLocalGroups);
    } else {
      const allNames = kanbanBoards.map(b => b.name);
      setSelectedKanbanBoards(allNames);
      updateCampaignContactsFromSelection(selectedWhatsAppContacts, selectedWhatsAppGroups, allNames, selectedLocalGroups);
    }
  };

  const handleLocalGroupSelection = (groupId: string) => {
    setSelectedLocalGroups(prev => {
      const isSelected = prev.includes(groupId);
      const newSelection = isSelected
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId];

      updateCampaignContactsFromSelection(selectedWhatsAppContacts, selectedWhatsAppGroups, selectedKanbanBoards, newSelection);
      return newSelection;
    });
  };

  const handleSelectAllLocalGroups = () => {
    if (selectedLocalGroups.length === localGroups.length) {
      setSelectedLocalGroups([]);
      updateCampaignContactsFromSelection(selectedWhatsAppContacts, selectedWhatsAppGroups, selectedKanbanBoards, []);
    } else {
      const allIds = localGroups.map(g => g.id);
      setSelectedLocalGroups(allIds);
      updateCampaignContactsFromSelection(selectedWhatsAppContacts, selectedWhatsAppGroups, selectedKanbanBoards, allIds);
    }
  };

  const updateCampaignContactsFromSelection = async (
    contactIds: string[],
    groupIds: string[],
    boardNames: string[],
    localGroupIds: string[]
  ) => {
    const campaignContacts: CampaignContact[] = [];

    // Agregar contactos individuales de WhatsApp
    contactIds.forEach(contactId => {
      const contact = whatsappContacts.find(c => c.id === contactId);
      if (contact) {
        const rawPhone = contact.phone || contact.jid.split('@')[0];
        const formattedPhone = formatPhoneNumber(rawPhone);
        campaignContacts.push({
          phone: formattedPhone,
          name: contact.name || contact.notify_name || rawPhone,
          variables: { nombre: contact.name || contact.notify_name || rawPhone }
        });
      }
    });

    // Agregar miembros de grupos de WhatsApp seleccionados
    for (const groupId of groupIds) {
      try {
        const response = await fetch(`${getAPIBaseURL()}/api/group-contacts/${sessionId}/${groupId}`);
        const data = await response.json();
        if (data.success && data.contacts) {
          data.contacts.forEach((contact: any) => {
            const rawPhone = contact.phone || contact.jid?.split('@')[0] || '';
            if (rawPhone) {
              const formattedPhone = formatPhoneNumber(rawPhone);
              campaignContacts.push({
                phone: formattedPhone,
                name: contact.name || rawPhone,
                variables: { nombre: contact.name || rawPhone }
              });
            }
          });
        }
      } catch (error) {
        console.error(`Error obteniendo contactos del grupo ${groupId}:`, error);
      }
    }

    // Agregar contactos de tableros Kanban seleccionados
    boardNames.forEach(boardName => {
      const contacts = kanbanContacts[boardName] || [];
      contacts.forEach(contact => {
        const rawPhone = contact.phone;
        if (rawPhone) {
          const formattedPhone = formatPhoneNumber(rawPhone);
          campaignContacts.push({
            phone: formattedPhone,
            name: contact.name || rawPhone,
            variables: { nombre: contact.name || rawPhone }
          });
        }
      });
    });

    // Agregar contactos de grupos locales seleccionados
    for (const groupId of localGroupIds) {
      try {
        const response = await fetch(`${getAPIBaseURL()}/api/local-group-contacts/${sessionId}/${groupId}`);
        const data = await response.json();
        if (data.success && data.contacts) {
          data.contacts.forEach((contact: any) => {
            const rawPhone = contact.phone || contact.jid?.split('@')[0] || '';
            if (rawPhone) {
              const formattedPhone = formatPhoneNumber(rawPhone);
              campaignContacts.push({
                phone: formattedPhone,
                name: contact.name || contact.notify_name || rawPhone,
                variables: { nombre: contact.name || contact.notify_name || rawPhone }
              });
            }
          });
        }
      } catch (error) {
        console.error(`Error obteniendo contactos del grupo local ${groupId}:`, error);
      }
    }

    // Eliminar duplicados por número de teléfono
    const uniqueContacts = campaignContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.phone === contact.phone)
    );

    setNewCampaign(prev => ({ ...prev, contacts: uniqueContacts }));
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

  // Función para manejar la subida de archivos multimedia
  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMedia(file);
      // Crear preview para imágenes
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setMediaPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setMediaPreview(null);
      }
    }
  };

  // Función para insertar emoji del picker completo
  const onEmojiClick = (emojiData: EmojiClickData) => {
    const currentText = newCampaign.message?.text || '';
    setNewCampaign(prev => ({
      ...prev,
      message: {
        ...prev.message!,
        text: currentText + emojiData.emoji
      }
    }));
  };

  const createCampaign = async () => {
    if (!newCampaign.name || !newCampaign.message?.text || !newCampaign.contacts?.length) {
      setError('Complete todos los campos requeridos');
      return;
    }

    const activeSessionId = senderSessionId || sessionId;

    if (!activeSessionId) {
      setError('Selecciona la línea de envío antes de crear la campaña.');
      return;
    }

    try {
      setLoading(true);
      let mediaUrl = null;
      let mediaType = null;

      // Subir archivo multimedia si existe
      if (selectedMedia) {
        console.log('📤 Subiendo archivo multimedia...');
        const formData = new FormData();
        formData.append('file', selectedMedia);
        formData.append('sessionId', activeSessionId);

        const uploadResponse = await fetch(`${getAPIBaseURL()}/api/campaigns/upload-media`, {
          method: 'POST',
          body: formData
        });

        const uploadResult = await uploadResponse.json();

        if (uploadResult.success) {
          // Guardar solo la ruta relativa (el backend construirá la ruta absoluta)
          mediaUrl = uploadResult.data.mediaUrl;
          mediaType = uploadResult.data.mediaType;
          console.log('✅ Archivo multimedia subido:', mediaUrl);
        } else {
          throw new Error('Error al subir archivo multimedia');
        }
      }

      // 🔥 GUARDAR EN BASE DE DATOS
      console.log('💾 Guardando campaña en base de datos...');
      // Normalizar JIDs de contactos (asegurar que tengan @s.whatsapp.net)
      const normalizeJid = (phone: string) => {
        if (!phone) return '';
        // Si ya tiene @, retornarlo tal cual
        if (phone.includes('@')) return phone;
        // Si es solo número, agregar @s.whatsapp.net
        return `${phone}@s.whatsapp.net`;
      };

      // Crear campaña con todos los contactos usando la sesión principal del usuario
      // pero indicando desde qué línea se debe enviar (senderSessionId)
      console.log(`📤 Creando campaña con ${newCampaign.contacts?.length || 0} contactos`);
      console.log(`   Sesión del usuario: ${sessionId}`);
      console.log(`   Línea de envío: ${activeSessionId}`);
      
      const campaignPayload = {
        sessionId: sessionId,  // Siempre usar la sesión principal del usuario
        campaign: {
          name: newCampaign.name,
          messageTemplate: newCampaign.message?.text || '',
          mediaUrl,
          mediaType,
          recipients: (newCampaign.contacts || []).map(c => ({
            jid: normalizeJid(c.phone),
            name: c.name
          })),
          useRandomTiming: newCampaign.useRandomTiming || false,
          randomTimingMsgCount: newCampaign.flowConfig?.messagesCount || null,
          randomTimingTimeSpanMinutes: newCampaign.flowConfig?.timeSpanMinutes || null,
          useIdFlow: newCampaign.useIdFlow || false,
          idFlowSize: 32,
          scheduledAt: newCampaign.scheduledAt ? new Date(newCampaign.scheduledAt).toISOString() : null,
          senderSessionId: activeSessionId  // Pasar la línea de envío seleccionada
        }
      };

      const createResponse = await fetch(`${getAPIBaseURL()}/api/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignPayload)
      });

      const createResult = await createResponse.json();

      if (!createResult.success) {
        throw new Error(createResult.error || 'Error al guardar campaña en servidor');
      }

      const campaignId = createResult.data.campaignId;
      console.log('✅ Campaña guardada en BD con ID:', campaignId);

      // Determinar tipo y estado basado en si hay fecha programada
      const isScheduled = !!newCampaign.scheduledAt;
      const campaignType = isScheduled ? 'scheduled' : 'direct';
      const campaignStatus = isScheduled ? 'scheduled' : 'draft';

      const campaign: CampaignData = {
        id: campaignId?.toString() || 'temp', // Usar ID de la base de datos
        name: newCampaign.name,
        type: campaignType,
        status: campaignStatus,
        message: newCampaign.message,
        mediaUrl,
        mediaType,
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
      setSuccess(`Campaña "${campaign.name}" creada exitosamente${mediaUrl ? ' con archivo adjunto' : ''}`);
    } catch (error) {
      console.error('Error creando campaña:', error);
      setError('Error al crear la campaña');
    } finally {
      setLoading(false);
    }
  };

  const resetCampaignForm = () => {
    setNewCampaign({
      name: '',
      type: 'direct',
      message: { text: 'Hola {nombre}, como estas?' },
      contacts: [],
      status: 'draft',
      useIdFlow: true, // ✅ ID Flow activado por defecto
      useRandomTiming: false,
      flowConfig: {
        messagesCount: 1, // ✅ 1 mensaje por minuto
        timeSpanMinutes: 1
      }
    });
    setContactsInput('');
    setSelectedGroups([]);
    setContactSelectionMode('manual');
    setActiveStep(0);
    setPreviewMessage('');
    setSelectedWhatsAppContacts([]);
    setSelectedWhatsAppGroups([]);
    setSelectedKanbanBoards([]);
    setContactSelectionTab(0);
    setSelectedMedia(null);
    setMediaPreview(null);
    setShowEmojiPicker(false);
  };

  const startCampaign = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    // Usar la línea seleccionada o el sessionId del prop
    const activeSessionId = senderSessionId || sessionId;

    try {
      setLoading(true);

      // Si es campaña PROGRAMADA, verificar la fecha
      if (campaign.type === 'scheduled' || campaign.scheduledAt) {
        const scheduledDate = new Date(campaign.scheduledAt!);
        const now = new Date();

        if (scheduledDate <= now) {
          // Si la fecha ya pasó, ejecutar inmediatamente
          const response = await fetch(`${getAPIBaseURL()}/api/campaigns/send/${encodeURIComponent(activeSessionId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId })
          });

          const data = await response.json();

          if (data.success) {
            setSuccess('Campaña ejecutándose ahora (la fecha programada ya pasó)');
            const updatedCampaigns = campaigns.map(c =>
              c.id === campaignId ? { ...c, status: 'sending' as const } : c
            );
            setCampaigns(updatedCampaigns);
            saveCampaigns(updatedCampaigns);
            setTimeout(() => loadCampaigns(), 2000);
          } else {
            setError(data.error || 'Error al iniciar campaña');
          }
        } else {
          // Fecha futura: ACTIVAR la campaña (Draft -> Scheduled)
          try {
            const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${campaignId}/activate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            });

            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

            // Actualizar estado local
            const updatedCampaigns = campaigns.map(c =>
              c.id === campaignId ? { ...c, status: 'scheduled' as const } : c
            );
            setCampaigns(updatedCampaigns);
          } catch (e: any) {
            console.error("Error activando campaña:", e);
            alert("Error activando campaña: " + e.message); // ALERT VISIBLE
          }
        }

        setSuccess(`✅ Campaña "${campaign.name}" activada. Se enviará correctamente.`);
        // Forzar recarga completa
        setTimeout(() => loadCampaigns(), 1500);
      }
      else {
        // Campaña DIRECTA: Ejecutar inmediatamente
        const response = await fetch(`${getAPIBaseURL()}/api/campaigns/send/${encodeURIComponent(activeSessionId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId })
        });

        const data = await response.json();

        if (data.success) {
          setSuccess('Campaña iniciada en el servidor');
          const updatedCampaigns = campaigns.map(c =>
            c.id === campaignId ? { ...c, status: 'sending' as const } : c
          );
          setCampaigns(updatedCampaigns);
          saveCampaigns(updatedCampaigns);
          setTimeout(() => loadCampaigns(), 2000);
        } else {
          setError(data.error || 'Error al iniciar campaña');
        }
      }
    } catch (error) {
      console.error('Error iniciando campaña:', error);
      setError('Error de conexión al iniciar campaña');
    } finally {
      setLoading(false);
    }
  };

  // executeCampaign eliminado - La ejecución ahora es manejada por el backend

  // Mostrar confirmación para eliminar campaña
  const confirmDeleteCampaign = (campaign: CampaignData) => {
    setCampaignToDelete(campaign);
    setShowDeleteCampaignConfirm(true);
  };

  const deleteCampaign = async () => {
    if (!campaignToDelete) return;

    try {
      // Eliminar del servidor si tiene ID numérico
      if (campaignToDelete.id && !isNaN(Number(campaignToDelete.id))) {
        const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${sessionId}/${campaignToDelete.id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          console.warn('No se pudo eliminar del servidor, solo local');
        }
      }

      // Eliminar localmente
      const updatedCampaigns = campaigns.filter(c => c.id !== campaignToDelete.id);
      setCampaigns(updatedCampaigns);
      saveCampaigns(updatedCampaigns);

      setSuccess('Campaña eliminada exitosamente');
      setShowDeleteCampaignConfirm(false);
      setCampaignToDelete(null);

      // Recargar desde servidor
      setTimeout(() => loadCampaigns(), 1000);
    } catch (error) {
      console.error('Error eliminando campaña:', error);
      setError('Error al eliminar campaña');
    }
  };

  // Ver detalles de campaña
  const viewCampaignDetails = (campaignId: string) => {
    loadCampaignDetails(campaignId);
  };

  // Cargar detalles de una campaña desde el backend
  const loadCampaignDetails = async (campaignId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${sessionId}/${campaignId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedCampaignDetails(data.data);
        setShowHistoryDialog(true);
      } else {
        setError(data.error || 'Error al cargar detalles de la campaña');
      }
    } catch (error) {
      console.error('Error loading campaign details:', error);
      setError('Error de conexión al cargar detalles');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Pausar campaña
  const pauseCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/pause/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar el estado local
        const updatedCampaigns = campaigns.map(c =>
          c.id === campaignId ? { ...c, status: 'paused' as any } : c
        );
        setCampaigns(updatedCampaigns);
        saveCampaigns(updatedCampaigns);
        setSuccess('Campaña pausada exitosamente');
      } else {
        setError(data.error || 'Error al pausar campaña');
      }
    } catch (error) {
      console.error('Error pausing campaign:', error);
      setError('Error de conexión al pausar campaña');
    }
  };

  // Reanudar campaña
  const resumeCampaign = async (campaignId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/resume/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar el estado local
        const updatedCampaigns = campaigns.map(c =>
          c.id === campaignId ? { ...c, status: 'sending' as any } : c
        );
        setCampaigns(updatedCampaigns);
        saveCampaigns(updatedCampaigns);
        setSuccess('Campaña reanudada exitosamente');
      } else {
        setError(data.error || 'Error al reanudar campaña');
      }
    } catch (error) {
      console.error('Error resuming campaign:', error);
      setError('Error de conexión al reanudar campaña');
    } finally {
      setLoading(false);
    }
  };

  // Abrir diálogo de edición
  const openEditDialog = (campaign: CampaignData) => {
    setEditingCampaign(campaign);
    setShowEditDialog(true);
  };

  // Guardar cambios de edición
  const saveEditCampaign = async () => {
    if (!editingCampaign) return;

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${sessionId}/${editingCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCampaign.name,
          message_template: editingCampaign.message.text,
          scheduled_at: editingCampaign.scheduledAt ? new Date(editingCampaign.scheduledAt).toISOString() : null
        })
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar el estado local
        const updatedCampaigns = campaigns.map(c =>
          c.id === editingCampaign.id ? editingCampaign : c
        );
        setCampaigns(updatedCampaigns);
        saveCampaigns(updatedCampaigns);
        setShowEditDialog(false);
        setEditingCampaign(null);
        setSuccess('Campaña actualizada exitosamente');
      } else {
        setError(data.error || 'Error al actualizar campaña');
      }
    } catch (error) {
      console.error('Error updating campaign:', error);
      setError('Error de conexión al actualizar campaña');
    }
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
      case 'failed': return <ErrorIcon />;
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
          <Tab label="📅 Envíos Personalizados" />
          <Tab label="Directas" />
          <Tab label="Programadas" />
          <Tab label="Historial" />
        </Tabs>
      </Paper>

      {/* Personalized Campaigns Tab */}
      {currentTab === 1 && (
        <PersonalizedCampaignModule sessionId={sessionId} />
      )}

      {/* Campaigns List */}
      {currentTab !== 1 && (
        <Grid container spacing={3}>
          {campaigns
            .filter(campaign => {
              if (currentTab === 2) return campaign.type === 'direct';
              if (currentTab === 3) return campaign.type === 'scheduled';
              if (currentTab === 4) return campaign.status === 'completed' || campaign.status === 'failed';
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
                      {(() => {
                        const sent = campaign.progress.sent;
                        const total = campaign.progress.total;
                        const progressValue = campaign.status === 'completed'
                          ? 100
                          : total > 0
                            ? (sent / total) * 100
                            : 0;
                        return (
                          <LinearProgress
                            variant="determinate"
                            value={progressValue}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        );
                      })()}
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

                    {/* Mostrar fecha/hora SIEMPRE si tiene scheduledAt (incluso cuando está enviando) */}
                    {campaign.scheduledAt && (() => {
                      const scheduledDate = new Date(campaign.scheduledAt);
                      if (isNaN(scheduledDate.getTime())) return null; // Fecha inválida

                      return (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          <Typography variant="body2">
                            <strong>📅 Programada para:</strong><br />
                            {scheduledDate.toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}<br />
                            <strong>⏰ Hora:</strong> {scheduledDate.toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {campaign.status === 'sending' && campaign.progress.sent > 0 && (
                              <><br /><strong style={{ color: '#4caf50' }}>✓ Enviando: {campaign.progress.sent}/{campaign.progress.total}</strong></>
                            )}
                          </Typography>
                        </Alert>
                      );
                    })()}

                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Botones de acción organizados */}
                      {campaign.status !== 'completed' ? (
                        <>
                          {(() => {
                            const scheduledDate = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;
                            const now = new Date();
                            const isPast = scheduledDate && scheduledDate <= now;

                            // 1. Enviar / Sending
                            if (campaign.status === 'sending') {
                              return (
                                <>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                    <CircularProgress size={20} />
                                    <Typography variant="body2">
                                      Enviando... {sendingProgress[campaign.id] || 0}%
                                    </Typography>
                                  </Box>
                                  {/* Force Execute for non-scheduled or just manual override? 
                                      User wanted "one button". If sending, usually no start button. */}

                                  <Button
                                    variant="contained"
                                    size="small"
                                    color="warning"
                                    startIcon={<Pause />}
                                    onClick={() => pauseCampaign(campaign.id)}
                                  >
                                    Pausar
                                  </Button>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    color="error" // Detener = Eliminar proceso de envio
                                    startIcon={<Stop />}
                                    onClick={() => confirmDeleteCampaign(campaign)}
                                  >
                                    Detener
                                  </Button>
                                </>
                              );
                            }

                            // 2. Pausado / Paused
                            if (campaign.status === 'paused') {
                              return (
                                <>
                                  <Chip
                                    icon={<Pause />}
                                    label="Campaña Pausada"
                                    color="warning"
                                    size="small"
                                  />
                                  <Button
                                    variant="contained"
                                    size="small"
                                    color="success"
                                    startIcon={<PlayArrow />}
                                    onClick={() => resumeCampaign(campaign.id)}
                                    sx={{
                                      bgcolor: '#00a884',
                                      color: 'white',
                                      '&:hover': { bgcolor: '#008069' },
                                      minWidth: 100
                                    }}
                                  >
                                    Reanudar
                                  </Button>
                                </>
                              );
                            }

                            // 3. Programada / Scheduled
                            if (campaign.status === 'scheduled') {
                              return (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Chip
                                    icon={<AccessTime />}
                                    label="Esperando ejecución..."
                                    color="info"
                                    variant="outlined"
                                    size="small"
                                  />
                                </Box>
                              );
                            }

                            // 4. Borrador / Draft (Default start)
                            // Aplica para Draft y Direct (que empieza como draft)
                            // O cualquier otro estado no manejado
                            return (
                              <>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<PlayArrow />}
                                  onClick={() => startCampaign(campaign.id)}
                                  sx={{
                                    bgcolor: '#00a884',
                                    color: 'white',
                                    '&:hover': { bgcolor: '#008069' },
                                    minWidth: 100
                                  }}
                                >
                                  Iniciar
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<Edit />}
                                  onClick={() => openEditDialog(campaign)}
                                  sx={{ minWidth: 100 }}
                                >
                                  Editar
                                </Button>
                              </>
                            );
                          })()}

                          {/* Botones Comunes (Detalles - Eliminar) */}
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Visibility />}
                            onClick={() => viewCampaignDetails(campaign.id)}
                            sx={{ minWidth: 100 }}
                          >
                            Detalles
                          </Button>

                          {/* Eliminar: No mostrar si estamos 'sending' porque ya mostramos 'Detener' */}
                          {campaign.status !== 'sending' && (
                            <Button
                              variant="outlined"
                              size="small"
                              color="error"
                              startIcon={<Delete />}
                              onClick={() => confirmDeleteCampaign(campaign)}
                              sx={{ minWidth: 100 }}
                            >
                              Eliminar
                            </Button>
                          )}
                        </>
                      ) : (
                        /* Completed State */
                        <>
                          <Chip
                            label={campaign.completedAt && !isNaN(new Date(campaign.completedAt).getTime())
                              ? `Completada el ${new Date(campaign.completedAt).toLocaleDateString('es-ES')}`
                              : 'Completada'}
                            color="success"
                            size="small"
                            sx={{ flex: '0 1 auto' }}
                          />
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Visibility />}
                            onClick={() => viewCampaignDetails(campaign.id)}
                            sx={{ minWidth: 100 }}
                          >
                            Detalles
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<Delete />}
                            onClick={() => confirmDeleteCampaign(campaign)}
                            sx={{ minWidth: 100 }}
                          >
                            Eliminar
                          </Button>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          }
        </Grid >
      )
      }

      {
        currentTab !== 1 && campaigns.length === 0 && (
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
        )
      }

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
                  {!senderLoading && senderSessions.length === 0 && (
                    <Alert severity="warning">
                      No encontramos líneas conectadas. Presiona &quot;Actualizar sesiones&quot; o ve a Configuración &gt; WhatsApp para conectar una línea.
                    </Alert>
                  )}
                  <FormControl fullWidth>
                    <InputLabel id="sender-session-label">Línea de envío</InputLabel>
                    <Select
                      labelId="sender-session-label"
                      value={senderSessionId}
                      label="Línea de envío"
                      onChange={(e) => setSenderSessionId(e.target.value as string)}
                    >
                      {(senderSessions.length > 0 ? senderSessions : [{ sessionId: sessionId }]).map((s) => (
                        <MenuItem key={s.sessionId} value={s.sessionId}>
                          {s.phoneNumber || s.sessionId}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={loadSenderSessions}
                      disabled={senderLoading}
                    >
                      Actualizar sesiones
                    </Button>
                    <Chip
                      label={`Sesiones activas: ${senderSessions.length}`}
                      size="small"
                      color="primary"
                    />
                    {senderError && <Alert severity="error" sx={{ flex: 1 }}>{senderError}</Alert>}
                  </Stack>
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
                              <strong>Envíos Aleatorios:</strong> Distribuye TODOS los mensajes de la campaña en diferentes momentos aleatorios dentro del tiempo especificado.<br />
                              <strong>Ejemplo:</strong> Si tienes 5 contactos y configuras 5 minutos, los mensajes se enviarán en momentos aleatorios como: 0:43, 1:28, 2:15, 3:47, 4:22
                            </Typography>
                          </Alert>

                          <TextField
                            fullWidth
                            label="Distribuir EN cuántos minutos"
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
                            helperText={`Todos los ${newCampaign.contacts?.length || 0} mensajes se distribuirán aleatoriamente en este tiempo`}
                          />

                          <TextField
                            fullWidth
                            label="Cantidad de mensajes"
                            type="number"
                            value={newCampaign.flowConfig?.messagesCount || (newCampaign.contacts?.length || 0) || 1}
                            onChange={(e) => setNewCampaign(prev => ({
                              ...prev,
                              flowConfig: {
                                messagesCount: Math.max(1, parseInt(e.target.value) || 1),
                                timeSpanMinutes: prev.flowConfig?.timeSpanMinutes || 1
                              }
                            }))}
                            inputProps={{ min: 1 }}
                            helperText={`Se programarán ${newCampaign.flowConfig?.messagesCount || (newCampaign.contacts?.length || 0) || 1} envíos en ${newCampaign.flowConfig?.timeSpanMinutes || 1} minuto(s)`}
                          />

                          <Alert severity="success" sx={{ mt: 1 }}>
                            <Typography variant="body2">
                              📊 <strong>Configuración actual:</strong><br />
                              Enviaré <strong>{newCampaign.flowConfig?.messagesCount || (newCampaign.contacts?.length || 0) || 1} mensajes</strong> distribuidos aleatoriamente <strong>EN {newCampaign.flowConfig?.timeSpanMinutes || 1} minuto(s)</strong>.<br />
                              Tiempo promedio entre mensajes: ~{(() => {
                                const minutes = newCampaign.flowConfig?.timeSpanMinutes || 1;
                                const count = newCampaign.flowConfig?.messagesCount || (newCampaign.contacts?.length || 0) || 1;
                                return Math.max(1, Math.round((minutes * 60) / count));
                              })()} segundos.<br />
                              Nota: los intervalos serán aleatorios y no iguales.
                            </Typography>
                          </Alert>
                        </Stack>
                      )}
                    </FormControl>
                  </Box>

                  {/* Configuración de ID FLOW */}
                  <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'success.50' }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      ✅ ID FLOW (Sistema Avanzado) - ACTIVADO POR DEFECTO
                    </Typography>
                    <FormControl component="fieldset">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Switch
                          checked={newCampaign.useIdFlow !== false} // Activado por defecto
                          onChange={(e) => setNewCampaign(prev => ({
                            ...prev,
                            useIdFlow: e.target.checked
                          }))}
                          color="success"
                        />
                        <Typography fontWeight="medium">Habilitar ID FLOW (Recomendado)</Typography>
                      </Box>

                      <Alert severity="success" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          <strong>✅ ID FLOW ACTIVADO:</strong> Cada mensaje incluirá un código único de tamaño variable (64, 45, 32, etc. caracteres) para mejor identificación y seguimiento. Esto ayuda a evitar detección como spam.
                        </Typography>
                      </Alert>

                      {newCampaign.useIdFlow && (
                        <Typography variant="body2" color="success.dark" sx={{ p: 1, bgcolor: 'success.50', borderRadius: 1 }}>
                          ✅ IDs automáticos generados con tamaños variables: 64, 45, 32, 28, 56, 40, 35, 48 caracteres
                        </Typography>
                      )}
                    </FormControl>
                  </Box>

                  {/* Información de velocidad de envío */}
                  <Alert severity="info" icon={<AccessTime />} sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>⏱️ Velocidad de Envío por Defecto (ALEATORIO):</strong><br />
                      • Cada mensaje se envía con un <strong>intervalo aleatorio entre 1:00 y 2:00 minutos</strong><br />
                      • Ejemplos de intervalos: 1:05, 1:40, 1:25, 1:34, 1:45, 1:52, 1:11 (siempre diferente)<br />
                      • Para {newCampaign.contacts?.length || 0} contactos: ~{Math.ceil((newCampaign.contacts?.length || 0) * 1.5)} minutos totales<br />
                      • Puedes configurar manualmente activando "Envíos Aleatorios" arriba
                    </Typography>
                  </Alert>

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
                  {/* Selector con cuatro pestañas */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      📋 Selección de Contactos
                    </Typography>
                    <Tabs
                      value={contactSelectionTab}
                      onChange={(e, newValue) => setContactSelectionTab(newValue)}
                      variant="fullWidth"
                    >
                      <Tab
                        label="Envío Directo"
                        icon={<Send />}
                      />
                      <Tab
                        label="WhatsApp Contactos"
                        icon={<WhatsApp />}
                      />

                      <Tab
                        label="Tableros Kanban"
                        icon={<ViewColumn />}
                      />

                    </Tabs>
                  </Paper>

                  {/* Tab 0: Envío Directo */}
                  {contactSelectionTab === 0 && (
                    <Box>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          <strong>Formato:</strong> Pega una lista de números con nombres, un contacto por línea.<br />
                          <strong>Ejemplo:</strong><br />
                          595985768793,Juan Pérez<br />
                          595972596219,María García<br />
                          595991234567,Pedro López
                        </Typography>
                      </Alert>
                      <TextField
                        fullWidth
                        multiline
                        rows={10}
                        label="Lista de Contactos (numero,nombre)"
                        placeholder="595985768793,Juan Pérez
595972596219,María García
595991234567,Pedro López"
                        value={contactsInput}
                        onChange={(e) => handleContactsInput(e.target.value)}
                        helperText={`${newCampaign.contacts?.length || 0} contactos detectados`}
                      />
                    </Box>
                  )}

                  {/* Tab 1: WhatsApp Contactos */}
                  {contactSelectionTab === 1 && (
                    <Box>
                      {/* Buscador de contactos */}
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Buscar contacto por nombre o teléfono..."
                        value={contactSearchTerm}
                        onChange={(e) => setContactSearchTerm(e.target.value)}
                        sx={{ mb: 2 }}
                        InputProps={{
                          startAdornment: (
                            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                              <Search sx={{ color: 'text.secondary' }} />
                            </Box>
                          ),
                        }}
                      />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1">
                          Contactos de WhatsApp ({whatsappContacts.length} de {totalContacts})
                        </Typography>
                        <Button
                          size="small"
                          startIcon={selectedWhatsAppContacts.length === whatsappContacts.length ? <CheckBox /> : <CheckBoxOutlineBlank />}
                          onClick={handleSelectAllWhatsAppContacts}
                          disabled={whatsappContacts.length === 0}
                        >
                          {selectedWhatsAppContacts.length === whatsappContacts.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                        </Button>
                      </Box>

                      <Typography variant="body2" color="primary" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {selectedWhatsAppContacts.length} contactos seleccionados
                      </Typography>

                      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                        <Grid container spacing={1}>
                          {whatsappContacts.map((contact) => (
                            <Grid item xs={12} sm={6} key={contact.id}>
                              <Paper
                                sx={{
                                  p: 1.5,
                                  cursor: 'pointer',
                                  bgcolor: selectedWhatsAppContacts.includes(contact.id) ? 'action.selected' : 'background.paper',
                                  '&:hover': { bgcolor: 'action.hover' },
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}
                                onClick={() => handleWhatsAppContactSelection(contact.id)}
                              >
                                <Checkbox checked={selectedWhatsAppContacts.includes(contact.id)} />
                                <WhatsApp sx={{ color: '#25d366', fontSize: 20 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" noWrap fontWeight="medium">
                                    {contact.name || contact.notify_name || 'Sin nombre'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {contact.phone || contact.jid.split('@')[0]}
                                  </Typography>
                                </Box>
                              </Paper>
                            </Grid>
                          ))}

                          {/* Indicador de carga */}
                          {contactsLoading && (
                            <Grid item xs={12}>
                              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                <CircularProgress size={32} />
                              </Box>
                            </Grid>
                          )}
                        </Grid>

                        {/* Mensaje cuando no hay contactos */}
                        {!contactsLoading && whatsappContacts.length === 0 && (
                          <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <WhatsApp sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="body2" color="text.secondary">
                              {contactSearchTerm ? 'No se encontraron contactos con ese criterio' : 'No hay contactos de WhatsApp sincronizados'}
                            </Typography>
                          </Paper>
                        )}
                      </Box>

                      {/* Botón Cargar Más */}
                      {contactsHasMore && !contactsLoading && whatsappContacts.length > 0 && (
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                          <Button
                            variant="outlined"
                            onClick={loadMoreWhatsAppContacts}
                            startIcon={<Add />}
                          >
                            Cargar más contactos (mostrados {whatsappContacts.length} de {totalContacts})
                          </Button>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Tab 2: Tableros Kanban */}
                  {contactSelectionTab === 2 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1">
                          Tableros Kanban ({kanbanBoards.length})
                        </Typography>
                        <Button
                          size="small"
                          startIcon={selectedKanbanBoards.length === kanbanBoards.length ? <CheckBox /> : <CheckBoxOutlineBlank />}
                          onClick={handleSelectAllKanbanBoards}
                        >
                          {selectedKanbanBoards.length === kanbanBoards.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                        </Button>
                      </Box>
                      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                        <Grid container spacing={1}>
                          {kanbanBoards.map((board) => {
                            const boardContacts = kanbanContacts[board.name] || [];
                            return (
                              <Grid item xs={12} sm={6} key={board.id}>
                                <Paper
                                  sx={{
                                    p: 1.5,
                                    cursor: 'pointer',
                                    bgcolor: selectedKanbanBoards.includes(board.name) ? 'action.selected' : 'background.paper',
                                    '&:hover': { bgcolor: 'action.hover' },
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                  }}
                                  onClick={() => handleKanbanBoardSelection(board.name)}
                                >
                                  <Checkbox checked={selectedKanbanBoards.includes(board.name)} />
                                  <Folder sx={{ color: board.color, fontSize: 20 }} />
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" noWrap fontWeight="medium">
                                      {board.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {boardContacts.length} contactos
                                    </Typography>
                                  </Box>
                                </Paper>
                              </Grid>
                            );
                          })}
                        </Grid>
                        {kanbanBoards.length === 0 && (
                          <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <ViewColumn sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="body2" color="text.secondary">
                              No hay tableros Kanban creados
                            </Typography>
                          </Paper>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Tab 4: Grupos Locales */}


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
                      <strong>Variables disponibles:</strong><br />
                      {'{nombre}'} - Se reemplaza por el nombre del contacto<br />
                      <strong>Ejemplo:</strong> "Hola {'{nombre}'}, como estas?"
                    </Typography>
                  </Alert>

                  {/* Barra de herramientas multimedia y emojis */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Description />}
                      onClick={() => setShowTemplatesDialog(true)}
                      sx={{
                        bgcolor: '#00a884',
                        '&:hover': { bgcolor: '#008069' }
                      }}
                    >
                      Plantillas
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Settings />}
                      onClick={() => setShowCreateTemplateDialog(true)}
                    >
                      Crear Plantilla
                    </Button>

                    <IconButton
                      size="small"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      color={showEmojiPicker ? "primary" : "default"}
                      title="Agregar emoji"
                    >
                      <EmojiEmotions />
                    </IconButton>

                    <IconButton
                      size="small"
                      component="label"
                      title="Adjuntar archivo"
                    >
                      <AttachFile />
                      <input
                        type="file"
                        hidden
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                        onChange={handleMediaUpload}
                      />
                    </IconButton>

                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setNewCampaign(prev => ({
                        ...prev,
                        message: {
                          ...prev.message!,
                          text: (prev.message?.text || '') + '{nombre}'
                        }
                      }))}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {'{nombre}'}
                    </Button>
                  </Box>

                  {/* Selector de emojis completo */}
                  {showEmojiPicker && (
                    <Box sx={{ mb: 2, position: 'relative' }}>
                      <IconButton
                        size="small"
                        onClick={() => setShowEmojiPicker(false)}
                        sx={{ position: 'absolute', right: 0, top: 0, zIndex: 1 }}
                      >
                        <Close />
                      </IconButton>
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        width="100%"
                        height={400}
                        searchPlaceholder="Buscar emoji..."
                        previewConfig={{ showPreview: false }}
                      />
                    </Box>
                  )}

                  {/* Preview del archivo multimedia */}
                  {selectedMedia && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2">Archivo Adjunto</Typography>
                        <IconButton size="small" onClick={() => { setSelectedMedia(null); setMediaPreview(null); }}>
                          <Close />
                        </IconButton>
                      </Box>
                      <Paper sx={{ p: 2, bgcolor: (theme) => theme.palette.background.paper }}>
                        {mediaPreview ? (
                          <img
                            src={mediaPreview}
                            alt="Preview"
                            style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {selectedMedia.type.startsWith('video/') && <VideoFile color="primary" />}
                            {selectedMedia.type.startsWith('audio/') && <AttachFile color="primary" />}
                            {selectedMedia.type.includes('pdf') && <AttachFile color="error" />}
                            <Typography variant="body2">
                              {selectedMedia.name} ({(selectedMedia.size / 1024 / 1024).toFixed(2)} MB)
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  )}

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
                    <Paper sx={{ p: 2, bgcolor: isDarkMode ? '#1e1e1e' : '#e3f2fd', mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Vista Previa:
                      </Typography>
                      <Typography variant="body2">
                        {previewMessage}
                      </Typography>
                      {selectedMedia && (
                        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                          📎 Archivo adjunto: {selectedMedia.name}
                        </Typography>
                      )}
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

      {/* Diálogo de Historial Detallado */}
      <Dialog
        open={showHistoryDialog}
        onClose={() => {
          setShowHistoryDialog(false);
          setSelectedCampaignDetails(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              📊 Historial Detallado de Campaña
            </Typography>
            <Box>
              <IconButton
                onClick={() => selectedCampaignDetails && loadCampaignDetails(selectedCampaignDetails.campaign.id)}
                title="Refrescar datos"
                disabled={loadingDetails}
              >
                <Refresh />
              </IconButton>
              <IconButton onClick={() => setShowHistoryDialog(false)} title="Cerrar">
                <Close />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedCampaignDetails ? (
            <Box>
              {/* Botones de Exportar */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<Description />}
                  onClick={() => {
                    // TODO: Implementar exportar a Excel
                    alert('Exportar a Excel - En desarrollo');
                  }}
                  sx={{
                    bgcolor: '#217346',
                    '&:hover': { bgcolor: '#1a5c37' }
                  }}
                >
                  Exportar a Excel
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Description />}
                  onClick={() => {
                    // TODO: Implementar exportar a PDF
                    alert('Exportar a PDF - En desarrollo');
                  }}
                >
                  Exportar a PDF
                </Button>
              </Box>

              {/* Información de la Campaña - Card Principal */}
              <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                      <Typography variant="h5" sx={{ color: 'white', mb: 1, fontWeight: 600 }}>
                        {selectedCampaignDetails.campaign.name}
                      </Typography>
                      <Chip
                        label={selectedCampaignDetails.campaign.status.toUpperCase()}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          fontWeight: 600
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' } }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                        {new Date(selectedCampaignDetails.campaign.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                      📝 Mensaje
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'white' }}>
                      {selectedCampaignDetails.campaign.message_template}
                    </Typography>
                  </Box>

                  {selectedCampaignDetails.recipients?.[0]?.sender_phone && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                        📱 Enviado desde
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>
                        {selectedCampaignDetails.recipients[0].sender_phone}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Tarjetas de Estadísticas - 6 tarjetas en 2 filas */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <People sx={{ color: 'white', mr: 1, fontSize: 30 }} />
                        <Typography variant="h6" sx={{ color: 'white' }}>
                          Total
                        </Typography>
                      </Box>
                      <Typography variant="h3" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaignDetails.recipients?.length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Destinatarios
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Schedule sx={{ color: 'white', mr: 1, fontSize: 30 }} />
                        <Typography variant="h6" sx={{ color: 'white' }}>
                          Pendiente
                        </Typography>
                      </Box>
                      <Typography variant="h3" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'pending').length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        En cola
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Send sx={{ color: 'white', mr: 1, fontSize: 30 }} />
                        <Typography variant="h6" sx={{ color: 'white' }}>
                          Enviados
                        </Typography>
                      </Box>
                      <Typography variant="h3" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'sent').length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Mensajes enviados
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #00c853 0%, #00e676 100%)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CheckCircle sx={{ color: 'white', mr: 1, fontSize: 30 }} />
                        <Typography variant="h6" sx={{ color: 'white' }}>
                          Entregados
                        </Typography>
                      </Box>
                      <Typography variant="h3" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'delivered').length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Confirmados
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Visibility sx={{ color: 'white', mr: 1, fontSize: 30 }} />
                        <Typography variant="h6" sx={{ color: 'white' }}>
                          Vistos
                        </Typography>
                      </Box>
                      <Typography variant="h3" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'read').length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Leídos
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{
                    background: 'linear-gradient(135deg, #f44336 0%, #e91e63 100%)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'translateY(-4px)' }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <ErrorIcon sx={{ color: 'white', mr: 1, fontSize: 30 }} />
                        <Typography variant="h6" sx={{ color: 'white' }}>
                          Fallidos
                        </Typography>
                      </Box>
                      <Typography variant="h3" sx={{ color: 'white', fontWeight: 700 }}>
                        {selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'failed').length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Con error
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Tabla de Destinatarios */}
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Destinatarios
              </Typography>

              {/* Filtros y Búsqueda */}
              <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="Buscar por nombre o número..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ mr: 1, display: 'flex' }}>
                        🔍
                      </Box>
                    ),
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={`Todos (${selectedCampaignDetails.recipients?.length || 0})`}
                    onClick={() => setHistoryStatusFilter('all')}
                    color={historyStatusFilter === 'all' ? 'primary' : 'default'}
                    variant={historyStatusFilter === 'all' ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={`Pendiente (${selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'pending').length || 0})`}
                    onClick={() => setHistoryStatusFilter('pending')}
                    color={historyStatusFilter === 'pending' ? 'default' : 'default'}
                    variant={historyStatusFilter === 'pending' ? 'filled' : 'outlined'}
                    icon={<Schedule />}
                  />
                  <Chip
                    label={`Enviado (${selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'sent').length || 0})`}
                    onClick={() => setHistoryStatusFilter('sent')}
                    color={historyStatusFilter === 'sent' ? 'primary' : 'default'}
                    variant={historyStatusFilter === 'sent' ? 'filled' : 'outlined'}
                    icon={<Send />}
                  />
                  <Chip
                    label={`Entregado (${selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'delivered').length || 0})`}
                    onClick={() => setHistoryStatusFilter('delivered')}
                    color={historyStatusFilter === 'delivered' ? 'info' : 'default'}
                    variant={historyStatusFilter === 'delivered' ? 'filled' : 'outlined'}
                    icon={<CheckCircle />}
                  />
                  <Chip
                    label={`Visto (${selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'read').length || 0})`}
                    onClick={() => setHistoryStatusFilter('read')}
                    color={historyStatusFilter === 'read' ? 'success' : 'default'}
                    variant={historyStatusFilter === 'read' ? 'filled' : 'outlined'}
                    icon={<CheckCircle />}
                  />
                  <Chip
                    label={`Fallido (${selectedCampaignDetails.recipients?.filter((r: any) => r.status === 'failed').length || 0})`}
                    onClick={() => setHistoryStatusFilter('failed')}
                    color={historyStatusFilter === 'failed' ? 'error' : 'default'}
                    variant={historyStatusFilter === 'failed' ? 'filled' : 'outlined'}
                    icon={<ErrorIcon />}
                  />
                </Box>
              </Box>

              <Paper sx={{ overflow: 'hidden' }}>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
                      zIndex: 1
                    }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                          #
                        </th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                          Contacto
                        </th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                          Número
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                          Estado
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                          Fecha de Envío
                        </th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCampaignDetails.recipients && selectedCampaignDetails.recipients.length > 0 ? (
                        selectedCampaignDetails.recipients
                          .filter((recipient: any) => {
                            // Filtro por estado
                            if (historyStatusFilter !== 'all' && recipient.status !== historyStatusFilter) {
                              return false;
                            }
                            // Filtro por búsqueda
                            if (historySearchTerm) {
                              const searchLower = historySearchTerm.toLowerCase();
                              const name = (recipient.contact_name || '').toLowerCase();
                              const phone = (recipient.contact_jid?.split('@')[0] || '').toLowerCase();
                              return name.includes(searchLower) || phone.includes(searchLower);
                            }
                            return true;
                          })
                          .map((recipient: any, index: number) => (
                            <tr key={recipient.id} style={{
                              borderBottom: '1px solid #eee',
                              backgroundColor: index % 2 === 0 ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                            }}>
                              <td style={{ padding: '12px' }}>
                                {index + 1}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {recipient.contact_name || 'Sin nombre'}
                              </td>
                              <td style={{ padding: '12px' }}>
                                {recipient.contact_jid?.split('@')[0] || 'N/A'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <Chip
                                  label={recipient.status?.toUpperCase() || 'PENDING'}
                                  size="small"
                                  color={
                                    recipient.status === 'read' ? 'success' :
                                      recipient.status === 'delivered' ? 'info' :
                                        recipient.status === 'sent' ? 'primary' :
                                          recipient.status === 'failed' ? 'error' :
                                            'default'
                                  }
                                  icon={
                                    recipient.status === 'read' ? <CheckCircle /> :
                                      recipient.status === 'delivered' ? <CheckCircle /> :
                                        recipient.status === 'sent' ? <Send /> :
                                          recipient.status === 'failed' ? <ErrorIcon /> :
                                            <Schedule />
                                  }
                                />
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                {recipient.sent_at ? new Date(recipient.sent_at).toLocaleString('es-ES') : '-'}
                              </td>
                              <td style={{ padding: '12px', fontSize: '0.85em', color: '#f44336' }}>
                                {recipient.error_message || '-'}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ padding: '24px', textAlign: 'center' }}>
                            No hay destinatarios registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Box>
              </Paper>


            </Box>
          ) : (
            <Typography>No hay datos disponibles</Typography>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edición de Campaña */}
      <Dialog
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingCampaign(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          ✏️ Editar Campaña
        </DialogTitle>
        <DialogContent>
          {editingCampaign && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Nombre de la Campaña"
                value={editingCampaign.name}
                onChange={(e) => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                required
              />

              <TextField
                fullWidth
                label="Mensaje"
                multiline
                rows={4}
                value={editingCampaign.message.text}
                onChange={(e) => setEditingCampaign({
                  ...editingCampaign,
                  message: { ...editingCampaign.message, text: e.target.value }
                })}
                required
                helperText="Usa {nombre} para personalizar con el nombre del contacto"
              />

              {editingCampaign.type === 'scheduled' && (
                <TextField
                  fullWidth
                  label="Fecha y Hora Programada"
                  type="datetime-local"
                  value={editingCampaign.scheduledAt ? new Date(editingCampaign.scheduledAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingCampaign({
                    ...editingCampaign,
                    scheduledAt: new Date(e.target.value).toISOString()
                  })}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingCampaign(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  onClick={saveEditCampaign}
                  sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008069' } }}
                >
                  Guardar Cambios
                </Button>
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Plantillas */}
      <Dialog
        open={showTemplatesDialog}
        onClose={() => setShowTemplatesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description />
          Plantillas de Mensajes
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {templates.map((template) => (
              <Grid item xs={12} sm={6} key={template.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                      transition: 'all 0.2s'
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                        {template.name}
                      </Typography>
                      <Chip
                        label={template.category}
                        size="small"
                        color="primary"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {template.message_template}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ContentCopy />}
                        onClick={() => applyTemplate(template)}
                        sx={{
                          bgcolor: '#00a884',
                          '&:hover': { bgcolor: '#008069' }
                        }}
                      >
                        Usar
                      </Button>
                      {template.phone_number !== 'ALL' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<Delete />}
                          onClick={() => confirmDeleteTemplate(template)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {templates.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No hay plantillas disponibles. Crea tu primera plantilla personalizada.
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Crear Plantilla */}
      <Dialog
        open={showCreateTemplateDialog}
        onClose={() => {
          setShowCreateTemplateDialog(false);
          setShowTemplateEmojiPicker(false);
          setNewTemplate({ name: '', message: '', category: 'general' });
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings />
          Crear Plantilla Personalizada
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Variables disponibles:</strong><br />
                {'{nombre}'} - Nombre del contacto<br />
                {'{telefono}'} - Número de teléfono
              </Typography>
            </Alert>

            <TextField
              fullWidth
              label="Nombre de la Plantilla"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              placeholder="Ej: Saludo Personalizado"
            />

            <FormControl fullWidth>
              <InputLabel>Categoría</InputLabel>
              <Select
                value={newTemplate.category}
                onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                label="Categoría"
              >
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="saludos">Saludos</MenuItem>
                <MenuItem value="recordatorios">Recordatorios</MenuItem>
                <MenuItem value="marketing">Marketing</MenuItem>
                <MenuItem value="seguimiento">Seguimiento</MenuItem>
                <MenuItem value="pagos">Pagos</MenuItem>
              </Select>
            </FormControl>

            {/* Botón de emoji para plantilla */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <IconButton
                size="small"
                onClick={() => setShowTemplateEmojiPicker(!showTemplateEmojiPicker)}
                color={showTemplateEmojiPicker ? "primary" : "default"}
                title="Agregar emoji"
              >
                <EmojiEmotions />
              </IconButton>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setNewTemplate(prev => ({
                  ...prev,
                  message: prev.message + '{nombre}'
                }))}
              >
                {'{nombre}'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setNewTemplate(prev => ({
                  ...prev,
                  message: prev.message + '{telefono}'
                }))}
              >
                {'{telefono}'}
              </Button>
            </Box>

            {/* Selector de emojis para plantilla */}
            {showTemplateEmojiPicker && (
              <Box sx={{
                position: 'relative',
                zIndex: 9999,
                '& .epr-main': {
                  width: '100%'
                }
              }}>
                <EmojiPicker
                  onEmojiClick={(emojiData: EmojiClickData) => {
                    setNewTemplate(prev => ({
                      ...prev,
                      message: prev.message + emojiData.emoji
                    }));
                  }}
                  searchPlaceHolder="Buscar emoji..."
                  width="100%"
                  height={350}
                />
              </Box>
            )}

            <TextField
              fullWidth
              label="Mensaje"
              multiline
              rows={4}
              value={newTemplate.message}
              onChange={(e) => setNewTemplate({ ...newTemplate, message: e.target.value })}
              placeholder="Hola {nombre}, ¿cómo estás?"
              helperText="Usa {nombre} y {telefono} para personalizar"
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setShowCreateTemplateDialog(false);
                  setShowTemplateEmojiPicker(false);
                  setNewTemplate({ name: '', message: '', category: 'general' });
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={createTemplate}
                sx={{
                  bgcolor: '#00a884',
                  '&:hover': { bgcolor: '#008069' }
                }}
              >
                Crear Plantilla
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Eliminar Plantilla */}
      <Dialog
        open={showDeleteTemplateConfirm}
        onClose={() => {
          setShowDeleteTemplateConfirm(false);
          setTemplateToDelete(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: '#ffebee',
          color: '#c62828'
        }}>
          <ErrorIcon />
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta acción no se puede deshacer
          </Alert>

          <Typography variant="body1" gutterBottom>
            ¿Estás seguro de que deseas eliminar la plantilla?
          </Typography>

          {templateToDelete && (
            <Card sx={{ mt: 2, bgcolor: '#f5f5f5' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontSize: '0.95rem', mb: 1 }}>
                  {templateToDelete.name}
                </Typography>
                <Chip
                  label={templateToDelete.category}
                  size="small"
                  color="primary"
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {templateToDelete.message_template}
                </Typography>
              </CardContent>
            </Card>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setShowDeleteTemplateConfirm(false);
                setTemplateToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<Delete />}
              onClick={deleteTemplate}
            >
              Eliminar
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Eliminar Campaña */}
      <Dialog
        open={showDeleteCampaignConfirm}
        onClose={() => {
          setShowDeleteCampaignConfirm(false);
          setCampaignToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
            backgroundImage: 'none',
            border: isDarkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(0, 0, 0, 0.12)',
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#ffebee',
          color: isDarkMode ? '#ef4444' : '#c62828',
          borderBottom: isDarkMode ? '1px solid rgba(148, 163, 184, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)'
        }}>
          <ErrorIcon />
          Confirmar Eliminación de Campaña
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              bgcolor: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : undefined,
              color: isDarkMode ? '#fbbf24' : undefined,
              '& .MuiAlert-icon': {
                color: isDarkMode ? '#f59e0b' : undefined
              }
            }}
          >
            Esta acción eliminará la campaña permanentemente
          </Alert>

          <Typography variant="body1" gutterBottom>
            ¿Estás seguro de que deseas eliminar esta campaña?
          </Typography>

          {campaignToDelete && (
            <Card sx={{ 
              mt: 2, 
              bgcolor: isDarkMode ? '#0f172a' : '#f5f5f5',
              backgroundImage: 'none',
              border: isDarkMode ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(0, 0, 0, 0.12)'
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                    {campaignToDelete.name}
                  </Typography>
                  <Chip
                    label={campaignToDelete.status}
                    size="small"
                    color={
                      campaignToDelete.status === 'completed' ? 'success' :
                        campaignToDelete.status === 'sending' ? 'primary' :
                          campaignToDelete.status === 'failed' ? 'error' :
                            campaignToDelete.status === 'paused' ? 'warning' :
                              'default'
                    }
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                  <Chip
                    icon={<People />}
                    label={`${campaignToDelete.contacts?.length || 0} contactos`}
                    size="small"
                    variant="outlined"
                  />
                  {campaignToDelete.type === 'scheduled' && (
                    <Chip
                      icon={<Schedule />}
                      label="Programada"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                {campaignToDelete.progress && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Progreso: {campaignToDelete.progress.sent}/{campaignToDelete.progress.total} enviados
                    </Typography>
                    {campaignToDelete.progress.failed > 0 && (
                      <Typography variant="body2" color="error">
                        {campaignToDelete.progress.failed} fallidos
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setShowDeleteCampaignConfirm(false);
                setCampaignToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<Delete />}
              onClick={deleteCampaign}
            >
              Eliminar Campaña
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

    </Box >
  );
};

export default RealCampaignsModule; 