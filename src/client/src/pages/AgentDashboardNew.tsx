import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Avatar,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Badge,
  AppBar,
  Toolbar,
  Button,
  InputAdornment,
  Paper,
  CircularProgress,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Logout as LogoutIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  MoreVert as MoreIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import EmojiPicker from 'emoji-picker-react';

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
  from_me: boolean;
  text_content: string;
  timestamp: string;
  status: string;
  message_type: string;
  sender_name?: string;
  sender_avatar?: string;
}

const AgentDashboardNew: React.FC = () => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  
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
  const [userName, setUserName] = useState<string>('Agente');
  const [notification, setNotification] = useState<{open: boolean, message: string, type: 'success' | 'error' | 'info'}>({
    open: false,
    message: '',
    type: 'info'
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageLoadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inicialización del agente
  useEffect(() => {
    const initializeAgent = async () => {
      const token = sessionStorage.getItem('token');
      const userId = sessionStorage.getItem('userId');
      const savedUserName = sessionStorage.getItem('userName');

      if (!token || !userId) {
        navigate('/login');
        return;
      }

      setAgentId(parseInt(userId));
      setUserName(savedUserName || 'Agente');

      // Permisos de notificación
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      // Obtener sessionId del admin
      try {
        const response = await fetch(`/api/users/${userId}/session`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success && data.sessionId) {
          setSessionId(data.sessionId);
          setPhoneNumber(data.phoneNumber);
        }
      } catch (error) {
        console.error('Error obteniendo sessionId:', error);
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
      if (data.success) {
        setChats(data.chats || []);
      }
    } catch (err) {
      console.error('Error loading chats:', err);
    }
  }, [agentId, sessionId]);

  // Cargar mensajes (solo cuando hay chat seleccionado)
  const loadMessages = useCallback(async () => {
    if (!selectedChat || !sessionId) return;

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/messages/${sessionId}/${selectedChat.id}?dateFilter=today&limit=50`, {
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
    }
  }, [selectedChat, sessionId]);

  // Cargar chats al iniciar
  useEffect(() => {
    if (agentId && sessionId) {
      loadAgentChats();
    }
  }, [agentId, sessionId, loadAgentChats]);

  // Auto-refrescar mensajes solo cuando hay chat seleccionado
  useEffect(() => {
    if (selectedChat && sessionId) {
      setLoading(true);
      loadMessages().then(() => setLoading(false));

      // ⚡ OPTIMIZACIÓN: Polling desactivado - Socket.IO maneja actualizaciones en tiempo real
      // messageLoadIntervalRef.current = setInterval(loadMessages, 5000);

      return () => {
        if (messageLoadIntervalRef.current) {
          clearInterval(messageLoadIntervalRef.current);
        }
      };
    }
    return undefined;
  }, [selectedChat, sessionId, loadMessages]);

  // Socket eventos
  useEffect(() => {
    if (!socket || !isConnected || !agentId) return;

    const handleNewChat = (data: any) => {
      // Notificación sonora
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
      
      // Notificación del navegador
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nuevo chat asignado', {
          body: `Chat con ${data.chatName || 'un contacto'}`,
          icon: '/whatsapp-icon.png'
        });
      }
      
      setNotification({
        open: true,
        message: `Nuevo chat asignado: ${data.chatName || 'contacto'}`,
        type: 'info'
      });
      
      loadAgentChats();
    };

    const handleMessage = (data: any) => {
      // Si es del chat actual, recargar mensajes
      if (selectedChat && data.chatJid === selectedChat.id) {
        loadMessages();
      }
      // Recargar lista de chats para actualizar último mensaje
      loadAgentChats();
    };

    socket.on(`agent-${agentId}-new-chat`, handleNewChat);
    socket.on('chat:assigned', handleNewChat);
    socket.on('message:received', handleMessage);
    socket.on('message', handleMessage);
    socket.on('message-sent', handleMessage);

    return () => {
      socket.off(`agent-${agentId}-new-chat`);
      socket.off('chat:assigned');
      socket.off('message:received');
      socket.off('message');
      socket.off('message-sent');
    };
  }, [socket, isConnected, agentId, selectedChat, loadAgentChats, loadMessages]);

  // Handlers
  const handleChatClick = (chat: AgentChat) => {
    setSelectedChat(chat);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !sessionId) return;

    setSending(true);
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
          message: messageText
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessageText('');
        setTimeout(() => loadMessages(), 500);
      } else {
        setNotification({
          open: true,
          message: 'Error al enviar: ' + (data.error || 'Error desconocido'),
          type: 'error'
        });
      }
    } catch (error: any) {
      setNotification({
        open: true,
        message: 'Error de red: ' + error.message,
        type: 'error'
      });
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
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f0f2f5' }}>
      {/* Barra superior */}
      <AppBar position="fixed" sx={{ zIndex: 1300, bgcolor: '#00a884' }}>
        <Toolbar>
          <Avatar sx={{ mr: 2, bgcolor: '#fff', color: '#00a884' }}>
            {userName.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Winsap - Panel de Agente ({userName})
          </Typography>
          <Badge badgeContent={chats.length} color="error" sx={{ mr: 2 }}>
            <Typography variant="body2">Chats Asignados</Typography>
          </Badge>
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ textTransform: 'none' }}
          >
            Cerrar Sesión
          </Button>
        </Toolbar>
      </AppBar>

      {/* Panel izquierdo - Lista de chats */}
      <Box
        sx={{
          width: 400,
          bgcolor: '#fff',
          borderRight: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          mt: 8
        }}
      >
        {/* Búsqueda */}
        <Box sx={{ p: 2, bgcolor: '#f0f2f5' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              sx: {
                bgcolor: '#fff',
                borderRadius: 2
              }
            }}
          />
        </Box>

        {/* Lista de chats */}
        <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
          {filteredChats.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No hay chats asignados
              </Typography>
            </Box>
          ) : (
            filteredChats.map((chat) => (
              <React.Fragment key={chat.id}>
                <ListItemButton
                  selected={selectedChat?.id === chat.id}
                  onClick={() => handleChatClick(chat)}
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: '#f0f2f5'
                    },
                    '&:hover': {
                      bgcolor: '#f5f6f6'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      badgeContent={chat.unreadCount}
                      color="primary"
                      overlap="circular"
                    >
                      <Avatar src={chat.avatar}>
                        {chat.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body1" fontWeight={600}>
                        {chat.name}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        sx={{ maxWidth: 200 }}
                      >
                        {chat.lastMessage || 'Sin mensajes'}
                      </Typography>
                    }
                  />
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(chat.timestamp)}
                    </Typography>
                  </Box>
                </ListItemButton>
                <Divider component="li" />
              </React.Fragment>
            ))
          )}
        </List>
      </Box>

      {/* Panel derecho - Chat */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', mt: 8 }}>
        {selectedChat ? (
          <>
            {/* Header del chat */}
            <Paper
              elevation={1}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                bgcolor: '#f0f2f5'
              }}
            >
              <Avatar src={selectedChat.avatar} sx={{ mr: 2 }}>
                {selectedChat.name.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600}>
                  {selectedChat.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Asignado el {format(new Date(selectedChat.assignedAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                </Typography>
              </Box>
              <IconButton>
                <MoreIcon />
              </IconButton>
            </Paper>

            {/* Área de mensajes */}
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 2,
                bgcolor: '#efeae2',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cg opacity="0.05"%3E%3Cpath d="M0 0h100v100H0z"/%3E%3C/g%3E%3C/svg%3E")'
              }}
            >
              {loading && messages.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {messages.map((msg) => (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        justifyContent: msg.from_me ? 'flex-end' : 'flex-start',
                        mb: 1
                      }}
                    >
                      <Paper
                        elevation={1}
                        sx={{
                          p: 1.5,
                          maxWidth: '65%',
                          bgcolor: msg.from_me ? '#d9fdd3' : '#fff',
                          borderRadius: 2
                        }}
                      >
                        {!msg.from_me && (
                          <Typography variant="caption" color="primary" fontWeight={600}>
                            {msg.sender_name || selectedChat.name}
                          </Typography>
                        )}
                        <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                          {msg.text_content}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(msg.timestamp)}
                          </Typography>
                          {msg.from_me && (
                            msg.status === 'read' ? (
                              <DoneAllIcon sx={{ fontSize: 16, color: '#53bdeb' }} />
                            ) : msg.status === 'delivered' ? (
                              <DoneAllIcon sx={{ fontSize: 16, color: '#8696a0' }} />
                            ) : (
                              <CheckIcon sx={{ fontSize: 16, color: '#8696a0' }} />
                            )
                          )}
                        </Box>
                      </Paper>
                    </Box>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </Box>

            {/* Input de mensaje */}
            <Paper elevation={3} sx={{ p: 2, bgcolor: '#f0f2f5' }}>
              {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: 80, right: 20 }}>
                  <EmojiPicker onEmojiClick={handleEmojiClick} />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <EmojiIcon />
                </IconButton>
                <IconButton onClick={() => fileInputRef.current?.click()}>
                  <AttachFileIcon />
                </IconButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                />
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#fff',
                      borderRadius: 3
                    }
                  }}
                />
                <IconButton
                  color="primary"
                  disabled={!messageText.trim() || sending}
                  onClick={handleSendMessage}
                  sx={{
                    bgcolor: '#00a884',
                    color: '#fff',
                    '&:hover': {
                      bgcolor: '#008f6f'
                    },
                    '&.Mui-disabled': {
                      bgcolor: '#e0e0e0'
                    }
                  }}
                >
                  {sending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                </IconButton>
              </Box>
            </Paper>
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary'
            }}
          >
            <Avatar sx={{ width: 120, height: 120, mb: 2, bgcolor: '#e0e0e0' }}>
              <img src="/whatsapp-icon.png" alt="WhatsApp" style={{ width: '80%' }} />
            </Avatar>
            <Typography variant="h5" gutterBottom>
              Winsap - Panel de Agente
            </Typography>
            <Typography>
              Selecciona un chat para comenzar a conversar
            </Typography>
          </Box>
        )}
      </Box>

      {/* Notificaciones */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.type}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AgentDashboardNew;
