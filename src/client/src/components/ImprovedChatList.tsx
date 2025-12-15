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
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  FormControl,
  InputLabel,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  Tooltip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  SwapHoriz as TransferIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  OpenInNew as OpenLinkIcon,
  Search as SearchIcon,
  Circle as CircleIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAPIBaseURL } from '../utils/socketConfig';
import { useSocket } from '../context/SocketContext';

interface Chat {
  chat_jid: string;
  contact_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  avatar_url?: string;
  conversation_status?: 'open' | 'pending' | 'closed';
}

interface Agent {
  id: number;
  name: string;
  email: string;
  active_chats: number;
  status: string;
}

interface TransferRequest {
  id: number;
  chat_jid: string;
  from_user_id: number;
  to_user_id: number;
  contact_name: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface ImprovedChatListProps {
  sessionId: string;
  onChatSelect: (chatJid: string) => void;
  currentUserId?: number;
  userRole?: 'admin' | 'supervisor' | 'agent';
}

const ImprovedChatList: React.FC<ImprovedChatListProps> = ({
  sessionId,
  onChatSelect,
  currentUserId,
  userRole = 'agent'
}) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfer states
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedChatForTransfer, setSelectedChatForTransfer] = useState<Chat | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [transferReason, setTransferReason] = useState('');

  // Transfer requests
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<TransferRequest | null>(null);

  // Menu states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'success' | 'error' | 'info' });

  const observer = useRef<IntersectionObserver>();
  const listRef = useRef<HTMLDivElement>(null);

  const apiUrl = getAPIBaseURL();
  const token = sessionStorage.getItem('token') || '';

  // Import socket hook
  const { socket, isConnected, on, off } = useSocket();

  // Load chats with pagination
  const loadChats = useCallback(async (pageNum: number = 1) => {
    if (loading) return;

    setLoading(true);
    try {
      const endpoint = userRole === 'agent'
        ? `/api/agent/chats?sessionId=${sessionId}&page=${pageNum}&limit=20`
        : `/api/chats/${sessionId}?page=${pageNum}&limit=20`;

      const response = await fetch(`${apiUrl}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error loading chats');

      const data = await response.json();

      if (data.success) {
        const newChats = data.chats || [];

        // Sort by last message time (newest first)
        const sortedChats = newChats.sort((a: Chat, b: Chat) => {
          const timeA = new Date(a.last_message_time || 0).getTime();
          const timeB = new Date(b.last_message_time || 0).getTime();
          return timeB - timeA;
        });

        if (pageNum === 1) {
          setChats(sortedChats);
          setFilteredChats(sortedChats);
        } else {
          setChats(prev => {
            const updated = [...prev, ...sortedChats];
            setFilteredChats(updated); // Update filtered list too (initially same as full list)
            return updated;
          });
        }

        setHasMore(newChats.length === 20);
        setError(null);
      }
    } catch (err) {
      setError('Error cargando chats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, sessionId, token, userRole, loading]);

  // Load agents for transfer
  const loadAgents = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error loading agents');

      const data = await response.json();
      if (data.success && data.stats.agents) {
        // Filter out current user and inactive agents
        const availableAgents = data.stats.agents.filter(
          (agent: Agent) => agent.id !== currentUserId && agent.status === 'active'
        );
        setAgents(availableAgents);
      }
    } catch (err) {
      console.error('Error loading agents:', err);
    }
  };

  // Load pending transfer requests
  const loadTransferRequests = async () => {
    if (userRole !== 'agent' || !currentUserId) return;

    try {
      const response = await fetch(`${apiUrl}/api/transfer-requests/${currentUserId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTransferRequests(data.requests || []);

          // Show dialog if there are pending requests
          if (data.requests.length > 0 && data.requests[0].status === 'pending') {
            setCurrentRequest(data.requests[0]);
            setRequestDialogOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Error loading transfer requests:', err);
    }
  };

  // Handle transfer request response
  const handleTransferResponse = async (accept: boolean) => {
    if (!currentRequest) return;

    try {
      const response = await fetch(`${apiUrl}/api/transfer-requests/${currentRequest.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accept })
      });

      const data = await response.json();

      if (data.success) {
        setSnackbar({
          open: true,
          message: accept ? 'Chat aceptado correctamente' : 'Chat rechazado',
          severity: 'success'
        });
        setRequestDialogOpen(false);
        setCurrentRequest(null);
        loadChats(1);
        loadTransferRequests();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error procesando solicitud',
        severity: 'error'
      });
    }
  };

  // Handle transfer chat
  const handleTransferChat = async () => {
    if (!selectedChatForTransfer || !selectedAgentId) {
      setSnackbar({
        open: true,
        message: 'Por favor selecciona un agente',
        severity: 'error'
      });
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/chats/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chat_jid: selectedChatForTransfer.chat_jid,
          session_id: sessionId,
          from_user_id: currentUserId,
          to_user_id: selectedAgentId,
          reason: transferReason || 'Transferencia manual',
          request_acceptance: true // Requiere aceptación del agente
        })
      });

      const data = await response.json();

      if (data.success) {
        setSnackbar({
          open: true,
          message: 'Solicitud de transferencia enviada al agente',
          severity: 'success'
        });
        setTransferDialogOpen(false);
        setSelectedChatForTransfer(null);
        setSelectedAgentId('');
        setTransferReason('');
        loadChats(1);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Error transfiriendo chat',
        severity: 'error'
      });
    }
  };

  // Intersection observer for infinite scroll
  const lastChatRef = useCallback((node: HTMLLIElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Initial load
  useEffect(() => {
    loadChats(1);
    if (userRole !== 'agent') {
      loadAgents();
    }

    // ⚡ OPTIMIZACIÓN: Polling desactivado - Socket.IO maneja actualizaciones de chats en tiempo real
    // const interval = setInterval(() => {
    //   loadChats(1);
    // }, 30000);
    // return () => clearInterval(interval);
  }, [sessionId, userRole]);

  // Load more chats when page changes
  useEffect(() => {
    if (page > 1) {
      loadChats(page);
    }
  }, [page]);

  // Load transfer requests for agents
  useEffect(() => {
    if (userRole === 'agent') {
      loadTransferRequests();

      // ⚡ OPTIMIZACIÓN: Polling desactivado - Socket.IO maneja actualizaciones en tiempo real
      // const interval = setInterval(loadTransferRequests, 10000);
      // return () => clearInterval(interval);
    }
    return undefined;
  }, [userRole, currentUserId]);

  // Filter chats when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredChats(chats);
      return;
    }

    const lowerTerm = searchTerm.toLowerCase();
    const filtered = chats.filter(chat =>
      (chat.contact_name && chat.contact_name.toLowerCase().includes(lowerTerm)) ||
      (chat.last_message && chat.last_message.toLowerCase().includes(lowerTerm)) ||
      (chat.chat_jid && chat.chat_jid.toLowerCase().includes(lowerTerm))
    );
    setFilteredChats(filtered);
  }, [searchTerm, chats]);

  // Listen to real-time messages to update chat list order
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 [CHAT-LIST] Socket conectado, escuchando mensajes para reordenar chats');

    const handleNewMessage = (data: any) => {
      console.log('💬 [CHAT-LIST] Nuevo mensaje recibido:', data);

      const messageChatJid = data.chatJid || data.chat_jid || data.from;
      if (!messageChatJid) return;

      // 🔔 Reproducir sonido de notificación si no es del usuario
      if (!data.isFromMe && !data.from_me) {
        try {
          const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2e77eeXUQwOUKnh7K9lGQY4kNf0zHksBCR3x/DdkEAKFF607+uoVhQKRp/f8r9sIQUrgtDy2Yo2CBxnvPXnl1EMDlCq4uusYhkGOI/Y88p6KwQkd8nv3Y9AChRfu+/rp1gTCkmg4PGwayEFK4LR8tmKNggcZ7z156FSCw5QqeHrrWIZBjiP2fPLeSoEJHfJ8N+OQQoUXr3u66hYEwpKod/xsGohBSuC0fLZizUIHGe+9eehUQsOUKrh7KxiGAY4j9r0yHksAyR4yPDej0EKFFz/');
          notificationSound.volume = 0.3;
          notificationSound.play().catch(e => console.log('No se pudo reproducir sonido:', e));
        } catch (e) {
          // Silently fail if audio doesn't work
        }

        // 🔔 Mostrar notificación del navegador si está disponible
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Nuevo mensaje', {
            body: `${data.contactName || 'Contacto'}: ${(data.message || data.text || '').substring(0, 50)}`,
            icon: '/whatsapp-icon.png',
            tag: messageChatJid
          });
        }
      }

      // Actualizar la lista de chats
      setChats(prev => {
        // Buscar el chat existente
        const existingChatIndex = prev.findIndex(c => c.chat_jid === messageChatJid);

        if (existingChatIndex !== -1) {
          // Chat existe - actualizar y mover arriba
          const updatedChats = [...prev];
          const updatedChat = {
            ...updatedChats[existingChatIndex],
            last_message: data.message || data.text || data.text_content || updatedChats[existingChatIndex].last_message,
            last_message_time: data.timestamp || new Date().toISOString(),
            unread_count: data.isFromMe || data.from_me ? updatedChats[existingChatIndex].unread_count : (updatedChats[existingChatIndex].unread_count || 0) + 1
          };

          // Remover de posición actual
          updatedChats.splice(existingChatIndex, 1);

          // Agregar al principio
          updatedChats.unshift(updatedChat);

          console.log('✅ [CHAT-LIST] Chat reordenado y actualizado:', messageChatJid);
          return updatedChats;
        } else {
          // Chat nuevo - agregar al principio
          const newChat: Chat = {
            chat_jid: messageChatJid,
            contact_name: data.contactName || data.pushName || messageChatJid.split('@')[0],
            last_message: data.message || data.text || data.text_content || '',
            last_message_time: data.timestamp || new Date().toISOString(),
            unread_count: data.isFromMe || data.from_me ? 0 : 1,
            avatar_url: data.avatar || undefined
          };

          console.log('✅ [CHAT-LIST] Nuevo chat agregado:', messageChatJid);
          return [newChat, ...prev];
        }
      });
    };

    on('message', handleNewMessage);

    return () => {
      off('message');
    };
  }, [socket, isConnected, on, off]);

  // Handle menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, chat: Chat) => {
    setAnchorEl(event.currentTarget);
    setSelectedChat(chat);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedChat(null);
  };

  const handleTransferClick = () => {
    if (!agents.length) {
      loadAgents();
    }
    setSelectedChatForTransfer(selectedChat);
    setTransferDialogOpen(true);
    handleMenuClose();
  };

  // Render clickable URLs in messages
  const renderMessageWithLinks = (text: string) => {
    if (!text) return '';

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: '#1976d2',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            {part.length > 40 ? part.substring(0, 40) + '...' : part}
            <OpenLinkIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with pending requests badge */}
      {transferRequests.length > 0 && (
        <Box sx={{ p: 2, bgcolor: 'warning.light' }}>
          <Alert severity="info" sx={{ py: 0 }}>
            Tienes {transferRequests.length} solicitud(es) de transferencia pendiente(s)
          </Alert>
        </Box>
      )}

      {/* Search Bar */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar chats..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            sx: { borderRadius: 2, bgcolor: 'background.paper' }
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Chat list */}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '4px'
          }
        }}
      >
        <List>
          {filteredChats.map((chat, index) => {
            const isLastChat = index === filteredChats.length - 1;

            // Determine status color
            let statusColor = '#4caf50'; // Green (Open/New)
            if (chat.conversation_status === 'pending') statusColor = '#ff9800'; // Yellow
            if (chat.conversation_status === 'closed') statusColor = '#f44336'; // Red

            return (
              <ListItem
                key={chat.chat_jid}
                ref={isLastChat ? lastChatRef : null}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={(e) => handleMenuOpen(e, chat)}
                    size="small"
                  >
                    <MoreVertIcon />
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => onChatSelect(chat.chat_jid)}>
                  <ListItemAvatar>
                    <Badge
                      badgeContent={chat.unread_count > 0 ? chat.unread_count : null}
                      color="error"
                      invisible={!chat.unread_count || chat.unread_count === 0}
                    >
                      <Avatar src={chat.avatar_url}>
                        {chat.contact_name?.charAt(0) || '?'}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight="bold" noWrap>
                          {chat.contact_name || 'Sin nombre'}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {/* Status Icon */}
                          <Tooltip title={`Estado: ${chat.conversation_status || 'open'}`}>
                            <CircleIcon sx={{ fontSize: 12, color: statusColor }} />
                          </Tooltip>
                          <Typography variant="caption" color="textSecondary">
                            {chat.last_message_time
                              ? format(new Date(chat.last_message_time), 'HH:mm', { locale: es })
                              : ''}
                          </Typography>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        noWrap
                        sx={{ maxWidth: '280px' }}
                      >
                        {renderMessageWithLinks(chat.last_message || 'Sin mensajes')}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}

          {loading && (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress size={24} />
            </Box>
          )}
        </List>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleTransferClick}>
          <TransferIcon sx={{ mr: 1 }} />
          Transferir a agente
        </MenuItem>
      </Menu>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: theme => ({
            bgcolor: theme.palette.background.paper,
            backgroundImage: 'none'
          })
        }}
      >
        <DialogTitle sx={{ color: 'text.primary' }}>Transferir chat a agente</DialogTitle>
        <DialogContent sx={{ color: 'text.primary' }}>
          {selectedChatForTransfer && (
            <Box mb={2} mt={1}>
              <Typography variant="body2" color="textSecondary">
                Chat: <strong>{selectedChatForTransfer.contact_name}</strong>
              </Typography>
            </Box>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Seleccionar agente</InputLabel>
            <Select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value as number)}
              label="Seleccionar agente"
            >
              {agents.length === 0 ? (
                <MenuItem value="" disabled>
                  Cargando agentes...
                </MenuItem>
              ) : (
                agents.map((agent) => (
                  <MenuItem key={agent.id} value={agent.id}>
                    <Box display="flex" justifyContent="space-between" width="100%">
                      <span>{agent.name}</span>
                      <Chip
                        label={`${agent.active_chats} chats`}
                        size="small"
                        color={agent.active_chats < 5 ? 'success' : agent.active_chats < 10 ? 'warning' : 'error'}
                      />
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Razón de la transferencia (opcional)"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            placeholder="Ej: Especialización en el tema..."
            sx={theme => ({
              '& .MuiOutlinedInput-root': {
                bgcolor: `${theme.palette.background.default}AA`
              }
            })}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            El agente recibirá una solicitud y podrá aceptar o rechazar la transferencia.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleTransferChat} variant="contained" disabled={!selectedAgentId}>
            Enviar solicitud
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Request Dialog */}
      <Dialog
        open={requestDialogOpen}
        onClose={() => { }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: theme => ({
            bgcolor: theme.palette.background.paper,
            backgroundImage: 'none'
          })
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <TransferIcon color="primary" />
            Solicitud de transferencia de chat
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentRequest && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Te han solicitado hacerte cargo del chat con:
              </Typography>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                <strong>{currentRequest.contact_name}</strong>
              </Typography>

              {currentRequest.reason && (
                <Box sx={theme => ({ mt: 2, p: 2, bgcolor: `${theme.palette.background.default}AA`, borderRadius: 1 })}>
                  <Typography variant="caption" color="textSecondary">
                    Razón:
                  </Typography>
                  <Typography variant="body2">
                    {currentRequest.reason}
                  </Typography>
                </Box>
              )}

              <Alert severity="info" sx={{ mt: 2 }}>
                Si aceptas, este chat será asignado a ti y podrás responder al cliente.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => handleTransferResponse(false)}
            variant="outlined"
            color="error"
            startIcon={<CloseIcon />}
          >
            Rechazar
          </Button>
          <Button
            onClick={() => handleTransferResponse(true)}
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
          >
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ImprovedChatList;
