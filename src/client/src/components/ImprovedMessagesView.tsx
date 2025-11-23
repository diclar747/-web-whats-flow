import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  IconButton,
  Link
} from '@mui/material';
import {
  OpenInNew as OpenLinkIcon,
  Download as DownloadIcon,
  Check as CheckIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSocket } from '../context/SocketContext';

interface Message {
  id: number;
  text_content: string;
  from_me: boolean;
  timestamp: string;
  message_type?: string;
  media_type?: string;
  media_url?: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  sender_name?: string;
  sender_jid?: string;
}

interface ImprovedMessagesViewProps {
  chatJid: string;
  sessionId: string;
  onLoadMore?: () => void;
}

const ImprovedMessagesView: React.FC<ImprovedMessagesViewProps> = ({
  chatJid,
  sessionId,
  onLoadMore
}) => {
  const { socket, isConnected, on, off } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver>();

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';

  // Load messages with pagination
  const loadMessages = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (loading || !chatJid) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/messages/${sessionId}/${chatJid}?page=${pageNum}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('token') || ''}`
          }
        }
      );

      if (!response.ok) throw new Error('Error loading messages');

      const data = await response.json();
      const newMessages = data.messages || [];

      if (append) {
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
        setInitialLoad(false);
        // Scroll to bottom on initial load
        setTimeout(() => scrollToBottom(), 100);
      }

      setHasMore(newMessages.length === 50);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [chatJid, sessionId, apiUrl, loading]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Intersection observer for loading more messages at top
  const firstMessageRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !initialLoad) {
        const container = messagesContainerRef.current;
        const scrollHeightBefore = container?.scrollHeight || 0;
        
        setPage(prev => {
          const nextPage = prev + 1;
          loadMessages(nextPage, true).then(() => {
            // Maintain scroll position after loading older messages
            if (container) {
              const scrollHeightAfter = container.scrollHeight;
              container.scrollTop = scrollHeightAfter - scrollHeightBefore;
            }
          });
          return nextPage;
        });
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore, initialLoad, loadMessages]);

  // Initial load
  useEffect(() => {
    if (chatJid) {
      setPage(1);
      setMessages([]);
      setInitialLoad(true);
      loadMessages(1, false);
    }
  }, [chatJid, sessionId]);

  // Escuchar eventos de socket para nuevos mensajes en tiempo real (sin polling!)
  useEffect(() => {
    if (!socket || !isConnected || !chatJid) return;

    console.log(`🔌 [MESSAGES-VIEW] Socket conectado, escuchando mensajes para chat ${chatJid}`);

    // Evento cuando llega un nuevo mensaje
    const handleNewMessage = (data: any) => {
      console.log('💬 [MESSAGES-VIEW] Nuevo mensaje recibido:', data);

      // Verificar si el mensaje es para este chat
      const messageChatJid = data.chatJid || data.chat_jid || data.to || data.from;
      if (messageChatJid !== chatJid) {
        console.log('📭 [MESSAGES-VIEW] Mensaje no es para este chat, ignorando');
        return;
      }

      // Agregar mensaje solo si no existe ya
      setMessages(prev => {
        const messageExists = prev.some(msg =>
          msg.id === data.id ||
          (msg.text_content === data.text_content && msg.timestamp === data.timestamp)
        );

        if (messageExists) {
          console.log('📝 [MESSAGES-VIEW] Mensaje duplicado, ignorando');
          return prev;
        }

        console.log('✅ [MESSAGES-VIEW] Agregando nuevo mensaje');
        const newMessage: Message = {
          id: data.id || Date.now(),
          text_content: data.message || data.text_content || data.text || '',
          from_me: Boolean(data.isFromMe || data.from_me),
          timestamp: data.timestamp || new Date().toISOString(),
          media_type: data.media_type || data.type,
          media_url: data.media_url || data.mediaUrl,
          sender_name: data.sender_name || data.senderName,
          sender_jid: data.sender_jid || data.senderJid
        };

        // Scroll to bottom después de agregar mensaje
        setTimeout(() => scrollToBottom(), 100);

        return [...prev, newMessage];
      });
    };

    // Evento para actualizaciones de estado de mensajes
    const handleMessageStatusUpdate = (data: any) => {
      console.log('📊 [MESSAGES-VIEW] Actualización de estado:', data);

      // Verificar si el mensaje es de este chat
      const messageChatJid = data.chatJid || data.chat_jid;
      if (messageChatJid && messageChatJid !== chatJid) {
        console.log('📭 [MESSAGES-VIEW] Actualización no es para este chat, ignorando');
        return;
      }

      setMessages(prev => {
        let updated = false;
        const newMessages = prev.map(msg => {
          // Coincidir por ID exacto
          const matchById = msg.id === data.id || msg.id === data.messageId;
          if (matchById) {
            console.log('✅ [MESSAGES-VIEW] Actualizando estado por ID:', msg.id, '->', data.status);
            updated = true;
            return { ...msg, status: data.status };
          }

          // Fallback: coincidir por chat y timestamp reciente (últimos 60 segundos)
          if (!updated && msg.from_me && data.chatJid === chatJid) {
            const msgTime = new Date(msg.timestamp).getTime();
            const updateTime = new Date(data.timestamp || Date.now()).getTime();
            const timeDiff = Math.abs(updateTime - msgTime);

            // Si el mensaje fue enviado en los últimos 60 segundos y aún está pending/sent
            if (timeDiff < 60000 && (msg.status === 'pending' || msg.status === 'sent')) {
              console.log('⚠️ [MESSAGES-VIEW] Actualizando estado por proximidad temporal:', msg.id, '->', data.status);
              updated = true;
              return { ...msg, status: data.status };
            }
          }

          return msg;
        });

        if (!updated) {
          console.log('⚠️ [MESSAGES-VIEW] No se encontró mensaje para actualizar con ID:', data.messageId || data.id);
        }

        return newMessages;
      });
    };

    // Suscribirse a los eventos
    on('message', handleNewMessage);
    on('message-status-update', handleMessageStatusUpdate);

    // Cleanup al desmontar
    return () => {
      off('message');
      off('message-status-update');
    };
  }, [socket, isConnected, chatJid, on, off, scrollToBottom]);

  // Render clickable links
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;

    // URL regex
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <Link
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: 'primary.main',
              textDecoration: 'underline',
              wordBreak: 'break-all',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'none'
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
            <OpenLinkIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
          </Link>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Render media content
  const renderMedia = (message: Message) => {
    if (!message.media_url) return null;

    const mediaUrl = message.media_url.startsWith('http')
      ? message.media_url
      : `${apiUrl}${message.media_url}`;

    // Determinar el tipo de media desde message_type o media_type
    let mediaType = message.media_type || message.message_type;
    
    // Normalizar tipos de WhatsApp (imageMessage -> image, stickerMessage -> sticker, etc.)
    if (mediaType) {
      mediaType = mediaType.replace('Message', '').toLowerCase();
    }
    
    // Detectar sticker por URL si no está marcado como tal
    if (!mediaType || mediaType === 'unknown') {
      if (message.media_url.includes('sticker')) {
        mediaType = 'sticker';
      } else if (message.media_url.includes('image')) {
        mediaType = 'image';
      }
    }
    
    switch (mediaType) {
      case 'image':
      case 'sticker':
        return (
          <Box sx={{ maxWidth: mediaType === 'sticker' ? 200 : 300, cursor: 'pointer' }}>
            <img
              src={mediaUrl}
              alt={mediaType === 'sticker' ? 'Sticker' : 'Imagen'}
              style={{ 
                width: '100%', 
                borderRadius: mediaType === 'sticker' ? 0 : 8,
                backgroundColor: mediaType === 'sticker' ? 'transparent' : undefined
              }}
              onClick={() => window.open(mediaUrl, '_blank')}
            />
          </Box>
        );

      case 'video':
        return (
          <Box sx={{ maxWidth: 300 }}>
            <video
              controls
              style={{ width: '100%', borderRadius: 8 }}
              src={mediaUrl}
            />
          </Box>
        );

      case 'audio':
        return (
          <Box sx={{ minWidth: 250 }}>
            <audio
              controls
              style={{ width: '100%' }}
              src={mediaUrl}
            />
          </Box>
        );

      case 'document':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              bgcolor: 'rgba(0,0,0,0.05)',
              borderRadius: 1,
              cursor: 'pointer'
            }}
            onClick={() => window.open(mediaUrl, '_blank')}
          >
            <DownloadIcon />
            <Typography variant="body2">
              {message.text_content || 'Documento'}
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#e5ddd5',
        backgroundImage: 'url(/whatsapp-bg.png)',
        backgroundSize: 'cover'
      }}
    >
      {/* Messages container */}
      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '4px'
          }
        }}
      >
        {/* Loading indicator at top */}
        {loading && page > 1 && (
          <Box display="flex" justifyContent="center" p={1}>
            <CircularProgress size={20} />
          </Box>
        )}

        {/* Messages */}
        {messages.map((message, index) => {
          const isFirstMessage = index === 0;
          const isFromMe = message.from_me;

          return (
            <Box
              key={message.id}
              ref={isFirstMessage && hasMore ? firstMessageRef : null}
              sx={{
                display: 'flex',
                justifyContent: isFromMe ? 'flex-end' : 'flex-start',
                mb: 0.5
              }}
            >
              <Paper
                elevation={1}
                sx={{
                  maxWidth: '70%',
                  minWidth: '80px',
                  p: 1.5,
                  bgcolor: isFromMe ? '#dcf8c6' : '#ffffff',
                  borderRadius: '8px',
                  position: 'relative'
                }}
              >
                {/* Nombre del remitente (solo para mensajes entrantes) */}
                {!isFromMe && message.sender_name && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#00a884',
                      fontWeight: 600,
                      display: 'block',
                      mb: 0.5
                    }}
                  >
                    {message.sender_name}
                  </Typography>
                )}

                {/* Media */}
                {renderMedia(message)}

                {/* Text content */}
                {message.text_content && (
                  <Typography
                    variant="body2"
                    sx={{
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      mb: message.media_url ? 1 : 0
                    }}
                  >
                    {renderTextWithLinks(message.text_content)}
                  </Typography>
                )}

                {/* Timestamp y estado */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem'
                    }}
                  >
                    {format(new Date(message.timestamp), 'HH:mm', { locale: es })}
                  </Typography>

                  {/* Estado del mensaje (solo para mensajes propios) */}
                  {isFromMe && message.status && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                      {message.status === 'pending' && (
                        <ScheduleIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />
                      )}
                      {message.status === 'sent' && (
                        <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />
                      )}
                      {message.status === 'delivered' && (
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                          <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781', mr: -0.7 }} />
                          <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#667781' }} />
                        </Box>
                      )}
                      {message.status === 'read' && (
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                          <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#53bdeb', mr: -0.7 }} />
                          <CheckIcon fontSize="small" sx={{ fontSize: 16, color: '#53bdeb' }} />
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              </Paper>
            </Box>
          );
        })}

        {/* Initial loading */}
        {initialLoad && loading && (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </Box>
    </Box>
  );
};

export default ImprovedMessagesView;
