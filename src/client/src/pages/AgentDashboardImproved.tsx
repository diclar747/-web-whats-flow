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
  Image as ImageIcon,
  Videocam as VideoIcon,
  AudioFile as AudioIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon
} from '@mui/icons-material';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import EmojiPicker from 'emoji-picker-react';
import axios from 'axios';

interface AgentChat {
  chatJid: string;
  contactId?: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTimestamp?: string;
  unreadCount?: number;
  assignedAt: string;
  transferredBy?: string;
}

interface Message {
  id: string;
  chatJid: string;
  from_me: boolean;
  text_content: string;
  timestamp: string;
  status: string;
  message_type: string;
  media_url?: string;
  sender_name?: string;
  sender_avatar?: string;
}

const AgentDashboardImproved: React.FC = () => {
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inicialización
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

      try {
        const response = await axios.get(`/api/auth/agent/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          setSessionId(response.data.sessionId);
          setPhoneNumber(response.data.phoneNumber);
          await loadAgentChats(parseInt(userId), response.data.sessionId);
        }
      } catch (error) {
        console.error('Error al cargar datos del agente:', error);
      }
    };

    initializeAgent();
  }, [navigate]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !agentId) return;

    // Escuchar nuevos chats transferidos
    const handleTransfer = (data: any) => {
      console.log('🔔 Nuevo chat transferido:', data);
      
      const newChat: AgentChat = {
        chatJid: data.chatJid,
        name: data.chatName || data.chatJid.split('@')[0],
        avatar: data.avatar,
        lastMessage: 'Chat transferido',
        lastMessageTimestamp: new Date().toISOString(),
        unreadCount: 1,
        assignedAt: new Date().toISOString(),
        transferredBy: data.transferredFrom
      };

      setChats(prev => [newChat, ...prev]);
      showNotification(`Nuevo chat asignado: ${newChat.name}`, 'info');
    };

    // Escuchar nuevos mensajes
    const handleNewMessage = (data: any) => {
      console.log('📨 Nuevo mensaje recibido:', data);
      
      if (selectedChat && data.chatJid === selectedChat.chatJid) {
        setMessages(prev => [...prev, data.message]);
      }

      // Actualizar último mensaje en la lista
      setChats(prev => prev.map(chat => 
        chat.chatJid === data.chatJid
          ? {
              ...chat,
              lastMessage: data.message.text_content,
              lastMessageTimestamp: data.message.timestamp,
              unreadCount: selectedChat?.chatJid === data.chatJid ? 0 : (chat.unreadCount || 0) + 1
            }
          : chat
      ));
    };

    socket.on('agent:chat:transfer', handleTransfer);
    socket.on('agent:new:message', handleNewMessage);
    socket.on(`agent:${agentId}:transfer`, handleTransfer);
    socket.on(`agent:${agentId}:message`, handleNewMessage);

    return () => {
      socket.off('agent:chat:transfer', handleTransfer);
      socket.off('agent:new:message', handleNewMessage);
      socket.off(`agent:${agentId}:transfer`, handleTransfer);
      socket.off(`agent:${agentId}:message`, handleNewMessage);
    };
  }, [socket, agentId, selectedChat]);

  // Cargar chats del agente
  const loadAgentChats = async (agId: number, sesId: string) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`/api/agents/${agId}/chats`, {
        params: { sessionId: sesId },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setChats(response.data.chats || []);
      }
    } catch (error) {
      console.error('Error cargando chats:', error);
      showNotification('Error al cargar chats', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cargar mensajes de un chat
  const loadMessages = async (chat: AgentChat) => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`/api/messages/${sessionId}/${chat.chatJid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMessages(response.data.messages || []);
        
        // Marcar como leído
        setChats(prev => prev.map(c => 
          c.chatJid === chat.chatJid ? { ...c, unreadCount: 0 } : c
        ));
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      showNotification('Error al cargar mensajes', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Enviar mensaje
  const sendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;
    if (!selectedChat || !sessionId || !phoneNumber) {
      showNotification('Sesión de WhatsApp no disponible', 'error');
      return;
    }

    setSending(true);
    try {
      const token = sessionStorage.getItem('token');
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('phoneNumber', phoneNumber);
      formData.append('chatJid', selectedChat.chatJid);
      formData.append('message', messageText);
      formData.append('agentId', agentId?.toString() || '');

      if (selectedFile) {
        formData.append('file', selectedFile);
        formData.append('fileType', selectedFile.type);
      }

      const response = await axios.post('/api/messages/send', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        const newMessage: Message = {
          id: Date.now().toString(),
          chatJid: selectedChat.chatJid,
          from_me: true,
          text_content: messageText,
          timestamp: new Date().toISOString(),
          status: 'sent',
          message_type: selectedFile ? 'media' : 'text',
          media_url: selectedFile ? previewUrl || undefined : undefined
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageText('');
        setSelectedFile(null);
        setPreviewUrl(null);
        showNotification('Mensaje enviado', 'success');
      }
    } catch (error: any) {
      console.error('Error enviando mensaje:', error);
      showNotification(error.response?.data?.error || 'Error al enviar mensaje', 'error');
    } finally {
      setSending(false);
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Formatear hora
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'HH:mm', { locale: es });
  };

  // Formatear fecha del chat
  const formatChatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return format(date, 'HH:mm', { locale: es });
    if (isYesterday(date)) return 'Ayer';
    return format(date, 'dd/MM/yyyy', { locale: es });
  };

  // Obtener icono de estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckIcon sx={{ fontSize: 16, color: '#8696a0' }} />;
      case 'delivered': return <DoneAllIcon sx={{ fontSize: 16, color: '#8696a0' }} />;
      case 'read': return <DoneAllIcon sx={{ fontSize: 16, color: '#53bdeb' }} />;
      default: return null;
    }
  };

  // Mostrar notificación
  const showNotification = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity: severity as 'success' | 'error' });
  };

  // Cerrar sesión
  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    navigate('/login');
  };

  // Filtrar chats
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f0f2f5' }}>
      {/* Barra superior */}
      <AppBar position="static" sx={{ bgcolor: '#128c7e', width: '100%' }}>
        <Toolbar>
          <Avatar sx={{ bgcolor: '#075e54', mr: 2 }}>
            {userName.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {userName} - Panel de Agente
          </Typography>
          <Chip 
            label={isConnected ? 'Conectado' : 'Desconectado'}
            color={isConnected ? 'success' : 'error'}
            size="small"
            sx={{ mr: 2 }}
          />
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Salir
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Lista de chats */}
        <Paper
          elevation={0}
          sx={{
            width: 400,
            borderRight: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'white'
          }}
        >
          {/* Búsqueda */}
          <Box sx={{ p: 2, bgcolor: '#f0f2f5' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar chat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#8696a0' }} />
                  </InputAdornment>
                ),
                sx: { bgcolor: 'white', borderRadius: 2 }
              }}
            />
          </Box>

          {/* Lista de chats */}
          <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
            {loading && chats.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredChats.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="textSecondary">
                  No hay chats asignados
                </Typography>
              </Box>
            ) : (
              filteredChats.map((chat) => (
                <React.Fragment key={chat.chatJid}>
                  <ListItem
                    button
                    selected={selectedChat?.chatJid === chat.chatJid}
                    onClick={() => {
                      setSelectedChat(chat);
                      loadMessages(chat);
                    }}
                    sx={{
                      py: 2,
                      '&:hover': { bgcolor: '#f5f5f5' },
                      '&.Mui-selected': { bgcolor: '#ebebeb' }
                    }}
                  >
                    <ListItemAvatar>
                      <Badge
                        badgeContent={chat.unreadCount || 0}
                        color="primary"
                        invisible={!chat.unreadCount}
                      >
                        <Avatar
                          src={chat.avatar}
                          alt={chat.name}
                          sx={{ width: 50, height: 50 }}
                        >
                          {chat.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body1" sx={{ fontWeight: chat.unreadCount ? 600 : 400 }}>
                            {chat.name}
                          </Typography>
                          {chat.lastMessageTimestamp && (
                            <Typography variant="caption" color="textSecondary">
                              {formatChatDate(chat.lastMessageTimestamp)}
                            </Typography>
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          noWrap
                          sx={{ fontWeight: chat.unreadCount ? 600 : 400 }}
                        >
                          {chat.lastMessage || 'Sin mensajes'}
                        </Typography>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>

        {/* Panel de chat */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#efeae2' }}>
          {selectedChat ? (
            <>
              {/* Encabezado del chat */}
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: '#f0f2f5'
                }}
              >
                <Avatar
                  src={selectedChat.avatar}
                  alt={selectedChat.name}
                  sx={{ width: 40, height: 40, mr: 2 }}
                >
                  {selectedChat.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedChat.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {selectedChat.chatJid.split('@')[0]}
                  </Typography>
                </Box>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                  <MoreIcon />
                </IconButton>
              </Paper>

              {/* Mensajes */}
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2,
                  backgroundImage: 'url("/static/whatsapp-bg.png")',
                  backgroundSize: 'cover'
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 4 }}>
                    <Typography color="textSecondary">
                      No hay mensajes en este chat
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
                        elevation={1}
                        sx={{
                          maxWidth: '65%',
                          p: 1.5,
                          bgcolor: msg.from_me ? '#d9fdd3' : 'white',
                          borderRadius: 2
                        }}
                      >
                        {msg.media_url && (
                          <Box sx={{ mb: 1 }}>
                            {msg.message_type === 'image' ? (
                              <img
                                src={msg.media_url}
                                alt="Imagen"
                                style={{ maxWidth: '100%', borderRadius: 8 }}
                              />
                            ) : msg.message_type === 'video' ? (
                              <video
                                src={msg.media_url}
                                controls
                                style={{ maxWidth: '100%', borderRadius: 8 }}
                              />
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FileIcon />
                                <Typography variant="body2">Archivo adjunto</Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                          {msg.text_content}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Typography variant="caption" color="textSecondary">
                            {formatMessageTime(msg.timestamp)}
                          </Typography>
                          {msg.from_me && getStatusIcon(msg.status)}
                        </Box>
                      </Paper>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Preview de archivo */}
              {previewUrl && (
                <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid #e0e0e0' }}>
                  <Box sx={{ position: 'relative', display: 'inline-block' }}>
                    <img src={previewUrl} alt="Preview" style={{ maxHeight: 100, borderRadius: 8 }} />
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'white'
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              )}

              {/* Campo de mensaje */}
              <Paper
                elevation={1}
                sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f0f2f5' }}
              >
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
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
                      sendMessage();
                    }
                  }}
                  sx={{ bgcolor: 'white', borderRadius: 3 }}
                />

                <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <EmojiIcon />
                </IconButton>

                <IconButton
                  color="primary"
                  onClick={sendMessage}
                  disabled={(!messageText.trim() && !selectedFile) || sending}
                >
                  {sending ? <CircularProgress size={24} /> : <SendIcon />}
                </IconButton>
              </Paper>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: 70, right: 20, zIndex: 1000 }}>
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      setMessageText(prev => prev + emojiData.emoji);
                      setShowEmojiPicker(false);
                    }}
                  />
                </Box>
              )}
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4
              }}
            >
              <Typography variant="h5" color="textSecondary" gutterBottom>
                Selecciona un chat
              </Typography>
              <Typography color="textSecondary">
                Elige una conversación para comenzar a responder
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Menu de archivos */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            imageInputRef.current?.click();
            setAnchorEl(null);
          }}
        >
          <ImageIcon sx={{ mr: 1 }} /> Imagen
        </MenuItem>
        <MenuItem
          onClick={() => {
            videoInputRef.current?.click();
            setAnchorEl(null);
          }}
        >
          <VideoIcon sx={{ mr: 1 }} /> Video
        </MenuItem>
        <MenuItem
          onClick={() => {
            audioInputRef.current?.click();
            setAnchorEl(null);
          }}
        >
          <AudioIcon sx={{ mr: 1 }} /> Audio
        </MenuItem>
        <MenuItem
          onClick={() => {
            fileInputRef.current?.click();
            setAnchorEl(null);
          }}
        >
          <FileIcon sx={{ mr: 1 }} /> Documento
        </MenuItem>
      </Menu>

      {/* Inputs ocultos */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, 'image')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, 'video')}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, 'audio')}
      />
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, 'document')}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AgentDashboardImproved;
