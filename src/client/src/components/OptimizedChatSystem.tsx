import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Badge,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Paper,
  Divider,
  Button,
  Menu,
  MenuItem,
  Link,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  OpenInNew as OpenLinkIcon,
  Close as CloseIcon,
  SwapHoriz as TransferIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import io from 'socket.io-client';

interface Chat {
  jid: string;
  name: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  avatar_url?: string;
}

interface Message {
  id: number;
  text_content: string;
  from_me: boolean;
  timestamp: string;
  message_type?: string; // audioMessage, imageMessage, videoMessage, etc.
  media_type?: string;
  media_url?: string;
  agent_id?: number;
  agent_name?: string;
  sentBy?: string;  // Nombre del agente que envió el mensaje (legacy)
}

interface OptimizedChatSystemProps {
  sessionId: string;
  userId?: number;
  userRole?: string;
}

const OptimizedChatSystem: React.FC<OptimizedChatSystemProps> = ({
  sessionId,
  userId,
  userRole
}) => {
  // States
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Transfer states
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  
  // Loading states
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Pagination
  const [chatsPage, setChatsPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLUListElement>(null);
  const socketRef = useRef<any>(null);
  const chatsObserver = useRef<IntersectionObserver>();
  const messagesObserver = useRef<IntersectionObserver>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
  const token = sessionStorage.getItem('token') || '';

  // ============== LOAD CHATS ==============
  const loadChats = useCallback(async (page: number = 1, append: boolean = false) => {
    if (loadingChats) return;
    
    setLoadingChats(true);
    try {
      const endpoint = userRole === 'agent' 
        ? `/api/agent/chats?sessionId=${sessionId}&page=${page}&limit=20`
        : `/api/chats/${sessionId}?page=${page}&limit=20`;
      
      const response = await fetch(`${apiUrl}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error loading chats');
      
      const data = await response.json();
      let newChats: Chat[] = [];
      
      // Handle different response formats
      if (data.chats) {
        newChats = data.chats;
      } else if (Array.isArray(data)) {
        newChats = data;
      }
      
      // Sort by last message time
      newChats.sort((a: Chat, b: Chat) => {
        const timeA = new Date(a.last_message_time || 0).getTime();
        const timeB = new Date(b.last_message_time || 0).getTime();
        return timeB - timeA;
      });
      
      if (append) {
        setChats(prev => [...prev, ...newChats]);
      } else {
        setChats(newChats);
      }
      
      setHasMoreChats(newChats.length === 20);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoadingChats(false);
    }
  }, [apiUrl, sessionId, token, userRole, loadingChats]);

  // ============== LOAD MESSAGES ==============
  const loadMessages = useCallback(async (chatJid: string, page: number = 1, append: boolean = false) => {
    if (loadingMessages) return;
    
    setLoadingMessages(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/messages/${sessionId}/${chatJid}?page=${page}&limit=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Error loading messages');
      
      const data = await response.json();
      const newMessages = data.messages || [];
      
      if (append) {
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
        // Scroll to bottom on initial load
        setTimeout(() => scrollToBottom(), 100);
      }
      
      setHasMoreMessages(newMessages.length === 50);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [apiUrl, sessionId, token, loadingMessages]);

  // ============== SEND MESSAGE ==============
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || sending) return;
    
    setSending(true);
    const tempMessageText = messageText;
    const tempTimestamp = new Date().toISOString();
    
    // AGREGAR MENSAJE OPTIMISTICAMENTE (aparece inmediatamente)
    const optimisticMessage: Message = {
      id: -1, // ID temporal negativo
      text_content: tempMessageText,
      from_me: true,
      timestamp: tempTimestamp,
      media_type: undefined,
      media_url: undefined,
      sentBy: sessionStorage.getItem('userName') || undefined
    };
    
    // Guardar referencia al índice del mensaje temporal
    setMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');
    setTimeout(() => scrollToBottom(), 100);
    
    try {
      // Obtener datos del usuario actual
      const userId = sessionStorage.getItem('userId');
      const userName = sessionStorage.getItem('userName');
      
      const response = await fetch(`${apiUrl}/api/send/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          number: selectedChat.jid,
          message: tempMessageText,
          sentBy: userId,
          sentByName: userName
        })
      });
      
      if (!response.ok) throw new Error('Error sending message');
      
      const result = await response.json();
      
      // REEMPLAZAR mensaje temporal con el mensaje real del servidor
      if (result.success && result.messageId) {
        setMessages(prev => {
          const tempIndex = prev.findIndex(msg => msg.id === -1 && msg.text_content === tempMessageText && msg.timestamp === tempTimestamp);
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = { ...updated[tempIndex], id: result.messageId };
            return updated;
          }
          return prev;
        });
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      // REMOVER mensaje temporal si falla
      setMessages(prev => prev.filter(msg => !(msg.id === -1 && msg.text_content === tempMessageText && msg.timestamp === tempTimestamp)));
      setMessageText(tempMessageText); // Restaurar texto
      alert('Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  // ============== SEND FILE ==============
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChat || sending) return;

    setSending(true);
    const fileName = file.name;
    const tempTimestamp = new Date().toISOString();
    
    // Determinar tipo de archivo
    const fileType = file.type.split('/')[0]; // image, video, audio, etc.
    let mediaType = 'document';
    if (fileType === 'image') mediaType = 'image';
    else if (fileType === 'video') mediaType = 'video';
    else if (fileType === 'audio') mediaType = 'audio';
    
    // AGREGAR MENSAJE OPTIMISTICAMENTE
    const optimisticMessage: Message = {
      id: -1, // ID temporal
      text_content: `📎 ${fileName}`,
      from_me: true,
      timestamp: tempTimestamp,
      media_type: mediaType,
      media_url: URL.createObjectURL(file) // Preview local
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(), 100);
    
    try {
      // Obtener datos del usuario actual
      const userId = sessionStorage.getItem('userId');
      const userName = sessionStorage.getItem('userName');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('number', selectedChat.jid);
      formData.append('caption', '');
      formData.append('sentBy', userId || '');
      formData.append('sentByName', userName || '');

      const response = await fetch(`${apiUrl}/api/send/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Error sending file');

      const data = await response.json();
      console.log('File sent successfully:', data);

      // REEMPLAZAR mensaje temporal con el real
      if (data.success && data.messageId) {
        setMessages(prev => {
          const tempIndex = prev.findIndex(msg => 
            msg.id === -1 && 
            msg.timestamp === tempTimestamp && 
            msg.text_content === `📎 ${fileName}`
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = { 
              ...updated[tempIndex], 
              id: data.messageId,
              media_url: data.mediaUrl || updated[tempIndex].media_url 
            };
            return updated;
          }
          return prev;
        });
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error sending file:', error);
      // REMOVER mensaje temporal si falla
      setMessages(prev => prev.filter(msg => 
        !(msg.id === -1 && msg.timestamp === tempTimestamp && msg.text_content === `📎 ${fileName}`)
      ));
      alert('Error enviando archivo');
    } finally {
      setSending(false);
    }
  };

  // ============== TRANSFER FUNCTIONS ==============
  const loadAvailableAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await fetch(`${apiUrl}/api/agents/available?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success && data.agents) {
        setAvailableAgents(data.agents);
        console.log(`✅ ${data.agents.length} agentes disponibles cargados`);
      } else {
        setAvailableAgents([]);
        console.log('⚠️ No hay agentes disponibles');
      }
    } catch (error) {
      console.error('Error cargando agentes:', error);
      setAvailableAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleOpenTransferDialog = () => {
    if (!selectedChat) return;
    setTransferDialogOpen(true);
    loadAvailableAgents();
  };

  const handleCloseTransferDialog = () => {
    setTransferDialogOpen(false);
    setSelectedAgentId('');
  };

  const handleTransferChat = async () => {
    if (!selectedChat || !selectedAgentId) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/chats/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          chatJid: selectedChat.jid,
          toAgentId: selectedAgentId,
          fromAgentId: userId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Chat transferido exitosamente');
        handleCloseTransferDialog();
        loadChats(1, false);
      } else {
        alert(data.error || 'Error al transferir chat');
      }
    } catch (error) {
      console.error('Error transferring chat:', error);
      alert('Error al transferir chat');
    }
  };

  // ============== SCROLL FUNCTIONS ==============
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ============== INTERSECTION OBSERVERS ==============
  
  // Observer for loading more chats
  const lastChatRef = useCallback((node: HTMLLIElement | null) => {
    if (loadingChats) return;
    if (chatsObserver.current) chatsObserver.current.disconnect();
    
    chatsObserver.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreChats) {
        setChatsPage(prev => {
          const nextPage = prev + 1;
          loadChats(nextPage, true);
          return nextPage;
        });
      }
    });
    
    if (node) chatsObserver.current.observe(node);
  }, [loadingChats, hasMoreChats, loadChats]);

  // Observer for loading more messages
  const firstMessageRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMessages) return;
    if (messagesObserver.current) messagesObserver.current.disconnect();
    
    messagesObserver.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreMessages) {
        const container = messagesContainerRef.current;
        const scrollHeightBefore = container?.scrollHeight || 0;
        
        setMessagesPage(prev => {
          const nextPage = prev + 1;
          if (selectedChat) {
            loadMessages(selectedChat.jid, nextPage, true).then(() => {
              if (container) {
                const scrollHeightAfter = container.scrollHeight;
                container.scrollTop = scrollHeightAfter - scrollHeightBefore;
              }
            });
          }
          return nextPage;
        });
      }
    });
    
    if (node) messagesObserver.current.observe(node);
  }, [loadingMessages, hasMoreMessages, selectedChat, loadMessages]);

  // ============== CHAT SELECTION ==============
  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
    setMessages([]);
    setMessagesPage(1);
    setHasMoreMessages(true);
    loadMessages(chat.jid, 1, false);
  };

  // ============== RENDER LINKS ==============
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    
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
              wordBreak: 'break-all'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {part.length > 50 ? part.substring(0, 50) + '...' : part}
            <OpenLinkIcon sx={{ fontSize: 12, ml: 0.5, verticalAlign: 'middle' }} />
          </Link>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // ============== SEARCH FILTER ==============
  const filteredChats = chats.filter(chat => 
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.jid?.includes(searchTerm)
  );

  // ============== EFFECTS ==============
  
  // Initial load
  useEffect(() => {
    loadChats(1, false);
    
    // Refresh chats every 30 seconds
    const interval = setInterval(() => {
      loadChats(1, false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Socket.IO for real-time updates
  useEffect(() => {
    const socket = io(apiUrl, {
      query: { sessionId },
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = socket;
    
    console.log('🔌 [OptimizedChat] Socket conectado para sessionId:', sessionId);
    
    socket.on('connect', () => {
      console.log('🔌 [OptimizedChat] Socket.IO conectado:', socket.id);
      socket.emit('join-session', { sessionId });
    });
    
    socket.on('message', (data: any) => {
      console.log('💬 [OptimizedChat] Mensaje recibido en tiempo real:', data);
      
      // Obtener el JID del chat desde varios campos posibles
      const messageChatJid = data.chatJid || data.chat_jid || data.key?.remoteJid || data.from;
      
      if (!messageChatJid) {
        console.warn('⚠️ [OptimizedChat] Mensaje sin chatJid, ignorando');
        return;
      }
      
      // Construir el nuevo mensaje con todos los campos necesarios
      const messageId = data.id || data.key?.id || `msg-${Date.now()}`;
      const newMessage: Message = {
        id: messageId,
        text_content: data.text_content || data.message || data.text || 
                     data.message?.conversation || data.message?.extendedTextMessage?.text || 
                     (data.media_type === 'image' ? '📷 Imagen' : 
                      data.media_type === 'video' ? '🎥 Video' :
                      data.media_type === 'audio' ? '🔊 Audio' :
                      data.media_type === 'sticker' ? '🎨 Sticker' : ''),
        from_me: Boolean(data.isFromMe || data.from_me || data.key?.fromMe),
        timestamp: data.timestamp || new Date().toISOString(),
        media_type: data.media_type || data.type,
        media_url: data.media_url || data.mediaUrl,
        sentBy: data.sentByName,
        agent_id: data.agent_id,  // 🔥 Incluir ID del agente
        agent_name: data.agent_name  // 🔥 Incluir nombre del agente
      };
      
      // Si hay un chat seleccionado y el mensaje es para ese chat
      if (selectedChat && messageChatJid === selectedChat.jid) {
        console.log('✅ [OptimizedChat] Mensaje para el chat actual:', selectedChat.jid);
        
        setMessages(prev => {
          // Verificar duplicados por ID
          const messageExists = prev.some(msg => 
            msg.id === newMessage.id || 
            (msg.timestamp === newMessage.timestamp && msg.text_content === newMessage.text_content)
          );
          
          if (messageExists) {
            console.log('📝 [OptimizedChat] Mensaje duplicado, ignorando');
            return prev;
          }
          
          console.log('➕ [OptimizedChat] Agregando mensaje nuevo');
          return [...prev, newMessage];
        });
        setTimeout(() => scrollToBottom(), 100);
      } else {
        console.log('📭 [OptimizedChat] Mensaje para otro chat:', messageChatJid);
      }
      
      // Actualizar lista de chats para mostrar el mensaje más reciente arriba
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => c.jid === messageChatJid);
        
        if (chatIndex >= 0) {
          // Chat existe, moverlo al inicio
          const updatedChats = [...prevChats];
          const [movedChat] = updatedChats.splice(chatIndex, 1);
          
          // Actualizar último mensaje y timestamp
          movedChat.last_message = newMessage.text_content;
          movedChat.last_message_time = newMessage.timestamp;
          
          // Incrementar contador de no leídos solo si no es del usuario
          if (!newMessage.from_me) {
            movedChat.unread_count = (movedChat.unread_count || 0) + 1;
          }
          
          return [movedChat, ...updatedChats];
        } else {
          // Chat nuevo, agregarlo al inicio
          console.log('📬 [OptimizedChat] Chat nuevo detectado, recargando lista');
          loadChats(1, false);
          return prevChats;
        }
      });
    });
    
    // Listener para actualización de estado de mensajes (entregado/visto)
    socket.on('message-status', (data: any) => {
      console.log('✓ [OptimizedChat] Actualización de estado:', data);
      
      if (selectedChat && data.chatJid === selectedChat.jid) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            return { ...msg, status: data.status };
          }
          return msg;
        }));
      }
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 [OptimizedChat] Socket desconectado');
    });
    
    socket.on('error', (error: any) => {
      console.error('❌ [OptimizedChat] Error de socket:', error);
    });
    
    return () => {
      console.log('🔌 [OptimizedChat] Cerrando socket');
      socket.disconnect();
    };
  }, [apiUrl, sessionId, selectedChat]);

  // NOTA: Polling desactivado - ahora usamos Socket.IO en tiempo real
  // El socket escucha eventos 'message' y actualiza automáticamente

  // ============== RENDER ==============
  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* CHAT LIST */}
      <Box
        sx={{
          width: 350,
          borderRight: '1px solid #e0e0e0',
          bgcolor: 'white',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Search */}
        <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar chat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Chats List */}
        <List
          ref={chatListRef}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 0,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '3px'
            }
          }}
        >
          {filteredChats.map((chat, index) => {
            const isLastChat = index === filteredChats.length - 1;
            const isSelected = selectedChat?.jid === chat.jid;
            
            return (
              <React.Fragment key={chat.jid}>
                <ListItem
                  ref={isLastChat && hasMoreChats ? lastChatRef : null}
                  disablePadding
                  sx={{
                    bgcolor: isSelected ? '#f0f0f0' : 'transparent',
                    '&:hover': { bgcolor: isSelected ? '#f0f0f0' : '#f8f8f8' }
                  }}
                >
                  <ListItemButton onClick={() => handleChatSelect(chat)} sx={{ py: 1.5 }}>
                    <ListItemAvatar>
                      <Badge badgeContent={chat.unread_count && chat.unread_count > 0 ? chat.unread_count : null} color="error">
                        <Avatar src={chat.avatar_url}>
                          {(chat.name || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            {chat.name || 'Sin nombre'}
                          </Typography>
                          {chat.last_message_time && (
                            <Typography variant="caption" color="textSecondary">
                              {format(new Date(chat.last_message_time), 'HH:mm', { locale: es })}
                            </Typography>
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="textSecondary" noWrap>
                          {chat.last_message || 'Sin mensajes'}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                <Divider />
              </React.Fragment>
            );
          })}
          
          {loadingChats && (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress size={24} />
            </Box>
          )}
        </List>
      </Box>

      {/* MESSAGES AREA */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedChat ? (
          <>
            {/* Header */}
            <Box
              sx={{
                p: 2,
                bgcolor: '#f0f0f0',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar src={selectedChat.avatar_url}>
                  {(selectedChat.name || '?').charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedChat.name || 'Sin nombre'}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {selectedChat.jid}
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={() => setMenuAnchorEl(null)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={() => {
                  setMenuAnchorEl(null);
                  handleOpenTransferDialog();
                }}>
                  <TransferIcon sx={{ mr: 1 }} />
                  Transferir chat
                </MenuItem>
              </Menu>
            </Box>

            {/* Messages */}
            <Box
              ref={messagesContainerRef}
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 2,
                bgcolor: '#e5ddd5',
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5))',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '3px'
                }
              }}
            >
              {loadingMessages && messagesPage > 1 && (
                <Box display="flex" justifyContent="center" p={1}>
                  <CircularProgress size={20} />
                </Box>
              )}
              
              {messages.map((message, index) => {
                const isFirstMessage = index === 0;
                const isFromMe = message.from_me;
                
                return (
                  <Box
                    key={message.id}
                    ref={isFirstMessage && hasMoreMessages ? firstMessageRef : null}
                    sx={{
                      display: 'flex',
                      justifyContent: isFromMe ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <Paper
                      elevation={1}
                      sx={{
                        maxWidth: '70%',
                        p: 1.5,
                        bgcolor: isFromMe ? '#dcf8c6' : 'white',
                        borderRadius: '8px'
                      }}
                    >
                      {message.media_url && (
                        <Box mb={1}>
                          {/* Imagen */}
                          {(message.message_type === 'imageMessage' || message.media_type === 'image') && message.media_url && (
                            <img
                              src={message.media_url.startsWith('http') ? message.media_url : `${apiUrl}${message.media_url}`}
                              alt="Imagen"
                              style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'pointer' }}
                              onClick={() => window.open(message.media_url?.startsWith('http') ? message.media_url : `${apiUrl}${message.media_url}`, '_blank')}
                              onError={(e) => {
                                console.error('Error cargando imagen:', message.media_url);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          
                          {/* Audio */}
                          {(message.message_type === 'audioMessage' || message.media_type === 'audio') && message.media_url && (
                            <Box sx={{ width: '100%', minWidth: '250px' }}>
                              <audio 
                                controls 
                                style={{ width: '100%' }}
                                preload="metadata"
                              >
                                <source 
                                  src={message.media_url.startsWith('http') ? message.media_url : `${apiUrl}${message.media_url}`}
                                  type="audio/ogg"
                                />
                                <source 
                                  src={message.media_url.startsWith('http') ? message.media_url : `${apiUrl}${message.media_url}`}
                                  type="audio/mpeg"
                                />
                                Tu navegador no soporta el elemento de audio.
                              </audio>
                            </Box>
                          )}
                          
                          {/* Video */}
                          {(message.message_type === 'videoMessage' || message.media_type === 'video') && message.media_url && (
                            <video
                              controls
                              style={{ maxWidth: '100%', borderRadius: '8px' }}
                              preload="metadata"
                            >
                              <source 
                                src={message.media_url.startsWith('http') ? message.media_url : `${apiUrl}${message.media_url}`}
                              />
                              Tu navegador no soporta el elemento de video.
                            </video>
                          )}
                          
                          {/* Documento */}
                          {(message.message_type === 'documentMessage' || message.media_type === 'document') && message.media_url && (
                            <Button
                              variant="outlined"
                              startIcon={<AttachFileIcon />}
                              href={message.media_url.startsWith('http') ? message.media_url : `${apiUrl}${message.media_url}`}
                              target="_blank"
                              download
                              sx={{ 
                                textTransform: 'none',
                                borderRadius: 2,
                                borderColor: '#00a884',
                                color: '#00a884',
                                '&:hover': {
                                  borderColor: '#00796b',
                                  bgcolor: 'rgba(0, 168, 132, 0.1)'
                                }
                              }}
                            >
                              📄 Descargar archivo
                            </Button>
                          )}
                          
                          {/* Sticker */}
                          {message.message_type === 'stickerMessage' && message.media_url && (
                            <img
                              src={message.media_url.startsWith('http') ? message.media_url : `${apiUrl}${message.media_url}`}
                              alt="Sticker"
                              style={{ maxWidth: '150px', borderRadius: '8px' }}
                              onError={(e) => {
                                console.error('Error cargando sticker:', message.media_url);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                        </Box>
                      )}
                      
                      {message.text_content && (
                        <Box>
                          <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                            {renderTextWithLinks(message.text_content)}
                          </Typography>
                          {/* Badge del agente/admin que envió el mensaje */}
                          {isFromMe && (message.agent_name || message.sentBy) && message.agent_id !== 0 && (
                            <Chip 
                              label={`👤 ${message.agent_name || message.sentBy}`}
                              size="small"
                              sx={{ 
                                mt: 0.5,
                                height: 22,
                                fontSize: '0.75rem',
                                bgcolor: '#00a884',
                                color: 'white',
                                fontWeight: 600,
                                '& .MuiChip-label': {
                                  px: 1.5,
                                  py: 0
                                }
                              }}
                            />
                          )}
                        </Box>
                      )}
                      
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          textAlign: 'right',
                          color: 'text.secondary',
                          fontSize: '0.7rem',
                          mt: 0.5
                        }}
                      >
                        {format(new Date(message.timestamp), 'HH:mm', { locale: es })}
                      </Typography>
                    </Paper>
                  </Box>
                );
              })}
              
              {loadingMessages && messagesPage === 1 && (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              )}
              
              <div ref={messagesEndRef} />
            </Box>

            {/* Input */}
            <Box
              sx={{
                p: 2,
                bgcolor: '#f0f0f0',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                gap: 1
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <IconButton onClick={handleFileSelect} disabled={sending}>
                <AttachFileIcon />
              </IconButton>
              <TextField
                fullWidth
                size="small"
                placeholder="Escribe un mensaje..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                multiline
                maxRows={4}
              />
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
              >
                {sending ? <CircularProgress size={24} /> : <SendIcon />}
              </IconButton>
            </Box>
          </>
        ) : (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="100%"
            bgcolor="#f5f5f5"
          >
            <Typography variant="h6" color="textSecondary">
              Selecciona un chat para comenzar
            </Typography>
          </Box>
        )}
      </Box>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={handleCloseTransferDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            m: 0
          }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <TransferIcon color="primary" />
            <Typography variant="h6">Transferir chat a agente</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Selecciona un agente para transferir este chat:
          </Typography>
          
          {loadingAgents ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TextField
              select
              fullWidth
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              label="Seleccionar agente"
              disabled={availableAgents.length === 0}
            >
              {availableAgents.length > 0 ? (
                availableAgents.map((agent) => (
                  <MenuItem key={agent.id} value={agent.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: agent.role === 'admin' ? 'error.main' : agent.role === 'supervisor' ? 'warning.main' : 'primary.main' }}>
                        {agent.name?.charAt(0).toUpperCase() || 'A'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {agent.name}
                          <Chip 
                            label={agent.role} 
                            size="small" 
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                            color={agent.role === 'admin' ? 'error' : agent.role === 'supervisor' ? 'warning' : 'primary'}
                          />
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {agent.email} • {agent.status === 'online' ? '🟢 En línea' : '⚫ Offline'}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>
                  <Typography variant="body2" color="textSecondary">
                    No hay agentes disponibles
                  </Typography>
                </MenuItem>
              )}
            </TextField>
          )}

          {selectedChat && (
            <Paper sx={{ mt: 2, p: 2, bgcolor: 'grey.100' }}>
              <Typography variant="caption" color="textSecondary">
                Chat a transferir:
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <Avatar src={selectedChat.avatar_url} sx={{ width: 32, height: 32 }}>
                  {(selectedChat.name || '?').charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="body2">
                  {selectedChat.name || selectedChat.jid.split('@')[0].split(':')[0]}
                </Typography>
              </Box>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseTransferDialog} color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={handleTransferChat}
            variant="contained"
            color="primary"
            disabled={!selectedAgentId || loadingAgents}
            startIcon={<TransferIcon />}
          >
            Transferir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OptimizedChatSystem;
