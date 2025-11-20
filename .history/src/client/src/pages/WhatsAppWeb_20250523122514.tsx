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
  InputAdornment,
  Menu,
  MenuItem,
  Tooltip,
  Snackbar,
  Alert,
  Chip
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
  WhatsApp as WhatsAppIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  Campaign as CampaignIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { io, Socket as SocketIOClient } from 'socket.io-client';
import { whatsappService } from '../services/api';
import { useNavigate } from 'react-router-dom';

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
  status?: 'sent' | 'delivered' | 'read';
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
  background: position === 'left' ? theme.palette.background.paper : '#dcf8c6',
  color: theme.palette.text.primary,
  marginBottom: 8,
  position: 'relative',
  alignSelf: position === 'left' ? 'flex-start' : 'flex-end',
  boxShadow: '0 1px 0.5px rgba(0, 0, 0, 0.13)',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    [position === 'left' ? 'left' : 'right']: -8,
    width: 0,
    height: 0,
    borderTop: '8px solid transparent',
    borderBottom: '8px solid transparent',
    [position === 'left' ? 'borderRight' : 'borderLeft']: `8px solid ${position === 'left' ? theme.palette.background.paper : '#dcf8c6'}`,
  }
}));

const StatusIcon = ({ status }: { status?: string }) => {
  if (!status || status === 'sent') {
    return <CheckIcon fontSize="small" sx={{ opacity: 0.7, fontSize: 14 }} />;
  } else if (status === 'delivered') {
    return <DoneAllIcon fontSize="small" sx={{ opacity: 0.7, fontSize: 14 }} />;
  } else if (status === 'read') {
    return <DoneAllIcon fontSize="small" sx={{ color: '#53bdeb', fontSize: 14 }} />;
  }
  return null;
};

