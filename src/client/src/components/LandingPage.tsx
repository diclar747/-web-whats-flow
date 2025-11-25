import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getSocketURL, getAPIBaseURL } from '../utils/socketConfig';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Badge,
  Fab,
  Menu,
  MenuItem,
  InputAdornment,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  WhatsApp,
  Send,
  Campaign,
  Analytics,
  People,
  Schedule,
  Settings,
  Notifications,
  Refresh,
  Add,
  QrCode,
  Message,
  TrendingUp,
  CheckCircle,
  Schedule as ScheduleIcon,
  AttachFile as AttachFileIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  EmojiEmotions as EmojiIcon,
  Mic as MicIcon,
  DoneAll as DoneAllIcon,
  Check as CheckIcon,
  Phone,
  VideoCall,
  PushPin,
  Person,
  Archive,
  Delete,
} from '@mui/icons-material';
import { whatsappAPI, initializeSocket } from '../services/api';

interface Message {
  id: string;
  from: string;
  to?: string;
  message: string;
  timestamp: string;
  type: string;
  isFromMe: boolean;
}

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  avatar?: string;
  isGroup: boolean;
  isOnline?: boolean;
}

interface LandingPageProps {
  onQRSuccess: (sessionId: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onQRSuccess }) => {
  const navigate = useNavigate();
  const socketRef = useRef<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  // Sesión que este navegador inició (para evitar tomar sesiones ajenas)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');

  // Chat state
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [contextMenuChatId, setContextMenuChatId] = useState<string | null>(null);
  const [contextMenuAnchorEl, setContextMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Auto scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // VERIFICAR SI YA HAY SESIÓN ACTIVA AL CARGAR + POLLING COMO RESPALDO
  useEffect(() => {
    const checkExistingSession = async () => {
      const savedSession = sessionStorage.getItem('whatsflow_session');
      const deviceId = sessionStorage.getItem('whatsflow_device_id');

      // Primero verificar si hay sesión por deviceId (más confiable)
      if (deviceId && !isConnected) {
        console.log('[LANDING] Verificando sesión por deviceId...');
        try {
          const deviceResponse = await fetch(`${getAPIBaseURL()}/api/session/check-by-device`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-device-id': deviceId
            },
            body: JSON.stringify({ deviceId })
          });

          if (deviceResponse.ok) {
            const deviceData = await deviceResponse.json();
            if (deviceData.success && deviceData.isConnected) {
              const foundSessionId = deviceData.phoneNumber || deviceData.sessionId;
              console.log('✅ [LANDING] Sesión activa encontrada por deviceId:', foundSessionId);
              setIsConnected(true);
              setSessionId(foundSessionId);
              sessionStorage.setItem('whatsflow_session', foundSessionId);
              onQRSuccess(foundSessionId);
              navigate('/dashboard', { replace: true });
              return;
            }
          }
        } catch (error) {
          console.log('[LANDING] No se encontró sesión por deviceId:', error);
        }
      }

      // Si no encontró por deviceId, verificar savedSession
      if (savedSession && !isConnected) {
        console.log('[LANDING] Verificando sesión guardada:', savedSession);
        try {
          const response = await fetch(`${getAPIBaseURL()}/api/session/${savedSession}/status`, {
            headers: {
              'x-device-id': deviceId || '',
              'x-session-token': sessionStorage.getItem('whatsflow_session_token') || ''
            }
          });
          const data = await response.json();

          if (data.success && data.isConnected) {
            console.log('✅ [LANDING] Sesión ya conectada, redirigiendo al dashboard...');
            setIsConnected(true);
            setSessionId(savedSession);
            onQRSuccess(savedSession);
            navigate('/dashboard', { replace: true });
          } else {
            console.log('⚠️ [LANDING] Sesión guardada no está conectada');
            sessionStorage.removeItem('whatsflow_session');
          }
        } catch (error) {
          console.error('[LANDING] Error verificando sesión guardada:', error);
        }
      }
    };

    checkExistingSession();

    // POLLING agresivo: verificar is_active en DB cada 2 segundos
    const intervalCheck = setInterval(async () => {
      if (isConnected) {
        clearInterval(intervalCheck);
        return;
      }

      try {
        const currentDeviceId = sessionStorage.getItem('whatsflow_device_id') || '';
        const savedToken = sessionStorage.getItem('whatsflow_token') || '';

        // 1. Primero intentar con pendingSessionId si existe
        if (pendingSessionId) {
          const response = await fetch(`${getAPIBaseURL()}/api/session/${pendingSessionId}/status`, {
            headers: {
              'x-device-id': currentDeviceId,
              'x-session-token': savedToken
            }
          });
          const data = await response.json();

          console.log('[LANDING-POLLING-PENDING] Respuesta:', data);

          if (data.success && data.isConnected) {
            console.log('✅ [LANDING-POLLING] Sesión conectada detectada!');
            const finalSessionId = data.phoneNumber || data.sessionId || pendingSessionId;
            console.log('📱 [LANDING-POLLING] Guardando sessionId:', finalSessionId);

            setIsConnected(true);
            setSessionId(finalSessionId);
            setShowQRModal(false);
            setLoading(false);
            sessionStorage.setItem('whatsflow_session', finalSessionId);

            onQRSuccess(finalSessionId);
            navigate('/dashboard', { replace: true });
            clearInterval(intervalCheck);
            return;
          }
        }

        // 2. Si no hay pendingSessionId o no se encontró, buscar por deviceId
        // Esto detectará la sesión que acaba de conectarse incluso si no conocemos su ID
        const checkResponse = await fetch(`${getAPIBaseURL()}/api/session/check-by-device`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': currentDeviceId
          },
          body: JSON.stringify({ deviceId: currentDeviceId })
        });

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          console.log('[LANDING-POLLING-DEVICE] Respuesta:', checkData);

          if (checkData.success && checkData.isConnected) {
            console.log('✅ [LANDING-POLLING-DEVICE] Sesión activa encontrada por deviceId!');
            const finalSessionId = checkData.phoneNumber || checkData.sessionId;

            setIsConnected(true);
            setSessionId(finalSessionId);
            setShowQRModal(false);
            setLoading(false);
            sessionStorage.setItem('whatsflow_session', finalSessionId);

            onQRSuccess(finalSessionId);
            navigate('/dashboard', { replace: true });
            clearInterval(intervalCheck);
          }
        }
      } catch (e) {
        console.error('[LANDING-POLLING] Error:', e);
      }
    }, 2000);

    return () => clearInterval(intervalCheck);
  }, [isConnected, pendingSessionId, navigate, onQRSuccess]);

  // POLLING ELIMINADO POR SEGURIDAD
  // El polling anterior buscaba cualquier sesión activa (de cualquier usuario)
  // Ahora la conexión se detecta solo via Socket.IO cuando EL USUARIO escanea su propio QR
  // useEffect para escuchar eventos de Socket.IO ya maneja la conexión correctamente

  // VERIFICACIÓN: Solo permitir conexión de la sesión iniciada por este navegador
  useEffect(() => {
    let check: ReturnType<typeof setInterval> | undefined;
    if (!isConnected && showQRModal && pendingSessionId) {
      check = setInterval(async () => {
        try {
          const response = await fetch(`${getAPIBaseURL()}/api/session/${pendingSessionId}/status`);
          const data = await response.json();
          if (data.success && data.isConnected) {
            const finalSessionId = data.phoneNumber || pendingSessionId;
            setIsConnected(true);
            setSessionId(finalSessionId);
            setShowQRModal(false);
            setLoading(false);
            sessionStorage.setItem('whatsflow_session', finalSessionId);
            onQRSuccess(finalSessionId);
            if (check) clearInterval(check);
          }
        } catch { }
      }, 1500);
    }
    return () => { if (check) clearInterval(check); };
  }, [isConnected, showQRModal, pendingSessionId, onQRSuccess]);

  // Socket setup
  useEffect(() => {
    const socketURL = getSocketURL();
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket conectado');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket desconectado');
    });

    // Evento GLOBAL de conexión exitosa (filtrado por pendingSessionId)
    newSocket.on('connection-update', (data: any) => {
      console.log('🔥 [LANDING] Conexión exitosa detectada:', data);
      console.log('🔥 [LANDING] Status:', data.status, 'SessionId:', data.sessionId, 'PhoneNumber:', data.phoneNumber);
      console.log('🔥 [LANDING] PendingSessionId actual:', pendingSessionId);

      // Solo aceptar si corresponde a la sesión que ESTE navegador inició
      const isOurSession = !!pendingSessionId && (
        data.sessionId === pendingSessionId || data.oldSessionId === pendingSessionId
      );

      console.log('🔥 [LANDING] ¿Es nuestra sesión?:', isOurSession);

      if (data.status === 'connected' && (data.sessionId || data.phoneNumber)) {
        // Solo aceptar si corresponde a la sesión que ESTE navegador inició
        // CRÍTICO: Si no hay pendingSessionId, IGNORAR el evento (es de otro usuario)
        if (pendingSessionId && isOurSession) {
          // USAR EL NÚMERO DE TELÉFONO si está disponible, sino usar sessionId
          const finalSessionId = data.phoneNumber || data.sessionId;
          console.log(`📱 [LANDING] Guardando sesión: ${finalSessionId}`);

          setIsConnected(true);
          setSessionId(finalSessionId);
          setShowQRModal(false);
          setLoading(false);

          // Limpiar cualquier información de sesión previa de otros usuarios
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('whatsflow_token');
          sessionStorage.removeItem('userRole');
          sessionStorage.removeItem('userId');
          sessionStorage.removeItem('userName');
          sessionStorage.removeItem('userEmail');

          console.log('📱 [LANDING] Llamando onQRSuccess con:', finalSessionId);
          onQRSuccess(finalSessionId);

          // Redirigir al dashboard INMEDIATAMENTE - SIN TIMEOUT
          console.log('✅ [LANDING] Redirigiendo al dashboard AHORA...');
          navigate('/dashboard', { replace: true });
          console.log('🚀 [LANDING] Navegación ejecutada');
        } else {
          console.log('🛡️ [LANDING] Ignorando evento de conexión ajeno (pendingSessionId:', pendingSessionId, ')');
        }
      } else if (data.status === 'disconnected') {
        console.log('📱 WhatsApp desconectado, redirigiendo al inicio...');
        setIsConnected(false);
        setSessionId(null);
        setQrDataUrl(null);
        // Limpiar localStorage
        localStorage.removeItem('whatsflow_session');
        localStorage.removeItem('whatsflow_user_type');
        // Limpiar cualquier información de usuario también en desconexión
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('whatsflow_token');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('userEmail');
        // La redirección se manejará automáticamente por el App.tsx
      }
    });

    // Evento específico de WhatsApp conectado (filtrado por pendingSessionId)
    newSocket.on('whatsapp-connected', (data: any) => {
      console.log('✅ [LANDING] WhatsApp conectado exitosamente:', data);
      console.log('✅ [LANDING] SessionId:', data.sessionId, 'PhoneNumber:', data.phoneNumber);

      // Solo aceptar si corresponde a la sesión que ESTE navegador inició
      if (!pendingSessionId || (data.sessionId !== pendingSessionId)) {
        console.log('⏭️ [LANDING] Ignorando whatsapp-connected de otra sesión');
        return;
      }

      // USAR EL NÚMERO DE TELÉFONO si está disponible, sino usar sessionId
      const finalSessionId = data.phoneNumber || data.sessionId;
      console.log(`📱 [LANDING] Guardando sesión (whatsapp-connected): ${finalSessionId}`);

      setIsConnected(true);
      setSessionId(finalSessionId);
      setShowQRModal(false);
      setLoading(false);

      console.log('📱 [LANDING] Llamando onQRSuccess con:', finalSessionId);
      onQRSuccess(finalSessionId);

      // Redirigir al dashboard INMEDIATAMENTE - SIN TIMEOUT
      console.log('✅ [LANDING] Redirigiendo al dashboard AHORA (whatsapp-connected)...');
      navigate('/dashboard', { replace: true });
      console.log('🚀 [LANDING] Navegación ejecutada (whatsapp-connected)');
    });

    // Evento de QR generado
    newSocket.on('qr-code', (data: any) => {
      console.log('📱 QR Code recibido:', data);
      if (data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setLoading(false);
      }
    });

    // Escuchar nuevos mensajes
    newSocket.on('message-real', (message: any) => {
      console.log('📨 Nuevo mensaje recibido:', message);
      const mappedMessage: Message = {
        id: message.id || Date.now().toString(),
        from: message.from,
        to: message.to,
        message: message.message,
        timestamp: message.timestamp || new Date().toISOString(),
        type: message.type || 'text',
        isFromMe: false
      };
      setMessages(prev => [...prev, mappedMessage]);
      updateChatWithNewMessage(mappedMessage);
    });

    return () => {
      console.log('[LANDING] Desconectando socket...');
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar una vez al montar el componente

  const fetchQR = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Creando nueva sesión de WhatsApp...');

      // Leer preferencia de sincronización desde localStorage
      const syncHistory = localStorage.getItem('whatsflow_sync_history') === 'true';
      console.log('📊 Sincronización de historial:', syncHistory ? 'ACTIVADA' : 'DESACTIVADA');

      const baseURL = getAPIBaseURL();
      // Vincular esta creación de sesión al dispositivo/navegador
      let deviceId = sessionStorage.getItem('whatsflow_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('whatsflow_device_id', deviceId);
      }

      const response = await fetch(`${baseURL}/api/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncHistory, deviceId })
      });

      const data = await response.json();
      console.log('📱 Respuesta sesión:', data);

      if (data.success) {
        if (data.isConnected) {
          setIsConnected(true);
          setSessionId(data.sessionId);
          setLoading(false);
          setShowQRModal(false);
          onQRSuccess(data.sessionId);

          // Redirigir al dashboard INMEDIATAMENTE
          console.log('✅ Ya está conectado, redirigiendo al dashboard...');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 500);
          return;
        }

        // Sesión creada, esperando QR: unirse a la sala de la sesión
        console.log('✅ Sesión creada, esperando código QR...');
        setPendingSessionId(data.sessionId);
        setSessionId(data.sessionId);
        socketRef.current?.emit('join-session', { sessionId: data.sessionId });
        setShowQRModal(true);
      } else {
        setError(data.error || 'Error al crear sesión');
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error:', err);
      setError('Error de conexión');
      setLoading(false);
    }
  };

  const loadRealChats = async (currentSessionId?: string) => {
    const useSessionId = currentSessionId || sessionId;
    if (!useSessionId) return;

    setLoadingChats(true);
    try {
      console.log('📋 Cargando chats reales...');
      const baseURL = getAPIBaseURL();
      const response = await fetch(`${baseURL}/api/chats/${useSessionId}`);
      const data = await response.json();
      console.log('📋 Respuesta chats:', data);

      if (data.success && data.chats) {
        const realChats: Chat[] = Object.values(data.chats).map((chat: any) => ({
          id: chat.id,
          name: chat.subject || chat.name || chat.id.split('@')[0],
          isGroup: chat.id.includes('@g.us'),
          lastMessage: 'Haz clic para cargar mensajes',
          timestamp: new Date().toISOString(),
          isOnline: false
        }));

        setChats(realChats);
        console.log('✅ Chats cargados:', realChats.length);
      } else {
        // Crear chats de prueba si no hay reales
        const testChats: Chat[] = [
          {
            id: 'test1@c.us',
            name: 'Chat de Prueba',
            isGroup: false,
            lastMessage: 'Envía un mensaje para probar',
            timestamp: new Date().toISOString(),
            isOnline: true
          }
        ];
        setChats(testChats);
      }
    } catch (error) {
      console.error('❌ Error cargando chats:', error);
      setError('Error al cargar chats');
    } finally {
      setLoadingChats(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!sessionId) return;

    try {
      console.log('💬 Cargando mensajes para:', chatId);
      const baseURL = getAPIBaseURL();
      const response = await fetch(`${baseURL}/api/messages/${sessionId}?number=${chatId}`);
      const data = await response.json();
      console.log('💬 Respuesta mensajes:', data);

      if (data.success && data.messages) {
        const mappedMessages = data.messages.map((msg: any) => ({
          ...msg,
          isFromMe: msg.from === 'me' || msg.type === 'sent'
        }));
        setMessages(mappedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ Error cargando mensajes:', error);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !sessionId || sendingMessage) return;

    setSendingMessage(true);
    const messageText = newMessage;
    setNewMessage('');

    // Agregar mensaje inmediatamente a la UI
    const tempMessage: Message = {
      id: Date.now().toString(),
      from: 'me',
      to: activeChat.id,
      message: messageText,
      timestamp: new Date().toISOString(),
      type: 'text',
      isFromMe: true
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      console.log('📤 Enviando mensaje:', messageText, 'a:', activeChat.id);

      const baseURL = getAPIBaseURL();
      const response = await fetch(`${baseURL}/api/send/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          number: activeChat.id,
          message: messageText
        })
      });

      const data = await response.json();
      console.log('📤 Respuesta envío:', data);

      if (data.success) {
        updateChatWithNewMessage(tempMessage);
      } else {
        console.error('❌ Error enviando:', data.error);
        // Remover mensaje si falló
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setError('Error al enviar mensaje: ' + (data.error || 'Error desconocido'));
        setNewMessage(messageText); // Restaurar mensaje
      }
    } catch (error) {
      console.error('❌ Error de red:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setError('Error de conexión al enviar mensaje');
      setNewMessage(messageText); // Restaurar mensaje
    } finally {
      setSendingMessage(false);
    }
  };

  const updateChatWithNewMessage = (message: Message) => {
    setChats(prev => prev.map(chat =>
      chat.id === (message.isFromMe ? message.to : message.from)
        ? { ...chat, lastMessage: message.message, timestamp: message.timestamp }
        : chat
    ));
  };

  const handleChatSelect = (chat: Chat) => {
    console.log('👆 Chat seleccionado:', chat.name);
    setActiveChat(chat);
    loadMessages(chat.id);
    setContextMenuChatId(null); // Cerrar menú contextual si estuviera abierto
  };

  const handleOpenChatContextMenu = (event: React.MouseEvent<HTMLElement>, chatId: string) => {
    event.stopPropagation(); // Evitar que se seleccione el chat al abrir el menú
    setContextMenuChatId(chatId);
    setContextMenuAnchorEl(event.currentTarget);
  };

  const handleCloseChatContextMenu = () => {
    setContextMenuChatId(null);
    setContextMenuAnchorEl(null);
  };

  const handleConnect = () => {
    // Prevenir múltiples llamadas si ya está cargando o conectado
    if (loading || isConnected || showQRModal) {
      console.log('⚠️ [LANDING] Ya hay una conexión en proceso, ignorando...');
      return;
    }
    console.log('🔄 [LANDING] Iniciando conexión...');
    setShowQRModal(true);
    fetchQR();
  };

  const TabPanel = ({ children, value, index }: any) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // StyleSheet para mostrar el botón de opciones del chat al hacer hover sobre el ListItem
  const styles = `
    .MuiListItemButton-root:hover .chat-options-button {
      visibility: visible !important;
    }
  `;

  if (!isConnected) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#F0F2F5' }}>
        {/* Landing Content */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 6,
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
            pointerEvents: 'none'
          }
        }}>
          <Box sx={{ textAlign: 'center', color: 'white', position: 'relative', zIndex: 1, maxWidth: 700, px: 3 }}>
            <Box sx={{
              display: 'inline-block',
              bgcolor: 'rgba(255,255,255,0.15)',
              borderRadius: 4,
              p: 3,
              mb: 4,
              backdropFilter: 'blur(10px)'
            }}>
              <WhatsApp sx={{ fontSize: 80, opacity: 1 }} />
            </Box>

            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                mb: 2,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                letterSpacing: '-0.02em',
                textShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}
            >
              WhatsFlow
            </Typography>

            <Typography
              variant="h5"
              sx={{
                mb: 5,
                opacity: 0.95,
                fontWeight: 400,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.95)',
                maxWidth: 600,
                mx: 'auto'
              }}
            >
              Gestiona tu comunicación de WhatsApp desde tu computadora con todas las funciones empresariales
            </Typography>

            <Box sx={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              flexWrap: 'wrap',
              mb: 4
            }}>
              <Chip
                icon={<CheckCircle />}
                label="Mensajes en tiempo real"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  py: 2.5,
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              <Chip
                icon={<CheckCircle />}
                label="Sincronización automática"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  py: 2.5,
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              <Chip
                icon={<CheckCircle />}
                label="100% Seguro y privado"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  py: 2.5,
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
            </Box>

            {/* Lista de módulos */}
            <Box sx={{
              maxWidth: 600,
              mx: 'auto',
              mb: 4,
              bgcolor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: 3,
              p: 3
            }}>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Message sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Chat en Tiempo Real</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Campaign sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Campañas Masivas</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Settings sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Chatbot IA</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Schedule sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Mensajes Programados</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Analytics sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Reportes y Análisis</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <People sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Gestión de Agentes</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Calendario/Agenda</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Kanban CRM</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Cobranzas Automáticas</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Campaign sx={{ fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Campañas Personalizadas</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<QrCode sx={{ fontSize: 28 }} />}
                onClick={handleConnect}
                sx={{
                  bgcolor: 'white',
                  color: '#075E54',
                  minWidth: '280px',
                  px: 4,
                  py: 2.5,
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  borderRadius: 4,
                  textTransform: 'none',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  '&:hover': {
                    bgcolor: '#f8f9fa',
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                Conectar WhatsApp
              </Button>

              <Button
                variant="contained"
                size="large"
                startIcon={<Person sx={{ fontSize: 28 }} />}
                onClick={() => window.location.href = '/login'}
                sx={{
                  bgcolor: 'white',
                  color: '#075E54',
                  minWidth: '280px',
                  px: 4,
                  py: 2.5,
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  borderRadius: 4,
                  textTransform: 'none',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  '&:hover': {
                    bgcolor: '#f8f9fa',
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                Conectar Agente
              </Button>
            </Box>
          </Box>
        </Box>

        {/* QR Modal */}
        <Dialog
          open={showQRModal}
          onClose={() => setShowQRModal(false)}
          maxWidth="sm"
          PaperProps={{
            sx: {
              borderRadius: 4,
              p: 2
            }
          }}
        >
          <DialogContent sx={{ textAlign: 'center', p: 4 }}>
            <Box sx={{
              display: 'inline-block',
              bgcolor: 'rgba(37, 211, 102, 0.1)',
              borderRadius: 3,
              p: 2,
              mb: 3
            }}>
              <WhatsApp sx={{ fontSize: 48, color: '#25D366' }} />
            </Box>

            <Typography
              variant="h4"
              sx={{
                mb: 2,
                fontWeight: 700,
                color: '#1E293B',
                letterSpacing: '-0.02em'
              }}
            >
              Conectar WhatsFlow
            </Typography>

            <Typography
              variant="body1"
              sx={{
                mb: 4,
                color: '#64748B',
                lineHeight: 1.6
              }}
            >
              Escanea el código QR con tu teléfono
            </Typography>

            {loading ? (
              <Box py={4}>
                <CircularProgress size={60} sx={{ mb: 2, color: '#25D366' }} />
                <Typography sx={{ color: '#64748B' }}>Generando código QR...</Typography>
              </Box>
            ) : error ? (
              <Box>
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>
                <Button
                  onClick={fetchQR}
                  startIcon={<Refresh />}
                  variant="contained"
                  sx={{
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 4
                  }}
                >
                  Intentar nuevamente
                </Button>
              </Box>
            ) : qrDataUrl ? (
              <Box>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    mb: 4,
                    bgcolor: '#F8FAFC',
                    border: '2px solid #E2E8F0',
                    borderRadius: 3
                  }}
                >
                  <img
                    src={qrDataUrl}
                    alt="Código QR WhatsFlow"
                    style={{ maxWidth: '280px', width: '100%', borderRadius: '8px' }}
                  />
                </Paper>

                <Typography
                  variant="h6"
                  sx={{
                    mb: 3,
                    fontWeight: 600,
                    color: '#1E293B'
                  }}
                >
                  📱 Instrucciones
                </Typography>

                <Box sx={{
                  textAlign: 'left',
                  bgcolor: '#F8FAFC',
                  p: 3,
                  borderRadius: 2,
                  border: '1px solid #E2E8F0'
                }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#475569',
                      lineHeight: 2,
                      '& strong': { color: '#1E293B', fontWeight: 600 }
                    }}
                  >
                    <strong>1.</strong> Abre WhatsApp en tu teléfono<br />
                    <strong>2.</strong> Ve a <strong>Menú</strong> o <strong>Ajustes</strong><br />
                    <strong>3.</strong> Toca <strong>Dispositivos vinculados</strong><br />
                    <strong>4.</strong> Toca <strong>Vincular un dispositivo</strong><br />
                    <strong>5.</strong> Apunta tu cámara a este código QR
                  </Typography>
                </Box>
              </Box>
            ) : null}
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5' }}>
        {/* Header */}
        <AppBar position="static" sx={{ bgcolor: '#00a884' }}>
          <Toolbar>
            <Avatar sx={{ bgcolor: '#128c7e', mr: 2 }}>
              <WhatsApp />
            </Avatar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              WhatsFlow
            </Typography>
            <Chip
              label="Conectado"
              size="small"
              sx={{ bgcolor: '#25d366', color: 'white', mr: 2 }}
            />
            <Button
              color="inherit"
              onClick={() => loadRealChats()}
              startIcon={<Refresh />}
              sx={{ mr: 2 }}
            >
              Actualizar
            </Button>
            <IconButton
              color="inherit"
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem onClick={() => setAnchorEl(null)}>
                <Campaign sx={{ mr: 2 }} /> Campañas
              </MenuItem>
              <MenuItem onClick={() => setAnchorEl(null)}>
                <Analytics sx={{ mr: 2 }} /> Análisis
              </MenuItem>
              <MenuItem onClick={() => setAnchorEl(null)}>
                <People sx={{ mr: 2 }} /> Contactos
              </MenuItem>
              <MenuItem onClick={() => setAnchorEl(null)}>
                <Schedule sx={{ mr: 2 }} /> Programados
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ flex: 1, display: 'flex' }}>
          {/* Sidebar - Lista de Chats */}
          <Paper sx={{
            width: 400,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            borderRight: '1px solid #e9edef'
          }}>
            {/* Buscador */}
            <Box sx={{ p: 2, bgcolor: '#f0f2f5' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar o iniciar un chat nuevo"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#667781' }} />
                    </InputAdornment>
                  ),
                  sx: { bgcolor: 'white', borderRadius: 2 }
                }}
              />
            </Box>

            {/* Lista de Chats */}
            <List sx={{ flex: 1, p: 0, overflow: 'auto' }}>
              {loadingChats ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <CircularProgress size={40} />
                  <Typography sx={{ mt: 2 }}>Cargando chats...</Typography>
                </Box>
              ) : filteredChats.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center', color: '#667781' }}>
                  <Typography>No hay chats disponibles</Typography>
                  <Button
                    size="small"
                    onClick={() => loadRealChats()}
                    startIcon={<Refresh />}
                    sx={{ mt: 1 }}
                  >
                    Recargar chats
                  </Button>
                </Box>
              ) : (
                filteredChats.map((chat) => (
                  <ListItem key={chat.id} disablePadding>
                    <ListItemButton
                      onClick={() => handleChatSelect(chat)}
                      selected={activeChat?.id === chat.id}
                      sx={{
                        py: 1.5,
                        borderBottom: '1px solid #f0f2f5',
                        '&.Mui-selected': {
                          bgcolor: '#f0f2f5'
                        },
                        '&:hover': {
                          bgcolor: '#f5f6f6'
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: chat.isGroup ? '#25d366' : '#00a884' }}>
                          {chat.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 500, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                              {chat.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {chat.timestamp && (
                                <Typography variant="caption" sx={{ color: '#667781' }}>
                                  {formatMessageTime(chat.timestamp)}
                                </Typography>
                              )}
                              {chat.isOnline && (
                                <Box sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: '#25d366'
                                }} />
                              )}
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#667781',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: chat.unreadCount ? '170px' : '200px'
                              }}
                            >
                              {chat.id}
                            </Typography>
                            {chat.unreadCount && chat.unreadCount > 0 && (
                              <Badge
                                badgeContent={chat.unreadCount}
                                sx={{
                                  '& .MuiBadge-badge': {
                                    bgcolor: '#00a884',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    minWidth: '20px',
                                    height: '20px'
                                  }
                                }}
                              />
                            )}
                          </Box>
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenChatContextMenu(e, chat.id)}
                        sx={{ ml: 1, visibility: contextMenuChatId === chat.id ? 'visible' : 'hidden' }}
                        className="chat-options-button" // Para que sea visible al hacer hover con CSS si se desea
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
            {/* Menú contextual para chats */}
            <Menu
              anchorEl={contextMenuAnchorEl}
              open={Boolean(contextMenuChatId && contextMenuAnchorEl)}
              onClose={handleCloseChatContextMenu}
              MenuListProps={{
                'aria-labelledby': 'chat-options-button',
              }}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={() => { console.log(`Ver perfil: ${contextMenuChatId}`); handleCloseChatContextMenu(); }}>
                <Person sx={{ mr: 1 }} /> Ver Info
              </MenuItem>
              <MenuItem onClick={() => { console.log(`Archivar: ${contextMenuChatId}`); handleCloseChatContextMenu(); }}>
                <Archive sx={{ mr: 1 }} /> Archivar Chat
              </MenuItem>
              <MenuItem onClick={() => { console.log(`Silenciar: ${contextMenuChatId}`); handleCloseChatContextMenu(); }}>
                <Notifications sx={{ mr: 1 }} /> Silenciar
              </MenuItem>
              <Divider />
              <MenuItem sx={{ color: 'error.main' }} onClick={() => { console.log(`Eliminar: ${contextMenuChatId}`); handleCloseChatContextMenu(); }}>
                <Delete sx={{ mr: 1 }} /> Eliminar Chat
              </MenuItem>
            </Menu>
          </Paper>

          {/* Área Principal de Chat */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {activeChat ? (
              <>
                {/* Header del Chat */}
                <Paper sx={{
                  p: 2,
                  borderRadius: 0,
                  borderBottom: '1px solid #e9edef',
                  bgcolor: '#f0f2f5'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ mr: 2, bgcolor: activeChat.isGroup ? '#25d366' : '#00a884' }}>
                      {activeChat.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                        {activeChat.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }}>
                        {activeChat.id}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {activeChat.isGroup ? 'Grupo' : 'Contacto'} •
                        {activeChat.isOnline ? ' en línea' : ' última vez hace un momento'}
                      </Typography>
                    </Box>
                    <IconButton onClick={() => loadMessages(activeChat.id)}>
                      <Refresh />
                    </IconButton>
                    <IconButton>
                      <Phone />
                    </IconButton>
                    <IconButton>
                      <VideoCall />
                    </IconButton>
                    <IconButton>
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </Paper>

                {/* Área de Mensajes */}
                <Box sx={{
                  flex: 1,
                  p: 2,
                  overflow: 'auto',
                  backgroundImage: 'url(data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="a" patternUnits="userSpaceOnUse" width="100" height="100"%3E%3Cpath d="M50 0L100 50L50 100L0 50Z" fill="none" stroke="%23e5ddd5" stroke-width="0.5" opacity="0.3"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100%25" height="100%25" fill="url(%23a)"/%3E%3C/svg%3E)',
                  bgcolor: '#efeae2'
                }}>
                  {messages.length === 0 ? (
                    <Box sx={{ textAlign: 'center', mt: 4, color: '#667781' }}>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        ¡Empieza una conversación!
                      </Typography>
                      <Typography variant="body2">
                        Los mensajes que envíes y recibas aparecerán aquí
                      </Typography>
                    </Box>
                  ) : (
                    messages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          mb: 1,
                          display: 'flex',
                          justifyContent: message.isFromMe ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <Paper
                          elevation={1}
                          sx={{
                            p: 1.5,
                            maxWidth: '70%',
                            bgcolor: message.isFromMe ? '#d9fdd3' : 'white',
                            borderRadius: 2,
                            position: 'relative',
                            '&::before': message.isFromMe ? {
                              content: '""',
                              position: 'absolute',
                              top: '50%',
                              right: '-8px',
                              transform: 'translateY(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: '8px solid #d9fdd3',
                              borderTop: '8px solid transparent',
                              borderBottom: '8px solid transparent'
                            } : {
                              content: '""',
                              position: 'absolute',
                              top: '50%',
                              left: '-8px',
                              transform: 'translateY(-50%)',
                              width: 0,
                              height: 0,
                              borderRight: '8px solid white',
                              borderTop: '8px solid transparent',
                              borderBottom: '8px solid transparent'
                            }
                          }}
                        >
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                            {message.message}
                          </Typography>
                          <Box sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            mt: 0.5,
                            gap: 0.5
                          }}>
                            <Typography variant="caption" sx={{ color: '#667781', fontSize: '0.7rem' }}>
                              {formatTime(message.timestamp)}
                            </Typography>
                            {message.isFromMe && (
                              <DoneAllIcon sx={{ fontSize: 14, color: '#53bdeb' }} />
                            )}
                          </Box>
                        </Paper>
                      </Box>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </Box>

                {/* Input de Mensajes */}
                <Paper sx={{
                  p: 2,
                  borderRadius: 0,
                  borderTop: '1px solid #e9edef'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton sx={{ color: '#667781' }}>
                      <EmojiIcon />
                    </IconButton>
                    <IconButton sx={{ color: '#667781' }}>
                      <AttachFileIcon />
                    </IconButton>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Escribe un mensaje"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          bgcolor: 'white'
                        }
                      }}
                    />
                    <IconButton
                      onClick={sendMessage}
                      sx={{
                        bgcolor: newMessage.trim() ? '#00a884' : '#f0f2f5',
                        color: newMessage.trim() ? 'white' : '#667781',
                        '&:hover': {
                          bgcolor: newMessage.trim() ? '#008069' : '#e4e6ea'
                        },
                        '&:disabled': {
                          bgcolor: '#f0f2f5',
                          color: '#bbb'
                        }
                      }}
                    >
                      {newMessage.trim() ? (
                        <Send />
                      ) : (
                        <MicIcon />
                      )}
                    </IconButton>
                  </Box>
                </Paper>
              </>
            ) : (
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: '#667781',
                bgcolor: '#f8f9fa'
              }}>
                <WhatsApp sx={{ fontSize: 120, mb: 3, opacity: 0.3, color: '#00a884' }} />
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 300 }}>
                  WhatsFlow
                </Typography>
                <Typography variant="body1" sx={{ textAlign: 'center', maxWidth: 400, mb: 2 }}>
                  Selecciona un chat para comenzar a enviar mensajes
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Todos tus chats personales estarán aquí
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default LandingPage; 