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
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  AppBar,
  Toolbar,
  InputAdornment,
  Alert,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Logout as LogoutIcon,
  WhatsApp as WhatsAppIcon,
  Image as ImageIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  Chat,
  Refresh,
} from '@mui/icons-material';
import { whatsappAPI, initializeSocket, socketEvents } from '../services/api';

interface Message {
  id: string;
  from: string;
  to?: string;
  message: string;
  timestamp: string;
  type: string;
  mediaUrl?: string;
}

interface ChatData {
  id: string;
  name: string;
  isGroup: boolean;
  participants?: Array<{
    id: string;
    admin: boolean;
  }>;
}

interface SimpleWhatsAppProps {
  sessionId: string;
  onLogout: () => void;
}

const SimpleWhatsApp: React.FC<SimpleWhatsAppProps> = ({ sessionId, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<ChatData[]>([]);
  const [activeChat, setActiveChat] = useState<ChatData | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inicializar socket y cargar datos
  useEffect(() => {
    const socket = initializeSocket();
    
    // Configurar eventos de socket
    socketEvents.joinSession(sessionId);
    
    // Escuchar nuevos mensajes
    socketEvents.onNewMessage(sessionId, (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Escuchar actualizaciones de chats
    socketEvents.onChatsUpdate(sessionId, () => {
      loadChats();
    });

    // Cargar datos iniciales
    loadChats();
    loadMessages();

    return () => {
      socketEvents.leaveSession(sessionId);
      socketEvents.removeAllListeners();
    };
  }, [sessionId]);

  // Auto-scroll a nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChats = async () => {
    try {
      const response = await whatsappAPI.getChats(sessionId);
      if (response.success && response.data) {
        const transformedChats = response.data.chats.map((chat: any) => ({
          id: chat.id,
          name: chat.name || 'Chat sin nombre',
          isGroup: chat.isGroup,
          participants: chat.participants,
        }));
        setChats(transformedChats);
      }
    } catch (error) {
      console.error('Error cargando chats:', error);
      setError('Error al cargar chats');
    }
  };

  const loadMessages = async (chatId?: string) => {
    try {
      const response = await whatsappAPI.getMessages(sessionId, chatId);
      if (response.success && response.data) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      setError('Error al cargar mensajes');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    setLoading(true);
    try {
      await whatsappAPI.sendMessage(sessionId, activeChat.id, newMessage);
      setNewMessage('');
      setSuccess('Mensaje enviado');
      // El mensaje aparecerá automáticamente vía socket
    } catch (error) {
      setError('Error al enviar mensaje');
    } finally {
      setLoading(false);
    }
  };

  const sendImage = async (imageUrl: string, caption?: string) => {
    if (!activeChat) return;

    setLoading(true);
    try {
      await whatsappAPI.sendImage(sessionId, activeChat.id, imageUrl, caption);
      setSuccess('Imagen enviada');
    } catch (error) {
      setError('Error al enviar imagen');
    } finally {
      setLoading(false);
    }
  };

  const handleChatSelect = (chat: ChatData) => {
    setActiveChat(chat);
    loadMessages(chat.id);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isMyMessage = (from: string) => {
    return from === 'me' || from.includes('me');
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#075e54' }}>
        <Toolbar>
          <WhatsAppIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            WhatsApp Web - {activeChat ? activeChat.name : 'Selecciona un chat'}
          </Typography>
          <Button 
            color="inherit" 
            onClick={() => loadChats()}
            startIcon={<Refresh />}
            sx={{ mr: 2 }}
          >
            Actualizar
          </Button>
          <Button 
            color="inherit" 
            onClick={onLogout}
            startIcon={<LogoutIcon />}
          >
            Salir
          </Button>
        </Toolbar>
      </AppBar>

      {/* Alertas */}
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ m: 1 }}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert 
          severity="success" 
          onClose={() => setSuccess(null)}
          sx={{ m: 1 }}
        >
          {success}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Chat List */}
        <Paper sx={{ width: 350, height: '100%', overflow: 'auto' }}>
          <Box sx={{ p: 2, bgcolor: '#f0f2f5', borderBottom: '1px solid #e9edef' }}>
            <Typography variant="h6">Chats</Typography>
            <Typography variant="body2" color="textSecondary">
              {chats.length} conversaciones
            </Typography>
          </Box>
          
          {chats.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <WhatsAppIcon sx={{ fontSize: 48, color: '#8696a0', mb: 1 }} />
              <Typography variant="body2" color="textSecondary">
                No hay chats disponibles
              </Typography>
              <Button 
                variant="outlined" 
                onClick={loadChats}
                sx={{ mt: 2 }}
              >
                Cargar chats
              </Button>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {chats.map((chat) => (
                <ListItem key={chat.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleChatSelect(chat)}
                    selected={activeChat?.id === chat.id}
                    sx={{
                      py: 1.5,
                      '&.Mui-selected': {
                        bgcolor: '#e7f3ff',
                        borderRight: '3px solid #00a884',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#00a884' }}>
                        {chat.isGroup ? '👥' : chat.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={chat.name}
                      secondary={chat.isGroup ? 'Grupo' : 'Chat personal'}
                      primaryTypographyProps={{
                        fontWeight: activeChat?.id === chat.id ? 600 : 400,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        {/* Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!activeChat ? (
            <Box 
              sx={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                bgcolor: '#f0f2f5'
              }}
            >
              <Card sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
                <CardContent>
                  <WhatsAppIcon sx={{ fontSize: 64, color: '#00a884', mb: 2 }} />
                  <Typography variant="h5" gutterBottom>
                    WhatsApp Web
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    Selecciona un chat para comenzar a enviar mensajes
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          ) : (
            <>
              {/* Chat Header */}
              <Box sx={{ p: 2, bgcolor: '#f0f2f5', borderBottom: '1px solid #e9edef' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ mr: 2, bgcolor: '#00a884' }}>
                    {activeChat.isGroup ? '👥' : activeChat.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {activeChat.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {activeChat.isGroup ? `Grupo • ${activeChat.id}` : activeChat.id}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Messages */}
              <Box 
                sx={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  p: 2, 
                  bgcolor: '#efeae2',
                }}
              >
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="textSecondary">
                      No hay mensajes en esta conversación
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: isMyMessage(message.from) ? 'flex-end' : 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Paper
                        sx={{
                          maxWidth: '70%',
                          p: 1.5,
                          bgcolor: isMyMessage(message.from) ? '#dcf8c6' : '#ffffff',
                          borderRadius: '8px',
                          position: 'relative',
                        }}
                      >
                        {message.type === 'image' && message.mediaUrl && (
                          <Box sx={{ mb: 1 }}>
                            <img 
                              src={message.mediaUrl} 
                              alt="Imagen" 
                              style={{ 
                                maxWidth: '100%', 
                                borderRadius: '4px',
                                display: 'block'
                              }} 
                            />
                          </Box>
                        )}
                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                          {message.message}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
                          <Typography variant="caption" color="textSecondary" sx={{ mr: 1 }}>
                            {formatTime(message.timestamp)}
                          </Typography>
                          {isMyMessage(message.from) && (
                            <CheckIcon sx={{ fontSize: 14, color: '#8696a0' }} />
                          )}
                        </Box>
                      </Paper>
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Message Input */}
              <Box sx={{ p: 2, bgcolor: '#f0f2f5', borderTop: '1px solid #e9edef' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    sx={{
                      bgcolor: 'white',
                      borderRadius: '20px',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '20px',
                      },
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => {
                              const url = prompt('URL de la imagen:');
                              if (url) {
                                const caption = prompt('Mensaje (opcional):');
                                sendImage(url, caption || undefined);
                              }
                            }}
                            size="small"
                          >
                            <ImageIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <IconButton
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || loading}
                    sx={{
                      bgcolor: '#00a884',
                      color: 'white',
                      '&:hover': {
                        bgcolor: '#008069',
                      },
                      '&.Mui-disabled': {
                        bgcolor: '#8696a0',
                        color: 'white',
                      },
                    }}
                  >
                    {loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                  </IconButton>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SimpleWhatsApp; 