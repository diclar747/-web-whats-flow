import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useWhatsApp } from '../context/WhatsAppContext';
import { getAPIBaseURL } from '../utils/socketConfig';
import { SubscriptionGuard } from '../components/SubscriptionGuard';
import ModernMessageMedia from '../components/ModernMessageMedia';
import ModernMessageActions from '../components/ModernMessageActions';
import {
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Divider,
  IconButton,
  CircularProgress,
  Box,
  Typography,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Menu,
  Stack
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  AttachFile as AttachIcon,
  Mic as MicIcon,
  InsertEmoticon as EmojiIcon,
  Done as DoneIcon,
  DoneAll as DoneAllIcon,
  Reply as ReplyIcon,
  Close as CloseIcon,
  WhatsApp,
  TransferWithinAStation as TransferIcon,
  Person,
  Category as CategoryIcon,
  Forward as ForwardIcon,
  AddReaction as AddReactionIcon,
  AccessTime,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

// Función para normalizar números de teléfono (eliminar sufijos como :0, :82, etc.)
const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return phone;
  // Eliminar sufijos como :0, :82, etc. que WhatsApp agrega para hilos/dispositivos
  return phone.split(':')[0];
};

interface RealChatModuleProps {
  sessionId: string;
}

const RealChatModule: React.FC<RealChatModuleProps> = ({ sessionId }) => {
  // SubscriptionGuard temporalmente deshabilitado para debugging
  return <RealChatModuleContent sessionId={sessionId} />;
};

