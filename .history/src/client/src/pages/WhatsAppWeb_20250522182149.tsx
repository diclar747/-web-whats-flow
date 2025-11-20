import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Container, 
  Grid, 
  Avatar, 
  IconButton, 
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Divider,
  Badge,
  CircularProgress,
  AppBar,
  Toolbar,
  InputAdornment
} from '@mui/material';
import { 
  Send as SendIcon, 
  AttachFile as AttachFileIcon, 
  Mic as MicIcon, 
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  InsertEmoticon as EmojiIcon,
  PhotoCamera as CameraIcon,
  ArrowBack as ArrowBackIcon,
  Logout as LogoutIcon,
  WhatsApp as WhatsAppIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { io, Socket as SocketIOClient } from 'socket.io-client';
import { whatsappService } from '../services/api';

interface WhatsAppWebProps {
  onLogout: () => void;
}

interface Message {
  id: string;
  from: string;
  to?: string;
  message: string;
  timestamp: string;
  type: string;
  mediaUrl?: string;
}

interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  profilePic?: string;
  participants?: any[];
}

const MessageBubble = styled(Box)(({ theme, position }: { theme?: any, position: 'left' | 'right' }) => ({
  maxWidth: '70%',
  padding: '8px 12px',
  borderRadius: '8px',
  background: position === 'left' ? theme.palette.background.paper : theme.palette.primary.main,
  color: position === 'left' ? theme.palette.text.primary : theme.palette.primary.contrastText,
  marginBottom: 8,
  position: 'relative',
  alignSelf: position === 'left' ? 'flex-start' : 'flex-end',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    [position === 'left' ? 'left' : 'right']: -8,
    width: 0,
    height: 0,
    borderTop: '8px solid transparent',
    borderBottom: '8px solid transparent',
    [position === 'left' ? 'borderRight' : 'borderLeft']: `8px solid ${position === 'left' ? theme.palette.background.paper : theme.palette.primary.main}`,
  }
}));

