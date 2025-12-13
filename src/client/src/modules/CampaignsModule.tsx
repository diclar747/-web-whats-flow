import React, { useState, useEffect } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import PersonalizedCampaignModule from './PersonalizedCampaignModule';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  FormHelperText,
  Select,
  Switch,
  FormControlLabel,
  Badge,
  Stack,
  Tooltip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Radio,
  RadioGroup,
  FormLabel,
  Checkbox,
  FormGroup
} from '@mui/material';
import {
  Campaign,
  Add,
  Send,
  Schedule,
  People,
  Analytics,
  Settings,
  PlayArrow,
  Pause,
  Stop,
  Edit,
  Delete,
  Visibility,
  Download,
  Upload,
  FilterList,
  Search,
  MoreVert,
  CheckCircle,
  Error,
  Warning,
  Info,
  TrendingUp,
  TrendingDown,
  Message,
  Group,
  PersonAdd,
  ExpandMore,
  Timeline,
  DataUsage,
  Speed,
  AccessTime,
  ThumbUp,
  ThumbDown,
  Reply,
  Forward,
  Block,
  Star,
  Flag,
  Sync,
  CloudUpload,
  CalendarToday,
  Refresh,
  SaveAlt,
  Share,
  AttachFile,
  Image,
  VideoFile,
  InsertEmoticon,
  EmojiEmotions,
  ContentCopy,
  ContentPaste,
  Clear,
  PersonOutline,
  GroupOutlined,
  Phone,
  ContactPage,
  Close,
  DragIndicator
} from '@mui/icons-material';

interface CampaignsModuleProps {
  sessionId: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  type: 'broadcast' | 'drip' | 'triggered' | 'followup';
  createdAt: string;
  scheduledAt?: string;
  completedAt?: string;
  targets: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
  };
  message: {
    text: string;
    media?: string;
    hasVariables: boolean;
  };
  segments: string[];
  priority: 'high' | 'medium' | 'low';
  creator: string;
  estimatedCost: number;
  actualCost?: number;
  ctr: number; // Click Through Rate
  openRate: number;
  conversionRate: number;
}

interface Segment {
  id: string;
  name: string;
  description: string;
  count: number;
  criteria: {
    labels: string[];
    lastActivity: string;
    location?: string;
    customFields?: Record<string, any>;
  };
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category: string;
  usage: number;
  rating: number;
}