const RealChatModuleContent: React.FC<RealChatModuleProps> = ({ sessionId }) => {
  const { isDarkMode } = useTheme();
  const {
    chats,
    activeChat,
    messages,
    isLoading,
    loadChats,
    loadMessages,
    sendMessage,
    setActiveChat,
    replyMessage,
    setReplyMessage,
    markChatAsRead,
    markAllChatsAsRead
  } = useWhatsApp();

  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups' | 'contacts'>('all');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showReactionMenu, setShowReactionMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [onlineAgents, setOnlineAgents] = useState<any[]>([]);
  const [kanbanBoards, setKanbanBoards] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [chatMenuAnchor, setChatMenuAnchor] = useState<{ element: HTMLElement; chat: any } | null>(null);
  const [transferType, setTransferType] = useState<'agent' | 'kanban'>('agent');
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<{ element: HTMLElement; message: any } | null>(null);
  const [quickKanbanChat, setQuickKanbanChat] = useState<any | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<any | null>(null);
  const [selectedChatForForward, setSelectedChatForForward] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionDetailsDialog, setReactionDetailsDialog] = useState<{ open: boolean; messageId: string | null }>({ open: false, messageId: null });
  const [reactionDetails, setReactionDetails] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '✅', '❌'];

  // Emoji picker categories
  const emojiCategories = {
    'Frecuentes': ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '✅', '❌'],
    'Emociones': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    'Gestos': ['🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶'],
    'Manos': ['👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🤳', '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️'],
    'Objetos': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '💯', '✅', '❌']
  };

  useEffect(() => {
    console.log('RealChatModule: Cargando chats para sessionId:', sessionId);
    loadChats(sessionId);
  }, [sessionId, loadChats]);

  // Ordenar chats por último mensaje
  const sortChatsByLastMessage = (chatsToSort: any[]) => {
    return [...chatsToSort].sort((a, b) => {
      const aTime = a.lastMessageTime || a.timestamp || 0;
      const bTime = b.lastMessageTime || b.timestamp || 0;
      return bTime - aTime; // Más reciente primero
    });
  };


  useEffect(() => {
    if (activeChat) {
      console.log('RealChatModule: Cargando mensajes para chat:', activeChat.id);
      loadMessages(activeChat.id);
    }
  }, [activeChat, loadMessages]);

  // Reacciones en tiempo real ahora manejadas por el contexto principal del socket.

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll to bottom when a new message arrives
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const loadOnlineAgents = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/agents/online`);
      const data = await response.json();
      if (data.success) {
        setOnlineAgents(data.agents.filter((a: any) => a.role === 'agent' || a.role === 'supervisor'));
      }
    } catch (error) {
      console.error('Error cargando agentes:', error);
    }
  };

  const handleOpenTransferDialog = () => {
    setMoreMenuAnchor(null);
    loadOnlineAgents();
    setTransferDialogOpen(true);
    setSelectedAgent('');
    setTransferReason('');
  };

  const handleSyncChat = async () => {
    if (!activeChat || isSyncing) return;

    setIsSyncing(true);
    try {
      // Recargar mensajes del chat activo
      await loadMessages(activeChat.id);
      console.log('✅ Chat sincronizado correctamente');
    } catch (error) {
      console.error('❌ Error sincronizando chat:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadKanbanBoards = async () => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/kanban/boards/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setKanbanBoards(data.data.boards || []);
      }
    } catch (error) {
      console.error('Error cargando tableros Kanban:', error);
    }
  };

  const handleOpenTransferDialogFromChat = (chat: any) => {
    setChatMenuAnchor(null);
    loadOnlineAgents();
    loadKanbanBoards();
    setActiveChat(chat); // Set as active so transfer uses this chat
    setTransferDialogOpen(true);
    setSelectedAgent('');
    setSelectedBoard('');
    setTransferReason('');
    setTransferType('agent');
  };

  const handleTransferChat = async () => {
    if (!activeChat) return;

    // Transfer to agent
    if (transferType === 'agent' && selectedAgent) {
      try {
        const response = await fetch(`${getAPIBaseURL()}/api/chats/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeChat.id,
            toAgentId: selectedAgent,
            sessionId,
            reason: transferReason || 'Transferencia manual'
          })
        });

        const data = await response.json();
        if (data.success) {
          setTransferSuccess('Chat transferido a agente exitosamente');
          setTimeout(() => {
            setTransferSuccess(null);
            setTransferDialogOpen(false);
          }, 2000);
        } else {
          setTransferError(data.error);
        }
      } catch (error) {
        console.error('Error transfiriendo chat:', error);
        setTransferError('Error transfiriendo chat');
      }
    }

    // Transfer to Kanban board
    if (transferType === 'kanban' && selectedBoard) {
      try {
        // Extract phone from chat ID and normalize (remove device suffixes like :0, :82, etc.)
        const rawPhone = activeChat.id.replace('@c.us', '').replace('@g.us', '');
        const phone = normalizePhoneNumber(rawPhone);

        const response = await fetch(`${getAPIBaseURL()}/api/contacts/categorize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            contactId: phone,
            category: selectedBoard,
          }),
        });

        const data = await response.json();
        if (data.success) {
          const boardName = kanbanBoards.find(b => b.id === selectedBoard)?.name || 'tablero';
          setTransferSuccess(`Contacto movido a ${boardName} exitosamente`);
          setTimeout(() => {
            setTransferSuccess(null);
            setTransferDialogOpen(false);
          }, 2000);
        } else {
          setTransferError(data.error);
        }
      } catch (error) {
        console.error('Error moviendo a Kanban:', error);
        setTransferError('Error moviendo contacto a Kanban');
      }
    }
  };

  const handleSendMessage = () => {
    if (selectedFile) {
      handleSendFile();
    } else if (newMessage.trim() && activeChat) {
      const contextInfo = replyMessage ? {
        quotedMessageId: replyMessage.id,
        quotedMessageText: replyMessage.message,
        quotedMessageSender: replyMessage.from
      } : undefined;
      sendMessage(activeChat.id, newMessage, contextInfo);
      setNewMessage('');
      setReplyMessage(null);
    }
  };

  const handleReplyClick = (message: any) => {
    setReplyMessage(message);
  };

  const handleReactionClick = async (messageId: string, reaction: string) => {
    try {
      console.log(`Agregando reacción ${reaction} al mensaje ${messageId}`);

      // Enviar reacción al servidor
      const response = await fetch(`${getAPIBaseURL()}/api/messages/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messageId,
          reaction
        })
      });

      const data = await response.json();
      if (data.success) {
        console.log('Reacción agregada exitosamente');
        // Recargar mensajes para ver la nueva reacción
        if (activeChat) {
          loadMessages(activeChat.id);
        }
      }

      setShowReactionMenu(null);
      setMessageMenuAnchor(null);
    } catch (error) {
      console.error('Error agregando reacción:', error);
    }
  };

  const handleQuickSendToKanban = async (chat: any) => {
    setQuickKanbanChat(chat);
    await loadKanbanBoards();
  };

  const handleQuickKanbanSelect = async (boardId: string) => {
    if (!quickKanbanChat) return;

    try {
      const phone = quickKanbanChat.id.replace('@c.us', '').replace('@g.us', '');

      const response = await fetch(`${getAPIBaseURL()}/api/contacts/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contactId: phone,
          category: boardId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const boardName = kanbanBoards.find(b => b.id === boardId)?.name || 'tablero';
        setTransferSuccess(`Contacto movido a ${boardName} exitosamente`);
        setTimeout(() => setTransferSuccess(null), 2000);
      }
    } catch (error) {
      console.error('Error moviendo a Kanban:', error);
    }

    setQuickKanbanChat(null);
  };

  const handleForwardMessage = async (message: any) => {
    setMessageToForward(message);
    setForwardDialogOpen(true);
    setMessageMenuAnchor(null);
  };

  const handleConfirmForward = async () => {
    if (!messageToForward || !selectedChatForForward) return;

    try {
      // Reenviar mensaje al chat seleccionado
      const contextInfo = {
        isForwarded: true,
        forwardedFrom: messageToForward.from
      };

      await sendMessage(selectedChatForForward, messageToForward.message, contextInfo);

      setTransferSuccess('Mensaje reenviado exitosamente');
      setTimeout(() => {
        setTransferSuccess(null);
        setForwardDialogOpen(false);
        setMessageToForward(null);
        setSelectedChatForForward('');
      }, 2000);
    } catch (error) {
      console.error('Error reenviando mensaje:', error);
      setTransferError('Error al reenviar mensaje');
    }
  };

  const loadReactionDetails = async (messageId: string) => {
    try {
      const response = await fetch(`${getAPIBaseURL()}/api/messages/${messageId}/reactions/details?sessionId=${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setReactionDetails(data.reactions);
        setReactionDetailsDialog({ open: true, messageId });
      }
    } catch (error) {
      console.error('Error cargando detalles de reacciones:', error);
    }
  };

  const handleMessageRightClick = (event: React.MouseEvent, messageId: string) => {
    event.preventDefault();
    setShowReactionMenu({
      messageId,
      x: event.clientX,
      y: event.clientY
    });
  };

  const getMessageStatusIcon = (message: any) => {
    if (!message.isFromMe) return null;

    switch (message.status) {
      case 'pending':
        return <AccessTime sx={{ fontSize: '14px', color: '#667781' }} />;
      case 'sending':
        return <CircularProgress sx={{ fontSize: '14px', color: '#667781' }} size={14} />;
      case 'sent':
        return <DoneIcon sx={{ fontSize: '14px', color: '#667781' }} />;
      case 'delivered':
        return <DoneAllIcon sx={{ fontSize: '14px', color: '#667781' }} />;
      case 'read':
        return <DoneAllIcon sx={{ fontSize: '14px', color: '#25D366' }} />; // WhatsApp green
      case 'failed':
        return <ErrorIcon sx={{ fontSize: '14px', color: '#f44336' }} />;
      default:
        return <DoneIcon sx={{ fontSize: '14px', color: '#667781' }} />;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || !activeChat) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64Content = base64Data.split(',')[1];

        let endpoint = '';
        const formData = {
          sessionId: sessionId,
          number: activeChat.id
        };

        if (selectedFile.type.startsWith('image/')) {
          endpoint = '/api/send/image';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).caption = newMessage || '';
          (formData as any).mimetype = selectedFile.type;
        } else if (selectedFile.type.startsWith('audio/')) {
          endpoint = '/api/send/audio';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).mimetype = selectedFile.type;
        } else if (selectedFile.type.startsWith('video/')) {
          endpoint = '/api/send/video';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).caption = newMessage || '';
          (formData as any).mimetype = selectedFile.type;
        } else {
          // Documentos y otros archivos
          endpoint = '/api/send/document';
          (formData as any).url = `data:${selectedFile.type};base64,${base64Content}`;
          (formData as any).fileName = selectedFile.name;
          (formData as any).mimetype = selectedFile.type;
        }

        const response = await fetch(`${getAPIBaseURL()}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (data.success) {
          setNewMessage('');
          setSelectedFile(null);
          setFilePreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          // Recargar mensajes para ver el archivo enviado
          loadMessages(activeChat.id);
        } else {
          console.error('Error enviando archivo:', data.error);
          setTransferError('Error al enviar archivo: ' + data.error);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Error procesando archivo:', error);
      setTransferError('Error al procesar archivo');
    }
  };

  const getContactName = (message: any) => {
    // 🆕 Primero intentar usar el nombre que viene en el mensaje
    if (message.senderName) return message.senderName;

    // Fallback: buscar en el array de chats
    const chat = chats.find(c => c.id === message.from || c.id === message.chatJid);
    if (chat) return chat.name;
    if (message.from && message.from.includes('@')) return message.from.split('@')[0];
    return 'Desconocido';
  };

  const getContactAvatar = (message: any) => {
    // 🆕 Primero intentar usar el avatar que viene en el mensaje
    if (message.senderAvatar) return message.senderAvatar;

    // Fallback: buscar en el array de chats
    const chat = chats.find(c => c.id === message.from || c.id === message.chatJid);
    if (chat?.avatar) return chat.avatar;

    // Último fallback: construir URL del endpoint de avatar
    const contactJid = message.from || message.chatJid;
    if (contactJid && !contactJid.includes('@g.us')) {
      const fullJid = contactJid.includes('@') ? contactJid : `${contactJid}@s.whatsapp.net`;
      return `${getAPIBaseURL()}/api/avatar/${sessionId}/${fullJid}`;
    }
    return null;
  };

  const filteredChats = chats.filter(chat => {
    if (searchTerm && !chat.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    switch (filterType) {
      case 'unread': return chat.unreadCount && chat.unreadCount > 0;
      case 'groups': return chat.isGroup;
      case 'contacts': return !chat.isGroup;
      default: return true;
    }
  });

  return (
    <>
      {/* 🆕 Socket.IO maneja todo en tiempo real - Sin sincronización manual */}

      <div style={{
        display: 'flex',
        height: 'calc(100vh - 64px)', // Adjust height to account for the top app bar
        backgroundColor: isDarkMode ? '#0c1317' : '#f0f2f5'
      }}>
        {/* Sidebar de contactos */}
        <div style={{
          width: '30%',
          borderRight: `1px solid ${isDarkMode ? '#303d45' : '#e9edef'}`,
          backgroundColor: isDarkMode ? '#111b21' : '#fff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '10px 16px',
            backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar o empezar nuevo chat"
              InputProps={{
                startAdornment: <SearchIcon style={{ marginRight: 8 }} />,
                style: {
                  backgroundColor: isDarkMode ? '#111b21' : '#fff',
                  borderRadius: '8px'
                }
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <IconButton
              onClick={() => {
                console.log('🔄 Recargando chats manualmente...');
                loadChats(sessionId);
              }}
              size="small"
              sx={{ color: isDarkMode ? '#aebac1' : '#667781' }}
              title="Recargar chats"
            >
              {/* RefreshIcon eliminado - Socket.IO maneja todo en tiempo real */}
            </IconButton>
            <IconButton
              onClick={async () => {
                console.log('🔄 Forzando sincronización completa...');
                // setIsInitialLoading(true);
                // setLoadError(null);

                try {
                  const response = await fetch(`${getAPIBaseURL()}/api/force-sync/${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });

                  const data = await response.json();

                  if (data.success) {
                    console.log('✅ Sincronización forzada exitosa');
                    // setLoadError(null);
                    // Recargar chats después de sincronización
                    setTimeout(() => loadChats(sessionId), 2000);
                  } else {
                    console.error('❌ Error en sincronización forzada:', data.error);
                    // setLoadError('Error en sincronización forzada');
                  }
                } catch (error) {
                  console.error('❌ Error forzando sincronización:', error);
                  // setLoadError('Error de conexión en sincronización');
                }

                // setIsInitialLoading(false);
              }}
              size="small"
              sx={{ color: '#00a884' }}
              title="Sincronizar con WhatsApp"
            >
              <WhatsApp sx={{ fontSize: 20 }} />
            </IconButton>
          </div>

          <List style={{ overflowY: 'auto', flex: 1 }}>
            {isInitialLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body2" color="textSecondary">
                  {connectionStatus === 'checking' && 'Verificando conexión...'}
                  {connectionStatus === 'connected' && 'Cargando chats...'}
                  {connectionStatus === 'disconnected' && 'Conectando a WhatsApp...'}
                  {connectionStatus === 'error' && 'Error de conexión'}
                </Typography>
              </Box>
            ) : loadError ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Typography variant="body2" color="error" sx={{ textAlign: 'center', mb: 2 }}>
                  {loadError}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    // setLoadError(null);
                    // setIsInitialLoading(true);
                    loadChats(sessionId);
                  }}
                  sx={{ mt: 1 }}
                >
                  Reintentar
                </Button>
              </Box>
            ) : chats.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mb: 2 }}>
                  {connectionStatus === 'connected'
                    ? 'No se encontraron chats en WhatsApp'
                    : 'No hay chats disponibles'
                  }
                </Typography>
                <Typography variant="caption" color="textSecondary" sx={{ textAlign: 'center', mb: 2 }}>
                  {connectionStatus === 'connected'
                    ? 'Es posible que no tengas conversaciones recientes o que necesites sincronizar tus chats.'
                    : 'Conecte WhatsApp para ver sus conversaciones'
                  }
                </Typography>
                {chats.some(chat => chat.id.includes('549123456789@c.us')) && (
                  <Typography variant="caption" sx={{ textAlign: 'center', mb: 2, color: '#ff9800', fontStyle: 'italic' }}>
                    💡 Se muestran chats de prueba para verificar el funcionamiento del sistema
                  </Typography>
                )}
                {connectionStatus === 'connected' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={async () => {
                        console.log('🔄 Forzando recarga de chats...');
                        // setIsInitialLoading(true);
                        try {
                          await loadChats(sessionId);
                        } catch (error) {
                          console.error('Error recargando chats:', error);
                        }
                        // setIsInitialLoading(false);
                      }}
                      sx={{ mt: 1 }}
                    >
                      Recargar Chats
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={async () => {
                        console.log('🔍 Verificando estado de chats...');
                        try {
                          const response = await fetch(`${getAPIBaseURL()}/api/chats-status/${sessionId}`);
                          const data = await response.json();
                          if (data.success) {
                            console.log('Estado de chats:', data.status);
                            alert(`Estado de WhatsApp:\n- Conectado: ${data.status.isConnected}\n- Socket disponible: ${data.status.hasSocket}\n- Store disponible: ${data.status.hasStore}\n- Chats en store: ${data.status.chatsInStore}\n- Chats con getChats: ${data.status.chatsFromGetChats}\n- Chats en BD: ${data.status.chatsInDatabase}`);
                          }
                        } catch (error) {
                          console.error('Error verificando estado:', error);
                          alert('Error al verificar estado de chats');
                        }
                      }}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      Verificar Estado
                    </Button>
                  </Box>
                )}
              </Box>
            ) : (
              <>
                {/* Filtros de chats */}
                <Box sx={{
                  px: 2,
                  py: 1,
                  backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
                  borderBottom: `1px solid ${isDarkMode ? '#303d45' : '#d1d7db'}`
                }}>
                  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
                    <Chip
                      label={`Todos (${chats.length})`}
                      size="small"
                      variant={filterType === 'all' ? 'filled' : 'outlined'}
                      onClick={() => setFilterType('all')}
                      sx={{
                        backgroundColor: filterType === 'all' ? '#00a884' : 'transparent',
                        color: filterType === 'all' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                        fontSize: '0.75rem',
                        height: 28,
                        minWidth: 'auto'
                      }}
                    />
                    <Chip
                      label={`No leídos (${chats.filter(c => c.unreadCount && c.unreadCount > 0).length})`}
                      size="small"
                      variant={filterType === 'unread' ? 'filled' : 'outlined'}
                      onClick={() => setFilterType('unread')}
                      sx={{
                        backgroundColor: filterType === 'unread' ? '#00a884' : 'transparent',
                        color: filterType === 'unread' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                        fontSize: '0.75rem',
                        height: 28,
                        minWidth: 'auto'
                      }}
                    />
                    <Chip
                      label={`Grupos (${chats.filter(c => c.isGroup).length})`}
                      size="small"
                      variant={filterType === 'groups' ? 'filled' : 'outlined'}
                      onClick={() => setFilterType('groups')}
                      sx={{
                        backgroundColor: filterType === 'groups' ? '#00a884' : 'transparent',
                        color: filterType === 'groups' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                        fontSize: '0.75rem',
                        height: 28,
                        minWidth: 'auto'
                      }}
                    />
                    <Chip
                      label={`Contactos (${chats.filter(c => !c.isGroup).length})`}
                      size="small"
                      variant={filterType === 'contacts' ? 'filled' : 'outlined'}
                      onClick={() => setFilterType('contacts')}
                      sx={{
                        backgroundColor: filterType === 'contacts' ? '#00a884' : 'transparent',
                        color: filterType === 'contacts' ? 'white' : isDarkMode ? '#aebac1' : '#667781',
                        fontSize: '0.75rem',
                        height: 28,
                        minWidth: 'auto'
                      }}
                    />
                  </Box>
                </Box>

                {/* Estadísticas de chats */}
                <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="textSecondary">
                    {filteredChats.length} chats • {filteredChats.filter(c => c.isGroup).length} grupos • {filteredChats.filter(c => !c.isGroup).length} contactos
                  </Typography>
                </Box>

                {filteredChats.map(chat => (
                  <ListItem
                    key={chat.id}
                    button
                    selected={activeChat?.id === chat.id}
                    onClick={async () => {
                      console.log('📱 [CHAT] Abriendo chat:', chat.name, '- unreadCount:', chat.unreadCount);
                      setActiveChat(chat);

                      // Marcar chat como leído INMEDIATAMENTE en el contexto (actualiza badge al instante)
                      if (chat.unreadCount && chat.unreadCount > 0) {
                        console.log('🔔 [CHAT] Marcando chat como leído:', chat.id);
                        markChatAsRead(chat.id);

                        // Enviar petición al servidor para marcar mensajes como leídos
                        try {
                          await fetch(`${getAPIBaseURL()}/api/messages/mark-read`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              sessionId,
                              chatJid: chat.id
                            })
                          });
                          console.log('✅ [CHAT] Mensajes marcados como leídos en el servidor');
                        } catch (error) {
                          console.error('❌ [CHAT] Error marcando mensajes como leídos:', error);
                        }
                      }
                    }}
                    style={{
                      backgroundColor: activeChat?.id === chat.id
                        ? isDarkMode ? '#2a3942' : '#f5f6f6'
                        : 'transparent'
                    }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSendToKanban(chat);
                          }}
                          sx={{
                            color: isDarkMode ? '#aebac1' : '#667781',
                            '&:hover': { color: '#673ab7' }
                          }}
                          title="Enviar a Kanban"
                        >
                          <CategoryIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatMenuAnchor({ element: e.currentTarget, chat });
                          }}
                          size="small"
                          sx={{ color: isDarkMode ? '#aebac1' : '#667781' }}
                        >
                          <MoreIcon />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemAvatar>
                      <Badge
                        badgeContent={chat.unreadCount && chat.unreadCount > 0 ? chat.unreadCount : null}
                        color="error"
                        sx={{
                          '& .MuiBadge-badge': {
                            backgroundColor: '#f44336',
                            color: 'white',
                            minWidth: '20px',
                            height: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }
                        }}
                      >
                        <Avatar
                          src={chat.avatar}
                          sx={{
                            bgcolor: chat.isGroup ? '#9c27b0' : '#607d8b',
                            width: 48,
                            height: 48
                          }}
                        >
                          {chat.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={chat.name}
                      secondary={chat.lastMessage}
                      secondaryTypographyProps={{
                        color: isDarkMode ? '#aebac1' : '#667781',
                        noWrap: true,
                        style: { textOverflow: 'ellipsis', overflow: 'hidden', width: '140px' }
                      }}
                    />
                    <ListItemText
                      secondary={new Date(chat.timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      style={{ textAlign: 'right', marginRight: '40px' }}
                      secondaryTypographyProps={{
                        color: isDarkMode ? '#aebac1' : '#667781'
                      }}
                    />
                  </ListItem>
                ))}
              </>
            )}
          </List>
        </div>

        {/* Área de chat principal */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isDarkMode ? '#0c1317' : '#e5ddd5',
          minHeight: 0 // Para que el flex interno funcione correctamente
        }}>
          {activeChat ? (
            <>
              {/* Cabecera del chat */}
              <div style={{
                padding: '12px 16px',
                backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
                display: 'flex',
                alignItems: 'center',
                borderBottom: `1px solid ${isDarkMode ? '#303d45' : '#e9edef'}`,
                boxShadow: isDarkMode ? '0 1px 0 rgba(255, 255, 255, 0.06)' : '0 1px 0 rgba(0, 0, 0, 0.05)',
                position: 'relative'
              }}>
                <Avatar
                  src={activeChat?.avatar}
                  sx={{
                    bgcolor: activeChat?.isGroup ? '#9c27b0' : '#00a884',
                    width: 40,
                    height: 40
                  }}
                >
                  {activeChat?.name.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ marginLeft: '15px', flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{activeChat?.name}</div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: isDarkMode ? '#aebac1' : '#667781',
                  }}>
                    {typingUsers.length > 0 ? (
                      <span style={{ color: '#00a884' }}>
                        escribiendo...
                      </span>
                    ) : (
                      activeChat?.isOnline ? 'En línea' :
                        activeChat?.lastSeen ? `Últ. vez ${new Date(activeChat.lastSeen).toLocaleString()}` :
                          'Desconectado'
                    )}
                  </div>
                </div>
                <IconButton
                  onClick={handleSyncChat}
                  disabled={isSyncing}
                  title="Sincronizar mensajes"
                  sx={{
                    color: isDarkMode ? '#aebac1' : '#54656f',
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                    }
                  }}
                >
                  {isSyncing ? (
                    <CircularProgress size={24} sx={{ color: '#00a884' }} />
                  ) : (
                    <RefreshIcon />
                  )}
                </IconButton>
                <IconButton onClick={(e) => setMoreMenuAnchor(e.currentTarget)}>
                  <MoreIcon />
                </IconButton>
                <Menu
                  anchorEl={moreMenuAnchor}
                  open={Boolean(moreMenuAnchor)}
                  onClose={() => setMoreMenuAnchor(null)}
                >
                  <MenuItem onClick={() => {
                    markAllChatsAsRead();
                    setMoreMenuAnchor(null);
                  }}>
                    <DoneAllIcon sx={{ mr: 1 }} />
                    Marcar todo como leído
                  </MenuItem>
                  <MenuItem onClick={handleOpenTransferDialog}>
                    <TransferIcon sx={{ mr: 1 }} />
                    Transferir Chat
                  </MenuItem>
                </Menu>
              </div>

              {/* Mensajes */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                backgroundColor: isDarkMode ? '#0c1317' : '#e5ddd5',
                backgroundImage: isDarkMode
                  ? 'url("data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%23111b21\" fill-opacity=\"0.05\" fill-rule=\"evenodd\"%3E%3Cpath d=\"M0 0h60v60H0V0zm4 4h52v7H4V4zm0 11h52v7H4v-7zm0 11h52v7H4v-7zm0 11h52v7H4v-7zm0 11h52v7H4v-7z\"/%3E%3C/g%3E%3C/svg%3E")'
                  : 'url("data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"%23e5ddd5\" fill-opacity=\"0.08\" fill-rule=\"evenodd\"%3E%3Cpath d=\"M0 0h60v60H0V0zm4 4h52v7H4V4zm0 11h52v7H4v-7zm0 11h52v7H4v-7zm0 11h52v7H4v-7zm0 11h52v7H4v-7z\"/%3E%3C/g%3E%3C/svg%3E")',
                backgroundAttachment: 'fixed',
              }}>
                {isLoading && messages.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: msg.isFromMe ? 'flex-end' : 'flex-start',
                      marginBottom: '10px',
                      alignItems: 'flex-end',
                      maxWidth: '90%',
                      marginLeft: msg.isFromMe ? 'auto' : '10px',
                      marginRight: !msg.isFromMe ? 'auto' : '10px',
                      position: 'relative'
                    }}>
                      {!msg.isFromMe && (
                        <Avatar
                          src={getContactAvatar(msg) || undefined}
                          sx={{
                            width: 32,
                            height: 32,
                            mr: 1,
                            bgcolor: '#00a884',
                            flexShrink: 0
                          }}
                        >
                          {getContactName(msg).charAt(0)}
                        </Avatar>
                      )}

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        maxWidth: '100%'
                      }}>
                        {!msg.isFromMe && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? '#aebac1' : '#667781',
                              ml: msg.isFromMe ? 0 : 1,
                              mb: 0.25,
                              fontWeight: 500,
                              alignSelf: 'flex-start',
                              fontSize: '0.75rem'
                            }}
                          >
                            {getContactName(msg)}
                          </Typography>
                        )}

                        <div style={{ position: 'relative' }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMessageMenuAnchor({ element: e.currentTarget, message: msg });
                            }}
                            sx={{
                              position: 'absolute',
                              top: -8,
                              right: msg.isFromMe ? -8 : 'auto',
                              left: msg.isFromMe ? 'auto' : -8,
                              opacity: 0.7,
                              '&:hover': { opacity: 1 },
                              padding: '4px',
                              bgcolor: isDarkMode ? '#2a3942' : '#f0f2f5',
                              zIndex: 2
                            }}
                          >
                            <MoreIcon sx={{ fontSize: 16 }} />
                          </IconButton>

                          <div
                            style={{
                              padding: msg.type !== 'document' && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'audio' ? '8px 12px' : '4px',
                              borderRadius: msg.type !== 'document' && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'audio' ? '7.5px' : '8px',
                              backgroundColor: msg.isFromMe
                                ? isDarkMode ? '#005c4b' : '#d9fdd3'  // WhatsApp green for sent
                                : isDarkMode ? '#2a3942' : '#ffffff', // Default for received
                              color: isDarkMode ? '#e9edef' : '#111b21',
                              position: 'relative',
                              cursor: 'pointer',
                              border: msg.isFromMe
                                ? '1px solid rgba(37, 211, 102, 0.3)'  // Subtle green border for sent
                                : '1px solid rgba(185, 214, 243, 0.3)', // Subtle blue border for received
                              boxShadow: '0 1px 0.5px rgba(0, 0, 0, 0.05)',
                              maxWidth: '75%',
                              wordWrap: 'break-word',
                              alignSelf: msg.isFromMe ? 'flex-end' : 'flex-start'
                            }}
                            onContextMenu={(e) => handleMessageRightClick(e, msg.id)}
                          >
                            {msg.contextInfo && (
                              <Paper
                                elevation={0}
                                sx={{
                                  bgcolor: isDarkMode ? '#1a262f' : '#e0e0e0',
                                  p: 1,
                                  mb: 1,
                                  borderRadius: '5px',
                                  borderLeft: `4px solid ${msg.isFromMe ? '#25d366' : '#007bff'}`
                                }}
                              >
                                <Typography variant="caption" sx={{ fontWeight: 'bold', color: msg.isFromMe ? '#25d366' : '#007bff' }}>
                                  {(() => {
                                    const quotedSenderJid = msg.contextInfo?.quotedMessageSender;
                                    if (!quotedSenderJid) return 'Desconocido';
                                    const senderChat = chats.find(chat => chat.id === quotedSenderJid);
                                    return senderChat ? senderChat.name : (quotedSenderJid === 'me' ? 'Tú' : quotedSenderJid.split('@')[0]);
                                  })()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: isDarkMode ? '#aebac1' : '#667781' }} noWrap>
                                  {msg.contextInfo.quotedMessageText}
                                </Typography>
                              </Paper>
                            )}

                            {/* 🆕 Componente moderno para renderizar medios (imágenes, videos, audio, stickers, documentos) */}
                            <ModernMessageMedia
                              type={msg.type}
                              mediaUrl={msg.mediaUrl}
                              mediaMimeType={msg.mediaMimeType}
                              message={msg.message}
                              isFromMe={msg.isFromMe}
                              isDarkMode={isDarkMode}
                            />

                            {/* 🆕 Acciones modernas del mensaje (responder, reenviar, reaccionar, etc.) */}
                            <ModernMessageActions
                              messageId={msg.id}
                              isFromMe={msg.isFromMe}
                              isDarkMode={isDarkMode}
                              messageText={msg.message}
                              mediaUrl={msg.mediaUrl}
                              onReply={() => setReplyMessage(msg)}
                              onForward={() => {
                                setMessageToForward(msg);
                                setForwardDialogOpen(true);
                              }}
                              onReact={() => {
                                setShowReactionMenu({ messageId: msg.id, x: 0, y: 0 });
                              }}
                              onTransfer={() => {
                                setTransferDialogOpen(true);
                              }}
                              onCopy={() => {
                                if (msg.message) {
                                  navigator.clipboard.writeText(msg.message);
                                }
                              }}
                            />

                            <div style={{
                              fontSize: '0.65rem',
                              textAlign: 'right',
                              color: isDarkMode ? '#aebac1' : '#667781',
                              marginTop: msg.type === 'image' || msg.type === 'video' || msg.type === 'document' || msg.type === 'audio' ? '8px' : '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: msg.isFromMe ? 'flex-end' : 'flex-start',
                              gap: '4px',
                              alignSelf: 'flex-end',
                              minHeight: '16px'
                            }}>
                              <span>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {msg.isFromMe && (
                                <span style={{ display: 'flex', alignItems: 'center' }}>
                                  {getMessageStatusIcon(msg)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Reacciones - Posicionadas fuera del mensaje */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: -12,
                                right: msg.isFromMe ? 8 : 'auto',
                                left: msg.isFromMe ? 'auto' : 8,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 0.5,
                                zIndex: 1
                              }}
                            >
                              {msg.reactions.map((reaction: any, index: number) => (
                                <Chip
                                  key={index}
                                  label={`${reaction.reaction} ${reaction.count > 1 ? reaction.count : ''}`}
                                  size="small"
                                  onClick={() => loadReactionDetails(msg.id)}
                                  sx={{
                                    height: '22px',
                                    fontSize: '14px',
                                    bgcolor: isDarkMode ? '#2a3942' : '#fff',
                                    color: isDarkMode ? '#e9edef' : '#111b21',
                                    border: `1px solid ${isDarkMode ? '#3f4f5a' : '#e0e0e0'}`,
                                    '& .MuiChip-label': { px: 1, py: 0 },
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      bgcolor: isDarkMode ? '#3f4f5a' : '#f0f2f5',
                                      transform: 'scale(1.05)'
                                    },
                                    transition: 'all 0.2s'
                                  }}
                                />
                              ))}
                            </Box>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div style={{
                padding: '8px 16px',
                backgroundColor: isDarkMode ? '#202c33' : '#f0f2f5',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                borderTop: `1px solid ${isDarkMode ? '#313a42' : '#e9edef'}`
              }}>
                {replyMessage && (
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      bgcolor: isDarkMode ? '#1a262f' : '#e0e0e0',
                      p: 1,
                      borderRadius: '8px',
                      borderLeft: `4px solid ${replyMessage?.isFromMe ? '#25d366' : '#007bff'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold', color: replyMessage?.isFromMe ? '#25d366' : '#007bff' }}>
                        {replyMessage?.isFromMe ? 'Tú' : replyMessage?.from.split('@')[0]}
                      </Typography>
                      <Typography variant="body2" sx={{ color: isDarkMode ? '#aebac1' : '#667781' }} noWrap>
                        {replyMessage?.message}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setReplyMessage(null)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                )}
                {filePreview && selectedFile && (
                  <Paper elevation={3} sx={{ mb: 2, p: 2, bgcolor: isDarkMode ? '#2a3942' : '#f5f5f5', borderRadius: 2, maxWidth: '400px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Vista previa
                      </Typography>
                      <IconButton size="small" onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    {selectedFile.type.startsWith('image/') ? (
                      <img src={filePreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', marginBottom: '8px' }} />
                    ) : selectedFile.type.startsWith('video/') ? (
                      <video src={filePreview} controls style={{ width: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '8px' }} />
                    ) : selectedFile.type.startsWith('audio/') ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: isDarkMode ? '#1a262f' : '#e0e0e0', borderRadius: 1, mb: 1 }}>
                        <MicIcon sx={{ fontSize: 40, color: '#00a884' }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{selectedFile.name}</Typography>
                          <Typography variant="caption" color="textSecondary">Audio • {(selectedFile.size / 1024).toFixed(0)} KB</Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: isDarkMode ? '#1a262f' : '#e0e0e0', borderRadius: 1, mb: 1 }}>
                        <AttachIcon sx={{ fontSize: 40, color: '#007bff' }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{selectedFile.name}</Typography>
                          <Typography variant="caption" color="textSecondary">Documento • {(selectedFile.size / 1024).toFixed(0)} KB</Typography>
                        </Box>
                      </Box>
                    )}

                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                      {selectedFile.name} • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </Typography>
                  </Paper>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <IconButton>
                    <EmojiIcon />
                  </IconButton>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                    style={{ display: 'none' }}
                  />

                  <IconButton onClick={() => fileInputRef.current?.click()}>
                    <AttachIcon />
                  </IconButton>

                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder={selectedFile ? "Agrega un mensaje..." : "Escribe un mensaje"}
                    multiline
                    maxRows={3}
                    style={{
                      backgroundColor: isDarkMode ? '#2a3942' : '#fff',
                      borderRadius: '8px'
                    }}
                  />

                  <IconButton
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() && !selectedFile}
                    sx={{
                      bgcolor: (newMessage.trim() || selectedFile) ? '#00a884' : 'transparent',
                      color: (newMessage.trim() || selectedFile) ? 'white' : 'inherit',
                      '&:hover': {
                        bgcolor: (newMessage.trim() || selectedFile) ? '#008f7a' : 'transparent'
                      }
                    }}
                  >
                    <SendIcon />
                  </IconButton>
                </Box>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#aebac1' : '#667781'
            }}>
              <div style={{ textAlign: 'center' }}>
                <WhatsApp sx={{ fontSize: 80, color: isDarkMode ? '#2a3942' : '#f0f2f5' }} />
                <Typography variant="h5" component="h2" sx={{ mt: 2 }}>
                  WhatsFlow Web
                </Typography>
                <Typography sx={{ mt: 1, maxWidth: 400 }}>
                  Envía y recibe mensajes sin tener que mantener tu teléfono conectado. <br />
                  Tus mensajes están sincronizados y guardados de forma segura.
                </Typography>
              </div>
            </div>
          )}
        </div>

        {/* Menú de reacciones */}
        {showReactionMenu && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999
              }}
              onClick={() => setShowReactionMenu(null)}
            />
            <Paper
              elevation={8}
              style={{
                position: 'fixed',
                top: showReactionMenu.y,
                left: showReactionMenu.x,
                zIndex: 1000,
                padding: '8px',
                backgroundColor: isDarkMode ? '#202c33' : '#fff',
                borderRadius: '8px',
                display: 'flex',
                gap: '4px',
                flexWrap: 'wrap',
                maxWidth: '300px'
              }}
            >
              {commonReactions.map((reaction) => (
                <IconButton
                  key={reaction}
                  size="small"
                  onClick={() => handleReactionClick(showReactionMenu.messageId, reaction)}
                  sx={{
                    fontSize: '20px',
                    padding: '4px',
                    '&:hover': {
                      backgroundColor: isDarkMode ? '#2a3942' : '#f0f2f5'
                    }
                  }}
                >
                  {reaction}
                </IconButton>
              ))}
              <IconButton
                size="small"
                onClick={() => {
                  setShowEmojiPicker(true);
                }}
                sx={{
                  fontSize: '20px',
                  padding: '4px',
                  bgcolor: isDarkMode ? '#2a3942' : '#f0f2f5',
                  '&:hover': {
                    backgroundColor: isDarkMode ? '#3f4f5a' : '#e0e0e0'
                  }
                }}
                title="Más emojis"
              >
                ➕
              </IconButton>
            </Paper>
          </>
        )}

        {/* Menu contextual de mensaje */}
        <Menu
          anchorEl={messageMenuAnchor?.element}
          open={Boolean(messageMenuAnchor)}
          onClose={() => setMessageMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            if (messageMenuAnchor) {
              handleReplyClick(messageMenuAnchor.message);
              setMessageMenuAnchor(null);
            }
          }}>
            <ReplyIcon sx={{ mr: 1 }} />
            Responder
          </MenuItem>
          <MenuItem onClick={() => {
            if (messageMenuAnchor) {
              handleForwardMessage(messageMenuAnchor.message);
            }
          }}>
            <ForwardIcon sx={{ mr: 1 }} />
            Reenviar
          </MenuItem>
          <MenuItem onClick={(e) => {
            if (messageMenuAnchor) {
              setShowReactionMenu({
                messageId: messageMenuAnchor.message.id,
                x: e.clientX,
                y: e.clientY
              });
            }
          }}>
            <AddReactionIcon sx={{ mr: 1 }} />
            Reaccionar
          </MenuItem>
        </Menu>

        {/* Menu contextual de chat */}
        <Menu
          anchorEl={chatMenuAnchor?.element}
          open={Boolean(chatMenuAnchor)}
          onClose={() => setChatMenuAnchor(null)}
        >
          <MenuItem onClick={() => {
            if (chatMenuAnchor) {
              handleOpenTransferDialogFromChat(chatMenuAnchor.chat);
            }
          }}>
            <TransferIcon sx={{ mr: 1 }} />
            Transferir
          </MenuItem>
        </Menu>

        {/* Diálogo de selección rápida de Kanban */}
        <Dialog
          open={Boolean(quickKanbanChat)}
          onClose={() => setQuickKanbanChat(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Enviar a Kanban</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Selecciona un tablero Kanban para {quickKanbanChat?.name}
            </Typography>
            <List>
              {kanbanBoards.map((board) => (
                <ListItem
                  key={board.id}
                  button
                  onClick={() => handleQuickKanbanSelect(board.id)}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      bgcolor: isDarkMode ? '#2a3942' : '#f5f6f6'
                    }
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: board.color,
                      borderRadius: 1,
                      mr: 2
                    }}
                  />
                  <ListItemText primary={board.name} />
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQuickKanbanChat(null)}>
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Diálogo de transferencia de chat */}
        <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Transferir Chat/Contacto</DialogTitle>
          <DialogContent>
            {transferSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {transferSuccess}
              </Alert>
            )}
            {transferError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTransferError(null)}>
                {transferError}
              </Alert>
            )}

            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Selecciona dónde deseas transferir este chat
            </Typography>

            {/* Selector de tipo de transferencia */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" spacing={2}>
                <Button
                  fullWidth
                  variant={transferType === 'agent' ? 'contained' : 'outlined'}
                  onClick={() => setTransferType('agent')}
                  startIcon={<Person />}
                >
                  A Agente
                </Button>
                <Button
                  fullWidth
                  variant={transferType === 'kanban' ? 'contained' : 'outlined'}
                  onClick={() => setTransferType('kanban')}
                  startIcon={<CategoryIcon />}
                >
                  A Kanban
                </Button>
              </Stack>
            </Box>

            {/* Transfer to Agent */}
            {transferType === 'agent' && (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Agente</InputLabel>
                  <Select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    label="Agente"
                  >
                    {onlineAgents.length === 0 ? (
                      <MenuItem disabled>
                        <Typography variant="body2" color="textSecondary">
                          No hay agentes disponibles
                        </Typography>
                      </MenuItem>
                    ) : (
                      onlineAgents.map((agent) => {
                        const isOnline = agent.status === 'online' || agent.status === 'available';
                        const isBusy = agent.status === 'busy';
                        const isOffline = !agent.status || agent.status === 'offline' || agent.status === 'disconnected';

                        return (
                          <MenuItem
                            key={agent.userId}
                            value={agent.userId}
                            disabled={isOffline}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <Box sx={{ position: 'relative' }}>
                                <Avatar sx={{ width: 32, height: 32, bgcolor: isOffline ? '#bdbdbd' : '#00a884' }}>
                                  {agent.userName?.charAt(0) || '?'}
                                </Avatar>
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: isOnline ? '#44b700' : isBusy ? '#ff9800' : '#bdbdbd',
                                    border: '2px solid white'
                                  }}
                                />
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" color={isOffline ? 'text.disabled' : 'text.primary'}>
                                  {agent.userName}
                                </Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {agent.role} •
                                  <span style={{
                                    color: isOnline ? '#4caf50' : isBusy ? '#ff9800' : '#9e9e9e',
                                    fontWeight: 'bold'
                                  }}>
                                    {agent.status === 'online' ? 'En línea' :
                                      agent.status === 'busy' ? 'Ocupado' :
                                        agent.status === 'available' ? 'Disponible' : 'Desconectado'}
                                  </span>
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        );
                      })
                    )}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Motivo de transferencia (opcional)"
                  multiline
                  rows={3}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Ej: Cliente requiere atención especializada"
                />
              </>
            )}

            {/* Transfer to Kanban */}
            {transferType === 'kanban' && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Tablero Kanban</InputLabel>
                <Select
                  value={selectedBoard}
                  onChange={(e) => setSelectedBoard(e.target.value)}
                  label="Tablero Kanban"
                >
                  {kanbanBoards.length === 0 ? (
                    <MenuItem disabled>
                      <Typography variant="body2" color="textSecondary">
                        No hay tableros disponibles
                      </Typography>
                    </MenuItem>
                  ) : (
                    kanbanBoards.map((board) => (
                      <MenuItem key={board.id} value={board.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              bgcolor: board.color,
                              borderRadius: 1
                            }}
                          />
                          <Typography variant="body2">{board.name}</Typography>
                        </Box>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTransferDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransferChat}
              variant="contained"
              disabled={
                (transferType === 'agent' && (!selectedAgent || onlineAgents.length === 0)) ||
                (transferType === 'kanban' && (!selectedBoard || kanbanBoards.length === 0))
              }
              sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008f6f' } }}
            >
              Transferir
            </Button>
          </DialogActions>
        </Dialog>

        {/* Diálogo de reenvío de mensaje */}
        <Dialog open={forwardDialogOpen} onClose={() => setForwardDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Reenviar Mensaje</DialogTitle>
          <DialogContent>
            {transferSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {transferSuccess}
              </Alert>
            )}
            {transferError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTransferError(null)}>
                {transferError}
              </Alert>
            )}

            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Selecciona un chat para reenviar el mensaje
            </Typography>

            {messageToForward && (
              <Paper
                elevation={0}
                sx={{
                  bgcolor: isDarkMode ? '#2a3942' : '#f5f6f6',
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  borderLeft: `4px solid #00a884`
                }}
              >
                <Typography variant="caption" sx={{ color: isDarkMode ? '#aebac1' : '#667781' }}>
                  Mensaje a reenviar:
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {messageToForward.message}
                </Typography>
              </Paper>
            )}

            <FormControl fullWidth>
              <InputLabel>Chat destino</InputLabel>
              <Select
                value={selectedChatForForward}
                onChange={(e) => setSelectedChatForForward(e.target.value)}
                label="Chat destino"
              >
                {filteredChats.map((chat) => (
                  <MenuItem key={chat.id} value={chat.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        src={chat.avatar}
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: chat.isGroup ? '#9c27b0' : '#00a884'
                        }}
                      >
                        {chat.name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">{chat.name}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setForwardDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmForward}
              variant="contained"
              disabled={!selectedChatForForward}
              sx={{ bgcolor: '#00a884', '&:hover': { bgcolor: '#008f6f' } }}
            >
              Reenviar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Diálogo de detalles de reacciones */}
        <Dialog
          open={reactionDetailsDialog.open}
          onClose={() => setReactionDetailsDialog({ open: false, messageId: null })}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Reacciones</DialogTitle>
          <DialogContent>
            {reactionDetails.length === 0 ? (
              <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                No hay reacciones aún
              </Typography>
            ) : (
              <List>
                {reactionDetails.map((detail, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#00a884' }}>
                        {detail.user_name ? detail.user_name.charAt(0) : '?'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={detail.user_name || 'Usuario desconocido'}
                      secondary={new Date(detail.created_at).toLocaleString()}
                    />
                    <Typography variant="h6" sx={{ ml: 2 }}>
                      {detail.reaction}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReactionDetailsDialog({ open: false, messageId: null })}>
              Cerrar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Emoji Picker completo */}
        <Dialog
          open={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Selecciona un Emoji</DialogTitle>
          <DialogContent>
            {Object.entries(emojiCategories).map(([category, emojis]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#00a884', fontWeight: 'bold' }}>
                  {category}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {emojis.map((emoji) => (
                    <IconButton
                      key={emoji}
                      onClick={() => {
                        if (showReactionMenu?.messageId) {
                          handleReactionClick(showReactionMenu.messageId, emoji);
                          setShowEmojiPicker(false);
                        }
                      }}
                      sx={{
                        fontSize: '24px',
                        padding: '8px',
                        '&:hover': {
                          backgroundColor: isDarkMode ? '#2a3942' : '#f0f2f5',
                          transform: 'scale(1.2)'
                        },
                        transition: 'all 0.2s'
                      }}
                    >
                      {emoji}
                    </IconButton>
                  ))}
                </Box>
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowEmojiPicker(false)}>
              Cerrar
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </>
  );
};

export default RealChatModule;