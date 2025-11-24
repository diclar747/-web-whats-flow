import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Avatar,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Badge,
  AppBar,
  Toolbar,
  Button,
  InputAdornment,
  Paper,
  CircularProgress,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  LinearProgress,
  Card,
  CardMedia,
  Fade,
  Zoom,
  Alert,
  Snackbar,
  Tabs,
  Tab
} from '@mui/material';
import {
  Chat as ChatIcon,
  Search as SearchIcon,
  Logout as LogoutIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  MoreVert as MoreIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
  Videocam as VideoIcon,
  AudioFile as AudioIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  AccessTime as PendingIcon,
  Close as CloseIcon,
  GetApp as DownloadIcon,
  Info as InfoIcon,
  Archive as ArchiveIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Refresh as RefreshIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  WhatsApp as WhatsAppIcon,
  FiberManualRecord as StatusIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import EmojiPicker from 'emoji-picker-react';

// ==================== INTERFACES ====================

interface AgentChat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  assignedAt: string;
  phoneNumber?: string;
  isOnline?: boolean;
  isTyping?: boolean;
  status?: 'active' | 'closed' | 'transferred' | 'new_assignment';
  closedAt?: string;
}

interface Message {
  id: string;
  chatJid?: string;
  senderJid?: string;
  from_me: boolean;
  text_content?: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
  message_type: 'conversation' | 'image' | 'document' | 'video' | 'audio' | 'ptt';
  media_url?: string;
  caption?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  sender_name?: string;
  sender_avatar?: string;
  quoted_message_id?: string;
  agent_id?: number | null;  // ID del agente que respondió
  agent_name?: string;  // Nombre del agente que respondió
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
}

// ==================== COMPONENTE PRINCIPAL ====================

