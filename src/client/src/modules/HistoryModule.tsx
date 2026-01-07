import React, { useState, useEffect, useCallback } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useSocket } from '../context/SocketContext';
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
  Checkbox,
  FormControl,
  InputLabel,
  Select,
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
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Pagination,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Fab,
  Snackbar
} from '@mui/material';
import {
  History,
  Search,
  FilterList,
  Download,
  DateRange,
  Message,
  Phone,
  VideoCall,
  Image,
  AttachFile,
  LocationOn,
  Group,
  Person,
  Schedule,
  CheckCircle,
  DoneAll,
  Error as ErrorIcon,
  Warning,
  Info,
  TrendingUp,
  TrendingDown,
  Analytics,
  Refresh,
  ExpandMore,
  Visibility,
  Star,
  StarBorder,
  Archive,
  Delete,
  DeleteForever,
  Share,
  Print,
  SaveAlt,
  CalendarToday,
  AccessTime,
  WhatsApp,
  Send,
  Reply,
  Forward,
  Block,
  Report,
  Timeline,
  Mic,
  MoreVert,
  CallReceived,
  Check,
  PeopleAlt as PeopleIcon,
  InsertEmoticon,
  CampaignOutlined,
  Close,
  Add,
  PhotoCamera,
  Timer
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';


interface HistoryModuleProps {
  sessionId: string;
}

interface MessageHistory {
  id: string;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  isGroup: boolean;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact';
  content: string;
  mediaUrl?: string;
  fileName?: string;
  timestamp: string;
  isFromMe: boolean;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending' | 'received' | 'visto' | 'entregado' | 'enviado';
  agentId?: number;
  agentName?: string;
  campaignId?: string;
  labels: string[];
  priority: 'high' | 'medium' | 'low';
  sentiment?: 'positive' | 'negative' | 'neutral';
  responseTime?: number;
  isStarred: boolean;
  isArchived: boolean;
}

interface ConversationSummary {
  id: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  isGroup: boolean;
  messageCount: number;
  lastMessage: string;
  lastMessageTime: string;
  duration: number;
  status: 'active' | 'resolved' | 'pending' | 'archived';
  agentName?: string;
  labels: string[];
  satisfaction?: number;
  responseTime: number;
  firstResponseTime?: number;
}

interface AnalyticsData {
  totalMessages: number;
  totalConversations: number;
  averageResponseTime: number;
  satisfactionRate: number;
  busyHours: { hour: number; count: number }[];
  topAgents: { name: string; count: number; avgResponseTime: number }[];
  messageTypes: { type: string; count: number; percentage: number }[];
  sentimentAnalysis: { positive: number; neutral: number; negative: number };
  statusCounts: Record<string, number>;
}

interface CampaignRecipient {
  id: number;
  contact_jid: string;
  contact_name?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'visto' | 'entregado' | 'enviado';
  message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_message?: string;
}

interface CampaignHistory {
  id: number;
  name: string;
  message_template: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed';
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  pending_count: number;
  created_at: string;
  updated_at: string;
  use_random_timing: boolean;
  random_timing_msg_count?: number;
  random_timing_time_span_minutes?: number;
  message_media_url?: string;
  message_media_type?: string;
  recipients?: CampaignRecipient[];
}

const HistoryModule: React.FC<HistoryModuleProps> = ({ sessionId }) => {
  const { socket, isConnected, on, off, emit } = useSocket();
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignHistory[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignHistory | null>(null);
  const [showCampaignDetailsDialog, setShowCampaignDetailsDialog] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15); // ⚡ Reducido a 15 líneas por página
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [mediaSubTab, setMediaSubTab] = useState(0); // 0: Imágenes, 1: Videos, 2: Audio, 3: Documentos
  const [viewMode, setViewMode] = useState<'messages' | 'conversations'>('messages');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null); // ⚡ Sin filtro de fecha - Mostrar TODO el historial
  const [dateTo, setDateTo] = useState<Dayjs | null>(null); // ⚡ Sin filtro de fecha - Mostrar TODO el historial
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageHistory | null>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteType, setDeleteType] = useState<'single' | 'chat' | 'multiple' | 'all'>('single');
  const [deleteTarget, setDeleteTarget] = useState<string | string[]>('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const [statuses, setStatuses] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);

  // Estados para crear estados de WhatsApp programados - MODERNIZADO
  const [showCreateStatusDialog, setShowCreateStatusDialog] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusImage, setStatusImage] = useState<File | null>(null);
  const [statusImagePreview, setStatusImagePreview] = useState<string | null>(null);
  const [scheduledStatuses, setScheduledStatuses] = useState<any[]>([]);
  const [statusInterval, setStatusInterval] = useState<number>(60); // Minutos
  const [statusIntervalUnit, setStatusIntervalUnit] = useState<'minutos' | 'horas'>('minutos');
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);

  // Snackbar para notificaciones modernas
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getMessageContent = (msg: any) => {
    // Verificar si hay contenido de mensaje
    if (msg.message || msg.text_content || msg.text) {
      return msg.message || msg.text_content || msg.text;
    }

    // Si no hay contenido de texto, determinar basado en tipo
    const messageType = msg.type || msg.message_type || 'text';

    switch (messageType) {
      case 'image': return msg.caption || '🖼️ Imagen';
      case 'video': return msg.caption || '🎥 Video';
      case 'audio':
      case 'ptt': return '🎵 Audio';
      case 'document': return `📄 ${msg.fileName || msg.file_name || 'Documento'}`;
      case 'sticker': return '😀 Sticker';
      case 'location': return '📍 Ubicación';
      case 'contact': return '👤 Contacto';
      case 'poll': return '📊 Encuesta';
      case 'call': return '📞 Llamada';
      case 'unknown':
        // Para mensajes desconocidos, intentar obtener información de otros campos
        if (msg.mediaUrl) {
          const mediaType = msg.mediaMimeType?.split('/')[0];
          if (mediaType === 'image') return '🖼️ Imagen';
          if (mediaType === 'video') return '🎥 Video';
          if (mediaType === 'audio') return '🎵 Audio';
          return '📎 Archivo multimedia';
        }
        return 'Mensaje sin contenido';
      default:
        if (messageType !== 'text') {
          return `📎 ${messageType}`;
        }
        return 'Mensaje sin contenido';
    }
  };

  const diagnoseSession = useCallback(async (signal?: AbortSignal) => {
    console.log('🔍 Diagnóstico del módulo de historial');
    if (!sessionId) return undefined;

    try {
      const activeSessionId = sessionId;
      const response = await fetch(`${getAPIBaseURL()}/api/session/${activeSessionId}/status`, { signal });
      const data = await response.json();

      if (signal?.aborted) return undefined;

      setDebugInfo({
        sessionId: activeSessionId,
        status: data,
        timestamp: new Date().toISOString()
      });
      return activeSessionId;
    } catch (error) {
      if (signal?.aborted) return undefined;
      console.error('Error en diagnóstico:', error);
      return undefined;
    }
  }, [sessionId]);

  const loadHistoryData = useCallback(async (forceReload = false, signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      // ✅ FIX: Usar sessionId de prop O recuperar de localStorage (para F5)
      let activeSessionId = sessionId;
      if (!activeSessionId || activeSessionId.trim() === '') {
        activeSessionId = localStorage.getItem('whinsap_session') || '';
        if (activeSessionId) {
          console.log('📍 Recuperado sessionId de localStorage:', activeSessionId);
        }
      }

      if (!activeSessionId) {
        if (signal?.aborted) return;
        setLoading(false);
        return;
      }

      const cacheKey = `history_data_${activeSessionId}`;

      // 1. Cargar mensajes y analíticas
      const response = await fetch(`${getAPIBaseURL()}/api/history/messages?sessionId=${activeSessionId}`, { signal });
      const data = await response.json();

      console.log('📦 Respuesta de la API /api/history/messages:', data);
      console.log('📊 Total de mensajes recibidos:', data.messages?.length || 0);

      if (data.success && data.messages && Array.isArray(data.messages)) {
        // Filtrar grupos inmediatamente - SOLO chats individuales
        const apiMessages: MessageHistory[] = data.messages
          .filter((msg: any) => true) // Mostrar todos los mensajes, incluyendo grupos
          .map((msg: any) => {
            const chatJid = msg.chatJid || msg.chat_jid || 'unknown';
            const senderJid = msg.senderJid || msg.sender_jid || chatJid;
            const isFromMe = msg.fromMe || msg.from_me || false;

            // ✅ CORRECCIÓN: Siempre usar la información del CHAT (la contraparte) para el nombre y avatar principal
            // Esto asegura que en mensajes enviados se vea el DESTINATARIO, y en recibidos el REMITENTE (si es 1:1)
            const displayName = msg.chatName || msg.chat_name || chatJid.split('@')[0] || 'Desconocido';

            const displayPhone = chatJid.split('@')[0] || 'unknown';

            // Siempre mostrar el avatar del contacto/chat con el que se habla
            const displayAvatar = msg.contactAvatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${chatJid}`;

            // Determinar el estado del mensaje
            let messageStatus = 'pending';
            if (msg.status) {
              messageStatus = msg.status;
            } else if (msg.ack !== undefined) {
              // Mapear ack de Baileys a nuestros estados
              if (msg.ack === 0 || msg.ack === 1) messageStatus = 'pending';
              else if (msg.ack === 2) messageStatus = 'sent';
              else if (msg.ack === 3) messageStatus = 'delivered';
              else if (msg.ack === 4 || msg.ack === 5) messageStatus = 'read';
            } else if (isFromMe) {
              messageStatus = 'sent'; // Default para mensajes enviados
            } else {
              messageStatus = 'received'; // Para mensajes recibidos
            }

            const isGroup = chatJid.includes('@g.us'); // 🆕 Detectar si es grupo
            return {
              id: msg.id || `msg_${Date.now()}`,
              conversationId: chatJid,
              contactName: displayName,
              contactPhone: displayPhone,
              contactAvatar: displayAvatar,
              isGroup: isGroup,
              messageType: msg.type || msg.message_type || 'text',
              content: getMessageContent(msg),
              mediaUrl: msg.mediaUrl || msg.media_url || null,
              fileName: msg.fileName || msg.file_name || null,
              timestamp: msg.timestamp || new Date().toISOString(),
              isFromMe: isFromMe,
              status: messageStatus,
              agentId: msg.agentId || msg.agent_id,
              agentName: msg.agentName || msg.agent_name || (isFromMe ? (msg.agentId || msg.agent_id ? 'Gestión' : 'Sistema') : '-'),
              labels: [],
              priority: 'medium',
              sentiment: 'neutral',
              isStarred: false,
              isArchived: false
            };
          });

        // Crear conversaciones agrupadas por chat (ya sin grupos)
        const conversationMap = new Map<string, ConversationSummary>();

        apiMessages.forEach((msg) => {
          const convId = msg.conversationId || 'unknown';

          if (!conversationMap.has(convId)) {
            conversationMap.set(convId, {
              id: convId,
              contactName: msg.contactName || 'Desconocido',
              contactPhone: msg.contactPhone || 'unknown',
              contactAvatar: `${getAPIBaseURL()}/api/avatar/${sessionId}/${convId}`,
              isGroup: convId.includes('@g.us'), // 🆕 Detectar si es grupo
              messageCount: 0,
              lastMessage: msg.content || 'Sin mensaje',
              lastMessageTime: msg.timestamp || new Date().toISOString(),
              duration: 0,
              status: 'active',
              agentName: msg.agentName || (msg.agentId ? 'Agente' : 'Sistema'),
              labels: [],
              responseTime: 0
            });
          }

          const conv = conversationMap.get(convId)!;
          conv.messageCount++;
          if (new Date(msg.timestamp || 0) > new Date(conv.lastMessageTime || 0)) {
            conv.lastMessage = msg.content || 'Sin mensaje';
            conv.lastMessageTime = msg.timestamp || new Date().toISOString();
            if (msg.agentName) {
              conv.agentName = msg.agentName;
            }
          }
        });

        const apiConversations = Array.from(conversationMap.values());

        const totalMessages = apiMessages.length;
        const totalConversations = apiConversations.length;

        let totalResponseTime = 0;
        let responseCount = 0;

        const statusCounts = apiMessages.reduce((acc, msg) => {
          acc[msg.status] = (acc[msg.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const messageTypes = apiMessages.reduce((acc, msg) => {
          acc[msg.messageType] = (acc[msg.messageType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const hourCounts = apiMessages.reduce((acc, msg) => {
          const hour = new Date(msg.timestamp).getHours();
          acc[hour] = (acc[hour] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        const busyHours = Object.entries(hourCounts)
          .map(([hour, count]) => ({ hour: parseInt(hour), count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        let positiveCount = 0;
        let negativeCount = 0;
        let neutralCount = 0;

        apiMessages.forEach(msg => {
          const content = msg.content.toLowerCase();
          if (content.includes('gracias') || content.includes('excelente') || content.includes('bien') || content.includes('perfecto')) {
            positiveCount++;
          } else if (content.includes('mal') || content.includes('error') || content.includes('problema') || content.includes('no funciona')) {
            negativeCount++;
          } else {
            neutralCount++;
          }
        });

        const totalSentiment = positiveCount + negativeCount + neutralCount;
        const sentimentAnalysis = {
          positive: totalSentiment > 0 ? Math.round((positiveCount / totalSentiment) * 10) : 0,
          neutral: totalSentiment > 0 ? Math.round((neutralCount / totalSentiment) * 100) : 0,
          negative: totalSentiment > 0 ? Math.round((negativeCount / totalSentiment) * 100) : 0
        };

        const satisfactionRate = totalSentiment > 0 ? (positiveCount / totalSentiment) * 5 : 4.5;

        const apiAnalytics: AnalyticsData = {
          totalMessages,
          totalConversations,
          averageResponseTime: totalResponseTime > 0 ? Math.round(totalResponseTime / responseCount) : 120,
          satisfactionRate: Math.round(satisfactionRate * 10) / 10,
          busyHours,
          topAgents: [{ name: 'Sistema', count: totalMessages, avgResponseTime: 120 }],
          messageTypes: Object.entries(messageTypes).map(([type, count]) => ({
            type,
            count,
            percentage: Math.round((count / totalMessages) * 100 * 10) / 10
          })),
          sentimentAnalysis,
          statusCounts
        };

        console.log('✅ Procesados:', apiMessages.length, 'mensajes y', apiConversations.length, 'conversaciones');
        console.log('🔍 Primeros 3 mensajes:', apiMessages.slice(0, 3));

        // Si hay mensajes para mostrar o si se debe forzar la carga
        setMessages(apiMessages);
        setConversations(apiConversations);
        setAnalytics(apiAnalytics);

        try {
          const cacheData = {
            messages: apiMessages,
            conversations: apiConversations,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          // Ya no guardamos contactsMap en caché (no lo necesitamos)
          console.log('💾 Datos guardados en caché con sessionId:', sessionId);
        } catch (cacheError) {
          console.warn('Error guardando caché:', cacheError);
        }
      } else {
        console.error('❌ API no devolvió datos válidos:', data);
        setError('Error al cargar el historial de mensajes');
        setMessages([]);
        setConversations([]);
        setAnalytics(null);
      }
    } catch (error) {
      console.error('❌ Error cargando historial:', error);
      setError(`Error de conexión al cargar el historial: ${error}`);
      setMessages([]);
      setConversations([]);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const controller = new AbortController();

    if (sessionId) {
      loadHistoryData(false, controller.signal);
    } else {
      diagnoseSession(controller.signal);
    }

    return () => controller.abort();
  }, [loadHistoryData, sessionId, diagnoseSession]);

  const loadGroups = async (activeSessionId?: string) => {
    try {
      const currentSessionId = activeSessionId || sessionId;
      const response = await fetch(`${getAPIBaseURL()}/api/groups/${currentSessionId}`);
      const data = await response.json();
      if (data.success && data.groups && Array.isArray(data.groups)) {
        setGroups(data.groups);
      } else {
        setGroups([]);
      }
    } catch (error) {
      setGroups([]);
    }
  };

  // 📡 Socket.IO: Escuchar actualizaciones de estado en tiempo real
  useEffect(() => {
    if (!socket || !isConnected || !sessionId) return;

    console.log('🔌 [HistoryModule] Configurando listeners Socket.IO');

    // Unirse a la sala de la sesión
    emit('join-session', { sessionId });

    // Escuchar actualizaciones de estado de mensajes
    const handleMessageStatusUpdate = (data: any) => {
      console.log('📬 [HistoryModule] message-status-update recibido:', data);

      // Actualizar el estado del mensaje en la lista con protección de degradación
      setMessages(prev => prev.map(msg => {
        if (msg.id === data.messageId || msg.id === data.id) {
          // Jerarquía: read > delivered > sent > pending
          const statusOrder: Record<string, number> = { 'read': 4, 'visto': 4, 'delivered': 3, 'entregado': 3, 'sent': 2, 'enviado': 2, 'pending': 1, 'received': 0 };
          const currentOrder = statusOrder[msg.status] || 0;
          const newOrder = statusOrder[data.status] || 0;

          if (newOrder > currentOrder) {
            console.log(`[HistoryModule] 📈 Actualizando status ${msg.id}: ${msg.status} -> ${data.status}`);
            return { ...msg, status: data.status };
          }
          return msg;
        }
        return msg;
      }));

      const cacheKey = `history_${sessionId}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed && Array.isArray(parsed.messages)) {
            const updatedMessages = parsed.messages.map((msg: any) =>
              msg.id === data.messageId || msg.id === data.id
                ? { ...msg, status: data.status }
                : msg
            );
            const updatedCache = {
              ...parsed,
              messages: updatedMessages,
              timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
          }
        } catch { }
      }
    };

    on('message-status-update', handleMessageStatusUpdate);

    return () => {
      off('message-status-update');
      if (sessionId) {
        emit('leave-session', { sessionId });
      }
    };
  }, [socket, isConnected, sessionId, on, off, emit]);

  const loadCampaigns = useCallback(async () => {
    try {
      console.log('📢 Cargando historial de campañas...');
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${sessionId}`);
      const data = await response.json();

      console.log('📊 Respuesta de API /api/campaigns:', data);

      if (data.success && data.data && data.data.campaigns && Array.isArray(data.data.campaigns)) {
        const campaignsData: CampaignHistory[] = data.data.campaigns.map((campaign: any) => ({
          id: campaign.id,
          name: campaign.name || 'Sin nombre',
          message_template: campaign.message_template || '',
          status: campaign.status || 'pending',
          total_recipients: campaign.total_recipients || 0,
          sent_count: campaign.sent_count || 0,
          delivered_count: campaign.delivered_count || 0,
          read_count: campaign.read_count || 0,
          failed_count: campaign.failed_count || 0,
          pending_count: campaign.pending_count || 0,
          created_at: campaign.created_at || new Date().toISOString(),
          updated_at: campaign.updated_at || new Date().toISOString(),
          use_random_timing: campaign.use_random_timing || false,
          random_timing_msg_count: campaign.random_timing_msg_count,
          random_timing_time_span_minutes: campaign.random_timing_time_span_minutes,
          message_media_url: campaign.message_media_url,
          message_media_type: campaign.message_media_type
        }));

        console.log('✅ Campañas cargadas:', campaignsData.length);
        setCampaigns(campaignsData);
      } else {
        console.log('⚠️ No se encontraron campañas');
        setCampaigns([]);
      }
    } catch (error) {
      console.error('❌ Error cargando campañas:', error);
      setCampaigns([]);
    }
  }, [sessionId]);

  const loadStatuses = useCallback(async (activeSessionId?: string) => {
    try {
      const currentSessionId = activeSessionId || sessionId;
      const response = await fetch(`${getAPIBaseURL()}/api/statuses/${currentSessionId}`);
      const data = await response.json();
      if (data.success) {
        setStatuses(data.statuses || []);
        setStatusHistory(data.history || []);
        console.log(`✅ ${data.statuses?.length || 0} estados pendientes, ${data.history?.length || 0} en historial`);
      } else {
        setStatuses([]);
        setStatusHistory([]);
      }
    } catch (error) {
      console.error('Error cargando estados:', error);
      setStatuses([]);
      setStatusHistory([]);
    }
  }, [sessionId]);

  useEffect(() => {
    const controller = new AbortController();
    if (sessionId) {
      diagnoseSession(controller.signal).then((activeSessionId) => {
        if (controller.signal.aborted) return;
        const currentSessionId = activeSessionId || sessionId;
        loadStatuses(currentSessionId);
        loadCampaigns();
      });
    }
    return () => controller.abort();
  }, [sessionId, diagnoseSession, loadCampaigns, loadStatuses]);

  const handleRefreshData = async () => {
    // Obtener el sessionId activo primero
    const activeSessionId = await diagnoseSession();

    // Usar el sessionId activo para limpiar caché
    const currentSessionId = activeSessionId || sessionId;
    const cacheKey = `history_${currentSessionId}`;
    const contactsCacheKey = `contacts_${currentSessionId}`;

    localStorage.removeItem(cacheKey);
    localStorage.removeItem(contactsCacheKey);

    loadHistoryData();
    loadGroups(currentSessionId);
    loadStatuses(currentSessionId);
  };

  const handleShowMembers = (group: any) => {
    setSelectedGroup(group);
    setShowMembersDialog(true);
  };





  // Manejar selección de imagen para estado
  const handleStatusImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setStatusImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setStatusImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Agregar estado a la lista de programados
  const handleAddScheduledStatus = () => {
    if (!statusText && !statusImage) {
      showSnackbar('Debes agregar texto o imagen para el estado', 'warning');
      return;
    }

    if (editingStatusId) {
      handleUpdateScheduledStatus();
      return;
    }

    const newStatus = {
      id: Date.now(),
      text: statusText,
      image: statusImagePreview,
      imageFile: statusImage,
      createdAt: new Date().toISOString()
    };

    setScheduledStatuses([...scheduledStatuses, newStatus]);
    setStatusText('');
    setStatusImage(null);
    setStatusImagePreview(null);
    showSnackbar(`Estado ${scheduledStatuses.length + 1} agregado a la cola ✅`, 'success');
  };

  // Editar estado existente
  const handleEditScheduledStatus = (id: number) => {
    const status = scheduledStatuses.find(s => s.id === id);
    if (status) {
      setStatusText(status.text);
      setStatusImagePreview(status.image);
      setStatusImage(status.imageFile);
      setEditingStatusId(id);
      showSnackbar('Editando estado. Haz cambios y presiona "Actualizar"', 'info');
    }
  };

  // Actualizar estado editado
  const handleUpdateScheduledStatus = () => {
    if (editingStatusId === null) return;

    setScheduledStatuses(scheduledStatuses.map(s =>
      s.id === editingStatusId
        ? { ...s, text: statusText, image: statusImagePreview, imageFile: statusImage }
        : s
    ));

    setStatusText('');
    setStatusImage(null);
    setStatusImagePreview(null);
    setEditingStatusId(null);
    showSnackbar('Estado actualizado correctamente ✅', 'success');
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setStatusText('');
    setStatusImage(null);
    setStatusImagePreview(null);
    setEditingStatusId(null);
    showSnackbar('Edición cancelada', 'info');
  };

  // Eliminar estado de la lista
  const handleRemoveScheduledStatus = (id: number) => {
    setScheduledStatuses(scheduledStatuses.filter(s => s.id !== id));
    showSnackbar('Estado eliminado de la cola 🗑️', 'info');
  };

  // Publicar estados ahora o programados
  const handlePublishStatuses = async () => {
    if (scheduledStatuses.length === 0) {
      showSnackbar('No hay estados para publicar', 'warning');
      return;
    }

    try {
      setLoading(true);
      showSnackbar('Creando estados en el servidor...', 'info');

      // Calcular intervalo en minutos
      const intervalMinutes = statusIntervalUnit === 'horas'
        ? statusInterval * 60
        : statusInterval;

      // Paso 1: Crear cada estado en el servidor
      const createdStatusIds: number[] = [];

      for (let i = 0; i < scheduledStatuses.length; i++) {
        const status = scheduledStatuses[i];
        const formData = new FormData();
        formData.append('sessionId', sessionId);

        if (status.text) {
          formData.append('textContent', status.text);
        }

        if (status.imageFile) {
          formData.append('mediaFile', status.imageFile);
        }

        formData.append('backgroundColor', '#075E54');
        formData.append('fontStyle', 'default');

        const response = await fetch(`${getAPIBaseURL()}/api/statuses/create`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error creando estado ${i + 1}`);
        }

        const data = await response.json();
        if (data.success && data.statusId) {
          createdStatusIds.push(data.statusId);
          showSnackbar(`Estado ${i + 1}/${scheduledStatuses.length} creado ✓`, 'info');
        } else {
          throw new Error(`Error creando estado ${i + 1}`);
        }
      }

      // Paso 2: Crear programación con los estados creados
      showSnackbar('Creando programación automática...', 'info');

      const scheduleResponse = await fetch(`${getAPIBaseURL()}/api/statuses/schedule/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: `Programación ${new Date().toLocaleDateString()}`,
          statusIds: createdStatusIds,
          intervalMinutes,
          rotationDays: 30
        })
      });

      if (!scheduleResponse.ok) {
        const errorData = await scheduleResponse.json();
        throw new Error(errorData.error || 'Error creando programación');
      }

      const scheduleData = await scheduleResponse.json();

      if (scheduleData.success) {
        showSnackbar(
          `✅ ${createdStatusIds.length} estados programados!\n` +
          `⏰ Se publicarán cada ${statusInterval} ${statusIntervalUnit}\n` +
          `🔄 Rotación de 30 días activada`,
          'success'
        );

        // Limpiar estados locales
        setScheduledStatuses([]);
        setShowCreateStatusDialog(false);

        // Recargar estados desde el servidor
        loadStatuses();
      } else {
        throw new Error(scheduleData.error || 'Error en la programación');
      }
    } catch (error: any) {
      console.error('Error publicando estados:', error);
      showSnackbar(`❌ Error: ${error.message || 'Error al publicar estados'}`, 'error');
    } finally {
      setLoading(false);
    }
  };




  const loadCampaignDetails = async (campaignId: number) => {
    try {
      console.log(`📢 Cargando detalles de campaña ${campaignId}...`);
      const response = await fetch(`${getAPIBaseURL()}/api/campaigns/${sessionId}/${campaignId}`);
      const data = await response.json();

      if (data.success && data.data) {
        const campaign = data.data;
        const campaignWithRecipients: CampaignHistory = {
          ...campaign,
          recipients: campaign.recipients || []
        };

        setSelectedCampaign(campaignWithRecipients);
        setShowCampaignDetailsDialog(true);
        console.log('✅ Detalles de campaña cargados:', campaignWithRecipients);
      }
    } catch (error) {
      console.error('❌ Error cargando detalles de campaña:', error);
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Message sx={{ fontSize: 16 }} />;
      case 'image': return <Image sx={{ fontSize: 16 }} />;
      case 'audio':
      case 'ptt': return <Mic sx={{ fontSize: 16 }} />;
      case 'video': return <VideoCall sx={{ fontSize: 16 }} />;
      case 'document': return <AttachFile sx={{ fontSize: 16 }} />;
      case 'location': return <LocationOn sx={{ fontSize: 16 }} />;
      case 'contact': return <Person sx={{ fontSize: 16 }} />;
      case 'sticker': return <InsertEmoticon sx={{ fontSize: 16 }} />;
      default: return <Message sx={{ fontSize: 16 }} />;
    }
  };

  const getMessageTypeLabel = (type: string, fileName?: string | null) => {
    switch (type) {
      case 'text': return 'Texto';
      case 'image': return '🖼️ Imagen';
      case 'audio': return '🎵 Audio';
      case 'ptt': return '🎤 Nota de voz';
      case 'video': return '🎥 Video';
      case 'document': return fileName ? `📄 ${fileName}` : '📄 Documento';
      case 'location': return '📍 Ubicación';
      case 'contact': return '👤 Contacto';
      case 'sticker': return '😀 Sticker';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getStatusTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Message sx={{ fontSize: 12, color: 'white' }} />;
      case 'image': return <Image sx={{ fontSize: 12, color: 'white' }} />;
      case 'video': return <VideoCall sx={{ fontSize: 12, color: 'white' }} />;
      case 'audio': return <Mic sx={{ fontSize: 12, color: 'white' }} />;
      default: return <Message sx={{ fontSize: 12, color: 'white' }} />;
    }
  };

  const getStatusTypeColor = (type: string) => {
    switch (type) {
      case 'text': return '#2196f3';
      case 'image': return '#4caf50';
      case 'video': return '#ff5722';
      case 'audio': return '#9c27b0';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle sx={{ fontSize: 14, color: '#ff9800' }} />;
      case 'delivered': return <DoneAll sx={{ fontSize: 14, color: '#4caf50' }} />;
      case 'read': return <DoneAll sx={{ fontSize: 14, color: '#2196f3' }} />;
      case 'failed': return <ErrorIcon sx={{ fontSize: 14, color: '#f44336' }} />;
      default: return undefined;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'read': return 'Visto';
      case 'failed': return 'Fallido';
      default: return status;
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return '#4caf50';
      case 'negative': return '#f44336';
      case 'neutral': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  // ============ FUNCIONES DE FILTRADO MEJORADAS ============

  // Filtrar solo mensajes de chat (sin grupos)
  const getChatOnlyMessages = () => {
    // Filtrar solo mensajes de chat (excluir grupos Y estados de WhatsApp)
    return filteredMessages.filter(m => {
      const isNotGroup = !m.isGroup;
      const isNotStatus = !m.contactPhone.includes('status') && !m.conversationId.includes('status@broadcast');
      return isNotGroup && isNotStatus;
    });
  };

  // Filtrar solo estados (por ahora retorna vacío ya que no hay campo específico)
  const getStatusMessages = () => {
    return []; // Los estados no están en messages por ahora
  };

  // Filtrar multimedia por tipo
  const getMediaMessages = (type: 'image' | 'video' | 'audio' | 'document') => {
    return filteredMessages.filter(m => m.messageType === type);
  };

  // Filtrar mensajes de grupos
  const getGroupMessages = () => {
    return filteredMessages.filter(m => m.isGroup);
  };

  // Obtener conteo por tipo de mensaje
  const getMessageCountByType = () => {
    const counts = {
      text: 0,
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      other: 0
    };

    filteredMessages.forEach(m => {
      if (counts.hasOwnProperty(m.messageType)) {
        counts[m.messageType as keyof typeof counts]++;
      } else {
        counts.other++;
      }
    });

    return counts;
  };

  const filteredMessages = messages.filter(message => {
    const content = message.content || '';
    const contactName = message.contactName || '';
    const contactPhone = message.contactPhone || '';

    const matchesSearch = content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contactPhone.includes(searchTerm);
    const matchesType = selectedType === 'all' || message.messageType === selectedType;
    const matchesStatus = selectedStatus === 'all' || message.status === selectedStatus;
    const matchesAgent = selectedAgent === 'all' || message.agentName === selectedAgent;
    const matchesDirection = selectedDirection === 'all' ||
      (selectedDirection === 'sent' && message.isFromMe) ||
      (selectedDirection === 'received' && !message.isFromMe);
    const withinDateRange = (!dateFrom || dayjs(message.timestamp).isAfter(dateFrom)) &&
      (!dateTo || dayjs(message.timestamp).isBefore(dateTo.add(1, 'day')));

    return matchesSearch && matchesType && matchesStatus && matchesAgent && matchesDirection && withinDateRange;
  });

  const filteredConversations = conversations.filter(conversation => {
    const contactName = conversation.contactName || '';
    const contactPhone = conversation.contactPhone || '';

    const matchesSearch = contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contactPhone.includes(searchTerm);
    const matchesAgent = selectedAgent === 'all' || conversation.agentName === selectedAgent;
    const withinDateRange = (!dateFrom || dayjs(conversation.lastMessageTime).isAfter(dateFrom)) &&
      (!dateTo || dayjs(conversation.lastMessageTime).isBefore(dateTo.add(1, 'day')));

    return matchesSearch && matchesAgent && withinDateRange;
  });

  const getFilteredByTab = (items: any[], isGroup?: boolean) => {
    if (isGroup === undefined) return items; // Para la pestaña de estados
    return items.filter(item => item.isGroup === isGroup);
  };

  const getCurrentTabMessages = () => {
    console.log(`🔍 selectedTab: ${selectedTab}, Total messages: ${messages.length}, Filtered messages: ${filteredMessages.length}`);

    let result: MessageHistory[] = [];

    switch (selectedTab) {
      case 0: // 💬 Chat - Mensajes enviados y recibidos
        result = getChatOnlyMessages();
        console.log(`📊 Tab 0 (Chat): ${result.length} mensajes`);
        break;

      case 1: // 📊 Estados WhatsApp - Estados de mensajes (✓✓ leído, ✓ entregado, etc.)
        // Retorna todos los mensajes para ver sus estados
        result = getChatOnlyMessages();
        console.log(`📊 Tab 1 (Estados WhatsApp): ${result.length} mensajes con estado`);
        break;

      case 2: // 📎 Multimedia - Archivos por tipo
        if (mediaSubTab === 0) result = getMediaMessages('image');
        else if (mediaSubTab === 1) result = getMediaMessages('video');
        else if (mediaSubTab === 2) result = getMediaMessages('audio');
        else result = getMediaMessages('document');
        console.log(`📊 Tab 2 (Multimedia): ${result.length} archivos`);
        break;

      case 3: // 👥 Grupos - Mensajes de grupos
        result = getGroupMessages();
        console.log(`📊 Tab 3 (Grupos): ${result.length} mensajes de grupos`);
        break;

      case 4: // 📢 Campañas - Historial de campañas (se maneja diferente, retorna vacío)
        result = [];
        console.log(`📊 Tab 4 (Campañas): Se muestra historial de campañas`);
        break;

      case 5: // 📊 Analytics - Análisis de estados de envío
        result = getChatOnlyMessages(); // Todos los mensajes para analizar
        console.log(`📊 Tab 5 (Analytics): ${result.length} mensajes para análisis`);
        break;

      default:
        result = filteredMessages;
        console.log(`📊 Tab default: ${result.length} mensajes`);
    }

    return result;
  };

  const getCurrentTabConversations = () => {
    switch (selectedTab) {
      case 0: // Chats individuales
        return getFilteredByTab(filteredConversations, false);
      case 1: // Grupos
        return getFilteredByTab(filteredConversations, true);
      case 2: // Estados - por ahora vacío
        return [];
      default:
        return filteredConversations;
    }
  };



  const exportToPDF = async (data: any[]) => {
    try {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Encabezado
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Historial de Mensajes - Whinsap', pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha de exportación: ${new Date().toLocaleString('es-ES')}`, pageWidth / 2, 22, { align: 'center' });
      doc.text(`Total de registros: ${data.length}`, pageWidth / 2, 28, { align: 'center' });

      if (viewMode === 'messages') {
        // Exportar mensajes
        const tableData = data.map((msg: any) => [
          msg.timestamp ? new Date(msg.timestamp).toLocaleString('es-ES') : '-',
          msg.contactName || msg.pushName || msg.from?.split('@')[0] || 'Desconocido',
          (msg.body || msg.text || msg.message || '(Sin texto)').substring(0, 60),
          msg.fromMe ? 'Enviado' : 'Recibido',
          msg.type || msg.messageType || 'chat'
        ]);

        (doc as any).autoTable({
          startY: 35,
          head: [['Fecha/Hora', 'Contacto', 'Mensaje', 'Dirección', 'Tipo']],
          body: tableData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [76, 175, 80], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { top: 35, left: 10, right: 10 }
        });
      } else {
        // Exportar conversaciones
        const tableData = data.map((conv: any) => [
          conv.name || conv.pushName || conv.phoneNumber || 'Desconocido',
          (conv.lastMessage || conv.last_message || '(Sin mensajes)').substring(0, 40),
          conv.timestamp ? new Date(conv.timestamp).toLocaleString('es-ES') : '-',
          conv.unreadCount || conv.unread_count || 0,
          conv.messageCount || conv.message_count || 0
        ]);

        (doc as any).autoTable({
          startY: 35,
          head: [['Contacto', 'Último Mensaje', 'Fecha', 'No Leídos', 'Total Msgs']],
          body: tableData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [33, 150, 243], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { top: 35, left: 10, right: 10 }
        });
      }

      // Pie de página
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`historial_whinsap_${new Date().toISOString().split('T')[0]}.pdf`);
      console.log('✅ PDF generado exitosamente');
      showSnackbar('✅ PDF descargado exitosamente', 'success');
    } catch (error) {
      console.error('Error generando PDF:', error);
      showSnackbar(`❌ Error al generar el PDF: ${error}`, 'error');
    }
  };

  const exportToExcel = async (data: any[]) => {
    try {
      const XLSX = await import('xlsx');

      let worksheetData: any[];

      if (viewMode === 'messages') {
        worksheetData = data.map((msg: any) => ({
          'Fecha/Hora': msg.timestamp ? new Date(msg.timestamp).toLocaleString('es-ES') : '-',
          'Contacto': msg.contactName || msg.pushName || msg.from?.split('@')[0] || 'Desconocido',
          'Número': msg.from?.split('@')[0] || msg.phoneNumber || '',
          'Mensaje': msg.body || msg.text || msg.message || '(Sin texto)',
          'Tipo': msg.fromMe || msg.isFromMe ? 'Enviado' : 'Recibido',
          'Estado': msg.fromMe || msg.isFromMe ?
            (msg.status === 'read' ? 'Visto' :
              msg.status === 'delivered' ? 'Entregado' :
                msg.status === 'sent' ? 'Enviado' :
                  msg.ack === 3 ? 'Visto' :
                    msg.ack === 2 ? 'Entregado' :
                      msg.ack === 1 ? 'Enviado' : 'Pendiente') : '-'
        }));
      } else {
        worksheetData = data.map((conv: any) => ({
          'Contacto': conv.name || conv.pushName || conv.phoneNumber || 'Desconocido',
          'Número': conv.phoneNumber || conv.id?.split('@')[0] || '',
          'Último Mensaje': conv.lastMessage || conv.last_message || '(Sin mensajes)',
          'Fecha': conv.timestamp ? new Date(conv.timestamp).toLocaleString('es-ES') : '-',
          'No Leídos': conv.unreadCount || conv.unread_count || 0,
          'Total Mensajes': conv.messageCount || conv.message_count || 0,
          'Tipo': conv.isGroup ? 'Grupo' : 'Individual'
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // Ajustar ancho de columnas
      const colWidths = Object.keys(worksheetData[0] || {}).map(() => ({ wch: 20 }));
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');

      // Agregar hoja de información
      const infoData = [
        { Campo: 'Fecha de Exportación', Valor: new Date().toLocaleString('es-ES') },
        { Campo: 'Total de Registros', Valor: data.length },
        { Campo: 'Tipo de Vista', Valor: viewMode === 'messages' ? 'Mensajes' : 'Conversaciones' },
        { Campo: 'Filtros Aplicados', Valor: searchTerm || 'Ninguno' }
      ];
      const infoSheet = XLSX.utils.json_to_sheet(infoData);
      XLSX.utils.book_append_sheet(workbook, infoSheet, 'Información');

      XLSX.writeFile(workbook, `historial_whinsap_${new Date().toISOString().split('T')[0]}.xlsx`);
      console.log('✅ Excel generado exitosamente');
      showSnackbar('✅ Excel descargado exitosamente', 'success');
    } catch (error) {
      console.error('Error generando Excel:', error);
      showSnackbar(`❌ Error al generar el Excel: ${error}`, 'error');
    }
  };

  const handlePrint = (data: any[]) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showSnackbar('⚠️ Por favor permite ventanas emergentes para imprimir', 'warning');
        return;
      }

      let tableHTML = '';

      if (viewMode === 'messages') {
        tableHTML = `
          <table>
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Contacto</th>
                <th>Mensaje</th>
                <th>Tipo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((msg: any) => `
                <tr>
                  <td>${msg.timestamp ? new Date(msg.timestamp).toLocaleString('es-ES') : '-'}</td>
                  <td>${msg.contactName || msg.pushName || msg.from?.split('@')[0] || 'Desconocido'}</td>
                  <td>${((msg.body || msg.text || msg.message || '(Sin texto)').substring(0, 80))}</td>
                  <td>${msg.fromMe || msg.isFromMe ? 'Enviado' : 'Recibido'}</td>
                  <td>${msg.fromMe || msg.isFromMe ?
            (msg.status === 'read' ? 'Visto' :
              msg.status === 'delivered' ? 'Entregado' :
                msg.status === 'sent' ? 'Enviado' : 'Pendiente') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else {
        tableHTML = `
          <table>
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Último Mensaje</th>
                <th>Fecha</th>
                <th>No Leídos</th>
                <th>Total Mensajes</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((conv: any) => `
                <tr>
                  <td>${conv.name || conv.pushName || conv.phoneNumber || 'Desconocido'}</td>
                  <td>${((conv.lastMessage || conv.last_message || '(Sin mensajes)').substring(0, 60))}</td>
                  <td>${conv.timestamp ? new Date(conv.timestamp).toLocaleString('es-ES') : '-'}</td>
                  <td>${conv.unreadCount || conv.unread_count || 0}</td>
                  <td>${conv.messageCount || conv.message_count || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historial Whinsap - ${new Date().toLocaleDateString('es-ES')}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          h1 {
            color: #4CAF50;
            text-align: center;
            margin-bottom: 10px;
          }
          .info {
            text-align: center;
            color: #666;
            margin-bottom: 20px;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 11px;
          }
          th {
            background-color: #4CAF50;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #ddd;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          tr:hover {
            background-color: #f5f5f5;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <h1>📱 Historial de Mensajes - Whinsap</h1>
        <div class="info">
          <p><strong>Fecha de impresión:</strong> ${new Date().toLocaleString('es-ES')}</p>
          <p><strong>Total de registros:</strong> ${data.length}</p>
          <p><strong>Vista:</strong> ${viewMode === 'messages' ? 'Mensajes' : 'Conversaciones'}</p>
        </div>
        ${tableHTML}
        <div class="footer">
          <p>Generado por Whinsap - Sistema de Gestión de WhatsApp</p>
          <p>${new Date().toLocaleDateString('es-ES')}</p>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      console.log('✅ Vista de impresión abierta');
      showSnackbar('✅ Vista de impresión abierta', 'success');
    } catch (error) {
      console.error('Error abriendo impresión:', error);
      showSnackbar(`❌ Error al abrir la impresión: ${error}`, 'error');
    }
  };

  const handleSyncContacts = async () => {
    try {
      setSyncLoading(true);
      console.log('Sincronizando contactos...');

      const response = await fetch(`${getAPIBaseURL()}/api/sync/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();

      if (data.success) {
        setSyncStats((prev: any) => ({ ...prev, contacts: data.stats }));
        console.log('Contactos sincronizados:', data.stats);
        alert(`✅ Contactos sincronizados: ${data.stats.contacts} contactos y ${data.stats.groups} grupos`);
      } else {
        console.error('Error sincronizando contactos:', data.error);
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
      alert('❌ Error al sincronizar contactos');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncGroups = async () => {
    try {
      setSyncLoading(true);
      console.log('Sincronizando grupos...');

      const response = await fetch(`${getAPIBaseURL()}/api/sync/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();

      if (data.success) {
        setSyncStats((prev: any) => ({ ...prev, groups: data.stats }));
        console.log('Grupos sincronizados:', data.stats);
        alert(`✅ Grupos sincronizados: ${data.stats.groups} grupos con ${data.stats.totalMembers} miembros totales`);
      } else {
        console.error('Error sincronizando grupos:', data.error);
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error en sincronización:', error);
      alert('❌ Error al sincronizar grupos');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleUpdateAvatars = async () => {
    try {
      setSyncLoading(true);
      console.log('Actualizando avatares...');

      const response = await fetch(`${getAPIBaseURL()}/api/update-contacts-avatars/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        console.log('Avatares actualizados:', data.stats);
        alert(`✅ Avatares actualizados: ${data.stats.updatedAvatars} de ${data.stats.totalContacts} contactos`);
      } else {
        console.error('Error actualizando avatares:', data.error);
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error actualizando avatares:', error);
      alert('❌ Error al actualizar avatares');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleViewMessage = (message: MessageHistory) => {
    setSelectedMessage(message);
    setShowMessageDialog(true);
  };

  const handleDeleteMessage = (messageId: string) => {
    setDeleteType('single');
    setDeleteTarget(messageId);
    setShowDeleteDialog(true);
  };

  const handleDeleteChat = (chatJid: string) => {
    setDeleteType('chat');
    setDeleteTarget(chatJid);
    setShowDeleteDialog(true);
  };

  const handleDeleteMultiple = () => {
    if (selectedMessages.length === 0) {
      alert('Selecciona al menos un mensaje para eliminar');
      return;
    }
    setDeleteType('multiple');
    setDeleteTarget(selectedMessages);
    setShowDeleteDialog(true);
  };

  const handleDeleteAllHistory = () => {
    const allIds = filteredMessages.map(m => m.id);
    setSelectedMessages(allIds);
    setDeleteType('multiple');
    setDeleteTarget(allIds);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleteLoading(true);

      let response;
      switch (deleteType) {
        case 'single':
          response = await fetch(`${getAPIBaseURL()}/api/messages/${sessionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: [deleteTarget as string] })
          });
          break;
        case 'chat':
          response = await fetch(`${getAPIBaseURL()}/api/chat/${sessionId}/${deleteTarget}`, {
            method: 'DELETE'
          });
          break;
        case 'multiple':
          response = await fetch(`${getAPIBaseURL()}/api/messages/${sessionId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: deleteTarget as string[] })
          });
          break;
        case 'all':
          response = await fetch(`${getAPIBaseURL()}/api/history/${sessionId}`, {
            method: 'DELETE'
          });
          break;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        alert(`✅ ${data.message || 'Eliminación exitosa'}`);
        setShowDeleteDialog(false);
        setSelectedMessages([]);
        loadHistoryData();
      } else {
        console.error('API error:', data);
        alert(`❌ Error: ${data.error || 'Error desconocido en la respuesta de la API'}`);
      }
    } catch (error) {
      console.error('Error eliminando:', error);
      alert(`❌ Error al eliminar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} sx={{ color: '#9c27b0' }} />
      </Box>
    );
  }

  // Siempre mostrar la interfaz completa del historial
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>




        {/* Header */}
        <Box sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 100%)',
          borderRadius: 3,
          p: 3,
          color: 'white'
        }}>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              📚 Historial Completo
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 300 }}>
              Búsqueda Avanzada • Analytics • Exportación • Auditoría Completa
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<SaveAlt />}
              onClick={() => {
                const dataToExport = viewMode === 'messages' ? filteredMessages : filteredConversations;
                if (dataToExport.length === 0) {
                  showSnackbar('⚠️ No hay datos para exportar. Aplica filtros o espera a que carguen los datos.', 'warning');
                  return;
                }
                exportToPDF(dataToExport);
              }}
              sx={{
                bgcolor: '#f44336',
                '&:hover': { bgcolor: '#d32f2f' }
              }}
            >
              PDF
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveAlt />}
              onClick={() => {
                const dataToExport = viewMode === 'messages' ? filteredMessages : filteredConversations;
                if (dataToExport.length === 0) {
                  showSnackbar('⚠️ No hay datos para exportar. Aplica filtros o espera a que carguen los datos.', 'warning');
                  return;
                }
                exportToExcel(dataToExport);
              }}
              sx={{
                bgcolor: '#4caf50',
                '&:hover': { bgcolor: '#388e3c' }
              }}
            >
              Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={() => {
                const dataToExport = viewMode === 'messages' ? filteredMessages : filteredConversations;
                if (dataToExport.length === 0) {
                  showSnackbar('⚠️ No hay datos para exportar. Aplica filtros o espera a que carguen los datos.', 'warning');
                  return;
                }
                handlePrint(dataToExport);
              }}
              sx={{
                bgcolor: '#2196f3',
                '&:hover': { bgcolor: '#1976d2' }
              }}
            >
              Imprimir
            </Button>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={handleRefreshData}
              sx={{
                bgcolor: 'rgba(255,0.2)',
                '&:hover': { bgcolor: 'rgba(255,255,0.3)' }
              }}
            >
              Refrescar
            </Button>
            {selectedMessages.length > 0 && (
              <Button
                variant="contained"
                startIcon={<Delete />}
                onClick={handleDeleteMultiple}
                sx={{
                  bgcolor: '#f44336',
                  '&:hover': { bgcolor: '#d32f2f' }
                }}
              >
                Eliminar Seleccionados ({selectedMessages.length})
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<DeleteForever />}
              onClick={handleDeleteAllHistory}
              sx={{
                bgcolor: '#d32f2f',
                '&:hover': { bgcolor: '#b71c1c' }
              }}
            >
              Eliminar Todo el Historial
            </Button>
          </Box>
        </Box>

        {/* Filtros avanzados */}
        <Card sx={{ mb: 3, bgcolor: '#1e293b', color: 'white', border: '1px solid rgba(255,255,255,0.05)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                🔍 Filtros y Búsqueda
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showAdvancedFilters}
                    onChange={(e) => setShowAdvancedFilters(e.target.checked)}
                  />
                }
                label="Filtros Avanzados"
                sx={{ color: 'rgba(255,255,255,0.7)' }}
              />
            </Box>

            <Grid container spacing={3}>
              {/* Búsqueda principal */}
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar en mensajes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
                      </InputAdornment>
                    ),
                    sx: { bgcolor: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: 2 }
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
              </Grid>

              {/* Rango de fechas */}
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="Desde"
                  value={dateFrom}
                  onChange={(newValue) => setDateFrom(newValue)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      sx: {
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                        '& .MuiOutlinedInput-input': { color: 'white' },
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="Hasta"
                  value={dateTo}
                  onChange={(newValue) => setDateTo(newValue)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      sx: {
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                        '& .MuiOutlinedInput-input': { color: 'white' },
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }
                      }
                    }
                  }}
                />
              </Grid>

              {/* Vista */}
              <Grid item xs={12} md={2}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, newValue) => newValue && setViewMode(newValue)}
                  size="small"
                  fullWidth
                  sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
                >
                  <ToggleButton value="conversations" sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(99, 102, 241, 0.5)' } }}>
                    Conversaciones
                  </ToggleButton>
                  <ToggleButton value="messages" sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(99, 102, 241, 0.5)' } }}>
                    Mensajes
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              {/* Filtros avanzados */}
              {showAdvancedFilters && (
                <>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small" sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                      <InputLabel>Tipo de Mensaje</InputLabel>
                      <Select
                        value={selectedType}
                        label="Tipo de Mensaje"
                        onChange={(e) => setSelectedType(e.target.value)}
                        sx={{ color: 'white', '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' } }}
                      >
                        <MenuItem value="all">Todos</MenuItem>
                        <MenuItem value="text">Texto</MenuItem>
                        <MenuItem value="image">Imagen</MenuItem>
                        <MenuItem value="audio">Audio</MenuItem>
                        <MenuItem value="video">Video</MenuItem>
                        <MenuItem value="document">Documento</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* ... other filters with similar updating ... */}
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small" sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                      <InputLabel>Estado</InputLabel>
                      <Select
                        value={selectedStatus}
                        label="Estado"
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        sx={{ color: 'white', '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' } }}
                      >
                        <MenuItem value="all">Todos</MenuItem>
                        <MenuItem value="sent">Enviado</MenuItem>
                        <MenuItem value="delivered">Entregado</MenuItem>
                        <MenuItem value="read">Visto</MenuItem>
                        <MenuItem value="failed">Fallido</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
            </Grid>

            {/* Resumen de filtros */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`${viewMode === 'messages' ? filteredMessages.length : filteredConversations.length} registros`} color="primary" />
              {/* Chips can stay as they are, they usually have compatible styles or use primary colors */}
            </Box>
          </CardContent>
        </Card>

        {/* Tabs - OCULTAS */}
        <Paper sx={{ mb: 3, display: 'none' }}>
          {/* ... */}
        </Paper>

        {/* Contenido de las tabs */}
        {selectedTab === 0 && (
          <Box>
            {viewMode === 'messages' ? (
              // Vista de mensajes
              <Card sx={{ bgcolor: '#1e293b', color: 'white', border: '1px solid rgba(255,255,255,0.05)' }}>
                <CardContent sx={{ p: 0 }}>
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ bgcolor: '#0f172a' }}>
                        <TableRow>
                          <TableCell padding="checkbox" sx={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <Checkbox sx={{ color: 'rgba(255,255,255,0.5)' }} />
                          </TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Contacto</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Mensaje</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Tipo</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Estado</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Agente</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Fecha</TableCell>
                          <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getCurrentTabMessages()
                          .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                          .map((message) => (
                            <TableRow key={message.id} hover>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedMessages.includes(message.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMessages([...selectedMessages, message.id]);
                                    } else {
                                      setSelectedMessages(selectedMessages.filter(id => id !== message.id));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Badge
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    badgeContent={
                                      message.isGroup ? (
                                        <Group sx={{ fontSize: 12, color: '#9c27b0' }} />
                                      ) : (
                                        <Person sx={{ fontSize: 12, color: '#00a884' }} />
                                      )
                                    }
                                  >
                                    <Avatar
                                      src={message.contactAvatar || undefined}
                                      sx={{
                                        bgcolor: message.isGroup ? '#9c27b0' : '#00a884',
                                        width: 32,
                                        height: 32,
                                        mr: 2
                                      }}
                                    >
                                      {message.contactName.charAt(0).toUpperCase()}
                                    </Avatar>
                                  </Badge>
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {message.contactName}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                                      {message.contactPhone}
                                    </Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                    {getMessageTypeIcon(message.messageType)}
                                    <Box sx={{ ml: 1, flex: 1 }}>
                                      {/* Mostrar contenido del mensaje */}
                                      {message.content && (
                                        <Typography variant="body2" sx={{ maxWidth: 300, mb: 0.5 }}>
                                          {message.content.length > 50
                                            ? `${message.content.substring(0, 50)}...`
                                            : message.content}
                                        </Typography>
                                      )}

                                      {/* Mostrar información de archivo multimedia */}
                                      {(message.mediaUrl || !['text'].includes(message.messageType)) && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                          <AttachFile sx={{ fontSize: 14, color: '#666' }} />
                                          <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>
                                            {getMessageTypeLabel(message.messageType, message.fileName)}
                                          </Typography>
                                        </Box>
                                      )}

                                      {/* Vista previa de imagen */}
                                      {message.messageType === 'image' && message.mediaUrl && (
                                        <Box sx={{ mt: 0.5 }}>
                                          <img
                                            src={message.mediaUrl}
                                            alt="Preview"
                                            style={{
                                              maxWidth: '100px',
                                              maxHeight: '60px',
                                              objectFit: 'cover',
                                              borderRadius: '4px',
                                              border: '1px solid #e0e0e0'
                                            }}
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        </Box>
                                      )}
                                    </Box>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {message.labels.slice(0, 2).map((label: string) => (
                                      <Chip
                                        key={label}
                                        label={label}
                                        size="small"
                                        sx={{ fontSize: '0.65rem', height: '16px' }}
                                      />
                                    ))}
                                    {message.sentiment && (
                                      <Chip
                                        label={message.sentiment}
                                        size="small"
                                        sx={{
                                          fontSize: '0.65rem',
                                          height: '16px',
                                          bgcolor: `${getSentimentColor(message.sentiment)}20`,
                                          color: getSentimentColor(message.sentiment)
                                        }}
                                      />
                                    )}
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {message.isFromMe ? (
                                    <Tooltip title="Enviado">
                                      <Send sx={{ fontSize: 20, color: '#1976d2' }} />
                                    </Tooltip>
                                  ) : (
                                    <Tooltip title="Recibido">
                                      <CallReceived sx={{ fontSize: 20, color: '#7b1fa2' }} />
                                    </Tooltip>
                                  )}
                                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                                    {message.isFromMe ? 'Enviado' : 'Recibido'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {message.isFromMe ? (
                                    <>
                                      {(message.status === 'read' || message.status === 'visto') && (
                                        <>
                                          <DoneAll sx={{ fontSize: 18, color: '#0088cc' }} />
                                          <Typography variant="body2" sx={{ color: '#0088cc', ml: 0.5 }}>
                                            Visto
                                          </Typography>
                                        </>
                                      )}
                                      {(message.status === 'delivered' || message.status === 'entregado') && (
                                        <>
                                          <DoneAll sx={{ fontSize: 18, color: '#64748b' }} />
                                          <Typography variant="body2" sx={{ color: '#64748b', ml: 0.5 }}>
                                            Entregado
                                          </Typography>
                                        </>
                                      )}
                                      {(message.status === 'sent' || message.status === 'enviado') && (
                                        <>
                                          <Check sx={{ fontSize: 18, color: '#64748b' }} />
                                          <Typography variant="body2" sx={{ color: '#64748b', ml: 0.5 }}>
                                            Enviado
                                          </Typography>
                                        </>
                                      )}
                                      {message.status === 'failed' && (
                                        <>
                                          <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                                          <Typography variant="body2" sx={{ color: '#ef4444', ml: 0.5 }}>
                                            Fallido
                                          </Typography>
                                        </>
                                      )}
                                      {(message.status === 'pending' || !message.status) && (
                                        <>
                                          <Schedule sx={{ fontSize: 18, color: '#f59e0b' }} />
                                          <Typography variant="body2" sx={{ color: '#f59e0b', ml: 0.5 }}>
                                            Pendiente
                                          </Typography>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                                      -
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {message.agentName || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {dayjs(message.timestamp).format('DD/MM/YYYY HH:mm')}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex' }}>
                                  <Tooltip
                                    title={
                                      <Box sx={{ maxWidth: 380, p: 1.5 }}>
                                        <Typography variant="caption" sx={{ color: '#ffd54f', fontWeight: 600, display: 'block', mb: 1 }}>
                                          {getMessageTypeLabel(message.messageType, message.fileName)}
                                        </Typography>

                                        {(() => {
                                          const msgType = String(message.messageType || '').toLowerCase();

                                          if ((msgType.includes('image') || message.messageType === 'image') && message.mediaUrl) {
                                            return (
                                              <Box sx={{ mb: 1 }}>
                                                <img
                                                  src={message.mediaUrl}
                                                  alt="Preview"
                                                  style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '6px' }}
                                                />
                                                {message.content && (
                                                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                                    {message.content}
                                                  </Typography>
                                                )}
                                              </Box>
                                            );
                                          } else if ((msgType.includes('video') || message.messageType === 'video') && message.mediaUrl) {
                                            return (
                                              <Typography variant="body2" sx={{ color: '#90caf9' }}>
                                                🎥 Video{message.content ? `: ${message.content}` : ''}
                                              </Typography>
                                            );
                                          } else if ((msgType.includes('audio') || message.messageType === 'audio') && message.mediaUrl) {
                                            return (
                                              <Typography variant="body2" sx={{ color: '#90caf9' }}>
                                                🎵 Mensaje de audio
                                              </Typography>
                                            );
                                          } else if (msgType.includes('document') || message.messageType === 'document' || message.fileName) {
                                            return (
                                              <Typography variant="body2" sx={{ color: '#81c784' }}>
                                                📄 {message.fileName || 'Documento'}
                                              </Typography>
                                            );
                                          } else {
                                            return (
                                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto' }}>
                                                {message.content || 'Sin contenido'}
                                              </Typography>
                                            );
                                          }
                                        })()}

                                        <Divider sx={{ my: 1, bgcolor: 'rgba(255,255,255,0.15)' }} />
                                        <Typography variant="caption" sx={{ color: '#90a4ae' }}>
                                          {new Date(message.timestamp).toLocaleString('es-ES', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </Typography>
                                      </Box>
                                    }
                                    arrow
                                    placement="left"
                                    componentsProps={{
                                      tooltip: {
                                        sx: {
                                          bgcolor: '#263238',
                                          color: '#fff',
                                          '& .MuiTooltip-arrow': {
                                            color: '#263238',
                                          },
                                          maxWidth: 420,
                                          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                          fontSize: '0.875rem'
                                        }
                                      }
                                    }}
                                  >
                                    <IconButton size="small">
                                      <Visibility fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={message.isStarred ? "Desmarcar como importante" : "Marcar como importante"}>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        const updatedMessages = messages.map(m =>
                                          m.id === message.id
                                            ? { ...m, isStarred: !m.isStarred }
                                            : m
                                        );
                                        setMessages(updatedMessages);
                                      }}
                                    >
                                      {message.isStarred ?
                                        <Star sx={{ color: '#ffd700' }} />  // Amarillo más prominente
                                        :
                                        <StarBorder sx={{ color: '#9e9e9e' }} />
                                      }
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Eliminar mensaje">
                                    <IconButton size="small" onClick={() => handleDeleteMessage(message.id)} color="error">
                                      <Delete />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      Mostrando {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, getCurrentTabMessages().length)} de {getCurrentTabMessages().length} mensajes
                    </Typography>
                    <Pagination
                      count={Math.ceil(getCurrentTabMessages().length / rowsPerPage)}
                      page={page}
                      onChange={(_, newPage) => setPage(newPage)}
                      color="primary"
                    />
                  </Box>
                </CardContent>
              </Card>
            ) : (
              // Vista de conversaciones originales
              <Grid container spacing={3}>
                {getCurrentTabConversations()
                  .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                  .map((conversation) => (
                    <Grid item xs={12} md={6} lg={4} key={conversation.id}>
                      <Card elevation={3} sx={{
                        borderRadius: 3,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                        }
                      }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Badge
                              overlap="circular"
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                              badgeContent={
                                conversation.isGroup ? (
                                  <Group sx={{ fontSize: 14, color: '#9c27b0' }} />
                                ) : (
                                  <Person sx={{ fontSize: 14, color: '#00a884' }} />
                                )
                              }
                            >
                              <Avatar
                                src={conversation.contactAvatar || undefined}
                                sx={{
                                  bgcolor: conversation.isGroup ? '#9c27b0' : '#00a884',
                                  width: 48,
                                  height: 48,
                                  mr: 2
                                }}
                              >
                                {conversation.contactName.charAt(0).toUpperCase()}
                              </Avatar>
                            </Badge>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {conversation.contactName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                {conversation.contactPhone}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {conversation.lastMessage}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              {dayjs(conversation.lastMessageTime).format('DD/MM/YYYY HH:mm')}
                            </Typography>
                          </Box>

                          <Grid container spacing={1} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2196f3' }}>
                                  {conversation.messageCount}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  Mensajes
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                                  {conversation.duration}m
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  Duración
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>

                          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            <Chip
                              label={conversation.status.toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: conversation.status === 'resolved' ? '#e8f5e8' :
                                  conversation.status === 'active' ? '#e3f2fd' :
                                    conversation.status === 'pending' ? '#fff3e0' : '#f3e5f5',
                                color: conversation.status === 'resolved' ? '#2e7d32' :
                                  conversation.status === 'active' ? '#1976d2' :
                                    conversation.status === 'pending' ? '#ef6c00' : '#7b1fa2'
                              }}
                            />
                            {conversation.labels.slice(0, 2).map((label: string) => (
                              <Chip
                                key={label}
                                label={label}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Agente: {conversation.agentName}
                            </Typography>
                            {conversation.satisfaction && (
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Star sx={{ fontSize: 14, color: '#ffc107', mr: 0.5 }} />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                  {conversation.satisfaction}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            )}
          </Box>
        )}

        {selectedTab === 3 && (
          <Box>
            {/* Vista específica de grupos mejorada */}
            {groups.length === 0 ? (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card sx={{ p: 4, textAlign: 'center' }}>
                    <Group sx={{ fontSize: 80, color: '#9c27b0', mb: 2 }} />
                    <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                      No hay grupos disponibles
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 3, color: '#666' }}>
                      Los grupos se cargan automáticamente desde tu WhatsApp.
                      Si no ves grupos aquí, es posible que no hayas participado en ningún grupo aún.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Refresh />}
                      onClick={() => loadGroups()}
                      sx={{
                        bgcolor: '#9c27b0',
                        '&:hover': { bgcolor: '#7b1fa2' }
                      }}
                    >
                      Recargar Grupos
                    </Button>
                  </Card>
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={3}>
                {groups
                  .slice((page - 1) * rowsPerPage, page * rowsPerPage)
                  .map((group) => (
                    <Grid item xs={12} md={6} lg={4} key={group.id || group.jid}>
                      <Card elevation={3} sx={{
                        borderRadius: 3,
                        transition: 'all 0.3s ease',
                        border: '1px solid #e0e0e0',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 32px rgba(156,39,176,0.15)',
                          borderColor: '#9c27b0'
                        }
                      }}>
                        <CardContent sx={{ p: 3 }}>
                          {/* Header del grupo con avatar e info principal */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Badge
                              overlap="circular"
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                              badgeContent={
                                <Group sx={{
                                  fontSize: 16,
                                  color: 'white',
                                  bgcolor: '#9c27b0',
                                  borderRadius: '50%',
                                  p: 0.5
                                }} />
                              }
                            >
                              <Avatar
                                src={group.avatar || undefined}
                                sx={{
                                  bgcolor: '#9c27b0',
                                  width: 64,
                                  height: 64,
                                  fontSize: '1.5rem',
                                  fontWeight: 600
                                }}
                              >
                                {(group.name || group.subject || 'G').charAt(0).toUpperCase()}
                              </Avatar>
                            </Badge>
                            <Box sx={{ ml: 2, flex: 1 }}>
                              <Typography variant="h6" sx={{
                                fontWeight: 600,
                                mb: 0.5,
                                color: '#1a1a1a'
                              }}>
                                {group.name || group.subject || 'Grupo sin nombre'}
                              </Typography>
                              <Typography variant="body2" sx={{
                                color: '#666',
                                fontWeight: 500
                              }}>
                                {group.jid ? group.jid.split('@')[0] : group.id || 'ID no disponible'}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Información del grupo */}
                          <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <PeopleIcon sx={{ fontSize: 20, color: '#9c27b0', mr: 1 }} />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {group.member_count || group.memberCount || 0} miembros
                              </Typography>
                            </Box>

                            {(group.created_at || group.createdAt) && (
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <CalendarToday sx={{ fontSize: 18, color: '#666', mr: 1 }} />
                                <Typography variant="caption" sx={{ color: '#666' }}>
                                  Creado: {new Date(group.created_at || group.createdAt).toLocaleDateString()}
                                </Typography>
                              </Box>
                            )}
                          </Box>

                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Group />}
                              sx={{
                                borderColor: '#9c27b0',
                                color: '#9c27b0',
                                '&:hover': {
                                  bgcolor: 'rgba(156,39,176,0.1)',
                                  borderColor: '#9c27b0'
                                }
                              }}
                              onClick={() => handleShowMembers(group)}
                            >
                              Miembros
                            </Button>

                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<Message />}
                              sx={{
                                bgcolor: '#9c27b0',
                                '&:hover': {
                                  bgcolor: '#7b1fa2'
                                }
                              }}
                              onClick={() => {
                                console.log('Ver mensajes del grupo:', group.id || group.jid);
                              }}
                            >
                              Mensajes
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}

                {/* Paginación para grupos */}
                {groups.length > rowsPerPage && (
                  <Grid item xs={12}>
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                      <Pagination
                        count={Math.ceil(groups.length / rowsPerPage)}
                        page={page}
                        onChange={(_, newPage) => setPage(newPage)}
                        color="primary"
                        size="large"
                      />
                    </Box>
                  </Grid>
                )}
              </Grid>
            )}
          </Box>
        )}

        {selectedTab === 1 && (
          <Box>
            {/* 📱 SISTEMA COMPLETO DE ESTADOS DE WHATSAPP */}

            {/* Header con estadísticas */}
            <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)', color: 'white' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WhatsApp sx={{ fontSize: 48, mr: 2 }} />
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Estados de WhatsApp
                      </Typography>
                      <Typography variant="body1" sx={{ opacity: 0.9 }}>
                        Crea y programa estados automáticos para tu WhatsApp
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setShowCreateStatusDialog(true)}
                    sx={{
                      bgcolor: 'white',
                      color: '#25d366',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}
                  >
                    Crear Estado
                  </Button>
                </Box>

                {/* Estadísticas rápidas */}
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" sx={{ fontWeight: 600 }}>
                        {scheduledStatuses.length}
                      </Typography>
                      <Typography variant="body2">Estados Creados</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" sx={{ fontWeight: 600 }}>
                        {statusHistory.length}
                      </Typography>
                      <Typography variant="body2">Publicados</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" sx={{ fontWeight: 600 }}>
                        {statusHistory.reduce((sum, s) => sum + (s.views_count || 0), 0)}
                      </Typography>
                      <Typography variant="body2">Vistas Totales</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" sx={{ fontWeight: 600 }}>
                        {statusInterval} {statusIntervalUnit}
                      </Typography>
                      <Typography variant="body2">Intervalo</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Lista de Estados Programados */}
            {scheduledStatuses.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      📋 Estados en Cola ({scheduledStatuses.length})
                    </Typography>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<Send />}
                      onClick={handlePublishStatuses}
                      disabled={loading}
                    >
                      Publicar Ahora
                    </Button>
                  </Box>

                  <Grid container spacing={2}>
                    {scheduledStatuses.map((status, index) => (
                      <Grid item xs={12} md={6} lg={4} key={status.id}>
                        <Card
                          elevation={2}
                          sx={{
                            border: editingStatusId === status.id ? '2px solid #25d366' : '1px solid #e0e0e0',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 8px 24px rgba(37,211,102,0.15)'
                            }
                          }}
                        >
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                              <Chip
                                label={`#${index + 1}`}
                                size="small"
                                sx={{ bgcolor: '#25d366', color: 'white', fontWeight: 600 }}
                              />
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditScheduledStatus(status.id)}
                                  sx={{ mr: 0.5 }}
                                >
                                  <InsertEmoticon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveScheduledStatus(status.id)}
                                  color="error"
                                >
                                  <Close />
                                </IconButton>
                              </Box>
                            </Box>

                            {status.image && (
                              <Box
                                component="img"
                                src={status.image}
                                alt="Preview"
                                sx={{
                                  width: '100%',
                                  height: 200,
                                  objectFit: 'cover',
                                  borderRadius: 2,
                                  mb: 2
                                }}
                              />
                            )}

                            {status.text && (
                              <Typography
                                variant="body2"
                                sx={{
                                  mb: 2,
                                  p: 2,
                                  bgcolor: '#f5f5f5',
                                  borderRadius: 2,
                                  minHeight: 60
                                }}
                              >
                                {status.text}
                              </Typography>
                            )}

                            <Typography variant="caption" color="text.secondary">
                              Creado: {new Date(status.createdAt).toLocaleString()}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Configuración de Programación */}
                  <Box sx={{ mt: 3, p: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      ⚙️ Configuración de Publicación
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Intervalo"
                          value={statusInterval}
                          onChange={(e) => setStatusInterval(parseInt(e.target.value) || 1)}
                          InputProps={{
                            inputProps: { min: 1, max: 1440 }
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Unidad</InputLabel>
                          <Select
                            value={statusIntervalUnit}
                            label="Unidad"
                            onChange={(e) => setStatusIntervalUnit(e.target.value as any)}
                          >
                            <MenuItem value="minutos">Minutos</MenuItem>
                            <MenuItem value="horas">Horas</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          📅 Próxima publicación en {statusInterval} {statusIntervalUnit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Rotación automática de 30 días
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Historial de Estados Publicados */}
            {statusHistory.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    📊 Historial de Publicaciones
                  </Typography>
                  <Grid container spacing={2}>
                    {statusHistory.slice(0, 6).map((status) => (
                      <Grid item xs={12} md={6} lg={4} key={status.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Chip
                                label={status.status}
                                size="small"
                                color={status.status === 'published' ? 'success' : 'default'}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {status.views_count || 0} vistas
                              </Typography>
                            </Box>
                            <Typography variant="body2" noWrap>
                              {status.text_content || '📷 Imagen'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(status.published_at).toLocaleString()}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Estado vacío */}
            {scheduledStatuses.length === 0 && statusHistory.length === 0 && (
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 8 }}>
                  <WhatsApp sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
                  <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
                    Comienza a Crear Estados
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Crea estados con imágenes, texto y emojis. Programa su publicación automática.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Add />}
                    onClick={() => setShowCreateStatusDialog(true)}
                    sx={{
                      background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                      px: 4,
                      py: 1.5
                    }}
                  >
                    Crear Primer Estado
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Dialog para Crear/Editar Estado */}
            <Dialog
              open={showCreateStatusDialog}
              onClose={() => {
                setShowCreateStatusDialog(false);
                handleCancelEdit();
              }}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PhotoCamera sx={{ mr: 1, color: '#25d366' }} />
                    <Typography variant="h6">
                      {editingStatusId ? 'Editar Estado' : 'Crear Nuevo Estado'}
                    </Typography>
                  </Box>
                  <IconButton onClick={() => {
                    setShowCreateStatusDialog(false);
                    handleCancelEdit();
                  }}>
                    <Close />
                  </IconButton>
                </Box>
              </DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={3}>
                  {/* Upload de Imagen */}
                  <Grid item xs={12}>
                    <input
                      accept="image/*,video/*"
                      style={{ display: 'none' }}
                      id="status-image-upload"
                      type="file"
                      onChange={handleStatusImageChange}
                    />
                    <label htmlFor="status-image-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        fullWidth
                        startIcon={<PhotoCamera />}
                        sx={{ py: 2 }}
                      >
                        {statusImagePreview ? 'Cambiar Imagen/Video' : 'Subir Imagen/Video'}
                      </Button>
                    </label>
                  </Grid>

                  {/* Preview de Imagen */}
                  {statusImagePreview && (
                    <Grid item xs={12}>
                      <Box
                        sx={{
                          position: 'relative',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '2px solid #e0e0e0'
                        }}
                      >
                        <Box
                          component="img"
                          src={statusImagePreview}
                          alt="Preview"
                          sx={{
                            width: '100%',
                            maxHeight: 400,
                            objectFit: 'contain'
                          }}
                        />
                        <IconButton
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                          }}
                          onClick={() => {
                            setStatusImage(null);
                            setStatusImagePreview(null);
                          }}
                        >
                          <Close />
                        </IconButton>
                      </Box>
                    </Grid>
                  )}

                  {/* Texto del Estado */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Texto del Estado"
                      placeholder="Escribe tu mensaje aquí... Puedes usar emojis 😊"
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      helperText={`${statusText.length}/700 caracteres`}
                      inputProps={{ maxLength: 700 }}
                    />
                  </Grid>

                  {/* Botones de Emojis Rápidos */}
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Emojis Rápidos:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {['😊', '❤️', '🎉', '🔥', '👍', '✨', '🚀', '💪', '🌟', '🎯', '💯', '🙌'].map((emoji) => (
                        <Button
                          key={emoji}
                          variant="outlined"
                          size="small"
                          onClick={() => setStatusText(prev => prev + emoji)}
                          sx={{ minWidth: 'auto', p: 1 }}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </Box>
                  </Grid>

                  {/* Preview del Estado */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Vista Previa:
                    </Typography>
                    <Box
                      sx={{
                        p: 3,
                        bgcolor: '#075E54',
                        color: 'white',
                        borderRadius: 2,
                        minHeight: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        backgroundImage: statusImagePreview ? `url(${statusImagePreview})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      {statusText && (
                        <Typography
                          variant="h6"
                          sx={{
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            fontWeight: 600
                          }}
                        >
                          {statusText}
                        </Typography>
                      )}
                      {!statusText && !statusImagePreview && (
                        <Typography variant="body2" sx={{ opacity: 0.7 }}>
                          Tu estado aparecerá aquí
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => {
                  setShowCreateStatusDialog(false);
                  handleCancelEdit();
                }}>
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAddScheduledStatus}
                  disabled={!statusText && !statusImage}
                  sx={{
                    background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)'
                  }}
                >
                  {editingStatusId ? 'Actualizar' : 'Agregar a Cola'}
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {selectedTab === 2 && (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              📎 Multimedia
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={mediaSubTab}
              onChange={(_, v) => v !== null && setMediaSubTab(v)}
              size="small"
              sx={{ mb: 2 }}
            >
              <ToggleButton value={0}>🖼️ Imágenes</ToggleButton>
              <ToggleButton value={1}>🎥 Videos</ToggleButton>
              <ToggleButton value={2}>🎵 Audio</ToggleButton>
              <ToggleButton value={3}>📄 Documentos</ToggleButton>
            </ToggleButtonGroup>

            <Grid container spacing={2}>
              {getCurrentTabMessages().map((m) => (
                <Grid item xs={12} md={6} lg={4} key={m.id}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        {getMessageTypeIcon(m.messageType)}
                        <Typography variant="subtitle2">
                          {getMessageTypeLabel(m.messageType, (m as any).fileName)}
                        </Typography>
                      </Stack>
                      {m.messageType === 'image' && m.mediaUrl && (
                        <Box sx={{ mt: 1 }}>
                          <img src={m.mediaUrl} alt="Imagen" style={{ maxWidth: '100%', borderRadius: 8 }} />
                        </Box>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {new Date(m.timestamp).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Tab 4: Historial de Campañas */}
        {selectedTab === 4 && (
          <Box>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    📢 Historial de Campañas
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={loadCampaigns}
                    size="small"
                  >
                    Actualizar
                  </Button>
                </Box>

                {/* Estadísticas de campañas */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                      <CampaignOutlined sx={{ fontSize: 32, color: '#1976d2', mb: 1 }} />
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {campaigns.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Total Campañas</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                      <Send sx={{ fontSize: 32, color: '#2e7d32', mb: 1 }} />
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {campaigns.reduce((sum, c) => sum + c.sent_count, 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Total Enviados</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
                      <Visibility sx={{ fontSize: 32, color: '#f57c00', mb: 1 }} />
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {campaigns.reduce((sum, c) => sum + (c.read_count || 0), 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Total Vistos</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffebee' }}>
                      <ErrorIcon sx={{ fontSize: 32, color: '#c62828', mb: 1 }} />
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {campaigns.reduce((sum, c) => sum + (c.failed_count || 0), 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Total Fallidos</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Lista de campañas */}
                {campaigns.length === 0 ? (
                  <Paper sx={{ p: 8, textAlign: 'center' }} variant="outlined">
                    <CampaignOutlined sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No hay campañas aún
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Las campañas que crees aparecerán aquí con su historial detallado
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<CampaignOutlined />}
                      onClick={() => window.location.href = '/dashboard/campaigns'}
                    >
                      Crear Primera Campaña
                    </Button>
                  </Paper>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell width="25%">Nombre de Campaña</TableCell>
                          <TableCell width="12%">Estado</TableCell>
                          <TableCell width="10%">Total</TableCell>
                          <TableCell width="10%">Enviados</TableCell>
                          <TableCell width="10%">Entregados</TableCell>
                          <TableCell width="8%">Vistos</TableCell>
                          <TableCell width="8%">Fallidos</TableCell>
                          <TableCell width="12%">Fecha Creación</TableCell>
                          <TableCell width="5%">Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {campaigns.map((campaign) => (
                          <TableRow key={campaign.id} hover>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {campaign.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  {campaign.message_template.substring(0, 50)}{campaign.message_template.length > 50 ? '...' : ''}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={campaign.status}
                                size="small"
                                color={
                                  campaign.status === 'completed' ? 'success' :
                                    campaign.status === 'active' ? 'primary' :
                                      campaign.status === 'failed' ? 'error' :
                                        campaign.status === 'paused' ? 'warning' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {campaign.total_recipients}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Check sx={{ fontSize: 16, color: '#2e7d32' }} />
                                <Typography variant="body2">{campaign.sent_count}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <DoneAll sx={{ fontSize: 16, color: '#1976d2' }} />
                                <Typography variant="body2">{campaign.delivered_count || 0}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Visibility sx={{ fontSize: 16, color: '#f57c00' }} />
                                <Typography variant="body2">{campaign.read_count || 0}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ErrorIcon sx={{ fontSize: 16, color: '#c62828' }} />
                                <Typography variant="body2">{campaign.failed_count || 0}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(campaign.created_at).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {new Date(campaign.created_at).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Ver detalles">
                                <IconButton
                                  size="small"
                                  onClick={() => loadCampaignDetails(campaign.id)}
                                >
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>

      {/* Diálogo de detalles de campaña */}
      <Dialog
        open={showCampaignDetailsDialog}
        onClose={() => setShowCampaignDetailsDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              📢 Detalles de Campaña: {selectedCampaign?.name}
            </Typography>
            <IconButton onClick={() => setShowCampaignDetailsDialog(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedCampaign && (
            <Box>
              {/* Información general */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Mensaje de la campaña
                    </Typography>
                    <Typography variant="body2">
                      {selectedCampaign.message_template}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          {selectedCampaign.total_recipients}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total Destinatarios
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          {selectedCampaign.sent_count}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Enviados
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          {selectedCampaign.read_count || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Vistos
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffebee' }}>
                        <Typography variant="h5" sx={{ fontWeight: 600 }}>
                          {selectedCampaign.failed_count || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Fallidos
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>

              {/* Lista de destinatarios */}
              {selectedCampaign.recipients && selectedCampaign.recipients.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell>Contacto</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell>Enviado</TableCell>
                        <TableCell>Entregado</TableCell>
                        <TableCell>Visto</TableCell>
                        <TableCell>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCampaign.recipients.map((recipient) => (
                        <TableRow key={recipient.id} hover>
                          <TableCell>
                            <Typography variant="body2">
                              {recipient.contact_name || recipient.contact_jid.split('@')[0]}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {recipient.contact_jid.split('@')[0]}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={recipient.status}
                              size="small"
                              color={
                                recipient.status === 'sent' ? 'success' :
                                  recipient.status === 'delivered' ? 'primary' :
                                    recipient.status === 'read' ? 'info' :
                                      recipient.status === 'failed' ? 'error' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {recipient.sent_at ? new Date(recipient.sent_at).toLocaleTimeString('es-ES') : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {recipient.delivered_at ? new Date(recipient.delivered_at).toLocaleTimeString('es-ES') : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {recipient.read_at ? new Date(recipient.read_at).toLocaleTimeString('es-ES') : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {recipient.error_message && (
                              <Tooltip title={recipient.error_message}>
                                <IconButton size="small">
                                  <ErrorIcon fontSize="small" color="error" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCampaignDetailsDialog(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para crear estados programados */}
      <Dialog
        open={showCreateStatusDialog}
        onClose={() => setShowCreateStatusDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#25d366', color: 'white', display: 'flex', alignItems: 'center' }}>
          <WhatsApp sx={{ mr: 1 }} />
          Publicar Estados de WhatsApp
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Crear nuevo estado */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Crear Estado
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Texto del estado"
                      multiline
                      rows={3}
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      placeholder="Escribe el texto de tu estado..."
                      fullWidth
                    />
                    <Box>
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="status-image-upload"
                        type="file"
                        onChange={handleStatusImageChange}
                      />
                      <label htmlFor="status-image-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<PhotoCamera />}
                        >
                          Subir Imagen
                        </Button>
                      </label>
                      {statusImagePreview && (
                        <Box sx={{ mt: 2, position: 'relative', display: 'inline-block' }}>
                          <img
                            src={statusImagePreview}
                            alt="Preview"
                            style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                          />
                          <IconButton
                            size="small"
                            sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'error.main', color: 'white' }}
                            onClick={() => {
                              setStatusImage(null);
                              setStatusImagePreview(null);
                            }}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        onClick={handleAddScheduledStatus}
                        disabled={!statusText && !statusImage}
                        startIcon={editingStatusId ? <Check /> : <Add />}
                        sx={{
                          bgcolor: editingStatusId ? '#2196f3' : '#25d366',
                          '&:hover': { bgcolor: editingStatusId ? '#1976d2' : '#128c7e' }
                        }}
                      >
                        {editingStatusId ? 'Actualizar Estado' : 'Agregar a la Lista'}
                      </Button>
                      {editingStatusId && (
                        <Button
                          variant="outlined"
                          onClick={handleCancelEdit}
                          color="error"
                        >
                          Cancelar
                        </Button>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Lista de estados programados */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Estados Programados ({scheduledStatuses.length})
                  </Typography>
                  {scheduledStatuses.length === 0 ? (
                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
                      No hay estados agregados. Crea uno arriba y agrégalo a la lista.
                    </Typography>
                  ) : (
                    <List>
                      {scheduledStatuses.map((status, index) => (
                        <ListItem
                          key={status.id}
                          secondaryAction={
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditScheduledStatus(status.id)}
                                  sx={{ color: '#2196f3' }}
                                >
                                  <IconButton sx={{ fontSize: 20 }}>✏️</IconButton>
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveScheduledStatus(status.id)}
                                >
                                  <Delete color="error" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          }
                          sx={{
                            border: editingStatusId === status.id ? '2px solid #2196f3' : '1px solid #e0e0e0',
                            borderRadius: 2,
                            mb: 1.5,
                            bgcolor: editingStatusId === status.id ? 'rgba(33, 150, 243, 0.05)' : 'transparent',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: '#25d366', fontWeight: 'bold' }}>
                              {index + 1}
                            </Avatar>
                          </ListItemAvatar>
                          <Box sx={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                            {status.image && (
                              <Box
                                component="img"
                                src={status.image}
                                alt={`Preview ${index + 1}`}
                                sx={{
                                  width: 60,
                                  height: 60,
                                  borderRadius: 1,
                                  objectFit: 'cover',
                                  border: '1px solid #ddd'
                                }}
                              />
                            )}
                            <ListItemText
                              primary={
                                <Typography variant="body1" sx={{ fontWeight: status.text ? 500 : 400 }}>
                                  {status.text || '(Solo imagen)'}
                                </Typography>
                              }
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  {status.image && (
                                    <Chip
                                      icon={<PhotoCamera sx={{ fontSize: 16 }} />}
                                      label="Con imagen"
                                      size="small"
                                      sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e3f2fd' }}
                                    />
                                  )}
                                  {status.text && (
                                    <Chip
                                      label={`${status.text.length} caracteres`}
                                      size="small"
                                      sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                  )}
                                </Box>
                              }
                            />
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Configuración de intervalo */}
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ bgcolor: '#f5f5f5' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <Timer sx={{ mr: 1 }} />
                    Programación Automática
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      label="Intervalo"
                      type="number"
                      value={statusInterval}
                      onChange={(e) => setStatusInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      inputProps={{ min: 1 }}
                      sx={{ width: '150px' }}
                    />
                    <FormControl sx={{ width: '150px' }}>
                      <InputLabel>Unidad</InputLabel>
                      <Select
                        value={statusIntervalUnit}
                        label="Unidad"
                        onChange={(e) => setStatusIntervalUnit(e.target.value as 'minutos' | 'horas')}
                      >
                        <MenuItem value="minutos">Minutos</MenuItem>
                        <MenuItem value="horas">Horas</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
                    Los estados se publicarán automáticamente cada {statusInterval} {statusIntervalUnit}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateStatusDialog(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handlePublishStatuses}
            disabled={scheduledStatuses.length === 0 || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <Send />}
            sx={{
              bgcolor: '#25d366',
              '&:hover': { bgcolor: '#128c7e' }
            }}
          >
            {loading ? 'Publicando...' : 'Publicar Estados'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para notificaciones modernas */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{
            width: '100%',
            boxShadow: 3,
            '& .MuiAlert-icon': {
              fontSize: 24
            }
          }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </LocalizationProvider>
  );
};

export default HistoryModule;
