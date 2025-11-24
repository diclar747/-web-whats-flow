import React, { useState, useEffect, useRef } from 'react';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useSocket } from '../context/SocketContext';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Badge,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Stack,
  Tooltip,
  Alert,
  CircularProgress,
  Fab
} from '@mui/material';
import {
  WhatsApp,
  Send,
  Search,
  MoreVert,
  AttachFile,
  EmojiEmotions,
  Mic,
  Phone,
  VideoCall,
  Info,
  Block,
  Archive,
  Star,
  Label,
  PersonAdd,
  Assignment,
  Schedule,
  Refresh,
  FilterList,
  Group,
  Reply,
  Forward,
  Delete,
  CheckCircle,
  AccessTime,
  DoneAll,
  Error as ErrorIcon,
  Warning,
  PriorityHigh,
  Flag,
  NotificationImportant,
  AccountCircle,
  SmartToy,
  Psychology,
  Image,
  InsertDriveFile,
  LocationOn,
  CameraAlt,
  Add,
  Close,
  Download,
  PlayArrow,
  Videocam
} from '@mui/icons-material';

interface ChatModuleProps {
  sessionId: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  isGroup: boolean;
  lastMessage?: string;
  lastMessageIsFromMe?: boolean; // Nuevo: indica si el último mensaje fue enviado por mí
  timestamp?: string;
  unreadCount?: number;
  status: 'online' | 'offline' | 'typing' | 'away';
  labels: string[];
  priority: 'high' | 'medium' | 'low';
  assignedAgent?: string;
  lastSeen?: string;
  isArchived?: boolean;
  isBlocked?: boolean;
}

interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  timestamp: string;
  isFromMe: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: { emoji: string; count: number }[];
  replyTo?: string;
  isForwarded?: boolean;
  mediaUrl?: string;
  fileName?: string;
  mediaMimeType?: string;
}

