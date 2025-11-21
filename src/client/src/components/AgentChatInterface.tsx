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
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import EmojiPicker from 'emoji-picker-react';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const interval = setInterval(loadMessages, 3000); // Actualizar cada 3 segundos
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    if (status === 'sent') return <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />;
    if (status === 'delivered') return <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />;
    if (status === 'read') return <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#53bdeb' }} />;
    return <ScheduleIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />;
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
          <MenuItem onClick={() => setAnchorEl(null)}>Cerrar chat</MenuItem>
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
              {msg.message_type !== 'text' && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, color: '#667781' }}>
                  {getMessageIcon(msg.message_type)}
                  <Typography variant="caption" sx={{ ml: 0.5 }}>
                    {msg.file_name || msg.message_type}
                  </Typography>
                </Box>
              )}

              {msg.media_url && msg.message_type === 'image' && (
                <img 
                  src={msg.media_url} 
                  alt="attachment" 
                  style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }}
                />
              )}

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