const WhatsAppWeb: React.FC<WhatsAppWebProps> = ({ onLogout }) => {
  const [sessionId, setSessionId] = useState<string>(localStorage.getItem('sessionId') || '');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [loadingQR, setLoadingQR] = useState<boolean>(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isAttachmentOpen, setIsAttachmentOpen] = useState<boolean>(false);
  const [loadingSend, setLoadingSend] = useState<boolean>(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [socket, setSocket] = useState<SocketIOClient | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);
  const [showChatList, setShowChatList] = useState<boolean>(true);

  // Manejar cambio de tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setShowChatList(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Conectar socket.io
  useEffect(() => {
    const socketInstance = io(process.env.REACT_APP_API_URL || 'http://localhost:3001');
    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Suscribirse a eventos de socket.io
  useEffect(() => {
    if (!socket || !sessionId) return;

    socket.on(`qr-${sessionId}`, (data: { qr?: string }) => {
      if (data.qr) {
        generateQRDataURL(data.qr);
      }
    });

    socket.on(`connection-${sessionId}`, (data: { status: string }) => {
      setIsConnected(data.status === 'connected');
      if (data.status === 'connected') {
        setQrCode('');
        loadChats();
      }
    });

    socket.on(`message-${sessionId}`, (data: Message) => {
      setMessages(prevMessages => [...prevMessages, data]);
      scrollToBottom();
      
      if (selectedChat && (data.from === selectedChat.id || data.to === selectedChat.id)) {
        updateChatWithLastMessage(selectedChat.id, data.message, data.timestamp);
      }
    });

    socket.emit('join-session', sessionId);

    return () => {
      socket.off(`qr-${sessionId}`);
      socket.off(`connection-${sessionId}`);
      socket.off(`message-${sessionId}`);
      socket.emit('leave-session', sessionId);
    };
  }, [socket, sessionId, selectedChat]);

  // Cargar estado inicial de la sesión
  useEffect(() => {
    if (sessionId) {
      checkSessionStatus();
    } else {
      initializeSession();
    }
  }, [sessionId]);

  // Cargar mensajes cuando se selecciona un chat
  useEffect(() => {
    if (selectedChat && sessionId) {
      loadMessages(selectedChat.id);
    }
  }, [selectedChat, sessionId]);

  // Desplazar al final de los mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateQRDataURL = async (qrData: string) => {
    try {
      const response = await whatsappService.getQRCode(sessionId);
      if (response.qrDataUrl) {
        setQrCode(response.qrDataUrl);
      }
    } catch (error) {
      console.error('Error al generar QR:', error);
    }
  };

  const checkSessionStatus = async () => {
    try {
      const response = await whatsappService.getSessionStatus(sessionId);
      setIsConnected(response.isConnected);
      
      if (response.isConnected) {
        loadChats();
      } else if (response.hasQR) {
        requestQRCode();
      }
    } catch (error) {
      console.error('Error al verificar estado de sesión:', error);
      initializeSession();
    }
  };

  const initializeSession = async () => {
    setLoadingQR(true);
    try {
      const response = await whatsappService.getQRCode();
      if (response.success) {
        setSessionId(response.sessionId);
        localStorage.setItem('sessionId', response.sessionId);
        setQrCode(response.qrDataUrl);
        setIsConnected(response.isConnected);
      }
    } catch (error) {
      console.error('Error al inicializar sesión:', error);
    } finally {
      setLoadingQR(false);
    }
  };

  const requestQRCode = async () => {
    setLoadingQR(true);
    try {
      const response = await whatsappService.getQRCode(sessionId);
      if (response.success) {
        setQrCode(response.qrDataUrl);
      }
    } catch (error) {
      console.error('Error al obtener QR:', error);
    } finally {
      setLoadingQR(false);
    }
  };

  const loadChats = async () => {
    try {
      const response = await whatsappService.getChats(sessionId);
      if (response.success) {
        // Transformar el formato si es necesario
        const formattedChats: Chat[] = response.chats.map((chat: any) => ({
          id: chat.id,
          name: chat.name || 'Chat',
          isGroup: chat.isGroup,
          lastMessage: '', // Se actualizará al cargar mensajes
          unreadCount: 0
        }));
        setChats(formattedChats);
      }
    } catch (error) {
      console.error('Error al cargar chats:', error);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const response = await whatsappService.getMessages(sessionId, chatId);
      if (response.success) {
        setMessages(response.messages);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || loadingSend) return;
    
    setLoadingSend(true);
    try {
      const response = await whatsappService.sendMessage(
        sessionId, 
        selectedChat.id, 
        newMessage
      );
      
      if (response.success) {
        setNewMessage('');
        // El mensaje se agregará a través del socket
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    } finally {
      setLoadingSend(false);
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    if (isMobile) {
      setShowChatList(false);
    }
  };

  const updateChatWithLastMessage = (chatId: string, message: string, timestamp: string) => {
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === chatId) {
        return { ...chat, lastMessage: message, timestamp };
      }
      return chat;
    }));
  };

  const handleBackToChats = () => {
    setShowChatList(true);
    setSelectedChat(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="primary" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            WhatsApp Web Platform
          </Typography>
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {!isConnected ? (
        <Container maxWidth="md" sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          p: 4
        }}>
          <Paper elevation={3} sx={{
            p: 4,
            borderRadius: 4,
            width: '100%',
            maxWidth: 500,
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}>
          <Typography variant="h5" gutterBottom>
            Conecta tu WhatsApp
          </Typography>
          
          {loadingQR ? (
            <CircularProgress />
          ) : qrCode ? (
            <Box sx={{ mt: 3, mb: 3 }}>
              <img src={qrCode} alt="QR Code" style={{ maxWidth: '100%', height: 'auto' }} />
              <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
                Escanea este código QR con tu WhatsApp
              </Typography>
            </Box>
          ) : (
            <Button 
              variant="contained" 
              onClick={requestQRCode}
              startIcon={<CameraIcon />}
              sx={{ mt: 2 }}
            >
              Generar código QR
            </Button>
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 4, maxWidth: 400, textAlign: 'center' }}>
            Abre WhatsApp en tu teléfono, ve a Ajustes &gt; Dispositivos vinculados &gt; Vincular un dispositivo
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Lista de chats (visible en desktop o cuando showChatList es true en mobile) */}
          {(showChatList || !isMobile) && (
            <Box sx={{ 
              width: isMobile ? '100%' : 350, 
              borderRight: '1px solid rgba(0, 0, 0, 0.12)', 
              display: 'flex', 
              flexDirection: 'column'
            }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
                <TextField
                  fullWidth
                  placeholder="Buscar o empezar un nuevo chat"
                  variant="outlined"
                  size="small"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              
              <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                {filteredChats.length > 0 ? (
                  filteredChats.map((chat) => (
                    <React.Fragment key={chat.id}>
                      <ListItemButton 
                        onClick={() => handleSelectChat(chat)}
                        selected={selectedChat?.id === chat.id}
                      >
                        <ListItemAvatar>
                          <Badge 
                            color="secondary" 
                            badgeContent={chat.unreadCount} 
                            invisible={!chat.unreadCount}
                          >
                            <Avatar>{chat.name[0]}</Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText 
                          primary={chat.name} 
                          secondary={chat.lastMessage || 'No hay mensajes'}
                          primaryTypographyProps={{
                            noWrap: true,
                            style: { fontWeight: chat.unreadCount ? 600 : 400 }
                          }}
                          secondaryTypographyProps={{ noWrap: true }}
                        />
                        {chat.timestamp && (
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(chat.timestamp)}
                          </Typography>
                        )}
                      </ListItemButton>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No se encontraron chats
                    </Typography>
                  </Box>
                )}
              </List>
            </Box>
          )}
          
          {/* Área de chat (visible cuando hay un chat seleccionado y en mobile cuando showChatList es false) */}
          {selectedChat && (!showChatList || !isMobile) && (
            <Box sx={{ 
              flexGrow: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%' 
            }}>
              {/* Cabecera del chat */}
              <Box sx={{ 
                p: 1.5, 
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)', 
                display: 'flex', 
                alignItems: 'center' 
              }}>
                {isMobile && (
                  <IconButton onClick={handleBackToChats} sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                  </IconButton>
                )}
                <Avatar sx={{ mr: 1.5 }}>{selectedChat.name[0]}</Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1">{selectedChat.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedChat.isGroup ? 'Grupo' : 'En línea'}
                  </Typography>
                </Box>
                <IconButton>
                  <SearchIcon />
                </IconButton>
                <IconButton>
                  <MoreVertIcon />
                </IconButton>
              </Box>
              
              {/* Área de mensajes */}
              <Box sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                p: 2, 
                backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-light_04fcacde539c58cca6745483d4858c52.png")', 
                backgroundRepeat: 'repeat',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {messages.length > 0 ? (
                  messages.map((msg) => (
                    <MessageBubble 
                      key={msg.id} 
                      position={msg.from === 'me' ? 'right' : 'left'}
                      sx={{
                        alignSelf: msg.from === 'me' ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <Typography variant="body1">{msg.message}</Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: 'block', 
                          textAlign: 'right', 
                          mt: 0.5, 
                          opacity: 0.7 
                        }}
                      >
                        {formatTime(msg.timestamp)}
                      </Typography>
                      
                      {msg.mediaUrl && msg.type === 'image' && (
                        <Box sx={{ mt: 1 }}>
                          <img 
                            src={msg.mediaUrl} 
                            alt="Shared media" 
                            style={{ maxWidth: '100%', borderRadius: 4 }} 
                          />
                        </Box>
                      )}
                    </MessageBubble>
                  ))
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    opacity: 0.6
                  }}>
                    <Typography color="text.secondary">
                      No hay mensajes aún
                    </Typography>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </Box>
              
              {/* Área de envío de mensajes */}
              <Box sx={{ 
                p: 2, 
                borderTop: '1px solid rgba(0, 0, 0, 0.12)', 
                display: 'flex', 
                alignItems: 'center',
                backgroundColor: theme => theme.palette.background.paper
              }}>
                <IconButton>
                  <EmojiIcon />
                </IconButton>
                <IconButton onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}>
                  <AttachFileIcon />
                </IconButton>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder="Escribe un mensaje"
                  variant="outlined"
                  size="small"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  sx={{ mx: 1 }}
                  disabled={loadingSend}
                />
                <IconButton onClick={handleSendMessage} disabled={!newMessage.trim() || loadingSend}>
                  {loadingSend ? <CircularProgress size={24} /> : <SendIcon />}
                </IconButton>
              </Box>
            </Box>
          )}
          
          {/* Pantalla de bienvenida cuando no hay chat seleccionado */}
          {!selectedChat && !showChatList && (
            <Box sx={{ 
              flexGrow: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              p: 4,
              bgcolor: 'background.default'
            }}>
              <Avatar 
                sx={{ 
                  width: 100, 
                  height: 100, 
                  mb: 3, 
                  bgcolor: 'primary.main' 
                }}
              >
                <WhatsAppIcon sx={{ fontSize: 60 }} />
              </Avatar>
              <Typography variant="h5" gutterBottom>
                WhatsApp Web Platform
              </Typography>
              <Typography color="text.secondary" align="center" sx={{ maxWidth: 500 }}>
                Selecciona un chat para comenzar a enviar mensajes o utiliza el panel de búsqueda para encontrar contactos.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default WhatsAppWeb; 