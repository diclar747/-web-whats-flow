import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Avatar,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Chip
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  ArrowBack as BackIcon,
  MoreVert as MoreIcon,
  Image as ImageIcon,
  Description as FileIcon,
  Videocam as VideoIcon,
  Mic as AudioIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  GetApp as DownloadIcon,
  Description as DocumentIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import EmojiPicker from 'emoji-picker-react';
import { useSocket } from '../context/SocketContext';

interface Message {
  id: string;
  from_me: boolean;
  text_content: string;
  timestamp: string;
  status: string;
  message_type: string;
  media_url?: string;
  file_name?: string;
  mime_type?: string;
  sender_name?: string;
}

interface AgentChatInterfaceProps {
  sessionId: string;
  chatId: string;
  chatName: string;
  chatAvatar?: string;
  onBack: () => void;
}

const AgentChatInterface: React.FC<AgentChatInterfaceProps> = ({
  sessionId,
  chatId,
  chatName,
  chatAvatar,
  onBack
}) => {
  const { socket, isConnected, on, off } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.REACT_APP_API_URL || window.location.origin;

  // Cargar mensajes
  const loadMessages = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/messages/${sessionId}/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
  }, [sessionId, chatId]);

  useEffect(() => {
    loadMessages();
    // Reducir frecuencia de polling ya que ahora tenemos socket
    const interval = setInterval(loadMessages, 10000); // Cada 10 segundos como backup
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Escuchar eventos de socket en tiempo real
  useEffect(() => {
    if (!socket || !isConnected || !chatId) return;

    console.log(`[AGENT-CHAT] Socket conectado para chat ${chatId}`);

    // Evento de nuevo mensaje
    const handleNewMessage = (data: any) => {
      console.log('[AGENT-CHAT] Nuevo mensaje recibido:', data);

      const messageChatJid = data.chatJid || data.chat_jid || data.to || data.from;
      if (messageChatJid !== chatId) return;

      // Verificar si el mensaje ya existe
      setMessages(prev => {
        const exists = prev.some(msg =>
          msg.id === data.id ||
          (msg.text_content === data.text_content && msg.timestamp === data.timestamp)
        );

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
          sender_name: data.sender_name
        };

        return [...prev, newMessage];
      });
    };

    // Evento de actualización de estado de mensaje
    const handleMessageStatusUpdate = (data: any) => {
      console.log('[AGENT-CHAT] Actualización de estado:', data);

      const messageChatJid = data.chatJid || data.chat_jid;
      if (messageChatJid && messageChatJid !== chatId) return;

      setMessages(prev => {
        let updated = false;
        const newMessages = prev.map(msg => {
          // Coincidir por ID exacto
          if (msg.id === data.messageId || msg.id === data.id) {
            console.log(`[AGENT-CHAT] ✅ Actualizando estado por ID: ${msg.id} -> ${data.status}`);
            updated = true;
            return { ...msg, status: data.status };
          }

          // Fallback: coincidir por chat y timestamp reciente (últimos 60 segundos)
          // Esto ayuda cuando el ID temporal no coincide con el ID final de Baileys
          if (!updated && msg.from_me && data.chatJid === chatId) {
            const msgTime = new Date(msg.timestamp).getTime();
            const updateTime = new Date(data.timestamp || Date.now()).getTime();
            const timeDiff = Math.abs(updateTime - msgTime);

            // Si el mensaje fue enviado en los últimos 60 segundos y aún está pending/sent
            if (timeDiff < 60000 && (msg.status === 'pending' || msg.status === 'sent')) {
              console.log(`[AGENT-CHAT] ⚠️ Actualizando estado por proximidad temporal: ${msg.id} -> ${data.status}`);
              updated = true;
              return { ...msg, status: data.status };
            }
          }

          return msg;
        });

        if (!updated) {
          console.log(`[AGENT-CHAT] ⚠️ No se encontró mensaje para actualizar con ID: ${data.messageId || data.id}`);
        }

        return newMessages;
      });
    };

    // Suscribirse a eventos
    on('message', handleNewMessage);
    on('message:received', handleNewMessage);
    on('message-status-update', handleMessageStatusUpdate);

    // Cleanup
    return () => {
      off('message');
      off('message:received');
      off('message-status-update');
    };
  }, [socket, isConnected, chatId, on, off]);

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;

    setSending(true);
    try {
      const token = sessionStorage.getItem('token');

      if (selectedFile) {
        // Enviar archivo
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('sessionId', sessionId);
        formData.append('chatJid', chatId);
        formData.append('caption', messageText);

        await fetch('/api/messages/send-media', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        setSelectedFile(null);
      } else {
        // Enviar texto
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionId,
            chatJid: chatId,
            message: messageText
          })
        });
      }

      setMessageText('');
      loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleCloseConversation = async () => {
    try {
      const token = sessionStorage.getItem('token');
      await fetch('/api/chats/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chatJid: chatId,
          sessionId,
          status: 'closed'
        })
      });
      setAnchorEl(null);
      // Optionally notify user or refresh list
    } catch (error) {
      console.error('Error closing conversation:', error);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessageText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm', { locale: es });
    } catch {
      return '';
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon fontSize="small" />;
      case 'video': return <VideoIcon fontSize="small" />;
      case 'audio': return <AudioIcon fontSize="small" />;
      case 'document': return <FileIcon fontSize="small" />;
      default: return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ScheduleIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />;
      case 'sent':
        return (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
            <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />
          </Box>
        );
      case 'delivered':
        return (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
            <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781', mr: -0.7 }} />
            <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />
          </Box>
        );
      case 'read':
        return (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
            <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#53bdeb', mr: -0.7 }} />
            <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#53bdeb' }} />
          </Box>
        );
      default:
        return <ScheduleIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />;
    }
  };

  // Función para renderizar medios
  const renderMedia = (msg: Message) => {
    if (!msg.media_url) return null;

    // Construir URL completa si es relativa
    const mediaUrl = msg.media_url.startsWith('http')
      ? msg.media_url
      : `${apiUrl}${msg.media_url}`;

    const messageType = msg.message_type || 'text';

    switch (messageType) {
      case 'image':
        return (
          <Box sx={{ mb: 1, cursor: 'pointer' }} onClick={() => window.open(mediaUrl, '_blank')}>
            <img
              src={mediaUrl}
              alt="Imagen"
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                display: 'block',
                objectFit: 'contain'
              }}
              onError={(e) => {
                console.error('Error cargando imagen:', mediaUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          </Box>
        );

      case 'video':
        return (
          <Box sx={{ mb: 1 }}>
            <video
              controls
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                backgroundColor: '#000'
              }}
              src={mediaUrl}
              onError={(e) => {
                console.error('Error cargando video:', mediaUrl);
              }}
            >
              Tu navegador no soporta la reproducción de video.
            </video>
          </Box>
        );

      case 'audio':
      case 'ptt':
        return (
          <Box sx={{ mb: 1, minWidth: 250 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AudioIcon sx={{ color: '#00a884' }} />
              <audio
                controls
                style={{ width: '100%', height: '32px' }}
                src={mediaUrl}
                onError={(e) => {
                  console.error('Error cargando audio:', mediaUrl);
                }}
              >
                Tu navegador no soporta la reproducción de audio.
              </audio>
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
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.08)'
              }
            }}
            onClick={() => window.open(mediaUrl, '_blank')}
          >
            <DocumentIcon sx={{ fontSize: 40, color: '#00a884' }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#111b21' }}>
                {msg.file_name || 'Documento'}
              </Typography>
              {msg.mime_type && (
                <Typography variant="caption" sx={{ color: '#667781' }}>
                  {msg.mime_type}
                </Typography>
              )}
            </Box>
            <IconButton size="small" sx={{ color: '#00a884' }}>
              <DownloadIcon />
            </IconButton>
          </Box>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f0f2f5' }}>
      {/* Header estilo WhatsApp */}
      <Paper
        elevation={1}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          bgcolor: '#00a884',
          color: 'white',
          borderRadius: 0
        }}
      >
        <IconButton onClick={onBack} sx={{ color: 'white', mr: 1 }}>
          <BackIcon />
        </IconButton>

        <Avatar
          src={chatAvatar}
          alt={chatName}
          sx={{ width: 40, height: 40, mr: 2 }}
        >
          {chatName?.[0]?.toUpperCase()}
        </Avatar>

        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {chatName}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {chatId.replace('@s.whatsapp.net', '')}
          </Typography>
        </Box>

        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ color: 'white' }}
        >
          <MoreIcon />
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => setAnchorEl(null)}>Ver info del contacto</MenuItem>
          <MenuItem onClick={() => setAnchorEl(null)}>Buscar mensajes</MenuItem>
          <MenuItem onClick={handleCloseConversation} sx={{ color: 'error.main' }}>
            <BlockIcon fontSize="small" sx={{ mr: 1 }} />
            Cerrar conversación
          </MenuItem>
        </Menu>
      </Paper>

      {/* Área de mensajes estilo WhatsApp */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpattern id=\'pattern\' x=\'0\' y=\'0\' width=\'20\' height=\'20\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23d9d9d9\' opacity=\'0.3\'/%3E%3C/pattern%3E%3Crect x=\'0\' y=\'0\' width=\'100%25\' height=\'100%25\' fill=\'url(%23pattern)\'/%3E%3C/svg%3E")',
          bgcolor: '#efeae2'
        }}
      >
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
              sx={{
                maxWidth: '65%',
                p: 1.5,
                bgcolor: msg.from_me ? '#d9fdd3' : 'white',
                borderRadius: msg.from_me ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
                boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)'
              }}
            >
              {/* Nombre del remitente (solo para mensajes entrantes) */}
              {!msg.from_me && msg.sender_name && (
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

              {/* Renderizar medios */}
              {renderMedia(msg)}

              {/* Texto del mensaje */}
              {/* Texto del mensaje - FIX "0" BUG: Ensure text_content is truthy string */}
              {msg.text_content && msg.text_content !== '0' && (
                <Typography
                  variant="body2"
                  sx={{
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    color: '#111b21'
                  }}
                >
                  {msg.text_content}
                </Typography>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11, color: '#667781' }}>
                  {formatMessageTime(msg.timestamp)}
                </Typography>
                {msg.from_me && getStatusIcon(msg.status)}
              </Box>
            </Paper>
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      {/* Área de envío de mensajes */}
      <Paper
        elevation={2}
        sx={{
          p: 1.5,
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
          bgcolor: '#f0f2f5',
          borderRadius: 0
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        <Tooltip title="Adjuntar archivo">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{ color: '#54656f' }}
          >
            <AttachFileIcon />
          </IconButton>
        </Tooltip>

        {selectedFile && (
          <Chip
            label={selectedFile.name}
            onDelete={() => setSelectedFile(null)}
            size="small"
            sx={{ maxWidth: 150 }}
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
                '& fieldset': {
                  borderColor: 'transparent'
                },
                '&:hover fieldset': {
                  borderColor: 'transparent'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'transparent'
                }
              }
            }}
          />
        </Box>

        <Tooltip title="Emoji">
          <IconButton
            size="small"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            sx={{ color: '#54656f' }}
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
              '&:hover': {
                bgcolor: '#008c6d'
              },
              '&:disabled': {
                bgcolor: '#e9edef',
                color: '#667781'
              }
            }}
          >
            {sending ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Tooltip>
      </Paper>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <Box sx={{ position: 'absolute', bottom: 80, right: 20, zIndex: 1000 }}>
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </Box>
      )}
    </Box>
  );
};

export default AgentChatInterface;
