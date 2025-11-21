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
  CircularProgress
} from '@mui/material';
import {
  Chat as ChatIcon,
  Search as SearchIcon,
  Logout as LogoutIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import EmojiPicker from 'emoji-picker-react';

interface AgentChat {
  chat_jid: string;
  contact_name: string;
  avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
}

interface Message {
  id: string;
  from_me: boolean;
  text_content: string;
  timestamp: string;
  status?: string;
}

const AgentDashboardFixed: React.FC = () => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  
  // Estados
  const [chats, setChats] = useState<AgentChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<AgentChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [adminSessionId, setAdminSessionId] = useState<string | null>(null);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('Conectando...');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicialización
  useEffect(() => {
    const initializeAgent = async () => {
      const token = sessionStorage.getItem('token');
      const userId = sessionStorage.getItem('userId');
      const savedUserName = sessionStorage.getItem('userName');

      console.log('🔍 [AGENT-INIT] Inicializando agente...');
      console.log('🔍 [AGENT-INIT] Token:', token ? 'Existe' : 'No existe');
      console.log('🔍 [AGENT-INIT] UserId:', userId);

      if (!token || !userId) {
        console.log('❌ [AGENT-INIT] Sin sesión, redirigiendo a login');
        navigate('/login');
        return;
      }

      const id = parseInt(userId);
      setAgentId(id);
      setUserName(savedUserName || 'Agente');
      console.log('✅ [AGENT-INIT] AgentId establecido:', id);

      // Solicitar permisos de notificación
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('🔔 [AGENT-INIT] Permisos de notificación:', permission);
        });
      }

      // Obtener sessionId del admin
      try {
        setConnectionStatus('Obteniendo sesión del admin...');
        const response = await fetch(`/api/users/${userId}/session`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        console.log('📋 [AGENT-INIT] Respuesta de sesión:', data);
        
        if (data.success && data.sessionId) {
          setAdminSessionId(data.sessionId);
          setAdminPhone(data.phoneNumber);
          console.log('✅ [AGENT-INIT] Sesión del admin:', data.sessionId);
          console.log('✅ [AGENT-INIT] Teléfono del admin:', data.phoneNumber);
          setConnectionStatus('Conectado');
          
          // Cargar chats inmediatamente
          loadAgentChats(id, data.sessionId, token);
        } else {
          console.error('❌ [AGENT-INIT] No se pudo obtener sesión:', data.message);
          setConnectionStatus('Sin sesión del admin');
        }
      } catch (error) {
        console.error('❌ [AGENT-INIT] Error obteniendo sesión:', error);
        setConnectionStatus('Error de conexión');
      }
    };

    initializeAgent();
  }, [navigate]);

  // Función para cargar chats
  const loadAgentChats = useCallback(async (agId?: number, sessId?: string, tok?: string) => {
    const id = agId || agentId;
    const sessionId = sessId || adminSessionId;
    const token = tok || sessionStorage.getItem('token');

    if (!id || !sessionId || !token) {
      console.log('⚠️ [LOAD-CHATS] Faltan datos:', { id, sessionId: !!sessionId, token: !!token });
      return;
    }

    console.log(`🔄 [LOAD-CHATS] Cargando chats para agente ${id} con sesión ${sessionId}`);

    try {
      const response = await fetch(`/api/agents/${id}/chats?sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`❌ [LOAD-CHATS] Error HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      console.log('📨 [LOAD-CHATS] Respuesta:', data);
      
      if (data.success) {
        setChats(data.chats || []);
        console.log(`✅ [LOAD-CHATS] ${data.chats?.length || 0} chats cargados`);
      }
    } catch (err) {
      console.error('❌ [LOAD-CHATS] Error:', err);
    }
  }, [agentId, adminSessionId]);

  // Cargar mensajes del chat seleccionado
  const loadMessages = useCallback(async () => {
    if (!selectedChat || !adminSessionId) return;

    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/messages/${adminSessionId}/${selectedChat.chat_jid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedChat, adminSessionId]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
    }
  }, [selectedChat, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket eventos
  useEffect(() => {
    if (!socket || !isConnected || !agentId) return;

    console.log('🔌 [SOCKET] Configurando eventos para agente:', agentId);

    const handleNewChat = (data: any) => {
      console.log('📨 [SOCKET] Nuevo chat asignado:', data);
      
      // Reproducir sonido
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('No se pudo reproducir sonido:', e));
      
      // Notificación del navegador
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nuevo chat asignado', {
          body: `Chat con ${data.chatName || 'un contacto'}`,
          icon: '/whatsapp-icon.png'
        });
      }
      
      // Recargar chats
      loadAgentChats();
    };

    socket.on(`agent-${agentId}-new-chat`, handleNewChat);
    socket.on('chat-assignment-changed', (data: any) => {
      if (data.agentId === agentId) {
        loadAgentChats();
      }
    });
    socket.on('message:received', (data: any) => {
      if (selectedChat && data.chatJid === selectedChat.chat_jid) {
        const newMsg: Message = {
          id: data.id || Date.now().toString(),
          from_me: false,
          text_content: data.message || data.text_content,
          timestamp: data.timestamp || new Date().toISOString(),
          status: 'received'
        };
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    });

    return () => {
      socket.off(`agent-${agentId}-new-chat`);
      socket.off('chat-assignment-changed');
      socket.off('message:received');
    };
  }, [socket, isConnected, agentId, selectedChat, loadAgentChats]);

  // Handlers
  const handleChatClick = (chat: AgentChat) => {
    setSelectedChat(chat);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !adminSessionId) {
      console.log('⚠️ [SEND] Faltan datos para enviar');
      return;
    }

    setSending(true);
    
    // Agregar mensaje optimisticamente
    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
      from_me: true,
      text_content: messageText,
      timestamp: new Date().toISOString(),
      status: 'pending'
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
          sessionId: adminSessionId,
          chatJid: selectedChat.chat_jid,
          message: messageToSend,
          agentId: agentId,
          phoneNumber: adminPhone
        })
      });

      const data = await response.json();
      console.log('📤 [SEND] Respuesta:', data);

      if (data.success) {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id ? { ...msg, status: 'sent', id: data.messageId || msg.id } : msg
        ));
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setMessageText(messageToSend);
        alert('Error: ' + (data.error || 'No se pudo enviar el mensaje'));
      }
    } catch (error: any) {
      console.error('❌ [SEND] Error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setMessageText(messageToSend);
      alert('Error de red: ' + error.message);
    } finally {
      setSending(false);
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
    chat.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.chat_jid.includes(searchTerm)
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
            {userName} • {connectionStatus}
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
              Mis Chats Asignados
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
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Los chats aparecerán aquí cuando te sean asignados
                </Typography>
              </Box>
            ) : (
              filteredChats.map((chat) => (
                <ListItem
                  key={chat.chat_jid}
                  button
                  selected={selectedChat?.chat_jid === chat.chat_jid}
                  onClick={() => handleChatClick(chat)}
                  sx={{
                    borderBottom: '1px solid #f0f0f0',
                    bgcolor: selectedChat?.chat_jid === chat.chat_jid ? '#f0f2f5' : 'transparent',
                    '&:hover': { bgcolor: '#f5f5f5' },
                    py: 2
                  }}
                >
                  <ListItemAvatar>
                    <Badge badgeContent={chat.unread_count} color="error" overlap="circular">
                      <Avatar src={chat.avatar_url} alt={chat.contact_name}>
                        {chat.contact_name?.[0]?.toUpperCase() || '?'}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight={chat.unread_count > 0 ? 600 : 400}>
                          {chat.contact_name || chat.chat_jid.replace('@s.whatsapp.net', '')}
                        </Typography>
                        {chat.last_message_time && (
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(chat.last_message_time)}
                          </Typography>
                        )}
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
                          fontWeight: chat.unread_count > 0 ? 500 : 400
                        }}
                      >
                        {chat.last_message || 'Sin mensajes'}
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
              <Avatar src={selectedChat.avatar_url} sx={{ width: 40, height: 40, mr: 2 }}>
                {selectedChat.contact_name?.[0]?.toUpperCase() || '?'}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {selectedChat.contact_name || 'Sin nombre'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedChat.chat_jid.replace('@s.whatsapp.net', '')}
                </Typography>
              </Box>
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
                      justifyContent: msg.from_me ? 'flex-end' : 'flex-start',
                      mb: 1
                    }}
                  >
                    <Paper
                      sx={{
                        maxWidth: '65%',
                        p: 1.5,
                        bgcolor: msg.from_me ? '#d9fdd3' : 'white',
                        borderRadius: msg.from_me ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                        boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)'
                      }}
                    >
                      <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {msg.text_content}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          textAlign: 'right',
                          mt: 0.5,
                          color: msg.from_me ? '#667781' : '#8696a0'
                        }}
                      >
                        {formatTime(msg.timestamp)}
                      </Typography>
                    </Paper>
                  </Box>
                ))
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Input de mensaje */}
            <Box
              sx={{
                p: 2,
                bgcolor: '#f0f2f5',
                borderTop: '1px solid #d1d7db'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                <IconButton size="small" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <EmojiIcon />
                </IconButton>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    // TODO: Implementar envío de archivos
                    console.log('Archivo seleccionado:', e.target.files?.[0]);
                  }}
                />
                <IconButton size="small" onClick={() => fileInputRef.current?.click()}>
                  <AttachFileIcon />
                </IconButton>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder="Escribe un mensaje..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  sx={{
                    bgcolor: 'white',
                    borderRadius: '8px',
                    '& fieldset': { borderColor: 'transparent' }
                  }}
                />
                <IconButton 
                  color="primary" 
                  onClick={handleSendMessage} 
                  disabled={!messageText.trim() || sending}
                  sx={{ bgcolor: '#00a884', color: 'white', '&:hover': { bgcolor: '#008c6f' } }}
                >
                  <SendIcon />
                </IconButton>
              </Box>
              {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: 80, right: 20, zIndex: 1000 }}>
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: '#f0f2f5'
            }}
          >
            <Box textAlign="center">
              <ChatIcon sx={{ fontSize: 80, color: '#d1d7db', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                WhatsFlow - Agente
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Selecciona un chat para comenzar
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AgentDashboardFixed;