const ChatModule: React.FC<ChatModuleProps> = ({ sessionId }) => {
  const { socket, isConnected, emit, on, off } = useSocket();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [chatFilterTab, setChatFilterTab] = useState('all'); // all, sent, received, pending
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [messageDateFilter, setMessageDateFilter] = useState<string>('today'); // Filtro de fecha para mensajes

  // File upload states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Audio notification
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Crear elemento de audio para notificaciones
    notificationSound.current = new Audio('/notification.mp3');
    notificationSound.current.volume = 0.5;
  }, []);

  useEffect(() => {
    if (sessionId) {
      loadChatData();
      setupRealtimeUpdates();
    }

    return () => {
      cleanupRealtimeUpdates();
    };
  }, [sessionId, socket, isConnected]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const playNotificationSound = () => {
    try {
      notificationSound.current?.play().catch(e => {
        console.log('No se pudo reproducir el sonido:', e);
      });
    } catch (error) {
      console.log('Error al reproducir sonido:', error);
    }
  };

  const setupRealtimeUpdates = () => {
    if (!socket || !isConnected || !sessionId) {
      console.log('Socket no disponible, esperando...');
      return;
    }

    console.log(`🔌 [ChatModule] Configurando listeners para sesión: ${sessionId}`);

    // Unirse a la sala de la sesión
    emit('join-session', { sessionId });
    console.log(`🔌 [ChatModule] Uniéndose a sala: session-${sessionId}`);

    // NOTA: NO escuchamos 'message' aquí porque WhatsAppContext ya lo maneja globalmente
    // Esto evita mensajes duplicados

    // Escuchar actualizaciones de estado
    const handleStatusUpdate = (data: any) => {
      console.log('📊 [ChatModule] Actualización de estado:', data);

      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId
          ? { ...msg, status: data.status }
          : msg
      ));
    };

    // Escuchar eventos de escritura
    const handleTyping = (data: any) => {
      if (data.chatJid === activeContact?.id) {
        setContacts(prev => prev.map(c =>
          c.id === data.chatJid
            ? { ...c, status: 'typing' }
            : c
        ));

        // Limpiar estado de "escribiendo" después de 3 segundos
        setTimeout(() => {
          setContacts(prev => prev.map(c =>
            c.id === data.chatJid
              ? { ...c, status: 'online' }
              : c
          ));
        }, 3000);
      }
    };

    // Registrar listeners (SIN 'message' para evitar duplicados)
    on('message-status-update', handleStatusUpdate);
    on('typing', handleTyping);

    console.log('✅ [ChatModule] Listeners registrados correctamente (sin message para evitar duplicados)');
  };

  const cleanupRealtimeUpdates = () => {
    if (!socket) return;

    console.log('🔌 [ChatModule] Limpiando listeners');
    off('message-status-update');
    off('typing');

    // Salir de la sala
    if (sessionId) {
      emit('leave-session', { sessionId });
    }
  };

  const mapMessageType = (type: string): Message['type'] => {
    if (type?.includes('image')) return 'image';
    if (type?.includes('video')) return 'video';
    if (type?.includes('audio')) return 'audio';
    if (type?.includes('document')) return 'document';
    if (type?.includes('location')) return 'location';
    return 'text';
  };

  const getMediaDescription = (type: Message['type']): string => {
    switch (type) {
      case 'image': return '📷 Imagen';
      case 'video': return '🎥 Video';
      case 'audio': return '🎵 Audio';
      case 'document': return '📄 Documento';
      case 'location': return '📍 Ubicación';
      default: return '';
    }
  };

  const loadChatData = async () => {
    try {
      setLoading(true);

      console.log(`📡 [ChatModule] Cargando chats para sesión: ${sessionId}`);

      // Cargar chats reales desde la API
      const chatsResponse = await fetch(`${getAPIBaseURL()}/api/chats/${sessionId}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const chatsData = await chatsResponse.json();

      if (chatsData.success) {
        console.log(`✅ [ChatModule] ${chatsData.chats.length} chats cargados`);

        // Usar Map para deduplicar por ID
        const chatMap = new Map();

        chatsData.chats.forEach((chat: any) => {
          const chatId = chat.id;
          // Solo agregar si no existe o si tiene un timestamp más reciente
          if (!chatMap.has(chatId) ||
              new Date(chat.timestamp || 0) > new Date(chatMap.get(chatId).timestamp || 0)) {
            chatMap.set(chatId, {
              id: chatId,
              name: chat.name || chat.id.split('@')[0],
              phone: chat.id.split('@')[0],
              avatar: chat.avatar || null,
              isGroup: chat.isGroup || chat.id.includes('@g.us'),
              lastMessage: chat.lastMessage || '',
              lastMessageIsFromMe: chat.fromMe !== undefined ? chat.fromMe : undefined, // Nuevo campo
              timestamp: chat.timestamp || new Date().toISOString(),
              unreadCount: chat.unreadCount || 0,
              status: 'online' as 'online' | 'offline' | 'typing' | 'away',
              labels: [],
              priority: 'medium' as 'high' | 'medium' | 'low',
              assignedAgent: null,
              lastSeen: 'Hace poco',
              isArchived: false,
              isBlocked: false
            });
          }
        });

        // Convertir Map a array
        const allContactsData: Contact[] = Array.from(chatMap.values());

        console.log(`📱 [ChatModule] Chats únicos después de deduplicación: ${allContactsData.length} de ${chatsData.chats.length} total`);

        // Contar grupos
        const groupCount = allContactsData.filter(c => c.isGroup).length;
        const contactCount = allContactsData.filter(c => !c.isGroup).length;
        console.log(`👥 [ChatModule] Grupos: ${groupCount}, Contactos: ${contactCount}`);

        // FILTRAR GRUPOS: Solo mostrar contactos individuales (NO grupos)
        // Los grupos se siguen descargando pero no se muestran en la UI
        const contactsData = allContactsData.filter(c => !c.isGroup);
        console.log(`📋 [ChatModule] Chats filtrados (sin grupos): ${contactsData.length}`);

        setContacts(contactsData);

        if (contactsData.length > 0 && !activeContact) {
          setActiveContact(contactsData[0]);
          loadContactMessages(contactsData[0].id, 'today'); // Por defecto cargar solo hoy
        }
      } else {
        console.error('❌ [ChatModule] Error al cargar chats:', chatsData.error);
      }
    } catch (error) {
      console.error('❌ [ChatModule] Error loading chat data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContactMessages = async (contactId: string, dateFilter: string = 'today') => {
    try {
      console.log(`📡 [ChatModule] Cargando mensajes para: ${contactId} (filtro: ${dateFilter})`);

      // Cargar mensajes reales del contacto desde la API con filtro de fecha
      const messagesResponse = await fetch(
        `${getAPIBaseURL()}/api/messages?contactId=${encodeURIComponent(contactId)}&dateFilter=${dateFilter}`,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      const messagesData = await messagesResponse.json();

      if (messagesData.success && messagesData.data) {
        console.log(`✅ [ChatModule] ${messagesData.data.length} mensajes cargados (${dateFilter})`);

        const formattedMessages: Message[] = messagesData.data.map((msg: any) => ({
          id: msg.messageId || msg.id,
          from: msg.sender_jid || msg.contactId,
          to: contactId,
          content: msg.text || msg.text_content || '',
          type: mapMessageType(msg.type || msg.message_type),
          timestamp: msg.timestamp,
          isFromMe: msg.isFromMe || msg.from_me || false,
          status: msg.status || 'delivered',
          mediaUrl: msg.media_url,
          mediaMimeType: msg.media_mime_type
        }));

        setMessages(formattedMessages);
        scrollToBottom();
      } else {
        console.log(`ℹ️ [ChatModule] No se encontraron mensajes para ${contactId}`);
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ [ChatModule] Error loading contact messages:', error);
      setMessages([]);
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setActiveContact(contact);
    // Marcar como leído
    setContacts(prev => prev.map(c =>
      c.id === contact.id ? { ...c, unreadCount: 0 } : c
    ));
    // Cargar mensajes del contacto - siempre empezar con hoy
    loadContactMessages(contact.id, 'today');
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeContact || sending) return;

    setSending(true);
    const messageContent = newMessage;
    setNewMessage('');

    // Crear mensaje temporal
    const tempMessageId = Date.now().toString();
    const tempMessage: Message = {
      id: tempMessageId,
      from: sessionId,
      to: activeContact.id,
      content: messageContent,
      type: 'text',
      timestamp: new Date().toISOString(),
      isFromMe: true,
      status: 'sending'
    };

    // Añadir mensaje temporal a la UI
    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      console.log(`📤 [ChatModule] Enviando mensaje a ${activeContact.id}`);

      // Enviar mensaje real a través de la API
      const response = await fetch(`${getAPIBaseURL()}/api/send/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          number: activeContact.id,
          message: messageContent
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ [ChatModule] Mensaje enviado exitosamente`);

        // Actualizar el estado del mensaje a 'sent'
        setMessages(prev => prev.map(msg =>
          String(msg.id) === tempMessageId
            ? { ...msg, status: 'sent', id: result.messageId || msg.id }
            : msg
        ));

        // Actualizar el último mensaje en el contacto
        setContacts(prev => prev.map(c =>
          c.id === activeContact.id
            ? {
                ...c,
                lastMessage: messageContent,
                lastMessageIsFromMe: true, // Mensaje enviado por mí
                timestamp: new Date().toISOString()
              }
            : c
        ));
      } else {
        console.error('❌ [ChatModule] Error al enviar mensaje:', result.error);
        // Marcar como fallido si hay error en la API
        setMessages(prev => prev.map(msg =>
          String(msg.id) === tempMessageId
            ? { ...msg, status: 'failed' }
            : msg
        ));
      }
    } catch (error) {
      console.error('❌ [ChatModule] Error sending message:', error);
      // Marcar como fallido si hay error de red u otros
      setMessages(prev => prev.map(msg =>
        String(msg.id) === tempMessageId
          ? { ...msg, status: 'failed' }
          : msg
      ));
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Crear preview para imágenes
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadPreview('');
    }

    setUploadDialogOpen(true);
  };

  const sendMediaMessage = async () => {
    if (!selectedFile || !activeContact || uploading) return;

    setUploading(true);

    try {
      // Crear FormData para subir el archivo
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sessionId', sessionId);
      formData.append('number', activeContact.id);

      console.log(`📤 [ChatModule] Subiendo archivo: ${selectedFile.name}`);

      // Subir archivo al servidor
      const response = await fetch(`${getAPIBaseURL()}/api/send/media`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ [ChatModule] Archivo enviado exitosamente`);

        // Cerrar diálogo
        setUploadDialogOpen(false);
        setSelectedFile(null);
        setUploadPreview('');

        // El mensaje se agregará automáticamente via Socket.IO
      } else {
        console.error('❌ [ChatModule] Error al enviar archivo:', result.error);
        alert('Error al enviar el archivo: ' + result.error);
      }
    } catch (error) {
      console.error('❌ [ChatModule] Error uploading media:', error);
      alert('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleRefresh = () => {
    loadChatData();
    if (activeContact) {
      loadContactMessages(activeContact.id, 'today'); // Refresh con filtro de hoy
    }
  };

  const getStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending': return <AccessTime sx={{ fontSize: 14, color: '#999' }} />;
      case 'sent': return <CheckCircle sx={{ fontSize: 14, color: '#999' }} />;
      case 'delivered': return <DoneAll sx={{ fontSize: 14, color: '#999' }} />;
      case 'read': return <DoneAll sx={{ fontSize: 14, color: '#4fc3f7' }} />;
      case 'failed': return <ErrorIcon sx={{ fontSize: 14, color: '#f44336' }} />;
      default: return null;
    }
  };

  const filteredContacts = contacts.filter(contact => {
    // Filtro por búsqueda
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.phone.includes(searchTerm);

    // Filtro por pestaña
    let matchesTab = true;
    if (chatFilterTab === 'pending') {
      // Pendientes: chats con mensajes sin leer
      matchesTab = (contact.unreadCount || 0) > 0;
    } else if (chatFilterTab === 'sent') {
      // Enviados: chats donde el último mensaje fue enviado por mí
      matchesTab = contact.lastMessageIsFromMe === true;
    } else if (chatFilterTab === 'received') {
      // Recibidos: chats donde el último mensaje fue recibido (no enviado por mí)
      matchesTab = contact.lastMessageIsFromMe === false;
    }
    // chatFilterTab === 'all' muestra todos

    return matchesSearch && matchesTab;
  });

  // Log para debugging
  useEffect(() => {
    console.log(`🔍 [ChatModule] Filtro: ${chatFilterTab}, Total: ${filteredContacts.length}, Sin Grupos`);
  }, [filteredContacts, chatFilterTab]);

  // Solicitar permiso para notificaciones
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <WhatsApp sx={{ fontSize: 32, color: '#25D366' }} />
        <Typography variant="h5" sx={{ fontWeight: 600, flex: 1 }}>
          Chat WhatsApp
        </Typography>
        <Chip
          label={isConnected ? 'Conectado' : 'Desconectado'}
          color={isConnected ? 'success' : 'error'}
          size="small"
        />
        <Tooltip title="Actualizar">
          <IconButton onClick={handleRefresh}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Paper>

      <Grid container spacing={2} sx={{ flex: 1, height: 'calc(100% - 80px)' }}>
        {/* Lista de contactos */}
        <Grid item xs={12} md={4} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
              <Tabs
                value={chatFilterTab}
                onChange={(_, v) => setChatFilterTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mt: 1 }}
              >
                <Tab value="all" label="Todo" />
                <Tab value="sent" label="Enviado" />
                <Tab value="received" label="Recibido" />
                <Tab value="pending" label="Pendientes" />
              </Tabs>
            </Box>

            <Divider />

            <List sx={{ flex: 1, overflow: 'auto' }}>
              {filteredContacts.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No hay chats disponibles
                  </Typography>
                  <Button
                    startIcon={<Refresh />}
                    onClick={handleRefresh}
                    sx={{ mt: 2 }}
                  >
                    Actualizar
                  </Button>
                </Box>
              ) : (
                filteredContacts.map((contact) => (
                  <ListItemButton
                    key={contact.id}
                    selected={activeContact?.id === contact.id}
                    onClick={() => handleContactSelect(contact)}
                  >
                    <ListItemAvatar>
                      <Badge
                        badgeContent={contact.unreadCount || 0}
                        color="error"
                        overlap="circular"
                        invisible={(contact.unreadCount ?? 0) === 0}
                      >
                        <Avatar>
                          {contact.isGroup ? <Group /> : contact.name[0]?.toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={contact.name}
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {contact.status === 'typing' && (
                            <Typography variant="caption" color="primary">
                              escribiendo...
                            </Typography>
                          )}
                          {contact.status !== 'typing' && (
                            <Typography
                              variant="body2"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {contact.lastMessage}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        {/* Ventana de chat */}
        <Grid item xs={12} md={8} sx={{ height: '100%' }}>
          {activeContact ? (
            <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Header del chat */}
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ mr: 2 }}>
                  {activeContact.isGroup ? <Group /> : activeContact.name[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6">{activeContact.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activeContact.status === 'typing' ? 'escribiendo...' : activeContact.lastSeen}
                  </Typography>
                </Box>
                <IconButton>
                  <Phone />
                </IconButton>
                <IconButton>
                  <VideoCall />
                </IconButton>
                <IconButton onClick={() => setShowChatInfo(true)}>
                  <Info />
                </IconButton>
              </Box>

              {/* Mensajes */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#f0f0f0' }}>
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">
                      No hay mensajes aún
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.isFromMe ? 'flex-end' : 'flex-start',
                        mb: 1
                      }}
                    >
                      <Paper
                        sx={{
                          p: 1.5,
                          maxWidth: '70%',
                          bgcolor: message.isFromMe ? '#dcf8c6' : 'white',
                          borderRadius: 2
                        }}
                      >
                        {/* Media content */}
                        {message.type === 'image' && message.mediaUrl && (
                          <Box sx={{ mb: 1 }}>
                            <img
                              src={message.mediaUrl}
                              alt="Imagen"
                              style={{ maxWidth: '100%', borderRadius: 8 }}
                            />
                          </Box>
                        )}
                        {message.type === 'video' && message.mediaUrl && (
                          <Box sx={{ mb: 1 }}>
                            <video
                              controls
                              style={{ maxWidth: '100%', borderRadius: 8 }}
                            >
                              <source src={message.mediaUrl} type={message.mediaMimeType || 'video/mp4'} />
                            </video>
                          </Box>
                        )}
                        {message.type === 'audio' && message.mediaUrl && (
                          <Box sx={{ mb: 1 }}>
                            <audio controls style={{ width: '100%' }}>
                              <source src={message.mediaUrl} type={message.mediaMimeType || 'audio/ogg'} />
                            </audio>
                          </Box>
                        )}
                        {message.type === 'document' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <InsertDriveFile />
                            <Typography variant="body2">{message.fileName || 'Documento'}</Typography>
                            {message.mediaUrl && (
                              <IconButton size="small" href={message.mediaUrl} download>
                                <Download fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        )}

                        {/* Text content */}
                        {message.content && (
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            {message.content}
                          </Typography>
                        )}

                        {/* Timestamp and status */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end', mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                          {message.isFromMe && getStatusIcon(message.status)}
                        </Box>
                      </Paper>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Input de mensaje */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton onClick={() => fileInputRef.current?.click()}>
                    <AttachFile />
                  </IconButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept="image/*,video/*,audio/*,application/pdf,.doc,.docx"
                    onChange={handleFileSelect}
                  />
                  <TextField
                    fullWidth
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    multiline
                    maxRows={4}
                  />
                  <IconButton
                    color="primary"
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                  >
                    <Send />
                  </IconButton>
                </Box>
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ textAlign: 'center' }}>
                <WhatsApp sx={{ fontSize: 64, color: '#25D366', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Selecciona un chat para comenzar
                </Typography>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Dialog para enviar archivos */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Enviar archivo
          <IconButton
            onClick={() => setUploadDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedFile && (
            <Box sx={{ mb: 2 }}>
              {uploadPreview ? (
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <img src={uploadPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 300 }} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <InsertDriveFile fontSize="large" />
                  <Box>
                    <Typography variant="body1">{selectedFile.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={sendMediaMessage}
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={16} /> : <Send />}
          >
            {uploading ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatModule;
