import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Avatar,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Badge,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Divider,
  InputAdornment,
  Tooltip,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  GetApp as DownloadIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon,
  Mic as MicIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import EmojiPicker from 'emoji-picker-react';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { Logout as LogoutIcon } from '@mui/icons-material';

// Interfaces
interface AgentChat {
  chat_jid: string;
  session_id: string;
  status: string;
  assigned_at: string;
  notes: string;
  chat_name: string;
  phone_number: string;
  last_message: string;
  last_message_timestamp: string;
  unread_count: number;
  avatar_url?: string;
}

interface Message {
  id: string;
  from_me: boolean;
  text_content: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  message_type: string;
  media_url?: string;
  file_name?: string;
  mime_type?: string;
  sender_name?: string;
  agent_id?: number;
  agent_name?: string;
}

interface ModernAgentChatProps {
  userId?: string;
  sessionId?: string;
  onLogout?: () => void;
}

const ModernAgentChat: React.FC<ModernAgentChatProps> = ({ userId: propUserId, sessionId: propSessionId, onLogout }) => {
  const navigate = useNavigate();

  // Obtener userId y sessionId de props o sessionStorage
  const [userId] = useState(propUserId || sessionStorage.getItem('userId') || '');
  const [sessionId, setSessionId] = useState(propSessionId || sessionStorage.getItem('adminSessionId') || '');
  const [userName] = useState(sessionStorage.getItem('userName') || 'Admin');
  const [userRole] = useState(sessionStorage.getItem('userRole') || 'admin');
  // Estados principales
  const [assignedChats, setAssignedChats] = useState<AgentChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<AgentChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados de carga
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // Estados de UI
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Socket
  const { socket, isConnected, on, off } = useSocket();

  const apiUrl = process.env.REACT_APP_API_URL || window.location.origin;
  const token = sessionStorage.getItem('token');

  // ============== CARGAR CHATS ASIGNADOS ==============
  const loadAssignedChats = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/agent/${userId}/chats?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success && data.chats) {
        // Ordenar por último mensaje
        const sortedChats = data.chats.sort((a: AgentChat, b: AgentChat) => {
          const timeA = new Date(a.last_message_timestamp || 0).getTime();
          const timeB = new Date(b.last_message_timestamp || 0).getTime();
          return timeB - timeA;
        });

        setAssignedChats(sortedChats);
        console.log(`✅ ${sortedChats.length} chats asignados cargados`);
      }
    } catch (error) {
      console.error('Error cargando chats asignados:', error);
    } finally {
      setLoadingChats(false);
    }
  }, [userId, sessionId, apiUrl, token]);

  // ============== CARGAR MENSAJES ==============
  const loadMessages = useCallback(async (chatJid: string) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(`${apiUrl}/api/messages/${sessionId}/${chatJid}?dateFilter=today&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success && data.messages) {
        setMessages(data.messages);
        console.log(`✅ ${data.messages.length} mensajes cargados para ${chatJid}`);

        // Scroll al final después de cargar
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [sessionId, apiUrl, token]);

  // ============== ENVIAR MENSAJE ==============
  const handleSendMessage = async () => {
    if ((!messageText.trim() && !selectedFile) || !selectedChat || sending) return;

    setSending(true);
    const tempMessage = messageText;
    const tempFile = selectedFile;

    // Limpiar input inmediatamente para mejor UX
    setMessageText('');
    setSelectedFile(null);

    try {
      if (tempFile) {
        // Enviar archivo
        const formData = new FormData();
        formData.append('file', tempFile);
        formData.append('sessionId', sessionId);
        formData.append('chatJid', selectedChat.chat_jid);
        formData.append('caption', tempMessage);
        formData.append('sentBy', userId);
        formData.append('sentByName', userName);

        const response = await fetch(`${apiUrl}/api/messages/send-media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) throw new Error('Error enviando archivo');

        console.log('✅ Archivo enviado correctamente');
      } else {
        // Enviar texto
        const response = await fetch(`${apiUrl}/api/messages/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionId,
            chatJid: selectedChat.chat_jid,
            message: tempMessage,
            sentBy: userId,
            sentByName: userName
          })
        });

        if (!response.ok) throw new Error('Error enviando mensaje');

        console.log('✅ Mensaje enviado correctamente');
      }

      // Recargar mensajes para ver el nuevo mensaje
      setTimeout(() => loadMessages(selectedChat.chat_jid), 500);

      // Enfocar el input nuevamente
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      // Restaurar mensaje en caso de error
      setMessageText(tempMessage);
      setSelectedFile(tempFile);
    } finally {
      setSending(false);
    }
  };

  // ============== SELECCIONAR CHAT ==============
  const handleSelectChat = (chat: AgentChat) => {
    setSelectedChat(chat);
    setMessages([]);
    loadMessages(chat.chat_jid);

    // Marcar como leído el chat seleccionado
    setAssignedChats(prev =>
      prev.map(c =>
        c.chat_jid === chat.chat_jid ? { ...c, unread_count: 0 } : c
      )
    );
  };

  // ============== ADJUNTAR ARCHIVO ==============
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // ============== EMOJI ==============
  const handleEmojiClick = (emojiData: any) => {
    setMessageText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // ============== SCROLL ==============
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ============== FORMATO DE TIEMPO ==============
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = diff / (1000 * 60 * 60 * 24);

      if (days < 1) {
        return format(date, 'HH:mm', { locale: es });
      } else if (days < 7) {
        return format(date, 'EEE HH:mm', { locale: es });
      } else {
        return format(date, 'dd/MM/yyyy', { locale: es });
      }
    } catch {
      return '';
    }
  };

  // ============== ICONOS DE ESTADO ==============
  const getStatusIcon = (status: string, fromMe: boolean) => {
    if (!fromMe) return null;

    switch (status) {
      case 'pending':
        return <ScheduleIcon sx={{ fontSize: 16, color: '#8696a0' }} />;
      case 'sent':
        return <CheckIcon sx={{ fontSize: 16, color: '#8696a0' }} />;
      case 'delivered':
        return <DoneAllIcon sx={{ fontSize: 16, color: '#8696a0' }} />;
      case 'read':
        return <DoneAllIcon sx={{ fontSize: 16, color: '#53bdeb' }} />;
      default:
        return <ScheduleIcon sx={{ fontSize: 16, color: '#8696a0' }} />;
    }
  };

  // ============== RENDERIZAR MEDIA ==============
  const renderMedia = (msg: Message) => {
    if (!msg.media_url) return null;

    const mediaUrl = msg.media_url.startsWith('http')
      ? msg.media_url
      : `${apiUrl}${msg.media_url}`;

    switch (msg.message_type) {
      case 'image':
        return (
          <Box
            sx={{
              mb: 1,
              cursor: 'pointer',
              borderRadius: 2,
              overflow: 'hidden',
              maxWidth: 300
            }}
            onClick={() => window.open(mediaUrl, '_blank')}
          >
            <img
              src={mediaUrl}
              alt="Imagen"
              style={{
                width: '100%',
                display: 'block',
                objectFit: 'cover'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </Box>
        );

      case 'video':
        return (
          <Box sx={{ mb: 1, maxWidth: 300 }}>
            <video
              controls
              style={{
                width: '100%',
                borderRadius: 8,
                backgroundColor: '#000'
              }}
              src={mediaUrl}
            />
          </Box>
        );

      case 'audio':
      case 'ptt':
        return (
          <Box sx={{ mb: 1, minWidth: 250 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MicIcon sx={{ color: '#00a884' }} />
              <audio
                controls
                style={{ width: '100%', height: '32px' }}
                src={mediaUrl}
              />
            </Box>
          </Box>
        );

      case 'document':
        return (
          <Box
            sx={{
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              bgcolor: 'rgba(0,0,0,0.05)',
              borderRadius: 2,
              cursor: 'pointer',
              minWidth: 200,
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.08)'
              }
            }}
            onClick={() => window.open(mediaUrl, '_blank')}
          >
            <FileIcon sx={{ fontSize: 36, color: '#00a884' }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {msg.file_name || 'Documento'}
              </Typography>
              {msg.mime_type && (
                <Typography variant="caption" color="text.secondary">
                  {msg.mime_type}
                </Typography>
              )}
            </Box>
            <IconButton size="small">
              <DownloadIcon />
            </IconButton>
          </Box>
        );

      default:
        return null;
    }
  };

  // ============== SOCKET.IO - TIEMPO REAL ==============
  useEffect(() => {
    if (!socket || !isConnected || !selectedChat) return;

    console.log(`🔌 Socket conectado para chat: ${selectedChat.chat_jid}`);

    // Unirse a la sala del chat
    socket.emit('join-chat', { sessionId, chatJid: selectedChat.chat_jid });

    // Escuchar nuevos mensajes
    const handleNewMessage = (data: any) => {
      console.log('💬 Nuevo mensaje recibido:', data);

      const messageChatJid = data.chatJid || data.chat_jid || data.to || data.from;

      if (messageChatJid === selectedChat.chat_jid) {
        // Verificar si el mensaje ya existe
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === data.id);
          if (exists) return prev;

          const newMessage: Message = {
            id: data.id || Date.now().toString(),
            from_me: Boolean(data.isFromMe || data.from_me),
            text_content: data.message || data.text_content || data.text || '',
            timestamp: data.timestamp || new Date().toISOString(),
            status: data.status || 'sent',
            message_type: data.message_type || 'text',
            media_url: data.media_url,
            file_name: data.file_name,
            mime_type: data.mime_type,
            sender_name: data.sender_name,
            agent_id: data.agent_id,
            agent_name: data.agent_name
          };

          setTimeout(() => scrollToBottom(), 100);
          return [...prev, newMessage];
        });
      }

      // Actualizar lista de chats
      setAssignedChats(prev => {
        const chatIndex = prev.findIndex(c => c.chat_jid === messageChatJid);
        if (chatIndex >= 0) {
          const updatedChats = [...prev];
          const chat = updatedChats[chatIndex];

          chat.last_message = data.message || data.text_content || '';
          chat.last_message_timestamp = data.timestamp || new Date().toISOString();

          // Incrementar contador solo si no es el chat seleccionado y no es del usuario
          if (messageChatJid !== selectedChat?.chat_jid && !data.from_me) {
            chat.unread_count = (chat.unread_count || 0) + 1;
          }

          // Mover al inicio
          updatedChats.splice(chatIndex, 1);
          updatedChats.unshift(chat);

          return updatedChats;
        }
        return prev;
      });
    };

    // Escuchar actualizaciones de estado
    const handleStatusUpdate = (data: any) => {
      console.log('✓ Actualización de estado:', data);

      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId || msg.id === data.id
            ? { ...msg, status: data.status }
            : msg
        )
      );
    };

    on('message', handleNewMessage);
    on('message:received', handleNewMessage);
    on('message:sent', handleNewMessage);
    on('message-status-update', handleStatusUpdate);

    return () => {
      socket.emit('leave-chat', { sessionId, chatJid: selectedChat.chat_jid });
      off('message');
      off('message:received');
      off('message:sent');
      off('message-status-update');
    };
  }, [socket, isConnected, selectedChat, sessionId, on, off]);

  // ============== CARGAR DATOS INICIALES ==============
  useEffect(() => {
    loadAssignedChats();

    // Actualizar cada 30 segundos
    const interval = setInterval(loadAssignedChats, 30000);
    return () => clearInterval(interval);
  }, [loadAssignedChats]);

  // ============== FILTRAR CHATS ==============
  const filteredChats = assignedChats.filter(chat =>
    chat.chat_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone_number?.includes(searchTerm) ||
    chat.chat_jid?.includes(searchTerm)
  );

  // ============== LOGOUT ==============
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      sessionStorage.clear();
      localStorage.clear();
      navigate('/login');
    }
  };

  // ============== COLORES TEMA WHATSAPP ==============
  const colors = {
    background: '#0b141a',
    chatListBg: '#111b21',
    chatBg: '#0b141a',
    headerBg: '#202c33',
    myMessage: '#2a3942', // Cambiado de verde a gris oscuro moderno
    theirMessage: '#202c33',
    inputBg: '#2a3942',
    text: '#e9edef',
    textSecondary: '#8696a0',
    divider: '#2a3942',
    hover: '#2a3942',
    selected: '#2a3942'
  };

  // ============== RENDER ==============
  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: colors.background }}>
      {/* ============== LISTA DE CHATS ============== */}
      <Box
        sx={{
          width: 380,
          bgcolor: colors.chatListBg,
          borderRight: `1px solid ${colors.divider}`,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header de lista de chats */}
        <Box sx={{ p: 2, bgcolor: colors.headerBg }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: colors.text, fontWeight: 600 }}>
              Mis Chats Asignados
            </Typography>
            <Tooltip title="Cerrar sesión">
              <IconButton onClick={handleLogout} size="small" sx={{ color: colors.textSecondary }}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Búsqueda */}
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar chat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: colors.inputBg,
                color: colors.text,
                borderRadius: 2,
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: 'transparent' },
                '&.Mui-focused fieldset': { borderColor: '#00a884' }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: colors.textSecondary }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <CloseIcon sx={{ color: colors.textSecondary, fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Lista de chats */}
        <List
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 0,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: colors.divider,
              borderRadius: '3px'
            }
          }}
        >
          {loadingChats ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress sx={{ color: '#00a884' }} />
            </Box>
          ) : filteredChats.length === 0 ? (
            <Box
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              height="100%"
              gap={2}
              p={4}
            >
              <Typography variant="h6" sx={{ color: colors.textSecondary }}>
                {searchTerm ? 'No se encontraron chats' : 'No tienes chats asignados'}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center' }}>
                {searchTerm ? 'Intenta con otro término de búsqueda' : 'Espera a que un administrador te asigne conversaciones'}
              </Typography>
            </Box>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = selectedChat?.chat_jid === chat.chat_jid;

              return (
                <React.Fragment key={chat.chat_jid}>
                  <ListItem
                    disablePadding
                    sx={{
                      bgcolor: isSelected ? colors.selected : 'transparent',
                      '&:hover': { bgcolor: colors.hover }
                    }}
                  >
                    <ListItemButton onClick={() => handleSelectChat(chat)} sx={{ py: 2 }}>
                      <ListItemAvatar>
                        <Badge
                          badgeContent={chat.unread_count || 0}
                          color="success"
                          max={99}
                          sx={{
                            '& .MuiBadge-badge': {
                              bgcolor: '#25d366',
                              color: 'white',
                              fontWeight: 600
                            }
                          }}
                        >
                          <Avatar
                            src={`${apiUrl}/api/avatar/${chat.session_id}/${chat.chat_jid}`}
                            sx={{ width: 48, height: 48, bgcolor: '#00a884' }}
                          >
                            {(chat.chat_name || chat.phone_number || '?').charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>

                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography
                              variant="body1"
                              sx={{
                                color: colors.text,
                                fontWeight: chat.unread_count > 0 ? 600 : 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}
                            >
                              {chat.chat_name || chat.phone_number || 'Sin nombre'}
                            </Typography>
                            {chat.last_message_timestamp && (
                              <Typography variant="caption" sx={{ color: colors.textSecondary, ml: 1 }}>
                                {formatTime(chat.last_message_timestamp)}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            sx={{
                              color: colors.textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: chat.unread_count > 0 ? 500 : 400
                            }}
                          >
                            {chat.last_message || 'No hay mensajes'}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider sx={{ bgcolor: colors.divider }} />
                </React.Fragment>
              );
            })
          )}
        </List>
      </Box>

      {/* ============== ÁREA DE MENSAJES ============== */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedChat ? (
          <>
            {/* Header del chat */}
            <Paper
              elevation={1}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                bgcolor: colors.headerBg,
                borderRadius: 0
              }}
            >
              <Avatar
                src={`${apiUrl}/api/avatar/${selectedChat.session_id}/${selectedChat.chat_jid}`}
                sx={{ width: 40, height: 40, mr: 2, bgcolor: '#00a884' }}
              >
                {(selectedChat.chat_name || selectedChat.phone_number || '?').charAt(0).toUpperCase()}
              </Avatar>

              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ color: colors.text, fontWeight: 600 }}>
                  {selectedChat.chat_name || selectedChat.phone_number || 'Sin nombre'}
                </Typography>
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  {selectedChat.phone_number || selectedChat.chat_jid.replace('@s.whatsapp.net', '')}
                </Typography>
              </Box>

              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: colors.text }}>
                <MoreIcon />
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                <MenuItem onClick={() => setAnchorEl(null)}>Ver información del contacto</MenuItem>
                <MenuItem onClick={() => setAnchorEl(null)}>Buscar mensajes</MenuItem>
                <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>
                  Cerrar conversación
                </MenuItem>
              </Menu>
            </Paper>

            {/* Mensajes */}
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 3,
                bgcolor: colors.chatBg,
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg opacity=\'0.03\'%3E%3Cpath d=\'M30 30 L30 15 L15 15 Z\' fill=\'%23ffffff\'/%3E%3C/g%3E%3C/svg%3E")',
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: colors.divider,
                  borderRadius: '3px'
                }
              }}
            >
              {loadingMessages ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress sx={{ color: '#00a884' }} />
                </Box>
              ) : messages.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                    No hay mensajes en esta conversación
                  </Typography>
                </Box>
              ) : (
                messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.from_me ? 'flex-end' : 'flex-start',
                      mb: 1.5
                    }}
                  >
                    <Paper
                      sx={{
                        maxWidth: '65%',
                        p: 1.5,
                        bgcolor: msg.from_me ? colors.myMessage : colors.theirMessage,
                        borderRadius: msg.from_me ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    >
                      {/* Etiqueta de respuesta - Solo para mensajes enviados por nosotros */}
                      {msg.from_me && msg.agent_name && (
                        <Chip
                          label={msg.agent_name}
                          size="small"
                          sx={{
                            mb: 0.5,
                            height: '20px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: 'rgba(0, 168, 132, 0.2)',
                            color: '#00e676',
                            border: '1px solid rgba(0, 230, 118, 0.3)',
                            '& .MuiChip-label': {
                              px: 1
                            }
                          }}
                        />
                      )}

                      {/* Nombre del remitente */}
                      {msg.sender_name && (
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

                      {/* Renderizar media */}
                      {renderMedia(msg)}

                      {/* Texto del mensaje */}
                      {msg.text_content && msg.text_content !== '0' && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: colors.text,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {msg.text_content}
                        </Typography>
                      )}

                      {/* Tiempo y estado */}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: 11, color: colors.textSecondary }}>
                          {format(new Date(msg.timestamp), 'HH:mm', { locale: es })}
                        </Typography>
                        {getStatusIcon(msg.status, msg.from_me)}
                      </Box>
                    </Paper>
                  </Box>
                ))
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Input de mensaje */}
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                display: 'flex',
                gap: 1,
                alignItems: 'flex-end',
                bgcolor: colors.headerBg,
                borderRadius: 0
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              <Tooltip title="Adjuntar archivo">
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ color: colors.textSecondary }}
                >
                  <AttachFileIcon />
                </IconButton>
              </Tooltip>

              {selectedFile && (
                <Chip
                  label={selectedFile.name}
                  onDelete={() => setSelectedFile(null)}
                  size="small"
                  sx={{
                    maxWidth: 150,
                    bgcolor: colors.inputBg,
                    color: colors.text
                  }}
                />
              )}

              <Box sx={{ position: 'relative', flexGrow: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe un mensaje"
                  variant="outlined"
                  size="small"
                  inputRef={messageInputRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '20px',
                      bgcolor: colors.inputBg,
                      color: colors.text,
                      '& fieldset': { borderColor: 'transparent' },
                      '&:hover fieldset': { borderColor: 'transparent' },
                      '&.Mui-focused fieldset': { borderColor: '#00a884' }
                    }
                  }}
                />
              </Box>

              <Tooltip title="Emoji">
                <IconButton
                  size="small"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  sx={{ color: colors.textSecondary }}
                >
                  <EmojiIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Enviar">
                <IconButton
                  onClick={handleSendMessage}
                  disabled={sending || (!messageText.trim() && !selectedFile)}
                  sx={{
                    bgcolor: '#00a884',
                    color: 'white',
                    '&:hover': { bgcolor: '#008c6d' },
                    '&:disabled': {
                      bgcolor: colors.divider,
                      color: colors.textSecondary
                    }
                  }}
                >
                  {sending ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <SendIcon />}
                </IconButton>
              </Tooltip>
            </Paper>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <Box sx={{ position: 'absolute', bottom: 80, right: 20, zIndex: 1000 }}>
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </Box>
            )}
          </>
        ) : (
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            height="100%"
            bgcolor={colors.chatBg}
            gap={2}
          >
            <ImageIcon sx={{ fontSize: 80, color: colors.textSecondary, opacity: 0.5 }} />
            <Typography variant="h5" sx={{ color: colors.text }}>
              Winsap para Agentes
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', maxWidth: 400 }}>
              Selecciona una conversación de la lista para comenzar a chatear con tus clientes asignados
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ModernAgentChat;
