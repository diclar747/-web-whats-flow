/**
 * Componente de Chat Unificado para WhatsApp
 * Diseño similar a WhatsApp Web con soporte completo de tiempo real
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Avatar,
  Typography,
  Badge,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
  InputAdornment,
  ListItemText,
  ListItemAvatar,
  ListItemButton,
  List,
  Fade,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Send,
  Search,
  MoreVert,
  AttachFile,
  EmojiEmotions,
  Mic,
  Phone,
  VideoCall,
  Info,
  DoneAll,
  Done,
  AccessTime,
  CheckCircle,
  ArrowBack,
  PushPin,
  Archive,
  VolumeOff,
  Menu as MenuIcon,
  InsertDriveFile,
  Image as ImageIcon,
  Videocam,
  Audiotrack,
  LocationOn,
  InsertEmoticon,
  Close,
} from '@mui/icons-material';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useChatStore, useActiveChat, useChatMessages, useChatById } from '../store/chatStore';
import { useWhatsAppSocket } from '../hooks/useWhatsAppSocket';

// Interfaces
interface WhatsAppChatUnifiedProps {
  sessionId: string;
  userRole?: string;
  userId?: string;
  onBack?: () => void;
  showBackButton?: boolean;
}

// Componente principal
const WhatsAppChatUnified: React.FC<WhatsAppChatUnifiedProps> = ({
  sessionId,
  userRole = 'user',
  userId,
  onBack,
  showBackButton = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Store
  const {
    chats,
    contacts,
    activeChat,
    setActiveChat,
    setChats,
    setMessages,
    addMessage,
    setLoading,
    setLoadingMessages,
    isLoading,
    isLoadingMessages,
    hasMoreMessages,
    messageOffsets,
    setHasMoreMessages,
    setMessageOffset,
    typingUsers,
    getSortedChats,
    clearUnread,
  } = useChatStore();

  // Socket
  const {
    isConnected: socketConnected,
    joinChat,
    leaveChat,
    sendTyping,
  } = useWhatsAppSocket({
    sessionId,
    userRole,
    userId,
  });

  // Estados locales
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; chatJid?: string } | null>(null);
  const [showChatInfo, setShowChatInfo] = useState(false);

  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Datos computados
  const sortedChats = useMemo(() => getSortedChats(), [chats]);
  const filteredChats = useMemo(() => {
    if (!searchTerm.trim()) return sortedChats;
    const term = searchTerm.toLowerCase();
    return sortedChats.filter(chat =>
      chat.name?.toLowerCase().includes(term) ||
      chat.phone?.includes(term) ||
      chat.lastMessage?.toLowerCase().includes(term)
    );
  }, [sortedChats, searchTerm]);

  const activeChatData = activeChat ? useChatById(activeChat) : null;
  const activeMessages = activeChat ? useChatMessages(activeChat) : [];
  const isTyping = activeChat ? typingUsers.has(activeChat) : false;

  // Cargar chats iniciales
  useEffect(() => {
    const loadChats = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.REACT_APP_API_URL || window.location.origin;
        const token = sessionStorage.getItem('token');
        
        const response = await fetch(`${apiUrl}/api/chats/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.chats) {
            setChats(data.chats.map((c: any) => ({
              id: c.jid,
              jid: c.jid,
              name: c.name || c.notifyName || c.jid.split('@')[0],
              phone: c.phone || c.jid.split('@')[0],
              avatar: c.avatarUrl,
              isGroup: c.jid.includes('@g.us'),
              lastMessage: c.lastMessage,
              lastMessageTime: c.lastMessageTime,
              lastMessageIsFromMe: c.lastMessageIsFromMe,
              unreadCount: c.unreadCount || 0,
              status: c.status || 'offline',
            })));
          }
        }
      } catch (error) {
        console.error('Error cargando chats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadChats();
    }
  }, [sessionId, setChats, setLoading]);

  // Cargar mensajes cuando cambia el chat activo
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChat) return;
      
      setLoadingMessages(true);
      try {
        const apiUrl = process.env.REACT_APP_API_URL || window.location.origin;
        const token = sessionStorage.getItem('token');
        
        const response = await fetch(
          `${apiUrl}/api/messages/${sessionId}/${activeChat}?limit=50`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.messages) {
            setMessages(activeChat, data.messages.map((m: any) => ({
              id: m.id || m.messageId,
              key: {
                id: m.key?.id || m.id,
                remoteJid: m.key?.remoteJid || activeChat,
                fromMe: m.fromMe || m.key?.fromMe,
                participant: m.key?.participant,
              },
              content: m.content || m.text || m.textContent || '',
              type: m.messageType || m.type || 'text',
              timestamp: m.timestamp ? Number(m.timestamp) : Date.now(),
              fromMe: m.fromMe || m.key?.fromMe || false,
              status: m.status || 'sent',
              mediaUrl: m.mediaUrl || m.media_url,
              caption: m.caption,
              fileName: m.fileName || m.file_name,
              mimeType: m.mimeType || m.media_mime_type,
            })));
            
            setHasMoreMessages(activeChat, data.messages.length === 50);
            setMessageOffset(activeChat, data.messages.length);
          }
        }
        
        // Unirse al chat via socket
        joinChat(activeChat);
        clearUnread(activeChat);
        
      } catch (error) {
        console.error('Error cargando mensajes:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
    
    return () => {
      if (activeChat) {
        leaveChat(activeChat);
      }
    };
  }, [activeChat, sessionId, setMessages, setLoadingMessages, joinChat, leaveChat, clearUnread, setHasMoreMessages, setMessageOffset]);

  // Scroll al final cuando cambian los mensajes
  useEffect(() => {
    if (messagesEndRef.current && !isLoadingMessages) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages, isLoadingMessages]);

  // Manejar typing
  const handleTyping = useCallback(() => {
    if (activeChat && socketConnected) {
      sendTyping(activeChat, 'typing');
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        // Typing stops automatically on server after delay
      }, 3000);
    }
  }, [activeChat, socketConnected, sendTyping]);

  // Enviar mensaje
  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !activeChat) return;

    const apiUrl = process.env.REACT_APP_API_URL || window.location.origin;
    const token = sessionStorage.getItem('token');

    // Agregar mensaje optimistamente
    const tempMessage: any = {
      id: `temp-${Date.now()}`,
      key: {
        id: `temp-${Date.now()}`,
        remoteJid: activeChat,
        fromMe: true,
      },
      content: messageText,
      type: 'text',
      timestamp: Date.now(),
      fromMe: true,
      status: 'pending',
    };
    
    addMessage(activeChat, tempMessage);
    setMessageText('');

    try {
      const response = await fetch(`${apiUrl}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          jid: activeChat,
          message: messageText,
        }),
      });

      if (!response.ok) {
        throw new Error('Error enviando mensaje');
      }

      const data = await response.json();
      
      // Actualizar mensaje temporal con el real
      useChatStore.getState().updateMessage(activeChat, tempMessage.id, {
        id: data.messageId,
        key: { ...tempMessage.key, id: data.messageId },
        status: 'sent',
      });

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      useChatStore.getState().updateMessage(activeChat, tempMessage.id, {
        status: 'failed',
      });
    }
  }, [messageText, activeChat, sessionId, addMessage]);

  // Formatear fecha de mensaje
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return format(date, 'HH:mm');
  };

  const formatMessageDate = (timestamp: number) => {
    const date = new Date(timestamp);
    if (isToday(date)) return 'Hoy';
    if (isYesterday(date)) return 'Ayer';
    return format(date, 'dd/MM/yyyy', { locale: es });
  };

  // Renderizar burbuja de mensaje
  const renderMessage = (message: any, index: number, messages: any[]) => {
    const isFromMe = message.fromMe;
    const showDate = index === 0 || 
      formatMessageDate(message.timestamp) !== formatMessageDate(messages[index - 1]?.timestamp);

    return (
      <React.Fragment key={message.id}>
        {showDate && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Chip
              label={formatMessageDate(message.timestamp)}
              size="small"
              sx={{
                backgroundColor: '#e1f5fe',
                color: '#546e7a',
                fontSize: '0.75rem',
              }}
            />
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            justifyContent: isFromMe ? 'flex-end' : 'flex-start',
            mb: 1,
            px: 2,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: '70%',
              p: 1.5,
              borderRadius: isFromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              backgroundColor: isFromMe ? '#dcf8c6' : '#ffffff',
              position: 'relative',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
            }}
          >
            {/* Nombre del participante en grupos */}
            {!isFromMe && activeChatData?.isGroup && message.key?.participant && (
              <Typography
                variant="caption"
                sx={{
                  color: '#53bdeb',
                  fontWeight: 600,
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {message.key.participant.split('@')[0]}
              </Typography>
            )}
            
            {/* Contenido del mensaje */}
            <Typography
              variant="body2"
              sx={{
                color: '#111b21',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </Typography>

            {/* Footer con hora y estado */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 0.5,
                mt: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#667781',
                  fontSize: '0.7rem',
                }}
              >
                {formatMessageTime(message.timestamp)}
              </Typography>
              
              {isFromMe && (
                <Box sx={{ color: '#53bdeb', display: 'flex', alignItems: 'center' }}>
                  {message.status === 'pending' && <AccessTime sx={{ fontSize: 14 }} />}
                  {message.status === 'sent' && <CheckCircle sx={{ fontSize: 14 }} />}
                  {message.status === 'delivered' && <DoneAll sx={{ fontSize: 14 }} />}
                  {message.status === 'read' && <DoneAll sx={{ fontSize: 14, color: '#53bdeb' }} />}
                  {message.status === 'failed' && (
                    <Typography variant="caption" color="error" sx={{ fontSize: '0.65rem' }}>
                      Error
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </React.Fragment>
    );
  };

  // Renderizar item de chat en la lista
  const renderChatItem = (chat: any) => {
    const isActive = activeChat === chat.jid;
    const isTyping = typingUsers.has(chat.jid);

    return (
      <ListItemButton
        key={chat.jid}
        selected={isActive}
        onClick={() => setActiveChat(chat.jid)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({
            mouseX: e.clientX,
            mouseY: e.clientY,
            chatJid: chat.jid,
          });
        }}
        sx={{
          py: 1.5,
          px: 2,
          borderBottom: '1px solid #f0f2f5',
          backgroundColor: isActive ? '#f0f2f5' : 'transparent',
          '&:hover': {
            backgroundColor: isActive ? '#f0f2f5' : '#f5f6f6',
          },
        }}
      >
        <ListItemAvatar>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            variant="dot"
            color="success"
            invisible={chat.status !== 'online'}
          >
            <Avatar
              src={chat.avatar}
              sx={{
                width: 48,
                height: 48,
                backgroundColor: chat.isGroup ? '#00a884' : '#dfe5e7',
              }}
            >
              {chat.name?.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: '#111b21',
                  fontSize: '0.95rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {chat.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: chat.unreadCount > 0 ? '#00a884' : '#667781',
                  fontSize: '0.75rem',
                }}
              >
                {chat.lastMessageTime && formatDistanceToNow(new Date(chat.lastMessageTime), { addSuffix: false, locale: es })}
              </Typography>
            </Box>
          }
          secondary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  color: chat.unreadCount > 0 ? '#111b21' : '#667781',
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: chat.unreadCount > 0 ? 500 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {isTyping ? (
                  <span style={{ color: '#00a884', fontStyle: 'italic' }}>
                    escribiendo...
                  </span>
                ) : (
                  <>
                    {chat.lastMessageIsFromMe && (
                      <DoneAll sx={{ fontSize: 14, color: '#53bdeb' }} />
                    )}
                    {chat.lastMessage || 'Sin mensajes'}
                  </>
                )}
              </Typography>
              
              {chat.unreadCount > 0 && (
                <Badge
                  badgeContent={chat.unreadCount}
                  color="success"
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: '#00a884',
                      fontSize: '0.75rem',
                      minWidth: 20,
                      height: 20,
                    },
                  }}
                />
              )}
            </Box>
          }
        />
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#f0f2f5' }}>
      {/* Sidebar - Lista de chats */}
      <Paper
        elevation={0}
        sx={{
          width: isMobile ? (activeChat ? 0 : '100%') : 360,
          minWidth: isMobile ? 0 : 360,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e0e0e0',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header de la lista */}
        <Box sx={{ p: 2, backgroundColor: '#f0f2f5', borderBottom: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#111b21' }}>
              Chats
            </Typography>
            <Box>
              <IconButton size="small">
                <MenuIcon />
              </IconButton>
            </Box>
          </Box>
          
          {/* Buscador */}
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar chat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            inputRef={searchInputRef}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#667781', fontSize: 20 }} />
                </InputAdornment>
              ),
              sx: {
                backgroundColor: '#ffffff',
                borderRadius: 2,
                '& fieldset': { border: 'none' },
              },
            }}
          />
        </Box>

        {/* Lista de chats */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filteredChats.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4, color: '#667781' }}>
              <Typography variant="body2">
                {searchTerm ? 'No se encontraron chats' : 'No hay chats disponibles'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredChats.map(renderChatItem)}
            </List>
          )}
        </Box>
      </Paper>

      {/* Área de chat principal */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#efeae2',
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23d1d7db\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
          position: isMobile && !activeChat ? 'absolute' : 'relative',
          left: isMobile && !activeChat ? '-100%' : 0,
          transition: 'left 0.3s ease',
        }}
      >
        {activeChat ? (
          <>
            {/* Header del chat */}
            <Box
              sx={{
                p: 1.5,
                backgroundColor: '#f0f2f5',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {isMobile && (
                  <IconButton onClick={() => setActiveChat(null)} size="small">
                    <ArrowBack />
                  </IconButton>
                )}
                
                <Avatar
                  src={activeChatData?.avatar}
                  sx={{
                    width: 40,
                    height: 40,
                    backgroundColor: activeChatData?.isGroup ? '#00a884' : '#dfe5e7',
                  }}
                >
                  {activeChatData?.name?.charAt(0).toUpperCase()}
                </Avatar>
                
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111b21' }}>
                    {activeChatData?.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#667781' }}>
                    {isTyping ? (
                      <span style={{ color: '#00a884' }}>escribiendo...</span>
                    ) : (
                      activeChatData?.status === 'online' ? 'en línea' : ''
                    )}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton size="small">
                  <VideoCall />
                </IconButton>
                <IconButton size="small">
                  <Phone />
                </IconButton>
                <IconButton size="small" onClick={() => setShowChatInfo(!showChatInfo)}>
                  <Info />
                </IconButton>
                <IconButton size="small">
                  <MoreVert />
                </IconButton>
              </Box>
            </Box>

            {/* Área de mensajes */}
            <Box
              ref={messagesContainerRef}
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isLoadingMessages ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : activeMessages.length === 0 ? (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#667781',
                  }}
                >
                  <Typography variant="body2">
                    No hay mensajes en este chat
                  </Typography>
                </Box>
              ) : (
                <>
                  {hasMoreMessages.get(activeChat) && (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <CircularProgress size={20} />
                    </Box>
                  )}
                  {activeMessages.map((msg, idx) => renderMessage(msg, idx, activeMessages))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </Box>

            {/* Input de mensaje */}
            <Box
              sx={{
                p: 1.5,
                backgroundColor: '#f0f2f5',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <IconButton size="small">
                <InsertEmoticon />
              </IconButton>
              
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
              >
                <AttachFile />
              </IconButton>
              
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  // Manejar archivo seleccionado
                  console.log('Archivo seleccionado:', e.target.files?.[0]);
                }}
              />

              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Escribe un mensaje..."
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#ffffff',
                    borderRadius: 3,
                    '& fieldset': { border: 'none' },
                  },
                }}
              />

              {messageText.trim() ? (
                <IconButton
                  onClick={handleSendMessage}
                  sx={{
                    backgroundColor: '#00a884',
                    color: '#ffffff',
                    '&:hover': { backgroundColor: '#008f72' },
                  }}
                >
                  <Send />
                </IconButton>
              ) : (
                <IconButton
                  onMouseDown={() => setIsRecording(true)}
                  onMouseUp={() => setIsRecording(false)}
                  onTouchStart={() => setIsRecording(true)}
                  onTouchEnd={() => setIsRecording(false)}
                >
                  <Mic />
                </IconButton>
              )}
            </Box>
          </>
        ) : (
          // Vista vacía cuando no hay chat seleccionado
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#667781',
              textAlign: 'center',
              p: 4,
            }}
          >
            <Box
              component="img"
              src="/whatsapp-icon.png"
              alt="WhatsApp"
              sx={{ width: 200, height: 200, opacity: 0.3, mb: 3 }}
            />
            <Typography variant="h5" sx={{ mb: 1, color: '#41525d' }}>
              WhatsApp Web
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 400 }}>
              Envía y recibe mensajes de WhatsApp sin tener que mantener tu teléfono conectado.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Menú contextual */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => setContextMenu(null)}>
          <PushPin sx={{ mr: 1, fontSize: 20 }} />
          Fijar chat
        </MenuItem>
        <MenuItem onClick={() => setContextMenu(null)}>
          <VolumeOff sx={{ mr: 1, fontSize: 20 }} />
          Silenciar
        </MenuItem>
        <MenuItem onClick={() => setContextMenu(null)}>
          <Archive sx={{ mr: 1, fontSize: 20 }} />
          Archivar
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setContextMenu(null)} sx={{ color: '#f44336' }}>
          Eliminar chat
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default WhatsAppChatUnified;
