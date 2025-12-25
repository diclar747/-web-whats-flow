import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import { getAPIBaseURL } from '../utils/socketConfig';
import io from 'socket.io-client';
import {
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Divider,
  IconButton,
  CircularProgress,
  Box,
  Typography,
  Paper,
  Chip
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  AttachFile as AttachIcon,
  Mic as MicIcon,
  InsertEmoticon as EmojiIcon,
  Done as DoneIcon,
  DoneAll as DoneAllIcon,
  Reply as ReplyIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  WhatsApp
} from '@mui/icons-material';

const ModernWhatsAppChat: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { isDarkMode = true } = useTheme(); // 🌙 Tema oscuro por defecto

  // Estados locales - deben estar ANTES de cualquier hook condicional
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups' | 'contacts'>('all');
  const [whatsappConnected, setWhatsappConnected] = useState<boolean>(false);
  const [showQRPrompt, setShowQRPrompt] = useState<boolean>(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);

  // Hook del contexto - debe estar ANTES de cualquier lógica condicional
  // Los hooks deben llamarse incondicionalmente al principio del componente
  const whatsAppContext = useWhatsApp();

  // Verificar si el contexto se obtuvo correctamente
  let contextError: string | null = null;
  if (!whatsAppContext) {
    contextError = 'WhatsAppProvider no encontrado. El componente debe estar dentro de WhatsAppProvider.';
  }

  const {
    chats = [],
    activeChat,
    messages = [],
    isLoading = false,
    loadChats,
    loadMessages,
    sendMessage,
    setActiveChat,
    replyMessage,
    setReplyMessage
  } = whatsAppContext;

  // Verificar estado de conexión de WhatsApp
  useEffect(() => {
    const checkWhatsAppConnection = async () => {
      try {
        const response = await fetch(`${getAPIBaseURL()}/api/session/${sessionId}/status`);
        const data = await response.json();

        console.log('🔌 Estado de WhatsApp:', data);

        if (data.success && data.isConnected) {
          setWhatsappConnected(true);
          setShowQRPrompt(false);
          setConnectionStatus('connected');
        } else {
          setWhatsappConnected(false);
          setShowQRPrompt(true);
          setConnectionStatus('disconnected');
          setLoadError('WhatsApp no está conectado. Por favor, escanea el código QR en la página principal.');
        }
        setIsInitialLoading(false);
      } catch (error) {
        console.error('❌ Error verificando conexión WhatsApp:', error);
        setConnectionStatus('error');
        setLoadError('Error al verificar conexión con WhatsApp');
        setIsInitialLoading(false);
      }
    };

    if (!sessionId) {
      return;
    }

    checkWhatsAppConnection();
    // Verificar cada 10 segundos
    const interval = setInterval(checkWhatsAppConnection, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // 🚀 INICIALIZAR SOCKET Y ESCUCHAR EVENTOS DE CONEXIÓN EN TIEMPO REAL
  useEffect(() => {
    if (!sessionId) return;

    try {
      // Inicializar socket si no existe
      if (!socketRef.current) {
        socketRef.current = io(getAPIBaseURL(), {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5
        });

        console.log('🔌 Socket.IO inicializado en ModernWhatsAppChat');
      }

      const socket = socketRef.current;

      // ESCUCHAR EVENTO DE CONEXIÓN EXITOSA DE WHATSAPP
      socket.on('connection-update', (data: any) => {
        console.log('✅ [REALTIME] Evento connection-update recibido:', data);
        if (data.status === 'connected') {
          console.log('✅ WhatsApp conectado en tiempo real');
          setConnectionStatus('connected');
          setWhatsappConnected(true);
          setShowQRPrompt(false);
          setLoadError(null);
        }
      });

      // ESCUCHAR EVENTO DE CONEXIÓN EXITOSA DE WHATSAPP (alternativo)
      socket.on('whatsapp-connected', (data: any) => {
        console.log('✅ [REALTIME] Evento whatsapp-connected recibido:', data);
        if (data.success) {
          console.log('✅ WhatsApp conectado en tiempo real (whatsapp-connected)');
          setConnectionStatus('connected');
          setWhatsappConnected(true);
          setShowQRPrompt(false);
          setLoadError(null);
        }
      });

      // ESCUCHAR EVENTO DE DESCONEXIÓN DE WHATSAPP
      socket.on('whatsapp-disconnected', (data: any) => {
        console.log('❌ [REALTIME] Evento whatsapp-disconnected recibido:', data);
        setConnectionStatus('disconnected');
        setWhatsappConnected(false);
        setShowQRPrompt(true);
        setLoadError('WhatsApp desconectado. Por favor, escanea el código QR nuevamente.');
      });

      // ESCUCHAR CAMBIOS DE ESTADO DE SESIÓN
      socket.on('session-status', (data: any) => {
        console.log('📊 [REALTIME] Cambio de estado de sesión:', data);
        if (data.isConnected) {
          setConnectionStatus('connected');
          setWhatsappConnected(true);
          setShowQRPrompt(false);
        }
      });

      return () => {
        // NO desconectar el socket aquí, solo remover listeners
        if (socketRef.current) {
          socketRef.current.off('connection-update');
          socketRef.current.off('whatsapp-connected');
          socketRef.current.off('whatsapp-disconnected');
          socketRef.current.off('session-status');
        }
      };
    } catch (error) {
      console.error('❌ Error inicializando socket en ModernWhatsAppChat:', error);
      return undefined;
    }
  }, [sessionId]);

  // Hooks de efectos - deben estar DESPUÉS de los hooks de estado y contexto
  useEffect(() => {
    console.log('🔧 ModernWhatsAppChat montado con sessionId:', sessionId);
    console.log('🔧 loadChats disponible:', !!loadChats);
    console.log('🔧 chats actuales:', chats?.length || 0);
    console.log('🔧 WhatsApp conectado:', whatsappConnected);

    if (!whatsappConnected) {
      console.warn('⚠️ WhatsApp no está conectado, no se cargarán chats');
      return;
    }

    if (loadChats && sessionId) {
      console.log('📋 RealChatModule: Iniciando carga de chats para sessionId:', sessionId);
      loadChats(sessionId);
    } else {
      console.warn('⚠️ No se puede cargar chats:', { hasLoadChats: !!loadChats, hasSessionId: !!sessionId });
    }
  }, [sessionId, loadChats, whatsappConnected]);

  useEffect(() => {
    if (activeChat && loadMessages) {
      console.log('RealChatModule: Cargando mensajes para chat:', activeChat.id);
      loadMessages(activeChat.id);
    }
  }, [activeChat, loadMessages]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Si hay error de contexto, mostrar mensaje de error
  if (contextError) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        flexDirection: 'column'
      }}>
        <Typography variant="h6" color="error">
          Error: {contextError}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          El componente debe estar dentro de WhatsAppProvider
        </Typography>
      </Box>
    );
  }

  const handleSendMessage = async () => {
    if (!sendMessage || !setReplyMessage) return;

    if (selectedFile) {
      await handleSendFile();
    } else if (newMessage.trim() && activeChat) {
      try {
        const contextInfo = replyMessage ? {
          id: replyMessage.id,
          message: replyMessage.message,
          text: replyMessage.message,
          from: replyMessage.from
        } : undefined;

        await sendMessage(activeChat.id, newMessage, contextInfo);
        setNewMessage('');
        setReplyMessage(null);
      } catch (error) {
        console.error('Error sending message:', error);
        // Aquí podrías mostrar una notificación de error al usuario
      }
    }
  };

  const handleReplyClick = (message: any) => {
    if (setReplyMessage) {
      setReplyMessage(message);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || !activeChat) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64Content = base64Data.split(',')[1];

        let endpoint = '';
        const formData = {
          sessionId: sessionId,
          number: activeChat.id
        };

        if (selectedFile.type.startsWith('image/')) {
          endpoint = '/api/send/image';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).caption = newMessage || '';
          (formData as any).mimetype = selectedFile.type;
        } else if (selectedFile.type.startsWith('audio/')) {
          endpoint = '/api/send/audio';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).mimetype = selectedFile.type;
        } else if (selectedFile.type.startsWith('video/')) {
          endpoint = '/api/send/video';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).caption = newMessage || '';
          (formData as any).mimetype = selectedFile.type;
        } else {
          endpoint = '/api/send/document';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).filename = selectedFile.name;
          (formData as any).mimetype = selectedFile.type;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (data.success) {
          setNewMessage('');
          setSelectedFile(null);
          setFilePreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } else {
          console.error('Error enviando archivo:', data.error);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Error procesando archivo:', error);
    }
  };

  const getContactName = (message: any) => {
    if (!chats || chats.length === 0) {
      if (message.from && message.from.includes('@')) return message.from.split('@')[0];
      return 'Desconocido';
    }
    const chat = chats.find(c => c.id === message.from || c.id === message.chatJid);
    if (chat) return chat.name;
    if (message.from && message.from.includes('@')) return message.from.split('@')[0];
    return 'Desconocido';
  };

  const getContactAvatar = (message: any) => {
    if (!chats || chats.length === 0) {
      const contactJid = message.from || message.chatJid;
      if (contactJid && !contactJid.includes('@g.us')) {
        const fullJid = contactJid.includes('@') ? contactJid : `${contactJid}@s.whatsapp.net`;
        return `/api/avatar/${sessionId}/${fullJid}`;
      }
      return null;
    }
    const chat = chats.find(c => c.id === message.from || c.id === message.chatJid);
    if (chat?.avatar) return chat.avatar;
    const contactJid = message.from || message.chatJid;
    if (contactJid && !contactJid.includes('@g.us')) {
      const fullJid = contactJid.includes('@') ? contactJid : `${contactJid}@s.whatsapp.net`;
      return `${getAPIBaseURL()}/api/avatar/${sessionId}/${fullJid}`;
    }
    return null;
  };

  const filteredChats = chats && chats.length > 0 ? chats.filter(chat => {
    if (searchTerm && !chat.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    switch (filterType) {
      case 'unread': return chat.unreadCount && chat.unreadCount > 0;
      case 'groups': return chat.isGroup;
      case 'contacts': return !chat.isGroup;
      default: return true;
    }
  }) : [];

  return (
    <div style={{ 
      display: 'flex',
      height: 'calc(100vh - 64px)', // Adjust height to account for the top app bar
      backgroundColor: isDarkMode ? '#0c1317' : '#f0f2f5'
    }}>
      {/* Sidebar de contactos */}
      <div style={{ 
        width: '30%',
        borderRight: `1px solid ${isDarkMode ? '#303d45' : '#e9edef'}`, 
        backgroundColor: isDarkMode ? '#111b21' : '#fff',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: '10px 16px',
          backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <TextField 
            fullWidth 
            size="small"
            placeholder="Buscar o empezar nuevo chat"
            InputProps={{
              startAdornment: <SearchIcon style={{ marginRight: 8 }} />,
              style: {
                backgroundColor: isDarkMode ? '#111b21' : '#fff',
                borderRadius: '8px'
              }
            }}
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          />
          <IconButton 
            onClick={() => {
              console.log('🔄 Recargando chats manualmente...');
              if (loadChats) loadChats(sessionId);
            }}
            size="small"
            sx={{ color: isDarkMode ? '#aebac1' : '#667781' }}
            title="Recargar chats"
          >
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton 
            onClick={async () => {
              console.log('🔄 Forzando sincronización completa...');
              // setIsInitialLoading(true);
              // setLoadError(null);

              try {
                const response = await fetch(`${getAPIBaseURL()}/api/force-sync/${sessionId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();

                if (data.success) {
                  console.log('✅ Sincronización forzada exitosa');
                  // setLoadError(null);
                  // Recargar chats después de sincronización
                  setTimeout(() => loadChats && loadChats(sessionId), 2000);
                } else {
                  console.error('❌ Error en sincronización forzada:', data.error);
                  // setLoadError('Error en sincronización forzada');
                }
              } catch (error) {
                console.error('❌ Error forzando sincronización:', error);
                // setLoadError('Error de conexión en sincronización');
              }

              // setIsInitialLoading(false);
            }}
            size="small"
            sx={{ color: '#00a884' }}
            title="Sincronizar con WhatsApp"
          >
            <WhatsApp sx={{ fontSize: 20 }} />
          </IconButton>
        </div>

        <List style={{ overflowY: 'auto', flex: 1 }}>
          {isInitialLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="body2" color="textSecondary">
                {connectionStatus === 'checking' && 'Verificando conexión...'}
                {connectionStatus === 'connected' && 'Cargando chats...'}
                {connectionStatus === 'disconnected' && 'Conectando a WhatsApp...'}
                {connectionStatus === 'error' && 'Error de conexión'}
              </Typography>
            </Box>
          ) : !whatsappConnected || loadError ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4, gap: 2 }}>
              <WhatsApp sx={{ fontSize: 80, color: isDarkMode ? '#2a3942' : '#00a884', opacity: 0.3 }} />
              <Typography variant="h6" sx={{ textAlign: 'center', fontWeight: 600, color: isDarkMode ? '#e9edef' : '#111b21' }}>
                WhatsApp no está conectado
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
                Para usar el chat necesitas conectar tu cuenta de WhatsApp escaneando el código QR desde la página principal.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<WhatsApp />}
                  onClick={() => window.location.href = '/'}
                  sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008f7a' } }}
                >
                  Ir a Conectar WhatsApp
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setLoadError(null);
                    // Reintentar carga sin recargar página
                    console.log('⚠️ Reintentando carga de chats...');
                  }}
                >
                  Reintentar
                </Button>
              </Box>
              <Chip
                label={`Estado: ${connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'checking' ? 'Verificando...' : 'Desconectado'}`}
                color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'checking' ? 'warning' : 'error'}
                size="small"
                sx={{ mt: 2 }}
              />
            </Box>
          ) : (chats && chats.length === 0) ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mb: 2 }}>
                {connectionStatus === 'connected'
                  ? 'No se encontraron chats en WhatsApp'
                  : 'No hay chats disponibles'
                }
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ textAlign: 'center', mb: 2 }}>
                {connectionStatus === 'connected'
                  ? 'Es posible que no tengas conversaciones recientes o que necesites sincronizar tus chats.'
                  : 'Conecte WhatsApp para ver sus conversaciones'
                }
              </Typography>
              <Typography variant="caption" sx={{ textAlign: 'center', mb: 2, color: '#666', fontFamily: 'monospace', bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
                Debug: sessionId={sessionId || 'undefined'} | loadChats={typeof loadChats === 'function' ? 'OK' : 'NO'} | isLoading={isLoading ? 'SI' : 'NO'}
              </Typography>
              {chats && chats.some(chat => chat.id.includes('549123456789@c.us')) && (
                <Typography variant="caption" sx={{ textAlign: 'center', mb: 2, color: '#ff9800', fontStyle: 'italic' }}>
                  💡 Se muestran chats de prueba para verificar el funcionamiento del sistema
                </Typography>
              )}
              {connectionStatus === 'connected' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Button 
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      console.log('🔄 Forzando recarga de chats...');
                      // setIsInitialLoading(true);
                      try {
                        if (loadChats) await loadChats(sessionId);
                      } catch (error) {
                        console.error('Error recargando chats:', error);
                      }
                      // setIsInitialLoading(false);
                    }}
                    sx={{ mt: 1 }}
                  >
                    Recargar Chats
                  </Button>
                  <Button 
                    variant="text"
                    size="small"
                    onClick={async () => {
                      console.log('🔍 Verificando estado de chats...');
                      try {
                        const response = await fetch(`${getAPIBaseURL()}/api/chats-status/${sessionId}`);
                        const data = await response.json();
                        if (data.success) {
                          console.log('Estado de chats:', data.status);
                          alert(`Estado de WhatsApp:\n- Conectado: ${data.status.isConnected}\n- Socket disponible: ${data.status.hasSocket}\n- Store disponible: ${data.status.hasStore}\n- Chats en store: ${data.status.chatsInStore}\n- Chats con getChats: ${data.status.chatsFromGetChats}\n- Chats en BD: ${data.status.chatsInDatabase}`);
                        }
                      } catch (error) {
                        console.error('Error verificando estado:', error);
                        alert('Error al verificar estado de chats');
                      }
                    }}
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Verificar Estado
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <>
              {/* Pestañas modernas estilo WhatsApp Web */}
              <Box sx={{
                px: 2,
                py: 1.5,
                backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
                borderBottom: `1px solid ${isDarkMode ? '#303d45' : '#d1d7db'}`
              }}>
                <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto' }}>
                  <Button
                    variant={filterType === 'all' ? 'contained' : 'text'}
                    size="small"
                    onClick={() => setFilterType('all')}
                    sx={{
                      backgroundColor: filterType === 'all' ? '#00a884' : 'transparent',
                      color: filterType === 'all' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                      fontSize: '0.8rem',
                      fontWeight: filterType === 'all' ? 600 : 400,
                      height: 32,
                      minWidth: 'auto',
                      px: 2,
                      borderRadius: '16px',
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: filterType === 'all' ? '#00a884' : isDarkMode ? 'rgba(174,186,193,0.1)' : 'rgba(102,119,129,0.1)'
                      }
                    }}
                  >
                    Todos
                    <Badge
                      badgeContent={chats ? chats.length : 0}
                      sx={{
                        ml: 1,
                        '& .MuiBadge-badge': {
                          fontSize: '0.65rem',
                          height: '16px',
                          minWidth: '16px',
                          backgroundColor: filterType === 'all' ? 'rgba(255,255,255,0.3)' : isDarkMode ? '#aebac1' : '#667781',
                          color: filterType === 'all' ? '#00a884' : 'white'
                        }
                      }}
                    />
                  </Button>

                  <Button
                    variant={filterType === 'unread' ? 'contained' : 'text'}
                    size="small"
                    onClick={() => setFilterType('unread')}
                    sx={{
                      backgroundColor: filterType === 'unread' ? '#00a884' : 'transparent',
                      color: filterType === 'unread' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                      fontSize: '0.8rem',
                      fontWeight: filterType === 'unread' ? 600 : 400,
                      height: 32,
                      minWidth: 'auto',
                      px: 2,
                      borderRadius: '16px',
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: filterType === 'unread' ? '#00a884' : isDarkMode ? 'rgba(174,186,193,0.1)' : 'rgba(102,119,129,0.1)'
                      }
                    }}
                  >
                    No leídos
                    <Badge
                      badgeContent={chats ? chats.filter(c => c.unreadCount && c.unreadCount > 0).length : 0}
                      sx={{
                        ml: 1,
                        '& .MuiBadge-badge': {
                          fontSize: '0.65rem',
                          height: '16px',
                          minWidth: '16px',
                          backgroundColor: filterType === 'unread' ? 'rgba(255,255,255,0.3)' : '#ff4444',
                          color: filterType === 'unread' ? '#00a884' : 'white'
                        }
                      }}
                    />
                  </Button>

                  <Button
                    variant={filterType === 'groups' ? 'contained' : 'text'}
                    size="small"
                    onClick={() => setFilterType('groups')}
                    sx={{
                      backgroundColor: filterType === 'groups' ? '#00a884' : 'transparent',
                      color: filterType === 'groups' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                      fontSize: '0.8rem',
                      fontWeight: filterType === 'groups' ? 600 : 400,
                      height: 32,
                      minWidth: 'auto',
                      px: 2,
                      borderRadius: '16px',
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: filterType === 'groups' ? '#00a884' : isDarkMode ? 'rgba(174,186,193,0.1)' : 'rgba(102,119,129,0.1)'
                      }
                    }}
                  >
                    Grupos
                    <Badge
                      badgeContent={chats ? chats.filter(c => c.isGroup).length : 0}
                      sx={{
                        ml: 1,
                        '& .MuiBadge-badge': {
                          fontSize: '0.65rem',
                          height: '16px',
                          minWidth: '16px',
                          backgroundColor: filterType === 'groups' ? 'rgba(255,255,255,0.3)' : '#9c27b0',
                          color: filterType === 'groups' ? '#00a884' : 'white'
                        }
                      }}
                    />
                  </Button>

                  <Button
                    variant={filterType === 'contacts' ? 'contained' : 'text'}
                    size="small"
                    onClick={() => setFilterType('contacts')}
                    sx={{
                      backgroundColor: filterType === 'contacts' ? '#00a884' : 'transparent',
                      color: filterType === 'contacts' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                      fontSize: '0.8rem',
                      fontWeight: filterType === 'contacts' ? 600 : 400,
                      height: 32,
                      minWidth: 'auto',
                      px: 2,
                      borderRadius: '16px',
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: filterType === 'contacts' ? '#00a884' : isDarkMode ? 'rgba(174,186,193,0.1)' : 'rgba(102,119,129,0.1)'
                      }
                    }}
                  >
                    Contactos
                    <Badge
                      badgeContent={chats ? chats.filter(c => !c.isGroup).length : 0}
                      sx={{
                        ml: 1,
                        '& .MuiBadge-badge': {
                          fontSize: '0.65rem',
                          height: '16px',
                          minWidth: '16px',
                          backgroundColor: filterType === 'contacts' ? 'rgba(255,255,255,0.3)' : '#2196f3',
                          color: filterType === 'contacts' ? '#00a884' : 'white'
                        }
                      }}
                    />
                  </Button>
                </Box>
              </Box>

              {/* Estadísticas de chats */}
              <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="textSecondary">
                  {filteredChats.length} chats • {filteredChats.filter(c => c.isGroup).length} grupos • {filteredChats.filter(c => !c.isGroup).length} contactos
                </Typography>
              </Box>

              {filteredChats.map(chat => (
                <ListItem 
                  key={chat.id}
                  button
                  selected={activeChat?.id === chat.id}
                  onClick={() => setActiveChat && setActiveChat(chat)}
                  style={{ 
                    backgroundColor: activeChat?.id === chat.id 
                      ? isDarkMode ? '#2a3942' : '#f5f6f6'
                      : 'transparent'
                  }}
                >
                  <ListItemAvatar>
                    <Badge 
                      badgeContent={chat.unreadCount || 0}
                      color="error"
                      invisible={!chat.unreadCount || chat.unreadCount === 0}
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: '#25d366',
                          color: 'white',
                          minWidth: '20px',
                          height: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }
                      }}
                    >
                      <Avatar 
                        src={chat.avatar}
                        sx={{
                          bgcolor: chat.isGroup ? '#9c27b0' : '#00a884',
                          width: 48,
                          height: 48
                        }}
                      >
                        {chat.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={chat.name}
                    secondary={chat.lastMessage}
                    secondaryTypographyProps={{
                      color: isDarkMode ? '#aebac1' : '#667781',
                      noWrap: true,
                      style: { textOverflow: 'ellipsis', overflow: 'hidden', width: '180px' }
                    }}
                  />
                  <ListItemText 
                    secondary={new Date(chat.timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    style={{ textAlign: 'right' }}
                    secondaryTypographyProps={{
                      color: isDarkMode ? '#aebac1' : '#667781'
                    }}
                  />
                </ListItem>
              ))}
            </>
          )}
        </List>
      </div>

      {/* Área de chat principal */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDarkMode ? '#0b141a' : '#e5ddd5'
      }}>
        {activeChat ? (
          <>
            {/* Cabecera del chat */}
            <div style={{ 
              padding: '10px 16px',
              backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
              display: 'flex',
              alignItems: 'center',
              borderBottom: `1px solid ${isDarkMode ? '#303d45' : '#e9edef'}`
            }}>
              <Avatar 
                src={activeChat?.avatar}
                sx={{
                  bgcolor: activeChat?.isGroup ? '#9c27b0' : '#00a884',
                  width: 40,
                  height: 40
                }}
              >
                {activeChat?.name.charAt(0).toUpperCase()}
              </Avatar>
              <div style={{ marginLeft: '15px', flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{activeChat?.name}</div>
                <div style={{ 
                  fontSize: '0.8rem',
                  color: isDarkMode ? '#aebac1' : '#667781',
                }}>
                  {activeChat?.isOnline ? 'En línea' : 'Desconectado'}
                </div>
              </div>
              <IconButton>
                <MoreIcon />
              </IconButton>
            </div>

            {/* Mensajes */}
            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
            }}>
              {isLoading && (!messages || messages.length === 0) ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress />
                </Box>
              ) : (
                (messages || []).map((msg) => (
                  <div key={msg.id} style={{ 
                    display: 'flex',
                    justifyContent: msg.isFromMe ? 'flex-end' : 'flex-start',
                    marginBottom: '10px',
                    alignItems: 'flex-end'
                  }}>
                    {!msg.isFromMe && (
                      <Avatar 
                        src={getContactAvatar(msg) || undefined}
                        sx={{
                          width: 32,
                          height: 32,
                          mr: 1,
                          bgcolor: '#00a884'
                        }}
                      >
                        {getContactName(msg).charAt(0)}
                      </Avatar>
                    )}

                    <div style={{ maxWidth: '70%' }}>
                      {!msg.isFromMe && (
                        <Typography 
                          variant="caption"
                          sx={{
                            color: isDarkMode ? '#aebac1' : '#667781',
                            ml: 1,
                            mb: 0.5,
                            display: 'block',
                            fontWeight: 500
                          }}
                        >
                          {getContactName(msg)}
                        </Typography>
                      )}

                      <div 
                        style={{ 
                          padding: '8px 12px',
                          borderRadius: '7.5px',
                          backgroundColor: msg.isFromMe 
                            ? isDarkMode ? '#005c4b' : '#d9fdd3'
                            : isDarkMode ? '#202c33' : '#fff',
                          color: isDarkMode ? '#e9edef' : '#111b21',
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleReplyClick(msg)}
                      >
                        {msg.contextInfo && (
                          <Paper 
                            elevation={0}
                            sx={{
                              bgcolor: isDarkMode ? '#1a262f' : '#e0e0e0',
                              p: 1,
                              mb: 1,
                              borderRadius: '5px',
                              borderLeft: `4px solid ${msg.isFromMe ? '#25d366' : '#007bff'}`
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 'bold', color: msg.isFromMe ? '#25d366' : '#007bff' }}>
                              {(() => {
                                const quotedSenderJid = msg.contextInfo?.quotedMessageSender;
                                if (!quotedSenderJid) return 'Desconocido';
                                const senderChat = chats && chats.find(chat => chat.id === quotedSenderJid);
                                return senderChat ? senderChat.name : (quotedSenderJid === 'me' || quotedSenderJid.includes('s.whatsapp.net') ? 'Tú' : quotedSenderJid.split('@')[0]);
                              })()}
                            </Typography>
                            <Typography variant="body2" sx={{ color: isDarkMode ? '#aebac1' : '#667781' }} noWrap>
                              {msg.contextInfo.quotedMessageText}
                            </Typography>
                          </Paper>
                        )}

                        {msg.type === 'image' && msg.mediaUrl ? (
                          <div>
                            <img 
                              src={msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : `${getAPIBaseURL()}${msg.mediaUrl}`}
                              alt="Imagen"
                              style={{
                                maxWidth: '100%',
                                borderRadius: '5px',
                                marginBottom: msg.message ? '8px' : '0'
                              }}
                            />
                            {msg.message && <p>{msg.message}</p>}
                          </div>
                        ) : msg.type === 'video' && msg.mediaUrl ? (
                          <div>
                            <video 
                              controls
                              style={{
                                maxWidth: '100%',
                                borderRadius: '5px',
                                marginBottom: msg.message ? '8px' : '0'
                              }}
                            >
                              <source src={msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : `${getAPIBaseURL()}${msg.mediaUrl}`} type={msg.mediaMimeType} />
                            </video>
                            {msg.message && <p>{msg.message}</p>}
                          </div>
                        ) : msg.type === 'audio' && msg.mediaUrl ? (
                          <div>
                            <audio 
                              controls
                              style={{
                                width: '100%',
                                marginBottom: msg.message ? '8px' : '0'
                              }}
                            >
                              <source src={msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : `${getAPIBaseURL()}${msg.mediaUrl}`} type={msg.mediaMimeType} />
                            </audio>
                            {msg.message && <p>{msg.message}</p>}
                          </div>
                        ) : msg.type === 'document' && msg.mediaUrl ? (
                          <div>
                            <a 
                              href={msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : `${getAPIBaseURL()}${msg.mediaUrl}`}
                              download={msg.message}
                              style={{
                                color: '#007bff',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <AttachIcon sx={{ mr: 1, fontSize: 16 }} />
                              {msg.message}
                            </a>
                          </div>
                        ) : (
                          <p>{msg.message}</p>
                        )}

                        <div style={{ 
                          fontSize: '0.7rem',
                          textAlign: 'right',
                          color: isDarkMode ? '#aebac1' : '#667781',
                          marginTop: '4px'
                        }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.isFromMe && (
                            <span style={{ marginLeft: '4px' }}>
                              {msg.status === 'read' ? (
                                <DoneAllIcon sx={{ fontSize: '14px', color: '#34b7f1' }} />
                              ) : msg.status === 'delivered' ? (
                                <DoneAllIcon sx={{ fontSize: '14px', color: '#667781' }} />
                              ) : (
                                <DoneIcon sx={{ fontSize: '14px', color: '#667781' }} />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ 
              padding: '8px 16px',
              backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              {replyMessage && (
                <Paper 
                  elevation={0}
                  sx={{
                    width: '100%',
                    bgcolor: isDarkMode ? '#1a262f' : '#e0e0e0',
                    p: 1,
                    borderRadius: '8px',
                    borderLeft: `4px solid ${replyMessage?.isFromMe ? '#25d366' : '#007bff'}`, 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: replyMessage?.isFromMe ? '#25d366' : '#007bff' }}>
                      {replyMessage?.isFromMe ? 'Tú' : replyMessage?.from.split('@')[0]}
                    </Typography>
                    <Typography variant="body2" sx={{ color: isDarkMode ? '#aebac1' : '#667781' }} noWrap>
                      {replyMessage?.message}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setReplyMessage && setReplyMessage(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Paper>
              )}
              {filePreview && (
                <Box sx={{ mb: 2, p: 2, bgcolor: isDarkMode ? '#2a3942' : '#f5f5f5', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Archivo seleccionado: {selectedFile?.name}
                  </Typography>
                  {selectedFile?.type.startsWith('image/') && (
                    <img src={filePreview || ''} alt="Preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }} />
                  )}
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}>
                      Cancelar
                    </Button>
                  </Box>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <IconButton>
                  <EmojiIcon />
                </IconButton>

                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                  style={{ display: 'none' }}
                />

                <IconButton onClick={() => fileInputRef.current?.click()}>
                  <AttachIcon />
                </IconButton>

                <TextField 
                  fullWidth
                  variant="outlined"
                  size="small"
                  value={newMessage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={selectedFile ? "Agrega un mensaje..." : "Escribe un mensaje"}
                  multiline
                  maxRows={3}
                  style={{ 
                    backgroundColor: isDarkMode ? '#2a3942' : '#fff',
                    borderRadius: '8px'
                  }}
                />

                <IconButton 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() && !selectedFile}
                  sx={{
                    bgcolor: (newMessage.trim() || selectedFile) ? '#00a884' : 'transparent',
                    color: (newMessage.trim() || selectedFile) ? 'white' : 'inherit',
                    '&:hover': {
                      bgcolor: (newMessage.trim() || selectedFile) ? '#008f7a' : 'transparent'
                    }
                  }}
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </div>
          </>
        ) : (
          <div style={{ 
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDarkMode ? '#aebac1' : '#667781'
          }}>
            <div style={{ textAlign: 'center' }}>
              <WhatsApp sx={{ fontSize: 80, color: isDarkMode ? '#2a3942' : '#f0f2f5' }} />
              <Typography variant="h5" component="h2" sx={{ mt: 2 }}>
                WhatsFlow Web
              </Typography>
              <Typography sx={{ mt: 1, maxWidth: 400 }}>
                Envía y recibe mensajes sin tener que mantener tu teléfono conectado. <br />
                Tus mensajes están sincronizados y guardados de forma segura.
              </Typography>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { ModernWhatsAppChat as default };
