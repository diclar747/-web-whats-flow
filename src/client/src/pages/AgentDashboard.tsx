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
  Chip
} from '@mui/material';
import {
  Chat as ChatIcon,
  Search as SearchIcon,
  Logout as LogoutIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  MoreVert as MoreIcon,
  Description as DocumentIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import EmojiPicker from 'emoji-picker-react';
import { useTransferNotifications } from '../hooks/useTransferNotifications';
import { useTheme } from '../contexts/ThemeContext';

interface AgentChat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  assignedAt: string;
}

interface Message {
  id: string;
  chatJid?: string;
  senderJid?: string;
  from_me: boolean;
  text_content: string;
  timestamp: string;
  status: string;
  message_type: string;
  media_url?: string;
  sender_name?: string;
  sender_avatar?: string;
  agent_id?: number;
  agent_name?: string;
  file_name?: string;
  mime_type?: string;
}

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { socket, isConnected, on, off } = useSocket();

  // Estados
  const [agentId, setAgentId] = useState<number | null>(null);
  const [chats, setChats] = useState<AgentChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<AgentChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  // Hook para notificaciones de transferencia
  useTransferNotifications(socket, agentId || undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicialización
  useEffect(() => {
    const initializeAgent = async () => {
      const token = sessionStorage.getItem('token');
      const userId = sessionStorage.getItem('userId');
      const savedUserName = sessionStorage.getItem('userName');

      console.log('🔍 [AGENT-DASHBOARD] Inicializando...');
      console.log('🔍 Token:', token ? 'Existe' : 'No');
      console.log('🔍 UserId guardado:', userId);

      if (!token || !userId) {
        console.log('❌ No hay sesión de agente');
        navigate('/login');
        return;
      }

      setAgentId(parseInt(userId));
      setUserName(savedUserName || 'Agente');
      console.log('✅ AgentId establecido:', userId);

      // Solicitar permisos de notificación
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('🔔 Permisos de notificación:', permission);
        });
      }

      // Obtener sessionId del ADMIN desde la base de datos
      try {
        const response = await fetch(`/api/users/${userId}/session`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        console.log('🔍 [AGENT-SESSION] Respuesta completa:', data);

        if (data.success && data.sessionId) {
          setSessionId(data.sessionId);
          setPhoneNumber(data.phoneNumber);
          console.log('✅ [AGENT] Usando sesión del admin:', data.sessionId);
          console.log('✅ [AGENT] Número del admin:', data.phoneNumber);

          // Guardar en sessionStorage para uso global
          sessionStorage.setItem('adminSessionId', data.sessionId);
          sessionStorage.setItem('adminPhoneNumber', data.phoneNumber || '');
        } else {
          console.error('❌ [AGENT] No se pudo obtener sesión del admin:', data.message);
          alert('⚠️ El administrador no tiene una sesión activa de WhatsApp.\n\nNo podrás enviar mensajes hasta que el admin inicie sesión en WhatsApp.');
        }
      } catch (error) {
        console.error('❌ [AGENT] Error obteniendo sessionId:', error);
        alert('Error al conectar con el sistema. Por favor, recarga la página.');
      }
    };

    initializeAgent();
  }, [navigate]);

  // Cargar chats del agente
  const loadAgentChats = useCallback(async () => {
    if (!agentId || !sessionId) return;

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/agents/${agentId}/chats?sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      console.log('[AGENT-LOAD-CHATS] Respuesta del backend:', data);

      if (data.success) {
        // Mapear los datos del backend al formato del frontend
        const mappedChats = (data.chats || []).map((chat: any) => ({
          id: chat.chat_jid,
          name: chat.contact_name || chat.chat_jid.replace('@s.whatsapp.net', ''),
          avatar: chat.avatar_url || '',
          lastMessage: chat.last_message_text || 'Sin mensajes',
          timestamp: chat.last_message_time || chat.assigned_at,
          unreadCount: chat.unread_count || 0,
          assignedAt: chat.assigned_at
        }));

        console.log('[AGENT-LOAD-CHATS] Chats mapeados:', mappedChats.length);
        setChats(mappedChats);
      }
    } catch (err) {
      console.error('Error loading chats:', err);
    }
  }, [agentId, sessionId]);

  // Cargar mensajes del chat seleccionado
  const loadMessages = useCallback(async () => {
    if (!selectedChat || !sessionId) return;

    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/messages/${sessionId}/${selectedChat.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedChat, sessionId]);

  // Efectos - Cargar chats solo una vez al iniciar
  useEffect(() => {
    if (agentId && sessionId) {
      loadAgentChats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, sessionId]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket eventos
  useEffect(() => {
    if (!socket || !isConnected || !agentId) return;

    console.log('🔌 [AGENT-DASHBOARD] Socket conectado, escuchando eventos para agente:', agentId);

    const handleNewChat = (data: any) => {
      console.log('📨 Nuevo chat asignado:', data);

      // Reproducir sonido de notificación
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('No se pudo reproducir sonido:', e));

      // Mostrar notificación del navegador
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nuevo chat asignado', {
          body: `Se te ha asignado un chat con ${data.chatName || 'un contacto'}`,
          icon: '/whatsapp-icon.png',
          badge: '/whatsapp-icon.png'
        });
      }

      // Recargar lista de chats
      loadAgentChats();
    };

    // Escuchar eventos específicos del agente
    on(`agent-${agentId}-new-chat`, handleNewChat);

    on('chat-assignment-changed', (data: any) => {
      if (data.agentId === agentId) {
        console.log('🔄 Asignación de chat cambiada');
        loadAgentChats();
      }
    });

    on('chat:assigned', handleNewChat);

    const handleTransferEvent = (data: any) => {
      const targetAgentId = data?.toAgentId || data?.agentId;
      if (String(targetAgentId) !== String(agentId)) return;

      console.log('🔄 Chat transferido a este agente:', data);

      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('No se pudo reproducir sonido:', e));

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Chat transferido', {
          body: `Se te ha transferido el chat: ${data.chatName || data.chatJid}`,
          icon: '/whatsapp-icon.png',
          badge: '/whatsapp-icon.png'
        });
      }

      loadAgentChats();
    };

    on('chat:transferred', handleTransferEvent);

    on('message:received', (data: any) => {
      console.log('📨 Mensaje recibido:', data);
      // Agregar mensaje directamente sin recargar
      if (selectedChat && data.chatJid === selectedChat.id) {
        const newMsg: any = {
          id: data.id || Date.now().toString(),
          chatJid: data.chatJid,
          senderJid: data.senderJid || data.chatJid,
          from_me: data.from_me || false,
          message_type: data.message_type || 'conversation',
          text_content: data.message || data.text_content,
          timestamp: data.timestamp || new Date().toISOString(),
          status: data.status || 'received',
          sender_name: data.sender_name,
          sender_avatar: data.sender_avatar,
          agent_id: data.agent_id,
          agent_name: data.agent_name,
          media_url: data.media_url,
          file_name: data.file_name,
          mime_type: data.mime_type
        };
        setMessages(prev => {
          // Evitar duplicados
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    on('message', (data: any) => {
      console.log('💬 Nuevo mensaje:', data);
      if (selectedChat && data.chatJid === selectedChat.id) {
        const newMsg: any = {
          id: data.id || Date.now().toString(),
          chatJid: data.chatJid,
          senderJid: data.senderJid || data.chatJid,
          from_me: data.from_me || false,
          message_type: data.message_type || 'conversation',
          text_content: data.message || data.text_content,
          timestamp: data.timestamp || new Date().toISOString(),
          status: data.status || 'received',
          sender_name: data.sender_name,
          sender_avatar: data.sender_avatar,
          agent_id: data.agent_id,
          agent_name: data.agent_name,
          media_url: data.media_url,
          file_name: data.file_name,
          mime_type: data.mime_type
        };
        setMessages(prev => {
          // Evitar duplicados
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    // Escuchar cuando se envía un mensaje (actualización de estado)
    on('message-sent', (data: any) => {
      console.log('✅ Mensaje enviado confirmado:', data);
      if (selectedChat && data.chatJid === selectedChat.id) {
        setMessages(prev => prev.map(msg => {
          if (msg.status === 'pending' && msg.chatJid === data.chatJid) {
            return { ...msg, status: 'sent', id: data.id || msg.id };
          }
          return msg;
        }));
      }
    });

    return () => {
      off(`agent-${agentId}-new-chat`);
      off('chat:transferred');
      off('chat-assignment-changed');
      off('chat:assigned');
      off('message:received');
      off('message');
      off('message-sent');
    };
  }, [socket, isConnected, agentId, on, off, loadAgentChats, selectedChat, loadMessages]);

  // Handlers
  const handleChatClick = (chat: AgentChat) => {
    setSelectedChat(chat);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !sessionId) {
      console.log('[AGENT-SEND] ⚠️ Falta información:', { messageText: !!messageText, selectedChat: !!selectedChat, sessionId });
      return;
    }

    console.log('[AGENT-SEND] 📤 Enviando mensaje:', {
      sessionId,
      chatJid: selectedChat.id,
      message: messageText.substring(0, 50) + '...'
    });

    setSending(true);

    // Agregar mensaje optimisticamente a la UI
    const tempMessage: any = {
      id: 'temp-' + Date.now(),
      chatJid: selectedChat.id,
      senderJid: sessionId,
      from_me: true,
      message_type: 'conversation',
      text_content: messageText,
      timestamp: new Date().toISOString(),
      status: 'pending',
      sender_name: userName,
      sender_avatar: null
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
      console.log('[AGENT-SEND] 📥 Respuesta:', data);

      if (data.success) {
        console.log('[AGENT-SEND] ✅ Mensaje enviado exitosamente');
        // Actualizar el estado del mensaje temporal a 'sent'
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id ? { ...msg, status: 'sent', id: data.messageId || msg.id } : msg
        ));
      } else {
        console.error('[AGENT-SEND] ❌ Error:', data.error);
        // Remover mensaje temporal y mostrar error
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setMessageText(messageToSend); // Restaurar mensaje
        alert('Error: ' + (data.error || 'No se pudo enviar el mensaje'));
      }
    } catch (error: any) {
      console.error('[AGENT-SEND] ❌ Exception:', error);
      // Remover mensaje temporal en caso de error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setMessageText(messageToSend); // Restaurar mensaje
      alert('Error de red: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChat || !sessionId) return;

    console.log('[AGENT-MEDIA] 📎 Archivo seleccionado:', file.name, file.type);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    formData.append('chatJid', selectedChat.id);
    formData.append('agentId', agentId?.toString() || '');

    setSending(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/messages/send-media', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      console.log('[AGENT-MEDIA] 📥 Respuesta:', data);

      if (data.success) {
        console.log('[AGENT-MEDIA] ✅ Multimedia enviada');
        // El mensaje aparecerá vía Socket.IO
      } else {
        alert('Error: ' + (data.error || 'No se pudo enviar el archivo'));
      }
    } catch (error: any) {
      console.error('[AGENT-MEDIA] ❌ Error:', error);
      alert('Error de red: ' + error.message);
    } finally {
      setSending(false);
      // Limpiar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessageText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: es });
    } catch {
      return '';
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.id.includes(searchTerm)
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#111b21' }}>
      {/* Header superior */}
      <AppBar position="static" sx={{ bgcolor: '#00a884', zIndex: 1200 }}>
        <Toolbar>
          <ChatIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            WhatsFlow - Panel de Agente
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {userName}
          </Typography>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Cerrar Sesión
          </Button>
        </Toolbar>
      </AppBar>

      {/* Layout estilo WhatsApp Web */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Panel izquierdo: Lista de chats */}
        <Box
          sx={{
            width: selectedChat ? '35%' : '100%',
            minWidth: '320px',
            maxWidth: '500px',
            bgcolor: '#ffffff',
            borderRight: '1px solid #d1d7db',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s ease'
          }}
        >
          {/* Header del panel de chats */}
          <Box sx={{ p: 2, bgcolor: '#f0f2f5', borderBottom: '1px solid #d1d7db' }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Mis Chats
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar chat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#667781' }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '10px',
                  bgcolor: 'white',
                  '& fieldset': { borderColor: 'transparent' }
                }
              }}
            />
          </Box>

          {/* Lista de chats */}
          <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
            {filteredChats.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', color: '#667781' }}>
                <Typography variant="body2">
                  No hay chats asignados
                </Typography>
              </Box>
            ) : (
              filteredChats.map((chat) => (
                <ListItem
                  key={chat.id}
                  button
                  selected={selectedChat?.id === chat.id}
                  onClick={() => handleChatClick(chat)}
                  sx={{
                    borderBottom: '1px solid #f0f0f0',
                    bgcolor: selectedChat?.id === chat.id ? '#f0f2f5' : 'transparent',
                    '&:hover': { bgcolor: '#f5f5f5' },
                    py: 2
                  }}
                >
                  <ListItemAvatar>
                    <Badge badgeContent={chat.unreadCount} color="error" overlap="circular">
                      <Avatar src={chat.avatar} alt={chat.name}>
                        {chat.name?.[0]?.toUpperCase() || '?'}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight={chat.unreadCount > 0 ? 600 : 400}>
                          {chat.name || chat.id.replace('@s.whatsapp.net', '')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(chat.timestamp)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: chat.unreadCount > 0 ? 500 : 400
                        }}
                      >
                        {chat.lastMessage || 'Sin mensajes'}
                      </Typography>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>

        {/* Panel derecho: Chat seleccionado */}
        {selectedChat ? (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: '#efeae2' }}>
            {/* Header del chat */}
            <Paper
              elevation={1}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                bgcolor: '#f0f2f5',
                borderBottom: '1px solid #d1d7db'
              }}
            >
              <Avatar src={selectedChat.avatar} sx={{ width: 40, height: 40, mr: 2 }}>
                {selectedChat.name?.[0]?.toUpperCase() || '?'}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {selectedChat.name || 'Sin nombre'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedChat.id.replace('@s.whatsapp.net', '')}
                </Typography>
              </Box>
              <IconButton>
                <MoreIcon />
              </IconButton>
            </Paper>

            {/* Área de mensajes */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                p: 2,
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpattern id=\'pattern\' x=\'0\' y=\'0\' width=\'20\' height=\'20\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23d9d9d9\' opacity=\'0.3\'/%3E%3C/pattern%3E%3Crect x=\'0\' y=\'0\' width=\'100%25\' height=\'100%25\' fill=\'url(%23pattern)\'/%3E%3C/svg%3E")'
              }}
            >
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              ) : messages.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <Typography variant="body2" color="text.secondary">
                    No hay mensajes
                  </Typography>
                </Box>
              ) : (
                messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.from_me ? 'flex-end' : 'flex-start',
                      mb: 1
                    }}
                  >
                    {/* Mostrar nombre del remitente */}
                    {msg.from_me && msg.agent_name && (
                      <Typography variant="caption" sx={{ fontSize: 10, color: '#667781', mb: 0.5, px: 1 }}>
                        {msg.agent_name}
                      </Typography>
                    )}
                    {!msg.from_me && msg.sender_name && (
                      <Typography variant="caption" sx={{ fontSize: 10, color: '#667781', mb: 0.5, px: 1 }}>
                        {msg.sender_name}
                      </Typography>
                    )}
                    <Paper
                      sx={{
                        maxWidth: '65%',
                        p: 1.5,
                        bgcolor: msg.from_me ? '#d9fdd3' : 'white',
                        borderRadius: msg.from_me ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                        boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)'
                      }}
                    >
                      {/* Renderizar multimedia si existe */}
                      {msg.media_url && (
                        <Box sx={{ mb: msg.text_content ? 1 : 0 }}>
                          {msg.message_type === 'image' || msg.mime_type?.startsWith('image/') ? (
                            <img
                              src={msg.media_url}
                              alt="Imagen"
                              style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'pointer' }}
                              onClick={() => window.open(msg.media_url, '_blank')}
                            />
                          ) : msg.message_type === 'video' || msg.mime_type?.startsWith('video/') ? (
                            <video
                              src={msg.media_url}
                              controls
                              style={{ maxWidth: '100%', borderRadius: '8px' }}
                            />
                          ) : msg.message_type === 'audio' || msg.mime_type?.startsWith('audio/') ? (
                            <audio src={msg.media_url} controls style={{ width: '100%' }} />
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#f0f0f0', borderRadius: '8px' }}>
                              <DocumentIcon sx={{ color: '#667781' }} />
                              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                {msg.file_name || 'Documento'}
                              </Typography>
                              <IconButton size="small" onClick={() => window.open(msg.media_url, '_blank')}>
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      )}
                      {msg.text_content && (
                        <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {msg.text_content}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ fontSize: 11, color: '#667781', float: 'right', mt: 0.5 }}>
                        {formatTime(msg.timestamp)}
                      </Typography>
                    </Paper>
                  </Box>
                ))
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Área de envío de mensajes */}
            <Paper elevation={2} sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end', bgcolor: '#f0f2f5' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />


              <IconButton size="small" sx={{ color: '#54656f' }}>
                <EmojiIcon onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
              </IconButton>

              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedChat || !sessionId || sending}
                sx={{ color: '#54656f' }}
              >
                <AttachFileIcon />
              </IconButton>

              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Escribe un mensaje"
                size="small"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '20px',
                    bgcolor: 'white',
                    '& fieldset': { borderColor: 'transparent' }
                  }
                }}
              />

              <IconButton
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                sx={{
                  bgcolor: '#00a884',
                  color: 'white',
                  '&:hover': { bgcolor: '#008c6d' },
                  '&:disabled': { bgcolor: '#e9edef', color: '#667781' }
                }}
              >
                {sending ? <CircularProgress size={24} /> : <SendIcon />}
              </IconButton>
            </Paper>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <Box sx={{ position: 'absolute', bottom: 80, right: 20, zIndex: 1000 }}>
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </Box>
            )}
          </Box>
        ) : (
          // Pantalla de bienvenida cuando no hay chat seleccionado
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: '#f0f2f5'
            }}
          >
            <ChatIcon sx={{ fontSize: 120, color: '#d1d7db', mb: 2 }} />
            <Typography variant="h5" color="text.secondary" gutterBottom>
              WhatsFlow Panel de Agente
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Selecciona un chat para comenzar a responder
            </Typography>
            <Chip label={`${chats.length} chats asignados`} sx={{ mt: 2 }} color="primary" />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AgentDashboard;