const WhatsAppWeb: React.FC<WhatsAppWebProps> = ({ onLogout }) => {
  const navigate = useNavigate();
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
  const [socket, setSocket] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [messageSearchQuery, setMessageSearchQuery] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);
  const [showChatList, setShowChatList] = useState<boolean>(true);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string>('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');

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
        setAlertMessage('¡Conexión exitosa con WhatsApp!');
        setAlertSeverity('success');
        setShowAlert(true);
      }
    });

    socket.on(`message-${sessionId}`, (data: Message) => {
      setMessages(prevMessages => [...prevMessages, data]);
      scrollToBottom();
      
      if (selectedChat && (data.from === selectedChat.id || data.to === selectedChat.id)) {
        updateChatWithLastMessage(selectedChat.id, data.message, data.timestamp);
      }
      
      // Si es un mensaje entrante y no es del chat seleccionado, incrementar contador de no leídos
      if (data.from !== 'me' && (!selectedChat || data.from !== selectedChat.id)) {
        setChats(prevChats => prevChats.map(chat => {
          if (chat.id === data.from) {
            return {
              ...chat,
              lastMessage: data.message,
              timestamp: data.timestamp,
              unreadCount: (chat.unreadCount || 0) + 1
            };
          }
          return chat;
        }));
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
      
      // Resetear contador de no leídos
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === selectedChat.id) {
          return { ...chat, unreadCount: 0 };
        }
        return chat;
      }));
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
      setAlertMessage('Error al generar código QR');
      setAlertSeverity('error');
      setShowAlert(true);
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
      setAlertMessage('Error al inicializar sesión');
      setAlertSeverity('error');
      setShowAlert(true);
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
      setAlertMessage('Error al obtener código QR');
      setAlertSeverity('error');
      setShowAlert(true);
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
      setAlertMessage('Error al cargar chats');
      setAlertSeverity('error');
      setShowAlert(true);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const response = await whatsappService.getMessages(sessionId, chatId);
      if (response.success) {
        // Asignar estados de mensaje (simulado)
        const messagesWithStatus = response.messages.map((msg: Message) => {
          if (msg.from === 'me') {
            return {
              ...msg,
              status: Math.random() > 0.7 ? 'read' : (Math.random() > 0.3 ? 'delivered' : 'sent')
            };
          }
          return msg;
        });
        
        setMessages(messagesWithStatus);
        scrollToBottom();
        
        // Actualizar último mensaje en la lista de chats
        if (messagesWithStatus.length > 0) {
          const lastMsg = messagesWithStatus[messagesWithStatus.length - 1];
          updateChatWithLastMessage(chatId, lastMsg.message, lastMsg.timestamp);
        }
      }
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
      setAlertMessage('Error al cargar mensajes');
      setAlertSeverity('error');
      setShowAlert(true);
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
        setAlertMessage('Mensaje enviado');
        setAlertSeverity('success');
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setAlertMessage('Error al enviar mensaje');
      setAlertSeverity('error');
      setShowAlert(true);
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleNavigate = (path: string) => {
    handleMenuClose();
    navigate(path);
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMessages = messageSearchQuery
    ? messages.filter(msg =>
        msg.message.toLowerCase().includes(messageSearchQuery.toLowerCase())
      )
    : messages;

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        return 'Hoy';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ayer';
      } else {
        return date.toLocaleDateString();
      }
    } catch (e) {
      return '';
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="primary" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <WhatsAppIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            WhatsApp Web Platform
          </Typography>
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => handleNavigate('/campaigns')}>
              <CampaignIcon sx={{ mr: 1 }} /> Campañas
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('/scheduled')}>
              <ScheduleIcon sx={{ mr: 1 }} /> Mensajes Programados
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('/settings')}>
              <SettingsIcon sx={{ mr: 1 }} /> Configuración
            </MenuItem>
            <Divider />
            <MenuItem onClick={onLogout}>
              <LogoutIcon sx={{ mr: 1 }} /> Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {!isConnected ? (
        <Container maxWidth="md" sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          p: { xs: 2, md: 4 },
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Elementos decorativos de fondo */}
          <Box sx={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            top: '-100px',
            right: '-100px'
          }} />
          <Box sx={{
            position: 'absolute',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            bottom: '-50px',
            left: '-50px'
          }} />
          
          <Paper elevation={6} sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            width: '100%',
            maxWidth: 550,
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            zIndex: 1,
            overflow: 'hidden'
          }}>
            <WhatsAppIcon sx={{
              fontSize: 40,
              color: '#25D366',
              mb: 2
            }} />
            <Typography
              variant="h4"
              gutterBottom
              sx={{
                fontWeight: 700,
                color: '#075E54',
                mb: 3
              }}
            >
              Conecta tu WhatsApp
            </Typography>
            
            {loadingQR ? (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                my: 4
              }}>
                <CircularProgress
                  size={60}
                  thickness={4}
                  sx={{
                    color: '#25D366',
                    mb: 2
                  }}
                />
                <Typography variant="body1" color="text.secondary">
                  Generando código QR seguro...
                </Typography>
              </Box>
            ) : qrCode ? (
              <Box sx={{
                mt: 3,
                mb: 3,
                position: 'relative',
                p: 3,
                mx: 'auto',
                maxWidth: 300,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: '2px dashed #25D366',
                  borderRadius: 2,
                  animation: 'pulse 2s infinite'
                },
                '@keyframes pulse': {
                  '0%': { opacity: 0.6 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.6 }
                }
              }}>
                <img
                  src={qrCode}
                  alt="Código QR de WhatsApp"
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Typography
                  variant="body1"
                  sx={{
                    mt: 3,
                    textAlign: 'center',
                    fontWeight: 500,
                    color: '#075E54',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                  }}
                >
                  <CameraIcon fontSize="small" />
                  Escanea este código con tu WhatsApp
                </Typography>
              </Box>
            ) : (
              <Button
                variant="contained"
                onClick={requestQRCode}
                startIcon={<CameraIcon />}
                sx={{
                  mt: 2,
                  py: 1.5,
                  px: 4,
                  borderRadius: 50,
                  backgroundColor: '#25D366',
                  '&:hover': {
                    backgroundColor: '#128C7E',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(37, 211, 102, 0.3)'
                  },
                  transition: 'all 0.3s ease',
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 500
                }}
              >
                Generar código QR
              </Button>
            )}
            
            <Box sx={{ mt: 4, textAlign: 'left' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#075E54' }}>
                Cómo conectar:
              </Typography>
              <Box component="ol" sx={{
                pl: 2,
                '& li': {
                  mb: 1.5,
                  color: 'text.secondary'
                }
              }}>
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Toca en <strong>Menú</strong> o <strong>Configuración</strong></li>
                <li>Selecciona <strong>Dispositivos vinculados</strong></li>
                <li>Toca en <strong>Vincular un dispositivo</strong></li>
                <li>Apunta tu cámara hacia esta pantalla para escanear el código</li>
              </Box>
            </Box>
          
          </Paper>
        </Container>
      ) : (
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* Lista de chats (visible en desktop o cuando showChatList es true en mobile) */}
          {(showChatList || !isMobile) && (
            <Box sx={{ 
              width: isMobile ? '100%' : 350,
              borderRight: '1px solid rgba(0, 0, 0, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#f0f2f5'
            }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 0, 0, 0.12)', bgcolor: 'white' }}>
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
              
              <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
                {filteredChats.length > 0 ? (
                  filteredChats.map((chat) => (
                    <React.Fragment key={chat.id}>
                      <ListItemButton
                        onClick={() => handleSelectChat(chat)}
                        selected={selectedChat?.id === chat.id}
                        sx={{
                          bgcolor: selectedChat?.id === chat.id ? 'rgba(0, 0, 0, 0.04)' : 'white',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.06)'
                          },
                          py: 1.5
                        }}
                      >
                        <ListItemAvatar>
                          <Badge 
                            color="secondary" 
                            badgeContent={chat.unreadCount} 
                            invisible={!chat.unreadCount}
                          >
                            <Avatar sx={{ bgcolor: chat.isGroup ? 'secondary.main' : 'primary.main' }}>
                              {chat.name[0]}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={chat.name}
                          secondary={chat.lastMessage || 'No hay mensajes'}
                          primaryTypographyProps={{
                            noWrap: true,
                            style: { fontWeight: chat.unreadCount ? 600 : 400 }
                          }}
                          secondaryTypographyProps={{
                            noWrap: true,
                            style: { color: chat.unreadCount ? 'black' : 'inherit', fontWeight: chat.unreadCount ? 500 : 400 }
                          }}
                        />
                        {chat.timestamp && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                              {formatTime(chat.timestamp)}
                            </Typography>
                            {chat.unreadCount ? (
                              <Badge
                                color="primary"
                                badgeContent={chat.unreadCount}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem', height: 18, minWidth: 18 } }}
                              />
                            ) : null}
                          </Box>
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
              height: '100%',
              bgcolor: '#efeae2'
            }}>
              {/* Cabecera del chat */}
              <Box sx={{
                p: 1.5,
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                display: 'flex',
                alignItems: 'center',
                bgcolor: '#f0f2f5'
              }}>
                {isMobile && (
                  <IconButton onClick={handleBackToChats} sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                  </IconButton>
                )}
                <Avatar sx={{ mr: 1.5, bgcolor: selectedChat.isGroup ? 'secondary.main' : 'primary.main' }}>
                  {selectedChat.name[0]}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1">{selectedChat.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedChat.isGroup ? 'Grupo' : 'En línea'}
                  </Typography>
                </Box>
                <TextField
                  placeholder="Buscar en el chat"
                  variant="outlined"
                  size="small"
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  sx={{ mr: 1, maxWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
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
                {filteredMessages.length > 0 ? (
                  filteredMessages.map((msg, index) => {
                    // Verificar si debemos mostrar la fecha
                    const showDate = index === 0 ||
                      formatDate(msg.timestamp) !== formatDate(filteredMessages[index - 1].timestamp);
                    
                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <Box sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            my: 2
                          }}>
                            <Chip
                              label={formatDate(msg.timestamp)}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(225, 245, 254, 0.92)',
                                fontWeight: 500,
                                fontSize: '0.75rem'
                              }}
                            />
                          </Box>
                        )}
                    <MessageBubble 
                      key={msg.id} 
                      position={msg.from === 'me' ? 'right' : 'left'}
                      sx={{
                        alignSelf: msg.from === 'me' ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <Typography variant="body1">{msg.message}</Typography>
                      <Box sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        mt: 0.5,
                        opacity: 0.7
                      }}>
                        <Typography
                          variant="caption"
                          sx={{ mr: msg.from === 'me' ? 0.5 : 0 }}
                        >
                          {formatTime(msg.timestamp)}
                        </Typography>
                        {msg.from === 'me' && <StatusIcon status={msg.status} />}
                      </Box>
                      
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
                      </React.Fragment>
                    );
                  })
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
      
      <Snackbar
        open={showAlert}
        autoHideDuration={4000}
        onClose={() => setShowAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowAlert(false)}
          severity={alertSeverity}
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WhatsAppWeb; 