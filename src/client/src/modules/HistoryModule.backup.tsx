import React, { useState, useEffect, useCallback } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
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
  Switch
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
  CampaignOutlined
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
  status: 'sent' | 'delivered' | 'read' | 'failed';
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

const HistoryModule: React.FC<HistoryModuleProps> = ({ sessionId }) => {
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [selectedTab, setSelectedTab] = useState(0);
  const [viewMode, setViewMode] = useState<'messages' | 'conversations'>('messages');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(dayjs().subtract(7, 'days'));
  const [dateTo, setDateTo] = useState<Dayjs | null>(dayjs());
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

  // Función de diagnóstico para verificar el sessionId y estado del servidor
  const diagnoseSession = useCallback(async () => {
    console.log('🔍 Diagnóstico del módulo de historial');
    console.log('SessionId recibido:', sessionId);
    console.log('Longitud del sessionId:', sessionId?.length || 0);

    if (!sessionId) {
      console.error('❌ SessionId está vacío o undefined');
      setDebugInfo({
        error: 'SessionId vacío',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      // Verificar sessionId en localStorage
      const localStorageSessionId = localStorage.getItem('whatsflow_session');

      // Primero intentar con el sessionId recibido
      let activeSessionId = sessionId;
      let sessionResponse = await fetch(`${getAPIBaseURL()}/api/session/${sessionId}/status`);
      let sessionData = await sessionResponse.json();

      // Si la sesión recibida no está activa, intentar con la de localStorage
      if (!sessionData.success || !sessionData.isConnected) {
        if (localStorageSessionId && localStorageSessionId !== sessionId) {
          console.log('🔄 Probando con sessionId de localStorage:', localStorageSessionId);
          sessionResponse = await fetch(`${getAPIBaseURL()}/api/session/${localStorageSessionId}/status`);
          sessionData = await sessionResponse.json();

          if (sessionData.success && sessionData.isConnected) {
            activeSessionId = localStorageSessionId;
            console.log('✅ Usando sessionId de localStorage:', activeSessionId);
          }
        }
      }

      console.log('Estado de la sesión:', sessionData);

      // Verificar contactos disponibles con el sessionId activo
      const contactsResponse = await fetch(`${getAPIBaseURL()}/api/contacts/${activeSessionId}`);
      const contactsData = await contactsResponse.json();
      console.log('Contactos disponibles:', contactsData);

      // Verificar mensajes disponibles con el sessionId activo
      const messagesResponse = await fetch(`${getAPIBaseURL()}/api/history/messages?sessionId=${activeSessionId}&limit=5`);
      const messagesData = await messagesResponse.json();
      console.log('Mensajes disponibles:', messagesData);

      setDebugInfo({
        receivedSessionId: sessionId,
        localStorageSessionId: localStorageSessionId,
        activeSessionId: activeSessionId,
        sessionStatus: sessionData,
        contactsCount: contactsData.contacts?.length || 0,
        messagesCount: messagesData.messages?.length || 0,
        timestamp: new Date().toISOString()
      });

      // Retornar el sessionId activo para usar en otras funciones
      return activeSessionId;

    } catch (error) {
      console.error('Error en diagnóstico:', error);
      setDebugInfo({
        error: error instanceof Error ? error.message : String(error),
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });
      return sessionId;
    }
  }, [sessionId]);

   const loadHistoryData = useCallback(async (forceReload = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Cargando historial de mensajes para sessionId:', sessionId);

      // Validar que el sessionId sea válido
      if (!sessionId || sessionId.trim() === '') {
        console.error('❌ SessionId no válido:', sessionId);
        setError('SessionId no válido');
        setMessages([]);
        setConversations([]);
        setAnalytics(null);
        setLoading(false);
        return;
      }

      const cacheKey = `history_${sessionId}`;
      const contactsCacheKey = `contacts_${sessionId}`;
      const cachedData = localStorage.getItem(cacheKey);
      const cachedContacts = localStorage.getItem(contactsCacheKey);

      if (!forceReload && cachedData && cachedContacts) {
        const parsedData = JSON.parse(cachedData);
        const parsedContacts = JSON.parse(cachedContacts);

        const cacheTime = parsedData.timestamp;
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 100;

        if (now - cacheTime < fiveMinutes) {
          setMessages(parsedData.messages);
          setConversations(parsedData.conversations);
          setLoading(false);
          return;
        }
      }

      // Primero cargar contactos desde la BD usando el sessionId directo
      const contactsResponse = await fetch(`${getAPIBaseURL()}/api/contacts/${sessionId}`);
      const contactsData = await contactsResponse.json();

      let contactsMap = new Map();
      if (contactsData.success && contactsData.contacts) {
        contactsData.contacts.forEach((contact: any) => {
          contactsMap.set(contact.jid, {
            name: contact.name,
            avatar: contact.avatar,
            isGroup: contact.isGroup
          });
        });
        console.log('📋 Contactos cargados en historial:', contactsMap.size);
      }

      // Cargar también grupos usando el sessionId directo
      const groupsResponse = await fetch(`${getAPIBaseURL()}/api/groups/${sessionId}`);
      const groupsData = await groupsResponse.json();

      if (groupsData.success && groupsData.groups) {
        groupsData.groups.forEach((group: any) => {
          contactsMap.set(group.id, {
            name: group.name,
            avatar: group.avatar,
            isGroup: true
          });
        });
        console.log('👥 Grupos cargados en historial:', groupsData.groups.length);
      }

      // Aumentar el límite de mensajes para cargar más datos
      const response = await fetch(`${getAPIBaseURL()}/api/history/messages?sessionId=${sessionId}&limit=50000&offset=0`);
      const data = await response.json();

      console.log('📦 Respuesta de la API /api/history/messages:', data);
      console.log('📊 Total de mensajes recibidos:', data.messages?.length || 0);

      if (data.success && data.messages && Array.isArray(data.messages)) {
        const apiMessages: MessageHistory[] = data.messages.map((msg: any) => {
          const chatJid = msg.chatJid || msg.chat_jid || 'unknown';
          const contactInfo = contactsMap.get(chatJid);

          return {
            id: msg.id || `msg_${Date.now()}`,
            conversationId: chatJid,
            contactName: msg.contactName || contactInfo?.name || msg.chatName || msg.chat_name || msg.senderName || chatJid.split('@')[0] || 'Desconocido',
            contactPhone: chatJid.split('@')[0] || 'unknown',
            contactAvatar: msg.contactAvatar || `${getAPIBaseURL()}/api/avatar/${sessionId}/${chatJid}`,
            isGroup: msg.isGroup !== undefined ? msg.isGroup : (contactInfo?.isGroup || chatJid.includes('@g.us')),
            messageType: msg.type || msg.message_type || 'text',
            content: getMessageContent(msg),
            mediaUrl: msg.mediaUrl || msg.media_url || null,
            fileName: msg.fileName || msg.file_name || null,
            timestamp: msg.timestamp || new Date().toISOString(),
            isFromMe: msg.fromMe || msg.from_me || false,
            status: msg.status || 'sent',
            agentName: msg.senderName || 'Sistema',
            labels: [],
            priority: 'medium',
            sentiment: 'neutral',
            isStarred: false,
            isArchived: false
          };
        });

        const conversationMap = new Map<string, ConversationSummary>();

        apiMessages.forEach((msg) => {
          const convId = msg.conversationId || 'unknown';
          const contactInfo = contactsMap.get(convId);

          if (msg.isGroup || convId.includes('@g.us')) {
            return;
          }

          if (!conversationMap.has(convId)) {
            conversationMap.set(convId, {
              id: convId,
              contactName: contactInfo?.name || msg.contactName || 'Desconocido',
              contactPhone: msg.contactPhone || 'unknown',
              contactAvatar: `${getAPIBaseURL()}/api/avatar/${sessionId}/${convId}`,
              isGroup: contactInfo?.isGroup || msg.isGroup || false,
              messageCount: 0,
              lastMessage: msg.content || 'Sin mensaje',
              lastMessageTime: msg.timestamp || new Date().toISOString(),
              duration: 0,
              status: 'active',
              agentName: 'Sistema',
              labels: [],
              responseTime: 0
            });
          }

          const conv = conversationMap.get(convId)!;
          conv.messageCount++;
          if (new Date(msg.timestamp || 0) > new Date(conv.lastMessageTime || 0)) {
            conv.lastMessage = msg.content || 'Sin mensaje';
            conv.lastMessageTime = msg.timestamp || new Date().toISOString();
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
          localStorage.setItem(contactsCacheKey, JSON.stringify(Array.from(contactsMap.entries())));
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
    if (sessionId) {
      console.log('🚀 HistoryModule iniciado con sessionId:', sessionId);
      loadHistoryData();
    } else {
      console.error('❌ HistoryModule iniciado sin sessionId');
      setError('No se recibió sessionId válido');
      diagnoseSession();
    }
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

  useEffect(() => {
    if (sessionId) {
      // Obtener el sessionId activo primero
      diagnoseSession().then((activeSessionId) => {
        const currentSessionId = activeSessionId || sessionId;
        loadGroups(currentSessionId);
        loadStatuses(currentSessionId);
      });
    }
  }, [sessionId, diagnoseSession]);

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

  const loadStatuses = async (activeSessionId?: string) => {
    try {
      const currentSessionId = activeSessionId || sessionId;
      const response = await fetch(`${getAPIBaseURL()}/api/statuses/${currentSessionId}`);
      const data = await response.json();
      if (data.success && data.statuses && Array.isArray(data.statuses)) {
        setStatuses(data.statuses);
      } else {
        setStatuses([]);
      }
    } catch (error) {
      setStatuses([]);
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
    console.log(`🔍 Mensajes filtrados:`, filteredMessages.slice(0, 3)); // Mostrar primeros 3 mensajes filtrados

    let result;
    switch (selectedTab) {
      case 0: // Chats individuales
        result = getFilteredByTab(filteredMessages, false);
        console.log(`📊 Tab 0 (Individuales): ${result.length} mensajes`);
        break;
      case 1: // Grupos
        result = getFilteredByTab(filteredMessages, true);
        console.log(`📊 Tab 1 (Grupos): ${result.length} mensajes`);
        break;
      case 2: // Estados - por ahora vacío
        result = [];
        console.log(`📊 Tab 2 (Estados): ${result.length} mensajes`);
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

  const handleExport = async () => {
    const dataToExport = viewMode === 'messages' ? filteredMessages : filteredConversations;
    console.log(`Exportando ${dataToExport.length} registros en formato ${exportFormat}`);
    setShowExportDialog(false);
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
                startIcon={<Download />}
                onClick={() => setShowExportDialog(true)}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                }}
              >
                Exportar
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
          <Card sx={{ mb: 3 }}>
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
                />
              </Box>

              <Grid container spacing={3}>
                {/* Búsqueda principal */}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Buscar en mensajes, contactos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Rango de fechas */}
                <Grid item xs={12} md={3}>
                  <DatePicker
                    label="Desde"
                    value={dateFrom}
                    onChange={(newValue) => setDateFrom(newValue)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <DatePicker
                    label="Hasta"
                    value={dateTo}
                    onChange={(newValue) => setDateTo(newValue)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
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
                  >
                    <ToggleButton value="conversations">
                      Conversaciones
                    </ToggleButton>
                    <ToggleButton value="messages">
                      Mensajes
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>

                {/* Filtros avanzados */}
                {showAdvancedFilters && (
                  <>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Tipo de Mensaje</InputLabel>
                        <Select
                          value={selectedType}
                          label="Tipo de Mensaje"
                          onChange={(e) => setSelectedType(e.target.value)}
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
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Estado</InputLabel>
                        <Select
                          value={selectedStatus}
                          label="Estado"
                          onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                          <MenuItem value="all">Todos</MenuItem>
                          <MenuItem value="sent">Enviado</MenuItem>
                          <MenuItem value="delivered">Entregado</MenuItem>
                          <MenuItem value="read">Visto</MenuItem>
                          <MenuItem value="failed">Fallido</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Dirección</InputLabel>
                        <Select
                          value={selectedDirection}
                          label="Dirección"
                          onChange={(e) => setSelectedDirection(e.target.value)}
                        >
                          <MenuItem value="all">Todos</MenuItem>
                          <MenuItem value="sent">📤 Enviados</MenuItem>
                          <MenuItem value="received">📥 Recibidos</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Agente</InputLabel>
                        <Select
                          value={selectedAgent}
                          label="Agente"
                          onChange={(e) => setSelectedAgent(e.target.value)}
                        >
                          <MenuItem value="all">Todos</MenuItem>
                          <MenuItem value="María González">María González</MenuItem>
                          <MenuItem value="Carlos Rivera">Carlos Rivera</MenuItem>
                          <MenuItem value="Ana Martínez">Ana Martínez</MenuItem>
                          <MenuItem value="Luis Hernández">Luis Hernández</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
              </Grid>

              {/* Resumen de filtros */}
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`${viewMode === 'messages' ? filteredMessages.length : filteredConversations.length} registros`}
                  color="primary"
                />
                {searchTerm && <Chip label={`Búsqueda: "${searchTerm}"`} onDelete={() => setSearchTerm('')} />}
                {selectedType !== 'all' && <Chip label={`Tipo: ${selectedType}`} onDelete={() => setSelectedType('all')} />}
                {selectedStatus !== 'all' && <Chip label={`Estado: ${selectedStatus}`} onDelete={() => setSelectedStatus('all')} />}
                {selectedDirection !== 'all' && <Chip label={`Dirección: ${selectedDirection === 'sent' ? 'Enviados' : 'Recibidos'}`} onDelete={() => setSelectedDirection('all')} />}
                {selectedAgent !== 'all' && <Chip label={`Agente: ${selectedAgent}`} onDelete={() => setSelectedAgent('all')} />}
              </Box>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
              <Tab label={`Chats (${viewMode === 'messages' ? filteredMessages.filter(m => !m.isGroup).length : filteredConversations.filter(c => !c.isGroup).length})`} />
              <Tab label={`Grupos (${groups.length})`} />
              <Tab label="Estados" />
              <Tab label="Historial de Campañas" />
              <Tab label="Analytics" />
              <Tab label="Reportes" />
            </Tabs>
          </Paper>

          {/* Contenido de las tabs */}
          {selectedTab === 0 && (
            <Box>
              {viewMode === 'messages' ? (
                // Vista de mensajes
                <Card>
                  <CardContent sx={{ p: 0 }}>
                    <TableContainer>
                      <Table>
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell padding="checkbox">
                              <Checkbox />
                            </TableCell>
                            <TableCell>Contacto</TableCell>
                            <TableCell>Mensaje</TableCell>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Estado</TableCell>
                            <TableCell>Agente</TableCell>
                            <TableCell>Fecha</TableCell>
                            <TableCell>Acciones</TableCell>
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
                                <Chip
                                  icon={getMessageTypeIcon(message.messageType)}
                                  label={getMessageTypeLabel(message.messageType, message.fileName)}
                                  size="small"
                                  variant="outlined"
                                  sx={{ maxWidth: '150px' }}
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  {getStatusIcon(message.status)}
                                  <Typography variant="caption" sx={{ ml: 0.5 }}>
                                    {getStatusLabel(message.status)}
                                  </Typography>
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
                                  <Tooltip title="Ver mensaje completo">
                                    <IconButton size="small" onClick={() => handleViewMessage(message)}>
                                      <Visibility />
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

          {selectedTab === 1 && (
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

          {selectedTab === 2 && (
            <Box>
              {/* Pestaña de Estados de WhatsApp mejorada */}
              <Grid container spacing={3}>
                {/* Header con estadísticas */}
                <Grid item xs={12}>
                  <Card sx={{ background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)', color: 'white' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <WhatsApp sx={{ fontSize: 48, mr: 2 }} />
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Estados de WhatsApp
                          </Typography>
                          <Typography variant="body1" sx={{ opacity: 0.9 }}>
                            Visualiza y gestiona los estados de tus contactos
                          </Typography>
                        </Box>
                      </Box>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Visibility sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                              {statuses.filter(s => s.viewed).length}
                            </Typography>
                            <Typography variant="body2">Estados Vistos</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Schedule sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                              {statuses.length}
                            </Typography>
                            <Typography variant="body2">Estados Disponibles</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Star sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>
                              {statuses.filter(s => s.is_own).length}
                            </Typography>
                            <Typography variant="body2">Estados Propios</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Ejemplo de estados con imágenes de perfil */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                        <Timeline sx={{ mr: 1 }} />
                        Estados Recientes
                      </Typography>

                      {/* Estados reales desde la base de datos */}
                      {statuses.length > 0 ? (
                        <Grid container spacing={2}>
                          {statuses.map((status, index) => (
                            <Grid item xs={12} md={6} lg={3} key={status.id || index}>
                              <Card
                                elevation={2}
                                sx={{
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                  border: status.viewed ? '2px solid #e0e0e0' : '2px solid #25d366',
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 8px 24px rgba(37,211,102,0.15)'
                                  }
                                }}
                              >
                                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                  <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                                    <Avatar
                                      src={status.contact_avatar || undefined}
                                      sx={{
                                        width: 56,
                                        height: 56,
                                        bgcolor: status.is_own ? '#25d366' : '#2196f3',
                                        fontSize: '1.2rem',
                                        fontWeight: 600
                                      }}
                                    >
                                      {status.contact_name.charAt(0).toUpperCase()}
                                    </Avatar>
                                    {!status.viewed && (
                                      <Box
                                        sx={{
                                          position: 'absolute',
                                          top: -2,
                                          left: -2,
                                          right: -2,
                                          bottom: -2,
                                          border: '3px solid #25d366',
                                          borderRadius: '50%'
                                        }}
                                      />
                                    )}
                                    {status.is_own && (
                                      <Box
                                        sx={{
                                          position: 'absolute',
                                          bottom: 2,
                                          right: 2,
                                          bgcolor: '#ffc107',
                                          borderRadius: '50%',
                                          width: 16,
                                          height: 16,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                      >
                                        <Person sx={{ fontSize: 10, color: 'white' }} />
                                      </Box>
                                    )}

                                    {/* Indicador de tipo de estado */}
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        bgcolor: getStatusTypeColor(status.status_type),
                                        borderRadius: '50%',
                                        width: 20,
                                        height: 20,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid white'
                                      }}
                                    >
                                      {getStatusTypeIcon(status.status_type)}
                                    </Box>
                                  </Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                    {status.contact_name}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {new Date(status.status_time).toLocaleString()}
                                  </Typography>
                                  {status.viewed && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#666', mt: 0.5 }}>
                                      ✓ Visto
                                    </Typography>
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                          <WhatsApp sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
                          <Typography variant="h6" color="textSecondary" sx={{ mb: 1 }}>
                            No hay estados disponibles
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Los estados de tus contactos aparecerán aquí cuando estén disponibles.
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={() => loadStatuses()}
                            sx={{ mt: 2 }}
                          >
                            Recargar Estados
                          </Button>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Estadísticas de sincronización */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>📊 Estados de Mensajes</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Card sx={{ bgcolor: '#fff3e0' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                              <Check sx={{ fontSize: 40, color: '#ff9800', mb: 1 }} />
                              <Typography variant="h5" sx={{ fontWeight: 700, color: '#ff9800' }}>
                                {analytics?.statusCounts.sent || 0}
                              </Typography>
                              <Typography variant="body2">Enviado</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Card sx={{ bgcolor: '#e8f5e8' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                              <DoneAll sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
                              <Typography variant="h5" sx={{ fontWeight: 700, color: '#4caf50' }}>
                                {analytics?.statusCounts.delivered || 0}
                              </Typography>
                              <Typography variant="body2">Entregado</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Card sx={{ bgcolor: '#e3f2fd' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                              <DoneAll sx={{ fontSize: 40, color: '#2196f3', mb: 1 }} />
                              <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196f3' }}>
                                {analytics?.statusCounts.read || 0}
                              </Typography>
                              <Typography variant="body2">Visto</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Card sx={{ bgcolor: '#ffebee' }}>
                            <CardContent sx={{ textAlign: 'center' }}>
                              <ErrorIcon sx={{ fontSize: 40, color: '#f44336', mb: 1 }} />
                              <Typography variant="h5" sx={{ fontWeight: 700, color: '#f44336' }}>
                                {analytics?.statusCounts.failed || 0}
                              </Typography>
                              <Typography variant="body2">Fallido</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Análisis de sentimientos */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Análisis de Sentimientos</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" sx={{ color: '#4caf50', fontWeight: 700 }}>
                              {analytics?.sentimentAnalysis.positive}%
                            </Typography>
                            <Typography variant="body2">Positivo</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" sx={{ color: '#ff9800', fontWeight: 700 }}>
                              {analytics?.sentimentAnalysis.neutral}%
                            </Typography>
                            <Typography variant="body2">Neutral</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" sx={{ color: '#f44336', fontWeight: 700 }}>
                              {analytics?.sentimentAnalysis.negative}%
                            </Typography>
                            <Typography variant="body2">Negativo</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Tab 3: Historial de Campañas */}
          {selectedTab === 3 && (
            <Box>
              <Card>
                <CardContent>
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                    📊 Historial de Envíos de Campañas
                  </Typography>

                  {/* Filtros */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Buscar campaña"
                        placeholder="Nombre, contacto, mensaje..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search />
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Estado</InputLabel>
                        <Select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          label="Estado"
                        >
                          <MenuItem value="all">Todos</MenuItem>
                          <MenuItem value="sent">Enviado</MenuItem>
                          <MenuItem value="delivered">Entregado</MenuItem>
                          <MenuItem value="read">Visto</MenuItem>
                          <MenuItem value="failed">Fallido</MenuItem>
                          <MenuItem value="pending">Pendiente</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2.5}>
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                          label="Fecha Desde"
                          value={dateFrom}
                          onChange={(newValue) => setDateFrom(newValue)}
                          slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                        />
                      </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12} md={2.5}>
                      <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                          label="Fecha Hasta"
                          value={dateTo}
                          onChange={(newValue) => setDateTo(newValue)}
                          slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                        />
                      </LocalizationProvider>
                    </Grid>
                  </Grid>

                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      <strong>Próximamente:</strong> Aquí podrás ver el historial completo de todos los envíos de campañas con su estado detallado, filtrar por fecha, estado de entrega, y exportar reportes.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Estados disponibles:</strong> Enviado, Entregado, Visto, Fallido, Pendiente
                    </Typography>
                  </Alert>

                  {/* Tabla de historial de campañas */}
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell width="5%">
                            <Checkbox />
                          </TableCell>
                          <TableCell width="20%">Campaña</TableCell>
                          <TableCell width="15%">Contacto</TableCell>
                          <TableCell width="25%">Mensaje</TableCell>
                          <TableCell width="12%">Fecha/Hora</TableCell>
                          <TableCell width="10%">Estado</TableCell>
                          <TableCell width="13%">Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={7} sx={{ textAlign: 'center', py: 8 }}>
                            <Send sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              No hay envíos de campañas aún
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Los envíos de tus campañas aparecerán aquí con información detallada
                            </Typography>
                            <Button
                              variant="contained"
                              startIcon={<CampaignOutlined />}
                              sx={{ mt: 2 }}
                              onClick={() => window.location.href = '/dashboard/campaigns'}
                            >
                              Crear Primera Campaña
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Estadísticas rápidas */}
                  <Grid container spacing={2} sx={{ mt: 3 }}>
                    <Grid item xs={12} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                        <Send sx={{ fontSize: 32, color: '#1976d2', mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>0</Typography>
                        <Typography variant="body2" color="text.secondary">Total Enviados</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                        <DoneAll sx={{ fontSize: 32, color: '#2e7d32', mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>0</Typography>
                        <Typography variant="body2" color="text.secondary">Entregados</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
                        <Visibility sx={{ fontSize: 32, color: '#f57c00', mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>0</Typography>
                        <Typography variant="body2" color="text.secondary">Vistos</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffebee' }}>
                        <ErrorIcon sx={{ fontSize: 32, color: '#c62828', mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>0</Typography>
                        <Typography variant="body2" color="text.secondary">Fallidos</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </LocalizationProvider>
    );
};

export default HistoryModule;