const CampaignsModule: React.FC<CampaignsModuleProps> = ({ sessionId }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    name: '',
    description: '',
    type: 'broadcast',
    priority: 'medium',
    message: { text: '', hasVariables: false },
    segments: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [senderSessions, setSenderSessions] = useState<Array<{ sessionId: string; phoneNumber?: string }>>([]);
  const [senderSessionIds, setSenderSessionIds] = useState<string[]>([sessionId]);
  const [senderLoading, setSenderLoading] = useState(false);
  const [senderError, setSenderError] = useState('');

  // Estados para gestión de segmentos
  const [showCreateSegmentDialog, setShowCreateSegmentDialog] = useState(false);
  const [newSegment, setNewSegment] = useState<Partial<Segment>>({
    name: '',
    description: '',
    criteria: {
      labels: [],
      lastActivity: 'all-time',
      customFields: {}
    }
  });

  // Nuevos estados para funcionalidades avanzadas
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsPage, setContactsPage] = useState(0);
  const [contactsHasMore, setContactsHasMore] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [totalContacts, setTotalContacts] = useState(0);

  const [kanbanBoards, setKanbanBoards] = useState<any[]>([]);
  const [kanbanBoardContacts, setKanbanBoardContacts] = useState<Record<string, any[]>>({});
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);


  const [selectedKanbanBoards, setSelectedKanbanBoards] = useState<string[]>([]);
  const [manualContacts, setManualContacts] = useState<Array<{phone: string, name: string}>>([]);
  const [manualContactText, setManualContactText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contactSelectionType, setContactSelectionType] = useState<'segments' | 'individual' | 'manual' | 'kanban'>('segments');
  const [contactSearchTerm, setContactSearchTerm] = useState('');

  useEffect(() => {
    loadCampaignsData();
  }, [sessionId]);

  useEffect(() => {
    loadSenderSessions();
  }, [sessionId]);

  // Función para cargar contactos desde la API con paginación
  const loadContactsAndGroups = async (resetContacts = true) => {

    try {
      console.log('🔄 Cargando contactos, grupos y tableros Kanban para campañas...');

      // Cargar contactos con paginación
      console.log('📞 Cargando contactos individuales (paginado)...');
      setContactsLoading(true);

      const page = resetContacts ? 0 : contactsPage;
      const limit = 20;
      const search = contactSearchTerm;

      const contactsResponse = await fetch(
        `${getAPIBaseURL()}/api/contacts/${sessionId}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
      );
      const contactsData = await contactsResponse.json();

      if (contactsData.success && contactsData.contacts) {
        console.log(`✅ ${contactsData.contacts.length} contactos cargados (página ${page + 1})`);

        const formattedContacts = contactsData.contacts.map((contact: any) => ({
          id: contact.jid || contact.whatsapp_id,
          name: contact.name || contact.notify_name || (contact.jid || contact.whatsapp_id).split('@')[0],
          phone: contact.phone || (contact.jid || contact.whatsapp_id).split('@')[0],
          avatar: contact.avatarUrl || contact.avatar_url,
          lastSeen: contact.last_seen,
          isOnline: false
        }));

        if (resetContacts) {
          setContacts(formattedContacts);
          setContactsPage(0);
        } else {
          setContacts(prev => [...prev, ...formattedContacts]);
        }

        setContactsHasMore(contactsData.hasMore);
        setTotalContacts(contactsData.total);
      } else {
        console.warn('⚠️ No se pudieron cargar contactos:', contactsData.error);
        if (resetContacts) {
          setContacts([]);
        }
      }

      setContactsLoading(false);

      // No cargar grupos de WhatsApp

      // Cargar tableros Kanban (solo en carga inicial)
      if (resetContacts) {
        console.log('📊 Cargando tableros Kanban...');
        try {
          const kanbanBoardsResponse = await fetch(`${getAPIBaseURL()}/api/kanban/boards/${sessionId}`);
          const kanbanBoardsData = await kanbanBoardsResponse.json();

          if (kanbanBoardsData.success && kanbanBoardsData.boards) {
            console.log(`✅ ${kanbanBoardsData.boards.length} tableros Kanban cargados`);
            setKanbanBoards(kanbanBoardsData.boards);

            // Cargar contactos de Kanban
            const kanbanContactsResponse = await fetch(`${getAPIBaseURL()}/api/kanban/contacts/${sessionId}`);
            const kanbanContactsData = await kanbanContactsResponse.json();

            if (kanbanContactsData.success && kanbanContactsData.contactsByBoard) {
              console.log(`✅ ${kanbanContactsData.totalContacts} contactos de Kanban cargados`);
              setKanbanBoardContacts(kanbanContactsData.contactsByBoard);
              console.log('✅ Contactos de Kanban organizados por tablero');
            } else {
              console.warn('⚠️ No se pudieron cargar contactos de Kanban');
              setKanbanBoardContacts({});
            }
          } else {
            console.warn('⚠️ No se pudieron cargar tableros Kanban:', kanbanBoardsData.error);
            setKanbanBoards([]);
          }
        } catch (kanbanError) {
          console.warn('⚠️ Error cargando tableros Kanban:', kanbanError);
          setKanbanBoards([]);
        }
      }

      console.log('✅ Carga de contactos, grupos y Kanban completada');
    } catch (error) {
      console.error('❌ Error loading contacts:', error);
      setContactsLoading(false);
      if (resetContacts) {
        setContacts([]);
        setKanbanBoards([]);
      }
    }
  };

  // Función para cargar más contactos
  const loadMoreContacts = async () => {
    if (contactsLoading || !contactsHasMore) return;

    const nextPage = contactsPage + 1;
    setContactsPage(nextPage);

    try {
      console.log(`📞 Cargando más contactos (página ${nextPage + 1})...`);
      setContactsLoading(true);

      const limit = 20;
      const search = contactSearchTerm;

      const contactsResponse = await fetch(
        `${getAPIBaseURL()}/api/contacts/${sessionId}?page=${nextPage}&limit=${limit}&search=${encodeURIComponent(search)}`
      );
      const contactsData = await contactsResponse.json();

      if (contactsData.success && contactsData.contacts) {
        console.log(`✅ ${contactsData.contacts.length} contactos adicionales cargados`);

        const formattedContacts = contactsData.contacts.map((contact: any) => ({
          id: contact.jid || contact.whatsapp_id,
          name: contact.name || contact.notify_name || (contact.jid || contact.whatsapp_id).split('@')[0],
          phone: contact.phone || (contact.jid || contact.whatsapp_id).split('@')[0],
          avatar: contact.avatarUrl || contact.avatar_url,
          lastSeen: contact.last_seen,
          isOnline: false
        }));

        setContacts(prev => [...prev, ...formattedContacts]);
        setContactsHasMore(contactsData.hasMore);
        setTotalContacts(contactsData.total);
      }

      setContactsLoading(false);
    } catch (error) {
      console.error('❌ Error loading more contacts:', error);
      setContactsLoading(false);
    }
  };

  // Effect para buscar contactos cuando cambia el término de búsqueda
  useEffect(() => {
    if (contactSelectionType === 'individual') {
      const delayDebounce = setTimeout(() => {
        loadContactsAndGroups(true);
      }, 500);

      return () => clearTimeout(delayDebounce);
    }
    return undefined;
  }, [contactSearchTerm]);

  // Effect para cargar contactos cuando se selecciona el tipo "individual"
  useEffect(() => {
    if (contactSelectionType === 'individual') {
      loadContactsAndGroups(true);
    }
  }, [contactSelectionType]);

  // Función para procesar contactos manuales
  const parseManualContacts = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const parsed = lines.map(line => {
      const parts = line.split(',').map(part => part.trim());
      if (parts.length >= 2) {
        return { phone: parts[0], name: parts[1] };
      } else if (parts.length === 1 && parts[0]) {
        return { phone: parts[0], name: parts[0].split('@')[0] };
      }
      return null;
    }).filter(Boolean) as Array<{phone: string, name: string}>;

    setManualContacts(parsed);
  };

  // Función para cargar participantes de un grupo


  // Función para manejar archivos multimedia
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

  // Lista de emojis comunes
  const commonEmojis = ['😀', '😃', '😊', '😍', '🥰', '😘', '🤗', '😂', '🤣', '😭', '🙏', '👋', '👍', '👏', '🎉', '🎊', '❤️', '💕', '💖', '💯', '🔥', '⭐', '✨', '💎', '🏆', '🎁', '💰', '💸', '📱', '💻'];

  const insertEmoji = (emoji: string) => {
    const currentText = newCampaign.message?.text || '';
    setNewCampaign(prev => ({
      ...prev,
      message: {
        ...prev.message!,
        text: currentText + emoji
      }
    }));
    setShowEmojiPicker(false);
  };

  const loadCampaignsData = async () => {
    
    try {
      setLoading(true);

      // Cargar contactos y grupos
      await loadContactsAndGroups();

      // Cargar campañas reales desde la API
      console.log('🔄 Cargando campañas reales desde la API...');
      let realCampaigns: Campaign[] = [];

      try {
        const campaignsResponse = await fetch(`${getAPIBaseURL()}/api/campaigns/${sessionId}`);
        const campaignsData = await campaignsResponse.json();

        if (campaignsData.success && campaignsData.campaigns) {
          // Convertir campañas de la API al formato esperado
          realCampaigns = campaignsData.campaigns.map((campaign: any) => ({
            id: campaign.id,
            name: campaign.name,
            description: `Campaña ${campaign.type} creada automáticamente`,
            status: campaign.status,
            type: campaign.type,
            createdAt: campaign.createdAt,
            scheduledAt: campaign.scheduledAt,
            completedAt: campaign.completedAt,
            targets: {
              total: campaign.progress?.total || campaign.contacts?.length || 0,
              sent: campaign.progress?.sent || 0,
              delivered: campaign.progress?.delivered || 0,
              read: Math.floor((campaign.progress?.sent || 0) * 0.75), // Estimación
              replied: Math.floor((campaign.progress?.sent || 0) * 0.15), // Estimación
              failed: campaign.progress?.failed || 0
            },
            message: {
              text: campaign.message?.text || 'Mensaje no disponible',
              media: campaign.message?.mediaUrl,
              hasVariables: (campaign.message?.text || '').includes('{{')
            },
            segments: campaign.segments || [],
            priority: 'medium',
            creator: 'Sistema',
            estimatedCost: 0,
            ctr: 0,
            openRate: 0,
            conversionRate: 0
          }));
          console.log(`✅ ${realCampaigns.length} campañas reales cargadas desde la API`);
        } else {
          console.warn('⚠️ No se pudieron cargar campañas desde la API:', campaignsData.error);

          // Crear campañas básicas del sistema si no hay campañas reales
          const systemCampaigns: Campaign[] = [
            {
              id: 'system-welcome',
              name: 'Campaña de Bienvenida',
              description: 'Mensaje automático de bienvenida para nuevos contactos',
              status: 'draft',
              type: 'broadcast',
              createdAt: new Date().toISOString(),
              targets: {
                total: contacts.length,
                sent: 0,
                delivered: 0,
                read: 0,
                replied: 0,
                failed: 0
              },
              message: {
                text: '¡Hola {{nombre}}! 👋 Bienvenido a WhatsFlow. Estamos aquí para ayudarte.',
                hasVariables: true
              },
              segments: ['todos-contactos'],
              priority: 'medium',
              creator: 'Sistema',
              estimatedCost: 0,
              ctr: 0,
              openRate: 0,
              conversionRate: 0
            }
          ];
          realCampaigns = systemCampaigns;
        }
      } catch (campaignsError) {
        console.error('❌ Error cargando campañas reales:', campaignsError);

        // Fallback básico sin BD
        realCampaigns = [
          {
            id: 'fallback-1',
            name: 'Campaña de Prueba',
            description: 'Campaña creada automáticamente para pruebas',
            status: 'draft',
            type: 'broadcast',
            createdAt: new Date().toISOString(),
            targets: {
              total: contacts.length,
              sent: 0,
              delivered: 0,
              read: 0,
              replied: 0,
              failed: 0
            },
            message: {
              text: 'Mensaje de prueba desde WhatsFlow',
              hasVariables: false
            },
            segments: ['todos-contactos'],
            priority: 'medium',
            creator: 'Sistema',
            estimatedCost: 0,
            ctr: 0,
            openRate: 0,
            conversionRate: 0
          }
        ];
      }

      // Cargar segmentos reales desde la API
      console.log('🔄 Cargando segmentos de audiencia reales...');
      let realSegments: Segment[] = [];

      try {
        const segmentsResponse = await fetch(`${getAPIBaseURL()}/api/segments/${sessionId}`);
        const segmentsData = await segmentsResponse.json();

        if (segmentsData.success && segmentsData.segments) {
          // Convertir segmentos de la API al formato esperado
          realSegments = segmentsData.segments.map((segment: any) => ({
            id: segment.id,
            name: segment.name,
            description: segment.description,
            count: segment.count || 0,
            criteria: segment.criteria || {
              labels: [segment.id],
              lastActivity: 'all-time',
              customFields: {}
            },
            createdAt: segment.createdAt || segment.created_at
          }));
          console.log(`✅ ${realSegments.length} segmentos reales cargados desde la API`);
        } else {
          console.warn('⚠️ No se pudieron cargar segmentos desde la API, creando segmentos básicos');

          // Crear segmentos básicos del sistema
          const basicSegments = [
            {
              id: 'todos-contactos',
              name: 'Todos los Contactos',
              description: 'Todos los contactos individuales guardados',
              count: contacts.length,
              criteria: {
                labels: ['todos-contactos'],
                lastActivity: 'all-time',
                customFields: {}
              },
              createdAt: new Date().toISOString()
            },
            {
              id: 'contactos-activos',
              name: 'Contactos Activos',
              description: 'Contactos con actividad reciente (últimos 30 días)',
              count: 0, // Se calculará después
              criteria: {
                labels: ['contactos-activos'],
                lastActivity: '30-days',
                customFields: {}
              },
              createdAt: new Date().toISOString()
            }
          ];

          // Guardar segmentos básicos en la BD
          for (const segment of basicSegments) {
            try {
              await fetch(`${getAPIBaseURL()}/api/segments/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  sessionId, 
                  name: segment.name,
                  description: segment.description
                })
              });
            } catch (createError) {
              console.warn('Error creando segmento básico:', createError);
            }
          }

          realSegments = basicSegments;
        }
      } catch (segmentsError) {
        console.error('❌ Error cargando segmentos reales:', segmentsError);

        // Fallback básico sin BD
        realSegments = [
          {
            id: 'todos-contactos',
            name: 'Todos los Contactos',
            description: 'Todos los contactos individuales guardados',
            count: contacts.length,
            criteria: {
              labels: ['todos-contactos'],
              lastActivity: 'all-time',
              customFields: {}
            },
            createdAt: new Date().toISOString()
          }
        ];
      }

      const mockTemplates: Template[] = [
        {
          id: '1',
          name: 'Bienvenida Nuevos Clientes',
          content: '¡Hola {{nombre}}! 👋 Bienvenido a {{empresa}}. Estamos emocionados de tenerte con nosotros.',
          variables: ['nombre', 'empresa'],
          category: 'Onboarding',
          usage: 245,
          rating: 4.8
        },
        {
          id: '2',
          name: 'Promoción Limitada',
          content: '🔥 ¡Oferta especial {{nombre}}! Solo por {{dias}} días: {{descuento}}% OFF. Código: {{codigo}}',
          variables: ['nombre', 'dias', 'descuento', 'codigo'],
          category: 'Promociones',
          usage: 892,
          rating: 4.6
        },
        {
          id: '3',
          name: 'Seguimiento Satisfacción',
          content: 'Hola {{nombre}}, ¿cómo estuvo tu experiencia con {{producto}}? Tu opinión nos ayuda a mejorar.',
          variables: ['nombre', 'producto'],
          category: 'Seguimiento',
          usage: 156,
          rating: 4.9
        }
      ];

      setCampaigns(realCampaigns);
      setSegments(realSegments);
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Error loading campaigns data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSenderSessions = async () => {
    setSenderLoading(true);
    setSenderError('');

    try {
      const response = await fetch(`${getAPIBaseURL()}/api/sessions/active`);
      const data = await response.json();

      if (data.success) {
        const mapped = (data.sessions || []).map((s: any) => ({
          sessionId: s.sessionId,
          phoneNumber: s.phoneNumber
        }));

        setSenderSessions(mapped);

        if (mapped.length > 0 && !senderSessionIds.some(id => mapped.some((s: { sessionId: string; phoneNumber?: string }) => s.sessionId === id))) {
          setSenderSessionIds([mapped[0].sessionId]);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#4caf50';
      case 'scheduled': return '#2196f3';
      case 'completed': return '#9e9e9e';
      case 'paused': return '#ff9800';
      case 'failed': return '#f44336';
      case 'draft': return '#9c27b0';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <PlayArrow />;
      case 'scheduled': return <Schedule />;
      case 'completed': return <CheckCircle />;
      case 'paused': return <Pause />;
      case 'failed': return <Error />;
      case 'draft': return <Edit />;
      default: return <Info />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const calculateProgress = (campaign: Campaign) => {
    if (campaign.targets.total === 0) return 0;
    return (campaign.targets.sent / campaign.targets.total) * 100;
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateCampaign = () => {
    loadSenderSessions();
    setShowCreateDialog(true);
    setActiveStep(0);
    setNewCampaign({
      name: '',
      description: '',
      type: 'broadcast',
      priority: 'medium',
      message: { text: '', hasVariables: false },
      segments: []
    });
  };

  // Función para enviar la campaña al backend
  const submitCampaign = async () => {
    
    try {
      setLoading(true);

      const activeSessionIds = senderSessionIds.length > 0 ? senderSessionIds : [sessionId];

      if (activeSessionIds.length === 0) {
        alert('Selecciona la línea de envío antes de crear la campaña.');
        setLoading(false);
        return;
      }

      // Si hay archivo multimedia, subirlo primero
      let mediaUrl = null;
      let mediaType = null;
      
      if (selectedMedia) {
        console.log('📤 Subiendo archivo multimedia...');
        const formData = new FormData();
        formData.append('file', selectedMedia);
        formData.append('sessionId', activeSessionIds[0]);

        const uploadResponse = await fetch(`${getAPIBaseURL()}/api/campaigns/upload-media`, {
          method: 'POST',
          body: formData
        });

        const uploadResult = await uploadResponse.json();
        
        if (uploadResult.success) {
          mediaUrl = uploadResult.data.mediaUrl;
          mediaType = uploadResult.data.mediaType;
          console.log('✅ Archivo multimedia subido:', mediaUrl);
        } else {
          throw new Error('Error al subir archivo multimedia');
        }
      }

      // Extraer contactos de los tableros Kanban seleccionados
      let kanbanContacts: any[] = [];
      if (contactSelectionType === 'kanban' && selectedKanbanBoards.length > 0) {
        selectedKanbanBoards.forEach(boardId => {
          const boardContacts = kanbanBoardContacts[boardId] || [];
          kanbanContacts = kanbanContacts.concat(boardContacts);
        });
      }

      // Extraer participantes individuales de los grupos seleccionados
      // Construir lista de recipients según el tipo de selección
      let recipients: any[] = [];
      if (contactSelectionType === 'individual') {
        // Contactos individuales seleccionados
        recipients = selectedContacts.map(contactId => {
          const contact = contacts.find(c => c.id === contactId);
          return {
            jid: contact?.phone || contactId,
            phone: contact?.phone || contactId,
            name: contact?.name || contactId.split('@')[0]
          };
        });
      } else if (contactSelectionType === 'manual') {
        // Contactos manuales
        recipients = manualContacts.map(c => ({
          jid: c.phone.includes('@') ? c.phone : `${c.phone}@s.whatsapp.net`,
          phone: c.phone,
          name: c.name
        }));
      } else if (contactSelectionType === 'kanban') {
        // Contactos de tableros Kanban
        recipients = kanbanContacts.map(c => ({
          jid: c.jid || c.phone,
          phone: c.phone || c.jid?.split('@')[0],
          name: c.name || c.jid?.split('@')[0]
        }));
      }

      console.log(`📤 Recipients a enviar: ${recipients.length}`, recipients);

      // Dividir recipients entre las líneas seleccionadas
      const recipientsPerSession: { [sessionId: string]: any[] } = {};
      if (activeSessionIds.length === 1) {
        // Una sola línea, enviar todos
        recipientsPerSession[activeSessionIds[0]] = recipients;
      } else {
        // Múltiples líneas, dividir equitativamente
        const recipientsPerLine = Math.ceil(recipients.length / activeSessionIds.length);
        activeSessionIds.forEach((sid, index) => {
          const start = index * recipientsPerLine;
          const end = start + recipientsPerLine;
          recipientsPerSession[sid] = recipients.slice(start, end);
        });
        console.log(`📊 Dividiendo ${recipients.length} contactos entre ${activeSessionIds.length} líneas (~${recipientsPerLine} por línea)`);
      }

      // Construir objeto de campaña completo
      const campaignData = {
        ...newCampaign,
        mediaUrl,
        mediaType,
        contactSelectionType,
        selectedContacts,
        selectedKanbanBoards,
        recipients: recipientsPerSession,
        sessionIds: activeSessionIds,
        kanbanContacts: kanbanContacts.map(c => ({
          phone: c.jid || c.phone,
          name: c.name || c.jid?.split('@')[0]
        })),
        manualContacts,
        createdAt: new Date().toISOString()
      };

      console.log('📤 Enviando campaña al backend:', campaignData);

      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionIds: activeSessionIds,
          campaign: campaignData
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Campaña creada exitosamente:', result);

        // Si es campaña directa (no programada), iniciarla automáticamente
        if (!campaignData.scheduledAt) {
          try {
            console.log('🚀 Iniciando campaña automáticamente...');
            const startResponse = await fetch(`${getAPIBaseURL()}/api/campaigns/${result.campaignId}/start`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sessionIds: activeSessionIds })
            });

            const startResult = await startResponse.json();

            if (startResult.success) {
              console.log('✅ Campaña iniciada automáticamente');
              // Calcular número de destinatarios basado en el tipo de selección
              let recipientCount = 0;
              if (campaignData.contactSelectionType === 'segments') {
                // Para segmentos, contar contactos en los segmentos seleccionados
                recipientCount = segments
                  .filter(s => campaignData.selectedContacts?.includes(s.id))
                  .reduce((sum, s) => sum + (s.count || 0), 0);
              } else if (campaignData.contactSelectionType === 'individual') {
                recipientCount = campaignData.selectedContacts?.length || 0;
              } else if (campaignData.contactSelectionType === 'manual') {
                recipientCount = campaignData.manualContacts?.length || 0;
              } else if (campaignData.contactSelectionType === 'kanban') {
                recipientCount = campaignData.kanbanContacts?.length || 0;
              }
      
              alert(`🎉 Campaña "${campaignData.name}" creada e iniciada exitosamente!\n\nDestinatarios: ${recipientCount}\nID de campaña: ${result.campaignId}\n\nLos mensajes se están enviando en segundo plano.`);
            } else {
              console.warn('⚠️ Campaña creada pero no pudo iniciarse automáticamente:', startResult);
              alert(`✅ Campaña "${campaignData.name}" creada exitosamente!\n\nID: ${result.campaignId}\n\n⚠️ No se pudo iniciar automáticamente: ${startResult.error}\n\nPuedes iniciarla manualmente desde la lista de campañas.`);
            }
          } catch (startError) {
            console.error('❌ Error iniciando campaña automáticamente:', startError);
            alert(`✅ Campaña "${campaignData.name}" creada exitosamente!\n\nID: ${result.campaignId}\n\n⚠️ Error al iniciar automáticamente. Puedes iniciarla manualmente desde la lista de campañas.`);
          }
        } else {
          // Campaña programada
          alert(`✅ Campaña "${campaignData.name}" programada exitosamente!\n\nID: ${result.campaignId}\nProgramada para: ${new Date(campaignData.scheduledAt).toLocaleString('es-ES')}`);
        }

        // Cerrar diálogo y recargar campañas
        setShowCreateDialog(false);
        loadCampaignsData();

        // Limpiar formulario
        setNewCampaign({
          name: '',
          description: '',
          type: 'broadcast',
          priority: 'medium',
          message: { text: '', hasVariables: false },
          segments: []
        });
        setSelectedContacts([]);
        setSelectedKanbanBoards([]);
        setManualContacts([]);
        setSelectedMedia(null);
        setMediaPreview(null);
        setContactSelectionType('segments');
      } else {
        console.error('❌ Error creando campaña:', result);
        alert(`❌ Error creando campaña: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error enviando campaña:', error);
      alert('❌ Error de conexión al crear la campaña');
    } finally {
      setLoading(false);
    }
  };

  const handleStepNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleStepBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // Función para crear segmento
  const handleCreateSegment = async () => {
    
    try {
      setLoading(true);

      console.log('📝 Creando grupo local:', newSegment);

      const response = await fetch(`${getAPIBaseURL()}/api/segments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          name: newSegment.name,
          description: newSegment.description
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Grupo local creado exitosamente:', result);
        alert(`🎯 Grupo local "${newSegment.name}" creado exitosamente!`);

        // Cerrar diálogo y recargar datos
        setShowCreateSegmentDialog(false);
        loadCampaignsData();

        // Limpiar formulario
        setNewSegment({
          name: '',
          description: '',
          criteria: {
            labels: [],
            lastActivity: 'all-time',
            customFields: {}
          }
        });
      } else {
        console.error('❌ Error creando segmento:', result);
        alert(`❌ Error creando segmento: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error enviando segmento:', error);
      alert('❌ Error de conexión al crear el segmento');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    'Información Básica',
    'Mensaje y Contenido',
    'Segmentación',
    'Programación',
    'Revisión y Envío'
  ];

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Nombre de la Campaña"
              value={newCampaign.name}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb: 2 }}
            />
            {!senderLoading && senderSessions.length === 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No encontramos líneas conectadas. Presiona &quot;Actualizar sesiones&quot; o ve a Configuración &gt; WhatsApp para conectar una línea.
              </Alert>
            )}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="sender-session-label">Línea de envío</InputLabel>
              <Select
                multiple
                labelId="sender-session-label"
                value={senderSessionIds}
                label="Línea de envío"
                onChange={(e) => setSenderSessionIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                renderValue={(selected) => {
                  const selectedNames = selected.map(id => {
                    const session = senderSessions.find(s => s.sessionId === id);
                    return session?.phoneNumber || id;
                  }).join(', ');
                  return `${selected.length} línea(s): ${selectedNames}`;
                }}
              >
                {(senderSessions.length > 0 ? senderSessions : [{ sessionId: sessionId }]).map((s) => (
                  <MenuItem key={s.sessionId} value={s.sessionId}>
                    <Checkbox checked={senderSessionIds.indexOf(s.sessionId) > -1} />
                    <ListItemText primary={s.phoneNumber || s.sessionId} />
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Selecciona una o varias líneas. Los envíos se dividirán equitativamente entre ellas.
              </FormHelperText>
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
            <TextField
              fullWidth
              label="Descripción"
              multiline
              rows={3}
              value={newCampaign.description}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Tipo de Campaña</InputLabel>
                  <Select
                    value={newCampaign.type}
                    label="Tipo de Campaña"
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, type: e.target.value as any }))}
                  >
                    <MenuItem value="broadcast">Difusión Masiva</MenuItem>
                    <MenuItem value="drip">Goteo Automático</MenuItem>
                    <MenuItem value="triggered">Activada por Evento</MenuItem>
                    <MenuItem value="followup">Seguimiento</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Prioridad</InputLabel>
                  <Select
                    value={newCampaign.priority}
                    label="Prioridad"
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, priority: e.target.value as any }))}
                  >
                    <MenuItem value="high">Alta</MenuItem>
                    <MenuItem value="medium">Media</MenuItem>
                    <MenuItem value="low">Baja</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Plantillas Disponibles</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {templates.slice(0, 3).map((template) => (
                <Grid item xs={4} key={template.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}
                    onClick={() => setNewCampaign(prev => ({
                      ...prev,
                      message: { ...prev.message!, text: template.content, hasVariables: template.variables.length > 0 }
                    }))}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {template.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {template.category} • ⭐ {template.rating}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Área de mensaje con botones de funcionalidad */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                {/* Selector de emojis */}
                <Tooltip title="Agregar emoji">
                  <IconButton
                    size="small"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    color={showEmojiPicker ? "primary" : "default"}
                  >
                    <EmojiEmotions />
                  </IconButton>
                </Tooltip>

                {/* Botón para archivo multimedia */}
                <Tooltip title="Adjuntar archivo">
                  <IconButton
                    size="small"
                    component="label"
                  >
                    <AttachFile />
                    <input
                      type="file"
                      hidden
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                      onChange={handleMediaUpload}
                    />
                  </IconButton>
                </Tooltip>

                {/* Botones para insertar variables comunes */}
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
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setNewCampaign(prev => ({
                    ...prev,
                    message: {
                      ...prev.message!,
                      text: (prev.message?.text || '') + '{empresa}'
                    }
                  }))}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {'{empresa}'}
                </Button>
              </Box>

              {/* Selector de emojis expandible */}
              {showEmojiPicker && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Seleccionar Emoji</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {commonEmojis.map((emoji) => (
                      <IconButton
                        key={emoji}
                        size="small"
                        onClick={() => insertEmoji(emoji)}
                        sx={{ fontSize: '1.2rem' }}
                      >
                        {emoji}
                      </IconButton>
                    ))}
                  </Box>
                </Paper>
              )}

              <TextField
                fullWidth
                label="Mensaje de la Campaña"
                multiline
                rows={6}
                value={newCampaign.message?.text}
                onChange={(e) => setNewCampaign(prev => ({
                  ...prev,
                  message: { ...prev.message!, text: e.target.value }
                }))}
                helperText="Usa {variable} para personalizar mensajes. Ej: {nombre}, {empresa}"
              />
            </Box>

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

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="textSecondary">
                💡 Variables detectadas: {newCampaign.message?.text.match(/\{[^}]+\}/g)?.join(', ') || 'Ninguna'}
                {selectedMedia && ` • Archivo: ${selectedMedia.name}`}
              </Typography>
            </Box>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Seleccionar Audiencia</Typography>

            {/* Selector de tipo de audiencia */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <FormLabel component="legend">Tipo de Audiencia</FormLabel>
              <RadioGroup
                value={contactSelectionType}
                onChange={(e) => setContactSelectionType(e.target.value as any)}
              >
                <FormControlLabel
                  value="segments"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DataUsage fontSize="small" />
                      Segmentos Predefinidos
                    </Box>
                  }
                />
                <FormControlLabel
                  value="individual"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonOutline fontSize="small" />
                      Contactos Individuales
                    </Box>
                  }
                />

                <FormControlLabel
                  value="manual"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ContentPaste fontSize="small" />
                      Carga Manual (Copiar/Pegar)
                    </Box>
                  }
                />
                <FormControlLabel
                  value="kanban"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DragIndicator fontSize="small" />
                      Grupos Kanban
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            {/* Contenido basado en el tipo seleccionado */}
            {contactSelectionType === 'segments' && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Selecciona los segmentos de audiencia para tu campaña. Puedes combinar múltiples segmentos.
                </Alert>
                {segments.map((segment) => (
                  <Card key={segment.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            checked={newCampaign.segments?.includes(segment.id) || false}
                            onChange={(e) => {
                              const segments = newCampaign.segments || [];
                              if (e.target.checked) {
                                setNewCampaign(prev => ({
                                  ...prev,
                                  segments: [...segments, segment.id]
                                }));
                              } else {
                                setNewCampaign(prev => ({
                                  ...prev,
                                  segments: segments.filter(id => id !== segment.id)
                                }));
                              }
                            }}
                          />
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {segment.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {segment.description}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={`${segment.count.toLocaleString()} contactos`}
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}

            {contactSelectionType === 'individual' && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Selecciona contactos individuales de tu lista de WhatsApp.
                </Alert>

                {/* Buscador de contactos */}
                <TextField
                  fullWidth
                  placeholder="Buscar contacto por nombre o teléfono..."
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />

                {/* Información de contactos totales */}
                <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="textSecondary">
                    Mostrando {contacts.length} de {totalContacts} contactos
                  </Typography>
                  <Typography variant="body2" color="primary" fontWeight="bold">
                    {selectedContacts.length} seleccionados
                  </Typography>
                </Box>

                {/* Lista de contactos */}
                <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <List>
                    {contacts.map((contact) => (
                      <ListItem key={contact.id} disablePadding>
                        <ListItemButton
                          onClick={() => {
                            const isSelected = selectedContacts.includes(contact.id);
                            if (isSelected) {
                              setSelectedContacts(prev => prev.filter(id => id !== contact.id));
                            } else {
                              setSelectedContacts(prev => [...prev, contact.id]);
                            }
                          }}
                        >
                          <ListItemIcon>
                            <Checkbox
                              edge="start"
                              checked={selectedContacts.includes(contact.id)}
                              tabIndex={-1}
                              disableRipple
                            />
                          </ListItemIcon>
                          <ListItemIcon>
                            <Avatar src={contact.avatar} sx={{ width: 32, height: 32 }}>
                              <PersonOutline />
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={contact.name}
                            secondary={contact.phone}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}

                    {/* Indicador de carga */}
                    {contactsLoading && (
                      <ListItem>
                        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 2 }}>
                          <CircularProgress size={24} />
                        </Box>
                      </ListItem>
                    )}

                    {/* Mensaje cuando no hay contactos */}
                    {!contactsLoading && contacts.length === 0 && (
                      <ListItem>
                        <ListItemText
                          primary="No se encontraron contactos"
                          secondary={contactSearchTerm ? "Intenta con otro término de búsqueda" : "No hay contactos disponibles"}
                          sx={{ textAlign: 'center', py: 3 }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Paper>

                {/* Botón Cargar Más */}
                {contactsHasMore && !contactsLoading && contacts.length > 0 && (
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                    <Button
                      variant="outlined"
                      onClick={loadMoreContacts}
                      startIcon={<Add />}
                    >
                      Cargar más contactos
                    </Button>
                  </Box>
                )}
              </Box>
            )}



            {contactSelectionType === 'manual' && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Puedes pegar una lista de contactos en formato: número,nombre (uno por línea)
                  <br />Ejemplo:
                  <br />+1234567890,Juan Pérez
                  <br />+0987654321,María García
                </Alert>
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  label="Lista de Contactos"
                  placeholder="Ejemplo:
+1234567890,Juan Pérez
+0987654321,María García
+1122334455,Carlos López"
                  value={manualContactText}
                  onChange={(e) => {
                    setManualContactText(e.target.value);
                    parseManualContacts(e.target.value);
                  }}
                  sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    startIcon={<ContentPaste />}
                    onClick={async () => {
    
                      try {
                        const text = await navigator.clipboard.readText();
                        setManualContactText(text);
                        parseManualContacts(text);
                      } catch (err) {
                        console.error('Error al leer del portapapeles:', err);
                      }
                    }}
                  >
                    Pegar del Portapapeles
                  </Button>
                  <Button
                    startIcon={<Clear />}
                    onClick={() => {
                      setManualContactText('');
                      setManualContacts([]);
                    }}
                  >
                    Limpiar
                  </Button>
                </Box>

                {manualContacts.length > 0 && (
                  <Paper sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Contactos Detectados ({manualContacts.length})
                    </Typography>
                    {manualContacts.slice(0, 10).map((contact, index) => (
                      <Box key={index} sx={{ display: 'flex', gap: 2, py: 0.5 }}>
                        <Chip label={contact.phone} size="small" />
                        <Typography variant="body2">{contact.name}</Typography>
                      </Box>
                    ))}
                    {manualContacts.length > 10 && (
                      <Typography variant="caption" color="textSecondary">
                        ... y {manualContacts.length - 10} más
                      </Typography>
                    )}
                  </Paper>
                )}
              </Box>
            )}

            {contactSelectionType === 'kanban' && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Selecciona tableros Kanban para enviar la campaña a todos los contactos en esos grupos.
                </Alert>
                {kanbanBoards.length === 0 ? (
                  <Alert severity="warning">
                    No tienes tableros Kanban configurados. Ve al módulo de Gestión de Contactos Kanban para crear tableros y organizar tus contactos.
                  </Alert>
                ) : (
                  <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List>
                      {kanbanBoards.map((board) => {
                        const contactCount = kanbanBoardContacts[board.id]?.length || 0;
                        return (
                          <ListItem key={board.id} disablePadding>
                            <ListItemButton
                              onClick={() => {
                                const isSelected = selectedKanbanBoards.includes(board.id);
                                if (isSelected) {
                                  setSelectedKanbanBoards(prev => prev.filter(id => id !== board.id));
                                } else {
                                  setSelectedKanbanBoards(prev => [...prev, board.id]);
                                }
                              }}
                            >
                              <ListItemIcon>
                                <Checkbox
                                  edge="start"
                                  checked={selectedKanbanBoards.includes(board.id)}
                                  tabIndex={-1}
                                  disableRipple
                                />
                              </ListItemIcon>
                              <ListItemIcon>
                                <Avatar
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    bgcolor: board.color || '#9c27b0'
                                  }}
                                >
                                  <DragIndicator />
                                </Avatar>
                              </ListItemIcon>
                              <ListItemText
                                primary={board.name}
                                secondary={`${contactCount} contacto${contactCount !== 1 ? 's' : ''} en este tablero`}
                              />
                              <Chip
                                label={contactCount}
                                size="small"
                                sx={{
                                  bgcolor: `${board.color || '#9c27b0'}20`,
                                  color: board.color || '#9c27b0'
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Paper>
                )}
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  {selectedKanbanBoards.length} tablero{selectedKanbanBoards.length !== 1 ? 's' : ''} seleccionado{selectedKanbanBoards.length !== 1 ? 's' : ''} •
                  {' '}{selectedKanbanBoards.reduce((sum, boardId) =>
                    sum + (kanbanBoardContacts[boardId]?.length || 0), 0
                  )} contacto{selectedKanbanBoards.reduce((sum, boardId) =>
                    sum + (kanbanBoardContacts[boardId]?.length || 0), 0) !== 1 ? 's' : ''} total{selectedKanbanBoards.reduce((sum, boardId) =>
                    sum + (kanbanBoardContacts[boardId]?.length || 0), 0) !== 1 ? 'es' : ''}
                </Typography>
              </Box>
            )}

            {/* Resumen de selección */}
            <Box sx={{ mt: 3, p: 2, bgcolor: (theme) => theme.palette.background.paper, borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Resumen de Audiencia</Typography>
              {contactSelectionType === 'segments' && (
                <Typography variant="body2">
                  {newCampaign.segments?.length || 0} segmentos seleccionados •
                  {segments
                    .filter(s => newCampaign.segments?.includes(s.id))
                    .reduce((sum, s) => sum + s.count, 0)
                    .toLocaleString()} contactos estimados
                </Typography>
              )}
              {contactSelectionType === 'individual' && (
                <Typography variant="body2">
                  {selectedContacts.length} contactos individuales seleccionados
                </Typography>
              )}

              {contactSelectionType === 'manual' && (
                <Typography variant="body2">
                  {manualContacts.length} contactos manuales cargados
                </Typography>
              )}
              {contactSelectionType === 'kanban' && (
                <Typography variant="body2">
                  {selectedKanbanBoards.length} tablero{selectedKanbanBoards.length !== 1 ? 's' : ''} Kanban •{' '}
                  {selectedKanbanBoards.reduce((sum, boardId) =>
                    sum + (kanbanBoardContacts[boardId]?.length || 0), 0
                  )} contacto{selectedKanbanBoards.reduce((sum, boardId) =>
                    sum + (kanbanBoardContacts[boardId]?.length || 0), 0) !== 1 ? 's' : ''}
                </Typography>
              )}
            </Box>
          </Box>
        );
      case 3:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Programación del Envío</Typography>
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">¿Cuándo enviar?</FormLabel>
              <RadioGroup defaultValue="now">
                <FormControlLabel value="now" control={<Radio />} label="Enviar ahora" />
                <FormControlLabel value="scheduled" control={<Radio />} label="Programar envío" />
                <FormControlLabel value="optimal" control={<Radio />} label="Hora óptima automática" />
              </RadioGroup>
            </FormControl>
            
            <TextField
              fullWidth
              label="Fecha y Hora de Envío"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Recomendación:</strong> Los mejores horarios para envío son entre 10:00-12:00 y 15:00-17:00.
              </Typography>
            </Alert>
          </Box>
        );
      case 4:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Resumen de la Campaña</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Información General</Typography>
                    <Typography variant="body2"><strong>Nombre:</strong> {newCampaign.name}</Typography>
                    <Typography variant="body2"><strong>Tipo:</strong> {newCampaign.type}</Typography>
                    <Typography variant="body2"><strong>Prioridad:</strong> {newCampaign.priority}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Audiencia</Typography>
                    <Typography variant="body2">
                      <strong>Segmentos:</strong> {newCampaign.segments?.length || 0}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Total estimado:</strong> {
                        segments
                          .filter(s => newCampaign.segments?.includes(s.id))
                          .reduce((sum, s) => sum + s.count, 0)
                          .toLocaleString()
                      } contactos
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Vista Previa del Mensaje</Typography>
                    <Paper sx={{ p: 2, bgcolor: (theme) => theme.palette.background.paper }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {newCampaign.message?.text || 'Sin mensaje'}
                      </Typography>
                    </Paper>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} sx={{ color: '#e91e63' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ 
        mb: 4, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'linear-gradient(135deg, #e91e63 0%, #ad1457 100%)',
        borderRadius: 3,
        p: 3,
        color: 'white'
      }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            📢 Campañas Masivas
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>
            ID Flow • Segmentación Inteligente • Analytics en Tiempo Real
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateCampaign}
          sx={{
            bgcolor: 'rgba(255,255,255,0.2)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
          }}
        >
          Nueva Campaña
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
          <Tab label="Todas las Campañas" />
          <Tab label="📅 Envíos Personalizados" />
          <Tab label="Analytics" />
          <Tab label="Segmentos" />
          <Tab label="Plantillas" />
          <Tab label="Configuración" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {selectedTab === 0 && (
        <Box>
          {/* Filtros y búsqueda */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Buscar campañas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ color: '#64748b', mr: 1 }} />
              }}
              sx={{ minWidth: 300 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={filterStatus}
                label="Estado"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="running">En Ejecución</MenuItem>
                <MenuItem value="scheduled">Programadas</MenuItem>
                <MenuItem value="completed">Completadas</MenuItem>
                <MenuItem value="draft">Borradores</MenuItem>
              </Select>
            </FormControl>
            <Button startIcon={<Refresh />} onClick={loadCampaignsData}>
              Actualizar
            </Button>
          </Box>

          {/* Lista de Campañas */}
          <Grid container spacing={3}>
            {filteredCampaigns.map((campaign) => (
              <Grid item xs={12} md={6} lg={4} key={campaign.id}>
                <Card 
                  elevation={3}
                  sx={{ 
                    height: '100%',
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Header de la tarjeta */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ flex: 1, mr: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                          {campaign.name}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                          {campaign.description}
                        </Typography>
                      </Box>
                      <IconButton size="small">
                        <MoreVert />
                      </IconButton>
                    </Box>

                    {/* Estado y tipo */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip
                        icon={getStatusIcon(campaign.status)}
                        label={campaign.status.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: `${getStatusColor(campaign.status)}20`,
                          color: getStatusColor(campaign.status),
                          fontWeight: 600
                        }}
                      />
                      <Chip
                        label={campaign.type.toUpperCase()}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={campaign.priority.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: `${getPriorityColor(campaign.priority)}20`,
                          color: getPriorityColor(campaign.priority)
                        }}
                      />
                    </Box>

                    {/* Progreso */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          Progreso
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {campaign.targets.sent.toLocaleString()} / {campaign.targets.total.toLocaleString()}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={calculateProgress(campaign)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: '#f0f0f0',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getStatusColor(campaign.status)
                          }
                        }}
                      />
                    </Box>

                    {/* Métricas */}
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#4caf50' }}>
                            {campaign.openRate.toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Apertura
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#2196f3' }}>
                            {campaign.ctr.toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            CTR
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                            {campaign.conversionRate.toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Conversión
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Acciones */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => {
                          setSelectedCampaign(campaign);
                          setShowAnalytics(true);
                        }}
                      >
                        Ver Detalles
                      </Button>

                      {/* Botones de control según estado */}
                      {campaign.status === 'draft' && (
                        <Button
                          size="small"
                          startIcon={<PlayArrow />}
                          sx={{ color: '#4caf50' }}
                          onClick={async () => {
    
                            try {
                              setLoading(true);
                              const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${campaign.id}/start`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId })
                              });
                              const result = await response.json();
                              if (result.success) {
                                alert('✅ Campaña iniciada exitosamente');
                                loadCampaignsData();
                              } else {
                                alert(`❌ Error iniciando campaña: ${result.error}`);
                              }
                            } catch (error) {
                              console.error('Error iniciando campaña:', error);
                              alert('❌ Error de conexión al iniciar campaña');
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          Iniciar
                        </Button>
                      )}

                      {campaign.status === 'running' && (
                        <Button
                          size="small"
                          startIcon={<Pause />}
                          sx={{ color: '#ff9800' }}
                          onClick={async () => {
    
                            try {
                              setLoading(true);
                              const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${campaign.id}/pause`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId })
                              });
                              const result = await response.json();
                              if (result.success) {
                                alert('⏸️ Campaña pausada exitosamente');
                                loadCampaignsData();
                              } else {
                                alert(`❌ Error pausando campaña: ${result.error}`);
                              }
                            } catch (error) {
                              console.error('Error pausando campaña:', error);
                              alert('❌ Error de conexión al pausar campaña');
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          Pausar
                        </Button>
                      )}

                      {campaign.status === 'paused' && (
                        <Button
                          size="small"
                          startIcon={<PlayArrow />}
                          sx={{ color: '#4caf50' }}
                          onClick={async () => {
    
                            try {
                              setLoading(true);
                              const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${campaign.id}/start`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId })
                              });
                              const result = await response.json();
                              if (result.success) {
                                alert('▶️ Campaña reanudada exitosamente');
                                loadCampaignsData();
                              } else {
                                alert(`❌ Error reanudando campaña: ${result.error}`);
                              }
                            } catch (error) {
                              console.error('Error reanudando campaña:', error);
                              alert('❌ Error de conexión al reanudar campaña');
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          Reanudar
                        </Button>
                      )}

                      {/* Botón de eliminar para campañas no activas */}
                      {['draft', 'completed', 'failed'].includes(campaign.status) && (
                        <Button
                          size="small"
                          startIcon={<Delete />}
                          sx={{ color: '#f44336' }}
                          onClick={async () => {
    
                            if (window.confirm(`¿Estás seguro de eliminar la campaña "${campaign.name}"?`)) {
                              try {
                                setLoading(true);
                                const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${campaign.id}?sessionId=${sessionId}`, {
                                  method: 'DELETE'
                                });
                                const result = await response.json();
                                if (result.success) {
                                  alert('🗑️ Campaña eliminada exitosamente');
                                  loadCampaignsData();
                                } else {
                                  alert(`❌ Error eliminando campaña: ${result.error}`);
                                }
                              } catch (error) {
                                console.error('Error eliminando campaña:', error);
                                alert('❌ Error de conexión al eliminar campaña');
                              } finally {
                                setLoading(false);
                              }
                            }
                          }}
                        >
                          Eliminar
                        </Button>
                      )}
                    </Box>

                    {/* Footer con fecha y creador */}
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f0f0f0' }}>
                      <Typography variant="caption" color="textSecondary">
                        Creada por {campaign.creator} • {new Date(campaign.createdAt).toLocaleDateString('es-ES')}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {selectedTab === 1 && (
        <PersonalizedCampaignModule sessionId={sessionId} />
      )}

      {selectedTab === 2 && (
        <Box>
          <Grid container spacing={3}>
            {/* Métricas generales */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#e91e63', mb: 1 }}>
                    {campaigns.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Campañas Totales
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50', mb: 1 }}>
                    {campaigns.filter(c => c.status === 'running').length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    En Ejecución
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3', mb: 1 }}>
                    {campaigns.reduce((sum, c) => sum + c.targets.total, 0).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Mensajes Totales
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800', mb: 1 }}>
                    {(campaigns.reduce((sum, c) => sum + c.openRate, 0) / campaigns.length).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Tasa Apertura Promedio
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {selectedTab === 3 && (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Segmentos de Audiencia
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateSegmentDialog(true)}
            >
              Nuevo Segmento
            </Button>
          </Box>

          <Grid container spacing={3}>
            {segments.map((segment) => (
              <Grid item xs={12} md={6} lg={4} key={segment.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {segment.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {segment.description}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Chip
                        icon={<People />}
                        label={`${segment.count.toLocaleString()} contactos`}
                        color="primary"
                      />
                      <Typography variant="caption" color="textSecondary">
                        {new Date(segment.createdAt).toLocaleDateString('es-ES')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {segment.criteria.labels.map((label) => (
                        <Chip
                          key={label}
                          label={label}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {selectedTab === 4 && (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Plantillas de Mensajes
            </Typography>
            <Button variant="contained" startIcon={<Add />}>
              Nueva Plantilla
            </Button>
          </Box>

          <Grid container spacing={3}>
            {templates.map((template) => (
              <Grid item xs={12} md={6} key={template.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                          {template.name}
                        </Typography>
                        <Chip
                          label={template.category}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="textSecondary">
                          ⭐ {template.rating} • {template.usage} usos
                        </Typography>
                      </Box>
                    </Box>
                    <Paper sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {template.content}
                      </Typography>
                    </Paper>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {template.variables.map((variable) => (
                        <Chip
                          key={variable}
                          label={`{{${variable}}}`}
                          size="small"
                          sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Dialog para crear campaña */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Crear Nueva Campaña
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
                <StepContent>
                  {renderStepContent(index)}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={index === steps.length - 1 ? submitCampaign : handleStepNext}
                      disabled={loading}
                      sx={{ mr: 1 }}
                    >
                      {loading && index === steps.length - 1 ? 'Enviando...' : (index === steps.length - 1 ? 'Crear Campaña' : 'Siguiente')}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={handleStepBack}
                    >
                      Atrás
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
      </Dialog>

      {/* Dialog de Analytics detallados */}
      <Dialog 
        open={showAnalytics} 
        onClose={() => setShowAnalytics(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Analytics de Campaña: {selectedCampaign?.name}
        </DialogTitle>
        <DialogContent>
          {selectedCampaign && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Rendimiento General</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Enviados:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {selectedCampaign.targets.sent.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Entregados:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {selectedCampaign.targets.delivered.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Leídos:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {selectedCampaign.targets.read.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Respuestas:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {selectedCampaign.targets.replied.toLocaleString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Tasas de Conversión</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>Tasa de Apertura</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={selectedCampaign.openRate}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption">
                        {selectedCampaign.openRate.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>CTR</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={selectedCampaign.ctr}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption">
                        {selectedCampaign.ctr.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" gutterBottom>Conversión</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={selectedCampaign.conversionRate}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption">
                        {selectedCampaign.conversionRate.toFixed(1)}%
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalytics(false)}>Cerrar</Button>
          <Button variant="contained" startIcon={<Download />}>
            Exportar Reporte
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para crear segmento */}
      <Dialog open={showCreateSegmentDialog} onClose={() => setShowCreateSegmentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Crear Nuevo Segmento
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Nombre del Segmento"
              value={newSegment.name}
              onChange={(e) => setNewSegment(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Descripción"
              multiline
              rows={3}
              value={newSegment.description}
              onChange={(e) => setNewSegment(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Actividad Reciente</InputLabel>
              <Select
                value={newSegment.criteria?.lastActivity || 'all-time'}
                label="Actividad Reciente"
                onChange={(e) => setNewSegment(prev => ({
                  ...prev,
                  criteria: {
                    ...prev.criteria!,
                    lastActivity: e.target.value
                  }
                }))}
              >
                <MenuItem value="all-time">Todo el tiempo</MenuItem>
                <MenuItem value="30-days">Últimos 30 días</MenuItem>
                <MenuItem value="7-days">Últimos 7 días</MenuItem>
                <MenuItem value="1-day">Último día</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="textSecondary">
              Los contactos se agregarán automáticamente al segmento basado en estos criterios.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateSegmentDialog(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateSegment}
            disabled={loading || !newSegment.name?.trim()}
          >
            {loading ? 'Creando...' : 'Crear Segmento'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CampaignsModule; 