const AgentDashboardPro: React.FC = () => {
  const navigate = useNavigate();
  const { socket, isConnected, on, off } = useSocket();

  // ==================== ESTADOS ====================
  const [chats, setChats] = useState<AgentChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<AgentChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  // Estados UI avanzados
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'unread'>('all');
  const [messageDateFilter, setMessageDateFilter] = useState<string>('today'); // 'today', 'week', 'month', 'all'
  const [chatListDateFilter, setChatListDateFilter] = useState<string>('today'); // Filtro para lista de chats

  // Estado para minimizar/maximizar lista de chats (por defecto minimizado)
  const [chatListMinimized, setChatListMinimized] = useState(true);

  // Nuevo: Estado para modo oscuro/claro
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('agentDashboardTheme');
    return saved ? saved === 'dark' : false; // Por defecto modo claro en dashboard agente
  });

  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // API URL
  const apiUrl = process.env.REACT_APP_API_URL || window.location.origin;

  // ==================== TEMA Y COLORES ====================

  // Paleta de colores según modo
  const theme = {
    // Modo claro
    light: {
      bg: {
        primary: '#f0f2f5',
        secondary: '#ffffff',
        chat: '#efeae2',
        header: '#2c3e50', // Azul oscuro elegante
        messageOwn: '#ffffff', // Mismo color que mensajes recibidos
        messageOther: '#ffffff'
      },
      text: {
        primary: '#111b21',
        secondary: '#667781',
        onHeader: '#ffffff'
      },
      border: '#d1d7db',
      hover: '#f5f5f5'
    },
    // Modo oscuro
    dark: {
      bg: {
        primary: '#111b21',
        secondary: '#202c33',
        chat: '#0b141a',
        header: '#1a252f', // Gris azulado oscuro
        messageOwn: '#202c33', // Mismo color que mensajes recibidos
        messageOther: '#202c33'
      },
      text: {
        primary: '#e9edef',
        secondary: '#8696a0',
        onHeader: '#ffffff'
      },
      border: '#2a3942',
      hover: '#2a3942'
    }
  };

  const currentTheme = darkMode ? theme.dark : theme.light;

  // Función para generar color basado en el nombre del contacto
  const getAvatarColor = (name: string) => {
    const colors = [
      '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
      '#00BCD4', '#009688', '#4CAF50', '#FF9800', '#FF5722',
      '#F44336', '#795548', '#607D8B', '#1976D2', '#D32F2F'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Manejar cambio de tema
  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('agentDashboardTheme', newMode ? 'dark' : 'light');
  };

  // ==================== INICIALIZACIÓN ====================

  useEffect(() => {
    const initializeAgent = async () => {
      const token = sessionStorage.getItem('token');
      const userId = sessionStorage.getItem('userId');
      const savedUserName = sessionStorage.getItem('userName');

      console.log('🚀 [AGENT-PRO] Inicializando panel profesional...');
      console.log('🔍 Token:', token ? 'Existe' : 'No existe');
      console.log('🔍 UserId:', userId);

      if (!token || !userId) {
        console.log('❌ No hay sesión de agente');
        sessionStorage.clear();
        navigate('/login');
        return;
      }

      setAgentId(parseInt(userId));
      setUserName(savedUserName || 'Agente');
      console.log('✅ AgentId establecido:', userId);

      // Solicitar permisos de notificación
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission();
          console.log('🔔 Permisos de notificación:', permission);
          if (permission === 'granted') {
            showSnackbar('Notificaciones activadas correctamente', 'success');
          }
        } catch (error) {
          console.error('Error solicitando permisos:', error);
        }
      }

      // Inicializar audio de notificación (con manejo de errores)
      try {
        // Intentar cargar archivo de notificación
        audioRef.current = new Audio('/notification.mp3');
        audioRef.current.volume = 0.5; // Volumen moderado
        audioRef.current.load(); // Pre-cargar
        console.log('✅ Audio de notificación inicializado');
      } catch (error) {
        console.log('⚠️ No se pudo cargar audio de notificación:', error);
        // Si falla, usar AudioContext para generar un beep
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContext();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.3;
          // Guardar referencia para reproducir después
          (audioRef as any).beepContext = { audioContext, oscillator, gainNode };
        } catch (beepError) {
          console.log('⚠️ Tampoco se pudo crear beep de audio');
          audioRef.current = null;
        }
      }

      // Obtener sessionId del ADMIN desde la base de datos
      try {
        const response = await fetch(`/api/users/${userId}/session`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        console.log('🔍 [AGENT-SESSION] Respuesta:', data);

        if (data.success && data.sessionId) {
          setSessionId(data.sessionId);
          setPhoneNumber(data.phoneNumber);
          setWhatsappConnected(true); // ✅ WhatsApp está conectado
          console.log('✅ Usando sesión del admin:', data.sessionId);
          console.log('✅ Número del admin:', data.phoneNumber);

          // Guardar en sessionStorage para uso global
          sessionStorage.setItem('adminSessionId', data.sessionId);
          sessionStorage.setItem('adminPhoneNumber', data.phoneNumber || '');
          sessionStorage.setItem('whatsflow_session', data.sessionId); // Para Socket
        } else {
          setWhatsappConnected(false); // ❌ WhatsApp NO está conectado
          console.error('❌ No se pudo obtener sesión del admin:', data.message);
          showSnackbar('⚠️ El administrador no tiene WhatsApp conectado. No podrás enviar mensajes.', 'error');
        }
      } catch (error) {
        console.error('❌ Error obteniendo sessionId:', error);
        showSnackbar('Error al conectar con el sistema. Recarga la página.', 'error');
      }
    };

    initializeAgent();
  }, [navigate]);

  // ==================== FUNCIONES AUXILIARES ====================

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const playNotificationSound = () => {
    if (!soundEnabled) return;

    // Intentar reproducir audio
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.log('⚠️ No se pudo reproducir sonido:', e.message || e);
      });
    }
    // Si no hay audio, intentar con beep generado
    else if ((audioRef as any).beepContext) {
      try {
        const { audioContext, oscillator, gainNode } = (audioRef as any).beepContext;
        const newOscillator = audioContext.createOscillator();
        const newGainNode = audioContext.createGain();
        newOscillator.connect(newGainNode);
        newGainNode.connect(audioContext.destination);
        newOscillator.frequency.value = 800;
        newOscillator.type = 'sine';
        newGainNode.gain.value = 0.3;
        newOscillator.start();
        setTimeout(() => newOscillator.stop(), 200);
      } catch (e) {
        console.log('⚠️ No se pudo reproducir beep');
      }
    }
  };

  const showDesktopNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/whatsapp-icon.png',
        badge: '/whatsapp-icon.png',
        tag: 'whatsflow-notification',
        requireInteraction: false
      });
    }
  };

  // ==================== CARGA DE DATOS ====================

  const loadAgentChats = useCallback(async (dateFilter: string = 'today') => {
    if (!agentId || !sessionId) return;

    setChatListDateFilter(dateFilter); // Actualizar el filtro actual

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/agents/${agentId}/chats?sessionId=${sessionId}&dateFilter=${dateFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      console.log('[AGENT-PRO] Chats recibidos (filtro:', dateFilter, '):', data);

      // Debugging: ver primer chat para entender estructura
      if (data.chats && data.chats.length > 0) {
        console.log('[AGENT-PRO] Estructura del primer chat:', data.chats[0]);
        console.log('[AGENT-PRO] Campos disponibles:', Object.keys(data.chats[0]));
      }

      if (data.success) {
        const mappedChats = (data.chats || [])
          .filter((chat: any) => chat.chatJid)
          .map((chat: any) => {
            let status: 'active' | 'closed' | 'transferred' | 'new_assignment' = 'active';
            
            // Mapear estado de DB a estado del frontend
            if (chat.status === 'pending') {
              status = 'new_assignment';
            } else if (chat.status === 'closed') {
              status = 'closed';
            } else if (chat.status === 'transferred') {
              status = 'transferred';
            } else {
              status = 'active';
            }

            return {
              id: chat.chatJid,
              name: chat.name || chat.chatJid?.replace('@s.whatsapp.net', '') || 'Sin nombre',
              avatar: chat.avatar || '',
              lastMessage: chat.lastMessage || 'Sin mensajes',
              timestamp: chat.lastMessageTimestamp || chat.assignedAt,
              unreadCount: chat.unreadCount || 0,
              assignedAt: chat.assignedAt,
              phoneNumber: chat.chatJid?.replace('@s.whatsapp.net', '') || '',
              isOnline: false,
              isTyping: false,
              status,
              closedAt: chat.closedAt
            };
          });

        console.log('[AGENT-PRO] Chats mapeados:', mappedChats.length);
        setChats(mappedChats);

        // Calcular total de no leídos
        const total = mappedChats.reduce((sum: number, chat: AgentChat) => sum + chat.unreadCount, 0);
        setUnreadTotal(total);
      }
    } catch (err) {
      console.error('Error cargando chats:', err);
      showSnackbar('Error al cargar chats', 'error');
    }
  }, [agentId, sessionId]);

  const loadMessages = useCallback(async (dateFilter: string = 'today') => {
    if (!selectedChat || !sessionId) return;

    setLoading(true);
    setMessageDateFilter(dateFilter); // Actualizar el filtro actual
    
    try {
      const token = sessionStorage.getItem('token');
      // Por defecto cargar solo mensajes de HOY para velocidad
      const response = await fetch(`/api/messages/${sessionId}/${selectedChat.id}?dateFilter=${dateFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setMessages(data.messages || []);
        console.log(`[AGENT-PRO] ✅ Mensajes cargados (${dateFilter}):`, data.messages?.length || 0);
        
        // Mostrar notificación según el filtro
        const filterNames: { [key: string]: string } = {
          today: 'de hoy',
          week: 'de la semana',
          month: 'del mes',
          all: 'todos'
        };
        showSnackbar(`Mostrando ${data.messages?.length || 0} mensajes ${filterNames[dateFilter] || ''}`, 'info');
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      showSnackbar('Error al cargar mensajes', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedChat, sessionId]);

  // ==================== EFECTOS ====================

  useEffect(() => {
    if (agentId && sessionId) {
      loadAgentChats();
    }
  }, [agentId, sessionId, loadAgentChats]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
    }
  }, [selectedChat, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ==================== SOCKET EVENTOS ====================

  useEffect(() => {
    if (!socket || !isConnected || !agentId) return;

    console.log('🔌 [AGENT-PRO] Socket conectado, escuchando eventos...');
    
    // Unirse a la sala específica del agente para recibir eventos personalizados
    if (socket) {
      socket.emit('join-agent-room', { agentId });
      console.log('🔌 [AGENT-PRO] Uniéndose a sala agent-' + agentId);
    }

    const handleNewChat = (data: any) => {
      console.log('📨 🎉 Nuevo chat asignado:', data);
      playNotificationSound();
      showDesktopNotification('✨ Nuevo chat asignado', `Chat con ${data.chatName || 'un contacto'}`);
      showSnackbar(`✨ Nuevo chat asignado: ${data.chatName || 'contacto'}`, 'success');
      setNotifications(prev => [...prev, { type: 'new_chat', data, timestamp: new Date() }]);
      
      // Actualizar el chat con estado de nueva asignación
      setChats(prevChats => {
        const existingChat = prevChats.find(c => c.id === data.chatJid);
        if (existingChat) {
          return prevChats.map(c =>
            c.id === data.chatJid ? { ...c, status: 'new_assignment' as const } : c
          );
        }
        return prevChats;
      });
      
      // Recargar chats inmediatamente
      setTimeout(() => loadAgentChats(), 500);
    };

    const handleNewMessage = (data: any) => {
      console.log('💬 [AGENT-PRO] Nuevo mensaje recibido:', data);

      // Si es del chat actual, agregar mensaje
      if (selectedChat && data.chatJid === selectedChat.id) {
        const newMsg: Message = {
          id: data.id || Date.now().toString(),
          chatJid: data.chatJid,
          senderJid: data.senderJid || data.chatJid,
          from_me: data.from_me || data.isFromMe || false,
          message_type: data.message_type || data.type || 'conversation',
          text_content: data.message || data.text_content,
          timestamp: data.timestamp || new Date().toISOString(),
          status: data.status || 'received',
          media_url: data.media_url,
          caption: data.caption,
          file_name: data.file_name,
          sender_name: data.sender_name,
          sender_avatar: data.sender_avatar,
          agent_id: data.agent_id,
          agent_name: data.agent_name  // Incluir nombre del agente
        };

        setMessages(prev => {
          // Si ya existe (mensaje temp), reemplazarlo con el real
          const existingIndex = prev.findIndex(m => 
            m.id === newMsg.id || 
            (m.id.toString().startsWith('temp-') && m.text_content === newMsg.text_content && m.chatJid === newMsg.chatJid)
          );
          
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newMsg;
            return updated;
          }
          
          return [...prev, newMsg];
        });
      }

      // Reproducir sonido solo si no es del chat actual o es mensaje entrante
      if (!selectedChat || data.chatJid !== selectedChat.id || !data.from_me) {
        playNotificationSound();
      }

      // Actualizar lista de chats
      loadAgentChats();
    };

    // Escuchar eventos específicos del agente
    on(`agent-${agentId}-new-chat`, handleNewChat);
    on(`agent-${agentId}-assignment`, handleNewChat); // Evento correcto del backend
    on('chat:assigned', handleNewChat);
    on('chat-assignment-changed', (data: any) => {
      if (data.agentId === agentId) {
        console.log('🔄 Asignación de chat cambiada');
        loadAgentChats();
      }
    });

    on('message:received', handleNewMessage);
    on('message', handleNewMessage);

    on('message-sent', (data: any) => {
      console.log('✅ [AGENT-PRO] Mensaje enviado confirmado:', data);
      if (selectedChat && data.chatJid === selectedChat.id) {
        setMessages(prev => {
          // Buscar mensaje pendiente con el mismo contenido
          const pendingIndex = prev.findIndex(msg => 
            msg.status === 'pending' && 
            msg.chatJid === data.chatJid &&
            msg.id.toString().startsWith('temp-')
          );

          if (pendingIndex >= 0) {
            const updated = [...prev];
            updated[pendingIndex] = {
              ...updated[pendingIndex],
              status: 'sent',
              id: data.id || updated[pendingIndex].id,
              agent_id: data.agent_id || updated[pendingIndex].agent_id,
              agent_name: data.agent_name || updated[pendingIndex].agent_name
            };
            return updated;
          }

          // Si no existe mensaje pendiente, agregarlo (por si acaso)
          if (!prev.some(m => m.id === data.id)) {
            return [...prev, {
              id: data.id || Date.now().toString(),
              chatJid: data.chatJid,
              senderJid: data.senderJid || sessionId,
              from_me: true,
              message_type: data.message_type || 'conversation',
              text_content: data.message || data.text_content,
              timestamp: data.timestamp || new Date().toISOString(),
              status: 'sent',
              agent_id: data.agent_id,
              agent_name: data.agent_name
            }];
          }

          return prev;
        });
      }
    });

    // Indicador de escritura
    on('user-typing', (data: any) => {
      if (selectedChat && data.chatJid === selectedChat.id) {
        setSelectedChat(prev => prev ? { ...prev, isTyping: true } : null);
        setTimeout(() => {
          setSelectedChat(prev => prev ? { ...prev, isTyping: false } : null);
        }, 3000);
      }
    });

    // 🚀 NUEVO: Escuchar cuando el admin reconecta WhatsApp
    on('session-updated', async (data: any) => {
      console.log('🔄 [AGENT-PRO] Admin reconectó WhatsApp:', data);
      showSnackbar(`Admin reconectó WhatsApp. Actualizando chats...`, 'info');

      // Actualizar sessionId local
      if (data.newSessionId) {
        setSessionId(data.newSessionId);
        setWhatsappConnected(true); // ✅ WhatsApp reconectado
        sessionStorage.setItem('adminSessionId', data.newSessionId);
        sessionStorage.setItem('whatsflow_session', data.newSessionId);
        console.log('✅ [AGENT-PRO] SessionId actualizado:', data.newSessionId);
      }

      // Recargar chats con el nuevo sessionId
      setTimeout(() => {
        loadAgentChats();
        showSnackbar('Chats actualizados correctamente', 'success');
      }, 1000);
    });

    // 🔥 Escuchar evento específico del agente cuando admin reconecta
    on(`agent-${agentId}-session-updated`, async (data: any) => {
      console.log('🔄 [AGENT-PRO] Session actualizada para este agente:', data);
      showSnackbar(`✅ ${data.message}`, 'success');

      // Actualizar sessionId local
      if (data.sessionId) {
        setSessionId(data.sessionId);
        setWhatsappConnected(true);
        sessionStorage.setItem('adminSessionId', data.sessionId);
        sessionStorage.setItem('whatsflow_session', data.sessionId);
        console.log('✅ [AGENT-PRO] SessionId actualizado a:', data.sessionId);
      }

      // Recargar chats
      setTimeout(() => {
        loadAgentChats();
      }, 500);
    });

    // 🔔 Transferencias en tiempo real
    on('chat:transferred', (data: any) => {
      console.log('📨 Chat transferido recibido:', data);
      if (data.toAgentId === agentId) {
        showDesktopNotification('📨 Chat Transferido', `Nuevo chat de ${data.chatName || 'un contacto'}`);
        showSnackbar(`Chat transferido: ${data.chatName}`, 'info');
        loadAgentChats();
      } else if (data.fromAgentId === agentId) {
        showSnackbar(`Chat transferido a otro agente`, 'info');
        setChats(prevChats => prevChats.filter(c => c.id !== data.chatJid));
        if (selectedChat?.id === data.chatJid) {
          setSelectedChat(null);
        }
      }
    });

    // 🔐 Cierre de sesión forzado por admin
    on('force-logout', (data: any) => {
      console.log('🔐 [AGENT-PRO] Cierre de sesión forzado:', data);
      
      // Verificar si este agente está en la lista de usuarios a cerrar
      const userId = parseInt(sessionStorage.getItem('userId') || '0');
      if (data.userIds && data.userIds.includes(userId)) {
        showSnackbar(`Tu administrador cerró sesión. Debes iniciar sesión nuevamente.`, 'info');
        
        // Cerrar sesión después de 3 segundos
        setTimeout(() => {
          // Limpiar sessionStorage
          sessionStorage.clear();
          localStorage.removeItem('agentDashboardTheme');
          
          // Redirigir al login
          window.location.href = '/login';
        }, 3000);
      }
    });

    return () => {
      off(`agent-${agentId}-new-chat`);
      off(`agent-${agentId}-assignment`);
      off(`agent-${agentId}-session-updated`);
      off('chat-assignment-changed');
      off('chat:assigned');
      off('message:received');
      off('message');
      off('message-sent');
      off('user-typing');
      off('session-updated');
      off('chat:transferred');
      off('force-logout');
    };
  }, [socket, isConnected, agentId, on, off, loadAgentChats, selectedChat, setSessionId]);

  // ==================== HANDLERS DE MENSAJES ====================

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !sessionId) {
      console.log('[AGENT-PRO] ⚠️ Falta información para enviar');
      return;
    }

    console.log('[AGENT-PRO] 📤 Enviando mensaje...');

    setSending(true);

    // Mensaje optimista
    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
      chatJid: selectedChat.id,
      senderJid: sessionId,
      from_me: true,
      message_type: 'conversation',
      text_content: messageText,
      timestamp: new Date().toISOString(),
      status: 'pending',
      sender_name: userName,
      agent_id: agentId,
      agent_name: userName  // Nombre del agente que envía
    };

    setMessages(prev => [...prev, tempMessage]);
    const messageToSend = messageText;
    setMessageText('');

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          chatJid: selectedChat.id,
          message: messageToSend,
          agentId: agentId
        })
      });

      const data = await response.json();
      console.log('[AGENT-PRO] 📥 Respuesta:', data);

      if (data.success) {
        console.log('[AGENT-PRO] ✅ Mensaje enviado');
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, status: 'sent', id: data.messageId || msg.id } : msg
        ));
        showSnackbar('Mensaje enviado', 'success');
      } else {
        console.error('[AGENT-PRO] ❌ Error:', data.error);
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setMessageText(messageToSend);
        showSnackbar('Error: ' + (data.error || 'No se pudo enviar'), 'error');
      }
    } catch (error: any) {
      console.error('[AGENT-PRO] ❌ Exception:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setMessageText(messageToSend);
      showSnackbar('Error de red: ' + error.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedChat || !sessionId) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log('[AGENT-PRO] 📎 Subiendo archivo:', file.name);

      // Validar tamaño (máximo 16MB)
      if (file.size > 16 * 1024 * 1024) {
        showSnackbar(`Archivo ${file.name} es muy grande (máx 16MB)`, 'error');
        continue;
      }

      // Agregar a progreso
      const uploadId = Date.now() + i;
      setUploadProgress(prev => [...prev, {
        file,
        progress: 0,
        status: 'uploading'
      }]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        formData.append('chatJid', selectedChat.id);
        formData.append('agentId', agentId?.toString() || '');
        if (file.type.startsWith('image/')) {
          formData.append('caption', messageText || '');
        }

        const token = sessionStorage.getItem('token');
        const response = await fetch('/api/messages/send-media', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await response.json();

        if (data.success) {
          console.log('[AGENT-PRO] ✅ Archivo enviado:', file.name);
          setUploadProgress(prev => prev.map(up =>
            up.file === file ? { ...up, progress: 100, status: 'complete' } : up
          ));
          showSnackbar(`Archivo ${file.name} enviado`, 'success');

          // Limpiar mensaje si era caption
          if (file.type.startsWith('image/') && messageText) {
            setMessageText('');
          }

          // Recargar mensajes
          setTimeout(() => loadMessages(), 1000);
        } else {
          throw new Error(data.error || 'Error desconocido');
        }
      } catch (error: any) {
        console.error('[AGENT-PRO] ❌ Error subiendo:', error);
        setUploadProgress(prev => prev.map(up =>
          up.file === file ? { ...up, status: 'error' } : up
        ));
        showSnackbar(`Error subiendo ${file.name}: ${error.message}`, 'error');
      }
    }

    // Limpiar input
    event.target.value = '';

    // Remover uploads completados después de 3s
    setTimeout(() => {
      setUploadProgress(prev => prev.filter(up => up.status === 'uploading'));
    }, 3000);
  };

  // ==================== HANDLERS UI ====================

  const handleChatClick = (chat: AgentChat) => {
    setSelectedChat(chat);
    setMessages([]);
    setShowChatInfo(false);
    
    // Marcar mensajes como leídos
    if (chat.unreadCount > 0) {
      setChats(prevChats => 
        prevChats.map(c => 
          c.id === chat.id ? { ...c, unreadCount: 0 } : c
        )
      );
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessageText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleLogout = () => {
    console.log('🚪 [AGENT-PRO] Cerrando sesión del agente...');

    // Desconectar socket si está conectado
    if (socket && isConnected) {
      socket.disconnect();
    }

    // Limpiar todo el almacenamiento
    sessionStorage.clear();
    localStorage.removeItem('agentDashboardTheme'); // Mantener preferencia de tema

    // Resetear estados
    setChats([]);
    setSelectedChat(null);
    setMessages([]);
    setAgentId(null);
    setSessionId(null);
    setPhoneNumber(null);

    console.log('✅ [AGENT-PRO] Sesión cerrada correctamente');

    // Redirigir a login
    navigate('/login', { replace: true });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = () => {
    showSnackbar('Recargando chats...', 'info');
    loadAgentChats();
    if (selectedChat) {
      loadMessages();
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedChat || !agentId || !sessionId) return;

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/agent/close-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agentId,
          chatJid: selectedChat.id,
          sessionId
        })
      });

      const data = await response.json();
      if (data.success) {
        showSnackbar('Conversación cerrada', 'success');
        
        // Actualizar estado del chat
        setChats(prevChats =>
          prevChats.map(chat =>
            chat.id === selectedChat.id
              ? { ...chat, status: 'closed' as const, closedAt: new Date().toISOString() }
              : chat
          )
        );
        
        // Actualizar chat seleccionado
        setSelectedChat(prev => prev ? { ...prev, status: 'closed' as const } : null);
        handleMenuClose();
      } else {
        showSnackbar(data.error || 'Error al cerrar conversación', 'error');
      }
    } catch (error) {
      console.error('Error cerrando conversación:', error);
      showSnackbar('Error al cerrar conversación', 'error');
    }
  };

  // ==================== FUNCIONES DE FORMATO ====================

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return format(date, 'HH:mm', { locale: es });
      } else if (diffInHours < 48) {
        return 'Ayer';
      } else {
        return format(date, 'dd/MM/yyyy', { locale: es });
      }
    } catch {
      return '';
    }
  };

  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: es });
    } catch {
      return '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getConversationStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return '#FFC107'; // Amarillo - conversación activa
      case 'closed':
        return '#F44336'; // Rojo - conversación cerrada
      case 'new_assignment':
        return '#4CAF50'; // Verde - nueva asignación/transferencia
      case 'transferred':
        return '#2196F3'; // Azul - transferida
      default:
        return '#FFC107'; // Amarillo por defecto
    }
  };

  const getConversationStatusTooltip = (status?: string) => {
    switch (status) {
      case 'active':
        return 'Conversación activa';
      case 'closed':
        return 'Conversación cerrada';
      case 'new_assignment':
        return 'Nueva asignación';
      case 'transferred':
        return 'Conversación transferida';
      default:
        return 'Estado desconocido';
    }
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <PendingIcon sx={{ fontSize: 14, color: '#667781' }} />;
      case 'sent':
        return <CheckIcon sx={{ fontSize: 14, color: '#667781' }} />;
      case 'delivered':
        return <DoneAllIcon sx={{ fontSize: 14, color: '#667781' }} />;
      case 'read':
        return <DoneAllIcon sx={{ fontSize: 14, color: '#53bdeb' }} />;
      case 'error':
        return <CloseIcon sx={{ fontSize: 14, color: '#f44336' }} />;
      default:
        return null;
    }
  };

  const filteredChats = chats.filter(chat => {
    // Filtro por búsqueda
    const matchesSearch = chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         chat.phoneNumber?.includes(searchTerm);

    // Filtro por tipo de chat
    const matchesFilter = chatFilter === 'all' ||
                         (chatFilter === 'unread' && chat.unreadCount > 0);

    return matchesSearch && matchesFilter;
  });

  // ==================== RENDER DE MENSAJES ====================

  const renderMessage = (msg: Message) => {
    const isMedia = ['image', 'document', 'video', 'audio', 'ptt'].includes(msg.message_type);

    return (
      <Zoom in key={msg.id}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: msg.from_me ? 'flex-end' : 'flex-start',
            mb: 1,
            px: 2
          }}
        >
          <Paper
            elevation={darkMode ? 2 : 1}
            sx={{
              maxWidth: '65%',
              minWidth: '80px',
              p: 1.5,
              bgcolor: msg.from_me ? currentTheme.bg.messageOwn : currentTheme.bg.messageOther,
              color: msg.from_me && darkMode ? '#e9edef' : currentTheme.text.primary,
              borderRadius: '4px', // Sin bordes redondeados
              boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.4)' : '0 1px 0.5px rgba(0,0,0,0.13)',
              position: 'relative'
            }}
          >
            {/* Nombre del remitente (solo en grupos o mensajes entrantes) */}
            {!msg.from_me && msg.sender_name && (
              <Typography
                variant="caption"
                sx={{
                  color: '#00a884',
                  fontWeight: 600,
                  display: 'block',
                  mb: 0.5
                }}
              >
                {msg.sender_name}
              </Typography>
            )}

            {/* Etiqueta de agente (cuando OTRO agente o admin responde, no cuando yo respondo) */}
            {msg.from_me && msg.agent_name && msg.agent_id !== agentId && (
              <Chip
                label={`Respondido por: ${msg.agent_name}`}
                size="small"
                sx={{
                  mb: 0.5,
                  height: '20px',
                  fontSize: '0.7rem',
                  bgcolor: '#00a884',
                  color: 'white',
                  '& .MuiChip-label': {
                    px: 1
                  }
                }}
              />
            )}

            {/* Contenido de media */}
            {isMedia && msg.media_url && (() => {
              const mediaUrl = msg.media_url.startsWith('http')
                ? msg.media_url
                : `${apiUrl}${msg.media_url}`;

              return (
                <Box sx={{ mb: 1 }}>
                  {msg.message_type === 'image' && (
                    <CardMedia
                      component="img"
                      image={mediaUrl}
                      alt="Imagen"
                      sx={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        objectFit: 'contain'
                      }}
                      onClick={() => window.open(mediaUrl, '_blank')}
                      onError={(e: any) => {
                        console.error('Error cargando imagen:', mediaUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}

                  {msg.message_type === 'document' && (
                    <Card sx={{ display: 'flex', alignItems: 'center', p: 1, bgcolor: darkMode ? currentTheme.bg.primary : '#f0f2f5', cursor: 'pointer' }} onClick={() => window.open(mediaUrl, '_blank')}>
                      <DocumentIcon sx={{ fontSize: 40, color: '#00a884', mr: 1 }} />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {msg.file_name || 'Documento'}
                        </Typography>
                        {msg.file_size && (
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(msg.file_size)}
                          </Typography>
                        )}
                      </Box>
                      <IconButton
                        size="small"
                        component="a"
                        href={mediaUrl}
                        download
                        target="_blank"
                        sx={{ color: '#00a884' }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Card>
                  )}

                  {msg.message_type === 'video' && (
                    <Box sx={{ position: 'relative' }}>
                      <video
                        src={mediaUrl}
                        controls
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: '4px',
                          backgroundColor: '#000'
                        }}
                        onError={(e) => {
                          console.error('Error cargando video:', mediaUrl);
                        }}
                      >
                        Tu navegador no soporta la reproducción de video.
                      </video>
                    </Box>
                  )}

                  {(msg.message_type === 'audio' || msg.message_type === 'ptt') && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 250 }}>
                      <AudioIcon sx={{ color: '#00a884' }} />
                      <audio
                        src={mediaUrl}
                        controls
                        style={{ width: '100%', height: '32px' }}
                        onError={(e) => {
                          console.error('Error cargando audio:', mediaUrl);
                        }}
                      >
                        Tu navegador no soporta la reproducción de audio.
                      </audio>
                    </Box>
                  )}
                </Box>
              );
            })()}

            {/* Texto o caption */}
            {(msg.text_content || msg.caption) && (
              <Typography
                variant="body2"
                sx={{
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  mb: 0.5
                }}
              >
                {msg.text_content || msg.caption}
              </Typography>
            )}

            {/* Timestamp y estado */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: 11, color: '#667781' }}>
                {formatMessageTime(msg.timestamp)}
              </Typography>
              {msg.from_me && getMessageStatusIcon(msg.status)}
            </Box>
          </Paper>
        </Box>
      </Zoom>
    );
  };

  // ==================== RENDER PRINCIPAL ====================

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: currentTheme.bg.primary, width: '100%', margin: 0, padding: 0 }}>
      {/* ==================== HEADER SUPERIOR MODERNO ==================== */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: currentTheme.bg.header,
          borderRadius: 0,
          width: '100%',
          zIndex: 1200,
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}
      >
        <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Logo WhatsApp y título */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
            <Box sx={{
              bgcolor: '#ffffff',
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}>
              <WhatsAppIcon sx={{ color: '#25D366', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: currentTheme.text.onHeader, lineHeight: 1.2, letterSpacing: '0.5px' }}>
                WhatsaFlow
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem' }}>
                Panel de Agente
              </Typography>
            </Box>
          </Box>

          {/* Información del agente y herramientas */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Modo oscuro/claro */}
            <Tooltip title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
              <IconButton
                color="inherit"
                size="small"
                onClick={toggleTheme}
                sx={{
                  color: 'white',
                  transition: 'transform 0.3s',
                  '&:hover': {
                    transform: 'rotate(180deg)'
                  }
                }}
              >
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            {/* Estado de conexión */}
            <Chip
              icon={whatsappConnected ? <CheckIcon /> : <CloseIcon />}
              label={whatsappConnected ? 'Conectado' : 'Desconectado'}
              size="small"
              sx={{
                bgcolor: whatsappConnected ? 'rgba(76, 175, 80, 0.25)' : 'rgba(244, 67, 54, 0.25)',
                color: 'white',
                fontWeight: 600,
                border: `1px solid ${whatsappConnected ? '#4caf50' : '#f44336'}`,
                '& .MuiChip-icon': { color: 'white' }
              }}
            />

            {/* Estadísticas rápidas */}
            <Chip
              label={`${chats.length} Chats`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.3)'
              }}
            />

            {/* Notificaciones */}
            <Tooltip title={soundEnabled ? 'Sonido activado' : 'Sonido desactivado'}>
              <IconButton
                color="inherit"
                size="small"
                onClick={() => setSoundEnabled(!soundEnabled)}
                sx={{ color: 'white' }}
              >
                <Badge badgeContent={unreadTotal} color="error">
                  {soundEnabled ? <NotificationsActiveIcon /> : <NotificationsIcon />}
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Actualizar */}
            <Tooltip title="Actualizar chats">
              <IconButton
                color="inherit"
                size="small"
                onClick={handleRefresh}
                sx={{ color: 'white' }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            {/* Perfil del agente */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1, pl: 2, borderLeft: '1px solid rgba(255,255,255,0.3)' }}>
              <Avatar
                sx={{
                  bgcolor: 'white',
                  color: '#00a884',
                  width: 36,
                  height: 36,
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              >
                {userName?.[0]?.toUpperCase() || 'A'}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, lineHeight: 1.2 }}>
                  {userName}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem' }}>
                  Agente
                </Typography>
              </Box>
            </Box>

            {/* Logout */}
            <Tooltip title="Cerrar sesión">
              <IconButton
                color="inherit"
                size="small"
                onClick={handleLogout}
                sx={{ color: 'white', ml: 1 }}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* ==================== LAYOUT PRINCIPAL ==================== */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>

        {/* ==================== PANEL IZQUIERDO: LISTA DE CHATS ==================== */}
        <Box
          sx={{
            width: chatListMinimized ? '80px' : (selectedChat ? '35%' : '100%'),
            minWidth: chatListMinimized ? '80px' : '320px',
            maxWidth: chatListMinimized ? '80px' : '500px',
            bgcolor: currentTheme.bg.secondary,
            borderRight: `1px solid ${currentTheme.border}`,
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s ease-in-out'
          }}
        >
          {/* Header del panel */}
          <Box sx={{ p: 2, bgcolor: currentTheme.bg.primary, borderBottom: `1px solid ${currentTheme.border}`, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: chatListMinimized ? 0 : 1.5 }}>
              {!chatListMinimized && (
                <Typography variant="h6" sx={{ fontWeight: 600, color: currentTheme.text.primary }}>
                  Mis Chats Asignados
                </Typography>
              )}
              <Tooltip title={chatListMinimized ? "Expandir" : "Minimizar"}>
                <IconButton
                  size="small"
                  onClick={() => setChatListMinimized(!chatListMinimized)}
                  sx={{ color: currentTheme.text.primary }}
                >
                  {chatListMinimized ? '☰' : '«'}
                </IconButton>
              </Tooltip>
            </Box>
            
            {/* Filtros de fecha para lista de chats */}
            {!chatListMinimized && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  label="Hoy"
                  size="small"
                  onClick={() => loadAgentChats('today')}
                  color={chatListDateFilter === 'today' ? 'primary' : 'default'}
                  sx={{ fontSize: '0.75rem', bgcolor: chatListDateFilter === 'today' ? '#00a884' : undefined, color: chatListDateFilter === 'today' ? 'white' : undefined }}
                />
                <Chip
                  label="Ayer"
                  size="small"
                  onClick={() => loadAgentChats('yesterday')}
                  color={chatListDateFilter === 'yesterday' ? 'primary' : 'default'}
                  sx={{ fontSize: '0.75rem', bgcolor: chatListDateFilter === 'yesterday' ? '#00a884' : undefined, color: chatListDateFilter === 'yesterday' ? 'white' : undefined }}
                />
                <Chip
                  label="Semana"
                  size="small"
                  onClick={() => loadAgentChats('week')}
                  color={chatListDateFilter === 'week' ? 'primary' : 'default'}
                  sx={{ fontSize: '0.75rem', bgcolor: chatListDateFilter === 'week' ? '#00a884' : undefined, color: chatListDateFilter === 'week' ? 'white' : undefined }}
                />
                <Chip
                  label="Mes"
                  size="small"
                  onClick={() => loadAgentChats('month')}
                  color={chatListDateFilter === 'month' ? 'primary' : 'default'}
                  sx={{ fontSize: '0.75rem', bgcolor: chatListDateFilter === 'month' ? '#00a884' : undefined, color: chatListDateFilter === 'month' ? 'white' : undefined }}
                />
                <Chip
                  label="Todos"
                  size="small"
                  onClick={() => loadAgentChats('all')}
                  color={chatListDateFilter === 'all' ? 'primary' : 'default'}
                  sx={{ fontSize: '0.75rem', bgcolor: chatListDateFilter === 'all' ? '#00a884' : undefined, color: chatListDateFilter === 'all' ? 'white' : undefined }}
                />
              </Box>
            )}
          </Box>
          
          {!chatListMinimized && (
            <Box sx={{ px: 2, pt: 2, pb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar chat o número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: currentTheme.text.secondary }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '4px',
                  bgcolor: darkMode ? currentTheme.bg.secondary : 'white',
                  color: currentTheme.text.primary,
                  '& fieldset': { borderColor: currentTheme.border },
                  '&:hover fieldset': { borderColor: '#00a884 !important' },
                  '&.Mui-focused fieldset': { borderColor: '#00a884 !important' },
                  '& input': { color: currentTheme.text.primary }
                }
              }}
            />

            {/* Pestañas de filtro de chats */}
            <Box sx={{ mt: 2 }}>
              <Tabs
                value={chatFilter}
                onChange={(e, newValue) => setChatFilter(newValue)}
                textColor="inherit"
                indicatorColor="primary"
                variant="fullWidth"
                sx={{
                  minHeight: 36,
                  '& .MuiTab-root': {
                    minHeight: 36,
                    fontSize: '0.8rem',
                    textTransform: 'none',
                    fontWeight: 500,
                    color: currentTheme.text.secondary,
                    '&.Mui-selected': {
                      color: '#00a884',
                      fontWeight: 600
                    }
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#00a884',
                    height: 2
                  }
                }}
              >
                <Tab label="Todos" value="all" />
                <Tab label="Sin leer" value="unread" />
              </Tabs>
            </Box>
          </Box>
          )}

          {/* Lista de chats */}
          <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
            {filteredChats.length === 0 ? (
              !chatListMinimized && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <ChatIcon sx={{ fontSize: 60, color: currentTheme.border, mb: 2 }} />
                  <Typography variant="body1" sx={{ color: currentTheme.text.secondary }} gutterBottom>
                    No hay chats asignados
                  </Typography>
                  <Typography variant="body2" sx={{ color: currentTheme.text.secondary }}>
                    Espera a que el admin te asigne chats
                  </Typography>
                </Box>
              )
            ) : (
              filteredChats.map((chat) => (
                <ListItem
                  key={chat.id}
                  button
                  selected={selectedChat?.id === chat.id}
                  onClick={() => handleChatClick(chat)}
                  sx={{
                    borderBottom: `1px solid ${currentTheme.border}`,
                    bgcolor: selectedChat?.id === chat.id ? currentTheme.hover : 'transparent',
                    '&:hover': { bgcolor: currentTheme.hover },
                    py: chatListMinimized ? 1 : 2,
                    px: chatListMinimized ? 1 : 2,
                    transition: 'all 0.2s',
                    justifyContent: chatListMinimized ? 'center' : 'flex-start'
                  }}
                >
                  {chatListMinimized ? (
                    // Vista minimizada: solo avatar con badge
                    <Tooltip title={`${chat.name}${chat.unreadCount > 0 ? ` (${chat.unreadCount})` : ''}\n${getConversationStatusTooltip(chat.status)}`} placement="right">
                      <Box position="relative">
                        <Badge
                          badgeContent={chat.unreadCount}
                          color="error"
                          overlap="circular"
                        >
                          <Avatar
                            src={chat.avatar}
                            alt={chat.name}
                            sx={{ 
                              width: 48, 
                              height: 48,
                              border: `3px solid ${getAvatarColor(chat.name || chat.phoneNumber || 'unknown')}`,
                              boxShadow: `0 0 0 2px ${currentTheme.bg.secondary}`
                            }}
                          >
                            {chat.name?.[0]?.toUpperCase() || '?'}
                          </Avatar>
                        </Badge>
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            backgroundColor: getConversationStatusColor(chat.status),
                            border: `2px solid ${currentTheme.bg.secondary}`,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            zIndex: 1
                          }}
                        />
                      </Box>
                    </Tooltip>
                  ) : (
                    // Vista expandida: avatar + info
                    <>
                      <ListItemAvatar>
                        <Box position="relative">
                          {chat.unreadCount > 0 ? (
                            <Badge
                              badgeContent={chat.unreadCount}
                              color="error"
                              overlap="circular"
                              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                            >
                              <Avatar
                                src={chat.avatar}
                                alt={chat.name}
                                sx={{ 
                                  width: 50, 
                                  height: 50,
                                  border: `3px solid ${getAvatarColor(chat.name || chat.phoneNumber || 'unknown')}`,
                                  boxShadow: `0 0 0 2px ${currentTheme.bg.secondary}`
                                }}
                              >
                                {chat.name?.[0]?.toUpperCase() || '?'}
                              </Avatar>
                            </Badge>
                          ) : (
                            <Avatar
                              src={chat.avatar}
                              alt={chat.name}
                              sx={{ 
                                width: 50, 
                                height: 50,
                                border: `3px solid ${getAvatarColor(chat.name || chat.phoneNumber || 'unknown')}`,
                                boxShadow: `0 0 0 2px ${currentTheme.bg.secondary}`
                              }}
                            >
                              {chat.name?.[0]?.toUpperCase() || '?'}
                            </Avatar>
                          )}
                          <Tooltip title={getConversationStatusTooltip(chat.status)} arrow>
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                backgroundColor: getConversationStatusColor(chat.status),
                                border: `2px solid ${currentTheme.bg.secondary}`,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                zIndex: 1
                              }}
                            />
                          </Tooltip>
                        </Box>
                      </ListItemAvatar>
                      <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography
                          variant="subtitle1"
                          fontWeight={chat.unreadCount > 0 ? 600 : 400}
                          sx={{ color: currentTheme.text.primary }}
                        >
                          {chat.name || chat.phoneNumber}
                        </Typography>
                        <Typography variant="caption" sx={{ color: currentTheme.text.secondary }}>
                          {formatTime(chat.timestamp)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: chat.unreadCount > 0 ? 500 : 400,
                            fontStyle: chat.isTyping ? 'italic' : 'normal',
                            color: chat.isTyping ? '#00a884' : currentTheme.text.secondary
                          }}
                        >
                          {chat.isTyping ? 'Escribiendo...' : (chat.lastMessage || 'Sin mensajes')}
                        </Typography>
                      </Box>
                    }
                      />
                    </>
                  )}
                </ListItem>
              ))
            )}
          </List>
        </Box>

        {/* ==================== PANEL DERECHO: CHAT SELECCIONADO ==================== */}
        {selectedChat ? (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: currentTheme.bg.chat, position: 'relative' }}>
            {/* Header del chat */}
            <Paper
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                bgcolor: currentTheme.bg.primary,
                borderBottom: `1px solid ${currentTheme.border}`,
                zIndex: 10,
                boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              <Avatar
                src={selectedChat.avatar}
                sx={{ width: 45, height: 45, mr: 2, border: '2px solid #00a884' }}
              >
                {selectedChat.name?.[0]?.toUpperCase() || '?'}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: currentTheme.text.primary }}>
                  {selectedChat.name || 'Sin nombre'}
                </Typography>
                <Typography variant="caption" sx={{ color: currentTheme.text.secondary }}>
                  {selectedChat.phoneNumber || selectedChat.id.replace('@s.whatsapp.net', '')}
                </Typography>
                {selectedChat.isTyping && (
                  <Typography variant="caption" sx={{ color: '#00a884', fontStyle: 'italic' }}>
                    <> • Escribiendo...</>
                  </Typography>
                )}
              </Box>

              {/* Botones de acción */}
              <Tooltip title="Información del contacto">
                <IconButton onClick={() => setShowChatInfo(!showChatInfo)}>
                  <InfoIcon sx={{ color: currentTheme.text.primary }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Más opciones">
                <IconButton onClick={handleMenuOpen}>
                  <MoreIcon sx={{ color: currentTheme.text.primary }} />
                </IconButton>
              </Tooltip>
            </Paper>

            {/* Menú de opciones */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => { loadMessages('today'); handleMenuClose(); }}>
                <RefreshIcon sx={{ mr: 1 }} /> Mensajes de hoy
              </MenuItem>
              <MenuItem onClick={() => { loadMessages('week'); handleMenuClose(); }}>
                <PendingIcon sx={{ mr: 1 }} /> Última semana
              </MenuItem>
              <MenuItem onClick={() => { loadMessages('month'); handleMenuClose(); }}>
                <PendingIcon sx={{ mr: 1 }} /> Este mes
              </MenuItem>
              <MenuItem onClick={() => { loadMessages('all'); handleMenuClose(); }}>
                <PendingIcon sx={{ mr: 1 }} /> Todos los mensajes
              </MenuItem>
              <Divider />
              <MenuItem 
                onClick={handleCloseConversation}
                disabled={selectedChat?.status === 'closed'}
              >
                <BlockIcon sx={{ mr: 1 }} /> 
                {selectedChat?.status === 'closed' ? 'Conversación cerrada' : 'Cerrar conversación'}
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); }}>
                <ArchiveIcon sx={{ mr: 1 }} /> Archivar chat
              </MenuItem>
            </Menu>

            {/* Indicador de filtro de fecha */}
            {messageDateFilter !== 'all' && (
              <Box 
                sx={{ 
                  p: 1, 
                  textAlign: 'center', 
                  bgcolor: currentTheme.bg.secondary,
                  borderBottom: `1px solid ${currentTheme.border}`
                }}
              >
                <Chip
                  size="small"
                  icon={<PendingIcon sx={{ fontSize: 16 }} />}
                  label={
                    messageDateFilter === 'today' ? '📅 Mostrando mensajes de hoy' :
                    messageDateFilter === 'week' ? '📅 Mostrando última semana' :
                    messageDateFilter === 'month' ? '📅 Mostrando este mes' : ''
                  }
                  sx={{ 
                    bgcolor: '#00a884', 
                    color: 'white',
                    fontWeight: 500,
                    fontSize: '0.75rem'
                  }}
                  onDelete={() => {
                    loadMessages('all');
                  }}
                  deleteIcon={<CloseIcon sx={{ color: 'white !important', fontSize: 16 }} />}
                />
              </Box>
            )}

            {/* Área de mensajes */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                p: 2,
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpattern id=\'pattern\' x=\'0\' y=\'0\' width=\'20\' height=\'20\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23d9d9d9\' opacity=\'0.3\'/%3E%3C/pattern%3E%3Crect x=\'0\' y=\'0\' width=\'100%25\' height=\'100%25\' fill=\'url(%23pattern)\'/%3E%3C/svg%3E")',
                backgroundSize: 'contain'
              }}
            >
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress sx={{ color: '#00a884' }} />
                </Box>
              ) : messages.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%" flexDirection="column">
                  <ChatIcon sx={{ fontSize: 80, color: '#d1d7db', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No hay mensajes {
                      messageDateFilter === 'today' ? 'hoy' :
                      messageDateFilter === 'week' ? 'esta semana' :
                      messageDateFilter === 'month' ? 'este mes' :
                      'en este chat'
                    }
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {messageDateFilter !== 'all' && 'Usa el menú (⋮) para ver otros períodos'}
                  </Typography>
                </Box>
              ) : (
                messages.map(renderMessage)
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Progreso de subida */}
            {uploadProgress.length > 0 && (
              <Box sx={{ px: 2, py: 1, bgcolor: '#f0f2f5' }}>
                {uploadProgress.map((upload, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption">
                        {upload.file.name}
                      </Typography>
                      <Typography variant="caption" color={upload.status === 'error' ? 'error' : 'text.secondary'}>
                        {upload.status === 'uploading' ? `${upload.progress}%` :
                         upload.status === 'complete' ? 'Completado' : 'Error'}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant={upload.status === 'uploading' ? 'determinate' : 'indeterminate'}
                      value={upload.progress}
                      color={upload.status === 'error' ? 'error' : 'primary'}
                    />
                  </Box>
                ))}
              </Box>
            )}

            {/* Área de envío */}
            <Paper
              elevation={darkMode ? 2 : 3}
              sx={{
                p: 1.5,
                display: 'flex',
                gap: 1,
                alignItems: 'flex-end',
                bgcolor: currentTheme.bg.primary,
                borderTop: `1px solid ${currentTheme.border}`,
                boxShadow: darkMode ? '0 -2px 4px rgba(0,0,0,0.3)' : '0 -1px 2px rgba(0,0,0,0.1)'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              <Tooltip title={selectedChat?.status === 'closed' ? 'Conversación cerrada' : 'Emojis'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    sx={{ color: currentTheme.text.secondary }}
                    disabled={selectedChat?.status === 'closed'}
                  >
                    <EmojiIcon />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={selectedChat?.status === 'closed' ? 'Conversación cerrada' : 'Adjuntar archivo'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ color: currentTheme.text.secondary }}
                    disabled={selectedChat?.status === 'closed'}
                  >
                    <AttachFileIcon />
                  </IconButton>
                </span>
              </Tooltip>

              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={selectedChat?.status === 'closed' ? 'Conversación cerrada' : 'Escribe un mensaje...'}
                size="small"
                disabled={selectedChat?.status === 'closed'}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && selectedChat?.status !== 'closed') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '4px',
                    bgcolor: darkMode ? currentTheme.bg.secondary : 'white',
                    color: currentTheme.text.primary,
                    '& fieldset': { borderColor: currentTheme.border },
                    '&:hover fieldset': { borderColor: '#00a884' },
                    '&.Mui-focused fieldset': { borderColor: '#00a884' }
                  },
                  '& textarea': { color: currentTheme.text.primary }
                }}
              />

              <Tooltip title={
                selectedChat?.status === 'closed' 
                  ? 'Conversación cerrada. Solicita al admin que la transfiera de nuevo.' 
                  : messageText.trim() ? 'Enviar mensaje' : 'Escribe un mensaje primero'
              }>
                <span>
                  <IconButton
                    onClick={handleSendMessage}
                    disabled={sending || !messageText.trim() || selectedChat?.status === 'closed'}
                    sx={{
                      bgcolor: messageText.trim() && !sending && selectedChat?.status !== 'closed' ? '#00a884' : '#e9edef',
                      color: messageText.trim() && !sending && selectedChat?.status !== 'closed' ? 'white' : '#667781',
                      '&:hover': {
                        bgcolor: messageText.trim() && !sending && selectedChat?.status !== 'closed' ? '#008c6d' : '#e9edef'
                      },
                      '&:disabled': { bgcolor: '#e9edef', color: '#667781' },
                      width: 48,
                      height: 48
                    }}
                  >
                    {sending ? <CircularProgress size={24} sx={{ color: '#667781' }} /> : <SendIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Paper>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <Fade in={showEmojiPicker}>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 80,
                    left: 20,
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </Box>
              </Fade>
            )}

            {/* Panel de información del chat */}
            {showChatInfo && (
              <Fade in={showChatInfo}>
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '350px',
                    bgcolor: 'white',
                    boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
                    zIndex: 999,
                    overflowY: 'auto',
                    borderLeft: '1px solid #d1d7db'
                  }}
                >
                  <Box sx={{ p: 3 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" fontWeight={600}>
                        Información del contacto
                      </Typography>
                      <IconButton size="small" onClick={() => setShowChatInfo(false)}>
                        <CloseIcon />
                      </IconButton>
                    </Box>

                    {/* Avatar y nombre */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                      <Avatar
                        src={selectedChat.avatar}
                        sx={{ width: 100, height: 100, mb: 2, border: '3px solid #00a884' }}
                      >
                        {selectedChat.name?.[0]?.toUpperCase() || '?'}
                      </Avatar>
                      <Typography variant="h6" fontWeight={600} gutterBottom>
                        {selectedChat.name || 'Sin nombre'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedChat.phoneNumber || 'Sin número'}
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Información adicional */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Información del chat
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          Asignado el {format(new Date(selectedChat.assignedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <ChatIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {messages.length} mensajes en total
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Acciones */}
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Acciones
                      </Typography>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => loadMessages(messageDateFilter)}
                        sx={{ mb: 1, justifyContent: 'flex-start' }}
                      >
                        Recargar mensajes
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ArchiveIcon />}
                        sx={{ mb: 1, justifyContent: 'flex-start' }}
                      >
                        Archivar chat
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Fade>
            )}
          </Box>
        ) : (
          // Pantalla de bienvenida
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: currentTheme.bg.chat,
              background: darkMode 
                ? 'linear-gradient(135deg, #0b141a 0%, #111b21 100%)'
                : 'linear-gradient(135deg, #f0f2f5 0%, #e4e9eb 100%)'
            }}
          >
            <Fade in timeout={800}>
              <Box sx={{ textAlign: 'center' }}>
                <ChatIcon sx={{ fontSize: 120, color: darkMode ? '#2a3942' : '#d1d7db', mb: 3 }} />
                <Typography variant="h4" sx={{ color: currentTheme.text.primary }} gutterBottom fontWeight={600}>
                  WhatsFlow Panel de Agente
                </Typography>
                <Typography variant="h6" sx={{ color: currentTheme.text.secondary }} gutterBottom>
                  Selecciona un chat para comenzar a responder
                </Typography>
                <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Chip
                    label={`${chats.length} chats asignados`}
                    color="primary"
                    size="medium"
                    icon={<ChatIcon />}
                  />
                  <Chip
                    label={`${unreadTotal} sin leer`}
                    color="error"
                    size="medium"
                    icon={<NotificationsIcon />}
                  />
                  <Chip
                    label={isConnected ? 'Conectado' : 'Desconectado'}
                    color={isConnected ? 'success' : 'error'}
                    size="medium"
                    icon={isConnected ? <CheckIcon /> : <CloseIcon />}
                  />
                </Box>
              </Box>
            </Fade>
          </Box>
        )}
      </Box>

      {/* ==================== SNACKBAR DE NOTIFICACIONES ==================== */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* ==================== ESTILOS CSS ADICIONALES ==================== */}
      <style>{`
        @keyframes ripple {
          0% {
            transform: scale(.8);
            opacity: 1;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
      `}</style>
    </Box>
  );
};

export default AgentDashboardPro;
